import type { Locator, Page } from '@playwright/test';
import type { PublicScenarioDTO } from '../shared/domain/api.ts';
import { clippedText, expectAccessible, focusStop, overflow, tabTo } from './support/a11y.ts';
import { callIdOf, callScreen } from './support/call-screen.ts';
import { expect, test } from './support/fixtures.ts';

// The carousel of scenario cards, the product rail above it and the way from a card to a call, in a
// real browser. What the workspace does with a choice (details, setup, the address) is in
// scenarios.spec.ts. Screenshots of the workspace in both themes are kept in this run's output folder
// (see playwright.config.ts) so they can be looked at.

const cardName = (scenario: Pick<PublicScenarioDTO, 'title' | 'shortTitle'>) =>
  scenario.shortTitle.trim() ? scenario.shortTitle : scenario.title;

const count = (page: Page) =>
  page
    .getByRole('main')
    .getByRole('status')
    .filter({ hasText: /\bscenarios?$/ });

const gallery = (page: Page) => page.getByRole('region', { name: 'Scenarios', exact: true });
const scroller = (page: Page) => gallery(page).locator('.ff-carousel__viewport');
const radios = (page: Page) => gallery(page).getByRole('radio');
const rail = (page: Page) => page.getByRole('group', { name: 'Product', exact: true });
const cardOf = (page: Page, id: string): Locator => page.locator(`[data-scenario="${id}"]`);
const previous = (page: Page) => gallery(page).getByRole('button', { name: 'Previous scenarios' });
const next = (page: Page) => gallery(page).getByRole('button', { name: 'Next scenarios' });
const paneFor = (page: Page, scenario: Pick<PublicScenarioDTO, 'title'>) =>
  page.getByRole('region', { name: scenario.title, exact: true });
const exactly = (text: string) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
const boxOf = async (locator: Locator): Promise<Box> => {
  const box = await locator.boundingBox();
  if (!box) throw new Error('The element has no box on screen.');
  return box;
};

/** Opens the workspace once it has caught up with the scenario it chose. */
async function openWorkspace(page: Page, search = '') {
  await page.goto(`/scenarios${search}`);
  await expect(count(page)).toBeVisible();
  await expect(page).toHaveURL(/[?&]scenario=/);
  await expect(radios(page).first()).toBeAttached();
}

/** The ids of the cards, in the order they are shown. */
const shownIds = (page: Page): Promise<string[]> =>
  page
    .locator('.scn-card')
    .evaluateAll((cards) => cards.map((card) => card.getAttribute('data-scenario') ?? ''));

/** How much of a card is inside the carousel's window: 1 is all of it, 0 none. */
async function share(page: Page, id: string): Promise<number> {
  return page.evaluate((scenario) => {
    const card = document.querySelector(`[data-scenario="${scenario}"]`);
    const view = card?.closest('.ff-carousel__viewport');
    if (!card || !view) return 0;
    const a = card.getBoundingClientRect();
    const b = view.getBoundingClientRect();
    return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) / a.width;
  }, id);
}

/** How far the nearest card is from where the window snaps (nothing, at rest, or at the very end). */
async function offSnap(page: Page): Promise<number> {
  return scroller(page).evaluate((view) => {
    if (view.scrollLeft >= view.scrollWidth - view.clientWidth - 2) return 0;
    const box = view.getBoundingClientRect();
    const padding = parseFloat(getComputedStyle(view).scrollPaddingLeft) || 0;
    const gaps = [...view.querySelectorAll('.scn-card')].map((card) =>
      Math.abs(card.getBoundingClientRect().left - box.left - padding),
    );
    return Math.min(...gaps);
  });
}

const scrolled = (page: Page) => scroller(page).evaluate((view) => view.scrollLeft);

/**
 * A finger drawn across the page: down, ten small moves, up. The browser does the scrolling and the
 * snapping itself. (The pauses give the moves a speed, as a real finger has.)
 */
async function swipe(page: Page, from: { x: number; y: number }, dx: number): Promise<void> {
  const steps = 10;
  const client = await page.context().newCDPSession(page);
  try {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: from.x, y: from.y }],
    });
    for (let step = 1; step <= steps; step += 1) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: from.x + (dx * step) / steps, y: from.y }],
      });
      await page.waitForTimeout(16);
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await client.detach();
  }
}

