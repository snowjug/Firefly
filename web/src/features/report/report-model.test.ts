import { describe, expect, it } from 'vitest';
import type { CoachingReport } from '#shared/domain/report.ts';
import { wordCount } from '#shared/domain/scenario.ts';
import { DIMENSION_IDS } from '#shared/domain/vocab.ts';
import { CALLS, asVersion1 } from './fixtures.ts';
import { evidenceTurns, turnLookup } from './evidence-model.ts';
import {
  ROW_REASON_WORDS,
  careCounts,
  discoveryGroups,
  factView,
  orderedDimensions,
  reportSections,
  restsOnLimitedEvidence,
  skillRows,
  summarySays,
  whyFound,
  withoutTrend,
  wordingFor,
} from './report-model.ts';

const lookup = (name: keyof typeof CALLS) => turnLookup(evidenceTurns(CALLS[name].session));

describe('orderedDimensions', () => {
  it('lists the six skills in rubric order whatever order they arrive in', () => {
    const shuffled: CoachingReport = {
      ...CALLS.strong.report,
      dimensions: [...CALLS.strong.report.dimensions].reverse(),
    };
    expect(orderedDimensions(shuffled).map((d) => d.id)).toEqual([...DIMENSION_IDS]);
  });
});

describe('restsOnLimitedEvidence', () => {
  it('is true for a short call that ended early, false for a thorough one', () => {
    expect(restsOnLimitedEvidence(CALLS.short.report)).toBe(true);
    expect(restsOnLimitedEvidence(CALLS.strong.report)).toBe(false);
    expect(restsOnLimitedEvidence(CALLS.long.report)).toBe(false);
  });

  it('is also true when the call was not ended early but the evidence was not sufficient', () => {
    const thin: CoachingReport = {
      ...CALLS.strong.report,
      completion: { ...CALLS.strong.report.completion, evidence: 'limited' },
    };
    expect(restsOnLimitedEvidence(thin)).toBe(true);
  });
});

describe('summarySays', () => {
  it('knows when a summary already says the call rests on limited evidence', () => {
    expect(
      summarySays(
        'You uncovered 1 of the 4 hidden facts, and with only 4 trainee turns this rests on limited evidence.',
      ),
    ).toEqual({ short: true, noScore: false });
  });

  it('knows when a summary says the call was too short to score, so there is no overall score', () => {
    expect(
      summarySays(
        'The call ended after 2 trainee turns, which is too few to score with confidence, so there is no overall score.',
      ),
    ).toEqual({ short: true, noScore: true });
  });

  it('says neither for a summary that does not', () => {
    expect(summarySays('At turn 4, you showed empathy that fitted Marcus’s situation.')).toEqual({
      short: false,
      noScore: false,
    });
  });
});

describe('withoutTrend', () => {
  it('leaves out the closing sentence about how the customer’s hidden mood moved', () => {
    expect(
      withoutTrend(
        'Tying empathy to what Marcus had said lands better. After this, Marcus’s temperature eased a little and trust rose a little.',
      ),
    ).toBe('Tying empathy to what Marcus had said lands better.');
    expect(
      withoutTrend(
        "Saying plainly what you will do tells the customer who owns the next step. After this, Marcus's confidence that someone owns the problem rose a lot.",
      ),
    ).toBe('Saying plainly what you will do tells the customer who owns the next step.');
  });

  it('keeps a text that has no such sentence, and never leaves it empty', () => {
    expect(withoutTrend('A specific time gave Priya something firm.')).toBe(
      'A specific time gave Priya something firm.',
    );
    expect(withoutTrend('After this, the temperature eased.')).toBe(
      'After this, the temperature eased.',
    );
  });
});

describe('discoveryGroups', () => {
  it('groups the facts as found, partly found and missed, leaving none out', () => {
    const { discovery } = CALLS.strong.report;
    const groups = discoveryGroups(discovery);
    expect(groups.map((g) => g.title)).toEqual(['Found', 'Partly found', 'Missed']);
    expect(groups.flatMap((g) => g.results)).toHaveLength(discovery.total);
    for (const group of groups) {
      expect(group.results.map((r) => r.factId).sort()).toEqual(
        discovery.results
          .filter((r) => r.status === group.status)
          .map((r) => r.factId)
          .sort(),
      );
    }
  });

  it('puts the facts that mattered most first, keeping the report’s order among equals', () => {
    const { discovery } = CALLS.strong.report;
    const found = discoveryGroups(discovery).find((g) => g.status === 'discovered');
    // storage-changed (critical), then sales-only and first-missing (important, as the report lists them).
    expect(found?.results.map((r) => r.factId)).toEqual([
      'storage-changed',
      'sales-only',
      'first-missing',
    ]);
    const shuffled = {
      ...discovery,
      results: [...discovery.results].reverse(),
    };
    const foundAgain = discoveryGroups(shuffled).find((g) => g.status === 'discovered');
    expect(foundAgain?.results[0]?.importance).toBe('critical');
    const weights = foundAgain?.results.map((r) =>
      ['helpful', 'important', 'critical'].indexOf(r.importance),
    );
    expect(weights).toEqual([...(weights ?? [])].sort((a, b) => b - a));
  });

  it('leaves out a group with nothing in it', () => {
    expect(discoveryGroups(CALLS.curveball.report.discovery).map((g) => g.title)).toEqual([
      'Found',
      'Missed',
    ]);
    expect(discoveryGroups(CALLS.weak.report.discovery).map((g) => g.title)).toEqual(['Missed']);
  });
});

