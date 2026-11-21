import type { Locator, Page } from '@playwright/test';
import {
  HARD_SCENARIO_ID,
  clearFailures,
  createSession,
  expect,
  expectStage,
  focusStop,
  installFakeMicrophone,
  speak,
  startSpokenCall,
  tabTo,
  test,
} from './support/a11y.ts';

// Keyboard-only checks. Every key press here is Tab, Shift+Tab, Enter, Space, an arrow key or
// Escape. Each Tab stop must show a focus indicator, in view, with at least 3:1 contrast
// (WCAG 2.4.7, 2.4.11, 1.4.11); `tabTo` checks that for every stop it passes.

test.describe.configure({ timeout: 150_000 });

test.afterEach(async ({ request }) => {
  await clearFailures(request);
});

const activeId = (page: Page) => page.evaluate(() => document.activeElement?.id ?? '');

/**
 * Focus is on an element outside the dialog. Focus on nothing (the browser's own controls, which a
 * native modal dialog lets Tab reach) is not a leak: the page behind a modal is inert.
 */
async function focusLeaked(page: Page, dialog: Locator): Promise<boolean> {
  const handle = await dialog.elementHandle();
  if (!handle) return true;
  return page.evaluate(
    ([root]) => {
      const active = document.activeElement;
      return (
        active !== null &&
        active !== document.body &&
        active !== document.documentElement &&
        !(root as Element).contains(active)
      );
    },
    [handle] as const,
  );
}

/** The element that has focus now is inside this dialog. */
async function focusIsIn(page: Page, dialog: Locator): Promise<boolean> {
  const handle = await dialog.elementHandle();
  if (!handle) return false;
  return page.evaluate(([root]) => (root as Element).contains(document.activeElement), [
    handle,
  ] as const);
}

/**
 * Opens a dialog from the keyboard, checks that focus goes in and never reaches the page behind it
 * however far Tab and Shift+Tab go, that Escape closes it, and that focus comes back to what opened it.
 */
async function expectDialogBehaves(page: Page, opener: Locator, name: string) {
  await opener.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name });
  await expect(dialog).toBeVisible();
  expect(await focusIsIn(page, dialog), `${name}: focus moves into the dialog`).toBe(true);
  let inside = 0;
  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press('Tab');
    expect(await focusLeaked(page, dialog), `${name}: Tab ${i + 1} stays in the dialog`).toBe(
      false,
    );
    const stop = await focusStop(page);
    if (stop) {
      inside += 1;
      expect(stop.ring, `${name}: a focus indicator on "${stop.name}"`).toBe(true);
    }
  }
  expect(inside, `${name}: Tab reaches the dialog's own controls`).toBeGreaterThan(0);
  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.press('Shift+Tab');
    expect(await focusLeaked(page, dialog), `${name}: Shift+Tab ${i + 1} stays in the dialog`).toBe(
      false,
    );
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener, `${name}: focus returns to what opened it`).toBeFocused();
}

