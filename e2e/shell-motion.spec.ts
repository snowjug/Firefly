import type { Page } from '@playwright/test';
import type { FireflyApi } from './support/api.ts';
import { expect, test } from './support/fixtures.ts';
import { settled } from './support/page-probes.ts';

// Motion in the shell and in the design system, seen in a real browser: jsdom cannot play an
// animation. What the page starts is read from the animation events the browser fires, so nothing
// here sleeps to catch a movement half way; whatever is measured is measured after `settled(page)`
// (support/page-probes.ts), which waits for every finite animation and transition to end.
//
// Run one project at a time, against a build:  npx playwright test e2e/shell-motion.spec.ts --project=desktop

declare global {
  interface Window {
    __started?: string[];
    __line?: { began: number; shownAt: number; height: number };
    __lineSeen?: boolean;
    __marks?: Array<{ dialogs: number; opener: boolean; hidden: boolean; pointerEvents: string }>;
  }
}

/** Notes the name of every animation the page starts (a pseudo-element's name carries its own). */
async function recordAnimations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__started = [];
    document.addEventListener(
      'animationstart',
      (event) => window.__started?.push(`${event.animationName}${event.pseudoElement}`),
      true,
    );
  });
}

const started = (page: Page) => page.evaluate(() => window.__started ?? []);
const times = (names: string[], name: string) => names.filter((entry) => entry === name).length;

const heading = (page: Page) => page.getByRole('main').getByRole('heading', { level: 1 });

test.describe('settled(page)', () => {
  const KEYFRAMES =
    '@keyframes drift{to{transform:translateX(40px)}}@keyframes spin{to{transform:rotate(360deg)}}';
  const BOX = 'width:20px;height:20px;background:#000';

  test('waits for a finite transition, even one that only starts at the next paint', async ({
    page,
  }) => {
    await page.setContent(
      '<style>#box{opacity:0;transition:opacity 400ms linear}</style><div id="box">x</div>',
    );
    await page.evaluate(() =>
      requestAnimationFrame(() => {
        document.getElementById('box')!.style.opacity = '1';
      }),
    );
    const began = Date.now();
    await settled(page);
    expect(Date.now() - began).toBeGreaterThan(250);
    expect(
      await page.locator('#box').evaluate((element) => getComputedStyle(element).opacity),
    ).toBe('1');
  });

  test('does not wait for an endless animation: a spinner, a shimmer, a listening pulse', async ({
    page,
  }) => {
    await page.setContent(
      `<style>${KEYFRAMES}#spin{${BOX};animation:spin 1s linear infinite}</style><div id="spin"></div>`,
    );
    const began = Date.now();
    await settled(page);
    expect(Date.now() - began).toBeLessThan(1500);
    const running = await page.evaluate(
      () =>
        document.getAnimations().filter((animation) => animation.playState === 'running').length,
    );
    expect(running, 'the spinner is still turning').toBe(1);
  });

  test('does not wait for a paused animation, which will never end by itself', async ({ page }) => {
    await page.setContent(
      `<style>${KEYFRAMES}#held{${BOX};animation:drift 30s linear;animation-play-state:paused}</style><div id="held"></div>`,
    );
    const began = Date.now();
    await settled(page);
    expect(Date.now() - began).toBeLessThan(1500);
  });

  test('gives up after its timeout with an error that names what is still moving', async ({
    page,
  }) => {
    await page.setContent(
      `<style>${KEYFRAMES}#slow{${BOX};animation:drift 30s linear}</style><div id="slow" class="mover"></div>`,
    );
    await expect(settled(page, { timeout: 600 })).rejects.toThrow(
      /did not settle within 600 ms\. Still moving: animation drift on div#slow\.mover/,
    );
  });
});

