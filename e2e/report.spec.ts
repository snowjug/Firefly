import type { Page } from '@playwright/test';
import type { SessionDTO } from '../shared/domain/api.ts';
import type { CoachingReport } from '../shared/domain/report.ts';
import { CALL_STAGE_LABELS, CARE_LABELS, DIMENSIONS } from '../shared/domain/vocab.ts';
import { expect, test } from './support/fixtures.ts';
import { GOOD_CALL, PARTIAL_CALL, SHORT_CALL } from './support/api.ts';
import { callScreen, endCallAndOpenReport, sendTyped } from './support/call-screen.ts';
import { expectNoRawFailureText } from './support/raw-text.ts';
import { libraryScenario } from './support/scenario-library.ts';

// The coaching report, evidence navigation, a failed evaluation that is retried, and the way on to
// another call. The calls are made through the API (the call itself is tested in the other specs) and
// the report is read in a real browser. The report is the demo-mode rules evaluator's: its wording is
// Firefly's own, so these tests check structure and agreement with the report data, never that the
// coaching is good.

test.describe.configure({ timeout: 90_000 });

const DEFENDER = 'defender-invoices-quarantined';
const MARCUS = 'outlook-shared-mailbox-missing';

// Three of the five hidden facts are asked for (why the invoices were held, what changed, which
// suppliers); "who is away on the IT side" and "a way round it" are not. The customer asks for a
// manager in the fourth reply, and the call deals with it.
const DEFENDER_CALL = [
  'Hello, my name is Sam. Can you tell me what is happening?',
  "I'm sorry, I can hear how stressful the payment run is. What does the message in quarantine say exactly about why they were held?",
  'When did it last work, and did anything change on your side just before it stopped?',
  'Who else is affected, and is it the same suppliers each time?',
  'What have you already tried so far?',
  "I'll take ownership of this and I will check the quarantine policy and call you back by two o'clock with an update. Let me summarise: your genuine supplier invoices are held as suspected phishing, it started about a week ago, and the payment run is tomorrow. Is there anything else I can help with?",
];

const formatScore = (score: number) => (Number.isInteger(score) ? String(score) : score.toFixed(1));
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const region = (page: Page, name: string) => page.getByRole('region', { name, exact: true });
const seeTurn = /^See turn \d+ in the transcript$/;
/** The report says "unexpected turn" where the evaluator's own wording says "curveball". */
const plain = (text: string) =>
  text
    .replace(/\bcurveballs\b/gi, 'unexpected turns')
    .replace(/\bcurveball\b/gi, 'unexpected turn');

/** The row of one skill in the Scores list, with what opens inside it. */
const scoreItem = (page: Page, label: string) =>
  region(page, 'Scores')
    .getByRole('listitem')
    .filter({ has: page.getByRole('button', { name: new RegExp(`^${escapeRegExp(label)}`) }) });

async function openReport(page: Page, sessionId: string) {
  await page.goto(`/sessions/${sessionId}/report`);
  await expect(page.getByRole('heading', { level: 1, name: 'Coaching report' })).toBeVisible();
}