test.describe('from a card to a call', () => {
  test('a card on the landing page opens the workspace with that scenario chosen, Start configuration opens the brief, and a text call begins', async ({
    page,
    api,
  }) => {
    const scenarios = await api.scenarios();
    await page.goto('/');
    const link = page
      .getByRole('main')
      .getByRole('link', { name: /^Use scenario/ })
      .first();
    await expect(link).toBeVisible();
    const id = new URL((await link.getAttribute('href')) ?? '', page.url()).searchParams.get(
      'scenario',
    ) as string;
    const scenario = scenarios.find((item) => item.id === id) as PublicScenarioDTO;
    expect(scenario, 'the featured card names a scenario of the library').toBeDefined();

    await test.step('the card leads to the workspace, with that scenario chosen and in view', async () => {
      await link.click();
      await expect(page.getByRole('heading', { level: 1, name: 'Scenarios' })).toBeVisible();
      await expect.poll(() => new URL(page.url()).searchParams.get('scenario')).toBe(id);
      await expect(cardOf(page, id).getByRole('radio')).toBeChecked();
      await expect.poll(() => share(page, id)).toBeGreaterThan(0.98);
      await expect(
        paneFor(page, scenario).getByRole('heading', { level: 2, name: scenario.title }),
      ).toBeVisible();
    });

    await test.step('Start configuration opens the case brief for it', async () => {
      await paneFor(page, scenario).getByRole('link', { name: 'Start configuration' }).click();
      await expect(page).toHaveURL(new RegExp(`/scenarios/${id}/brief`));
      await expect(page.getByRole('heading', { level: 1, name: 'Case brief' })).toBeVisible();
      await expect(page.getByText(scenario.title).first()).toBeVisible();
    });

    await test.step('a text-only call starts, and the customer greets', async () => {
      await page.getByRole('button', { name: 'Start a text-only call' }).click();
      await expect(page).toHaveURL(/\/calls\/[^/?]+\?input=text/);
      const screen = callScreen(page);
      await screen.preflight.startText.click();
      await expect(screen.turns).toHaveCount(1);
      const greeting = (await api.session(callIdOf(page))).turns[0]!.text;
      await expect(screen.turns.first()).toContainText(greeting);
    });
  });
});