test('a keyboard-only journey from the landing page to a finished report', async ({ page }) => {
  // ---- landing: the skip link is the first stop and moves focus to main ----
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.keyboard.press('Tab');
  expect(await focusStop(page)).toMatchObject({ name: 'Skip to main content', ring: true });
  await page.keyboard.press('Enter');
  expect(await activeId(page)).toBe('main');

  // ---- to the scenario workspace ----
  await tabTo(page, /^Start a simulation$/);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/scenarios/);
  await expect(page.getByRole('heading', { level: 1, name: 'Choose a scenario' })).toBeVisible();
  expect(await activeId(page), 'a new page puts focus on main').toBe('main');

  // The scenario list is one radio group: one Tab stop, and the arrow keys move and choose.
  await tabTo(page, /^Choose a scenario: /);
  const first = (await focusStop(page))!.name.replace('Choose a scenario: ', '');
  await expect(page.getByRole('heading', { level: 2, name: first })).toBeVisible();
  await page.keyboard.press('ArrowDown');
  const second = (await focusStop(page))!.name.replace('Choose a scenario: ', '');
  expect(second).not.toBe(first);
  await expect(page.getByRole('heading', { level: 2, name: second })).toBeVisible();
  await expect(page.getByRole('radio', { name: second })).toBeChecked();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('radio', { name: first })).toBeChecked();
  await page.keyboard.press('Tab');
  expect(
    (await focusStop(page))!.name,
    'Tab leaves the list instead of stepping through every scenario',
  ).not.toMatch(/^Choose a scenario: /);
  await page.keyboard.press('Shift+Tab');
  expect((await focusStop(page))!.name).toBe(`Choose a scenario: ${first}`);

  // ---- the brief ----
  await tabTo(page, /^Continue to call brief$/);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Call brief' })).toBeVisible();
  expect(await activeId(page)).toBe('main');
  await tabTo(page, /^Start a text-only call$/);
  await page.keyboard.press('Enter');

  // ---- the pre-flight, then a typed call ----
  await expect(
    page.getByRole('heading', { level: 1, name: 'Ready to start the call?' }),
  ).toBeVisible();
  expect(await activeId(page)).toBe('main');
  await tabTo(page, /^Start text-only call$/);
  await page.keyboard.press('Enter');
  await expectStage(page, 'text');

  const turns = page.getByRole('log', { name: 'Call transcript' }).getByRole('listitem');
  const lines = [
    "Hello, thanks for calling. My name is Sam. I'm sorry you're having trouble, what is happening?",
    'Thanks. Can you read me exactly what the screen says, and when it last worked?',
    "I'll take ownership of this and call you back by 10am. Is there anything else I can help with?",
  ];
  for (const [index, line] of lines.entries()) {
    await tabTo(page, /^Type a reply$/);
    await page.keyboard.type(line);
    await page.keyboard.press('Enter');
    // Each of my lines gets one reply: the opening line, then my line and the customer's, again.
    await expect(turns).toHaveCount(1 + 2 * (index + 1));
  }

  // ---- end the call: the dialog traps focus, Escape returns it, Continue is where it starts ----
  const endButton = page.getByRole('button', { name: 'End call' });
  const presses = await tabTo(page, /^End call$/, 20, true);
  expect(presses, 'End call is a few Shift+Tab stops from the reply box').toBeLessThanOrEqual(12);
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'End the call?' });
  await expect(dialog).toBeVisible();
  expect((await focusStop(page))!.name, 'a stray Enter never ends the call').toBe('Continue call');
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press('Tab');
    expect(await focusLeaked(page, dialog)).toBe(false);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(endButton).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeVisible();
  await tabTo(page, /^End and review$/);
  await page.keyboard.press('Enter');

  // ---- the report: focus arrives on the page, not on nothing ----
  await expect(page).toHaveURL(/\/sessions\/.+\/report/);
  const title = page.getByRole('heading', { level: 1, name: 'Coaching report' });
  await expect(title).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.id))
    .toMatch(/^(main|report-title)$/);

  // An evidence link moves focus into the transcript; "Back to ..." returns it to the same link.
  await tabTo(page, /^See turn \d+ in the transcript$/, 80);
  const href = await page.evaluate(() => document.activeElement?.getAttribute('href'));
  await page.keyboard.press('Enter');
  await expect.poll(() => activeId(page)).toBe(href?.slice(1));
  expect(
    await page.evaluate(() => document.activeElement?.closest('ol')?.getAttribute('aria-label')),
  ).toBe('Transcript');
  await tabTo(page, /^Back to /, 40);
  await page.keyboard.press('Enter');
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.getAttribute('href')))
    .toBe(href);

  // "Review transcript" lands on the transcript's heading; the next stop is the search box, and
  // Enter and Shift+Enter step through the matches.
  await tabTo(page, /^Review transcript$/, 60);
  await page.keyboard.press('Enter');
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.textContent?.trim()))
    .toBe('Transcript');
  await tabTo(page, /^Find in transcript$/, 5);
  await page.keyboard.type('you');
  await page.keyboard.press('Enter');
  await expect(page.getByText(/^Match 1 of \d+, in turn \d+$/)).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByText(/^Match 2 of \d+/)).toBeVisible();
  await page.keyboard.press('Shift+Enter');
  await expect(page.getByText(/^Match 1 of \d+/)).toBeVisible();

  // The filter is a radio group: Tab enters it once, the arrow keys move and choose.
  await tabTo(page, /^Filter the transcript: All turns/, 10);
  await page.keyboard.press('ArrowRight');
  expect((await focusStop(page))!.name).toMatch(
    /^Filter the transcript: (Evidence|Discovered|Mood|Unexpected)/,
  );
  await expect(page.getByRole('radio', { name: /^All turns/ })).not.toBeChecked();

  // Deleting asks first; Cancel is where focus starts, and Escape gives focus back. The button is
  // in the actions above the transcript, so Shift+Tab finds it.
  const remove = page.getByRole('button', { name: 'Delete this call' });
  await tabTo(page, /^Delete this call$/, 60, true);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Delete this call?' })).toBeVisible();
  expect((await focusStop(page))!.name).toBe('Cancel');
  await page.keyboard.press('Escape');
  await expect(remove).toBeFocused();
});

