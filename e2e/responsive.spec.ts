import type { Page } from '@playwright/test';
import {
  HARD_SCENARIO_ID,
  TRAINEE_LINES,
  clearFailures,
  clippedText,
  createSession,
  expect,
  expectAccessible,
  expectStatus,
  holdTone,
  overflow,
  scan,
  sendLines,
  speak,
  startSpokenCall,
  test,
} from './support/a11y.ts';
import { callScreen } from './support/call-screen.ts';
import { libraryScenario } from './support/scenario-library.ts';

// Responsive and user-preference checks: no horizontal scrolling at any width (WCAG 1.4.10), the call's
// key controls reachable and big enough (2.5.5, 2.5.8), nothing cut off, the transcript scrolling
// inside its own region, and the interface holding up under reduced motion, forced colours, more
// contrast, a dark colour scheme, enlarged text and changed text spacing. The layout changes at two
// widths (the call at 1024 and 1280 px; the scenario workspace is one stacked page at every width), so
// every width in the list is on one side of each change.

test.describe.configure({ timeout: 180_000 });

const HARD = libraryScenario(HARD_SCENARIO_ID);

// A deliberately wide font for every check in this file, so the results do not depend on which fonts
// the machine has: Verdana, or DejaVu Sans where it is missing (the fallback on the CI runner). A layout
// that fits Segoe UI can still overflow in the wider fallback fonts of Linux and Android. The page's
// policy forbids a style tag, so the rule goes in as a constructed style sheet.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync("* { font-family: Verdana, 'DejaVu Sans', sans-serif !important; }");
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  });
});

test.afterEach(async ({ request }) => {
  await clearFailures(request);
});

const WIDTHS = [320, 375, 430, 768, 1024, 1280, 1440, 1920];
const heightFor = (width: number) => (width < 768 ? 740 : 900);

async function expectNoOverflow(page: Page, label: string) {
  const result = await overflow(page);
  expect(result.scrollWidth, `${label}: the page scrolls sideways`).toBeLessThanOrEqual(
    result.innerWidth,
  );
  expect(result.offenders, `${label}: content outside the window`).toEqual([]);
}

async function expectNothingCut(page: Page, label: string, root = 'main') {
  expect(await clippedText(page, root), `${label}: text cut off by its own box`).toEqual([]);
}

async function box(page: Page, name: string | RegExp) {
  const found = await page.getByRole('button', { name }).first().boundingBox();
  expect(found, `a "${String(name)}" button is on the page`).not.toBeNull();
  return found!;
}

/** The control is whole inside the window, and at least `min` CSS pixels each way. */
async function expectReachable(page: Page, name: string | RegExp, min: number) {
  const target = await box(page, name);
  const view = page.viewportSize()!;
  const label = String(name);
  expect(target.width, `${label} is wide enough`).toBeGreaterThanOrEqual(min);
  expect(target.height, `${label} is tall enough`).toBeGreaterThanOrEqual(min);
  expect(target.x, `${label} starts inside the window`).toBeGreaterThanOrEqual(0);
  expect(target.x + target.width, `${label} ends inside the window`).toBeLessThanOrEqual(
    view.width + 1,
  );
  expect(target.y + target.height, `${label} is above the bottom edge`).toBeLessThanOrEqual(
    view.height + 1,
  );
}

async function openTextCall(page: Page, id: string) {
  await page.goto(`/calls/${id}?input=text`);
  await callScreen(page).preflight.startText.click();
  await expectStatus(page, 'text-fallback');
}

test('every page reflows at every width, with no sideways scrolling and no text cut off', async ({
  page,
  world,
}) => {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: heightFor(width) });
    for (const path of [
      '/',
      '/responsible-ai',
      '/about',
      '/scenarios',
      `/scenarios?scenario=${HARD_SCENARIO_ID}`,
      `/scenarios/${HARD_SCENARIO_ID}/brief`,
      // The longest page: checked at the widths where the layout changes.
      ...([320, 375, 768, 1280, 1920].includes(width)
        ? [`/sessions/${world.reportId}/report`]
        : []),
      '/not-a-page',
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectNoOverflow(page, `${path} at ${width}`);
      await expectNothingCut(page, `${path} at ${width}`);
    }
  }
});

