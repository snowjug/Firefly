import type { Page } from '@playwright/test';
import type { SessionDTO } from '../shared/domain/api.ts';
import type { CoachingReport } from '../shared/domain/report.ts';
import { DIMENSIONS } from '../shared/domain/vocab.ts';
import { expect, test } from './support/fixtures.ts';
import { callScreen, sendTyped } from './support/call-screen.ts';
import { expectNoRawFailureText } from './support/raw-text.ts';
import { libraryScenario } from './support/scenario-library.ts';

// Journeys 14 to 16: the coaching report, evidence navigation, a failed evaluation that is retried,
// and the way on to another call. The calls are made through the API (the call itself is tested in
// the other specs) and the report is read in a real browser. The report is the demo-mode rules
// evaluator's: its wording is Firefly's own, so these tests check structure and agreement with the
// report data, never that the coaching is good.

test.describe.configure({ timeout: 90_000 });

const SHARED_WORKSPACE = 'team-cannot-open-shared-workspace';

// Four of the six hidden facts are asked for; "who else can open it" and "a workaround" are not.
const WORKSPACE_CALL = [
  'Hello, my name is Sam. Can you tell me what is happening?',
  "I'm sorry, I can hear how stressful the deadline is. Can you read me exactly what the message says?",
  'When did it last work, and did anything change before it stopped?',
  'What have you already tried so far?',
  "I'll take ownership of this. I will check access and call you back by two o'clock. Let me summarise: six of you cannot open it, and the message mentions permission. Is there anything else I can help with?",
];

const formatScore = (score: number) => (Number.isInteger(score) ? String(score) : score.toFixed(1));

async function openReport(page: Page, sessionId: string) {
  await page.goto(`/sessions/${sessionId}/report`);
  await expect(page.getByRole('heading', { level: 1, name: 'Coaching report' })).toBeVisible();
}