test.describe('the keyboard', () => {
  test('Tab reaches the chosen card, the arrow keys move the choice card by card, Home and End go to the ends, and Tab goes on to the buttons and the details', async ({
    page,
    api,
  }) => {
    const scenarios = await api.scenarios();
    const byId = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
    await openWorkspace(page);
    const ids = await shownIds(page);
    expect(ids).toHaveLength(16);
    const named = (index: number) => byId.get(ids[index] as string) as PublicScenarioDTO;
    const last = ids.length - 1;

    await test.step('Tab arrives on the chosen card, with a ring round the whole card', async () => {
      await tabTo(page, exactly(cardName(named(0))));
      await expect(radios(page).first()).toBeFocused();
      await expect(radios(page).first()).toBeChecked();
      await expect(cardOf(page, ids[0] as string)).toHaveCSS('outline-style', 'solid');
      await expect(page.locator(':focus-visible')).toHaveCount(1);
    });

    await test.step('the right arrow chooses the next card, and the details follow', async () => {
      await page.keyboard.press('ArrowRight');
      await expect(radios(page).nth(1)).toBeChecked();
      await expect(radios(page).nth(1)).toBeFocused();
      await expect(page.getByRole('heading', { level: 2, name: named(1).title })).toBeVisible();
      await expect.poll(() => new URL(page.url()).searchParams.get('scenario')).toBe(ids[1]);
      await expect(gallery(page)).toContainText('2 of 16');
      await page.keyboard.press('ArrowLeft');
      await expect(radios(page).first()).toBeChecked();
      await expect(gallery(page)).toContainText('1 of 16');
    });

    await test.step('End chooses the last card and brings it into view, and the right arrow does not wrap', async () => {
      await page.keyboard.press('End');
      await expect(radios(page).last()).toBeChecked();
      await expect(radios(page).last()).toBeFocused();
      await expect.poll(() => share(page, ids[last] as string)).toBeGreaterThan(0.98);
      await expect(gallery(page)).toContainText('16 of 16');
      await expect(next(page)).toHaveAttribute('aria-disabled', 'true');
      await expect(previous(page)).not.toHaveAttribute('aria-disabled', 'true');
      await page.keyboard.press('ArrowRight');
      await expect(radios(page).last()).toBeChecked();
    });

    await test.step('Home goes back to the first, and the window follows', async () => {
      await page.keyboard.press('Home');
      await expect(radios(page).first()).toBeChecked();
      await expect.poll(() => share(page, ids[0] as string)).toBeGreaterThan(0.98);
      await expect(previous(page)).toHaveAttribute('aria-disabled', 'true');
    });

    await test.step('Tab leaves the cards for the two buttons and then the details, and Shift+Tab comes back', async () => {
      await page.keyboard.press('Tab');
      expect((await focusStop(page))?.name).toBe('Previous scenarios');
      await page.keyboard.press('Tab');
      expect((await focusStop(page))?.name).toBe('Next scenarios');
      await page.keyboard.press('Tab');
      expect(
        await page.evaluate(() => document.activeElement?.closest('.scn-detail') !== null),
        'the next stop is in the details',
      ).toBe(true);
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Shift+Tab');
      await expect(radios(page).first()).toBeFocused();
    });
  });

  test('the next and previous buttons move the window by a page with Enter, and never change the choice', async ({
    page,
  }) => {
    await openWorkspace(page);
    const ids = await shownIds(page);
    await expect(previous(page)).toHaveAttribute('aria-disabled', 'true');
    // A disabled button can still be reached and read: it is not removed from the order.
    await previous(page).focus();
    await expect(previous(page)).toBeFocused();
    await page.keyboard.press('Enter');
    expect(await scrolled(page)).toBe(0);

    await next(page).focus();
    // Only the end that has more beyond it is marked, so only that end fades.
    await expect(scroller(page)).toHaveAttribute('data-more', 'end');
    await page.keyboard.press('Enter');
    await expect.poll(() => scrolled(page)).toBeGreaterThan(200);
    await expect.poll(() => offSnap(page)).toBeLessThan(3);
    await expect(scroller(page)).toHaveAttribute('data-more', 'start end');
    await expect(previous(page)).not.toHaveAttribute('aria-disabled', 'true');
    // Moving the window is not choosing: the first card is still the one chosen.
    await expect(radios(page).first()).toBeChecked();
    await expect.poll(() => new URL(page.url()).searchParams.get('scenario')).toBe(ids[0]);
    await expect(gallery(page)).toContainText('1 of 16');
  });
});

