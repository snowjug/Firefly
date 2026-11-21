import type { Locator, Page } from '@playwright/test';
import {
  HARD_SCENARIO_ID,
  clearFailures,
  createSession,
  expect,
  expectStatus,
  focusStop,
  installFakeMicrophone,
  lengthenCustomerVoice,
  speak,
  startSpokenCall,
  tabTo,
  test,
} from './support/a11y.ts';
import { callScreen, startTypedCall } from './support/call-screen.ts';
// The two tests that need the API and the console recorder use the shared fixtures of the other specs.
import { test as appTest } from './support/fixtures.ts';

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

test('a keyboard-only journey from the landing page, through a voice call, to a finished report', async ({
  page,
}) => {
  // ---- landing: the skip link is the first stop and moves focus to main ----
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.keyboard.press('Tab');
  expect(await focusStop(page)).toMatchObject({ name: 'Skip to main content', ring: true });
  await page.keyboard.press('Enter');
  expect(await activeId(page)).toBe('main');

  // ---- to the scenario workspace ----
  await tabTo(page, /^Start call$/);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/scenarios/);
  await expect(page.getByRole('heading', { level: 1, name: 'Scenarios' })).toBeVisible();
  expect(await activeId(page), 'a new page puts focus on main').toBe('main');

  // The scenario list is one radio group: one Tab stop, and the arrow keys move and choose.
  await tabTo(page, /^Scenarios: /);
  const first = (await focusStop(page))!.name.replace('Scenarios: ', '');
  await expect(page.getByRole('heading', { level: 2, name: first })).toBeVisible();
  await page.keyboard.press('ArrowDown');
  const second = (await focusStop(page))!.name.replace('Scenarios: ', '');
  expect(second).not.toBe(first);
  await expect(page.getByRole('heading', { level: 2, name: second })).toBeVisible();
  await expect(page.getByRole('radio', { name: second, exact: true })).toBeChecked();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('radio', { name: first, exact: true })).toBeChecked();
  await page.keyboard.press('Tab');
  expect(
    (await focusStop(page))!.name,
    'Tab leaves the list instead of stepping through every scenario',
  ).not.toMatch(/^Scenarios: /);
  await page.keyboard.press('Shift+Tab');
  expect((await focusStop(page))!.name).toBe(`Scenarios: ${first}`);
  // The second scenario, an Outlook shared mailbox, is the one that is called.
  await page.keyboard.press('ArrowDown');
  await expect(
    page.getByRole('heading', { level: 2, name: 'Shared team mailbox missing from Outlook' }),
  ).toBeVisible();

  // ---- the brief ----
  await tabTo(page, /^Review brief$/);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Case brief' })).toBeVisible();
  expect(await activeId(page)).toBe('main');
  await tabTo(page, /^Start voice call$/);
  await page.keyboard.press('Enter');

  // ---- the pre-flight, then a spoken call ----
  await expect(page.getByRole('heading', { level: 1, name: 'Ready to call?' })).toBeVisible();
  expect(await activeId(page)).toBe('main');
  await lengthenCustomerVoice(page, 30);
  await tabTo(page, /^Start voice call$/);
  await page.keyboard.press('Enter');
  const screen = callScreen(page);
  await expect(screen.status).toHaveText('Customer speaking');
  // The pre-flight's button is gone, so the keyboard starts on the call's own controls.
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.closest('#cw-controls') !== null))
    .toBe(true);

  // "Stop customer audio" is the next control: it takes the turn, the microphone opens by itself, the
  // fake microphone is heard, and the words come back. Nothing else has to be pressed to take a turn.
  await tabTo(page, /^Stop customer audio$/, 5);
  await page.keyboard.press('Enter');
  await expect(screen.turns).toHaveCount(3, { timeout: 45_000 });

  // ---- end the call: the dialog traps focus, Escape returns it, Continue is where it starts ----
  const presses = await tabTo(page, /^End call$/, 30, true);
  expect(presses, 'End call is a few Shift+Tab stops from the controls').toBeLessThanOrEqual(12);
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
  await expect(screen.endCall).toBeFocused();
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
  await tabTo(page, /^See turn \d+ in the transcript$/, 120);
  const href = await page.evaluate(() => document.activeElement?.getAttribute('href'));
  await page.keyboard.press('Enter');
  await expect.poll(() => activeId(page)).toBe(href?.slice(1));
  expect(
    await page.evaluate(() => document.activeElement?.closest('ol')?.getAttribute('aria-label')),
  ).toBe('Transcript');
  await tabTo(page, /^Back to /, 60);
  await page.keyboard.press('Enter');
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.getAttribute('href')))
    .toBe(href);

  // "Review transcript" lands on the transcript's heading; the next stop is the search box, and
  // Enter and Shift+Enter step through the matches.
  await tabTo(page, /^Review transcript$/, 120);
  await page.keyboard.press('Enter');
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.textContent?.trim()))
    .toBe('Transcript');
  await tabTo(page, /^Find in transcript$/, 5);
  // A letter that every English sentence has, so that the call's own words cannot leave nothing to step through.
  await page.keyboard.type('e');
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
  await tabTo(page, /^Delete this call$/, 80, true);
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
    '/about',
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
    for (let i = 0; i < 220 && !left; i += 1) {
      await page.keyboard.press('Tab');
      left = (await focusStop(page)) === null;
    }
    expect(left, `${path}: Tab reaches the end of the page`).toBe(true);
  }
});