test('every page starts with a skip link that works, and nothing traps the keyboard', async ({
  page,
  world,
}) => {
  const id = await createSession(page.request, HARD_SCENARIO_ID);
  for (const path of [
    '/',
    '/responsible-ai',
    '/scenarios',
    `/scenarios/${HARD_SCENARIO_ID}/brief`,
    `/sessions/${world.reportId}/report`,
    `/calls/${id}`,
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeAttached();
    await page.keyboard.press('Tab');
    expect((await focusStop(page))?.name, `${path}: the first Tab stop`).toBe(
      'Skip to main content',
    );
    await page.keyboard.press('Enter');
    expect(await activeId(page), `${path}: the skip link moves focus to main`).toBe('main');

    // Tab all the way through: focus must leave the document (the end of the tab order) in time.
    let left = false;
    for (let i = 0; i < 160 && !left; i += 1) {
      await page.keyboard.press('Tab');
      left = (await focusStop(page)) === null;
    }
    expect(left, `${path}: Tab reaches the end of the page`).toBe(true);
  }
});

test('the radio groups of the call setup move with the arrow keys', async ({ page }) => {
  await page.goto(`/scenarios?scenario=${HARD_SCENARIO_ID}`);
  await expect(page.getByRole('heading', { level: 3, name: 'Call setup' })).toBeVisible();
  const difficulty = page
    .getByRole('radiogroup', { name: /^Difficulty/ })
    .or(page.getByRole('group', { name: /^Difficulty/ }));
  await tabTo(page, /^Difficulty: /, 40);
  const before = (await focusStop(page))!.name;
  await page.keyboard.press('ArrowLeft');
  const after = (await focusStop(page))!.name;
  expect(after).not.toBe(before);
  await expect(difficulty.getByText('Changed from default')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset to scenario defaults' })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  expect((await focusStop(page))!.name).toBe(before);
  await expect(page.getByRole('button', { name: 'Reset to scenario defaults' })).toHaveCount(0);
});

test('every dialog opens from the keyboard, traps focus, closes on Escape and gives focus back', async ({
  page,
  world,
}) => {
  // Recent calls and the scenario sheet are on the workspace.
  await page.goto('/scenarios');
  await expect(page.getByRole('heading', { level: 1, name: 'Choose a scenario' })).toBeVisible();
  await expectDialogBehaves(
    page,
    page.getByRole('button', { name: 'Recent calls' }),
    'Recent calls',
  );

  // Delete is on the report.
  await page.goto(`/sessions/${world.reportId}/report`);
  await expect(page.getByRole('heading', { level: 1, name: 'Coaching report' })).toBeVisible();
  await expectDialogBehaves(
    page,
    page.getByRole('button', { name: 'Delete this call' }),
    'Delete this call?',
  );

  // The call's two dialogs, in a spoken call.
  await startSpokenCall(page);
  await page.getByRole('button', { name: 'Interrupt' }).focus();
  await page.keyboard.press('Enter');
  await expectStage(page, 'listening');
  await expectDialogBehaves(
    page,
    page.getByRole('button', { name: 'Voice settings' }),
    'Voice settings',
  );
  await expectDialogBehaves(page, page.getByRole('button', { name: 'End call' }), 'End the call?');
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 740 } });

  test('the scenario sheet and the call details sheet behave as dialogs', async ({ page }) => {
    await page.goto('/scenarios');
    await expect(page.getByRole('heading', { level: 1, name: 'Choose a scenario' })).toBeVisible();
    // Arrow keys choose a scenario without opening the sheet; the button is the way in.
    await tabTo(page, /^Choose a scenario: /);
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const review = page.getByRole('button', { name: 'Review and set up' });
    await expect(review).toBeVisible();
    await review.focus();
    await page.keyboard.press('Enter');
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(review).toBeFocused();

    await startSpokenCall(page);
    await page.getByRole('button', { name: 'Interrupt' }).focus();
    await page.keyboard.press('Enter');
    await expectStage(page, 'listening');
    await expectDialogBehaves(page, page.getByRole('button', { name: 'Details' }), 'Call details');
  });

  test('the header menu opens from the keyboard, closes on Escape and keeps focus', async ({
    page,
  }) => {
    for (const [path, name] of [
      ['/', 'Menu'],
      ['/scenarios', 'Demo mode'],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const button = page.getByRole('button', { name, exact: true });
      await button.focus();
      await expect(button).toHaveAttribute('aria-expanded', 'false');
      await page.keyboard.press('Enter');
      await expect(button).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(button).toHaveAttribute('aria-expanded', 'false');
      await expect(button, `${path}: focus stays on the menu button`).toBeFocused();
    }
  });

  test('the end call and microphone controls are a few Tab stops away', async ({ page }) => {
    await startSpokenCall(page);
    await page.getByRole('button', { name: 'Interrupt' }).focus();
    await page.keyboard.press('Enter');
    await expectStage(page, 'listening');
    await page.evaluate(() => document.getElementById('main')?.focus());
    const toEnd = await tabTo(page, /^End call$/, 30);
    await page.evaluate(() => document.getElementById('main')?.focus());
    const toMicrophone = await tabTo(page, /^(Talk|Stop talking|Interrupt)$/, 30);
    expect(toEnd, 'Tab stops from the top of the call to End call').toBeLessThanOrEqual(12);
    expect(
      toMicrophone,
      'Tab stops from the top of the call to the microphone control',
    ).toBeLessThanOrEqual(12);
    test.info().annotations.push({
      type: 'Tab stops at 375 px, from the start of main',
      description: `End call: ${toEnd}; microphone control: ${toMicrophone}`,
    });
  });
});