test.describe('the pointer', () => {
  test('dragging the carousel with the mouse moves the cards and chooses none; a click chooses one', async ({
    page,
  }) => {
    await openWorkspace(page);
    const ids = await shownIds(page);
    const start = await boxOf(cardOf(page, ids[2] as string));
    const y = start.y + start.height / 2;

    await test.step('the drag scrolls the window and settles on a card', async () => {
      await page.mouse.move(start.x + start.width / 2, y);
      await page.mouse.down();
      await page.mouse.move(start.x + start.width / 2 - 140, y, { steps: 8 });
      await expect(scroller(page)).toHaveAttribute('data-dragging', /.*/);
      await page.mouse.move(start.x + start.width / 2 - 420, y, { steps: 12 });
      await page.mouse.up();
      await expect.poll(() => scrolled(page)).toBeGreaterThan(200);
      await expect.poll(() => offSnap(page)).toBeLessThan(3);
      await expect(scroller(page)).not.toHaveAttribute('data-dragging', /.*/);
    });

    await test.step('nothing was chosen by it: the first card is still the one', async () => {
      await expect(radios(page).first()).toBeChecked();
      await expect(gallery(page).getByRole('radio', { checked: true })).toHaveCount(1);
      expect(new URL(page.url()).searchParams.get('scenario')).toBe(ids[0]);
      // The count says so in words, so it does not look wrong beside the bar that did move.
      await expect(gallery(page).locator('.ff-carousel__count')).toHaveText('Selected 1 of 16');
    });

    await test.step('a click (no movement) on a card chooses it', async () => {
      const target = await boxOf(cardOf(page, ids[4] as string));
      await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2);
      await expect(cardOf(page, ids[4] as string).getByRole('radio')).toBeChecked();
      await expect.poll(() => new URL(page.url()).searchParams.get('scenario')).toBe(ids[4]);
    });
  });

  for (const drag of [
    { name: 'a quick flick moves one card', dx: -80, steps: 4, pause: 8, lands: 1 },
    {
      name: 'a drag that lets go between two cards goes to the nearer',
      dx: -420,
      steps: 12,
      pause: 16,
      lands: 1,
    },
  ]) {
    test(`${drag.name}, gliding there: no jump, no turning back`, async ({ page }) => {
      await openWorkspace(page);
      const ids = await shownIds(page);
      const first = await boxOf(cardOf(page, ids[0] as string));
      const second = await boxOf(cardOf(page, ids[1] as string));
      const pitch = second.x - first.x;
      const x = second.x + second.width / 2;
      const y = second.y + second.height / 2;

      await page.mouse.move(x, y);
      await page.mouse.down();
      for (let step = 1; step <= drag.steps; step += 1) {
        await page.mouse.move(x + (drag.dx * step) / drag.steps, y);
        await page.waitForTimeout(drag.pause);
      }
      const letGo = await scrolled(page);
      // Every frame from the release on, for the next 1.2 seconds.
      await page.evaluate(() => {
        const view = document.querySelector('.ff-carousel__viewport') as HTMLElement;
        const w = window as unknown as { __frames: number[]; __done: boolean };
        w.__frames = [];
        w.__done = false;
        const t0 = performance.now();
        const tick = () => {
          w.__frames.push(view.scrollLeft);
          if (performance.now() - t0 < 1200) requestAnimationFrame(tick);
          else w.__done = true;
        };
        requestAnimationFrame(tick);
      });
      await page.mouse.up();
      await page.waitForFunction(() => (window as unknown as { __done: boolean }).__done);
      const frames = await page.evaluate(
        () => (window as unknown as { __frames: number[] }).__frames,
      );

      const rest = drag.lands * pitch;
      expect(Math.abs((frames.at(-1) ?? 0) - rest), 'it rests on the card').toBeLessThan(3);
      // The first frame after the release is where it was let go, not a jump to a card.
      expect(Math.abs((frames[0] ?? 0) - letGo), 'no jump at the release').toBeLessThan(pitch / 3);
      // It goes one way, toward the card it comes to rest on.
      const toward = Math.sign(rest - letGo) || 1;
      for (let index = 1; index < frames.length; index += 1) {
        const step = ((frames[index] ?? 0) - (frames[index - 1] ?? 0)) * toward;
        expect(step, `frame ${index} does not turn back`).toBeGreaterThanOrEqual(-1);
        expect(step, `frame ${index} does not jump`).toBeLessThan(pitch / 2);
      }
      await expect(radios(page).first()).toBeChecked();
    });
  }

  for (const motion of ['no-preference', 'reduce'] as const) {
    test(`pointing at a card ${motion === 'reduce' ? 'does not tilt it when motion is reduced' : 'lifts and tilts it'}`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: motion });
      await openWorkspace(page);
      const ids = await shownIds(page);
      const card = cardOf(page, ids[1] as string);
      await card.hover({ position: { x: 40, y: 30 } });
      if (motion === 'reduce') {
        await expect(card).toHaveAttribute('data-fx', 'off');
        await expect(card).toHaveCSS('transform', 'none');
      } else {
        await expect(card).toHaveAttribute('data-fx', 'on');
        await expect
          .poll(() => card.evaluate((el) => getComputedStyle(el).transform))
          .not.toBe('none');
      }
    });
  }
});

