import { describe, expect, it } from 'vitest';
import { CoachingReportSchema, MILESTONE_IDS, type CoachingReport } from './report.ts';
import { CARE_BEHAVIOURS, DIMENSION_IDS, scoreLabel } from './vocab.ts';

// The report contract: what a saved report must carry, and what an older one may leave out.

const dimension = (id: (typeof DIMENSION_IDS)[number]) => ({
  id,
  score: 3,
  label: scoreLabel(3),
  rationale: 'The call showed the behaviour in part.',
  evidence: [{ turnIndex: 2, quote: 'Hello, this is Sam from support.' }],
  sufficiency: 'sufficient' as const,
  guidance: 'Do it earlier and more often.',
});

function version1(): Record<string, unknown> {
  return {
    version: 1,
    generatedAt: '2026-11-21T10:00:00.000Z',
    evaluator: { kind: 'rules', name: 'rules', version: '1.0.0', providerLabel: 'Rules' },
    completion: { status: 'completed', traineeTurns: 6, evidence: 'sufficient', note: null },
    summary: { overall: 'A steady call.', overallScore: 3, coachingFocus: ['clarity'] },
    dimensions: DIMENSION_IDS.map(dimension),
    strengths: [],
    improvements: [],
    discovery: { results: [], found: 0, partial: 0, missed: 0, total: 0 },
    journey: { points: [], start: 20, end: 20, peak: 20, lowest: 20 },
    curveball: null,
    nextPractice: {
      dimension: 'clarity',
      recommendation: 'Practise plain wording.',
      suggestedDifficulty: 'starter',
      suggestedScenarioId: null,
      suggestedScenarioTitle: null,
    },
    trainingNote: 'Practice only.',
  };
}

const principle = (
  id: (typeof CARE_BEHAVIOURS)[number],
  status: 'shown' | 'not-shown' = 'shown',
) => ({
  id,
  label: id,
  level: 'developing',
  summary: 'Some of it showed.',
  behaviours: [
    {
      id: `${id}.example`,
      principle: id,
      label: 'An example behaviour',
      status,
      evidence: status === 'shown' ? [{ turnIndex: 2, quote: 'Hello, this is Sam.' }] : [],
      note: null,
    },
  ],
});

const milestones = MILESTONE_IDS.map((id) => ({
  id,
  label: id,
  status: 'not-reached',
  turnIndex: null,
  quote: null,
}));

function version2(): Record<string, unknown> {
  const report = version1();
  report.version = 2;
  report.care = CARE_BEHAVIOURS.map((id) => principle(id));
  report.cbcf = {
    status: 'awaiting-authoritative-source',
    mappingVersion: '0.1.0-pending',
    note: 'CBCF mapping is not applied: awaiting authoritative source confirmation.',
  };
  (report.journey as Record<string, unknown>).milestones = milestones;
  return report;
}

const parses = (report: unknown) => CoachingReportSchema.safeParse(report).success;

describe('the coaching report', () => {
  it('still reads a report saved before CARE was read from the call', () => {
    expect(parses(version1())).toBe(true);
    const read = CoachingReportSchema.parse(version1()) as CoachingReport;
    expect(read.care).toBeUndefined();
    expect(read.journey.milestones).toBeUndefined();
  });

  it('reads a complete version 2 report', () => {
    expect(parses(version2())).toBe(true);
  });

  it('requires CARE, the CBCF status and the milestones in a version 2 report', () => {
    for (const key of ['care', 'cbcf']) {
      const report = version2();
      delete report[key];
      expect(parses(report), key).toBe(false);
    }
    const report = version2();
    delete (report.journey as Record<string, unknown>).milestones;
    expect(parses(report)).toBe(false);
  });

  it('refuses a CARE principle that appears twice, or a behaviour under another principle', () => {
    const twice = version2();
    twice.care = [...CARE_BEHAVIOURS.slice(0, 3), CARE_BEHAVIOURS[0]].map((id) => principle(id));
    expect(parses(twice)).toBe(false);

    const misplaced = version2();
    const care = misplaced.care as ReturnType<typeof principle>[];
    (care[0] as { behaviours: { principle: string }[] }).behaviours[0]!.principle = 'accountable';
    expect(parses(misplaced)).toBe(false);
  });

  it('refuses to call a behaviour shown without a quote from the call', () => {
    const report = version2();
    const care = report.care as ReturnType<typeof principle>[];
    (care[1] as { behaviours: { evidence: unknown[] }[] }).behaviours[0]!.evidence = [];
    expect(parses(report)).toBe(false);
    // Saying a behaviour was not shown needs no quote.
    const notShown = version2();
    (notShown.care as unknown[])[1] = principle('accountable', 'not-shown');
    expect(parses(notShown)).toBe(true);
  });

  it('wants the six milestones once each, in call order', () => {
    const report = version2();
    (report.journey as Record<string, unknown>).milestones = [...milestones].reverse();
    expect(parses(report)).toBe(false);
    (report.journey as Record<string, unknown>).milestones = milestones.slice(0, 5);
    expect(parses(report)).toBe(false);
  });

  it('only ever carries a CBCF status that says the mapping is not applied', () => {
    const report = version2();
    (report.cbcf as Record<string, unknown>).status = 'confirmed';
    expect(parses(report)).toBe(false);
  });
});
