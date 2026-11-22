import type { Locator, Page } from '@playwright/test';
import { expect, test } from './support/fixtures.ts';
import {
  SCENARIO_ID,
  clippedText,
  expectAccessible,
  expectStatus,
  holdTone,
  overflow,
  speak,
  startSpokenCall as startControlledCall,
  targetSize,
} from './support/a11y.ts';
import { callScreen, converse, startTypedCall, type CallScreen } from './support/call-screen.ts';

// The tips strip of Guided practice ("During the call") and the thin state trace that goes with it,
// in a real browser. Which calls have them; that they never cover the controls and move nothing when
// a tip changes; how a tip changes (by hand, by key, by drag and swipe, and once after the customer
// has finished speaking, never on a timer); the pluck under a mouse and none of it under a finger or
// reduced motion; and the call, with its end dialog and a problem card, in both themes.
//
// What these do not prove: that the tips are useful to a trainee, or how a screen reader reads them.

test.describe.configure({ timeout: 120_000 });

const STARTER = SCENARIO_ID; // outlook-shared-mailbox-missing: Guided practice as it comes
const STANDARD = 'teams-cannot-join-external-meetings'; // Assessment practice as it comes
const CHALLENGE = 'sharepoint-site-access-escalated'; // Assessment practice as it comes

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function rect(locator: Locator): Promise<Rect> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('That is not on screen.');
  return box;
}

/** The area two boxes share, in square pixels. */
function shared(a: Rect, b: Rect): number {
  const across = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const down = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return Math.max(0, across) * Math.max(0, down);
}

const same = (a: Rect, b: Rect) =>
  ['x', 'y', 'width', 'height'].every(
    (key) => Math.abs(a[key as keyof Rect] - b[key as keyof Rect]) < 0.5,
  );

/** A box once it has stopped moving: two reads 50 ms apart agree (a tip glides after a tap). */
async function settledRect(locator: Locator): Promise<Rect> {
  let before = await rect(locator);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await locator.page().waitForTimeout(50);
    const now = await rect(locator);
    if (same(before, now)) return now;
    before = now;
  }
  return before;
}

const setTheme = (page: Page, theme: 'light' | 'dark') =>
  page.evaluate((value) => document.documentElement.setAttribute('data-theme', value), theme);

/** Opens a scenario's brief, presses "Start voice call" there and on the pre-flight, and waits for the greeting. */
async function startVoiceFromBrief(page: Page, path: string): Promise<CallScreen> {
  await page.goto(path);
  await page.getByRole('button', { name: 'Start voice call' }).click();
  const screen = callScreen(page);
  await screen.preflight.startVoice.click();
  await expect(screen.turns.first()).toBeVisible();
  return screen;
}

const guidedTypedCall = (page: Page, api: Parameters<typeof startTypedCall>[1]) =>
  startTypedCall(page, api, { scenarioId: STARTER, mode: 'guided' });

/** The scale and the vertical shift of an element's transform, as the browser works them out. */
async function transformOf(locator: Locator): Promise<{ lift: number; scale: number }> {
  return locator.evaluate((element) => {
    const matrix = new DOMMatrix(getComputedStyle(element).transform);
    return { lift: -matrix.m42, scale: Math.hypot(matrix.m11, matrix.m12) };
  });
}

/** The card in hand: it keeps still, and carries the tilt and `data-fx`; its face is what moves. */
const currentCard = (page: Page) => page.locator('.tp-card[aria-current="true"]');
const currentFace = (page: Page) => currentCard(page).locator('.tp-card__face');

// ---- which calls have the strip ---------------------------------------------------------------

test.describe('which calls have the strip', () => {
  test('a Starter scenario starts in Guided practice: the strip is under the transcript, in a region of its own', async ({
    page,
  }) => {
    const screen = await startVoiceFromBrief(page, `/scenarios/${STARTER}/brief`);
    await expect(screen.tips.region).toBeVisible();
    await expect(screen.tips.heading).toBeVisible();
    expect(await screen.tips.cards.count()).toBeGreaterThanOrEqual(16);
    await expect(screen.tips.cards.first()).toHaveAttribute(
      'aria-label',
      new RegExp(`^Tip 1 of ${await screen.tips.cards.count()}$`),
    );
    // The transcript is above it, as it reads; the strip is not part of the transcript's log.
    const transcript = await rect(page.locator('#cw-transcript'));
    const strip = await rect(screen.tips.region);
    expect(strip.y).toBeGreaterThanOrEqual(transcript.y + transcript.height - 1);
    await expect(screen.transcript.locator('.tp-card')).toHaveCount(0);
  });

  test('a Standard scenario has no strip, and no sign of one', async ({ page }) => {
    const screen = await startVoiceFromBrief(page, `/scenarios/${STANDARD}/brief`);
    await expect(screen.tips.region).toHaveCount(0);
    await expect(screen.tips.show).toHaveCount(0);
    await expect(page.getByText('During the call')).toHaveCount(0);
    await expect(page.locator('.cw-trace')).toHaveCount(0);
  });

  test('a Challenge scenario has no strip as it comes', async ({ page }) => {
    const screen = await startVoiceFromBrief(page, `/scenarios/${CHALLENGE}/brief`);
    await expect(screen.tips.region).toHaveCount(0);
    await expect(page.getByText('During the call')).toHaveCount(0);
  });

  test('a Challenge scenario has the strip when Guided practice was chosen', async ({ page }) => {
    const screen = await startVoiceFromBrief(page, `/scenarios/${CHALLENGE}/brief?hints=on`);
    await expect(screen.tips.region).toBeVisible();
    await expect(screen.tips.heading).toBeVisible();
  });
});

