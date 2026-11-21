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
  expectStage,
  failNext,
  installFakeMicrophone,
  refuseMicrophone,
  sendLines,
  speak,
  startSpokenCall,
  structureProblems,
  test,
  watchAnnouncements,
} from './support/a11y.ts';

// Accessibility sweeps: axe-core (WCAG 2.0, 2.1 and 2.2 A and AA rules, with best-practice rules
// reported separately) on every page and every significant state of the real app, at a desktop and a
// phone width, plus the semantics a browser can test (landmarks, headings, titles, live regions,
// names and states). Zero WCAG violations is the gate; see docs/accessibility.md.

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 375, height: 740 },
];

// Each test scans several states, and the spoken call waits on the server's scripted speech.
test.describe.configure({ timeout: 150_000 });

const PUBLIC = { banner: 1, contentinfo: 1 };
// The call draws its own command bar inside `main`, so it has no banner or footer landmark.
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

test.afterEach(async ({ request }) => {
  await clearFailures(request);
});

test('every route has its own title and the page is in English', async ({ page, world }) => {
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
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeAttached();
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
  await page.goto(`/calls/${id}`);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Ready to start the call?' }),
  ).toBeVisible();
  const before = await page.evaluate(() => ({
    microphoneRequests: window.__fireflyMic?.requests ?? -1,
    speechRequests: performance
      .getEntriesByType('resource')
      .filter((entry) => /\/speech|\/transcribe/.test(entry.name)).length,
    playing: [...document.querySelectorAll('audio')].filter((audio) => !audio.paused).length,
  }));
  expect(before).toEqual({ microphoneRequests: 0, speechRequests: 0, playing: 0 });
  await page.getByRole('button', { name: 'Allow microphone and start' }).click();
  await expect
    .poll(() => page.evaluate(() => window.__fireflyMic?.requests ?? 0))
    .toBeGreaterThan(0);
});