test.describe('a page entering', () => {
  test.beforeEach(async ({ page }) => recordAnimations(page));

  test('the page the app loads with is simply there, and a page reached by navigation enters, once', async ({
    page,
  }) => {
    await page.goto('/about');
    await expect(heading(page)).toBeVisible();
    await settled(page);
    expect(times(await started(page), 'ff-route-in'), 'the first page does not enter').toBe(0);

    await page.getByRole('banner').getByRole('link', { name: 'Responsible AI' }).click();
    await expect(page).toHaveURL(/\/responsible-ai$/);
    await expect(heading(page)).toContainText('Responsible AI');
    await settled(page);
    expect(times(await started(page), 'ff-route-in')).toBe(1);
    // At rest it is plainly there: nothing is left over from the entrance.
    const rest = await page.locator('.ff-route').evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.opacity, style.transform];
    });
    expect(rest).toEqual(['1', 'none']);
  });

  test('the landing page keeps its own entrance: reaching it adds none of the shell’s', async ({
    page,
  }) => {
    await page.goto('/about');
    await page.getByRole('link', { name: 'Firefly home' }).first().click();
    await expect(page).toHaveURL(/\/$/);
    await expect(heading(page)).toBeVisible();
    await settled(page);
    expect(times(await started(page), 'ff-route-in')).toBe(0);
  });

  test('a page that arrives inside a view transition (the product tile carried to the brief) does not enter a second time', async ({
    page,
  }) => {
    await page.goto('/scenarios');
    await page.getByRole('link', { name: 'Start configuration' }).click();
    await expect(page).toHaveURL(/\/scenarios\/[^/]+\/brief/);
    await expect(heading(page)).toBeVisible();
    await settled(page);
    expect(times(await started(page), 'ff-route-in')).toBe(0);
  });

  test('has no entrance, and no hidden start, for someone who asked for less motion', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/about');
    await page.getByRole('banner').getByRole('link', { name: 'Responsible AI' }).click();
    await expect(heading(page)).toContainText('Responsible AI');
    // Read at once, with no waiting for anything to settle: not a frame of it may be faded.
    const opacity = await page
      .locator('.ff-route')
      .evaluate((element) => getComputedStyle(element).opacity);
    expect(opacity).toBe('1');
    expect(times(await started(page), 'ff-route-in')).toBe(0);
  });
});

test.describe('the progress line', () => {
  test('is slim, is drawn only once a wait has gone on for about 200 ms, and is gone when the page arrives', async ({
    page,
  }) => {
    await page.goto('/about');
    // The scenarios page's code has not been fetched yet: hold it back for a while.
    await page.route('**/assets/Scenarios-*.js', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await page.evaluate(() => {
      const probe = { began: 0, shownAt: 0, height: 0 };
      window.__line = probe;
      new MutationObserver(() => {
        const line = document.querySelector('.ff-progress-line');
        if (line && !probe.shownAt) {
          probe.shownAt = performance.now();
          probe.height = line.getBoundingClientRect().height;
        }
      }).observe(document.body, { childList: true, subtree: true });
      probe.began = performance.now();
    });
    await page.getByRole('banner').getByRole('link', { name: 'Scenarios', exact: true }).click();

    await expect(page.locator('.ff-progress-line')).toBeVisible();
    // The old page is still there while the new one is on its way.
    await expect(heading(page)).toContainText('About');
    // The workspace adds the scenario it opens with to the address, so only the path is compared.
    await expect(page).toHaveURL(/\/scenarios(\?|$)/);
    await expect(page.locator('.ff-progress-line')).toHaveCount(0);

    const probe = await page.evaluate(() => window.__line!);
    expect(probe.shownAt - probe.began, 'not drawn before a wait of 200 ms').toBeGreaterThanOrEqual(
      200,
    );
    expect(probe.shownAt - probe.began, 'drawn while the page was still on its way').toBeLessThan(
      1500,
    );
    expect(probe.height, 'a thin line, not a bar').toBeLessThanOrEqual(3);
  });

  test('draws nothing for a navigation that is over at once', async ({ page }) => {
    await page.goto('/about');
    await page.getByRole('banner').getByRole('link', { name: 'Responsible AI' }).click();
    await expect(page).toHaveURL(/\/responsible-ai$/);
    await page.evaluate(() => {
      window.__lineSeen = false;
      new MutationObserver(() => {
        if (document.querySelector('.ff-progress-line')) window.__lineSeen = true;
      }).observe(document.body, { childList: true, subtree: true });
    });
    // Back to a page whose code is already here. The wait is longer than the 200 ms after which a line
    // would be drawn: this proves an absence, which only waiting can.
    await page.goBack();
    await expect(page).toHaveURL(/\/about$/);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.__lineSeen)).toBe(false);
  });
});