test.describe('the product rail', () => {
  test('filters the carousel, keeps one choice, and its indicator follows the chosen chip', async ({
    page,
    api,
  }) => {
    const scenarios = await api.scenarios();
    await openWorkspace(page);
    const windows = scenarios.filter((scenario) => scenario.product.id === 'windows-11');
    const indicator = rail(page).locator('.scn-rail__ind');
    const placed = async (chip: Locator) => {
      const a = await boxOf(indicator);
      const b = await boxOf(chip);
      return Math.abs(a.x - b.x) <= 3 && Math.abs(a.width - b.width) <= 3;
    };

    await test.step('the arrow keys move along the chips and choose', async () => {
      await rail(page)
        .getByRole('radio', { name: /^All\b/ })
        .focus();
      await page.keyboard.press('ArrowRight');
      const teams = rail(page).getByRole('radio', { name: /^Teams\b/ });
      await expect(teams).toBeChecked();
      await expect(count(page)).toHaveText('1 of 16 scenarios');
      await expect(radios(page)).toHaveCount(1);
      await expect.poll(() => new URL(page.url()).searchParams.get('f_product')).toBe('teams');
      await expect.poll(() => placed(rail(page).locator('.scn-chip[data-selected]'))).toBe(true);
      await page.keyboard.press('Home');
      await expect(rail(page).getByRole('radio', { name: /^All\b/ })).toBeChecked();
      await expect(count(page)).toHaveText('16 scenarios');
    });

    await test.step('a chip far along the rail is brought into view and the carousel shows only its scenarios', async () => {
      await rail(page)
        .getByRole('radio', { name: /^Windows\b/ })
        .check();
      await expect(count(page)).toHaveText(`${windows.length} of 16 scenarios`);
      await expect(radios(page)).toHaveCount(windows.length);
      await expect(gallery(page)).toContainText(`1 of ${windows.length}`);
      await expect(gallery(page).getByRole('radio', { checked: true })).toHaveCount(1);
      const chip = rail(page).locator('.scn-chip[data-selected]');
      await expect.poll(() => placed(chip)).toBe(true);
      // The chosen chip is inside the rail's window, not behind its edge.
      await expect
        .poll(() =>
          page.evaluate(() => {
            const chosen = document.querySelector('.scn-chip[data-selected]');
            const strip = chosen?.closest('.scn-rail__scroller');
            if (!chosen || !strip) return false;
            const a = chosen.getBoundingClientRect();
            const b = strip.getBoundingClientRect();
            return a.left >= b.left - 1 && a.right <= b.right + 1;
          }),
        )
        .toBe(true);
    });

    await test.step('the chosen scenario is the first of the ones that remain, and the details show it', async () => {
      const first = windows[0] as PublicScenarioDTO;
      const shown = await shownIds(page);
      expect(shown).toHaveLength(windows.length);
      const chosen = scenarios.find((scenario) => scenario.id === shown[0]) as PublicScenarioDTO;
      await expect(paneFor(page, chosen).getByRole('heading', { level: 2 })).toHaveText(
        chosen.title,
      );
      expect(first.product.id).toBe(chosen.product.id);
    });

    await test.step('dragging the rail with the mouse moves it and chooses nothing', async () => {
      await rail(page)
        .getByRole('radio', { name: /^All\b/ })
        .check();
      await expect(count(page)).toHaveText('16 scenarios');
      const strip = rail(page).locator('.scn-rail__scroller');
      const before = await strip.evaluate((el) => el.scrollLeft);
      const box = await boxOf(rail(page).getByRole('radio', { name: /^Outlook\b/ }));
      const y = box.y + box.height / 2;
      await page.mouse.move(box.x + box.width / 2, y);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 - 260, y, { steps: 10 });
      await page.mouse.up();
      await expect.poll(() => strip.evaluate((el) => el.scrollLeft)).toBeGreaterThan(before + 100);
      await expect(rail(page).getByRole('radio', { name: /^All\b/ })).toBeChecked();
      await expect(count(page)).toHaveText('16 scenarios');
    });
  });
});