describe('whyFound', () => {
  const found = CALLS.strong.report.discovery.results.find((r) => r.status === 'discovered');
  if (!found) throw new Error('fixture changed');

  it('keeps the reason and drops the "Found at turn N." the row already says', () => {
    expect(
      whyFound({
        ...found,
        consequence:
          'Found at turn 4. Finding a critical fact like this keeps the call pointed at the real cause.',
      }),
    ).toBe('Finding a critical fact like this keeps the call pointed at the real cause.');
  });

  it('is the text as it came when it does not start that way, or has nothing after it', () => {
    expect(whyFound({ ...found, consequence: 'Scope points at a policy.' })).toBe(
      'Scope points at a policy.',
    );
    expect(whyFound({ ...found, consequence: 'Found at turn 4.' })).toBe('Found at turn 4.');
  });
});

describe('careCounts', () => {
  it('counts the behaviours shown, partly shown and not shown', () => {
    const resourceful = CALLS.strong.report.care?.find((p) => p.id === 'resourceful');
    if (!resourceful) throw new Error('fixture changed');
    expect(careCounts(resourceful)).toEqual({ shown: 2, partly: 1, notShown: 1 });
    const accountable = CALLS.short.report.care?.find((p) => p.id === 'accountable');
    expect(accountable && careCounts(accountable)).toEqual({ shown: 0, partly: 0, notShown: 0 });
  });
});

describe('wordingFor', () => {
  const [gap, said] = CALLS.strong.report.improvements;
  if (!gap || !said) throw new Error('fixture changed');

  it('says nothing was said for a gap, and offers the better wording', () => {
    expect(wordingFor(gap, lookup('strong'))).toEqual({
      original: null,
      state: 'omitted',
      improved: gap.betterPhrasing,
    });
  });

  it('gives what was said when the turn says it', () => {
    const wording = wordingFor(said, lookup('strong'));
    expect(wording?.state).toBe('said');
    expect(wording?.original).toMatch(/what you see in the meeting chat/);
    expect(wording?.improved).toMatch(/confirm your organisation/);
  });

  it('does not give words the turn does not say, or a quote taken from the customer', () => {
    const altered = { ...said, quote: 'I promise the licence will be restored tonight.' };
    expect(wordingFor(altered, lookup('strong'))).toMatchObject({
      original: null,
      state: 'unverified',
    });
    const customerTurn = { ...said, turnIndex: 1 };
    expect(wordingFor(customerTurn, lookup('strong'))?.state).toBe('unverified');
    expect(wordingFor({ ...said, turnIndex: 999 }, lookup('strong'))?.state).toBe('unverified');
  });

  it('is null when there is no better wording to offer', () => {
    expect(wordingFor({ ...said, betterPhrasing: '  ' }, lookup('strong'))).toBeNull();
  });
});