test.describe('a dialog leaving', () => {
  test.beforeEach(async ({ page }) => recordAnimations(page));

  /**
   * Opens the report's delete confirmation and watches the page for the picture of it that fades
   * out when it closes (`dialog[data-picture]`): at the moment the picture is drawn, is the dialog
   * itself already gone, is focus already back on the opener, and does the picture take no press?
   */
  async function openDeleteDialog(page: Page, api: FireflyApi) {
    const call = await api.completedCall();
    await page.goto(`/sessions/${call.id}/report`);
    const remove = page.getByRole('button', { name: 'Delete this call' });
    await remove.evaluate((element) => element.setAttribute('data-opener', ''));
    await remove.click();
    const dialog = page.getByRole('dialog', { name: 'Delete this call?' });
    await expect(dialog).toBeVisible();
    await settled(page);
    await page.evaluate(() => {
      window.__marks = [];
      new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (!(node instanceof HTMLElement) || !node.matches('dialog[data-picture]')) continue;
            window.__marks!.push({
              dialogs: document.querySelectorAll('dialog:not([data-picture])').length,
              opener: document.activeElement?.hasAttribute('data-opener') ?? false,
              hidden: node.getAttribute('aria-hidden') === 'true' && node.hasAttribute('inert'),
              pointerEvents: getComputedStyle(node).pointerEvents,
            });
          }
        }
      }).observe(document.body, { childList: true });
    });
    return { remove, dialog };
  }

  test('enters with its animation, goes the moment it is closed with focus already back, and fades out as a picture that takes no press', async ({
    page,
    api,
  }) => {
    const { remove, dialog } = await openDeleteDialog(page, api);
    expect(times(await started(page), 'ff-dialog-in'), 'it entered with its animation').toBe(1);

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(remove).toBeFocused();
    await expect.poll(() => page.evaluate(() => window.__marks!.length)).toBe(1);
    expect(await page.evaluate(() => window.__marks![0])).toEqual({
      dialogs: 0,
      opener: true,
      hidden: true,
      pointerEvents: 'none',
    });

    await settled(page);
    expect(times(await started(page), 'ff-dialog-out'), 'its exit played').toBe(1);
    await expect(page.locator('dialog[data-picture], .ff-dialog-scrim')).toHaveCount(0);
  });

  test('draws no picture, and plays no exit, for someone who asked for less motion', async ({
    page,
    api,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const { remove, dialog } = await openDeleteDialog(page, api);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(remove).toBeFocused();
    await settled(page);
    expect(await page.evaluate(() => window.__marks!.length)).toBe(0);
    expect(times(await started(page), 'ff-dialog-out')).toBe(0);
  });

  test.describe('as a sheet on a phone', () => {
    test.use({ viewport: { width: 390, height: 800 } });

    test('slides up in and slides down out, and focus is back on its opener at once', async ({
      page,
      api,
    }) => {
      const { remove, dialog } = await openDeleteDialog(page, api);
      expect(times(await started(page), 'ff-sheet-in'), 'it slid in').toBe(1);
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(remove).toBeFocused();
      await settled(page);
      expect(times(await started(page), 'ff-sheet-out'), 'and slid out').toBe(1);
      expect(
        times(await started(page), 'ff-dialog-out'),
        'rather than fading as a dialog does',
      ).toBe(0);
    });
  });
});

test.describe('a segmented control', () => {
  test.beforeEach(async ({ page }) => recordAnimations(page));

  test('the selection glides to the option chosen and ends exactly in place, and an option compresses a pixel while it is pressed', async ({
    page,
  }) => {
    await page.goto('/about');
    await expect(heading(page)).toBeVisible();
    await settled(page);

    // The choice is applied inside a view transition, a frame after the click: check() would read the
    // radio too soon, so the click and the wait are separate.
    await page.getByRole('radio', { name: 'Dark' }).click({ force: true });
    await expect(page.getByRole('radio', { name: 'Dark' })).toBeChecked();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await settled(page);
    expect(times(await started(page), 'ff-slide-from::before')).toBe(1);
    const selection = page.locator(
      '.ff-theme-select .ff-segmented__item[data-selected] .ff-segmented__face',
    );
    // Still, the selection is neither squashed nor stretched: the glide ends where it started from.
    expect(await selection.evaluate((face) => getComputedStyle(face, '::before').transform)).toBe(
      'none',
    );

    // Pressed, not chosen: the pointer is let go away from the option.
    const light = page.getByRole('radio', { name: 'Light' });
    const face = page
      .locator('.ff-theme-select .ff-segmented__item', { has: light })
      .locator('.ff-segmented__face');
    const box = (await light.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await settled(page);
    expect(await face.evaluate((element) => getComputedStyle(element).transform)).toBe(
      'matrix(1, 0, 0, 1, 0, 1)',
    );
    await page.mouse.move(box.x + box.width / 2, box.y - 200);
    await page.mouse.up();
    await settled(page);
    expect(await face.evaluate((element) => getComputedStyle(element).transform)).toBe('none');
    await expect(page.getByRole('radio', { name: 'Dark' })).toBeChecked();
  });

  test('does not glide for someone who asked for less motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/about');
    await expect(heading(page)).toBeVisible();
    await page.getByRole('radio', { name: 'Dark' }).click({ force: true });
    await expect(page.getByRole('radio', { name: 'Dark' })).toBeChecked();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await settled(page);
    expect(times(await started(page), 'ff-slide-from::before')).toBe(0);
  });
});

test.describe('the menu on a narrow screen', () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test('drops in when it opens and is gone at once when it closes', async ({ page }) => {
    await recordAnimations(page);
    await page.goto('/about');
    const menu = page.getByRole('button', { name: 'Menu', exact: true });
    await menu.click();
    const navigation = page.getByRole('navigation', { name: 'Primary' });
    await expect(navigation).toBeVisible();
    await settled(page);
    expect(times(await started(page), 'ff-menu-in')).toBe(1);
    await menu.click();
    await expect(navigation).toBeHidden();
  });
});