// ---- the strip never covers the controls and moves nothing ------------------------------------

const SIZES = [
  [1920, 1080],
  [1440, 900],
  [1024, 768],
  [768, 1024],
  [430, 932],
  [375, 667],
  [360, 640],
  [320, 568],
] as const;

for (const [width, height] of SIZES) {
  test(`at ${width} x ${height} the strip sits clear of the controls, and a tip changing moves nothing`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await startControlledCall(page, { scenarioId: STARTER });
    const screen = callScreen(page);
    await expect(screen.stopAudio).toBeVisible();

    // A small phone has no room for the strip beside the transcript and the dock: it is left out.
    if (width < 1024 && height <= 704) {
      await expect(screen.tips.region).toHaveCount(0);
      await expect(screen.tips.show).toHaveCount(0);
      await expect(screen.tips.heading).toHaveCount(0);
      // The controls are all in view and the transcript has what the strip would have taken.
      for (const control of [screen.stopAudio, screen.mute, screen.endCall]) {
        const box = await rect(control);
        expect(box.y + box.height).toBeLessThanOrEqual(height + 0.5);
        expect(box.x + box.width).toBeLessThanOrEqual(width + 0.5);
      }
      return;
    }
    await expect(screen.tips.region).toBeVisible();
    await expect(screen.tips.next).toBeVisible();

    await test.step('it is inside the screen, over nothing, and has made the page no wider', async () => {
      const strip = await rect(screen.tips.region);
      expect(strip.x).toBeGreaterThanOrEqual(-0.5);
      expect(strip.x + strip.width).toBeLessThanOrEqual(width + 0.5);
      for (const other of [screen.controls, page.locator('.cw-dock'), page.locator('.cw-person')]) {
        if ((await other.count()) === 0) continue;
        expect(
          shared(strip, await rect(other.first())),
          'the strip is over something',
        ).toBeLessThan(1);
      }
      // The cards beyond the window are clipped by it on purpose: everything else in the strip is on
      // screen, the card in hand is whole inside its window, and the page itself is no wider.
      const outside = await page.evaluate(() => {
        const found: string[] = [];
        for (const element of document.querySelectorAll('.tp-strip *')) {
          if (element.closest('.tp-track')) continue;
          const box = element.getBoundingClientRect();
          // A heading kept for a screen reader is cut down to a pixel on a phone, on purpose.
          if (box.width <= 1 && box.height <= 1) continue;
          if (box.left < -0.5 || box.right > window.innerWidth + 0.5) {
            found.push(`${element.tagName.toLowerCase()}.${element.className}`);
          }
        }
        return found;
      });
      expect(outside).toEqual([]);
      const deck = await rect(screen.tips.deck);
      const card = await rect(page.locator('.tp-card[aria-current="true"]'));
      expect(card.x).toBeGreaterThanOrEqual(deck.x - 0.5);
      expect(card.x + card.width).toBeLessThanOrEqual(deck.x + deck.width + 0.5);
      const wide = await overflow(page);
      expect(wide.scrollWidth).toBeLessThanOrEqual(wide.innerWidth);
      expect(await clippedText(page, '.tp-strip')).toEqual([]);
    });

    await test.step('Previous and Next are 44 px, and the quieter buttons are at least 24', async () => {
      for (const selector of ['.tp-nav button']) {
        const size = await targetSize(page, selector);
        expect(size?.width, selector).toBeGreaterThanOrEqual(43.5);
        expect(size?.height, selector).toBeGreaterThanOrEqual(43.5);
      }
      for (const selector of ['.tp-strip__hide', '.tp-card__why']) {
        const size = await targetSize(page, selector);
        expect(size?.height, selector).toBeGreaterThanOrEqual(24);
        expect(size?.width, selector).toBeGreaterThanOrEqual(24);
      }
    });

    await test.step('every tip, the longest included, leaves the strip and the page exactly as they were', async () => {
      const before = {
        strip: await rect(screen.tips.region),
        deck: await rect(screen.tips.deck),
        transcript: await rect(screen.transcript),
        controls: await rect(screen.controls),
      };
      const count = await screen.tips.cards.count();
      for (let step = 1; step < count; step += 1) {
        await screen.tips.next.click();
        // Let the glide finish: a card in motion is measured where it has got to.
        await page.waitForTimeout(120);
        expect(
          same(await rect(screen.tips.region), before.strip),
          `the strip at tip ${step + 1}`,
        ).toBe(true);
        expect(same(await rect(screen.tips.deck), before.deck), `the deck at tip ${step + 1}`).toBe(
          true,
        );
      }
      expect(same(await rect(screen.transcript), before.transcript)).toBe(true);
      expect(same(await rect(screen.controls), before.controls)).toBe(true);
    });

    await test.step('“Learn why” opens in place: the strip grows a few lines, the transcript gives way, and nothing is covered', async () => {
      await screen.tips.previous.click();
      await page.keyboard.press('Home');
      const strip = await rect(screen.tips.region);
      const scroller = await rect(page.locator('#cw-transcript'));
      await screen.tips.learnWhy.click();
      const line = page.locator('.tp-why');
      await expect(line).toBeVisible();
      const opened = await rect(screen.tips.region);
      const reason = await rect(line);
      // It is a row of the strip, so the strip is taller by about its height, with its foot where it was.
      expect(opened.height).toBeGreaterThan(strip.height + 10);
      expect(Math.abs(opened.y + opened.height - (strip.y + strip.height))).toBeLessThan(1);
      expect(reason.y).toBeGreaterThanOrEqual(opened.y);
      expect(reason.y + reason.height).toBeLessThanOrEqual(opened.y + opened.height + 1);
      // The transcript above it is shorter by what the strip took, and meets none of it.
      const after = await rect(page.locator('#cw-transcript'));
      expect(after.height).toBeLessThan(scroller.height - 10);
      expect(shared(reason, after)).toBeLessThan(1);
      expect(after.y + after.height).toBeLessThanOrEqual(opened.y + 1);
      expect(shared(reason, await rect(screen.controls))).toBeLessThan(1);
      expect(opened.x).toBeGreaterThanOrEqual(-0.5);
      expect(opened.x + opened.width).toBeLessThanOrEqual(width + 0.5);
      await page.keyboard.press('Escape');
      await expect(line).toHaveCount(0);
      await expect(screen.tips.learnWhy).toBeFocused();
      // Closed, everything is as it was.
      expect(same(await rect(screen.tips.region), strip)).toBe(true);
      expect(same(await rect(page.locator('#cw-transcript')), scroller)).toBe(true);
    });
  });
}

