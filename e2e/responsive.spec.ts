import type { Page } from '@playwright/test';
import {
  HARD_SCENARIO_ID,
  TRAINEE_LINES,
  clearFailures,
  createSession,
  expect,
  expectAccessible,
  expectStage,
  overflow,
  scan,
  sendLines,
  speak,
  startSpokenCall,
  test,
} from './support/a11y.ts';

// Responsive and user-preference checks: no horizontal scrolling at any width (WCAG 1.4.10), the call's
// key controls reachable and big enough (2.5.5, 2.5.8), the transcript scrolling inside its own region,
// and the interface holding up under reduced motion, forced colours, more contrast, a dark colour
// scheme, enlarged text and changed text spacing.

test.describe.configure({ timeout: 150_000 });

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
  await page.getByRole('button', { name: 'Start text-only call' }).click();
  await expectStage(page, 'text');
}

test('every page reflows at every width, with no sideways scrolling', async ({ page, world }) => {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: heightFor(width) });
    for (const path of [
      '/',
      '/responsible-ai',
      '/about',
      '/scenarios',
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
    }
  }
});

test('the scenario sheet fits a phone, and the filters open without sideways scrolling', async ({
  page,
}) => {
  for (const width of [320, 375, 430, 768]) {
    await page.setViewportSize({ width, height: heightFor(width) });
    await page.goto('/scenarios');
    await page.getByRole('button', { name: /^Filters/ }).click();
    await expect(page.getByRole('combobox', { name: 'Business impact' })).toBeVisible();
    await expectNoOverflow(page, `filters at ${width}`);
    await page.getByRole('radio').first().click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    const sizes = await sheet.evaluate((element) => ({
      scroll: element.scrollWidth,
      client: element.clientWidth,
    }));
    expect(sizes.scroll, `the sheet at ${width}`).toBeLessThanOrEqual(sizes.client);
    await page.keyboard.press('Escape');
  }
});

test('the call keeps End call and the microphone in reach at every width', async ({ page }) => {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: heightFor(width) });
    const id = await createSession(page.request, HARD_SCENARIO_ID);
    await page.goto(`/calls/${id}`);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Ready to start the call?' }),
    ).toBeVisible();
    await expectNoOverflow(page, `pre-flight at ${width}`);
    await page.getByRole('button', { name: 'Start text-only call' }).click();
    await expectStage(page, 'text');
    await expectNoOverflow(page, `a text call at ${width}`);
    await expectReachable(page, 'End call', 44);
    await expect(page.getByRole('textbox', { name: 'Type a reply' })).toBeVisible();
    const target = await page.getByRole('textbox', { name: 'Type a reply' }).boundingBox();
    expect(target!.y + target!.height, `the reply box is in view at ${width}`).toBeLessThanOrEqual(
      heightFor(width) + 1,
    );
    // Every control passes axe's target-size rule (24 by 24 CSS pixels), where the layout changes.
    if ([320, 768, 1440].includes(width)) {
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
      await page.getByRole('button', { name: 'Interrupt' }).click();
      await expectStage(page, 'listening');
      await expectNoOverflow(page, `a spoken call at ${width}`);
      await expectReachable(page, 'End call', 44);
      await expectReachable(page, /^(Talk|Stop talking|Interrupt)$/, 44);
      for (const name of ['Mute', 'Pause', 'Replay', 'Type instead', 'Voice settings']) {
        await expectReachable(page, name, 24);
      }
      await expectNoOverflow(page, `a spoken call at ${width}`);
    });
  }
});

