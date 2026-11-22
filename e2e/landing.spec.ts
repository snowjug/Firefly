import type { Page } from '@playwright/test';
import { expectAccessible, focusStop, type FocusStop } from './support/a11y.ts';
import { expect, test } from './support/fixtures.ts';
import { readProbe, settled } from './support/page-probes.ts';

// The landing page and the pages around it, as someone arriving for the first time: the hero and its
// call preview, the featured scenarios, the header's moving parts, the themes and a phone.

const WORKSPACE = { level: 1, name: 'Scenarios' } as const;
const TITLE = 'Practise Microsoft support calls safely.';
const CAPTION = 'Example call. The customer is synthetic.';
const TRAINEE_LINE = "Yes, you've reached support. My name is Alex. How can I help today?";

interface CallState {
  phase: string | null;
  speaking: string | null;
  shown: number;
  quoted: number;
  scored: number;
}

/** What the call preview is showing, read from the attributes its own stylesheet reads. */
async function callState(page: Page): Promise<CallState> {
  // The page is its own chunk: wait for the preview's chosen panel before reading it.
  await page.locator('[role="tabpanel"][data-selected] .lp-panel').waitFor();
  const state = await page.evaluate(() => {
    const panel = document.querySelector('[role="tabpanel"][data-selected] .lp-panel');
    if (!panel) return null;
    const count = (selector: string) => panel.querySelectorAll(selector).length;
    return {
      phase: panel.getAttribute('data-phase'),
      speaking: panel.getAttribute('data-speaking'),
      shown: count('.lp-line[data-shown]'),
      quoted: count('.lp-mini__row[data-quoted]'),
      scored: count('.lp-mini__row[data-scored]'),
    };
  });
  if (!state) throw new Error('The call preview has no chosen panel.');
  return state;
}

const sameState = (a: CallState, b: CallState) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Moves through the six skills of the report preview with the arrow keys, and notes, at each, how
 * tall the card is and where its last row starts. Neither may change with the choice: a row that
 * moves as it is pointed at, or tapped, is a row that is missed.
 */
async function walkTheSkills(page: Page) {
  const skills = page.getByRole('group', { name: 'Skills' }).getByRole('radio');
  const geometry = () =>
    page.evaluate(() => {
      const card = document.querySelector('.lp-rp__card') as HTMLElement;
      const rows = document.querySelectorAll('.lp-rp__row');
      const last = rows[rows.length - 1] as HTMLElement;
      const top = card.getBoundingClientRect().top;
      return {
        height: card.getBoundingClientRect().height,
        lastRowTop: last.getBoundingClientRect().top - top,
      };
    });
  await skills.first().focus();
  // The card rises into place as it scrolls into view, and a box measured in mid-air carries the
  // rounding of a fractional offset: measure it at rest.
  await settled(page);
  const seen = [await geometry()];
  for (let index = 1; index < (await skills.count()); index += 1) {
    await page.keyboard.press('ArrowDown');
    await expect(skills.nth(index)).toBeChecked();
    seen.push(await geometry());
  }
  expect(seen).toHaveLength(6);
  expect(new Set(seen.map((one) => one.height)).size, 'the card changes height').toBe(1);
  expect(new Set(seen.map((one) => one.lastRowTop)).size, 'the rows move').toBe(1);
}

/** The focused control, or something around it, draws a focus ring (an outline of a pixel or more). */
const ringAround = (page: Page) =>
  page.evaluate(() => {
    for (
      let node = document.activeElement;
      node && node !== document.body;
      node = node.parentElement
    ) {
      const style = getComputedStyle(node);
      if (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 1) return true;
    }
    return false;
  });

/** The heights of the footer's links and of the segments of its theme choice, as laid out now. */
const footerTargets = (page: Page) =>
  page.evaluate(() => ({
    links: [...document.querySelectorAll('.ff-footer__links a')].map(
      (link) => link.getBoundingClientRect().height,
    ),
    segments: [...document.querySelectorAll('.ff-footer .ff-segmented__item')].map(
      (item) => item.getBoundingClientRect().height,
    ),
  }));

/** The right edge of the first match, in pixels from the left of the window. */
const rightEdge = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((element) => element.getBoundingClientRect().right);

/** Animations that are still running and last longer than a frame, as the browser reports them. */
const longAnimations = (page: Page) =>
  page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => {
        const end = animation.effect?.getComputedTiming().endTime;
        return typeof end !== 'number' || end > 1;
      })
      .map((animation) =>
        animation instanceof CSSAnimation
          ? `animation ${animation.animationName}`
          : animation instanceof CSSTransition
            ? `transition ${animation.transitionProperty}`
            : 'animation',
      ),
  );