test('the preset and the difficulty filter are radio groups that move with the arrow keys', async ({
  page,
}) => {
  await page.goto(`/scenarios?scenario=${HARD_SCENARIO_ID}`);
  await expect(
    page.getByRole('heading', { level: 2, name: /Programme team still blocked/ }),
  ).toBeVisible();

  await test.step('the preset: one Tab stop, the arrow keys choose, and the address follows', async () => {
    await tabTo(page, /^Preset: /, 60);
    const before = (await focusStop(page))!.name;
    expect(before).toBe('Preset: Challenge');
    await page.keyboard.press('ArrowLeft');
    expect((await focusStop(page))!.name).toBe('Preset: Standard');
    await expect.poll(() => new URL(page.url()).searchParams.get('difficulty')).toBe('standard');
    await page.keyboard.press('ArrowRight');
    expect((await focusStop(page))!.name).toBe(before);
    // Back at the scenario's own difficulty: nothing is left in the address.
    await expect.poll(() => new URL(page.url()).searchParams.get('difficulty')).toBeNull();
  });

  await test.step('the difficulty filter: the arrow keys choose, and the list follows', async () => {
    await page.goto('/scenarios');
    await expect(
      page.getByRole('group', { name: 'Difficulty' }).getByRole('radio', { name: /^All\b/ }),
    ).toBeChecked();
    await tabTo(page, /^Difficulty: All/, 20);
    await page.keyboard.press('ArrowRight');
    await expect(
      page.getByRole('group', { name: 'Difficulty' }).getByRole('radio', { name: /^Starter\b/ }),
    ).toBeChecked();
    await expect(
      page
        .getByRole('main')
        .getByRole('status')
        .filter({ hasText: /scenarios$/ }),
    ).toHaveText('4 of 16 scenarios');
  });
});

