import { describe, expect, it } from 'vitest';
import type { CoachingReport } from '#shared/domain/report.ts';
import { DIMENSION_IDS } from '#shared/domain/vocab.ts';
import { CALLS, asVersion1 } from './fixtures.ts';
import {
  careCounts,
  discoveryGroups,
  orderedDimensions,
  reportSections,
  restsOnLimitedEvidence,
  suggestedQuestion,
  wordingPairs,
} from './report-model.ts';

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

describe('wordingPairs', () => {
  it('pairs what was said with the better wording, and says nothing was said for a gap', () => {
    const pairs = wordingPairs(CALLS.strong.report);
    expect(pairs).toHaveLength(2);
    expect(pairs[0]?.original).toBeNull();
    expect(pairs[1]?.original).toMatch(/what you see in the meeting chat/);
    expect(pairs[1]?.improved).toMatch(/confirm your organisation/);
  });

  it('is empty for a report with nothing to improve', () => {
    expect(wordingPairs({ ...CALLS.strong.report, improvements: [] })).toEqual([]);
  });
});

describe('reportSections', () => {
  const ids = (report: CoachingReport) => reportSections(report).map((s) => s.id);

  it('lists every part, in page order, for a full report', () => {
    expect(ids(CALLS.strong.report)).toEqual([
      'summary',
      'scores',
      'care',
      'journey',
      'strengths',
      'improvements',
      'wording',
      'discovery',
      'next-practice',
      'actions',
      'transcript',
      'about',
    ]);
  });

  it('leaves out CARE for an older report and better wording when there is nothing to improve', () => {
    expect(ids(asVersion1(CALLS.strong.report))).not.toContain('care');
    expect(ids({ ...CALLS.strong.report, improvements: [] })).not.toContain('wording');
    expect(ids(CALLS.legacy.report)).not.toContain('care');
  });
});