test.describe('landing', () => {
  test('shows the hero and its call at once, and asks the server for the app settings and the featured scenarios, nothing else', async ({
    page,
  }) => {
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url());
    });

    await test.step('open the address', async () => {
      await page.goto('/');
      await expect(page).toHaveTitle('Firefly: practise Microsoft support calls');
    });

    await test.step('one h1 with the promise, one line and the way in', async () => {
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(TITLE);
      const hero = page.getByRole('region', { name: TITLE });
      await expect(
        hero.getByText(
          'Speak with a realistic customer. Review evidence-based coaching after the call.',
        ),
      ).toBeVisible();
      await expect(hero.getByRole('link', { name: 'Start call' })).toBeVisible();
      await expect(hero.getByRole('link', { name: 'Explore scenarios' })).toBeVisible();
    });

    await test.step('a call preview that says it is an example with a synthetic customer', async () => {
      const preview = page.getByRole('figure', { name: CAPTION });
      await expect(preview).toBeVisible();
      await expect(preview.getByRole('tab')).toHaveText(['Teams', 'Outlook', 'Entra ID']);
      await expect(preview.getByRole('tab', { name: 'Teams' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await expect(preview.getByText('Microsoft Teams')).toBeVisible();
    });

    await test.step('the parts below, in order, each under its own heading', async () => {
      await expect(page.getByRole('heading')).toHaveText([
        TITLE,
        'Featured scenarios',
        'How it works',
        'Coaching evidence',
        'Start a Microsoft support call',
      ]);
      const steps = page.getByRole('region', { name: 'How it works' });
      await expect(steps.getByRole('listitem')).toHaveText([
        /Choose scenario/,
        /Speak naturally/,
        /Review coaching/,
      ]);
      const note = page.getByRole('region', { name: 'Responsible use' });
      await expect(note).toContainText('Synthetic scenarios only.');
      await expect(note).toContainText('Coaching, not performance assessment.');
      await expect(note.getByRole('link', { name: /^Learn more/ })).toHaveAttribute(
        'href',
        '/responsible-ai',
      );
    });

    await test.step('the only requests to the server are for the settings and the featured scenarios', async () => {
      await page.waitForLoadState('networkidle');
      expect(apiRequests.map((url) => new URL(url).pathname).sort()).toEqual([
        '/api/config',
        '/api/scenarios',
      ]);
    });

    await test.step('Start call works', async () => {
      await page
        .getByRole('region', { name: TITLE })
        .getByRole('link', { name: 'Start call' })
        .click();
      await expect(page).toHaveURL(/\/scenarios(\?.*)?$/);
      await expect(page.getByRole('heading', WORKSPACE)).toBeVisible();
    });
  });

  test.describe('the hero’s entrance', () => {
    /** Records, on every frame from the one a part first exists, how opaque it is, and the layout shift. */
    const watchEntrance = (page: Page) =>
      page.addInitScript(() => {
        const w = window as unknown as {
          __entrance: { shift: number; opacity: Record<string, number[]> };
        };
        w.__entrance = { shift: 0, opacity: {} };
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as unknown as {
            value: number;
            hadRecentInput: boolean;
          }[]) {
            if (!entry.hadRecentInput) w.__entrance.shift += entry.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });
        const parts = {
          title: '.lp-hero__title',
          lead: '.lp-hero__lead',
          actions: '.lp-hero__actions',
          call: '.lp-hero__art',
        };
        const tick = () => {
          for (const [name, selector] of Object.entries(parts)) {
            const element = document.querySelector(selector);
            const seen = (w.__entrance.opacity[name] ??= []);
            if (element && seen.length < 300) seen.push(Number(getComputedStyle(element).opacity));
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    const readEntrance = (page: Page) =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __entrance: { shift: number; opacity: Record<string, number[]> };
            }
          ).__entrance,
      );
    /** The first frame on which a part is on screen at all. */
    const firstSeen = (frames: number[] | undefined) =>
      (frames ?? []).findIndex((opacity) => opacity > 0);

    test('comes in a beat at a time, the promise first and on screen from its first frame, and moves nothing else', async ({
      page,
    }) => {
      await watchEntrance(page);
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(TITLE);
      await settled(page);
      const { shift, opacity } = await readEntrance(page);

      // The promise is the largest thing on the page: it is on screen from the first frame it exists
      // (faint, then whole), because text held at nothing is not counted as painted until its fade ends.
      const order = ['title', 'lead', 'actions', 'call'].map((name) => firstSeen(opacity[name]));
      expect(order[0], 'the promise is on screen on its first frame').toBe(0);
      // Each part is on screen no earlier than the one before it: the order they come in.
      for (let index = 1; index < order.length; index += 1) {
        expect(order[index], `part ${index} is seen at all`).toBeGreaterThanOrEqual(0);
        expect(
          order[index] as number,
          `part ${index} comes after part ${index - 1}`,
        ).toBeGreaterThanOrEqual(order[index - 1] as number);
      }
      // And they all end whole.
      for (const frames of Object.values(opacity)) expect(frames.at(-1)).toBe(1);
      // Opacity and a rise are all that moves: no layout shift.
      expect(shift, 'layout shift').toBeLessThan(0.02);
    });

    test.describe('with reduced motion', () => {
      test.use({ reducedMotion: 'reduce' });

      test('has every part whole on its first frame, and moves nothing', async ({ page }) => {
        await watchEntrance(page);
        await page.goto('/');
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(TITLE);
        const { shift, opacity } = await readEntrance(page);
        for (const [name, frames] of Object.entries(opacity)) {
          expect(frames.length, `${name} was watched`).toBeGreaterThan(0);
          expect(
            frames.every((value) => value === 1),
            `${name} is whole on every frame`,
          ).toBe(true);
        }
        expect(shift).toBeLessThan(0.02);
        expect(await longAnimations(page)).toEqual([]);
      });
    });
  });

  test.describe('the call preview', () => {
    test('plays a short call by itself: the customer speaks, the trainee answers, the call ends and a report appears', async ({
      page,
    }) => {
      await page.goto('/');
      const preview = page.getByRole('figure', { name: CAPTION });
      await expect(preview).toBeVisible();

      await test.step('the lines arrive one after another and the customer’s state changes', async () => {
        const teams = preview.getByRole('tabpanel', { name: 'Teams' });
        await expect.poll(async () => (await callState(page)).speaking).toBe('customer');
        await expect.poll(async () => (await callState(page)).shown, { timeout: 15_000 }).toBe(3);
        await expect(teams.getByText(TRAINEE_LINE)).toBeVisible();
        await expect(
          teams.getByText('Our Teams meetings stopped working for external guests this morning.'),
        ).toBeVisible();
        await expect(teams.getByText('Concerned')).toBeVisible();
      });

      await test.step('then the call ends and the card turns into a report: the quotes first, the scores after', async () => {
        const teams = preview.getByRole('tabpanel', { name: 'Teams' });
        await expect
          .poll(async () => (await callState(page)).phase, { timeout: 15_000 })
          .toBe('report');
        await expect.poll(async () => (await callState(page)).quoted).toBe(3);
        await expect.poll(async () => (await callState(page)).scored, { timeout: 8_000 }).toBe(3);
        await expect(teams.getByText('After the call')).toBeVisible();
        await expect(teams.getByText('Turn 2')).toBeVisible();
      });
    });

    test('has a button that pauses it and plays it again, named for what it will do', async ({
      page,
    }) => {
      await page.goto('/');
      await expect.poll(async () => (await callState(page)).shown).toBeGreaterThan(0);
      await page.getByRole('button', { name: 'Pause preview' }).click();
      await expect(page.getByRole('button', { name: 'Play preview' })).toBeVisible();

      const paused = await callState(page);
      await page.waitForTimeout(2500);
      expect(sameState(await callState(page), paused), 'it did not move while paused').toBe(true);

      await page.getByRole('button', { name: 'Play preview' }).click();
      await expect(page.getByRole('button', { name: 'Pause preview' })).toBeVisible();
      await expect
        .poll(async () => sameState(await callState(page), paused), { timeout: 12_000 })
        .toBe(false);
    });

    test('is operated from the keyboard, and the control keeps focus', async ({ page }) => {
      await page.goto('/');
      const pause = page.getByRole('button', { name: 'Pause preview' });
      await pause.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('button', { name: 'Play preview' })).toBeFocused();
      await page.keyboard.press('Space');
      await expect(page.getByRole('button', { name: 'Pause preview' })).toBeFocused();
    });

    test('stops while it is scrolled out of the window, and carries on when it is back', async ({
      page,
    }) => {
      await page.goto('/');
      await expect.poll(async () => (await callState(page)).shown).toBeGreaterThan(0);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(600);
      const away = await callState(page);
      await page.waitForTimeout(2500);
      expect(sameState(await callState(page), away), 'it did not move while out of view').toBe(
        true,
      );
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect
        .poll(async () => sameState(await callState(page), away), { timeout: 12_000 })
        .toBe(false);
    });

    test('plays no sound and never asks for the microphone', async ({ page }) => {
      await page.goto('/');
      await expect.poll(async () => (await callState(page)).shown).toBeGreaterThan(1);
      const probe = await readProbe(page);
      expect(probe.playCalls).toEqual([]);
      expect(probe.mediaElements).toBe(0);
      expect(probe.synthesisCalls).toBe(0);
      expect(probe.mediaRequests).toBe(0);
      await expect(page.locator('audio, video')).toHaveCount(0);
    });

    test('plays three times and then rests on the report, with a button that plays it again', async ({
      page,
    }) => {
      test.setTimeout(90_000);
      await page.goto('/');
      // The call is over, so the control says "Replay": the three runs are played and it starts again.
      const replay = page.getByRole('button', { name: 'Replay preview' });
      await expect(replay).toBeVisible({ timeout: 70_000 });
      const rest = await callState(page);
      expect(rest).toMatchObject({ phase: 'report', shown: 3, quoted: 3, scored: 3 });
      // The two microphone pictures step back: nothing on the card says a call is still going.
      await expect(
        page.locator('[role="tabpanel"][data-selected] .lp-panel__indicators'),
      ).toHaveCSS('opacity', '0.4');
      await page.waitForTimeout(1500);
      expect(sameState(await callState(page), rest), 'it stays at rest').toBe(true);
      await replay.click();
      await expect(page.getByRole('button', { name: 'Pause preview' })).toBeFocused();
      await expect.poll(async () => (await callState(page)).phase).toBe('call');
    });

    test('moves ONE line to the product that is chosen, and starts that call from the top', async ({
      page,
    }) => {
      await page.goto('/');
      const preview = page.getByRole('figure', { name: CAPTION });
      const line = preview.locator('.lp-preview__line');
      await expect(line).toHaveCount(1);
      const before = await line.boundingBox();
      await preview.getByRole('tab', { name: 'Outlook' }).click();
      await expect(preview.getByRole('tab', { name: 'Outlook' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await expect
        .poll(async () => (await line.boundingBox())?.x ?? 0)
        .toBeGreaterThan((before?.x ?? 0) + 50);
      // The line slides, so it is measured once it has arrived: it ends up under the tab, within it.
      await expect
        .poll(async () => {
          const tab = await preview.getByRole('tab', { name: 'Outlook' }).boundingBox();
          const moved = await line.boundingBox();
          if (!tab || !moved) return [];
          return [moved.x >= tab.x - 1, moved.x + moved.width <= tab.x + tab.width + 1];
        })
        .toEqual([true, true]);
      await expect(preview.getByRole('tabpanel', { name: 'Outlook' })).toContainText(
        'Daniel Reyes',
      );
      await expect.poll(async () => (await callState(page)).speaking).toBe('customer');
      // Arrow keys do the same from the keyboard.
      await preview.getByRole('tab', { name: 'Outlook' }).focus();
      await page.keyboard.press('ArrowRight');
      await expect(preview.getByRole('tab', { name: 'Entra ID', selected: true })).toBeFocused();
    });

    test('turns a degree or two toward a mouse, and settles when it leaves', async ({ page }) => {
      await page.goto('/');
      const window_ = page.locator('.lp-preview__window');
      await expect(window_).toHaveAttribute('data-fx', 'on');
      const box = await window_.boundingBox();
      if (!box) throw new Error('The preview window has no box.');
      await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.2, { steps: 4 });
      await expect
        .poll(() => window_.evaluate((element) => getComputedStyle(element).transform))
        .toMatch(/^matrix3d/);
      const degrees = await window_.evaluate((element) => [
        parseFloat(element.style.getPropertyValue('--tilt-x')),
        parseFloat(element.style.getPropertyValue('--tilt-y')),
      ]);
      for (const value of degrees) expect(Math.abs(value)).toBeLessThanOrEqual(2);
      await page.mouse.move(5, 5);
      await expect
        .poll(() => window_.evaluate((element) => getComputedStyle(element).transform))
        .toBe('none');
    });
  });

  test.describe('the call preview with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('shows the call and the report, whole, and does not move, so it has nothing to pause', async ({
      page,
    }) => {
      await page.goto('/');
      const preview = page.getByRole('figure', { name: CAPTION });
      await expect(preview).toBeVisible();
      const teams = preview.getByRole('tabpanel', { name: 'Teams' });
      expect(await callState(page)).toMatchObject({
        phase: 'report',
        shown: 3,
        quoted: 3,
        scored: 3,
      });
      await expect(teams.getByText(TRAINEE_LINE)).toBeVisible();
      await expect(teams.getByText('After the call')).toBeVisible();
      await expect(teams.getByText('Call ended')).toBeAttached();
      await expect(page.getByRole('button', { name: /preview/i })).toHaveCount(0);
      const first = await callState(page);
      await page.waitForTimeout(2500);
      expect(sameState(await callState(page), first)).toBe(true);
      await page.getByRole('link').first().focus();
      expect(await longAnimations(page)).toEqual([]);
    });

    test('keeps the tabs working, each product showing its finished call', async ({ page }) => {
      await page.goto('/');
      const preview = page.getByRole('figure', { name: CAPTION });
      await preview.getByRole('tab', { name: 'Outlook' }).click();
      const panel = preview.getByRole('tabpanel', { name: 'Outlook' });
      await expect(panel).toContainText('We cannot open Outlook this morning');
      await expect(panel.getByText('After the call')).toBeVisible();
    });
  });

  test.describe('the featured scenarios', () => {
    test('load as cards, and "Use scenario" opens the workspace with that scenario chosen', async ({
      page,
    }) => {
      await page.goto('/');
      const section = page.getByRole('region', { name: 'Featured scenarios' });
      const gallery = section.getByRole('region', { name: 'Scenario cards' });
      await expect(gallery).toBeVisible();
      const cards = gallery.getByRole('listitem');
      expect(await cards.count()).toBeGreaterThanOrEqual(8);
      expect(await cards.count()).toBeLessThanOrEqual(12);

      const links = gallery.getByRole('link', { name: /Use scenario/ });
      const hrefs = await links.evaluateAll((elements) =>
        elements.map((element) => element.getAttribute('href')),
      );
      expect(new Set(hrefs).size, 'nothing is shown twice').toBe(hrefs.length);

      const first = links.first();
      const href = (await first.getAttribute('href')) ?? '';
      const id = new URL(href, 'http://firefly.test').searchParams.get('scenario') ?? '';
      expect(id).not.toBe('');
      await first.click();
      await expect(page).toHaveURL(new RegExp(`/scenarios\\?.*scenario=${id}`));
      await expect(page.getByRole('heading', WORKSPACE)).toBeVisible();
      await expect(page.locator(`input[type="radio"][value="${id}"]`)).toBeChecked();
    });

    test('are different products, one card for each, so the row is varied', async ({ page }) => {
      await page.goto('/');
      const gallery = page.getByRole('region', { name: 'Scenario cards' });
      await expect(gallery).toBeVisible();
      const products = await gallery
        .getByRole('listitem')
        .evaluateAll((items) =>
          items.map((item) => item.querySelector('.scn-card__product')?.textContent?.trim() ?? ''),
        );
      expect(products.every(Boolean)).toBe(true);
      expect(new Set(products).size).toBe(products.length);
    });

    test('are one click away from "Explore scenarios", which stays on the page and brings the section into view', async ({
      page,
    }) => {
      await page.goto('/');
      await page.getByRole('link', { name: 'Explore scenarios' }).click();
      await expect(page).toHaveURL(/\/#featured$/);
      const section = page.getByRole('region', { name: 'Featured scenarios' });
      await expect(section).toBeInViewport();
      await expect(section).toBeFocused();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(TITLE);
    });

    for (const motion of ['no-preference', 'reduce'] as const) {
      test(`"Explore scenarios" ${motion === 'reduce' ? 'jumps to the featured row when motion is reduced' : 'glides to the featured row, and the page goes back to jumping once it has arrived'}`, async ({
        page,
      }) => {
        await page.emulateMedia({ reducedMotion: motion });
        await page.goto('/');
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(TITLE);
        await settled(page);
        // Where the page is on every frame from the press.
        const sampling = page.evaluate(
          () =>
            new Promise<number[]>((resolve) => {
              const values: number[] = [];
              const tick = () => {
                values.push(Math.round(window.scrollY));
                if (values.length < 45) requestAnimationFrame(tick);
                else resolve(values);
              };
              requestAnimationFrame(tick);
            }),
        );
        await page.getByRole('link', { name: 'Explore scenarios' }).click();
        const values = await sampling;
        const end = values.at(-1) ?? 0;
        expect(end, 'it arrives at the featured row').toBeGreaterThan(200);
        const onTheWay = values.filter((value) => value > 0 && value < end - 1);
        if (motion === 'reduce') expect(onTheWay, 'it jumps').toEqual([]);
        else expect(onTheWay.length, 'it glides: some frames are on the way').toBeGreaterThan(0);
        // The page is asked to glide only for the moment the press needs.
        await expect
          .poll(() => page.evaluate(() => document.documentElement.hasAttribute('data-glide')), {
            timeout: 4_000,
          })
          .toBe(false);
      });
    }

    test('say so quietly when the server cannot give them, with a way to try again and a link to all of them', async ({
      page,
      problems,
    }) => {
      problems.allow({ status: 500, url: '/api/scenarios' });
      let failing = true;
      await page.route('**/api/scenarios', async (route) => {
        if (!failing) return route.fallback();
        return route.fulfill({
          status: 500,
          json: { error: { code: 'internal', message: 'Something went wrong.', retryable: true } },
        });
      });
      await page.goto('/');
      const section = page.getByRole('region', { name: 'Featured scenarios' });
      await expect(section.getByText('Scenarios did not load.')).toBeVisible();
      await expect(section.getByRole('link', { name: 'Browse all scenarios' })).toHaveAttribute(
        'href',
        '/scenarios',
      );
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(TITLE);
      await expect(page.getByText(/Something went wrong\./)).toHaveCount(0);

      failing = false;
      await section.getByRole('button', { name: 'Try again' }).click();
      await expect(section.getByRole('region', { name: 'Scenario cards' })).toBeVisible();
      await expect(section.getByText('Scenarios did not load.')).toHaveCount(0);
    });

    test('say that the visitor is offline, when they are, and load when they are back', async ({
      page,
      context,
      problems,
    }) => {
      problems.allowOffline();
      let blocked = true;
      await page.route('**/api/scenarios', async (route) => {
        if (blocked) return route.abort('connectionrefused');
        return route.fallback();
      });
      await page.goto('/');
      const section = page.getByRole('region', { name: 'Featured scenarios' });
      await expect(section.getByText('Scenarios did not load.')).toBeVisible();
      await context.setOffline(true);
      await expect(section.getByText('You are offline.')).toBeVisible();
      await expect(section.getByRole('link', { name: 'Browse all scenarios' })).toBeVisible();
      await context.setOffline(false);
      blocked = false;
      await section.getByRole('button', { name: 'Try again' }).click();
      await expect(section.getByRole('region', { name: 'Scenario cards' })).toBeVisible();
    });
  });

  test.describe('the report preview', () => {
    test('shows its evidence first, and the words of whichever skill is chosen', async ({
      page,
    }) => {
      await page.goto('/');
      const region = page.getByRole('region', { name: 'Coaching evidence' });
      await region.scrollIntoViewIfNeeded();
      const evidence = region.locator('.lp-rp__evidence');
      await expect(region.getByText('Example report. Synthetic call.')).toBeVisible();
      await expect(evidence.getByText('Turn 4', { exact: true })).toBeVisible();
      await expect(region.getByRole('blockquote')).toContainText(
        'Which guests are affected, and when did it start?',
      );
      const skills = region.getByRole('group', { name: 'Skills' });
      await expect(skills.getByRole('radio')).toHaveCount(6);
      await expect(skills.getByRole('radio', { name: /^Scoping & Discovery/ })).toBeChecked();

      // Pointing at a row (a mouse), or moving to it (the keyboard), shows the words it came from.
      await skills.getByText('Ownership & Next Steps').hover();
      await expect(region.getByRole('blockquote')).toContainText(
        "I'll own this and update you by 3 PM",
      );
      await skills.getByRole('radio', { name: /^Closing/ }).focus();
      await page.keyboard.press('ArrowUp');
      await expect(skills.getByRole('radio', { name: /^Ownership/ })).toBeChecked();
      await expect(evidence.getByText('Turn 10', { exact: true })).toBeVisible();

      // The card keeps its size whatever is chosen, so the rows stay where they are.
      await walkTheSkills(page);
    });

    test('brings the scores in after the evidence, once, as the card comes into view', async ({
      page,
    }) => {
      await page.goto('/');
      const card = page.locator('.lp-rp__card');
      const fill = page.locator('.lp-rp__row .lp-rp__pip[data-on]').first();
      const colour = () => fill.evaluate((element) => getComputedStyle(element).backgroundColor);
      const token = (name: string) =>
        page.evaluate((property) => {
          const probe = document.createElement('i');
          probe.style.background = `var(${property})`;
          document.body.append(probe);
          const value = getComputedStyle(probe).backgroundColor;
          probe.remove();
          return value;
        }, name);

      // Every level is drawn from the start, in a neutral colour: the card is never a row of blanks.
      await expect(card).not.toHaveAttribute('data-revealed');
      await expect(page.locator('.lp-rp__pips').first()).toBeVisible();
      expect(await colour()).toBe(await token('--stroke-accessible'));

      // A beat after the card has come into view the levels take the product's colour, once.
      await card.scrollIntoViewIfNeeded();
      await expect(card).toHaveAttribute('data-revealed', '');
      await expect.poll(colour, { timeout: 5_000 }).toBe(await token('--brand-stroke'));
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(card).toHaveAttribute('data-revealed', '');
      expect(await colour()).toBe(await token('--brand-stroke'));
    });

    test('has six rows of one height, 44px, with the skill, its level and its turn centred on them', async ({
      page,
    }) => {
      await page.goto('/');
      const region = page.getByRole('region', { name: 'Coaching evidence' });
      await region.scrollIntoViewIfNeeded();
      // The card rises into place as it scrolls into view: measure it at rest.
      await settled(page);
      const rows = await region.locator('.lp-rp__row').evaluateAll((elements) =>
        elements.map((row) => {
          const box = row.getBoundingClientRect();
          const middle = box.top + box.height / 2;
          const offset = (selector: string) => {
            const part = row.querySelector(selector)?.getBoundingClientRect();
            return part ? Math.abs(part.top + part.height / 2 - middle) : 0;
          };
          return {
            height: box.height,
            skill: offset('.lp-rp__skill'),
            level: offset('.lp-rp__pips'),
            turn: offset('.lp-rp__at'),
          };
        }),
      );
      expect(rows).toHaveLength(6);
      for (const row of rows) {
        expect(row.height).toBe(44);
        expect(row.skill).toBeLessThanOrEqual(1);
        expect(row.level).toBeLessThanOrEqual(1);
        expect(row.turn).toBeLessThanOrEqual(1);
      }
      // The line to the evidence leaves from the middle of the chosen row (from 48em, where it shows).
      const line = await region.locator('.lp-rp__row[data-active]').evaluate((row) => {
        const box = row.getBoundingClientRect();
        const after = getComputedStyle(row, '::after');
        return {
          offset: parseFloat(after.top) + parseFloat(after.height) / 2 - box.height / 2,
          drawn: after.content !== 'none',
        };
      });
      expect(line.drawn).toBe(true);
      expect(Math.abs(line.offset)).toBeLessThanOrEqual(1);
    });

    test('lets the evidence stand as tall as its words, with no wide empty tint between the quote and the coaching', async ({
      page,
    }) => {
      await page.goto('/');
      const region = page.getByRole('region', { name: 'Coaching evidence' });
      await region.scrollIntoViewIfNeeded();
      // The card rises into place as it scrolls into view; a click on a one-pixel radio is aimed at
      // where the radio is when it is made, so wait until nothing moves.
      await settled(page);
      const gaps = [];
      const skills = region.getByRole('group', { name: 'Skills' }).getByRole('radio');
      for (let index = 0; index < 6; index += 1) {
        await skills.nth(index).check({ force: true });
        gaps.push(
          await region.locator('.lp-rp__linked[data-active]').evaluate((set) => {
            const quote = set.querySelector('.lp-rp__quote')?.getBoundingClientRect();
            const noted = set.querySelector('.lp-rp__noted')?.getBoundingClientRect();
            return Math.round((noted?.top ?? 0) - (quote?.bottom ?? 0));
          }),
        );
      }
      for (const gap of gaps) expect(gap, `the quote to the coaching: ${gaps}`).toBeLessThan(80);
    });

    test('lights the three steps in order as they come into view', async ({ page }) => {
      await page.goto('/');
      const steps = page.locator('.lp-steps');
      await expect(steps).not.toHaveAttribute('data-active');
      await steps.scrollIntoViewIfNeeded();
      await expect(steps).toHaveAttribute('data-active', '');
      // Every step is real text before and after.
      await expect(steps.getByRole('listitem')).toHaveCount(3);
    });
  });

  test('the header offers Scenarios, Responsible AI and Start call, and no section links', async ({
    page,
  }) => {
    await page.goto('/');
    const header = page.getByRole('banner');
    await expect(header.getByRole('link', { name: 'Firefly home' })).toBeVisible();
    const primary = header.getByRole('navigation', { name: 'Primary' });
    await expect(primary.getByRole('link')).toHaveText(['Scenarios', 'Responsible AI']);
    await expect(header.getByRole('link', { name: 'Start call' })).toHaveAttribute(
      'href',
      '/scenarios',
    );
    await expect(header.getByRole('button', { name: 'Dark theme' })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Overview' })).toHaveCount(0);
    await expect(header.getByRole('link', { name: 'How it works' })).toHaveCount(0);
  });

  test('the header links reach their pages, and the wordmark goes home', async ({ page }) => {
    await page.goto('/');
    const header = page.getByRole('banner');

    await test.step('Scenarios opens the scenario workspace', async () => {
      await header.getByRole('link', { name: 'Scenarios' }).click();
      await expect(page).toHaveURL(/\/scenarios(\?.*)?$/);
      await expect(page.getByRole('heading', WORKSPACE)).toBeVisible();
    });

    await test.step('the wordmark goes home', async () => {
      await page.getByRole('banner').getByRole('link', { name: 'Firefly home' }).click();
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(TITLE);
    });

    await test.step('Responsible AI opens its page', async () => {
      await page.getByRole('banner').getByRole('link', { name: 'Responsible AI' }).click();
      await expect(page).toHaveURL(/\/responsible-ai$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Responsible AI' })).toBeVisible();
      await expect(page).toHaveTitle(/Responsible AI/);
    });
  });

  test('the header’s indicator appears under the current link, and goes where no link is current', async ({
    page,
  }) => {
    await page.goto('/');
    const nav = page.getByRole('banner').getByRole('navigation', { name: 'Primary' });
    const indicator = nav.locator('.ff-header__indicator');
    await expect(indicator).toHaveCount(1);
    await expect(indicator).toHaveCSS('opacity', '0');

    await page.getByRole('banner').getByRole('link', { name: 'Responsible AI' }).click();
    await expect(page).toHaveURL(/\/responsible-ai$/);
    await expect(indicator).toHaveCSS('opacity', '1');
    const link = await nav.getByRole('link', { name: 'Responsible AI' }).boundingBox();
    const bar = await indicator.boundingBox();
    if (!link || !bar) throw new Error('The link or the indicator has no box.');
    expect(bar.x).toBeGreaterThanOrEqual(link.x);
    expect(bar.x + bar.width).toBeLessThanOrEqual(link.x + link.width + 1);
    expect(bar.y).toBeGreaterThan(link.y + link.height / 2);
    expect(bar.height).toBeLessThanOrEqual(4);

    await page.getByRole('contentinfo').getByRole('link', { name: 'About' }).click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(indicator).toHaveCSS('opacity', '0');
  });

  test('the header gains an edge and a soft shadow once the page has scrolled, and loses them at the top', async ({
    page,
  }) => {
    await page.goto('/');
    const header = page.getByRole('banner');
    await expect(header).not.toHaveAttribute('data-scrolled');
    const height = (await header.boundingBox())?.height;
    await page.evaluate(() => window.scrollTo(0, 400));
    await expect(header).toHaveAttribute('data-scrolled', 'true');
    await expect(header).not.toHaveCSS('box-shadow', 'none');
    expect((await header.boundingBox())?.height, 'nothing changes size').toBe(height);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(header).not.toHaveAttribute('data-scrolled');
  });

  test('Start call and Explore scenarios do what they say, from the header, the hero and the closing call to action', async ({
    page,
  }) => {
    await page.goto('/');

    await test.step('the header button', async () => {
      await page.getByRole('banner').getByRole('link', { name: 'Start call' }).click();
      await expect(page).toHaveURL(/\/scenarios(\?.*)?$/);
      await expect(page.getByRole('heading', WORKSPACE)).toBeVisible();
    });

    await page.goBack();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(TITLE);

    const hero = page.getByRole('region', { name: TITLE });
    await test.step('the hero button', async () => {
      await hero.getByRole('link', { name: 'Start call' }).click();
      await expect(page.getByRole('heading', WORKSPACE)).toBeVisible();
    });

    await page.goBack();
    await test.step('"Explore scenarios" stays on the page', async () => {
      await hero.getByRole('link', { name: 'Explore scenarios' }).click();
      await expect(page).toHaveURL(/\/#featured$/);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(TITLE);
    });

    await test.step('the closing call to action', async () => {
      const closing = page
        .getByRole('region', { name: 'Start a Microsoft support call' })
        .getByRole('link', { name: 'Start call' });
      await closing.scrollIntoViewIfNeeded();
      await closing.click();
      await expect(page.getByRole('heading', WORKSPACE)).toBeVisible();
    });
  });

  test('the footer links to the two content pages and to the source, which opens in a new tab', async ({
    page,
  }) => {
    await page.goto('/');
    const footer = page.getByRole('contentinfo');
    await expect(footer.getByRole('link', { name: 'Responsible AI' })).toHaveAttribute(
      'href',
      '/responsible-ai',
    );
    await expect(footer.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about');
    const source = footer.getByRole('link', { name: /Source on GitHub/ });
    await expect(source).toHaveAttribute('target', '_blank');
    await expect(source).toHaveAttribute('rel', /noopener/);

    await footer.getByRole('link', { name: 'About' }).click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(page.getByRole('heading', { level: 1, name: 'About Firefly' })).toBeVisible();
  });

  test('the whole page is reached with Tab, in reading order, and every stop shows a focus ring that is in view', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('region', { name: 'Scenario cards' })).toBeVisible();

    const stops: FocusStop[] = [];
    for (let press = 0; press < 90; press += 1) {
      await page.keyboard.press('Tab');
      const stop = await focusStop(page);
      // The end of the page: focus has gone to the browser, or round to the first stop again.
      if (!stop || stop.name === stops[0]?.name) break;
      // A card's link covers the card, and the ring is drawn round the card.
      stops.push({ ...stop, ring: stop.ring || (await ringAround(page)) });
    }
    const names = stops.map((stop) => stop.name);

    for (const stop of stops) {
      const where = `"${stop.name}" (Tab stop ${names.indexOf(stop.name) + 1})`;
      expect(stop.ring, `a focus ring on ${where}`).toBe(true);
      // Zero is a ring that was found on the card, whose contrast the card's own tests read.
      if (stop.ringContrast > 0) {
        expect(stop.ringContrast, `the contrast of the ring on ${where}`).toBeGreaterThanOrEqual(3);
      }
      expect(stop.inView, `${where} is in view`).toBe(true);
    }

    const at = (name: string | RegExp, from = 0) =>
      names.findIndex(
        (item, index) =>
          index >= from && (typeof name === 'string' ? item === name : name.test(item)),
      );
    expect(names[0]).toBe('Skip to main content');
    const headerStart = at('Start call');
    const heroStart = at('Start call', headerStart + 1);
    const explore = at('Explore scenarios');
    const pause = at('Pause preview');
    const all = at('All scenarios');
    const card = at(/^Use scenario/);
    const skills = at(/^Skills: /);
    const note = at(/^Learn more/);
    const closing = at('Start call', note);
    const about = at('About', closing);
    const theme = at(/^Theme: /, about);
    // The header, then the hero's actions and its call, the cards, the report, the note, the close.
    const order = [
      at('Firefly home'),
      headerStart,
      heroStart,
      explore,
      pause,
      all,
      card,
      skills,
      note,
      closing,
      about,
      theme,
    ];
    expect(
      order.every((index) => index >= 0),
      `every part of the page has a stop: ${names}`,
    ).toBe(true);
    expect(order, `reading order: ${names}`).toEqual([...order].sort((a, b) => a - b));

    // The preview's tabs are one stop, the chosen one: the arrow keys move between the products.
    expect(names).not.toContain('Outlook');
    expect(names).not.toContain('Entra ID');
  });

  test('an address that does not exist shows the page-not-found page, with a way on', async ({
    page,
  }) => {
    await page.goto('/this/does/not/exist');
    await expect(page).toHaveTitle(/Page not found/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'We cannot find that page' }),
    ).toBeVisible();
    await page.getByRole('main').getByRole('link', { name: 'Go to scenarios' }).click();
    await expect(page.getByRole('heading', WORKSPACE)).toBeVisible();
  });

  test('the web app keeps nothing in the browser but each page’s scroll position, and one flag once the microphone notice has been read', async ({
    page,
  }) => {
    const stored = () =>
      page.evaluate(async () => ({
        local: Object.fromEntries(Object.entries(localStorage)),
        session: Object.fromEntries(Object.entries(sessionStorage)),
        databases: (await indexedDB.databases()).length,
        caches: (await caches.keys()).length,
        workers: (await navigator.serviceWorker.getRegistrations()).length,
      }));

    await page.goto('/');
    await page.getByRole('banner').getByRole('link', { name: 'Start call' }).click();
    await expect(page.getByRole('heading', WORKSPACE)).toBeVisible();
    await page.getByRole('link', { name: 'Start configuration' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Case brief' })).toBeVisible();
    // The router saves scroll positions as a page is hidden.
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));

    await test.step('reading a scenario and a brief stores nothing', async () => {
      const before = await stored();
      expect(before.local).toEqual({});
      expect(before.databases).toBe(0);
      expect(before.caches).toBe(0);
      expect(before.workers).toBe(0);
      // Only React Router's own bookkeeping: scroll offsets (page positions, as numbers) and, for
      // the view transitions it has played, the addresses it went from and to. Never text.
      const keys = Object.keys(before.session);
      expect(keys).toContain('react-router-scroll-positions');
      expect(
        keys.filter(
          (key) => !['react-router-scroll-positions', 'remix-router-transitions'].includes(key),
        ),
      ).toEqual([]);
      const positions = JSON.parse(before.session['react-router-scroll-positions']!) as Record<
        string,
        unknown
      >;
      for (const value of Object.values(positions)) expect(typeof value).toBe('number');
      const transitions = before.session['remix-router-transitions'];
      if (transitions !== undefined) {
        const played = JSON.parse(transitions) as Record<string, string[]>;
        for (const [from, to] of Object.entries(played)) {
          for (const address of [from, ...to]) {
            expect(address, 'a page address, not text').toMatch(/^\/[\w\-/]*$/);
          }
        }
      }
    });

    await test.step('"Got it" remembers that the notice was read, and nothing else', async () => {
      await page.getByRole('button', { name: 'Got it' }).click();
      const after = await stored();
      expect(after.local).toEqual({ 'firefly.voice-notice-seen': '1' });
      expect(after.databases).toBe(0);
      expect(after.caches).toBe(0);
      expect(after.workers).toBe(0);
    });
  });
});

