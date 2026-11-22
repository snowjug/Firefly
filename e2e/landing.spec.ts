import type { Page } from '@playwright/test';
import { expectAccessible, focusStop, type FocusStop } from './support/a11y.ts';
import { expect, test } from './support/fixtures.ts';
import { readProbe } from './support/page-probes.ts';

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
      const play = page.getByRole('button', { name: 'Play preview' });
      await expect(play).toBeVisible({ timeout: 70_000 });
      const rest = await callState(page);
      expect(rest).toMatchObject({ phase: 'report', shown: 3, quoted: 3, scored: 3 });
      await page.waitForTimeout(1500);
      expect(sameState(await callState(page), rest), 'it stays at rest').toBe(true);
      await play.click();
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
      const tab = await preview.getByRole('tab', { name: 'Outlook' }).boundingBox();
      const moved = await line.boundingBox();
      expect(moved?.x).toBeGreaterThanOrEqual((tab?.x ?? 0) - 1);
      expect((moved?.x ?? 0) + (moved?.width ?? 0)).toBeLessThanOrEqual(
        (tab?.x ?? 0) + (tab?.width ?? 0) + 1,
      );
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
      await expect(card).not.toHaveAttribute('data-revealed');
      await card.scrollIntoViewIfNeeded();
      await expect(card).toHaveAttribute('data-revealed', '');
      await expect(page.locator('.lp-rp__score').first()).toHaveCSS('opacity', '1');
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(card).toHaveAttribute('data-revealed', '');
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
  });

  test('has no accessibility violations', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page.getByRole('region', { name: 'Scenario cards' })).toBeVisible();
    await page.getByRole('button', { name: 'Pause preview' }).click();
    await expectAccessible(page, testInfo, 'the landing page on a phone');
  });
});