// ---- how a tip changes ------------------------------------------------------------------------

test.describe('how a tip changes', () => {
  test('by Previous and Next, by the arrow keys, Home and End, and the ends are dimmed but reachable', async ({
    page,
    api,
  }) => {
    const { screen } = await guidedTypedCall(page, api);
    const count = await screen.tips.cards.count();
    const first = (await screen.tips.current.innerText()).trim();
    await expect(screen.tips.previous).toHaveAttribute('aria-disabled', 'true');

    await screen.tips.next.click();
    await expect(screen.tips.current).not.toHaveText(first);
    await expect(page.locator('.tp-card[aria-current="true"]')).toHaveAttribute(
      'aria-label',
      `Tip 2 of ${count}`,
    );
    await screen.tips.previous.click();
    await expect(screen.tips.current).toHaveText(first);

    await screen.tips.next.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.tp-card[aria-current="true"]')).toHaveAttribute(
      'aria-label',
      `Tip 2 of ${count}`,
    );
    await page.keyboard.press('ArrowLeft');
    await expect(screen.tips.current).toHaveText(first);
    await page.keyboard.press('End');
    await expect(page.locator('.tp-card[aria-current="true"]')).toHaveAttribute(
      'aria-label',
      `Tip ${count} of ${count}`,
    );
    await expect(screen.tips.next).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Home');
    await expect(screen.tips.current).toHaveText(first);
  });

  test('by dragging the card: it follows the pointer at about sixty percent, a short drag goes back, a long one moves on, and a spring settles it', async ({
    page,
    api,
  }) => {
    const { screen } = await guidedTypedCall(page, api);
    const first = (await screen.tips.current.innerText()).trim();
    const track = page.locator('.tp-track');
    const shift = () => track.evaluate((el) => parseFloat(el.style.getPropertyValue('--tp-drag')));
    // A press on the words, not on “Learn why”: a button keeps its own press. The words are measured once
    // the tip has stopped gliding, or the press could land beside them.
    const middle = async () => {
      const box = await settledRect(screen.tips.current);
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };

    await test.step('a short drag leaves the card where it was', async () => {
      const start = await middle();
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(start.x - 30, start.y, { steps: 6 });
      await page.waitForTimeout(150);
      await page.mouse.up();
      await expect(screen.tips.current).toHaveText(first);
    });

    await test.step('while it is dragged the card follows at about sixty percent of the movement beyond the threshold', async () => {
      const start = await middle();
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(start.x - 106, start.y, { steps: 8 });
      await expect(screen.tips.deck).toHaveAttribute('data-dragging', 'true');
      await expect.poll(shift).toBeLessThan(-50);
      expect(await shift()).toBeGreaterThan(-70);
      await page.mouse.move(start.x - 140, start.y, { steps: 4 });
      await page.mouse.up();
    });

    await test.step('past the threshold it moves to the next tip, settles on a spring, and the drag is over', async () => {
      await expect(screen.tips.current).not.toHaveText(first);
      await expect(track).toHaveAttribute('data-motion', 'spring');
      await expect(screen.tips.deck).not.toHaveAttribute('data-dragging', 'true');
      await expect
        .poll(() => track.evaluate((el) => el.style.getPropertyValue('--tp-drag')))
        .toBe('');
    });

    await test.step('and the same drag the other way brings it back', async () => {
      const start = await middle();
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(start.x + 140, start.y, { steps: 8 });
      await page.mouse.up();
      await expect(screen.tips.current).toHaveText(first);
    });
  });

  test('never by itself: a tip stays for as long as nothing happens, and while the customer speaks, and moves once when the customer has finished', async ({
    page,
  }) => {
    const { delays } = await startControlledCall(page, { scenarioId: STARTER });
    const screen = callScreen(page);
    await expect(screen.stopAudio).toBeVisible();
    const first = (await screen.tips.current.innerText()).trim();

    await test.step('the greeting plays, and then some: the tip does not move', async () => {
      await page.waitForTimeout(3_500);
      await expect(screen.tips.current).toHaveText(first);
    });

    await test.step('the trainee speaks, and the customer’s reply begins to play: still the same tip', async () => {
      await screen.stopAudio.click();
      await expectStatus(page, 'listening');
      delays.reply = 400;
      await speak(page, true);
      await expectStatus(page, 'speech-detected');
      await holdTone(page);
      await speak(page, false);
      await expectStatus(page, 'customer-speaking', 30_000);
      await expect(screen.turns).toHaveCount(3);
      await page.waitForTimeout(3_500);
      await expect(screen.tips.current).toHaveText(first);
    });

    await test.step('as soon as the customer has stopped, one new tip comes up, and stays', async () => {
      await screen.stopAudio.click();
      await expect(screen.tips.current).not.toHaveText(first);
      const second = (await screen.tips.current.innerText()).trim();
      await page.waitForTimeout(3_500);
      await expect(screen.tips.current).toHaveText(second);
    });
  });

  test('“Learn why” is a short line behind a button: it opens, closes with Escape and on a press outside, and is closed again by another tip', async ({
    page,
    api,
  }) => {
    const { screen } = await guidedTypedCall(page, api);
    const line = page.locator('.tp-why');
    await expect(screen.tips.learnWhy).toHaveAttribute('aria-expanded', 'false');
    await screen.tips.learnWhy.click();
    await expect(screen.tips.learnWhy).toHaveAttribute('aria-expanded', 'true');
    await expect(line).toBeVisible();
    expect((await line.innerText()).trim().split(/\s+/).length).toBeLessThanOrEqual(30);
    // It is linked to its button, and nothing is announced for it.
    await expect(screen.tips.learnWhy).toHaveAttribute(
      'aria-controls',
      (await line.getAttribute('id')) ?? '',
    );
    await expect(page.locator('.tp-strip [aria-live], .tp-why[aria-live]')).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(line).toHaveCount(0);
    await expect(screen.tips.learnWhy).toBeFocused();

    await screen.tips.learnWhy.click();
    await expect(line).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(line).toHaveCount(0);

    await screen.tips.learnWhy.click();
    await screen.tips.next.click();
    await expect(line).toHaveCount(0);
  });

  test('Hide tips puts the strip away for the call, Show tips brings it back, and neither forgets where the keyboard was', async ({
    page,
    api,
  }) => {
    const { screen } = await guidedTypedCall(page, api);
    // Hide tips is a button with an edge, not bare text.
    await expect(screen.tips.hide).toHaveCSS('border-top-width', '1px');
    await screen.tips.next.click();
    const where = (await screen.tips.current.innerText()).trim();
    await screen.tips.hide.click();
    await expect(screen.tips.cards).toHaveCount(0);
    await expect(screen.tips.heading).toHaveCount(0);
    await expect(screen.tips.show).toBeFocused();
    await expect(screen.tips.show).toHaveCSS('border-top-width', '1px');
    // Only the one quiet button is left in the region.
    await expect(screen.tips.region.getByRole('button')).toHaveCount(1);
    await screen.tips.show.click();
    await expect(screen.tips.hide).toBeFocused();
    await expect(screen.tips.current).toHaveText(where);
    // Nothing is kept beyond the call: a fresh page has the strip again.
    await screen.tips.hide.click();
    await page.reload();
    await expect(callScreen(page).preflight.heading).toBeVisible();
  });
});