describe('skillRows', () => {
  it('lists the six skills in rubric order with the quotes the transcript confirms', () => {
    const rows = skillRows(CALLS.strong.report, lookup('strong'));
    expect(rows.map((r) => r.dimension.id)).toEqual([...DIMENSION_IDS]);
    for (const row of rows) {
      expect(row.quotes).toEqual(row.dimension.evidence);
    }
  });

  it('leaves out a quote the turn does not say, so a row can end up with none', () => {
    const report: CoachingReport = {
      ...CALLS.strong.report,
      dimensions: CALLS.strong.report.dimensions.map((d, i) =>
        i === 0 ? { ...d, evidence: d.evidence.map((e) => ({ ...e, quote: 'never said it' })) } : d,
      ),
    };
    const [first] = skillRows(report, lookup('strong'));
    expect(first?.quotes).toEqual([]);
  });

  it('keeps the reason on the row to whole sentences that fit, and holds the rest for the details', () => {
    const report: CoachingReport = {
      ...CALLS.strong.report,
      dimensions: CALLS.strong.report.dimensions.map((d, i) =>
        i === 0
          ? {
              ...d,
              rationale:
                'You greeted Marcus and asked an open question. Core topics you asked about: when it started, recent changes, who is affected and what was already tried. One point off: only one thing was asked.',
            }
          : d,
      ),
    };
    const [first] = skillRows(report, lookup('strong'));
    expect(first?.preview).toBe('You greeted Marcus and asked an open question.');
    expect(first?.rest).toBe(
      'Core topics you asked about: when it started, recent changes, who is affected and what was already tried. One point off: only one thing was asked.',
    );
    expect(`${first?.preview} ${first?.rest}`).toBe(first?.dimension.rationale);
  });

  it('shows a first sentence that is longer than the budget whole, never cut in the middle, with no ellipsis', () => {
    const sentence =
      'In your first two turns you greeted Marcus, introduced yourself or offered help, asked an open question and acknowledged how the problem affected them.';
    expect(wordCount(sentence)).toBeGreaterThan(ROW_REASON_WORDS);
    const report: CoachingReport = {
      ...CALLS.strong.report,
      dimensions: CALLS.strong.report.dimensions.map((d, i) =>
        i === 0 ? { ...d, rationale: `${sentence} Keep it up.` } : d,
      ),
    };
    const [first] = skillRows(report, lookup('strong'));
    expect(first?.preview).toBe(sentence);
    expect(first?.rest).toBe('Keep it up.');
    expect(first?.preview).not.toContain('\u2026');
  });

  it('has nothing left for the details when the line says all of it', () => {
    const [first] = skillRows(CALLS.strong.report, lookup('strong'));
    expect(wordCount(first?.preview ?? '')).toBeLessThanOrEqual(ROW_REASON_WORDS);
    expect(first?.rest).toBe('');
  });

  it('calls a row with no quote the transcript backs a first look, and one with a quote not', () => {
    const rows = skillRows(CALLS.strong.report, lookup('strong'));
    expect(rows.every((r) => !r.firstLook)).toBe(true);
    const report: CoachingReport = {
      ...CALLS.strong.report,
      dimensions: CALLS.strong.report.dimensions.map((d, i) =>
        i === 0 ? { ...d, evidence: [] } : d,
      ),
    };
    const [first, second] = skillRows(report, lookup('strong'));
    expect(first?.firstLook).toBe(true);
    expect(second?.firstLook).toBe(false);
  });
});

describe('factView', () => {
  const results = CALLS.strong.report.discovery.results;
  const found = results.find((r) => r.status === 'discovered');
  const missed = results.find((r) => r.status === 'missed');
  if (!found || !missed) throw new Error('fixture changed');

  it('gives the question that found a fact and the customer’s reply, both from the transcript', () => {
    const view = factView(found, lookup('strong'));
    expect(view.question).toBe(found.revealingQuestion);
    expect(view.answer?.role).toBe('customer');
    expect(view.answer?.index).toBe((found.revealedAtTurn ?? 0) + 1);
  });

  it('gives neither for a missed fact', () => {
    expect(factView(missed, lookup('strong'))).toEqual({
      result: missed,
      question: null,
      answer: null,
    });
  });

  it('gives no question the turn does not say, and no answer when the call ended on the question', () => {
    const invented = { ...found, revealingQuestion: 'a question nobody asked' };
    expect(factView(invented, lookup('strong')).question).toBeNull();
    // Cut the call after the trainee's turn 14, so the customer never answered it.
    const { session } = CALLS.strong;
    const cut = turnLookup(evidenceTurns({ ...session, turns: session.turns.slice(0, 14) }));
    expect(cut.get(14)?.role).toBe('trainee');
    expect(cut.has(15)).toBe(false);
    expect(factView({ ...found, revealedAtTurn: 14 }, cut).answer).toBeNull();
  });
});

describe('reportSections', () => {
  const ids = (report: CoachingReport, timeline = true) =>
    reportSections(report, { timeline }).map((s) => s.id);

  it('lists every part, in page order, for a full report', () => {
    expect(ids(CALLS.strong.report)).toEqual([
      'summary',
      'journey',
      'scores',
      'care',
      'experience',
      'discovery',
      'strengths',
      'improvements',
      'next-practice',
      'actions',
      'transcript',
      'about',
    ]);
  });

  it('names the parts as the page does', () => {
    expect(reportSections(CALLS.strong.report).map((s) => s.label)).toEqual([
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
    ]);
  });

  it('leaves out CARE for an older report, and the call journey when no moment can be shown', () => {
    expect(ids(asVersion1(CALLS.strong.report))).not.toContain('care');
    expect(ids(CALLS.legacy.report)).not.toContain('care');
    expect(ids(CALLS.strong.report, false)).not.toContain('journey');
    expect(ids(CALLS.strong.report, false)).toContain('experience');
  });
});