test('the microphone stops with one key press, and nothing listens for letters', async ({
  page,
}) => {
  await installFakeMicrophone(page);
  const { id } = await startSpokenCall(page);
  expect(id).toBeTruthy();

  // Turn hands-free off, so the person decides when the microphone opens.
  await page.getByRole('button', { name: 'Voice settings' }).focus();
  await page.keyboard.press('Enter');
  const settings = page.getByRole('dialog', { name: 'Voice settings' });
  await expect(settings).toBeVisible();
  await settings.getByRole('switch', { name: 'Hands-free' }).focus();
  await page.keyboard.press('Space');
  await expect(settings.getByRole('switch', { name: 'Hands-free' })).not.toBeChecked();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Interrupt' }).focus();
  await page.keyboard.press('Enter');
  await expectStage(page, 'your-turn');

  // Letters mean nothing outside a text field: no shortcut fires.
  await page.keyboard.type('mptrse?');
  await expectStage(page, 'your-turn');
  await expect(page.getByRole('button', { name: 'Mute' })).toHaveAttribute('aria-pressed', 'false');

  // Talk, and the same control, still focused, becomes Stop talking: one more key stops the microphone.
  const talk = page.locator('[data-control="talk"]');
  await talk.focus();
  await page.keyboard.press('Enter');
  await expectStage(page, 'listening');
  await expect(talk).toBeFocused();
  await expect(talk).toHaveAccessibleName('Stop talking');
  await speak(page, true);
  await expectStage(page, 'hearing');
  await speak(page, false);
  await page.keyboard.press('Space');
  await expect(page.locator('[data-stage="listening"], [data-stage="hearing"]')).toHaveCount(0);
});