test('every dialog opens from the keyboard, traps focus, closes on Escape and gives focus back', async ({
  page,
  world,
}) => {
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
  await page.getByRole('button', { name: 'Stop customer audio' }).focus();
  await page.keyboard.press('Enter');
  await expectStatus(page, 'listening');
  await expectDialogBehaves(page, page.getByRole('button', { name: 'Settings' }), 'Voice settings');
  await expectDialogBehaves(page, page.getByRole('button', { name: 'End call' }), 'End the call?');
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 740 } });

  test('a scenario opens from the keyboard on a page of its own, and Back puts focus on its row', async ({
    page,
  }) => {
    await page.goto('/scenarios');
    await expect(page.getByRole('heading', { level: 1, name: 'Scenarios' })).toBeVisible();
    const row = page.getByRole('link', {
      name: 'Shared team mailbox missing from Outlook',
      exact: true,
    });
    await row.focus();
    // The arrow keys move between the rows as an extra on top of Tab.
    await page.keyboard.press('ArrowUp');
    await expect(
      page.getByRole('list', { name: 'Scenarios' }).getByRole('link').first(),
    ).toBeFocused();
    await row.focus();
    await page.keyboard.press('Enter');
    const title = page.getByRole('heading', {
      level: 1,
      name: 'Shared team mailbox missing from Outlook',
    });
    await expect(title).toBeVisible();
    await expect(title).toBeFocused();
    await page.getByRole('button', { name: 'Scenarios', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(row).toBeFocused();
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

  appTest(
    'the case sheet opens from the keyboard, traps focus, and gives focus back',
    async ({ page, api }) => {
      await startTypedCall(page, api);
      await expectDialogBehaves(
        page,
        page.getByRole('button', { name: 'Case', exact: true }),
        'Case',
      );
    },
  );

  test('the end call and microphone controls are a few Tab stops away', async ({ page }) => {
    await startSpokenCall(page);
    await page.getByRole('button', { name: 'Stop customer audio' }).focus();
    await page.keyboard.press('Enter');
    await expectStatus(page, 'listening');
    await page.evaluate(() => document.getElementById('main')?.focus());
    const toEnd = await tabTo(page, /^End call$/, 30);
    await page.evaluate(() => document.getElementById('main')?.focus());
    const toMicrophone = await tabTo(page, /^(Talk|Done speaking|Return to voice)$/, 30);
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
  await page.getByRole('button', { name: 'Settings' }).focus();
  await page.keyboard.press('Enter');
  const settings = page.getByRole('dialog', { name: 'Voice settings' });
  await expect(settings).toBeVisible();
  await settings.getByRole('switch', { name: 'Hands-free' }).focus();
  await page.keyboard.press('Space');
  await expect(settings.getByRole('switch', { name: 'Hands-free' })).not.toBeChecked();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Stop customer audio' }).focus();
  await page.keyboard.press('Enter');
  await expectStatus(page, 'mic-ready');

  // Letters mean nothing outside a text field: no shortcut fires.
  await page.keyboard.type('mptrse?');
  await expectStatus(page, 'mic-ready');
  await expect(page.getByRole('button', { name: 'Mute', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );

  // Talk, and the same control, still focused, becomes Done speaking: one more key stops the microphone.
  const talk = page.locator('[data-cw-talk]');
  await talk.focus();
  await page.keyboard.press('Enter');
  await expectStatus(page, 'listening');
  await expect(talk).toBeFocused();
  await expect(talk).toHaveAccessibleName('Done speaking');
  await speak(page, true);
  await expectStatus(page, 'speech-detected');
  await speak(page, false);
  await page.keyboard.press('Space');
  await expect(
    page.locator('.cw-status[data-status="listening"], .cw-status[data-status="speech-detected"]'),
  ).toHaveCount(0);
});

appTest(
  'after Retry on a failed reply the keyboard is never dropped, and the dialog it came from gives it back',
  async ({ page, api, problems }) => {
    problems.allow({ status: 502, url: '/messages' });
    const { screen } = await startTypedCall(page, api);
    await api.failNext('customer', 1);
    await screen.reply.fill('Hello, my name is Sam. Can you tell me what is happening?');
    await page.keyboard.press('Enter');
    await expect(screen.problem.retry).toBeVisible();

    // Tab to the card's Retry and press it: the card goes when it works, and focus must not fall to the page.
    await tabTo(page, /^Retry$/, 30);
    await page.keyboard.press('Enter');
    await expect(screen.turns).toHaveCount(3);
    await expect(screen.problem.card).toHaveCount(0);
    const where = await page.evaluate(() => {
      const active = document.activeElement;
      return {
        body: active === document.body || active === document.documentElement,
        inCall: Boolean(active?.closest('.cw-root')),
      };
    });
    expect(where.body, 'focus did not fall to the page').toBe(false);
    expect(where.inCall, 'focus stayed inside the call').toBe(true);
    // And the call goes on from the keyboard.
    await screen.reply.focus();
    await page.keyboard.type('When did it last work?');
    await page.keyboard.press('Enter');
    await expect(screen.turns).toHaveCount(5);
  },
);