// ---- the pluck --------------------------------------------------------------------------------

test.describe('under a mouse', () => {
  test('the card in hand rises, tilts toward the pointer by no more than two degrees, and is pressed in; the keyboard gets the rise without the tilt', async ({
    page,
    api,
  }) => {
    const { screen } = await guidedTypedCall(page, api);
    const card = currentCard(page);
    const face = currentFace(page);
    await expect(card).toHaveAttribute('data-fx', 'on');
    const resting = await transformOf(face);
    const box = await rect(card);

    await test.step('hovering lifts it a little', async () => {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await expect
        .poll(async () => (await transformOf(face)).lift)
        .toBeGreaterThan(resting.lift + 0.5);
    });

    await test.step('moving to a corner tilts it toward that corner, a degree or two and no more', async () => {
      await page.mouse.move(box.x + box.width - 2, box.y + 2, { steps: 5 });
      await expect
        .poll(() => card.evaluate((el) => parseFloat(el.style.getPropertyValue('--tilt-y'))))
        .toBeGreaterThan(0.5);
      for (const name of ['--tilt-x', '--tilt-y']) {
        const degrees = await card.evaluate(
          (el, property) => Math.abs(parseFloat(el.style.getPropertyValue(property))),
          name,
        );
        expect(degrees, name).toBeLessThanOrEqual(2);
      }
      // The light on the edge follows the pointer.
      await expect
        .poll(() => card.evaluate((el) => parseFloat(el.style.getPropertyValue('--glow-x'))))
        .toBeGreaterThan(80);
    });

    await test.step('a pointer left at the very edge does not make the card shiver', async () => {
      // Lifted and tilted, the face has moved a little under the pointer: the card has not, so it stays lit.
      await page.waitForTimeout(400);
      expect(await card.evaluate((el) => el.matches(':hover'))).toBe(true);
      const settled = await card.evaluate((el) => el.style.getPropertyValue('--tilt-y'));
      await page.waitForTimeout(400);
      expect(await card.evaluate((el) => el.style.getPropertyValue('--tilt-y'))).toBe(settled);
    });

    await test.step('pressing it pushes it in a little, and no more than a little', async () => {
      await page.mouse.down();
      await expect.poll(async () => (await transformOf(face)).scale).toBeLessThan(1);
      expect((await transformOf(face)).scale).toBeGreaterThan(0.9);
      await page.mouse.up();
    });

    await test.step('leaving it puts it back', async () => {
      await page.mouse.move(2, 2);
      await expect
        .poll(() => card.evaluate((el) => el.style.getPropertyValue('--tilt-y')))
        .toBe('');
      await expect
        .poll(async () => (await transformOf(face)).lift)
        .toBeLessThan(resting.lift + 0.5);
    });

    await test.step('the keyboard rises it as well, and tilts nothing', async () => {
      await screen.tips.learnWhy.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(screen.tips.learnWhy).toBeFocused();
      await expect
        .poll(async () => (await transformOf(face)).lift)
        .toBeGreaterThan(resting.lift + 0.5);
      expect(await card.evaluate((el) => el.style.getPropertyValue('--tilt-y'))).toBe('');
    });
  });

  test('the card that only peeks does not rise or tilt', async ({ page, api }) => {
    const { screen } = await guidedTypedCall(page, api);
    const peek = page.locator('.tp-card:not([aria-current="true"])').first();
    const peekFace = peek.locator('.tp-card__face');
    const deck = await rect(screen.tips.deck);
    const point = { x: deck.x + deck.width - 24, y: deck.y + deck.height / 2 };
    // The visible edge of the next card is at the right-hand end of the window: this is over it.
    const over = await page.evaluate(
      ({ x, y }) =>
        document.elementFromPoint(x, y)?.closest('.tp-card')?.getAttribute('aria-label'),
      point,
    );
    expect(over).toMatch(/^Tip 2 of /);
    const before = await transformOf(peekFace);
    await page.mouse.move(point.x, point.y, { steps: 4 });
    await page.waitForTimeout(250);
    expect((await transformOf(peekFace)).lift).toBeLessThan(before.lift + 0.5);
    expect(await peek.evaluate((el) => el.style.getPropertyValue('--tilt-y'))).toBe('');
  });

  test('while “Learn why” is open the card keeps still and the pointer light is out: it smears across neither the words nor the button', async ({
    page,
    api,
  }) => {
    const { screen } = await guidedTypedCall(page, api);
    const face = currentFace(page);
    const light = () => face.evaluate((el) => getComputedStyle(el, '::before').opacity);

    await test.step('closed, a pointer over the words lights the card', async () => {
      const box = await rect(currentCard(page));
      await page.mouse.move(box.x + box.width / 2, box.y + 14, { steps: 4 });
      await expect.poll(light).toBe('1');
    });

    await test.step('open, the light is out, and stays out over the button and the words', async () => {
      await screen.tips.learnWhy.click();
      await expect(page.locator('.tp-why')).toBeVisible();
      // The strip has grown and the card is higher: the pointer goes back onto the button, then the words.
      const button = await rect(screen.tips.learnWhy);
      await page.mouse.move(button.x + button.width / 2, button.y + button.height / 2, {
        steps: 4,
      });
      await page.waitForTimeout(300);
      expect(await light()).toBe('0');
      expect((await transformOf(face)).lift).toBeLessThan(0.5);
      const words = await rect(screen.tips.current);
      await page.mouse.move(words.x + words.width / 2, words.y + words.height / 2, { steps: 4 });
      await page.waitForTimeout(300);
      expect(await light()).toBe('0');
      expect((await transformOf(face)).lift).toBeLessThan(0.5);
      // The one in hand keeps its edge in the brand colour all the same.
      const edge = await face.evaluate((el) => getComputedStyle(el).borderLeftWidth);
      expect(parseFloat(edge)).toBeGreaterThanOrEqual(2);
    });

    await test.step('closed again, a pointer over the words lights the card once more', async () => {
      await screen.tips.learnWhy.click();
      await expect(page.locator('.tp-why')).toHaveCount(0);
      const box = await rect(currentCard(page));
      await page.mouse.move(2, 2);
      await page.mouse.move(box.x + box.width / 2, box.y + 14, { steps: 4 });
      await expect.poll(light).toBe('1');
    });
  });

  test('a card that the window cuts off fades out: where the next one peeks at rest, and at either edge while one is dragged', async ({
    page,
    api,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    const { screen } = await guidedTypedCall(page, api);
    const mask = () => screen.tips.deck.evaluate((el) => getComputedStyle(el).maskImage);
    // Only its opacity matters, so it takes no colour of its own.
    await test.step('at rest the peek of the next card fades at the right-hand edge', async () => {
      expect(await mask()).toContain('linear-gradient');
    });

    await test.step('dragged, both edges fade by as much as the card has moved', async () => {
      const box = await rect(screen.tips.current);
      const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(start.x - 60, start.y, { steps: 6 });
      await expect(screen.tips.deck).toHaveAttribute('data-dragging', 'true');
      const dragged = await screen.tips.deck.evaluate((el) =>
        el.style.getPropertyValue('--tp-drag'),
      );
      expect(parseFloat(dragged)).toBeLessThan(0);
      expect(await mask()).toContain('linear-gradient');
      await page.mouse.up();
      await expect
        .poll(() => screen.tips.deck.evaluate((el) => el.style.getPropertyValue('--tp-drag')))
        .toBe('');
    });

    await test.step('on a phone, where nothing peeks, nothing fades until a card is dragged', async () => {
      await page.setViewportSize({ width: 375, height: 812 });
      await expect(screen.tips.deck).toBeVisible();
      expect(await mask()).toBe('none');
      const box = await rect(screen.tips.current);
      const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(start.x - 60, start.y, { steps: 6 });
      await expect(screen.tips.deck).toHaveAttribute('data-dragging', 'true');
      expect(await mask()).toContain('linear-gradient');
      await page.mouse.up();
      await expect(screen.tips.deck).not.toHaveAttribute('data-dragging', 'true');
      await expect.poll(mask).toBe('none');
    });
  });
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('no tilt, no lift and no glide: a tip changes at once', async ({ page, api }) => {
    const { screen } = await guidedTypedCall(page, api);
    const card = currentCard(page);
    const face = currentFace(page);
    await expect(card).toHaveAttribute('data-fx', 'off');
    const box = await rect(card);
    const resting = await transformOf(face);
    await page.mouse.move(box.x + box.width - 2, box.y + 2, { steps: 4 });
    await page.waitForTimeout(200);
    expect((await transformOf(face)).lift).toBeLessThan(resting.lift + 0.5);
    expect(await card.evaluate((el) => el.style.getPropertyValue('--tilt-y'))).toBe('');
    // Durations are cut to a hundredth of a millisecond, which is no time at all.
    const glide = await page
      .locator('.tp-track')
      .evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(glide.split(',').every((time) => parseFloat(time) <= 0.001)).toBe(true);
    await screen.tips.next.click();
    await expect(page.locator('.tp-card[aria-current="true"]')).toHaveAttribute(
      'aria-label',
      /^Tip 2 of/,
    );
  });
});

// ---- on a phone -------------------------------------------------------------------------------

test.describe('on a phone', () => {
  test('@mobile a finger has no tilt, full-size targets, a tap moves a tip and a swipe moves it too', async ({
    page,
    api,
  }) => {
    const { screen } = await guidedTypedCall(page, api);
    await expect(screen.tips.region).toBeVisible();
    await expect(currentCard(page)).toHaveAttribute('data-fx', 'off');

    await test.step('every button of the strip is a 44 px target under a finger', async () => {
      for (const selector of ['.tp-nav button', '.tp-strip__hide', '.tp-card__why']) {
        const size = await targetSize(page, selector);
        expect(size?.height, selector).toBeGreaterThanOrEqual(43.5);
        expect(size?.width, selector).toBeGreaterThanOrEqual(43.5);
      }
      await expect(screen.tips.hide).toHaveCSS('border-top-width', '1px');
      const offenders = (await overflow(page)).offenders;
      expect(offenders.filter((item) => !/\btp-(?:track|card)/.test(item))).toEqual([]);
    });

    const first = (await screen.tips.current.innerText()).trim();
    await test.step('a tap on Next moves one tip', async () => {
      await screen.tips.next.tap();
      await expect(screen.tips.current).not.toHaveText(first);
      await screen.tips.previous.tap();
      await expect(screen.tips.current).toHaveText(first);
    });

    await test.step('a swipe to the left moves one tip, and one to the right moves back', async () => {
      // Start on the words, not on “Learn why”: a button keeps its own press. The words are measured
      // once the tip has stopped gliding from the taps above, or a swipe could start off the screen.
      const box = await settledRect(screen.tips.current);
      const y = box.y + box.height / 2;
      const cdp = await page.context().newCDPSession(page);
      const swipe = async (from: number, to: number) => {
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x: from, y }],
        });
        for (let step = 1; step <= 8; step += 1) {
          await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: from + ((to - from) * step) / 8, y }],
          });
          // A finger takes time: moves sent with none make a fling the browser then holds against the next tap.
          await page.waitForTimeout(16);
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      };
      await swipe(box.x + box.width - 20, box.x + 20);
      await expect(screen.tips.current).not.toHaveText(first);
      // A touch that follows a swipe can be spent by the browser settling the one before it, so it is made
      // again if it did nothing. Swiping back from the first tip, or pressing Hide tips, is harmless twice.
      await expect(async () => {
        await swipe(box.x + 20, box.x + box.width - 20);
        await expect(screen.tips.current).toHaveText(first, { timeout: 1500 });
      }).toPass({ timeout: 10_000 });
    });

    await test.step('Hide tips and Show tips work by touch, and the page is no wider than the screen', async () => {
      await expect(async () => {
        if (await screen.tips.hide.isVisible()) await screen.tips.hide.tap();
        await expect(screen.tips.show).toBeVisible({ timeout: 1500 });
      }).toPass({ timeout: 10_000 });
      await screen.tips.show.tap();
      await expect(screen.tips.next).toBeVisible();
      expect((await overflow(page)).scrollWidth).toBeLessThanOrEqual(
        (await overflow(page)).innerWidth,
      );
    });
  });

  test('a phone-sized window gives Hide tips and Show tips a full 44 px, whatever the pointer', async ({
    page,
    api,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const { screen } = await guidedTypedCall(page, api);
    await expect(screen.tips.region).toBeVisible();
    expect((await targetSize(page, '.tp-strip__hide'))?.height).toBeGreaterThanOrEqual(43.5);
    await screen.tips.hide.click();
    await expect(screen.tips.show).toBeVisible();
    expect((await targetSize(page, '.tp-strip--quiet .ff-button'))?.height).toBeGreaterThanOrEqual(
      43.5,
    );
  });
});

