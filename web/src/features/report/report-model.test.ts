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
  suggestedQuestion,
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

describe('discoveryGroups', () => {
  it('groups the facts as found, partly found and missed, leaving none out and none reordered', () => {
    const { discovery } = CALLS.strong.report;
    const groups = discoveryGroups(discovery);
    expect(groups.map((g) => g.title)).toEqual(['Found', 'Partly found', 'Missed']);
    expect(groups.flatMap((g) => g.results)).toHaveLength(discovery.total);
    for (const group of groups) {
      expect(group.results).toEqual(discovery.results.filter((r) => r.status === group.status));
    }
  });

  it('leaves out a group with nothing in it', () => {
    expect(discoveryGroups(CALLS.curveball.report.discovery).map((g) => g.title)).toEqual([
      'Found',
      'Missed',
    ]);
    expect(discoveryGroups(CALLS.weak.report.discovery).map((g) => g.title)).toEqual(['Missed']);
  });
});

describe('suggestedQuestion', () => {
  it('is the question for the most important fact that was not found in full', () => {
    // A critical fact was missed and a helpful one was only partly found: the critical one wins.
    expect(suggestedQuestion(CALLS.strong.report.discovery)?.factId).toBe('organiser-licence');
  });

  it('prefers a missed fact to a partly found one of the same importance, and keeps report order after that', () => {
    const base = CALLS.strong.report.discovery.results;
    const critical = base.find((r) => r.factId === 'storage-changed');
    if (!critical) throw new Error('fixture changed');
    const results = [
      { ...critical, factId: 'a', status: 'partial' as const, betterQuestion: 'A?' },
      { ...critical, factId: 'b', status: 'missed' as const, betterQuestion: 'B?' },
      { ...critical, factId: 'c', status: 'missed' as const, betterQuestion: 'C?' },
    ];
    const discovery = { ...CALLS.strong.report.discovery, results };
    expect(suggestedQuestion(discovery)?.factId).toBe('b');
  });

  it('is null when every fact was found, or none has a question', () => {
    const found = CALLS.strong.report.discovery.results.filter((r) => r.status === 'discovered');
    expect(suggestedQuestion({ ...CALLS.strong.report.discovery, results: found })).toBeNull();
    const blank = CALLS.weak.report.discovery.results.map((r) => ({ ...r, betterQuestion: ' ' }));
    expect(suggestedQuestion({ ...CALLS.weak.report.discovery, results: blank })).toBeNull();
    expect(
      suggestedQuestion({ results: [], found: 0, partial: 0, missed: 0, total: 0 }),
    ).toBeNull();
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

  it('keeps the reason on the row to its first words, ending cleanly', () => {
    const long = 'The trainee did a very good job of this part of the call, and '.repeat(8);
    const report: CoachingReport = {
      ...CALLS.strong.report,
      dimensions: CALLS.strong.report.dimensions.map((d, i) =>
        i === 0 ? { ...d, rationale: `${long}Done.` } : d,
      ),
    };
    const [first] = skillRows(report, lookup('strong'));
    expect(wordCount(first?.preview ?? '')).toBeLessThanOrEqual(ROW_REASON_WORDS);
    expect(first?.preview).not.toBe(first?.dimension.rationale);
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