test('no control is smaller than 24 by 24 pixels where the layout changes', async ({
  page,
  world,
}) => {
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: heightFor(width) });
    for (const path of [
      '/',
      '/scenarios',
      `/scenarios?scenario=${HARD_SCENARIO_ID}`,
      `/scenarios/${HARD_SCENARIO_ID}/brief`,
      `/sessions/${world.reportId}/report`,
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const found = await scan(page, { include: 'main' });
      expect(
        found.wcag.filter((violation) => violation.id === 'target-size'),
        `${path} at ${width}`,
      ).toEqual([]);
    }
  }
});

test('the scenario workspace holds together at every width: the carousel, the rail and the set-up open without sideways scrolling', async ({
  page,
}) => {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: heightFor(width) });
    await page.goto('/scenarios');
    await expect(page.getByRole('heading', { level: 1, name: 'Scenarios' })).toBeVisible();
    // One stacked page at every width: the rail, the carousel of cards, then the chosen scenario.
    await expect(page.getByRole('group', { name: 'Product', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Scenarios', exact: true })).toBeVisible();
    await expectNoOverflow(page, `the carousel at ${width}`);

    await page.goto(`/scenarios?scenario=${HARD_SCENARIO_ID}`);
    const pane = page.getByRole('region', { name: HARD.title, exact: true });
    await expect(pane).toBeVisible();
    await pane.getByRole('button', { name: /^Customise/ }).click();
    await expect(pane.getByRole('group', { name: /^Impact/ })).toBeVisible();
    const sizes = await pane.evaluate((element) => ({
      scroll: element.scrollWidth,
      client: element.clientWidth,
    }));
    expect(sizes.scroll, `the details at ${width}`).toBeLessThanOrEqual(sizes.client);
    await expectNothingCut(page, `the set-up at ${width}`);
    await expectNoOverflow(page, `the workspace at ${width}`);
  }
});

test('the brief keeps both ways to start a call inside the window at every width', async ({
  page,
}) => {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: heightFor(width) });
    await page.goto(`/scenarios/${HARD_SCENARIO_ID}/brief`);
    await expect(page.getByRole('heading', { level: 1, name: 'Case brief' })).toBeVisible();
    await expectNoOverflow(page, `the brief at ${width}`);
    for (const name of ['Start voice call', 'Start a text-only call']) {
      const button = page.getByRole('button', { name });
      await button.scrollIntoViewIfNeeded();
      const target = (await button.boundingBox())!;
      expect(target.width, `${name} at ${width}`).toBeGreaterThanOrEqual(44);
      expect(target.height, `${name} at ${width}`).toBeGreaterThanOrEqual(24);
      expect(target.x, `${name} starts inside the window`).toBeGreaterThanOrEqual(0);
      expect(target.x + target.width, `${name} ends inside the window`).toBeLessThanOrEqual(
        width + 1,
      );
    }
    await expectNothingCut(page, `the brief at ${width}`);
  }
});

test('the call keeps End call and the reply box in reach at every width', async ({ page }) => {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: heightFor(width) });
    const id = await createSession(page.request, HARD_SCENARIO_ID);
    const screen = callScreen(page);
    await page.goto(`/calls/${id}?input=text`);
    await expect(screen.preflight.heading).toBeVisible();
    await expectNoOverflow(page, `pre-flight at ${width}`);
    await screen.preflight.startText.click();
    await expectStatus(page, 'text-fallback');
    await expectNoOverflow(page, `a text call at ${width}`);
    await expectNothingCut(page, `a text call at ${width}`);
    await expectReachable(page, 'End call', 44);
    await expect(screen.reply).toBeVisible();
    const target = await screen.reply.boundingBox();
    expect(target!.y + target!.height, `the reply box is in view at ${width}`).toBeLessThanOrEqual(
      heightFor(width) + 1,
    );
    // Every control passes axe's target-size rule (24 by 24 CSS pixels), where the layout changes.
    if ([320, 768, 1024, 1440].includes(width)) {
      const sizes = await scan(page, { include: 'main' });
      expect(sizes.wcag.filter((violation) => violation.id === 'target-size')).toEqual([]);
    }
    await page.request.delete(`/api/sessions/${id}`);
  }
});