// ---- the state trace, and no score ------------------------------------------------------------

test.describe('the thin state trace and the score that is never shown', () => {
  test('Guided practice draws the customer’s state as a thin line with words and no number; Assessment practice draws none', async ({
    page,
    api,
  }) => {
    const { screen } = await guidedTypedCall(page, api);
    await converse(screen, ['Hello, my name is Sam. Can you tell me what is happening?']);
    const trace = page.getByRole('img', { name: /^Customer state so far: /i });
    await expect(trace).toBeVisible();
    expect((await trace.getAttribute('aria-label')) ?? '').not.toMatch(/\d/);
    expect(await trace.innerText()).toBe('');
    await expect(screen.state).toBeVisible();

    const other = await page.context().newPage();
    const immersive = await startTypedCall(other, api, { scenarioId: STARTER, mode: 'immersive' });
    await converse(immersive.screen, ['Hello, my name is Sam. Can you tell me what is happening?']);
    await expect(other.locator('.cw-trace')).toHaveCount(0);
    await other.close();
  });

  test('no score, rating, percentage or "out of" figure is anywhere on the call screen, in either mode', async ({
    page,
    api,
  }) => {
    for (const mode of ['guided', 'immersive'] as const) {
      const { screen } = await startTypedCall(page, api, { scenarioId: STARTER, mode });
      await converse(screen, ['Hello, my name is Sam. Can you tell me what is happening?']);
      // What the call itself says, not what the customer says or the case describes.
      const text = await page.evaluate(() => {
        const copy = document.body.cloneNode(true) as HTMLElement;
        for (const part of copy.querySelectorAll('.cw-log, .cw-case, script, style')) part.remove();
        return copy.innerText ?? copy.textContent ?? '';
      });
      expect(text, mode).not.toMatch(/\bscore\b|\brating\b|\bgrade\b|\bpoints?\b/i);
      expect(text, mode).not.toMatch(/\d\s?%|\b\d+\s*(?:\/|out of)\s*\d+\b/i);
      await expect(page.locator('[role="meter"], meter')).toHaveCount(0);
    }
  });
});

