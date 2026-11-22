import type { Locator, Page } from '@playwright/test';
import type { SessionDTO } from '../shared/domain/api.ts';
import type { CoachingReport } from '../shared/domain/report.ts';
import { CALL_STAGE_LABELS, CARE_LABELS, DIMENSIONS } from '../shared/domain/vocab.ts';
import { expectAccessible, overflow, clippedText, structureProblems } from './support/a11y.ts';
import { expect, test } from './support/fixtures.ts';
import { GOOD_CALL, PARTIAL_CALL, SHORT_CALL } from './support/api.ts';
import { callScreen, endCallAndOpenReport, sendTyped } from './support/call-screen.ts';
import { expectNoRawFailureText } from './support/raw-text.ts';
import { libraryScenario } from './support/scenario-library.ts';

// The coaching report: the call in a block, the call journey and the agreement between it and the
// transcript, the scores, the CARE review, the customer's experience, the discovery review, the
// evidence behind every quote, a failed evaluation that is retried, and the way on to another call.
// The calls are made through the API (the call itself is tested in the other specs) and the report is
// read in a real browser. The report is the demo-mode rules evaluator's: its wording is Firefly's own,
// so these tests check structure and agreement with the report data, never that the coaching is good.
// The printed page is in report-print.spec.ts.

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
const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/** The row of one skill in the Scores list, with what opens inside it. */
const scoreItem = (page: Page, label: string) =>
  region(page, 'Scores')
    .getByRole('listitem')
    .filter({ has: page.getByRole('button', { name: new RegExp(`^${escapeRegExp(label)}`) }) });

async function openReport(page: Page, sessionId: string) {
  await page.goto(`/sessions/${sessionId}/report`);
  await expect(page.getByRole('heading', { level: 1, name: 'Coaching report' })).toBeVisible();
}

/** The turn number at the end of a moment's name on the timeline: "Greeting, Turn 2". */
const turnOfMoment = async (tab: Locator): Promise<number> => {
  const name = (await tab.textContent()) ?? '';
  return Number(/Turn (\d+)$/.exec(name.trim())?.[1]);
};

/**
 * A turn that a link led to ends up (once the gentle scroll and its corrections are done) clear of
 * the sticky bars above it and of the Back control below it, and in the upper part of the window,
 * about a third of the way down, rather than at the very edge or lower than the middle.
 */