test.describe('the coaching report', () => {
  let call: SessionDTO;
  let report: CoachingReport;

  test.beforeEach(async ({ api, page }) => {
    call = await api.completedCall({
      scenarioId: SHARED_WORKSPACE,
      overrides: { curveballs: ['ask-manager'] },
      mode: 'guided',
      lines: WORKSPACE_CALL,
    });
    expect(call.status).toBe('completed');
    report = call.report as CoachingReport;
    await openReport(page, call.id);
  });

  test('shows all six skills with their scores and labels, and the overall score, as the report data says', async ({
    page,
  }) => {
    await expect(page).toHaveTitle(/Coaching report/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

    const table = page.getByRole('table', { name: 'Six coaching skills, each scored from 1 to 5' });
    await expect(table.getByRole('row')).toHaveCount(7);
    expect(report.dimensions).toHaveLength(6);
    for (const dimension of report.dimensions) {
      const label = DIMENSIONS[dimension.id].label;
      const row = table.getByRole('row', { name: new RegExp(`^${label}`) });
      await expect(row).toContainText(`${dimension.score} of 5`);
      await expect(row).toContainText(dimension.label);
      await expect(row.getByRole('link', { name: `Details for ${label}` })).toBeVisible();
    }

    const summary = page.getByRole('region', { name: 'Overall coaching summary' });
    expect(report.summary.overallScore).not.toBeNull();
    await expect(summary).toContainText(
      `${formatScore(report.summary.overallScore as number)} of 5`,
    );
    await expect(summary).toContainText('A practice signal, not a grade.');

    await test.step('the skill details give the reason, the evidence and one way to strengthen it, for each skill', async () => {
      for (const dimension of report.dimensions) {
        const item = page.locator(`#skill-${dimension.id}`);
        await expect(item).toContainText(`${dimension.score} of 5, ${dimension.label}.`);
        await expect(item).toContainText('Why this score');
        await expect(item).toContainText('Evidence from your call');
        await expect(item).toContainText('To strengthen this');
        await expect(item).toContainText('CARE behaviours this skill draws on');
      }
    });
  });

  test('labels itself as a training aid, says who wrote it, and says it is not an assessment', async ({
    page,
  }) => {
    const summary = page.getByRole('region', { name: 'Overall coaching summary' });
    await expect(summary).toContainText('Training aid.');
    await expect(summary).toContainText('Practice coaching, not employee-performance assessment.');
    await expect(summary).toContainText(
      "Written by Firefly's built-in rules evaluator (demo mode).",
    );
    await expect(summary).toContainText('It can be incomplete or wrong: review it with a mentor.');
    const about = page.getByRole('region', { name: 'About this report' });
    await expect(about).toContainText('Built-in rules, not a language model');
    await expect(about).toContainText(
      'This is practice coaching, not an assessment of your performance.',
    );
    await expect(about).toContainText('Scores are not compared with anyone else');
    // None of the words the product never uses.
    const text = await page.locator('main').innerText();
    expect(text).not.toMatch(/\b(leaderboard|badge|streak|level up|achievement)s?\b/i);
  });

  test("shows the customer's mood through the call as a chart, a list of what moved it and a table", async ({
    page,
  }) => {
    const journey = page.getByRole('region', { name: 'Customer temperature' });
    await expect(
      journey.getByRole('img', { name: /^Customer temperature through the call/ }),
    ).toBeVisible();
    await expect(journey.getByRole('list', { name: 'Chart key' })).toBeVisible();
    await expect(journey).toContainText(/The customer started \w+ and ended \w+\./);
    await expect(
      journey.getByRole('heading', { level: 3, name: 'What moved the customer' }),
    ).toBeVisible();
    expect(
      await journey.getByRole('link', { name: /^See turn \d+ in the transcript$/ }).count(),
    ).toBeGreaterThanOrEqual(2);

    await test.step('the unexpected turn that was set up is reported with its outcome', async () => {
      expect(report.curveball).not.toBeNull();
      await expect(
        journey.getByRole('heading', { level: 3, name: 'Unexpected turn' }),
      ).toBeVisible();
      await expect(journey).toContainText('Asks for a manager');
    });

    await test.step('the same points are there as a table', async () => {
      await journey.getByText('Show as a table').click();
      const table = journey.getByRole('table', {
        name: 'Customer temperature at each point in the call',
      });
      await expect(table).toBeVisible();
      await expect(table.getByRole('row')).toHaveCount(report.journey.points.length + 1);
    });
  });

  test('has what went well, what to improve, the discovery review with found and missed facts, and what to practise next', async ({
    page,
  }) => {
    const library = libraryScenario(SHARED_WORKSPACE);

    await test.step('what went well and what to improve, each with the words and a stronger way to say it', async () => {
      const well = page.getByRole('region', { name: 'What went well' });
      await expect(well.getByRole('heading', { level: 3 }).first()).toBeVisible();
      await expect(well.getByText('Why it worked').first()).toBeVisible();
      const better = page.getByRole('region', { name: 'What to improve' });
      await expect(better.getByRole('heading', { level: 3 }).first()).toBeVisible();
      await expect(better.getByText('A stronger way to say it').first()).toBeVisible();
    });

    await test.step('discovery: each found fact shows what held back and which question revealed it', async () => {
      const discovery = page.getByRole('region', { name: 'Discovery review' });
      const { found, total, missed } = report.discovery;
      expect(found).toBeGreaterThan(0);
      expect(missed).toBeGreaterThan(0);
      await expect(discovery).toContainText(`You found ${found} of ${total} hidden facts`);
      await expect(
        discovery.getByRole('heading', { level: 3, name: `Found (${found})` }),
      ).toBeVisible();
      await expect(
        discovery.getByRole('heading', { level: 3, name: `Missed (${missed})` }),
      ).toBeVisible();
      for (const result of report.discovery.results.filter(
        (item) => item.status === 'discovered',
      )) {
        const fact = discovery
          .getByRole('listitem')
          .filter({ has: page.getByRole('heading', { level: 4, name: result.label }) });
        await expect(fact).toContainText('Found');
        await expect(fact).toContainText(
          `Revealed at turn ${result.revealedAtTurn} by your question`,
        );
        await expect(fact).toContainText('What the customer had held back');
        if (result.revealingQuestion) await expect(fact).toContainText(result.revealingQuestion);
      }
    });

    await test.step('discovery: each missed fact shows the question that would have found it', async () => {
      const discovery = page.getByRole('region', { name: 'Discovery review' });
      for (const result of report.discovery.results.filter((item) => item.status === 'missed')) {
        const fact = discovery
          .getByRole('listitem')
          .filter({ has: page.getByRole('heading', { level: 4, name: result.label }) });
        await expect(fact).toContainText('Missed');
        await expect(fact).toContainText('A question worth asking');
        await expect(fact).toContainText(result.betterQuestion);
        // The library says the same thing about this fact.
        expect(library.facts.find((item) => item.id === result.factId)?.betterQuestion).toBe(
          result.betterQuestion,
        );
        await expect(fact).not.toContainText('What the customer had held back');
      }
    });

    await test.step('next practice names one skill and links to a scenario to practise it', async () => {
      const next = page.getByRole('region', { name: 'Next practice' });
      await expect(next).toContainText(DIMENSIONS[report.nextPractice.dimension].label);
      const link = next.getByRole('link', { name: 'Practise this next' });
      await expect(link).toHaveAttribute('href', /^\/scenarios/);
    });
  });

  test("following a quote's turn link focuses and marks the turn and the words, and Back returns to where it came from", async ({
    page,
  }) => {
    const well = page.getByRole('region', { name: 'What went well' });
    const link = well.getByRole('link', { name: /^See turn \d+ in the transcript$/ }).first();
    const quote = (await well.getByRole('blockquote').first().innerText())
      .replace(/^[“"]|[”"]$/g, '')
      .trim();
    const turnNumber = /#turn-(\d+)$/.exec((await link.getAttribute('href')) ?? '')?.[1];
    expect(turnNumber).toBeDefined();
    const turn = page.locator(`#turn-${turnNumber}`);

    await link.scrollIntoViewIfNeeded();
    await link.click();

    await test.step('the turn is focused, marked as cited, and the quoted words are highlighted', async () => {
      await expect(turn).toBeFocused();
      await expect(turn).toBeInViewport();
      await expect(turn.getByText('Cited', { exact: true })).toBeVisible();
      await expect(turn.locator('mark')).toContainText(quote.slice(0, 20));
    });

    await test.step('Back to the section returns focus to the very link that was followed', async () => {
      const back = page.getByRole('button', { name: 'Back to What went well' });
      await expect(back).toBeVisible();
      await back.click();
      await expect(link).toBeFocused();
      await expect(back).toHaveCount(0);
      await expect(turn.getByText('Cited', { exact: true })).toHaveCount(0);
    });
  });

  test('the transcript can be searched and filtered, and every turn is there', async ({ page }) => {
    const transcript = page.getByRole('region', { name: 'Transcript' });
    // Each turn is a direct child of the list; the markers inside a turn are lists of their own.
    const turns = transcript.getByRole('list', { name: 'Transcript' }).locator(':scope > li');
    const total = call.turns.length;
    await expect(transcript.getByRole('radio', { name: `All turns (${total})` })).toBeChecked();
    await expect(turns).toHaveCount(total);

    await test.step('searching marks the matches and steps through them', async () => {
      const search = transcript.getByRole('searchbox', { name: 'Find in transcript' });
      await search.fill('ownership');
      await expect(transcript.getByRole('status').filter({ hasText: /match/ })).toContainText(
        /\d+ match/,
      );
      await search.press('Enter');
      await expect(transcript.getByRole('status').filter({ hasText: /Match 1 of/ })).toBeVisible();
      await expect(transcript.locator('mark').first()).toBeVisible();
      await transcript.getByRole('button', { name: 'Next match' }).click();
      await expect(transcript.getByRole('status').filter({ hasText: /Match \d of/ })).toBeVisible();
      await search.fill('zzzz-no-such-words');
      await expect(transcript.getByRole('status').filter({ hasText: 'No matches' })).toBeVisible();
      await expect(transcript.getByRole('button', { name: 'Next match' })).toBeDisabled();
      await search.fill('');
    });

    await test.step("the filters show only the turns they name, each with the customer's reply", async () => {
      await transcript.getByRole('radio', { name: /^Discovered facts \(\d+\)$/ }).check();
      await expect(transcript.getByText(/^Showing \d+ turns? /)).toBeVisible();
      expect(await turns.count()).toBeLessThan(total);
      await transcript.getByRole('radio', { name: /^Unexpected turn \(\d+\)$/ }).check();
      await expect(transcript.getByText(/^Showing \d+ turns? /)).toBeVisible();
      await transcript.getByRole('radio', { name: /^All turns/ }).check();
      await expect(turns).toHaveCount(total);
    });
  });

  test('printing shows the transcript and the report and hides the navigation', async ({
    page,
  }) => {
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByRole('navigation', { name: 'On this page' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Print report' }).first()).toBeHidden();
    await expect(page.getByText('Firefly: coaching report')).toBeVisible();
    await expect(page.getByText('Practice coaching, not performance assessment.')).toBeVisible();
    const transcript = page.getByRole('region', { name: 'Transcript' });
    await expect(
      transcript.getByRole('list', { name: 'Transcript' }).locator(':scope > li').first(),
    ).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Coaching report' })).toBeVisible();
    await page.emulateMedia({ media: 'screen' });
    await expect(page.getByRole('navigation', { name: 'On this page' })).toBeVisible();
  });

  test('reloading the page shows the same report', async ({ page }) => {
    const summary = page.getByRole('region', { name: 'Overall coaching summary' });
    const before = await summary.innerText();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Coaching report' })).toBeVisible();
    expect(await page.getByRole('region', { name: 'Overall coaching summary' }).innerText()).toBe(
      before,
    );
  });
});

test.describe("a spoken call's report", () => {
  test('marks the spoken turns and warns that speech recognition can mishear words', async ({
    page,
    api,
  }) => {
    const call = await api.completedCall({
      lines: [
        'Hello, thanks for calling. My name is Sam. What is happening?',
        'Can you read me exactly what the sign-in message says?',
      ],
      inputMode: 'voice',
    });
    await openReport(page, call.id);
    await expect(
      page.getByText(
        'Speech recognition can mishear words, so check the quotes against what you said.',
      ),
    ).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Transcript' }).getByText('Spoken').first(),
    ).toBeVisible();
  });
});

test.describe('a report that could not be built', () => {
  test('shows what happened and keeps the transcript, and Retry evaluation produces the report', async ({
    page,
    api,
  }) => {
    const call = await api.createCall({ scenarioId: 'locked-out-after-password-reset' });
    await api.play(call.id, [
      'Hello, my name is Sam. What is happening?',
      'Can you read me exactly what the sign-in message says?',
    ]);
    await page.goto(`/calls/${call.id}?input=text`);
    const screen = callScreen(page);
    // The call already has messages in it, so the pre-flight offers to resume it.
    await page.getByRole('button', { name: 'Resume as a text-only call' }).click();
    await expect(screen.turns).toHaveCount(5);

    await api.failNext('evaluator', 1);
    await screen.endCall.click();
    await screen.endDialog.getByRole('button', { name: 'End and review' }).click();

    await test.step('the report page says it could not be finished, and that nothing was lost', async () => {
      await expect(page).toHaveURL(new RegExp(`/sessions/${call.id}/report$`));
      await expect(page.getByText('The coaching report could not be finished')).toBeVisible({
        timeout: 20_000,
      });
      await expect(
        page.getByText('Your call and its transcript are saved. Nothing was lost.'),
      ).toBeVisible();
      await expect(page.getByRole('heading', { level: 1, name: 'Coaching report' })).toBeVisible();
      // The page shows the server's own plain sentence about what failed. The test hook ends that
      // sentence with "(simulated failure)"; nothing else raw may appear.
      await expectNoRawFailureText(page, { except: ['the mock failure message'] });
    });

    await test.step('the transcript is still readable, without a report', async () => {
      const transcript = page.getByRole('region', { name: 'Transcript' });
      await expect(transcript).toContainText('Hello, my name is Sam. What is happening?');
      await expect(transcript).toContainText(
        'Can you read me exactly what the sign-in message says?',
      );
      await expect(page.getByRole('region', { name: 'Scores' })).toHaveCount(0);
    });

    await test.step('Retry evaluation produces the report', async () => {
      await page.getByRole('button', { name: 'Retry evaluation' }).click();
      await expect(page.getByRole('region', { name: 'Overall coaching summary' })).toBeVisible({
        timeout: 20_000,
      });
      await expect(
        page.getByRole('table', { name: 'Six coaching skills, each scored from 1 to 5' }),
      ).toBeVisible();
      await expect(page.getByText('The coaching report could not be finished')).toHaveCount(0);
      const saved = await api.session(call.id);
      expect(saved.status).toBe('completed');
    });
  });
});

test.describe('after a report', () => {
  test('Try another scenario and Repeat this scenario lead on, and a second call completes to a second report', async ({
    page,
    api,
  }) => {
    const first = await api.completedCall({
      scenarioId: SHARED_WORKSPACE,
      overrides: { difficulty: 'challenge', startingTemperature: 'angry' },
      lines: WORKSPACE_CALL.slice(0, 3),
    });
    await openReport(page, first.id);
    const config = first.scenario.config;

    await test.step('Try another scenario opens the workspace', async () => {
      await page
        .getByRole('region', { name: 'Actions' })
        .getByRole('link', { name: 'Try another scenario' })
        .click();
      await expect(
        page.getByRole('heading', { level: 1, name: 'Choose a scenario' }),
      ).toBeVisible();
      await page.goBack();
      await expect(page.getByRole('heading', { level: 1, name: 'Coaching report' })).toBeVisible();
    });

    await test.step('Repeat this scenario opens the brief with the same setup', async () => {
      await page
        .getByRole('region', { name: 'Actions' })
        .getByRole('link', { name: 'Repeat this scenario' })
        .click();
      await expect(page.getByRole('heading', { level: 1, name: 'Call brief' })).toBeVisible();
      const query = new URL(page.url()).searchParams;
      expect(new URL(page.url()).pathname).toBe(`/scenarios/${SHARED_WORKSPACE}/brief`);
      expect(query.get('difficulty')).toBe(config.difficulty);
      expect(query.get('impact')).toBe(config.impact);
      expect(query.get('temperature')).toBe(config.startingTemperature);
      expect(query.get('proficiency')).toBe(config.proficiency);
      expect(query.get('style')).toBe(config.style);
      expect(query.get('stage')).toBe(config.callStage);
      expect(query.get('hints')).toBe(config.mode === 'guided' ? 'on' : 'off');
      const caseFile = page.getByRole('region', { name: 'Support case' });
      await expect(caseFile).toContainText(
        config.difficulty === 'challenge' ? 'Challenge' : 'Standard',
      );
    });

    await test.step('a second call from that brief completes to a second report', async () => {
      await page.getByRole('button', { name: 'Start a text-only call' }).click();
      const screen = callScreen(page);
      await screen.preflight.textOnly.click();
      await screen.reply.waitFor();
      const second = new URL(page.url()).pathname.split('/')[2];
      expect(second).not.toBe(first.id);
      await sendTyped(screen, 'Hello, my name is Sam. Can you tell me what is happening?');
      await expect(screen.turns).toHaveCount(3);
      await sendTyped(screen, 'When did it last work, and did anything change before it stopped?');
      await expect(screen.turns).toHaveCount(5);
      await screen.endCall.click();
      await screen.endDialog.getByRole('button', { name: 'End and review' }).click();
      await expect(page).toHaveURL(new RegExp(`/sessions/${second}/report$`));
      await expect(page.getByRole('region', { name: 'Overall coaching summary' })).toBeVisible({
        timeout: 20_000,
      });
      expect(second).not.toBe(first.id);
    });

    await test.step('both calls are in Recent calls, each with its report', async () => {
      await page.goto('/scenarios');
      await page.getByRole('button', { name: 'Recent calls' }).click();
      const dialog = page.getByRole('dialog', { name: 'Recent calls' });
      await expect(dialog.getByRole('listitem')).toHaveCount(2);
      await expect(dialog.getByRole('link', { name: /^View report/ })).toHaveCount(2);
    });
  });
});