// ---- both themes ------------------------------------------------------------------------------

test.describe('in both themes', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`${theme}: the pre-flight, the call with its tips, “Learn why”, the end dialog and a problem pass axe`, async ({
      page,
      api,
      problems,
    }, testInfo) => {
      problems.allow({ url: '/messages' });
      const call = await api.createCall({ scenarioId: STARTER, mode: 'guided' });
      await page.goto(`/calls/${call.id}?input=text`);
      const screen = callScreen(page);
      await expect(screen.preflight.heading).toBeVisible();
      await setTheme(page, theme);
      await expectAccessible(page, testInfo, `${theme}: the pre-flight`);

      await screen.preflight.startText.click();
      await screen.reply.waitFor();
      await setTheme(page, theme);
      await expect(screen.tips.region).toBeVisible();
      await expectAccessible(page, testInfo, `${theme}: the call, with the tips`);
      if (theme === 'dark') {
        await testInfo.attach('the call in dark mode', {
          body: await page.screenshot(),
          contentType: 'image/png',
        });
      }

      await screen.tips.learnWhy.click();
      await expect(page.locator('.tp-why')).toBeVisible();
      await expectAccessible(page, testInfo, `${theme}: “Learn why” open`);
      await page.keyboard.press('Escape');

      await converse(screen, ['Hello, my name is Sam. Can you tell me what is happening?']);
      await screen.endCall.click();
      await expect(screen.endDialog).toBeVisible();
      await expect(screen.closing.list).toBeVisible();
      await expectAccessible(page, testInfo, `${theme}: the end dialog`);
      if (theme === 'dark') {
        await testInfo.attach('the end dialog in dark mode', {
          body: await page.screenshot(),
          contentType: 'image/png',
        });
      }
      await screen.endDialog.getByRole('button', { name: 'Continue call' }).click();
      // The page answers once the dialog has gone, and the keyboard is back on End call.
      await expect(screen.endDialog).toBeHidden();
      await expect(screen.endCall).toBeFocused();

      // Queued through the fixture, so that a failure this test did not use cannot reach the next one.
      await api.failNext('customer', 1);
      await screen.reply.fill('Can you read me the error message?');
      await page.keyboard.press('Enter');
      await expect(screen.problem.card).toBeVisible();
      await expectAccessible(page, testInfo, `${theme}: a problem card`);
      if (theme === 'dark') {
        await testInfo.attach('a problem in dark mode', {
          body: await page.screenshot(),
          contentType: 'image/png',
        });
      }
    });
  }
});