test('the call announces whole sentences once and leaves transcript text to the log', async ({
  page,
}) => {
  const announced = await watchAnnouncements(page);
  const { delays } = await startSpokenCall(page);
  const log = page.getByRole('log', { name: 'Call transcript' });
  // The customer's opening line is in the transcript before its voice has finished, as text.
  await expect(log.getByRole('listitem')).toHaveCount(1);
  await expect(page.locator('[role="status"][aria-live="polite"]')).toHaveCount(1);
  await expect(page.locator('[role="alert"], [aria-live="assertive"]')).toHaveCount(0);
  await expect(log).toHaveAttribute('aria-live', 'polite');

  await page.getByRole('button', { name: 'Interrupt' }).click();
  await expectStage(page, 'listening');
  await speak(page, true);
  await expectStage(page, 'hearing');
  delays.transcribe = 1500;
  await speak(page, false);
  await expectStage(page, 'speaking');
  await expect(log.getByRole('listitem')).toHaveCount(3);

  // The announcer reads one sentence at a time, each held long enough to be heard, so it can lag a
  // few seconds behind the screen: wait for it rather than for the stage.
  await expect
    .poll(async () => (await announced()).includes('Listening.'), { timeout: 20_000 })
    .toBe(true);
  const said = await announced();
  expect(said, `the call announces itself: ${JSON.stringify(said)}`).toContain(
    'The customer is speaking.',
  );
  const turns = await log.getByRole('listitem').locator('.cw-turn__text').allTextContents();
  for (const sentence of said) {
    expect(sentence.length, `"${sentence}" is one short sentence`).toBeLessThan(140);
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
  await page.getByRole('button', { name: 'Start text-only call' }).click();
  const box = page.getByRole('textbox', { name: 'Type a reply' });
  await box.fill('a'.repeat(1501));
  await expect(box).toHaveAttribute('aria-invalid', 'true');
  await expect(box).toHaveAccessibleDescription(/over the limit/);
  await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();
});

for (const viewport of VIEWPORTS) {
  test.describe(`at ${viewport.width} px wide`, () => {
    test.use({ viewport });
    const narrow = viewport.width < 768;

    test('the public pages and the not-found page', async ({ page }, testInfo) => {
      for (const [path, title] of [
        ['/', 'Firefly: practise customer conversations'],
        ['/responsible-ai', 'Responsible AI · Firefly'],
        ['/about', 'About · Firefly'],
        ['/there-is-no-such-page', 'Page not found · Firefly'],
      ] as const) {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(page).toHaveTitle(title);
        await check(page, testInfo, `${path} at ${viewport.width}`, PUBLIC);
      }
    });

    test('the scenario workspace, its filters, its sheet and recent calls', async ({
      page,
      world,
    }, testInfo) => {
      expect(world.reportId).toBeTruthy();
      await page.goto('/scenarios');
      await expect(
        page.getByRole('heading', { level: 1, name: 'Choose a scenario' }),
      ).toBeVisible();
      await expect(page.getByText('13 scenarios')).toBeVisible();
      await check(page, testInfo, 'scenarios', PUBLIC);

      await page.goto(`/scenarios?scenario=${HARD_SCENARIO_ID}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      if (narrow) {
        await expect(
          page.getByRole('dialog', { name: 'Fourth contact, same failing uploads' }),
        ).toBeVisible();
        await check(page, testInfo, 'scenario sheet', PUBLIC);
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await page.getByRole('button', { name: /^Filters/ }).click();
        await expect(page.getByRole('combobox', { name: 'Issue type' })).toBeVisible();
        await check(page, testInfo, 'scenarios with the filters open', PUBLIC);
      } else {
        await expect(
          page.getByRole('heading', { level: 2, name: 'Fourth contact, same failing uploads' }),
        ).toBeVisible();
        await page.getByRole('switch', { name: /Live hints during the call/ }).click();
        await expect(page.getByText('Changed from default')).toBeVisible();
        await check(page, testInfo, 'a scenario selected and one setting changed', PUBLIC);
      }

      await page.goto('/scenarios?q=zzzzqq');
      await expect(
        page.getByRole('heading', { level: 2, name: 'No scenarios match' }),
      ).toBeVisible();
      await check(page, testInfo, 'no scenario matches the search', PUBLIC);

      await page.goto('/scenarios');
      await page.getByRole('button', { name: 'Recent calls' }).click();
      await expect(page.getByRole('link', { name: /View report/ }).first()).toBeVisible();
      await check(page, testInfo, 'recent calls dialog', PUBLIC);
      await page.keyboard.press('Escape');

      // A call in progress is announced at the top with the way back in.
      const open = await createSession(page.request, SCENARIO_ID);
      await page.goto('/scenarios');
      await expect(page.getByText(/You have a call in progress/)).toBeVisible();
      await check(page, testInfo, 'a call in progress', PUBLIC);
      await page.request.delete(`/api/sessions/${open}`);
    });

    test('the call brief and an unknown scenario', async ({ page }, testInfo) => {
      await page.goto(`/scenarios/${HARD_SCENARIO_ID}/brief`);
      await expect(page.getByRole('heading', { level: 1, name: 'Call brief' })).toBeVisible();
      await check(page, testInfo, 'brief', PUBLIC);
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
      await page.goto(`/calls/${id}`);
      await expect(
        page.getByRole('heading', { level: 1, name: 'Ready to start the call?' }),
      ).toBeVisible();
      await expect(page).toHaveTitle(/^Call with .* · Firefly$/);
      await check(page, testInfo, 'pre-flight', CALL);

      await refuseMicrophone(page);
      await page.getByRole('button', { name: 'Allow microphone and start' }).click();
      await expect(page.getByRole('button', { name: 'Start a text-only call' })).toBeVisible();
      await check(page, testInfo, 'pre-flight with the microphone refused', CALL);

      await page.getByRole('button', { name: 'Start a text-only call' }).click();
      await expect(page.getByRole('heading', { level: 1, name: /^Call with / })).toBeAttached();
      await expectStage(page, 'text');
      await check(page, testInfo, 'a text-only call', CALL);

      await page.goto('/calls/not-a-call');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await check(page, testInfo, 'an unknown call', CALL);
    });

    test('a spoken call, stage by stage', async ({ page }, testInfo) => {
      const { delays } = await startSpokenCall(page);
      await expect(page.getByRole('button', { name: 'Interrupt' })).toBeVisible();
      await check(page, testInfo, 'the customer is speaking', CALL);

      await page.getByRole('button', { name: 'Interrupt' }).click();
      await expectStage(page, 'listening');
      await expect(page.getByRole('button', { name: 'Stop talking' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await check(page, testInfo, 'listening', CALL);

      await speak(page, true);
      await expectStage(page, 'hearing');
      await check(page, testInfo, 'hearing you', CALL);

      delays.transcribe = 2500;
      delays.reply = 2500;
      await speak(page, false);
      await expectStage(page, 'transcribing');
      await check(page, testInfo, 'transcribing what you said', CALL);

      await expectStage(page, 'thinking');
      await check(page, testInfo, 'the customer is thinking', CALL);

      await expectStage(page, 'speaking');
      await check(page, testInfo, 'the customer is speaking again', CALL);

      await page.getByRole('button', { name: 'Interrupt' }).click();
      delays.transcribe = 0;
      delays.reply = 0;
      await page.getByRole('button', { name: 'Mute' }).click();
      await expectStage(page, 'muted');
      await check(page, testInfo, 'muted', CALL);
      await page.getByRole('button', { name: 'Mute' }).click();
      await page.getByRole('button', { name: 'Pause' }).click();
      await expectStage(page, 'paused');
      await check(page, testInfo, 'paused', CALL);
      await page.getByRole('button', { name: 'Resume' }).click();
    });

    test('a call with a problem, and the call dialogs', async ({ page }, testInfo) => {
      await startSpokenCall(page);
      await page.getByRole('button', { name: 'Interrupt' }).click();
      await expectStage(page, 'listening');

      await page.getByRole('button', { name: 'End call' }).click();
      await expect(page.getByRole('dialog', { name: 'End the call?' })).toBeVisible();
      await check(page, testInfo, 'end the call dialog', CALL);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);

      await page.getByRole('button', { name: 'Voice settings' }).click();
      await expect(page.getByRole('dialog', { name: 'Voice settings' })).toBeVisible();
      await check(page, testInfo, 'voice settings dialog', CALL);
      await page.keyboard.press('Escape');

      if (narrow) {
        await page.getByRole('button', { name: 'Details' }).click();
        await expect(page.getByRole('dialog', { name: 'Call details' })).toBeVisible();
        await check(page, testInfo, 'call details sheet', CALL);
        await page.keyboard.press('Escape');
      }

      // The customer fails to reply to a typed message: the problem is said in words, with a way on.
      await failNext(page.request, 'customer', 1);
      await page
        .getByRole('button', { name: /Type instead|Type a reply instead/ })
        .first()
        .click();
      await page
        .getByRole('textbox', { name: 'Type a reply' })
        .fill('Can you read me the error message?');
      await page.keyboard.press('Enter');
      await expect(page.getByText('The customer has not replied').first()).toBeVisible();
      await check(page, testInfo, 'a problem banner', CALL);
      await expect(page.getByRole('button', { name: 'Try again' }).first()).toBeVisible();
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

    test('the coaching report, its transcript with markers and its dialog', async ({
      page,
      world,
    }, testInfo) => {
      await page.goto(`/sessions/${world.reportId}/report`);
      await expect(page.getByRole('heading', { level: 1, name: 'Coaching report' })).toBeVisible();
      await check(page, testInfo, 'report', PUBLIC);

      await page.getByRole('heading', { level: 2, name: 'Transcript' }).scrollIntoViewIfNeeded();
      // The first filter that has any turns (the others are disabled).
      const filter = page.getByRole('group', { name: 'Filter the transcript' });
      await filter.locator('input:enabled').nth(1).check();
      await expect(page.getByText(/^Showing \d+ turns?/)).toBeVisible();
      await check(page, testInfo, 'transcript with a filter chosen', PUBLIC);
      await filter.locator('input:enabled').first().check();

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