async function expectLanded(turn: Locator) {
  await expect
    .poll(
      () =>
        turn.evaluate((element) => {
          const box = element.getBoundingClientRect();
          const bottomOfSticky = (selector: string) => {
            const bar = document.querySelector(selector);
            return bar && getComputedStyle(bar).position === 'sticky'
              ? bar.getBoundingClientRect().bottom
              : 0;
          };
          const back = document.querySelector('.rp-back__button')?.getBoundingClientRect();
          return {
            clearOfBars: box.top >= Math.max(bottomOfSticky('header'), bottomOfSticky('.rp-tools')),
            upperPart: box.top <= window.innerHeight * 0.45,
            clearOfBack: !back || box.bottom <= back.top,
          };
        }),
      { message: 'the turn settles clear of the bars and of the Back control', timeout: 10_000 },
    )
    .toEqual({ clearOfBars: true, upperPart: true, clearOfBack: true });
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

  test('opens on the call in one block: the product, the scenario, how it went, the summary and the first actions', async ({
    page,
  }) => {
    await expect(page).toHaveTitle('Coaching report \u00b7 Firefly');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    const main = page.getByRole('main');
    await expect(main).toContainText(call.scenario.title);
    await expect(main.getByText('Training only')).toBeVisible();
    await expect(main.getByText('Demo mode', { exact: true })).toBeVisible();
    if (call.scenario.product) await expect(main).toContainText(call.scenario.product.name);

    await test.step('the facts of the call: stage, date, duration and how the customer felt', async () => {
      const facts = page.locator('.rp-exec__facts');
      await expect(facts.locator('dt')).toHaveText(['Stage', 'Date', 'Duration', 'Customer']);
      await expect(facts).toContainText(CALL_STAGE_LABELS[call.scenario.config.callStage].label);
      await expect(facts).toContainText(/\w+\s*to\s*\w+/);
    });

    await test.step('the first actions are in the block', async () => {
      const block = page.locator('.rp-exec');
      await expect(block.getByRole('link', { name: 'Try another call' })).toBeVisible();
      await expect(block.getByRole('button', { name: 'Review full transcript' })).toBeVisible();
      await expect(block.getByRole('button', { name: 'Print report' })).toBeVisible();
    });

    const summary = region(page, 'Summary');
    expect(report.summary.overallScore).not.toBeNull();
    await expect(summary).toContainText(
      `Practice signal ${formatScore(report.summary.overallScore as number)} of 5`,
    );
    await expect(summary).toContainText('the average of six skills');
    await expect(summary).toContainText(
      'Automatic practice feedback, not a performance assessment.',
    );
    await expect(summary.getByRole('link', { name: 'About this report' })).toBeVisible();

    await test.step('the summary is kept to 45 words, with the rest a click away', async () => {
      const text = await summary.locator('[data-budget="summary"]').innerText();
      expect(words(text)).toBeLessThanOrEqual(45);
    });
  });

  test('lists the parts of the report in order, as named regions, with the same places in the navigation', async ({
    page,
  }) => {
    const labels = [
      'Summary',
      'Call journey',
      'Scores',
      'CARE review',
      'Customer experience',
      'Discovery review',
      'Strengths',
      'Improvement opportunities',
      'Next practice',
      'Actions',
      'Transcript',
      'About this report',
    ];
    for (const label of labels) await expect(region(page, label)).toHaveCount(1);
    const order = await page
      .getByRole('main')
      .getByRole('region')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label') ?? ''));
    expect(order.length).toBeGreaterThanOrEqual(labels.length - 1);

    const nav = page.getByRole('navigation', { name: 'On this page' });
    await expect(nav.getByRole('link')).toHaveText(labels);
    await nav.getByRole('link', { name: 'Discovery review' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Discovery review' })).toBeFocused();
  });

  // The journey is a rail only when every moment fits one row (at 1440 that is eleven), and a list
  // down the page otherwise. The call above has a curveball, which makes twelve moments, so it gets the
  // list (tested below); the rail is tested with a call of nine.
  test.describe('the call journey as a rail', () => {
    test.beforeEach(async ({ api, page }) => {
      call = await api.completedCall({ lines: PARTIAL_CALL });
      await openReport(page, call.id);
    });

    test('is a rail of the moments of the call, in order, with the exact turn behind the chosen one', async ({
      page,
    }) => {
      const journey = region(page, 'Call journey');
      const rail = journey.getByRole('tablist', { name: 'Moments in the call' });
      const tabs = rail.getByRole('tab');
      expect(await tabs.count()).toBeGreaterThanOrEqual(5);
      await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
      await expect(journey.getByRole('tabpanel')).toContainText(/Turn \d+/);

      await test.step('each moment says which turn it was, or that it was not seen, in words', async () => {
        for (const text of await tabs.allTextContents()) {
          expect(text).toMatch(/, (Turn \d+|After turn \d+|Not reached|Insufficient evidence)$/);
        }
      });

      await test.step('choosing a moment shows its turn, with the turns around it, and does not change them', async () => {
        const last = tabs.filter({ hasText: /Turn \d+$/ }).last();
        await last.click();
        await expect(last).toHaveAttribute('aria-selected', 'true');
        const panel = journey.getByRole('tabpanel');
        const turn = await turnOfMoment(last);
        const said = call.turns.find((t) => t.index === turn);
        expect(said).toBeDefined();
        await expect(panel).toContainText(`Turn ${turn}`);
        await expect(panel.locator('.rp-ev__turn--current')).toContainText(
          (said?.text ?? '').slice(0, 30),
        );
        await expect(panel.getByRole('button', { name: 'Open in transcript' })).toBeVisible();
      });
    });

    test('moves with the arrow keys, Home and End, and has one tab stop for the rail', async ({
      page,
    }) => {
      const journey = region(page, 'Call journey');
      const tabs = journey.getByRole('tablist', { name: 'Moments in the call' }).getByRole('tab');
      const count = await tabs.count();
      await tabs.first().focus();
      await page.keyboard.press('ArrowRight');
      await expect(tabs.nth(1)).toBeFocused();
      await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
      await page.keyboard.press('End');
      await expect(tabs.nth(count - 1)).toBeFocused();
      await page.keyboard.press('ArrowRight');
      await expect(tabs.first()).toBeFocused();
      await page.keyboard.press('Home');
      await expect(tabs.first()).toBeFocused();
      expect(await tabs.evaluateAll((nodes) => nodes.filter((n) => n.tabIndex === 0).length)).toBe(
        1,
      );
      // Tab leaves the rail for the exact turn, which is a stop of its own.
      await page.keyboard.press('Tab');
      await expect(journey.getByRole('tabpanel')).toBeFocused();
    });

    test('agrees with the transcript both ways: a moment marks its turn, and a turn selects the nearest moment', async ({
      page,
    }) => {
      const journey = region(page, 'Call journey');
      const transcript = region(page, 'Transcript');
      const tabs = journey.getByRole('tablist', { name: 'Moments in the call' }).getByRole('tab');
      const seen = tabs.filter({ hasText: /Turn \d+$/ });

      await test.step('choosing a moment marks its turn in the transcript, and names the moment there', async () => {
        const choice = seen.nth(Math.min(2, (await seen.count()) - 1));
        await choice.click();
        const turn = await turnOfMoment(choice);
        const marked = page.locator('.rp-turn--marked');
        await expect(marked).toHaveCount(1);
        await expect(marked).toHaveAttribute('id', `turn-${turn}`);
        await expect(marked).toContainText('On the call journey:');
        await expect(marked.getByRole('link', { name: 'Show on the call journey' })).toBeVisible();
      });

      await test.step('choosing a turn in the transcript selects the nearest moment', async () => {
        const numbers = (await seen.allTextContents()).map((text) =>
          Number(/Turn (\d+)$/.exec(text.trim())?.[1]),
        );
        const target = call.turns
          .map((t) => t.index)
          .find((index) => !numbers.includes(index) && index > Math.min(...numbers) + 1);
        expect(target).toBeDefined();
        const row = transcript.locator(`#turn-${target}`);
        await row.scrollIntoViewIfNeeded();
        await row.getByRole('button', { name: new RegExp(`^Turn ${target}`) }).click();
        await expect(row).toHaveClass(/rp-turn--marked/);
        // The nearest moment on the timeline, the earlier one when two are as near.
        const nearest = numbers.reduce((best, n) =>
          Math.abs(n - (target as number)) < Math.abs(best - (target as number)) ? n : best,
        );
        const selected = tabs.and(page.locator('[aria-selected="true"]'));
        await expect(selected).toHaveCount(1);
        expect(await turnOfMoment(selected)).toBe(nearest);
      });

      await test.step('choosing the marked turn again takes the mark off', async () => {
        const marked = page.locator('.rp-turn--marked');
        await marked.getByRole('button', { name: /^Turn \d+/ }).click();
        await expect(page.locator('.rp-turn--marked')).toHaveCount(0);
      });
    });

    test('"Open in transcript" goes to the turn and "Back to Call journey" returns to the button', async ({
      page,
    }) => {
      const journey = region(page, 'Call journey');
      const open = journey.getByRole('button', { name: 'Open in transcript' });
      await open.click();
      const marked = await page.evaluate(() => document.activeElement?.id);
      expect(marked).toMatch(/^turn-\d+$/);
      await expectLanded(page.locator(`#${marked}`));
      const back = page.getByRole('button', { name: 'Back to Call journey' });
      await expect(back).toBeVisible();
      await back.click();
      await expect(open).toBeFocused();
    });
  });

  test.describe('the call journey as a list', () => {
    // Twelve moments are more than one row holds: the same moments are a list down the page, each of
    // which opens in place, one at a time.
    const momentsOf = (page: Page) =>
      region(page, 'Call journey').locator('.rp-tl--narrow .rp-tl__event');

    test('is a list when the rail would not hold every moment, and a moment opens in place with its exact turn', async ({
      page,
    }) => {
      const journey = region(page, 'Call journey');
      await expect(journey.getByRole('tablist')).toHaveCount(0);
      const moments = momentsOf(page);
      expect(await moments.count()).toBeGreaterThanOrEqual(12);
      await expect(moments.first()).toHaveAttribute('aria-expanded', 'false');
      for (const text of await moments.allTextContents()) {
        expect(text).toMatch(/, (Turn \d+|After turn \d+|Not reached|Insufficient evidence)$/);
      }

      const seen = moments.filter({ hasText: /Turn \d+$/ });
      const open = journey.locator('.rp-tl__inline:visible');

      await test.step('choosing a moment opens its turn under it, with the turns around it, and marks the turn in the transcript', async () => {
        const choice = seen.nth(2);
        await choice.click();
        await expect(choice).toHaveAttribute('aria-expanded', 'true');
        const turn = await turnOfMoment(choice);
        const said = call.turns.find((t) => t.index === turn);
        expect(said).toBeDefined();
        await expect(open).toHaveCount(1);
        await expect(open).toContainText(`Turn ${turn}`);
        await expect(open.locator('.rp-ev__turn--current')).toContainText(
          (said?.text ?? '').slice(0, 30),
        );
        await expect(open.getByRole('button', { name: 'Open in transcript' })).toBeVisible();
        await expect(page.locator('.rp-turn--marked')).toHaveAttribute('id', `turn-${turn}`);
      });

      await test.step('one moment is open at a time, and choosing the open one closes it', async () => {
        const first = seen.first();
        await first.click();
        await expect(first).toHaveAttribute('aria-expanded', 'true');
        await expect(seen.nth(2)).toHaveAttribute('aria-expanded', 'false');
        await expect(open).toHaveCount(1);
        await first.click();
        await expect(first).toHaveAttribute('aria-expanded', 'false');
        await expect(open).toHaveCount(0);
      });
    });

    test('moves along the moments with the arrow keys, Home and End, and opening one stays a deliberate act', async ({
      page,
    }) => {
      const moments = momentsOf(page);
      const count = await moments.count();
      await moments.first().focus();
      await page.keyboard.press('ArrowDown');
      await expect(moments.nth(1)).toBeFocused();
      await expect(moments.nth(1)).toHaveAttribute('aria-expanded', 'false');
      await page.keyboard.press('End');
      await expect(moments.nth(count - 1)).toBeFocused();
      await page.keyboard.press('ArrowDown');
      await expect(moments.first()).toBeFocused();
      await page.keyboard.press('ArrowUp');
      await expect(moments.nth(count - 1)).toBeFocused();
      await page.keyboard.press('Home');
      await expect(moments.first()).toBeFocused();
      await expect(moments.first()).toHaveAttribute('aria-expanded', 'false');
      await page.keyboard.press('Enter');
      await expect(moments.first()).toHaveAttribute('aria-expanded', 'true');
    });

    test('"Open in transcript" goes to the turn and "Back to Call journey" returns to the button', async ({
      page,
    }) => {
      const journey = region(page, 'Call journey');
      await momentsOf(page)
        .filter({ hasText: /Turn \d+$/ })
        .first()
        .click();
      const open = journey.getByRole('button', { name: 'Open in transcript' });
      await open.click();
      const marked = await page.evaluate(() => document.activeElement?.id);
      expect(marked).toMatch(/^turn-\d+$/);
      const back = page.getByRole('button', { name: 'Back to Call journey' });
      await expect(back).toBeVisible();
      await back.click();
      await expect(open).toBeFocused();
    });
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
      const item = scoreItem(page, label);
      const firstLook = dimension.evidence.length === 0;
      const word = firstLook ? 'first look' : dimension.label;
      const button = scores.getByRole('button', {
        name: new RegExp(`^${escapeRegExp(label)}\\s+${dimension.score} of 5 ${word}`),
      });
      await expect(item).toBeVisible();
      await expect(item).toContainText(word);
      // A score no quote backs carries the one calm label, never a strong word; one that has quotes counts them.
      await expect(item).toContainText(
        firstLook
          ? 'Limited evidence'
          : `${dimension.evidence.length} ${dimension.evidence.length === 1 ? 'quote' : 'quotes'}`,
      );
      await expect(button).toContainText('Expand details');
      await expect(button).toHaveAttribute('aria-expanded', 'false');
    }

    await test.step('a row opens in place: the evidence and what to improve (and how firm it is, when no quote backs it)', async () => {
      const first = report.dimensions[0]!;
      const label = DIMENSIONS[first.id].label;
      const row = scores.getByRole('button', { name: new RegExp(`^${escapeRegExp(label)}`) });
      await row.click();
      await expect(row).toHaveAttribute('aria-expanded', 'true');
      await expect(row).toContainText('Hide details');
      const item = scoreItem(page, label);
      const headings =
        first.evidence.length === 0
          ? ['Evidence from your call', 'To improve', 'Evidence confidence']
          : ['Evidence from your call', 'To improve'];
      for (const heading of headings) {
        await expect(item.getByText(heading, { exact: true })).toBeVisible();
      }
      await row.click();
      await expect(row).toHaveAttribute('aria-expanded', 'false');
      await expect(item.getByText('To improve')).toBeHidden();
    });

    await test.step('the whole row is the button: a click anywhere on it opens it, and again closes it', async () => {
      const second = report.dimensions[1]!;
      const label = DIMENSIONS[second.id].label;
      const item = scoreItem(page, label);
      // The button is small, but it stretches over the row: this lands on the row, away from it.
      const line = item.locator('.rp-skill__line');
      await line.click({ position: { x: 40, y: 12 } });
      await expect(item.getByRole('button', { name: /details$/ })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      await line.click({ position: { x: 40, y: 12 } });
      await expect(item.getByRole('button', { name: /details$/ })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
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

  test('has the four CARE principles behind one selector, each with what was observed, a quote and a next action', async ({
    page,
  }) => {
    const care = region(page, 'CARE review');
    expect(report.care).toBeDefined();
    const principles = report.care!;
    expect(principles).toHaveLength(4);
    const tabs = care.getByRole('tab');
    await expect(tabs).toHaveCount(4);
    for (const principle of principles) {
      await expect(
        care.getByRole('tab', { name: new RegExp(`^${escapeRegExp(CARE_LABELS[principle.id])}`) }),
      ).toContainText(/\d of \d shown/);
    }

    for (const principle of principles) {
      const name = CARE_LABELS[principle.id];
      await test.step(`${name}: the observation, the evidence and the next action`, async () => {
        await care.getByRole('tab', { name: new RegExp(`^${escapeRegExp(name)}`) }).click();
        const panel = care.getByRole('tabpanel');
        await expect(panel).toHaveCount(1);
        await expect(panel.getByRole('heading', { level: 3, name })).toBeVisible();
        // The first words of the observation are always shown, whatever the budget; the clause about
        // what the case needed ("; it met ...") is the basis beside the level, not part of it.
        const observed = principle.summary.split(/[;.]/)[0] ?? '';
        await expect(panel).toContainText(observed.split(/\s+/).slice(0, 10).join(' '));
        for (const label of ['What was observed', 'Evidence', 'Next action']) {
          await expect(panel.getByText(label, { exact: true })).toBeVisible();
        }
        const toggle = panel.getByRole('button', { name: `Show behaviours for ${name}` });
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await toggle.click();
        for (const behaviour of principle.behaviours) {
          await expect(panel).toContainText(behaviour.label);
        }
        await panel.getByRole('button', { name: `Hide behaviours for ${name}` }).click();
      });
    }

    await test.step('the selector is one tab stop, and the arrow keys, Home and End choose', async () => {
      await tabs.first().focus();
      await page.keyboard.press('ArrowRight');
      await expect(tabs.nth(1)).toBeFocused();
      await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
      await page.keyboard.press('End');
      await expect(tabs.nth(3)).toBeFocused();
      await page.keyboard.press('Home');
      await expect(tabs.first()).toBeFocused();
      expect(await tabs.evaluateAll((nodes) => nodes.filter((n) => n.tabIndex === 0).length)).toBe(
        1,
      );
    });

    await test.step('CBCF is not applied, and the section says so in the report’s own words', async () => {
      expect(report.cbcf).toBeDefined();
      await expect(care).toContainText(report.cbcf!.note);
      await expect(care).not.toContainText(/aligned with CBCF|CBCF aligned/i);
    });
  });

  test("shows the customer's mood through the call as a chart, the important points as rows, the unexpected turn and a table", async ({
    page,
  }) => {
    const experience = region(page, 'Customer experience');
    await expect(
      experience.getByRole('group', { name: /^Customer temperature through the call/ }),
    ).toBeVisible();
    await expect(experience.getByRole('list', { name: 'Chart key' })).toBeVisible();
    await expect(experience).toContainText(/The customer started \w+ and ended \w+\./);

    await test.step('the important points: the start, each turning point and the end, with the customer’s reply', async () => {
      const rows = experience.locator('.rp-moment');
      const points = report.journey.points.filter((point) =>
        ['start', 'turning-point', 'curveball', 'end'].includes(point.kind),
      );
      await expect(rows).toHaveCount(points.length);
      await expect(rows.first()).toContainText('Start of the call');
      await expect(rows.first().getByText('Customer opened with')).toBeVisible();
      for (const row of await rows.all()) {
        await expect(row.getByRole('button', { name: /^Show the exact turn for/ })).toBeVisible();
      }
    });

    await test.step('a point opens its exact turn in place, and one point at a time', async () => {
      const rows = experience.locator('.rp-moment');
      const second = rows.nth(1);
      // The button's name changes with its state, so it is found by where it is.
      const open = second.locator('.ff-disclosure__button');
      await open.click();
      await expect(open).toHaveAttribute('aria-expanded', 'true');
      await expect(open).toHaveAccessibleName(/^Hide the exact turn for/);
      await expect(second.locator('.rp-ev')).toBeVisible();
      await expect(page.locator('.rp-turn--marked')).toHaveCount(1);
      await rows.first().locator('.ff-disclosure__button').click();
      await expect(open).toHaveAttribute('aria-expanded', 'false');
    });

    await test.step('choosing a point on the chart shows its turn under the chart', async () => {
      const chart = experience.getByRole('group', { name: /^Customer temperature/ });
      const point = chart.getByRole('button').nth(1);
      await point.focus();
      await page.keyboard.press('Enter');
      await expect(point).toHaveAttribute('aria-pressed', 'true');
      await expect(experience.locator('.rp-journey__panel .rp-ev')).toBeVisible();
      await page.keyboard.press('Enter');
      await expect(experience.locator('.rp-journey__panel')).toHaveCount(0);
    });

    await test.step('the unexpected turn that was set up is reported with its outcome', async () => {
      expect(report.curveball).not.toBeNull();
      await expect(
        experience.getByRole('heading', { level: 3, name: 'Unexpected turn' }),
      ).toBeVisible();
      await expect(experience).toContainText('Asks for a manager');
    });

    await test.step('the same points are there as a table', async () => {
      await experience.getByText('Show as a table').click();
      const table = experience.getByRole('table', {
        name: 'Customer temperature at each point in the call',
      });
      await expect(table).toBeVisible();
      await expect(table.getByRole('row')).toHaveCount(report.journey.points.length + 1);
    });

    await test.step('the report speaks of an unexpected turn and never of a curveball', async () => {
      await expect(page.getByRole('main')).not.toContainText(/curveball/i);
    });
  });

  test('has strengths and improvements with the words and the turn they happened at, and a better wording inside each improvement', async ({
    page,
  }) => {
    await test.step('strengths: a title, why it helped, and the quote with its turn', async () => {
      const strengths = region(page, 'Strengths');
      expect(report.strengths.length).toBeGreaterThan(0);
      await expect(strengths.getByRole('heading', { level: 3 }).first()).toBeVisible();
      await expect(strengths.getByRole('blockquote').first()).toBeVisible();
      await expect(strengths.getByRole('link', { name: seeTurn }).first()).toBeVisible();
      for (const copy of await strengths.locator('[data-budget="strength"]').all()) {
        expect(words(await copy.innerText())).toBeLessThanOrEqual(35);
      }
    });

    const improvements = region(page, 'Improvement opportunities');
    await test.step('improvements: what happened, or the plain statement that something never did', async () => {
      expect(report.improvements.length).toBeGreaterThan(0);
      await expect(improvements.getByRole('heading', { level: 3 }).first()).toBeVisible();
      for (const copy of await improvements.locator('[data-budget="improvement"]').all()) {
        expect(words(await copy.innerText())).toBeLessThanOrEqual(45);
      }
    });

    await test.step('better wording: what was said against what could be said, in a group of its own', async () => {
      const wording = improvements.getByRole('group', { name: 'Better wording' });
      await expect(wording).toHaveCount(report.improvements.length);
      await expect(wording.first().getByText('You said')).toBeVisible();
      await expect(wording.first().getByText('Try', { exact: true })).toBeVisible();
      await expect(wording.first().getByText(/^Wording to try for this call/)).toBeVisible();
      for (const improvement of report.improvements) {
        const spoken = improvements
          .locator('.rp-bw__line--after .rp-bw__text')
          .filter({ hasText: improvement.betterPhrasing.slice(0, 25) });
        await expect(spoken.first()).toBeVisible();
        // Something that never happened has no words to compare: it says so, and marks nothing.
        if (improvement.turnIndex === null) {
          await expect(improvements.getByText('Not said in this call').first()).toBeVisible();
        }
      }
    });
  });

  test('has the discovery review with found and missed facts, and what to practise next', async ({
    page,
  }) => {
    const library = libraryScenario(DEFENDER);
    const discovery = region(page, 'Discovery review');
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

    await test.step('each found fact is one line that opens to the question that found it and what the customer answered', async () => {
      for (const result of report.discovery.results.filter(
        (item) => item.status === 'discovered',
      )) {
        const fact = discovery
          .getByRole('listitem')
          .filter({ has: page.getByRole('heading', { level: 4, name: result.label }) });
        const row = fact.getByRole('button').first();
        await expect(row).toHaveAttribute('aria-expanded', 'false');
        await expect(fact.getByText('You asked')).toBeHidden();
        await row.click();
        await expect(row).toHaveAttribute('aria-expanded', 'true');
        await expect(fact.getByText('You asked')).toBeVisible();
        await expect(fact.getByText('The customer answered')).toBeVisible();
        await expect(fact.getByText('Why it mattered')).toBeVisible();
        await expect(
          fact.getByRole('link', { name: `See turn ${result.revealedAtTurn} in the transcript` }),
        ).toBeVisible();
        if (result.revealingQuestion) await expect(fact).toContainText(result.revealingQuestion);
        await expect(fact).not.toContainText('A question worth asking');
      }
    });

    await test.step('each missed fact says why it mattered and the question worth asking, with what the customer held back behind an expand', async () => {
      for (const result of report.discovery.results.filter((item) => item.status === 'missed')) {
        const fact = discovery
          .getByRole('listitem')
          .filter({ has: page.getByRole('heading', { level: 4, name: result.label }) });
        await expect(fact.getByText('Why it mattered')).toBeVisible();
        await expect(fact.getByText('A question worth asking')).toBeVisible();
        await expect(fact).toContainText(result.betterQuestion);
        // The library says the same thing about this fact.
        expect(library.facts.find((item) => item.id === result.factId)?.betterQuestion).toBe(
          result.betterQuestion,
        );
        const expand = fact.getByRole('button', {
          name: `Show what the customer would have said for ${result.label}`,
        });
        await expect(expand).toHaveAttribute('aria-expanded', 'false');
        await expect(fact.locator('.rp-fact__hidden')).toBeHidden();
        await expand.click();
        await expect(fact.locator('.rp-fact__hidden')).toBeVisible();
      }
      // One callout for a question worth asking, not a second block that says the same thing.
      await expect(discovery.getByText('Suggested question')).toHaveCount(0);
    });

    await test.step('next practice names one skill and links to a scenario to practise it', async () => {
      const next = region(page, 'Next practice');
      await expect(next).toContainText(DIMENSIONS[report.nextPractice.dimension].label);
      await expect(next.getByText('Target skill')).toBeVisible();
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

    await test.step('the turn lands clear of the sticky bars and of the Back control', async () => {
      await expectLanded(turn);
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

  test('Review full transcript lands on the transcript', async ({ page }) => {
    await page.getByRole('button', { name: 'Review full transcript' }).first().click();
    await expect(
      region(page, 'Transcript').getByRole('heading', { level: 2, name: 'Transcript' }),
    ).toBeFocused();
    await expect(region(page, 'Transcript')).toBeInViewport();
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

  test('offers no share or export, because nothing here sends a report anywhere', async ({
    page,
  }) => {
    const actions = region(page, 'Actions');
    await expect(actions.getByRole('link', { name: 'Try another call' })).toBeVisible();
    await expect(actions.getByRole('button', { name: 'Print report' })).toBeVisible();
    await expect(actions.getByRole('link', { name: 'Return home' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /^(share|export|download|email|send)\b/i }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: /^(share|export|download|email|send)\b/i }),
    ).toHaveCount(0);
  });
});

test.describe('how the report arrives', () => {
  test('the score rows come in when the section is reached, and are simply there under reduced motion', async ({
    api,
    page,
  }) => {
    const call = await api.completedCall({ scenarioId: DEFENDER, lines: DEFENDER_CALL });
    const opacities = () =>
      page
        .locator('.rp-skills .rp-skill')
        .evaluateAll((rows) => rows.map((row) => getComputedStyle(row).opacity));

    await test.step('with motion: below the fold they wait, then come in once the section is on screen', async () => {
      await openReport(page, call.id);
      expect((await opacities()).every((value) => value === '0')).toBe(true);
      await region(page, 'Scores').scrollIntoViewIfNeeded();
      await expect.poll(async () => (await opacities()).every((value) => value === '1')).toBe(true);
    });

    await test.step('with reduced motion: there at once, with nothing animating', async () => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openReport(page, call.id);
      expect((await opacities()).every((value) => value === '1')).toBe(true);
      const moving = await page.evaluate(
        () =>
          document.getAnimations().filter((animation) => {
            const target = (animation.effect as KeyframeEffect | null)?.target;
            const lasts = Number(animation.effect?.getComputedTiming().activeDuration) > 50;
            return (
              animation.playState === 'running' &&
              lasts &&
              target instanceof Element &&
              target.closest('.rp-page') !== null
            );
          }).length,
      );
      expect(moving, 'no animation of any length is running on the report').toBe(0);
    });
  });
});

test.describe('a call with a promise in it', () => {
  test('compares the words that were said with a better wording, with the marks as real elements and as words', async ({
    page,
    api,
  }) => {
    const call = await api.completedCall({
      scenarioId: MARCUS,
      lines: [GOOD_CALL[0] as string, 'It will definitely be fixed in 10 minutes.'],
    });
    const report = call.report as CoachingReport;
    const said = report.improvements.find((item) => item.quote !== null);
    expect(said, 'the report has an improvement about words that were said').toBeDefined();
    await openReport(page, call.id);

    const wording = region(page, 'Improvement opportunities')
      .getByRole('group', { name: 'Better wording' })
      .filter({ has: page.locator('del, ins') })
      .first();
    await expect(wording).toBeVisible();
    await expect(wording.getByText('You said')).toBeVisible();
    await expect(wording.getByText('Try', { exact: true })).toBeVisible();
    // What was said is quoted whole, with what was taken out struck through.
    const before = wording.locator('.rp-bw__line--before .rp-bw__text');
    await expect(before).toContainText((said?.quote ?? '').slice(0, 20));
    await expect(wording.locator('del').first()).toBeVisible();
    await expect(wording.locator('ins').first()).toBeVisible();
    // Marked in words too, for a screen reader, and by shape, not by colour alone.
    await expect(wording.locator('del .visually-hidden').first()).toHaveText('Removed: ');
    await expect(wording.locator('ins .visually-hidden').first()).toHaveText('Added: ');
    const lines = await wording
      .locator('del, ins')
      .evaluateAll((marks) => marks.map((mark) => getComputedStyle(mark).textDecorationLine));
    expect(lines.every((line) => /underline|line-through/.test(line))).toBe(true);
    // The better wording is whole, whatever was marked.
    const after = await wording.locator('.rp-bw__line--after .rp-bw__text').innerText();
    expect(
      after
        .replace(/Added:\s*/g, '')
        .replace(/[“”]/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
    ).toBe((said?.betterPhrasing ?? '').replace(/\s+/g, ' ').trim());
  });
});

test.describe('the report in both colour themes', () => {
  test('passes axe in light and in dark, with every part opened', async ({
    api,
    page,
  }, testInfo) => {
    const call = await api.completedCall({
      scenarioId: DEFENDER,
      overrides: { curveballs: ['ask-manager'] },
      lines: DEFENDER_CALL,
    });
    await openReport(page, call.id);
    // The chart arrives in its own chunk: the report is not at rest until it is drawn.
    await expect(
      page.getByRole('group', { name: /^Customer temperature through the call/ }),
    ).toBeVisible();

    const open = async () => {
      await region(page, 'Scores').getByRole('button', { name: 'Expand all' }).click();
      await region(page, 'Customer experience').getByText('Show as a table').click();
      await region(page, 'About this report').locator('summary').click();
      await region(page, 'CARE review')
        .getByRole('button', { name: /^Show behaviours for / })
        .first()
        .click();
      await region(page, 'Discovery review')
        .getByRole('button', { name: /^Show what the customer would have said for / })
        .first()
        .click();
      await region(page, 'Customer experience')
        .getByRole('button', { name: /^Show the exact turn for / })
        .first()
        .click();
    };

    for (const theme of ['light', 'dark'] as const) {
      await test.step(`${theme}: no accessibility violations, and the structure holds`, async () => {
        await page.evaluate(
          (value) => document.documentElement.setAttribute('data-theme', value),
          theme,
        );
        await expectAccessible(page, testInfo, `report, ${theme}`);
        if (theme === 'light') await open();
        await expectAccessible(page, testInfo, `report opened out, ${theme}`);
        expect(await structureProblems(page, { banner: 1, contentinfo: 1 }), theme).toEqual([]);
      });
    }
    await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
  });
});

test.describe('at every width', () => {
  test('fits the window, with every score opened and nothing cut off', async ({ api, page }) => {
    // A call that covers every fact, so the CARE tabs carry their longest counts ("7 of 8 shown").
    const call = await api.completedCall({ lines: GOOD_CALL });
    for (const width of [320, 375, 430, 768, 1024, 1440]) {
      await test.step(`${width} px`, async () => {
        await page.setViewportSize({ width, height: 900 });
        await openReport(page, call.id);
        await expect(
          page.getByRole('group', { name: /^Customer temperature through the call/ }),
        ).toBeVisible();
        await region(page, 'Scores').getByRole('button', { name: 'Expand all' }).click();
        const result = await overflow(page);
        expect(result.scrollWidth, `${width} px: the page scrolls sideways`).toBeLessThanOrEqual(
          result.innerWidth,
        );
        expect(result.offenders, `${width} px: content outside the window`).toEqual([]);
        expect(await clippedText(page), `${width} px: text cut off`).toEqual([]);
      });
    }
  });
});

test.describe('on a phone-sized screen', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the call journey is a list down the page, each moment opens in place, and nothing sticks out', async ({
    api,
    page,
  }, testInfo) => {
    const call = await api.completedCall({
      scenarioId: DEFENDER,
      overrides: { curveballs: ['ask-manager'] },
      lines: DEFENDER_CALL,
    });
    await openReport(page, call.id);
    const journey = region(page, 'Call journey');

    await test.step('a list of moments, none open, each a full-width target', async () => {
      await expect(journey.getByRole('tablist')).toHaveCount(0);
      const rows = journey.locator('.rp-tl__event');
      expect(await rows.count()).toBeGreaterThanOrEqual(5);
      for (const row of await rows.all()) {
        const box = await row.boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
        await expect(row).toHaveAttribute('aria-expanded', 'false');
      }
    });

    await test.step('a moment opens its exact turn right under it, and another closes the first', async () => {
      const rows = journey.locator('.rp-tl__event');
      await rows.first().click();
      await expect(rows.first()).toHaveAttribute('aria-expanded', 'true');
      await expect(journey.locator('.rp-tl__inline:not([hidden]) .rp-ev')).toBeVisible();
      await rows.nth(1).click();
      await expect(rows.first()).toHaveAttribute('aria-expanded', 'false');
      await expect(rows.nth(1)).toHaveAttribute('aria-expanded', 'true');
    });

    await test.step('no part of the page sticks out of the screen, and no label is cut off', async () => {
      await region(page, 'Scores').getByRole('button', { name: 'Expand all' }).click();
      const report = await overflow(page);
      expect(report.offenders).toEqual([]);
      expect(report.scrollWidth).toBeLessThanOrEqual(report.innerWidth + 1);
      expect(await clippedText(page)).toEqual([]);
    });

    await test.step('the page has no accessibility violations', async () => {
      await expectAccessible(page, testInfo, 'report at 390 px');
    });
  });

  test('a turn that a link leads to lands whole above the Back control, however long it is, and Back returns to the link', async ({
    api,
    page,
  }) => {
    const call = await api.completedCall({ scenarioId: DEFENDER, lines: DEFENDER_CALL });
    await openReport(page, call.id);
    // The last turn of the call is its longest: a closing summary, which fills much of a phone's window.
    const link = region(page, 'Strengths').getByRole('link', { name: seeTurn }).first();
    const turn = page.locator(
      `#turn-${/#turn-(\d+)$/.exec((await link.getAttribute('href')) ?? '')?.[1]}`,
    );
    await link.scrollIntoViewIfNeeded();
    await link.click();
    await expect(turn).toBeFocused();
    await expectLanded(turn);
    await page.getByRole('button', { name: 'Back to Strengths' }).click();
    await expect(link).toBeFocused();
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
  test('says in the summary, once, that the call was too short to score with confidence, and marks the scores no quote backs', async ({
    page,
    api,
  }) => {
    const call = await api.completedCall({ lines: SHORT_CALL });
    const report = call.report as CoachingReport;
    expect(report.completion.evidence).not.toBe('sufficient');
    await openReport(page, call.id);
    // The summary says how little the coaching rests on in its own words; the report's note is only
    // added under it when the summary does not say it, so it is not read twice.
    const summary = region(page, 'Summary');
    await expect(summary).toContainText(
      /\blimited evidence\b|\btoo few\b|\bto score with confidence\b/i,
    );
    expect(report.completion.note).toBeTruthy();
    await expect(summary).not.toContainText(report.completion.note as string);
    // Skills that no quote backs say so on their rows, with the one calm label.
    const quoteless = report.dimensions.filter((dimension) => dimension.evidence.length === 0);
    if (quoteless.length > 0) {
      await expect(region(page, 'Scores').getByText('Limited evidence').first()).toBeVisible();
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
      await expect(region(page, 'Call journey')).toHaveCount(0);
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
      await expect(page.locator('.rp-exec__tile')).toHaveCount(0);
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
    const discovery = region(page, 'Discovery review');
    await expect(discovery).toContainText('2 of 4 hidden facts found');
    await expect(discovery.getByRole('heading', { level: 3, name: 'Found (2)' })).toBeVisible();
    await expect(discovery.getByRole('heading', { level: 3, name: 'Missed (2)' })).toBeVisible();
  });
});