test.describe('a spoken call', () => {
  for (const width of [320, 768, 1024, 1280, 1920]) {
    test(`keeps its controls whole at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: heightFor(width) });
      await startSpokenCall(page);
      const screen = callScreen(page);
      await screen.stopAudio.click();
      await expectStatus(page, 'listening');
      await expectNoOverflow(page, `a spoken call at ${width}`);
      await expectNothingCut(page, `a spoken call at ${width}`);
      await expectReachable(page, 'End call', 44);
      await expectReachable(page, /^(Talk|Done speaking|Return to voice)$/, 44);
      for (const name of ['Mute', 'Pause', 'Replay', 'Text', 'Settings']) {
        // On a phone every one of them is a full 44 px target, the quiet ones too.
        await expectReachable(page, name, width < 640 ? 44 : 24);
      }
    });
  }
});

test('the pre-flight keeps its main action whole in the window on a phone, and the card still scrolls to the rest', async ({
  page,
}) => {
  for (const [width, height] of [
    [375, 812],
    [320, 640],
  ] as const) {
    await page.setViewportSize({ width, height });
    const id = await createSession(page.request, HARD_SCENARIO_ID);
    const screen = callScreen(page);
    await page.goto(`/calls/${id}?input=voice`);
    await expect(screen.preflight.heading).toBeVisible();
    await expectNoOverflow(page, `the pre-flight at ${width} by ${height}`);
    // The first button is the main one: whole in the window with nothing scrolled.
    await expectReachable(page, /^Start (?:voice|text) call$/, 44);
    // The card is longer than the window, and scrolling reaches all of it, with the buttons still there.
    const scrolls = await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight,
    );
    if (scrolls) {
      await screen.preflight.voiceDetails.scrollIntoViewIfNeeded();
      await expect(screen.preflight.voiceDetails).toBeVisible();
      await expectReachable(page, /^Start (?:voice|text) call$/, 44);
    }
    await page.request.delete(`/api/sessions/${id}`);
  }
});

test('on the smallest phone the call keeps room to read, even in a wide font: the bar is two rows and the transcript is not squeezed out', async ({
  page,
}) => {
  // This file reads everything in a deliberately wide font (see above), so the floor here is the
  // wide-font one; the full 250 px at 320 by 640 is measured in the usual font, in the call specs.
  await page.setViewportSize({ width: 320, height: 640 });
  const id = await createSession(page.request, HARD_SCENARIO_ID);
  await openTextCall(page, id);
  const room = async () => (await page.locator('#cw-transcript').boundingBox())!.height;
  expect(await room(), 'the transcript of a typed call').toBeGreaterThanOrEqual(250);
  expect((await page.locator('.cw-bar').boundingBox())!.height, 'the bar').toBeLessThanOrEqual(112);
  await expectNoOverflow(page, 'a typed call at 320 by 640');
  await page.request.delete(`/api/sessions/${id}`);

  await startSpokenCall(page);
  await callScreen(page).stopAudio.click();
  await expectStatus(page, 'listening');
  expect(await room(), 'the transcript of a spoken call').toBeGreaterThanOrEqual(190);
  await expectNoOverflow(page, 'a spoken call at 320 by 640');
  // Below 360 px the bar has no room for who plays the customer: Voice settings says it.
  await expect(page.locator('.cw-bar').getByText('Demo mode', { exact: true })).toBeHidden();
});

test('the call bar keeps the "Demo mode" label whole in the window from 360 px up, in a wide font too, with the transcript still 250 px at 375 by 812', async ({
  page,
}) => {
  const id = await createSession(page.request, HARD_SCENARIO_ID);
  await page.setViewportSize({ width: 375, height: 812 });
  await openTextCall(page, id);
  const chip = page.locator('.cw-bar').getByText('Demo mode', { exact: true });
  for (const [width, height] of [
    [375, 812],
    [360, 740],
    [430, 932],
    [639, 900],
  ] as const) {
    await page.setViewportSize({ width, height });
    await expect(chip, `the label at ${width}`).toBeVisible();
    const box = (await chip.boundingBox())!;
    expect(box.x, `the label starts inside the window at ${width}`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `the label ends inside the window at ${width}`).toBeLessThanOrEqual(
      width + 1,
    );
    await expectNoOverflow(page, `the call bar at ${width}`);
  }
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    (await page.locator('#cw-transcript').boundingBox())!.height,
    'the transcript at 375 by 812',
  ).toBeGreaterThanOrEqual(250);
  await page.setViewportSize({ width: 359, height: 740 });
  await expect(chip, 'and below 360 px it is left to Voice settings').toBeHidden();
  await page.request.delete(`/api/sessions/${id}`);
});

test('400 percent zoom and an on-screen keyboard leave the call usable', async ({ page }) => {
  const id = await createSession(page.request, HARD_SCENARIO_ID);
  const screen = callScreen(page);
  // 400 percent of a 1280 by 1024 window is 320 by 256 CSS pixels.
  await page.setViewportSize({ width: 320, height: 256 });
  await openTextCall(page, id);
  await expectNoOverflow(page, 'a call at 320 by 256');
  await expect(screen.endCall).toBeVisible();
  await expect(screen.reply).toBeVisible();
  // 200 percent of 1280 by 1024.
  await page.setViewportSize({ width: 640, height: 512 });
  await expectNoOverflow(page, 'a call at 640 by 512');
  await expectReachable(page, 'End call', 44);
  // A phone with its keyboard open leaves about 300 pixels of height.
  await page.setViewportSize({ width: 320, height: 300 });
  await expectNoOverflow(page, 'a call with the keyboard open');
  // The box has had focus since the call began, and focusing it again does nothing: move away and
  // come back, as a person does when they tap into it.
  await screen.reply.blur();
  await screen.reply.focus();
  const view = await screen.reply.boundingBox();
  expect(view!.y).toBeGreaterThanOrEqual(0);
  expect(view!.y + view!.height).toBeLessThanOrEqual(301);
  await expect(screen.transcript).toBeVisible();
  await expect(screen.endCall).toBeVisible();
});

test('a long transcript scrolls inside its own region and never traps the page', async ({
  page,
}) => {
  const id = await createSession(page.request, HARD_SCENARIO_ID);
  await sendLines(page.request, id, [...TRAINEE_LINES, ...TRAINEE_LINES, ...TRAINEE_LINES]);
  const screen = callScreen(page);
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: heightFor(width) });
    await page.goto(`/calls/${id}?input=text`);
    await screen.preflight.resumeText.click();
    const region = page.getByRole('region', { name: 'Transcript', exact: true });
    await expect(region).toBeVisible();
    const sizes = await region.evaluate((element) => ({
      scroll: element.scrollHeight,
      client: element.clientHeight,
      overflowY: getComputedStyle(element).overflowY,
    }));
    expect(sizes.overflowY).toBe('auto');
    expect(sizes.scroll, `the transcript holds more than it shows at ${width}`).toBeGreaterThan(
      sizes.client,
    );
    // It follows the newest turn; scrolling up moves the region, not the page, and offers a way back.
    await region.hover();
    await page.mouse.wheel(0, -400);
    await expect(page.getByRole('button', { name: 'Jump to latest' })).toBeVisible();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect(screen.endCall).toBeVisible();
    await page.getByRole('button', { name: 'Jump to latest' }).click();
    await expect(page.getByRole('button', { name: 'Jump to latest' })).toHaveCount(0);
    await expect(region).toBeFocused();
  }
});

test('the report stays readable at 320 px, and the safe areas are respected', async ({
  page,
  world,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(`/sessions/${world.reportId}/report`);
  await expect(page.getByRole('heading', { level: 1, name: 'Coaching report' })).toBeVisible();
  // The six scores are rows that fit the window, each whole.
  const scores = page.getByRole('region', { name: 'Scores', exact: true });
  await expect(scores.getByRole('listitem')).toHaveCount(6);
  for (const row of await scores.getByRole('button', { name: /of 5/ }).all()) {
    const bounds = (await row.boundingBox())!;
    expect(bounds.x, 'a score row starts inside the window').toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width, 'a score row ends inside the window').toBeLessThanOrEqual(321);
  }
  await page.getByRole('button', { name: 'Expand all' }).click();
  await expectNoOverflow(page, 'the report with every score opened at 320');
  await expectNothingCut(page, 'the report at 320');

  // Notched phones: the page opts in to the full screen and the bars keep clear of the edges.
  const content = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(content).toContain('viewport-fit=cover');
  const id = await createSession(page.request, HARD_SCENARIO_ID);
  await openTextCall(page, id);
  const safe = await page.evaluate(() => {
    const found = new Set<string>();
    const visit = (rules: CSSRuleList) => {
      for (const rule of rules) {
        if (rule.cssText.includes('safe-area-inset-bottom')) found.add('bottom');
        if ('cssRules' in rule) visit((rule as CSSGroupingRule).cssRules);
      }
    };
    for (const sheet of document.styleSheets) visit(sheet.cssRules);
    return [...found];
  });
  expect(safe, 'a bar uses env(safe-area-inset-bottom)').toContain('bottom');
});

test.describe('user preferences', () => {
  test('reduced motion: nothing animates for longer than a moment, and stages still differ', async ({
    page,
    world,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const longAnimations = () =>
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
    for (const path of [
      '/',
      '/scenarios',
      `/scenarios?scenario=${HARD_SCENARIO_ID}`,
      `/scenarios/${HARD_SCENARIO_ID}/brief`,
      `/sessions/${world.reportId}/report`,
      '/not-a-page',
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.getByRole('link').first().focus();
      expect(await longAnimations(), `${path}: running animations`).toEqual([]);
    }

    // The call still works, and each stage keeps its own words and its own shape: an icon, or the three
    // points that stand in for one while the customer works out a reply (one cue, not both).
    const { delays } = await startSpokenCall(page);
    const screen = callScreen(page);
    const seen = new Map<string, { label: string; icon: string }>();
    const record = async (status: string) => {
      await expectStatus(page, status, 30_000);
      const line = page.locator(`.cw-status[data-status="${status}"]`);
      const icon = line.locator('.cw-status__icon');
      seen.set(status, {
        label: (await line.locator('.cw-status__label').textContent()) ?? '',
        icon:
          (await icon.count()) > 0
            ? await icon.innerHTML()
            : `${await line.locator('.cw-think__dot').count()} points`,
      });
      expect(await longAnimations(), `${status}: running animations`).toEqual([]);
    };
    await record('customer-speaking');
    await screen.stopAudio.click();
    await record('listening');
    await speak(page, true);
    await record('speech-detected');
    delays.transcribe = 2000;
    delays.reply = 2000;
    await holdTone(page);
    await speak(page, false);
    await record('processing-speech');
    await record('generating-reply');
    await record('customer-speaking');
    expect(new Set([...seen.values()].map((entry) => entry.label)).size).toBe(seen.size);
    // The stages differ in their words, and most of them in their icon as well.
    expect(new Set([...seen.values()].map((entry) => entry.icon)).size).toBeGreaterThanOrEqual(3);
  });

  test('forced colours: focus, selection, status and disabled states stay distinguishable', async ({
    page,
    world,
  }, testInfo) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto('/scenarios');
    await expect(page.getByRole('heading', { level: 1, name: 'Scenarios' })).toBeVisible();
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);

    // The focus indicator is a solid outline in a system colour.
    await page.keyboard.press('Tab');
    const ring = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement as Element);
      return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
    });
    expect(ring.style).toBe('solid');
    expect(ring.width).toBeGreaterThanOrEqual(2);

    // The chosen scenario is told apart from the others by more than colour: an outline.
    await expect(page.locator('.scn-card[data-selected]')).toHaveCount(1);
    const marks = await page.evaluate(() => {
      const describe = (card: Element | null) => {
        if (!card) return null;
        const style = getComputedStyle(card);
        return { outline: `${style.outlineWidth} ${style.outlineStyle}` };
      };
      return {
        chosen: describe(document.querySelector('.scn-card[data-selected]')),
        other: describe(document.querySelector('.scn-card:not([data-selected])')),
      };
    });
    expect(marks.chosen).not.toBeNull();
    expect(marks.chosen?.outline, 'the chosen card has an outline').toMatch(/^[2-9]\S* solid$/);
    expect(
      JSON.stringify(marks.chosen),
      'the chosen card looks different from the others',
    ).not.toBe(JSON.stringify(marks.other));
    await testInfo.attach('forced colours: scenarios', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });

    // The call: the stage is in words, and a disabled control still reads as disabled.
    const { delays } = await startSpokenCall(page);
    const screen = callScreen(page);
    await expect(screen.status).toHaveText('Customer speaking');
    await screen.stopAudio.click();
    await expectStatus(page, 'listening');
    await screen.text.click();
    delays.reply = 5000;
    await screen.reply.fill('Can you read me the error message?');
    await page.keyboard.press('Enter');
    // Sending waits for the customer's reply, so the button is disabled, with its reason in words.
    await expect(screen.send).toHaveAttribute('aria-disabled', 'true');
    const readStates = () =>
      page.evaluate(() => {
        const named = (name: string) =>
          [...document.querySelectorAll('button')].find(
            (button) => button.textContent?.trim() === name,
          );
        const send = named('Send');
        const end = named('End call');
        return {
          sendColour: send ? getComputedStyle(send).color : '',
          endColour: end ? getComputedStyle(end).color : '',
          sendBorder: send ? getComputedStyle(send).borderTopStyle : '',
        };
      });
    // Buttons ease between their colours, and a computed colour read mid-way is still the old one, so
    // read it until it settles.
    await expect
      .poll(
        async () => {
          const { sendColour, endColour } = await readStates();
          return sendColour !== endColour;
        },
        { message: 'a disabled button uses a different colour from an enabled one' },
      )
      .toBe(true);
    expect((await readStates()).sendBorder).not.toBe('none');
    await testInfo.attach('forced colours: call', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await page.goto(`/sessions/${world.reportId}/report`);
    await expect(page.getByRole('heading', { level: 1, name: 'Coaching report' })).toBeVisible();
    await testInfo.attach('forced colours: report', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });
    await expectNoOverflow(page, 'the report in forced colours');
  });

  test('more contrast: nothing falls below the WCAG contrast ratios', async ({
    page,
    world,
  }, testInfo) => {
    await page.emulateMedia({ contrast: 'more' });
    for (const path of ['/', '/scenarios', `/sessions/${world.reportId}/report`]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      await expectAccessible(page, testInfo, `${path} with more contrast`);
    }
  });

  test('a dark colour scheme is followed, a saved light choice is kept, and both stay readable', async ({
    page,
    world,
  }, testInfo) => {
    const colours = () =>
      page.evaluate(() => {
        const read = (value: string) => (value.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
        const style = getComputedStyle(document.body);
        return {
          theme: document.documentElement.getAttribute('data-theme'),
          background: read(style.backgroundColor),
          text: read(style.color),
        };
      });
    await page.emulateMedia({ colorScheme: 'dark' });
    for (const path of ['/', `/sessions/${world.reportId}/report`]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      const dark = await colours();
      expect(dark.theme, `${path}: follows the system`).toBe('dark');
      expect(Math.max(...dark.background), `${path}: a dark page`).toBeLessThanOrEqual(60);
      expect(Math.min(...dark.text), `${path}: light text`).toBeGreaterThanOrEqual(200);
      await expectAccessible(page, testInfo, `${path} with a dark colour scheme`);
    }

    // A choice saved on this device wins over the system.
    await page.evaluate(() => window.localStorage.setItem('firefly.theme', 'light'));
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    const light = await colours();
    expect(light.theme, 'a saved light choice').toBe('light');
    expect(Math.min(...light.background), 'a light page').toBeGreaterThanOrEqual(235);
    expect(Math.max(...light.text), 'dark text').toBeLessThanOrEqual(80);
  });

  test('text at 200 percent and wider text spacing lose no content and no function', async ({
    page,
    world,
  }) => {
    const id = await createSession(page.request, HARD_SCENARIO_ID);
    const screen = callScreen(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const path of [
      '/',
      '/scenarios',
      `/scenarios/${HARD_SCENARIO_ID}/brief`,
      `/sessions/${world.reportId}/report`,
      `/calls/${id}?input=text`,
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      if (path.startsWith('/calls')) {
        await screen.preflight.startText.click();
        await expectStatus(page, 'text-fallback');
      }
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%';
        // WCAG 1.4.12 text spacing, applied from script because the page's policy forbids a style tag.
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(
          '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-block-end: 2em !important; }',
        );
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
      });
      await expectNoOverflow(page, `${path} at 200 percent text with wider spacing`);
      if (path.startsWith('/calls')) {
        await expect(screen.endCall).toBeVisible();
        await expect(screen.reply).toBeVisible();
        await screen.endCall.click();
        await expect(
          screen.endDialog.getByRole('button', { name: 'End and review' }),
        ).toBeVisible();
        await page.keyboard.press('Escape');
      }
    }
  });
});
