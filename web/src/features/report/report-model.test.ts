import { describe, expect, it } from 'vitest';
import { CoachingReportSchema, type CoachingReport } from '#shared/domain/report.ts';
import { DIMENSION_IDS } from '#shared/domain/vocab.ts';
import { CALL_NAMES, callFixtures } from './fixtures.ts';
import {
  discoveryGroups,
  lowestSkill,
  orderedDimensions,
  restsOnLimitedEvidence,
} from './report-model.ts';

describe('orderedDimensions', () => {
  it('lists the six skills in rubric order whatever order they arrive in', async () => {
    const { strong } = await callFixtures();
    const shuffled: CoachingReport = {
      ...strong.report,
      dimensions: [...strong.report.dimensions].reverse(),
    };
    expect(orderedDimensions(shuffled).map((d) => d.id)).toEqual([...DIMENSION_IDS]);
  });
});

describe('lowestSkill', () => {
  it('is the lowest-scored skill', async () => {
    const { curveball } = await callFixtures();
    const lowest = lowestSkill(curveball.report);
    const scores = curveball.report.dimensions.map((d) => d.score);
    expect(curveball.report.dimensions.find((d) => d.id === lowest)?.score).toBe(
      Math.min(...scores),
    );
  });

  it('prefers the skill the report recommends practising when several share the lowest score', async () => {
    const { weak } = await callFixtures();
    const lows = weak.report.dimensions.filter((d) => d.score === 1).map((d) => d.id);
    expect(lows.length).toBeGreaterThan(1);
    expect(lowestSkill(weak.report)).toBe(weak.report.nextPractice.dimension);
    const elsewhere: CoachingReport = {
      ...weak.report,
      nextPractice: { ...weak.report.nextPractice, dimension: 'clarity' },
    };
    expect(lowestSkill(elsewhere)).toBe(lows[0]);
  });
});

describe('restsOnLimitedEvidence', () => {
  it('is true for a short call that ended early, false for a thorough one', async () => {
    const { short, strong, long } = await callFixtures();
    expect(restsOnLimitedEvidence(short.report)).toBe(true);
    expect(restsOnLimitedEvidence(strong.report)).toBe(false);
    expect(restsOnLimitedEvidence(long.report)).toBe(false);
  });

  it('is also true when the call was not ended early but the evidence was not sufficient', async () => {
    const { strong } = await callFixtures();
    const thin: CoachingReport = {
      ...strong.report,
      completion: { ...strong.report.completion, evidence: 'limited' },
    };
    expect(restsOnLimitedEvidence(thin)).toBe(true);
  });
});

describe('discoveryGroups', () => {
  it('groups the facts as found, partly found and missed, leaving none out and none reordered', async () => {
    const { strong } = await callFixtures();
    const { discovery } = strong.report;
    const groups = discoveryGroups(discovery);
    expect(groups.map((g) => g.title)).toEqual(['Found', 'Missed']);
    expect(groups.flatMap((g) => g.results)).toHaveLength(discovery.total);
    for (const group of groups) {
      const expected = discovery.results.filter((r) => r.status === group.status);
      expect(group.results).toEqual(expected);
    }
  });

  it('keeps a partly found fact in its own group, between the others', async () => {
    const { strong } = await callFixtures();
    const [first, ...rest] = strong.report.discovery.results;
    if (!first) throw new Error('no facts');
    const discovery = {
      ...strong.report.discovery,
      results: [{ ...first, status: 'partial' as const }, ...rest],
    };
    expect(discoveryGroups(discovery).map((g) => g.title)).toEqual([
      'Found',
      'Partly found',
      'Missed',
    ]);
  });
});

describe('the fixtures', () => {
  it('are reports the real evaluator made, valid against the schema, wrapped as the server sends them', async () => {
    const calls = await callFixtures();
    for (const name of CALL_NAMES) {
      const { session, report } = calls[name];
      expect(CoachingReportSchema.safeParse(report).success, name).toBe(true);
      expect(session.report, name).toEqual(report);
      expect(session.status, name).toBe('completed');
      expect(
        session.turns.some((t) => (t.markers ?? []).length > 0),
        name,
      ).toBe(true);
    }
  });

  it('cover a strong call, a weak call, a short call, an unexpected turn and spoken turns', async () => {
    const { strong, weak, short, curveball, unresolved, voice, long } = await callFixtures();
    expect(strong.report.summary.overallScore).toBeGreaterThanOrEqual(4);
    expect(strong.report.curveball).toBeNull();
    expect(weak.report.summary.overallScore).toBeLessThan(2.5);
    expect(weak.report.strengths).toHaveLength(0);
    expect(weak.report.improvements.some((i) => i.turnIndex === null)).toBe(true);
    expect(weak.report.improvements.some((i) => i.turnIndex !== null)).toBe(true);
    expect(short.report.completion.status).toBe('ended-early');
    expect(short.report.summary.overallScore).toBeNull();
    expect(curveball.report.curveball?.status).toBe('resolved');
    expect(unresolved.report.curveball?.status).toBe('unresolved');
    expect(weak.report.curveball?.status).toBe('active');
    expect(voice.session.turns.some((t) => t.inputMode === 'voice')).toBe(true);
    expect(long.session.turns.length).toBeGreaterThanOrEqual(60);
  });
});