test.describe('landing: themes', () => {
  test('the dark theme chosen with the toggle persists across a reload, with no light flash on the way', async ({
    page,
  }) => {
    // Samples the page's background on every frame, from before its own code runs.
    await page.addInitScript(() => {
      const samples: string[] = [];
      (window as unknown as { __backgrounds: string[] }).__backgrounds = samples;
      const sample = () => {
        if (document.body) samples.push(getComputedStyle(document.body).backgroundColor);
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await page.goto('/');
    await page.getByRole('banner').getByRole('button', { name: 'Dark theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.reload({ waitUntil: 'domcontentloaded' });
    // By DOMContentLoaded the theme is already set and its background is already painted.
    const atLoad = await page.evaluate(() => ({
      theme: document.documentElement.dataset.theme,
      preference: document.documentElement.dataset.themePreference,
      background: getComputedStyle(document.body).backgroundColor,
    }));
    expect(atLoad.theme).toBe('dark');
    expect(atLoad.preference).toBe('dark');
    const [red, green, blue] = (atLoad.background.match(/\d+/g) ?? []).map(Number);
    expect(Math.max(red ?? 255, green ?? 255, blue ?? 255)).toBeLessThan(80);

    await page.waitForLoadState('load');
    await page.waitForTimeout(400);
    const samples = await page.evaluate(
      () => (window as unknown as { __backgrounds: string[] }).__backgrounds,
    );
    const light = samples.filter((value) => {
      const channels = (value.match(/\d+/g) ?? []).slice(0, 3).map(Number);
      return channels.length === 3 && Math.min(...channels) >= 200;
    });
    expect(light, 'a frame was painted on the light background').toEqual([]);
    await expect(
      page.getByRole('banner').getByRole('button', { name: 'Dark theme' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`has no accessibility violations in the ${theme} theme, with the call speaking and with the report`, async ({
      page,
      context,
    }, testInfo) => {
      await context.addInitScript((value) => {
        // About:blank has no storage to give: the first run of this script is there.
        try {
          localStorage.setItem('firefly.theme', value);
        } catch {
          // Not the page yet.
        }
      }, theme);
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      const gallery = page.getByRole('region', { name: 'Scenario cards' });
      await expect(gallery).toBeVisible();

      await expect.poll(async () => (await callState(page)).speaking).toBe('customer');
      // Scanned still: pause the preview, so no text is caught half way through its fade.
      await page.getByRole('button', { name: 'Pause preview' }).click();
      await expectAccessible(page, testInfo, `the landing page, ${theme}, the call`, {
        include: 'main',
      });

      await page.getByRole('button', { name: 'Play preview' }).click();
      await expect.poll(async () => (await callState(page)).scored, { timeout: 30_000 }).toBe(3);
      await page.getByRole('button', { name: 'Pause preview' }).click();
      await page.locator('.lp-rp__card').scrollIntoViewIfNeeded();
      await expect(page.locator('.lp-rp__card')).toHaveAttribute('data-revealed', '');
      await page.locator('.lp-steps').scrollIntoViewIfNeeded();
      await expectAccessible(page, testInfo, `the landing page, ${theme}, the report`);
    });
  }
});

test.describe('landing: layout', () => {
  test('keeps the promise large where there is room, and its supporting line whole', async ({
    page,
  }) => {
    const fontSize = () =>
      page
        .locator('.lp-hero h1')
        .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto('/');
    expect(await fontSize(), 'at 1024 the promise keeps its size').toBeLessThan(48);
    await page.setViewportSize({ width: 1440, height: 900 });
    expect(await fontSize(), 'at 1440').toBeGreaterThanOrEqual(48);
    await page.setViewportSize({ width: 1920, height: 1080 });
    expect(await fontSize(), 'at 1920').toBeGreaterThanOrEqual(52);

    // The two halves of the hero weigh the same from 1440: the copy and the call are as wide as each other.
    await page.setViewportSize({ width: 1440, height: 900 });
    const [copy, call] = await Promise.all([
      page.locator('.lp-hero__copy').evaluate((element) => element.getBoundingClientRect().width),
      page.locator('.lp-preview').evaluate((element) => element.getBoundingClientRect().width),
    ]);
    expect(Math.abs(copy - call)).toBeLessThanOrEqual(1);

    // "evidence-based" is one piece of the line, wherever the line breaks.
    for (const width of [320, 375, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const pieces = await page
        .locator('.lp-hero__keep')
        .evaluate((element) => element.getClientRects().length);
      expect(pieces, `"evidence-based" at ${width} px`).toBe(1);
    }
  });

  test('ends the call card, the evidence card and the footer where the header’s Start call ends', async ({
    page,
  }) => {
    for (const width of [768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await expect(page.getByRole('region', { name: 'Scenario cards' })).toBeVisible();
      const edge = await rightEdge(page, '.ff-header__actions a');
      expect(await rightEdge(page, '.lp-preview__window'), `the call card at ${width}`).toBeCloseTo(
        edge,
        0,
      );
      expect(await rightEdge(page, '.lp-preview__tabs'), `the tab strip at ${width}`).toBeCloseTo(
        edge,
        0,
      );
      expect(await rightEdge(page, '.lp-rp__card'), `the evidence card at ${width}`).toBeCloseTo(
        edge,
        0,
      );
      if (width >= 1024) {
        // The links and the theme choice end at the container's edge, not short of it.
        expect(await rightEdge(page, '.ff-footer__end'), `the footer at ${width}`).toBeCloseTo(
          edge,
          0,
        );
        expect(
          await rightEdge(page, '.ff-theme-select'),
          `the theme choice at ${width}`,
        ).toBeCloseTo(edge, 0);
      }
    }
  });

  test('makes the footer links and the theme choice 44px targets up to a tablet, and keeps them small on a desktop', async ({
    page,
  }) => {
    await page.goto('/');
    for (const width of [390, 768]) {
      await page.setViewportSize({ width, height: 900 });
      const { links, segments } = await footerTargets(page);
      expect(Math.min(...links), `the links at ${width}: ${links}`).toBeGreaterThanOrEqual(44);
      expect(Math.min(...segments), `the segments at ${width}: ${segments}`).toBeGreaterThanOrEqual(
        44,
      );
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    const { links, segments } = await footerTargets(page);
    expect(Math.min(...links)).toBeGreaterThanOrEqual(24);
    expect(Math.min(...segments)).toBeGreaterThanOrEqual(24);
    const footer = await page.getByRole('contentinfo').boundingBox();
    expect(footer?.height, 'the footer stays one slim row on a desktop').toBeLessThan(80);
  });

  test('keeps the theme choice’s confirmation out of the footer’s row, and still shows it', async ({
    page,
  }) => {
    await page.goto('/');
    const footer = page.getByRole('contentinfo');
    const before = await footer.boundingBox();
    // The choice is applied inside a view transition, a frame after the click: check() would read the
    // radio too soon, so the click and the wait are separate.
    const dark = footer.getByRole('radio', { name: 'Dark' });
    await dark.click({ force: true });
    await expect(dark).toBeChecked();
    const saved = footer.getByText('Saved on this device', { exact: true });
    await expect(saved).toBeVisible();
    await expect(saved).toHaveCSS('opacity', '1');
    expect((await footer.boundingBox())?.height, 'the confirmation takes no room of its own').toBe(
      before?.height,
    );
    await expect(saved).toHaveCSS('opacity', '0', { timeout: 8_000 });
  });

  test('numbers the three steps, and keeps the block compact', async ({ page }) => {
    await page.goto('/');
    const steps = page.getByRole('region', { name: 'How it works' });
    await expect(steps.locator('.lp-step__number')).toHaveText(['1', '2', '3']);
    const box = await steps.boundingBox();
    expect(box?.height, 'the three steps take about 200px of a desktop').toBeLessThan(215);
  });

  test('puts the state word beside the waveform it describes, and dims the microphones when the call is over', async ({
    page,
  }) => {
    await page.goto('/');
    await expect.poll(async () => (await callState(page)).speaking).toBe('customer');
    const gap = await page.evaluate(() => {
      const panel = document.querySelector('[role="tabpanel"][data-selected]');
      const wave = panel?.querySelector('.lp-wave')?.getBoundingClientRect();
      const state = panel?.querySelector('.lp-call__state')?.getBoundingClientRect();
      return (state?.left ?? 0) - (wave?.right ?? 0);
    });
    expect(gap, 'the word is next to the wave, not at the far end of the row').toBeLessThan(40);
    expect(gap).toBeGreaterThan(0);
    const indicators = page.locator('[role="tabpanel"][data-selected] .lp-panel__indicators');
    await expect(indicators).toHaveCSS('opacity', '1');
    await expect
      .poll(async () => (await callState(page)).phase, { timeout: 15_000 })
      .toBe('report');
    await expect(indicators).toHaveCSS('opacity', '0.4');
  });

  test('keeps the call card one height through its loop and across its tabs, with each foot on the card’s bottom edge', async ({
    page,
  }) => {
    test.setTimeout(100_000);
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto('/');
    const measure = () =>
      page.evaluate(() => {
        const frame = document.querySelector('.lp-preview__window')?.getBoundingClientRect();
        const foot = document
          .querySelector('[role="tabpanel"][data-selected] .lp-panel__foot')
          ?.getBoundingClientRect();
        if (!frame || !foot) throw new Error('The call card is not there.');
        // The card's own 1px border is under the foot.
        return { height: frame.height, blank: frame.bottom - foot.bottom - 1 };
      });
    const heights: number[] = [];
    for (const tab of ['Teams', 'Outlook', 'Entra ID']) {
      await page.getByRole('tab', { name: tab }).click();
      for (let sample = 0; sample < 5; sample += 1) {
        const { height, blank } = await measure();
        heights.push(height);
        expect(blank, `${tab}: nothing blank under the foot`).toBeLessThanOrEqual(0.5);
        await page.waitForTimeout(3_000);
      }
    }
    expect(
      Math.max(...heights) - Math.min(...heights),
      `the card changed height: ${heights}`,
    ).toBeLessThanOrEqual(0.5);
  });
});

test.describe('landing: a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('fits the screen, shows one card with the next beside it, and keeps the preview whole', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(TITLE);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'the page is wider than the screen').toBeLessThanOrEqual(0);

    await test.step('the header keeps its menu, its theme switch and Start call together on the right, each a 44px target', async () => {
      const bar = await page.evaluate(() => {
        const box = (selector: string) => {
          const found = document.querySelector(selector)?.getBoundingClientRect();
          if (!found) throw new Error(`no ${selector}`);
          return { left: found.left, right: found.right, width: found.width, height: found.height };
        };
        return {
          brand: box('.ff-header__brand'),
          menu: box('.ff-header__menu'),
          theme: box('.ff-header .ff-theme-toggle'),
          start: box('.ff-header__actions a'),
          view: document.documentElement.clientWidth,
        };
      });
      expect(bar.menu.width, 'the menu is a square').toBe(44);
      expect(bar.menu.height).toBe(44);
      expect(bar.theme.width).toBe(44);
      expect(bar.theme.height).toBe(44);
      expect(bar.start.height).toBeGreaterThanOrEqual(44);
      // The menu and the theme switch touch: one group, not a button floating between the logo and it.
      expect(Math.abs(bar.theme.left - bar.menu.right)).toBeLessThanOrEqual(1);
      expect(bar.start.left - bar.theme.right).toBeLessThanOrEqual(12);
      expect(bar.menu.left, 'the group is on the right, away from the logo').toBeGreaterThan(
        bar.brand.right + 40,
      );
      expect(bar.view - bar.start.right).toBeLessThanOrEqual(20);
    });

    await test.step('the hero’s two actions fill the row, and the preview follows', async () => {
      const hero = page.getByRole('region', { name: TITLE });
      const primary = await hero.getByRole('link', { name: 'Start call' }).boundingBox();
      expect(primary?.width).toBeGreaterThan(300);
      expect(primary?.height).toBeGreaterThanOrEqual(44);
      const preview = page.getByRole('figure', { name: CAPTION });
      await expect(preview).toBeVisible();
      const box = await preview.boundingBox();
      expect((box?.x ?? -1) + (box?.width ?? 0)).toBeLessThanOrEqual(391);
      for (const tab of await preview.getByRole('tab').all()) {
        expect((await tab.boundingBox())?.height).toBeGreaterThanOrEqual(44);
      }
    });

    await test.step('the featured row leads with one card and shows the next', async () => {
      const gallery = page.getByRole('region', { name: 'Scenario cards' });
      await gallery.scrollIntoViewIfNeeded();
      const items = gallery.getByRole('listitem');
      const first = await items.nth(0).boundingBox();
      const second = await items.nth(1).boundingBox();
      expect(first && first.x + first.width < 390).toBe(true);
      expect(second && second.x < 390 && second.x + second.width > 390, 'the next card peeks').toBe(
        true,
      );
    });

    await test.step('the evidence card does not move its rows when another skill is chosen', async () => {
      await page.getByRole('region', { name: 'Coaching evidence' }).scrollIntoViewIfNeeded();
      await walkTheSkills(page);
    });

    await test.step('the menu holds the links, and Start call stays in the bar', async () => {
      const header = page.getByRole('banner');
      await expect(header.getByRole('navigation', { name: 'Primary' })).toBeHidden();
      await header.getByRole('button', { name: 'Menu' }).click();
      await expect(
        header.getByRole('navigation', { name: 'Primary' }).getByRole('link'),
      ).toHaveText(['Scenarios', 'Responsible AI']);
      await expect(header.getByRole('link', { name: 'Start call' })).toBeVisible();
      await expect(header.getByRole('button', { name: 'Dark theme' })).toBeVisible();
    });

    await test.step('the footer’s links and its theme choice are 44px targets', async () => {
      const targets = await footerTargets(page);
      expect(
        Math.min(...targets.links),
        `the footer links: ${targets.links}`,
      ).toBeGreaterThanOrEqual(44);
      expect(targets.segments).toHaveLength(3);
      expect(
        Math.min(...targets.segments),
        `the theme segments: ${targets.segments}`,
      ).toBeGreaterThanOrEqual(44);
    });
  });

  test('has the Demo chip of the app pages in a 44px target', async ({ page }) => {
    await page.goto('/scenarios');
    await expect(page.getByRole('heading', WORKSPACE)).toBeVisible();
    const more = page.getByRole('banner').getByRole('button', { name: /Demo mode/ });
    const box = await more.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
  });

  test('has no accessibility violations', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page.getByRole('region', { name: 'Scenario cards' })).toBeVisible();
    await page.getByRole('button', { name: 'Pause preview' }).click();
    await expectAccessible(page, testInfo, 'the landing page on a phone');
  });
});