test.describe('a link that names a scenario', () => {
  test('far along the carousel opens with that card chosen and in view, the way back enabled', async ({
    page,
    api,
  }) => {
    await page.goto('/scenarios');
    await expect(count(page)).toBeVisible();
    await expect(page).toHaveURL(/[?&]scenario=/);
    const ids = await shownIds(page);
    const far = ids[12] as string;
    const scenario = (await api.scenarios()).find((item) => item.id === far) as PublicScenarioDTO;

    await openWorkspace(page, `?scenario=${far}`);
    await expect(cardOf(page, far).getByRole('radio')).toBeChecked();
    await expect.poll(() => share(page, far)).toBeGreaterThan(0.98);
    // The first card is out of the window, so the carousel did move to the one it was asked for.
    await expect.poll(() => share(page, ids[0] as string)).toBeLessThan(0.5);
    await expect(gallery(page)).toContainText('13 of 16');
    await expect(previous(page)).not.toHaveAttribute('aria-disabled', 'true');
    await expect(
      paneFor(page, scenario).getByRole('heading', { level: 2, name: scenario.title }),
    ).toBeVisible();
    // It rests on a card, not between two.
    await expect.poll(() => offSnap(page)).toBeLessThan(3);
  });

  test('together with a filter keeps both', async ({ page, api }) => {
    const scenarios = await api.scenarios();
    const hard = scenarios.filter((scenario) => scenario.difficulty === 'challenge');
    const target = hard.at(-1) as PublicScenarioDTO;
    await page.goto(`/scenarios?f_difficulty=challenge&scenario=${target.id}`);
    await expect(count(page)).toHaveText(`${hard.length} of 16 scenarios`);
    await expect(radios(page)).toHaveCount(hard.length);
    await expect(cardOf(page, target.id).getByRole('radio')).toBeChecked();
    await expect.poll(() => share(page, target.id)).toBeGreaterThan(0.98);
  });
});

test.describe('a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('fits the screen, shows one card with the next peeking, keeps the way on in reach and moves by touch', async ({
    page,
    api,
  }, testInfo) => {
    const scenarios = await api.scenarios();
    await openWorkspace(page);
    const ids = await shownIds(page);
    const first = scenarios.find((scenario) => scenario.id === ids[0]) as PublicScenarioDTO;

    await test.step('nothing sticks out sideways', async () => {
      const report = await overflow(page);
      expect(report.offenders).toEqual([]);
      expect(report.scrollWidth).toBeLessThanOrEqual(report.innerWidth + 1);
    });

    await test.step('the first card is whole and the next one peeks in beside it', async () => {
      expect(await share(page, ids[0] as string)).toBeGreaterThan(0.98);
      const peek = await share(page, ids[1] as string);
      expect(peek, 'the second card shows a little').toBeGreaterThan(0.04);
      expect(peek, 'but not all of it').toBeLessThan(0.5);
    });

    await test.step('the row runs out to the edge of the window, with about 48 px of the next card, fading out', async () => {
      const width = page.viewportSize()?.width ?? 0;
      const row = await boxOf(scroller(page));
      expect(row.x).toBeLessThanOrEqual(0.5);
      expect(row.x + row.width).toBeGreaterThanOrEqual(width - 0.5);
      const slice = width - (await boxOf(cardOf(page, ids[1] as string))).x;
      expect(slice).toBeGreaterThan(44);
      expect(slice).toBeLessThan(52);
      await expect(scroller(page)).toHaveAttribute('data-more', 'end');
      await expect(scroller(page)).not.toHaveCSS('mask-image', 'none');
    });

    await test.step('the buttons are big enough to touch, and the way on is in view', async () => {
      for (const button of [previous(page), next(page)]) {
        const box = await boxOf(button);
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      await expect(
        paneFor(page, first).getByRole('link', { name: 'Start configuration' }),
      ).toBeInViewport();
    });

    await test.step('a swipe moves the cards, chooses none, and settles on a card', async () => {
      const box = await boxOf(cardOf(page, ids[0] as string));
      await swipe(page, { x: box.x + box.width / 2 + 100, y: box.y + box.height / 2 }, -240);
      await expect.poll(() => scrolled(page)).toBeGreaterThan(150);
      await expect.poll(() => offSnap(page)).toBeLessThan(3);
      await expect(radios(page).first()).toBeChecked();
      expect(new URL(page.url()).searchParams.get('scenario')).toBe(ids[0]);
      // And back again.
      await swipe(page, { x: box.x + 60, y: box.y + box.height / 2 }, 240);
      await expect.poll(() => scrolled(page)).toBe(0);
    });

    await test.step('a tap on a card chooses it', async () => {
      const second = cardOf(page, ids[1] as string);
      await second.scrollIntoViewIfNeeded();
      await second.getByRole('radio').tap();
      await expect(second.getByRole('radio')).toBeChecked();
      await expect.poll(() => new URL(page.url()).searchParams.get('scenario')).toBe(ids[1]);
    });

    await test.step('with the setup open nothing is cut off and nothing sticks out sideways', async () => {
      await page.getByRole('button', { name: /^Customise/ }).tap();
      await expect(page.getByRole('button', { name: /^Customise/ })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      expect((await overflow(page)).offenders).toEqual([]);
      expect(await clippedText(page, 'main'), 'no label is cut off by its own box').toEqual([]);
    });

    await page.screenshot({ path: testInfo.outputPath('workspace-390.png'), fullPage: true });
  });
});