test.describe('the coaching report', () => {
  let call: SessionDTO;
  let report: CoachingReport;

  test.beforeEach(async ({ api, page }) => {
    call = await api.completedCall({
      scenarioId: DEFENDER,
      overrides: { curveballs: ['ask-manager'] },
      mode: 'guided',
      lines: DEFENDER_CALL,
    });
    expect(call.status).toBe('completed');
    report = call.report as CoachingReport;
    await openReport(page, call.id);
  });

  test('opens on the call in a line, the summary and the overall score, as the report data says', async ({
    page,
  }) => {
    await expect(page).toHaveTitle('Coaching report \u00b7 Firefly');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    const header = page.getByRole('main');
    await expect(header).toContainText(call.scenario.title);
    await expect(header.getByText('Training only')).toBeVisible();
    await expect(header.getByText('Demo mode', { exact: true })).toBeVisible();
    await expect(header.getByRole('button', { name: 'Print report' }).first()).toBeVisible();
    await expect(header.getByRole('button', { name: 'Review transcript' }).first()).toBeVisible();
    if (call.scenario.product) await expect(header).toContainText(call.scenario.product.name);

    const summary = region(page, 'Summary');
    expect(report.summary.overallScore).not.toBeNull();
    await expect(summary).toContainText(
      `${formatScore(report.summary.overallScore as number)} of 5`,
    );
    await expect(summary).toContainText('Average of the six skills');
    await expect(summary).toContainText(
      'Automatic practice feedback, not a performance assessment.',
    );
    await expect(summary.getByRole('link', { name: 'About this report' })).toBeVisible();
  });

  test('shows six score rows, each with its score, its word and how many quotes back it, and opens and closes each in place', async ({
    page,
  }) => {
    const scores = region(page, 'Scores');
    expect(report.dimensions).toHaveLength(6);
    await expect(scores.getByRole('listitem')).toHaveCount(6);
    // The old table of six skills is gone: the rows are the scores.
    await expect(page.getByRole('table', { name: /Six coaching skills/ })).toHaveCount(0);

    for (const dimension of report.dimensions) {
      const label = DIMENSIONS[dimension.id].label;
      const row = scores.getByRole('button', {
        name: new RegExp(`^${escapeRegExp(label)}\\s+${dimension.score} of 5`),
      });
      await expect(row).toBeVisible();
      await expect(row).toContainText(dimension.label);
      await expect(row).toContainText(
        dimension.evidence.length === 0
          ? 'No quotes'
          : `${dimension.evidence.length} ${dimension.evidence.length === 1 ? 'quote' : 'quotes'}`,
      );
      await expect(row).toContainText('Expand details');
      await expect(row).toHaveAttribute('aria-expanded', 'false');
    }

    await test.step('a row opens in place: why, the evidence, what to improve and how firm it is', async () => {
      const first = report.dimensions[0]!;
      const label = DIMENSIONS[first.id].label;
      const row = scores.getByRole('button', { name: new RegExp(`^${escapeRegExp(label)}`) });
      await row.click();
      await expect(row).toHaveAttribute('aria-expanded', 'true');
      await expect(row).toContainText('Hide details');
      const item = scoreItem(page, label);
      for (const heading of [
        'Why this score',
        'Evidence from your call',
        'To improve',
        'Evidence confidence',
      ]) {
        await expect(item.getByText(heading, { exact: true })).toBeVisible();
      }
      await row.click();
      await expect(row).toHaveAttribute('aria-expanded', 'false');
      await expect(item.getByText('Why this score')).toBeHidden();
    });

    await test.step('Expand all opens every row, and Collapse all closes them', async () => {
      await scores.getByRole('button', { name: 'Expand all' }).click();
      await expect(scores.getByRole('button', { name: /Hide details$/ })).toHaveCount(6);
      await scores.getByRole('button', { name: 'Collapse all' }).click();
      await expect(scores.getByRole('button', { name: /Expand details$/ })).toHaveCount(6);
    });
  });

  test('says it is practice feedback and not an assessment; the explanation of the report is closed until it is wanted', async ({
    page,
  }) => {
    const about = page.getByRole('region', { name: 'About this report' });
    const toggle = about.locator('summary');
    await expect(toggle).toBeVisible();
    await expect(about.locator('details')).not.toHaveAttribute('open', '');
    await expect(about.getByText('CBCF mapping is not applied')).toBeHidden();
    await toggle.click();
    await expect(about.locator('details')).toHaveAttribute('open', '');
    await expect(about).toContainText('Automatic practice feedback, not an assessment.');
    await expect(about).toContainText('CBCF mapping is not applied');
    await expect(about).toContainText('How scores work');
    await expect(about).toContainText('The six skills');
    await expect(about).toContainText(
      "The customer was played byFirefly's built-in rules engine (demo mode), not a language model",
    );
    await expect(about).toContainText(
      "Coaching written byFirefly's built-in rules evaluator (demo mode)",
    );
    await expect(
      about.getByRole('link', { name: 'How Firefly uses AI and speech' }),
    ).toHaveAttribute('href', '/responsible-ai');
    // None of the words the product never uses.
    const text = await page.locator('main').innerText();
    expect(text).not.toMatch(/\b(leaderboard|badge|streak|level up|achievement)s?\b/i);
  });

  test('has the four CARE principles, each with a level and the behaviours behind it', async ({
    page,
  }) => {
    const care = region(page, 'CARE summary');
    expect(report.care).toBeDefined();
    const principles = report.care!;
    expect(principles).toHaveLength(4);
    await expect(care.getByRole('heading', { level: 3 })).toHaveText(
      principles.map((principle) => CARE_LABELS[principle.id]),
    );
    for (const principle of principles) {
      const item = care.getByRole('listitem').filter({
        has: page.getByRole('heading', { level: 3, name: CARE_LABELS[principle.id] }),
      });
      await expect(item).toContainText(principle.summary);
      const toggle = item.getByRole('button', {
        name: `Show behaviours for ${CARE_LABELS[principle.id]}`,
      });
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await toggle.click();
      await expect(
        item.getByRole('button', { name: new RegExp('^Hide behaviours') }),
      ).toBeVisible();
      for (const behaviour of principle.behaviours) {
        await expect(item).toContainText(behaviour.label);
      }
    }
  });

  test("shows the customer's mood through the call as a chart, six milestones, a list of what moved it and a table", async ({
    page,
  }) => {
    const journey = region(page, 'Customer journey');
    await expect(
      journey.getByRole('group', { name: /^Customer temperature through the call/ }),
    ).toBeVisible();
    await expect(journey.getByRole('list', { name: 'Chart key' })).toBeVisible();
    await expect(journey).toContainText(/The customer started \w+ and ended \w+\./);

    await test.step('the six milestones, in call order, each reached or not, in words', async () => {
      const milestones = report.journey.milestones!;
      expect(milestones).toHaveLength(6);
      await expect(
        journey.getByRole('heading', { level: 3, name: 'Call milestones' }),
      ).toBeVisible();
      const items = journey
        .getByRole('heading', { level: 3, name: 'Call milestones' })
        .locator('xpath=following-sibling::ol[1]')
        .getByRole('listitem');
      await expect(items).toHaveCount(6);
      for (const [index, milestone] of milestones.entries()) {
        const word = {
          reached: 'Reached',
          'not-reached': 'Not reached',
          'not-applicable': 'Not applicable',
        }[milestone.status];
        await expect(items.nth(index)).toContainText(plain(milestone.label));
        await expect(items.nth(index)).toContainText(word);
        if (milestone.status === 'reached' && milestone.turnIndex !== null) {
          await expect(items.nth(index).getByRole('link', { name: seeTurn })).toBeVisible();
        }
      }
    });

    await test.step('what moved the customer, with the turns that did', async () => {
      await expect(
        journey.getByRole('heading', { level: 3, name: 'What moved the customer' }),
      ).toBeVisible();
      expect(await journey.getByRole('link', { name: seeTurn }).count()).toBeGreaterThanOrEqual(2);
    });

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

    await test.step('the report speaks of an unexpected turn and never of a curveball', async () => {
      await expect(page.getByRole('main')).not.toContainText(/curveball/i);
    });
  });

  test('has strengths, improvements and better wording, each with the words and the turn they happened at', async ({
    page,
  }) => {
    await test.step('strengths: a title, why it helped, and the quote with its turn', async () => {
      const strengths = region(page, 'Strengths');
      expect(report.strengths.length).toBeGreaterThan(0);
      await expect(strengths.getByRole('heading', { level: 3 }).first()).toBeVisible();
      await expect(strengths.getByRole('blockquote').first()).toBeVisible();
      await expect(strengths.getByRole('link', { name: seeTurn }).first()).toBeVisible();
    });

    await test.step('improvements: what happened, or the plain statement that something never did', async () => {
      const improvements = region(page, 'Improvements');
      expect(report.improvements.length).toBeGreaterThan(0);
      await expect(improvements.getByRole('heading', { level: 3 }).first()).toBeVisible();
    });

    await test.step('better wording: the original and the improved, side by side', async () => {
      const wording = region(page, 'Better wording');
      await expect(wording).toBeVisible();
      await expect(wording.getByText('Original').first()).toBeVisible();
      await expect(wording.getByText('Improved').first()).toBeVisible();
      await expect(wording.getByText(/^Why it works:/).first()).toBeVisible();
    });
  });

  test('has the discovery review with found and missed facts, and what to practise next', async ({
    page,
  }) => {
    const library = libraryScenario(DEFENDER);
    const discovery = region(page, 'Discovery');
    const { found, total, missed } = report.discovery;
    expect(found).toBeGreaterThan(0);
    expect(missed).toBeGreaterThan(0);

    await test.step('the total, and the groups', async () => {
      await expect(discovery).toContainText(`${found} of ${total} hidden facts found`);
      await expect(
        discovery.getByRole('heading', { level: 3, name: `Found (${found})` }),
      ).toBeVisible();
      await expect(
        discovery.getByRole('heading', { level: 3, name: `Missed (${missed})` }),
      ).toBeVisible();
    });

    await test.step('each found fact shows where you asked, and opens to the question and what had been held back', async () => {
      for (const result of report.discovery.results.filter(
        (item) => item.status === 'discovered',
      )) {
        const fact = discovery
          .getByRole('listitem')
          .filter({ has: page.getByRole('heading', { level: 4, name: result.label }) });
        await expect(fact).toContainText('You asked');
        await expect(
          fact.getByRole('link', { name: `See turn ${result.revealedAtTurn} in the transcript` }),
        ).toBeVisible();
        await fact.getByRole('button', { name: `Show details for ${result.label}` }).click();
        await expect(fact).toContainText('Your question');
        await expect(fact).toContainText('What the customer held back');
        if (result.revealingQuestion) await expect(fact).toContainText(result.revealingQuestion);
      }
    });

    await test.step('each missed fact shows the question that would have found it', async () => {
      for (const result of report.discovery.results.filter((item) => item.status === 'missed')) {
        const fact = discovery
          .getByRole('listitem')
          .filter({ has: page.getByRole('heading', { level: 4, name: result.label }) });
        await fact.getByRole('button', { name: `Show details for ${result.label}` }).click();
        await expect(fact).toContainText('A question worth asking');
        await expect(fact).toContainText(result.betterQuestion);
        await expect(fact).toContainText('Why it mattered');
        // The library says the same thing about this fact.
        expect(library.facts.find((item) => item.id === result.factId)?.betterQuestion).toBe(
          result.betterQuestion,
        );
        await expect(fact).not.toContainText('What the customer held back');
      }
      await expect(discovery.getByText('Suggested question')).toBeVisible();
    });

    await test.step('next practice names one skill and links to a scenario to practise it', async () => {
      const next = region(page, 'Next practice');
      await expect(next).toContainText(DIMENSIONS[report.nextPractice.dimension].label);
      await expect(
        next.getByRole('link', { name: /^(Practise this scenario|Choose a scenario)$/ }),
      ).toHaveAttribute('href', /^\/scenarios/);
    });
  });

  test("following a quote's turn link focuses and marks the turn and the words, and Back to Strengths returns to where it came from", async ({
    page,
  }) => {
    const strengths = region(page, 'Strengths');
    const link = strengths.getByRole('link', { name: seeTurn }).first();
    const quote = (await strengths.getByRole('blockquote').first().innerText())
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

    await test.step('Back to Strengths returns focus to the very link that was followed', async () => {
      const back = page.getByRole('button', { name: 'Back to Strengths' });
      await expect(back).toBeVisible();
      await back.click();
      await expect(link).toBeFocused();
      await expect(back).toHaveCount(0);
      await expect(turn.getByText('Cited', { exact: true })).toHaveCount(0);
    });
  });

  test('an evidence link from inside a score row returns to that row, which stays open', async ({
    page,
  }) => {
    const scores = region(page, 'Scores');
    const withEvidence = report.dimensions.find((dimension) => dimension.evidence.length > 0)!;
    const label = DIMENSIONS[withEvidence.id].label;
    const row = scores.getByRole('button', { name: new RegExp(`^${escapeRegExp(label)}`) });
    await row.click();
    const item = scoreItem(page, label);
    const link = item.getByRole('link', { name: seeTurn }).first();
    await link.click();
    const turnNumber = /#turn-(\d+)$/.exec((await link.getAttribute('href')) ?? '')?.[1];
    await expect(page.locator(`#turn-${turnNumber}`)).toBeFocused();

    await page.getByRole('button', { name: `Back to ${label}` }).click();
    await expect(link).toBeFocused();
    await expect(row).toHaveAttribute('aria-expanded', 'true');
  });

  test('the transcript can be searched and filtered, and every turn is there', async ({ page }) => {
    const transcript = region(page, 'Transcript');
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

  test('Review transcript lands on the transcript', async ({ page }) => {
    await page.getByRole('button', { name: 'Review transcript' }).first().click();
    await expect(
      region(page, 'Transcript').getByRole('heading', { level: 2, name: 'Transcript' }),
    ).toBeFocused();
    await expect(region(page, 'Transcript')).toBeInViewport();
  });

  test('printing shows the transcript, the explanation and the report, and hides the navigation and the buttons', async ({
    page,
  }) => {
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await expect(page.getByRole('navigation', { name: 'On this page' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Print report' }).first()).toBeHidden();
    await expect(page.getByText('Firefly: coaching report')).toBeVisible();
    await expect(page.getByText(/Practice coaching, not performance assessment\./)).toBeVisible();
    // Folded away on screen, open on paper: the reasons behind each score, and what the report is.
    await expect(page.getByText('Why this score').first()).toBeVisible();
    await expect(
      region(page, 'About this report').getByText('CBCF mapping is not applied'),
    ).toBeVisible();
    const transcript = region(page, 'Transcript');
    await expect(
      transcript.getByRole('list', { name: 'Transcript' }).locator(':scope > li').first(),
    ).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Coaching report' })).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await page.emulateMedia({ media: 'screen' });
    await expect(page.getByRole('navigation', { name: 'On this page' })).toBeVisible();
  });

  test('reloading the page shows the same report', async ({ page }) => {
    const summary = region(page, 'Summary');
    const before = await summary.innerText();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Coaching report' })).toBeVisible();
    expect(await region(page, 'Summary').innerText()).toBe(before);
  });

  test('Delete this call asks first, says what goes, and removes the call', async ({
    page,
    api,
  }) => {
    await region(page, 'Actions').getByRole('button', { name: 'Delete this call' }).click();
    const dialog = page.getByRole('dialog', { name: 'Delete this call?' });
    await expect(dialog).toContainText('removed from this device');
    // Cancel is where the keyboard starts, and nothing is removed.
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    expect((await api.session(call.id)).status).toBe('completed');

    await region(page, 'Actions').getByRole('button', { name: 'Delete this call' }).click();
    await dialog.getByRole('button', { name: 'Delete call' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Scenarios' })).toBeVisible();
    await expect
      .poll(async () => (await page.request.get(`/api/sessions/${call.id}`)).status())
      .toBe(404);
  });
});

test.describe("a spoken call's report", () => {
  test('warns that speech recognition can mishear words, and does not tag the spoken turns', async ({
    page,
    api,
  }) => {
    const call = await api.completedCall({ lines: GOOD_CALL.slice(0, 3), inputMode: 'voice' });
    await openReport(page, call.id);
    const transcript = region(page, 'Transcript');
    await expect(transcript).toContainText(
      'Spoken turns were transcribed automatically and may contain recognition errors.',
    );
    await expect(transcript.getByText('Spoken', { exact: true })).toHaveCount(0);
  });
});

test.describe('a call too short to judge', () => {
  test('says in the summary that the coaching rests on limited evidence, and marks the scores it is firm about', async ({
    page,
    api,
  }) => {
    const call = await api.completedCall({ lines: SHORT_CALL });
    const report = call.report as CoachingReport;
    expect(report.completion.evidence).not.toBe('sufficient');
    await openReport(page, call.id);
    await expect(
      region(page, 'Summary').getByText(report.completion.note ?? /limited evidence/i),
    ).toBeVisible();
    // Skills that could not be judged firmly say so on their rows.
    const limited = report.dimensions.filter((dimension) => dimension.sufficiency !== 'sufficient');
    if (limited.length > 0) {
      await expect(
        region(page, 'Scores')
          .getByText(/(Limited|Not enough) evidence/)
          .first(),
      ).toBeVisible();
    }
  });
});

test.describe('a report that could not be built', () => {
  test('shows what happened and keeps the transcript, and Retry evaluation produces the report', async ({
    page,
    api,
  }) => {
    const call = await api.createCall();
    await api.play(call.id, [
      'Hello, my name is Sam. What is happening?',
      'Which mailbox is it, and what do you see in your list instead?',
    ]);
    await page.goto(`/calls/${call.id}?input=text`);
    const screen = callScreen(page);
    // The call already has messages in it, so the pre-flight offers to resume it.
    await expect(screen.preflight.resumeHeading).toBeVisible();
    await screen.preflight.resumeText.click();
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
      const transcript = region(page, 'Transcript');
      await expect(transcript).toContainText('Hello, my name is Sam. What is happening?');
      await expect(transcript).toContainText(
        'Which mailbox is it, and what do you see in your list instead?',
      );
      await expect(region(page, 'Scores')).toHaveCount(0);
    });

    await test.step('Retry evaluation produces the report', async () => {
      await page.getByRole('button', { name: 'Retry evaluation' }).click();
      await expect(region(page, 'Summary')).toBeVisible({ timeout: 20_000 });
      await expect(region(page, 'Scores').getByRole('listitem')).toHaveCount(6);
      await expect(page.getByText('The coaching report could not be finished')).toHaveCount(0);
      expect((await api.session(call.id)).status).toBe('completed');
    });
  });
});

test.describe('after a report', () => {
  test('Try another call and Repeat scenario lead on, and a second call completes to a second report', async ({
    page,
    api,
  }) => {
    const first = await api.completedCall({
      scenarioId: DEFENDER,
      overrides: { difficulty: 'challenge', startingTemperature: 'angry' },
      lines: DEFENDER_CALL.slice(0, 3),
    });
    await openReport(page, first.id);
    const config = first.scenario.config;

    await test.step('Try another call opens the workspace', async () => {
      await region(page, 'Actions').getByRole('link', { name: 'Try another call' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Scenarios' })).toBeVisible();
      await page.goBack();
      await expect(page.getByRole('heading', { level: 1, name: 'Coaching report' })).toBeVisible();
    });

    await test.step('Repeat scenario opens the brief with the same setup', async () => {
      await region(page, 'Actions').getByRole('link', { name: 'Repeat scenario' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Case brief' })).toBeVisible();
      const query = new URL(page.url()).searchParams;
      expect(new URL(page.url()).pathname).toBe(`/scenarios/${DEFENDER}/brief`);
      expect(query.get('difficulty')).toBe(config.difficulty);
      expect(query.get('impact')).toBe(config.impact);
      expect(query.get('temperature')).toBe(config.startingTemperature);
      expect(query.get('proficiency')).toBe(config.proficiency);
      expect(query.get('style')).toBe(config.style);
      expect(query.get('stage')).toBe(config.callStage);
      expect(query.get('hints')).toBe(config.mode === 'guided' ? 'on' : 'off');
      await expect(region(page, 'Support case')).toContainText(
        CALL_STAGE_LABELS[config.callStage].label,
      );
    });

    await test.step('a second call from that brief completes to a second report', async () => {
      await page.getByRole('button', { name: 'Start a text-only call' }).click();
      const screen = callScreen(page);
      await screen.preflight.startText.click();
      await screen.reply.waitFor();
      const second = new URL(page.url()).pathname.split('/')[2];
      expect(second).not.toBe(first.id);
      await sendTyped(screen, 'Hello, my name is Sam. Can you tell me what is happening?');
      await expect(screen.turns).toHaveCount(3);
      await sendTyped(screen, 'When did it last work, and did anything change before it stopped?');
      await expect(screen.turns).toHaveCount(5);
      expect(await endCallAndOpenReport(page, screen)).toBe(second);
      await expect(region(page, 'Summary')).toBeVisible({ timeout: 20_000 });
    });

    await test.step('there is no list of earlier calls: no history screen, and no way to list them', async () => {
      await page.goto('/scenarios');
      await expect(page.getByRole('button', { name: 'Recent calls' })).toHaveCount(0);
      await expect(page.getByRole('link', { name: /Recent calls|History/i })).toHaveCount(0);
      const listing = await page.request.get('/api/sessions');
      expect([404, 405]).toContain(listing.status());
    });
  });

  test('a call whose scenario has been retired still reports, and "Try another call" still works', async ({
    page,
    api,
    problems,
  }) => {
    // The stored call is rewritten on its way to the page, as a call saved under the old library would
    // read: no product, and a scenario id that no longer exists (also named by the next-practice advice).
    const stored = await api.completedCall({ scenarioId: MARCUS, lines: GOOD_CALL });
    problems.allow({ status: 404, url: '/api/scenarios/' });
    await page.route(new RegExp(`/api/sessions/${stored.id}$`), async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const response = await route.fetch();
      const body = (await response.json()) as { session: SessionDTO };
      const session = body.session;
      session.scenario = {
        ...session.scenario,
        scenarioId: 'locked-out-after-password-reset',
        product: null,
      };
      if (session.report) {
        session.report = {
          ...session.report,
          nextPractice: {
            ...session.report.nextPractice,
            suggestedScenarioId: 'team-cannot-open-shared-workspace',
            suggestedScenarioTitle: 'A scenario that is gone',
          },
        };
      }
      return route.fulfill({ response, json: { session } });
    });
    await openReport(page, stored.id);

    await test.step('the report is complete, with no product to show', async () => {
      await expect(region(page, 'Scores').getByRole('listitem')).toHaveCount(6);
      await expect(page.getByRole('main').getByText('Product', { exact: true })).toHaveCount(0);
    });

    await test.step('Repeat scenario and Practise next fall back to the list, and say why', async () => {
      const actions = region(page, 'Actions');
      await expect(actions.getByRole('link', { name: 'Repeat scenario' })).toHaveAttribute(
        'href',
        '/scenarios',
      );
      await expect(
        actions.getByText(
          'This scenario is no longer available, so Repeat scenario opens the scenario list.',
        ),
      ).toBeVisible();
      await expect(
        region(page, 'Next practice').getByRole('link', { name: 'Choose a scenario' }),
      ).toHaveAttribute('href', '/scenarios');
    });

    await test.step('Try another call opens the scenario workspace', async () => {
      await region(page, 'Actions').getByRole('link', { name: 'Try another call' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Scenarios' })).toBeVisible();
      await expect(
        page
          .getByRole('main')
          .getByRole('status')
          .filter({ hasText: /scenarios$/ }),
      ).toHaveText('16 scenarios');
    });
  });
});

test.describe('a partial call', () => {
  test('lists the facts that were found and the ones that were missed, from what was asked', async ({
    page,
    api,
  }) => {
    const call = await api.completedCall({ scenarioId: MARCUS, lines: PARTIAL_CALL });
    const report = call.report as CoachingReport;
    expect(report.discovery.found).toBe(2);
    expect(report.discovery.missed).toBe(2);
    await openReport(page, call.id);
    const discovery = region(page, 'Discovery');
    await expect(discovery).toContainText('2 of 4 hidden facts found');
    await expect(discovery.getByRole('heading', { level: 3, name: 'Found (2)' })).toBeVisible();
    await expect(discovery.getByRole('heading', { level: 3, name: 'Missed (2)' })).toBeVisible();
  });
});