test('400 percent zoom and an on-screen keyboard leave the call usable', async ({ page }) => {
  const id = await createSession(page.request, HARD_SCENARIO_ID);
  // 400 percent of a 1280 by 1024 window is 320 by 256 CSS pixels.
  await page.setViewportSize({ width: 320, height: 256 });
  await openTextCall(page, id);
  await expectNoOverflow(page, 'a call at 320 by 256');
  await expect(page.getByRole('button', { name: 'End call' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Type a reply' })).toBeVisible();
  // 200 percent of 1280 by 1024.
  await page.setViewportSize({ width: 640, height: 512 });
  await expectNoOverflow(page, 'a call at 640 by 512');
  await expectReachable(page, 'End call', 44);
  // A phone with its keyboard open leaves about 300 pixels of height.
  await page.setViewportSize({ width: 320, height: 300 });
  await expectNoOverflow(page, 'a call with the keyboard open');
  await page.getByRole('textbox', { name: 'Type a reply' }).focus();
  const view = await page.getByRole('textbox', { name: 'Type a reply' }).boundingBox();
  expect(view!.y).toBeGreaterThanOrEqual(0);
  expect(view!.y + view!.height).toBeLessThanOrEqual(301);
  await expect(page.getByRole('log', { name: 'Call transcript' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'End call' })).toBeVisible();
});

test('a long transcript scrolls inside its own region and never traps the page', async ({
  page,
}) => {
  const id = await createSession(page.request, HARD_SCENARIO_ID);
  await sendLines(page.request, id, TRAINEE_LINES);
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: heightFor(width) });
    await page.goto(`/calls/${id}?input=text`);
    await page.getByRole('button', { name: 'Resume as a text-only call' }).click();
    const region = page.getByRole('region', { name: 'Transcript' });
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
    await expect(page.getByRole('button', { name: 'End call' })).toBeVisible();
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
  const table = page.getByRole('table', { name: 'Six coaching skills, each scored from 1 to 5' });
  await expect(table).toBeVisible();
  const fits = await table.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.left >= 0 && bounds.right <= window.innerWidth;
  });
  expect(fits, 'the score table fits the window').toBe(true);
  for (const skill of ['Opening & Rapport', 'Scoping & Discovery', 'Closing']) {
    await expect(table.getByRole('rowheader', { name: skill })).toBeVisible();
  }
  await expectNoOverflow(page, 'the report at 320');

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
      `/scenarios/${HARD_SCENARIO_ID}/brief`,
      `/sessions/${world.reportId}/report`,
      '/not-a-page',
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.getByRole('link').first().focus();
      expect(await longAnimations(), `${path}: running animations`).toEqual([]);
    }

    // The call still works, and each stage keeps its own words and icon.
    const { delays } = await startSpokenCall(page);
    const seen = new Map<string, { label: string; icon: string }>();
    const record = async (stage: string) => {
      await expectStage(page, stage);
      const strip = page.locator(`[data-stage="${stage}"]`);
      seen.set(stage, {
        label: (await strip.locator('p').first().textContent()) ?? '',
        icon: (await strip.locator('svg').first().innerHTML()) ?? '',
      });
      expect(await longAnimations(), `${stage}: running animations`).toEqual([]);
    };
    await record('speaking');
    await page.getByRole('button', { name: 'Interrupt' }).click();
    await record('listening');
    await speak(page, true);
    await record('hearing');
    delays.transcribe = 2000;
    delays.reply = 2000;
    await speak(page, false);
    await record('transcribing');
    await record('thinking');
    await record('speaking');
    expect(new Set([...seen.values()].map((entry) => entry.label)).size).toBe(seen.size);
    // Listening and Hearing you share the microphone; they differ in words and in the waveform.
    expect(new Set([...seen.values()].map((entry) => entry.icon)).size).toBeGreaterThanOrEqual(4);
  });

  test('forced colours: focus, selection, status and disabled states stay distinguishable', async ({
    page,
    world,
  }, testInfo) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto('/scenarios');
    await expect(page.getByRole('heading', { level: 1, name: 'Choose a scenario' })).toBeVisible();
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);

    // The focus indicator is a solid outline in a system colour.
    await page.keyboard.press('Tab');
    const ring = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement as Element);
      return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
    });
    expect(ring.style).toBe('solid');
    expect(ring.width).toBeGreaterThanOrEqual(2);

    // The chosen scenario is told apart from the others by more than colour: a mark and a border.
    const marks = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.scn-row')];
      const describe = (row: Element) => {
        const style = getComputedStyle(row);
        const check = row.querySelector('.scn-row__check');
        const shown = check ? getComputedStyle(check) : null;
        return {
          border: `${style.borderTopWidth} ${style.borderTopStyle} ${style.borderTopColor}`,
          outline: `${style.outlineWidth} ${style.outlineStyle}`,
          mark: shown ? `${shown.display} ${shown.visibility} ${shown.opacity}` : 'none',
        };
      };
      const chosen = rows.find((row) => row.querySelector('input:checked'));
      const other = rows.find((row) => !row.querySelector('input:checked'));
      return { chosen: chosen ? describe(chosen) : null, other: other ? describe(other) : null };
    });
    expect(marks.chosen).not.toBeNull();
    expect(JSON.stringify(marks.chosen), 'the chosen row looks different from the others').not.toBe(
      JSON.stringify(marks.other),
    );
    await testInfo.attach('forced colours: scenarios', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });

    // The call: the stage is in words, and a disabled control still reads as disabled.
    const { delays } = await startSpokenCall(page);
    await expect(page.locator('[data-stage="speaking"]')).toContainText('The customer is speaking');
    await page.getByRole('button', { name: 'Interrupt' }).click();
    await expectStage(page, 'listening');
    await page.getByRole('button', { name: 'Type instead' }).click();
    delays.reply = 5000;
    await page
      .getByRole('textbox', { name: 'Type a reply' })
      .fill('Can you read me the error message?');
    await page.keyboard.press('Enter');
    // Sending waits for the customer's reply, so the button is disabled, with its reason in words.
    const send = page.getByRole('button', { name: 'Send' });
    await expect(send).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByText('Waiting for the customer to reply.').first()).toBeVisible();
    const states = await page.evaluate(() => {
      const named = (name: string) =>
        [...document.querySelectorAll('button')].find((button) => button.textContent === name);
      const send = named('Send');
      const end = named('End call');
      return {
        sendColour: send ? getComputedStyle(send).color : '',
        endColour: end ? getComputedStyle(end).color : '',
        sendBorder: send ? getComputedStyle(send).borderTopStyle : '',
      };
    });
    expect(
      states.sendColour,
      'a disabled button uses a different colour from an enabled one',
    ).not.toBe(states.endColour);
    expect(states.sendBorder).not.toBe('none');
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
    for (const path of ['/', `/sessions/${world.reportId}/report`]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      await expectAccessible(page, testInfo, `${path} with more contrast`);
    }
  });

  test('a dark colour scheme is ignored: the interface stays light and readable', async ({
    page,
    world,
  }, testInfo) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    for (const path of ['/', `/sessions/${world.reportId}/report`]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      const colours = await page.evaluate(() => {
        const read = (value: string) => (value.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
        const style = getComputedStyle(document.body);
        return { background: read(style.backgroundColor), text: read(style.color) };
      });
      expect(Math.min(...colours.background), `${path}: a light page`).toBeGreaterThanOrEqual(235);
      expect(Math.max(...colours.text), `${path}: dark text`).toBeLessThanOrEqual(80);
      await expectAccessible(page, testInfo, `${path} with a dark colour scheme`);
    }
  });

  test('text at 200 percent and wider text spacing lose no content and no function', async ({
    page,
    world,
  }) => {
    const id = await createSession(page.request, HARD_SCENARIO_ID);
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const path of [
      '/',
      '/scenarios',
      `/sessions/${world.reportId}/report`,
      `/calls/${id}?input=text`,
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      if (path.startsWith('/calls')) {
        await page.getByRole('button', { name: 'Start text-only call' }).click();
        await expectStage(page, 'text');
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
        await expect(page.getByRole('button', { name: 'End call' })).toBeVisible();
        await expect(page.getByRole('textbox', { name: 'Type a reply' })).toBeVisible();
        await page.getByRole('button', { name: 'End call' }).click();
        await expect(page.getByRole('button', { name: 'End and review' })).toBeVisible();
        await page.keyboard.press('Escape');
      }
    }
  });
});