// The Pixel 7 profile of the mobile project (412 px wide, touch): the same page, the same peek.
test('@mobile the cards peek, a swipe moves them without choosing, a tap chooses, and the way on is in reach', async ({
  page,
}) => {
  await openWorkspace(page);
  const ids = await shownIds(page);
  expect((await overflow(page)).offenders).toEqual([]);
  expect(await share(page, ids[0] as string)).toBeGreaterThan(0.98);
  expect(await share(page, ids[1] as string)).toBeGreaterThan(0.04);
  await expect(page.getByRole('link', { name: 'Start configuration' })).toBeInViewport();

  const box = await boxOf(cardOf(page, ids[0] as string));
  await swipe(page, { x: box.x + box.width / 2 + 100, y: box.y + box.height / 2 }, -240);
  await expect.poll(() => scrolled(page)).toBeGreaterThan(150);
  await expect.poll(() => offSnap(page)).toBeLessThan(3);
  await expect(radios(page).first()).toBeChecked();

  await cardOf(page, ids[1] as string)
    .getByRole('radio')
    .tap();
  await expect(cardOf(page, ids[1] as string).getByRole('radio')).toBeChecked();
  await page.getByRole('link', { name: 'Start configuration' }).tap();
  await expect(page.getByRole('heading', { level: 1, name: 'Case brief' })).toBeVisible();
});

test.describe('motion', () => {
  for (const motion of ['no-preference', 'reduce'] as const) {
    test(`"Start configuration" ${motion === 'reduce' ? 'is a plain page change when motion is reduced' : 'carries the product tile across as a view transition'}`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: motion });
      await page.addInitScript(() => {
        const w = window as unknown as { __transitions: number };
        w.__transitions = 0;
        const original = document.startViewTransition?.bind(document);
        if (original) {
          document.startViewTransition = ((...args: Parameters<typeof original>) => {
            w.__transitions += 1;
            return original(...args);
          }) as typeof document.startViewTransition;
        }
      });
      await openWorkspace(page);
      const supported = await page.evaluate(() => 'startViewTransition' in document);
      test.skip(!supported, 'this browser has no view transitions: nothing is expected to change');

      await page.getByRole('link', { name: 'Start configuration' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Case brief' })).toBeVisible();
      const used = await page.evaluate(
        () => (window as unknown as { __transitions: number }).__transitions,
      );
      if (motion === 'reduce') expect(used).toBe(0);
      else expect(used).toBeGreaterThan(0);
    });
  }
});

test.describe('the themes', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`the workspace and the brief in the ${theme} theme: screenshots, and no accessibility violations`, async ({
      page,
      context,
    }, testInfo) => {
      await context.addInitScript((value) => {
        try {
          localStorage.setItem('firefly.theme', value);
        } catch {
          // A blank page (axe opens one) has no storage: nothing to set there.
        }
      }, theme);
      await openWorkspace(page);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(radios(page).first()).toBeChecked();

      await page.screenshot({
        path: testInfo.outputPath(`workspace-${theme}.png`),
        fullPage: true,
      });
      await expectAccessible(page, testInfo, `the workspace, ${theme}`);

      // The second card chosen, and the setup open: more of the page to look at.
      await radios(page).nth(1).check();
      await page.getByRole('button', { name: /^Customise/ }).click();
      await expect(page.getByRole('button', { name: /^Customise/ })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      await page.mouse.move(0, 0);
      await page.screenshot({
        path: testInfo.outputPath(`workspace-${theme}-setup.png`),
        fullPage: true,
      });
      await expectAccessible(page, testInfo, `the workspace, ${theme}, with the setup open`);
      expect(await clippedText(page, 'main'), 'no label is cut off by its own box').toEqual([]);

      await page.getByRole('link', { name: 'Start configuration' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Case brief' })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`brief-${theme}.png`), fullPage: true });
      await expectAccessible(page, testInfo, `the case brief, ${theme}`);
    });
  }
});
