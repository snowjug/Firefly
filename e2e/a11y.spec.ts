import type { Page, TestInfo } from '@playwright/test';
import {
  HARD_SCENARIO_ID,
  SCENARIO_ID,
  TRAINEE_LINES,
  clearFailures,
  createSession,
  endSession,
  expect,
  expectAccessible,
  expectStatus,
  failNext,
  holdTone,
  installFakeMicrophone,
  refuseMicrophone,
  sendLines,
  speak,
  startSpokenCall,
  structureProblems,
  test,
  watchAnnouncements,
} from './support/a11y.ts';
import { callScreen } from './support/call-screen.ts';
import { libraryScenario } from './support/scenario-library.ts';

// Accessibility sweeps: axe-core (WCAG 2.0, 2.1 and 2.2 A and AA rules, with best-practice rules
// reported separately) on every page and every significant state of the real app, at a desktop and a
// phone width, plus the semantics a browser can test (landmarks, headings, titles, live regions,
// names and states). Zero WCAG violations is the gate; see docs/accessibility.md. Axe finds only part
// of what can go wrong (it cannot judge reading order, focus, or whether a name makes sense), so the
// focus and keyboard checks that need a person's judgement are in keyboard.spec.ts, and the call's
// announcements are read here the way a screen reader receives them.

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 375, height: 740 },
];

// Each test scans several states, and the spoken call waits on the server's scripted speech.
test.describe.configure({ timeout: 180_000 });

const HARD = libraryScenario(HARD_SCENARIO_ID);
const EXCHANGE = 'exchange-mail-delays-follow-up'; // a follow-up: it has an earlier contact to show
const RETIRED = 'locked-out-after-password-reset';

// Every page but the call has a header and a footer. The call draws its own command bar inside
// `main`, so it has no banner or footer landmark.
const PUBLIC = { banner: 1, contentinfo: 1 };
const CALL = { banner: 0, contentinfo: 0 };

/** Axe and the landmark and heading checks, for the page as it is now. */
async function check(
  page: Page,
  testInfo: TestInfo,
  label: string,
  structure: { banner: number; contentinfo: number },
) {
  await expectAccessible(page, testInfo, label);
  expect(await structureProblems(page, structure), `${label}: structure`).toEqual([]);
}

/** Opens every closed disclosure on the page (more than once, for those inside others). */
async function openEverything(page: Page) {
  for (let round = 0; round < 3; round += 1) {
    const closed = page.locator('main button[aria-expanded="false"]:visible');
    const total = await closed.count();
    if (total === 0) return;
    // From the last to the first, so that opening one never moves the ones still to open.
    for (let index = total - 1; index >= 0; index -= 1) await closed.nth(index).click();
  }
}

test.afterEach(async ({ request }) => {
  await clearFailures(request);
});

test('every route has its own title, one h1 and the page is in English', async ({
  page,
  world,
}) => {
  const id = await createSession(page.request, HARD_SCENARIO_ID);
  const titles = new Map<string, string>();
  for (const path of [
    '/',
    '/responsible-ai',
    '/about',
    '/scenarios',
    `/scenarios/${HARD_SCENARIO_ID}/brief`,
    `/sessions/${world.reportId}/report`,
    `/calls/${id}`,
    '/there-is-no-such-page',
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.locator('html')).toHaveAttribute('lang', /^en/);
    const title = await page.title();
    expect(title, `${path}: a title`).not.toBe('');
    titles.set(path, title);
  }
  expect(new Set(titles.values()).size, `the titles ${JSON.stringify([...titles.values()])}`).toBe(
    titles.size,
  );
});

test('nothing plays, listens or loads speech before the person starts the call', async ({
  page,
}) => {
  await installFakeMicrophone(page);
  const id = await createSession(page.request, HARD_SCENARIO_ID);
  await page.goto(`/calls/${id}?input=voice`);
  await expect(callScreen(page).preflight.heading).toBeVisible();
  const before = await page.evaluate(() => ({
    microphoneRequests: window.__fireflyMic?.requests ?? -1,
    // The speech service's own addresses (the page's script for speech is code, not speech).
    speechRequests: performance
      .getEntriesByType('resource')
      .filter((entry) => /\/api\/speech\//.test(entry.name)).length,
    playing: [...document.querySelectorAll('audio')].filter((audio) => !audio.paused).length,
  }));
  expect(before).toEqual({ microphoneRequests: 0, speechRequests: 0, playing: 0 });
  await callScreen(page).preflight.startVoice.click();
  await expect
    .poll(() => page.evaluate(() => window.__fireflyMic?.requests ?? 0))
    .toBeGreaterThan(0);
});

test('the call announces whole sentences once and leaves transcript text to the log', async ({
  page,
}) => {
  const announced = await watchAnnouncements(page);
  const { delays } = await startSpokenCall(page);
  const screen = callScreen(page);
  // The customer's opening line is in the transcript before its voice has finished, as text.
  await expect(screen.turns).toHaveCount(1);
  // One polite region speaks for the whole call, and nothing interrupts the person.
  await expect(page.locator('[role="status"][aria-live="polite"].visually-hidden')).toHaveCount(1);
  await expect(page.locator('[role="alert"], [aria-live="assertive"]')).toHaveCount(0);
  await expect(screen.transcript).toHaveAttribute('aria-live', 'polite');

  await screen.stopAudio.click();
  await expectStatus(page, 'listening');
  await speak(page, true);
  await expectStatus(page, 'speech-detected');
  await holdTone(page);
  delays.transcribe = 1500;
  await speak(page, false);
  await expectStatus(page, 'customer-speaking', 30_000);
  await expect(screen.turns).toHaveCount(3);

  // The announcer reads one sentence at a time, each held long enough to be heard, so it can lag a
  // few seconds behind the screen: wait for it rather than for the stage.
  await expect
    .poll(async () => (await announced()).includes('Listening. Speak when you are ready.'), {
      timeout: 20_000,
    })
    .toBe(true);
  const said = await announced();
  expect(said, `the call announces itself: ${JSON.stringify(said)}`).toContain(
    'The customer is speaking. You can stop the customer audio at any time.',
  );
  // "Hearing you" changes with every breath, so it is on screen and never announced.
  expect(said.join(' ')).not.toMatch(/hearing you/i);
  const turns = await screen.turns.locator('.cw-turn__text').allTextContents();
  for (const sentence of said) {
    expect(sentence.length, `"${sentence}" is a short announcement`).toBeLessThan(140);
    for (const turn of turns) {
      expect(
        turn.includes(sentence) || sentence.includes(turn),
        'transcript text is not announced',
      ).toBe(false);
    }
  }
  // Nothing announces every audio level or every detector frame.
  expect(said.length).toBeLessThan(20);
});

test('a message that is too long says so in words, linked to the box', async ({ page }) => {
  const id = await createSession(page.request, HARD_SCENARIO_ID);
  await page.goto(`/calls/${id}?input=text`);
  const screen = callScreen(page);
  await screen.preflight.startText.click();
  await screen.reply.fill('a'.repeat(1501));
  await expect(screen.reply).toHaveAttribute('aria-invalid', 'true');
  await expect(screen.reply).toHaveAccessibleDescription(/1 over the 1,500 character limit\./);
  // Send waits, and stays in the tab order, with the reason attached to it.
  await expect(screen.send).toHaveAttribute('aria-disabled', 'true');
  await expect(screen.send).toHaveAccessibleDescription(/1 over the 1,500 character limit\./);
  // Within the limit again, the reason goes and Send works.
  await screen.reply.fill('a'.repeat(1500));
  await expect(screen.reply).not.toHaveAttribute('aria-invalid', 'true');
  await expect(screen.send).not.toHaveAttribute('aria-disabled', 'true');
});

for (const viewport of VIEWPORTS) {
  test.describe(`at ${viewport.width} px wide`, () => {
    test.use({ viewport });
    const narrow = viewport.width < 1024;

    test('the public pages, the example call and the not-found page', async ({
      page,
    }, testInfo) => {
      for (const [path, title] of [
        ['/', 'Firefly: practise Microsoft support calls'],
        ['/responsible-ai', 'Responsible AI \u00b7 Firefly'],
        ['/about', 'About \u00b7 Firefly'],
        ['/there-is-no-such-page', 'Page not found \u00b7 Firefly'],
      ] as const) {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(page).toHaveTitle(title);
        await check(page, testInfo, `${path} at ${viewport.width}`, PUBLIC);
      }

      await page.goto('/');
      const preview = page.getByRole('figure', {
        name: 'Example call. The customer is synthetic.',
      });
      for (const tab of await preview.getByRole('tab').all()) {
        await tab.click();
        await expect(tab).toHaveAttribute('aria-selected', 'true');
        const name = (await tab.textContent()) ?? '';
        await check(page, testInfo, `the example call, ${name} tab`, PUBLIC);
      }
    });

    test('the scenario workspace: the list, the filters, the set-up, an empty list and a retired link', async ({
      page,
      world,
    }, testInfo) => {
      expect(world.reportId).toBeTruthy();
      await page.goto('/scenarios');
      await expect(page.getByRole('heading', { level: 1, name: 'Scenarios' })).toBeVisible();
      await expect(
        page
          .getByRole('main')
          .getByRole('status')
          .filter({ hasText: /\bscenarios?$/ }),
      ).toHaveText('16 scenarios');
      await check(page, testInfo, 'scenarios', PUBLIC);

      if (narrow) {
        await page.getByRole('button', { name: 'Filters', exact: true }).click();
        await expect(page.getByRole('combobox', { name: 'Product' })).toBeVisible();
        await check(page, testInfo, 'scenarios with the filters open', PUBLIC);
        await page.getByRole('combobox', { name: 'Product' }).selectOption('windows-11');
        await check(page, testInfo, 'scenarios, filtered', PUBLIC);

        await page.goto(`/scenarios?scenario=${HARD_SCENARIO_ID}`);
        await expect(page.getByRole('heading', { level: 1, name: HARD.title })).toBeVisible();
        await check(page, testInfo, 'a scenario on its own page', PUBLIC);
        await page.getByRole('button', { name: /^Customise/ }).click();
        await check(page, testInfo, 'a scenario with its set-up open', PUBLIC);
      } else {
        await page.goto(`/scenarios?scenario=${HARD_SCENARIO_ID}`);
        const pane = page.getByRole('region', { name: HARD.title, exact: true });
        await expect(pane.getByRole('heading', { level: 2, name: HARD.title })).toBeVisible();
        await check(page, testInfo, 'a scenario chosen', PUBLIC);
        await pane.getByRole('button', { name: /^Customise/ }).click();
        await pane
          .getByRole('group', { name: /^Impact/ })
          .getByRole('radio', { name: 'Low' })
          .check();
        await check(
          page,
          testInfo,
          'a scenario with its set-up open and one setting changed',
          PUBLIC,
        );

        await page.goto('/scenarios?f_product=windows-11');
        await expect(page.getByRole('heading', { level: 1, name: 'Scenarios' })).toBeVisible();
        await check(page, testInfo, 'scenarios filtered by product', PUBLIC);
      }

      await page.goto('/scenarios?f_product=dynamics-365&f_difficulty=starter');
      await expect(
        page.getByRole('heading', { level: 2, name: 'No scenarios match' }),
      ).toBeVisible();
      await check(page, testInfo, 'no scenario matches the filters', PUBLIC);

      await page.goto(`/scenarios?scenario=${RETIRED}`);
      await expect(
        page.getByText('That scenario is no longer in the library. Choose another.'),
      ).toBeVisible();
      await check(page, testInfo, 'a link to a retired scenario', PUBLIC);
    });

    test('the case brief, with everything opened, and an unknown scenario', async ({
      page,
    }, testInfo) => {
      await page.goto(`/scenarios/${HARD_SCENARIO_ID}/brief`);
      await expect(page.getByRole('heading', { level: 1, name: 'Case brief' })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Privacy notice' })).toBeVisible();
      await check(page, testInfo, 'brief with the privacy notice', PUBLIC);

      // A follow-up has an earlier contact to show, so it has the most to open.
      await page.goto(`/scenarios/${EXCHANGE}/brief`);
      await expect(page.getByRole('heading', { level: 1, name: 'Case brief' })).toBeVisible();
      await openEverything(page);
      await check(page, testInfo, 'brief with every disclosure opened', PUBLIC);

      await page.goto('/scenarios/not-a-scenario/brief');
      await expect(
        page.getByRole('heading', { level: 1, name: 'Scenario unavailable' }),
      ).toBeVisible();
      await check(page, testInfo, 'brief of an unknown scenario', PUBLIC);
    });

    test('the call pre-flight, a refused microphone and a typed call', async ({
      page,
    }, testInfo) => {
      await installFakeMicrophone(page);
      const id = await createSession(page.request, HARD_SCENARIO_ID);
      await page.goto(`/calls/${id}?input=voice`);
      const screen = callScreen(page);
      await expect(screen.preflight.heading).toBeVisible();
      await expect(page).toHaveTitle(/^Call with .* \u00b7 Firefly$/);
      await check(page, testInfo, 'pre-flight', CALL);

      await refuseMicrophone(page);
      await screen.preflight.startVoice.click();
      await expect(screen.problem.card).toBeVisible();
      await expect(screen.problem.useText).toBeVisible();
      await check(page, testInfo, 'pre-flight with the microphone refused', CALL);

      await screen.problem.useText.click();
      await expect(screen.reply).toBeVisible();
      await expectStatus(page, 'text-fallback');
      await check(page, testInfo, 'a typed call', CALL);

      await page.goto('/calls/not-a-call');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await check(page, testInfo, 'an unknown call', CALL);
    });

    test('a spoken call, stage by stage', async ({ page }, testInfo) => {
      const { delays } = await startSpokenCall(page);
      const screen = callScreen(page);
      await expect(screen.stopAudio).toBeVisible();
      await check(page, testInfo, 'the customer is speaking', CALL);

      await screen.stopAudio.click();
      await expectStatus(page, 'listening');
      await check(page, testInfo, 'listening', CALL);

      await speak(page, true);
      await expectStatus(page, 'speech-detected');
      await check(page, testInfo, 'hearing you', CALL);

      delays.transcribe = 2500;
      delays.reply = 2500;
      await holdTone(page);
      await speak(page, false);
      await expectStatus(page, 'processing-speech', 30_000);
      await check(page, testInfo, 'processing what you said', CALL);

      await expectStatus(page, 'generating-reply', 30_000);
      await check(page, testInfo, 'the customer is replying', CALL);

      await expectStatus(page, 'customer-speaking', 30_000);
      await check(page, testInfo, 'the customer is speaking again', CALL);

      await screen.stopAudio.click();
      delays.transcribe = 0;
      delays.reply = 0;
      await screen.mute.click();
      await expectStatus(page, 'muted');
      await check(page, testInfo, 'muted', CALL);
      await screen.mute.click();
      await screen.pause.click();
      await expectStatus(page, 'paused');
      await check(page, testInfo, 'paused', CALL);
      await screen.resume.click();
    });

    test('a call with a problem, and the call dialogs', async ({ page }, testInfo) => {
      await startSpokenCall(page);
      const screen = callScreen(page);
      await screen.stopAudio.click();
      await expectStatus(page, 'listening');

      await screen.endCall.click();
      await expect(screen.endDialog).toBeVisible();
      await check(page, testInfo, 'end the call dialog', CALL);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);

      await screen.settings.click();
      await expect(screen.settingsDialog).toBeVisible();
      await check(page, testInfo, 'voice settings dialog', CALL);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);

      if (narrow) {
        await page.getByRole('button', { name: 'Case', exact: true }).click();
        await expect(page.getByRole('dialog', { name: 'Case' })).toBeVisible();
        await check(page, testInfo, 'the case sheet', CALL);
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);
      }

      // The customer fails to reply to a typed message: the problem is said in words, with a way on.
      await screen.text.click();
      await failNext(page.request, 'customer', 1);
      await screen.reply.fill('Can you read me the error message?');
      await page.keyboard.press('Enter');
      await expect(screen.problem.card).toBeVisible();
      await expect(screen.problem.title).toHaveText('The customer could not reply.');
      await check(page, testInfo, 'a problem card', CALL);
      await expect(screen.problem.retry).toBeVisible();
    });

    test('the report while it is built, and when it fails', async ({ page, world }, testInfo) => {
      await page.route(`**/api/sessions/${world.reportId}`, async (route) => {
        if (route.request().method() !== 'GET') return route.continue();
        const response = await route.fetch();
        const body = (await response.json()) as { session: Record<string, unknown> };
        body.session = {
          ...body.session,
          status: 'completing',
          evaluationPhase: 'scoring',
          report: null,
        };
        return route.fulfill({ response, json: body });
      });
      await page.goto(`/sessions/${world.reportId}/report`);
      await expect(
        page.getByRole('heading', { level: 1, name: 'Building your coaching report' }),
      ).toBeVisible();
      await expect(page.getByRole('list', { name: 'Report progress' })).toBeVisible();
      await check(page, testInfo, 'evaluating', PUBLIC);
      // Wait for a request that is still being answered, or its handler fails once the route is gone.
      await page.unrouteAll({ behavior: 'wait' });

      const failing = await createSession(page.request, SCENARIO_ID);
      await sendLines(page.request, failing, TRAINEE_LINES.slice(0, 3));
      await failNext(page.request, 'evaluator', 1);
      expect(await endSession(page.request, failing)).toBe('evaluation_failed');
      await page.goto(`/sessions/${failing}/report`);
      await expect(page.getByRole('button', { name: 'Retry evaluation' })).toBeVisible();
      await check(page, testInfo, 'evaluation failed', PUBLIC);

      await page.goto('/sessions/not-a-call/report');
      await expect(
        page.getByRole('heading', { level: 1, name: 'Report unavailable' }),
      ).toBeVisible();
      await check(page, testInfo, 'an unknown call', PUBLIC);
    });

    test('the coaching report, opened out, with its transcript and its dialog', async ({
      page,
      world,
    }, testInfo) => {
      await page.goto(`/sessions/${world.reportId}/report`);
      await expect(page.getByRole('heading', { level: 1, name: 'Coaching report' })).toBeVisible();
      await check(page, testInfo, 'report', PUBLIC);

      await page.getByRole('button', { name: 'Expand all' }).click();
      await expect(page.getByRole('button', { name: /Hide details$/ })).toHaveCount(6);
      await check(page, testInfo, 'report with every score opened', PUBLIC);

      await page
        .getByRole('button', { name: /^Show behaviours for / })
        .first()
        .click();
      await page
        .getByRole('button', { name: /^Show details for / })
        .first()
        .click();
      await page.getByRole('region', { name: 'About this report' }).locator('summary').click();
      await check(
        page,
        testInfo,
        'report with behaviours, a fact and the explanation opened',
        PUBLIC,
      );

      const transcript = page.getByRole('region', { name: 'Transcript', exact: true });
      await transcript.scrollIntoViewIfNeeded();
      await transcript.getByRole('radio', { name: /^Evidence/ }).check();
      await check(page, testInfo, 'transcript with a filter chosen', PUBLIC);
      await transcript.getByRole('radio', { name: /^All turns/ }).check();

      await page
        .getByRole('link', { name: /^See turn \d+ in the transcript$/ })
        .first()
        .click();
      await expect(page.getByRole('button', { name: /^Back to / })).toBeVisible();
      await check(page, testInfo, 'transcript with a cited turn', PUBLIC);

      await page.getByRole('button', { name: 'Delete this call' }).click();
      await expect(page.getByRole('dialog', { name: 'Delete this call?' })).toBeVisible();
      await check(page, testInfo, 'delete dialog', PUBLIC);
      await page.getByRole('button', { name: 'Cancel' }).click();
    });
  });
}
