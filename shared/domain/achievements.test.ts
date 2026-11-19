import { describe, expect, it } from 'vitest';
import { deriveAchievements } from './achievements.ts';
import type { CoachingReport } from './report.ts';
import { DIMENSION_IDS, type DimensionId } from './vocab.ts';

type Overrides = {
  scores?: Partial<Record<DimensionId, number>>;
  evidence?: Partial<Record<DimensionId, { turnIndex: number; quote: string }[]>>;
  sufficiency?: 'sufficient' | 'limited' | 'insufficient';
  completion?: 'completed' | 'ended-early';
  overallEvidence?: 'sufficient' | 'limited' | 'insufficient';
  points?: { turnIndex: number; temperature: number; delta: number; quote: string | null }[];
  discovery?: Partial<CoachingReport['discovery']['results'][number]>[];
  curveball?: CoachingReport['curveball'];
};

function report(o: Overrides = {}): CoachingReport {
  return {
    version: 1,
    generatedAt: '2026-02-01T10:00:00.000Z',
    evaluator: { kind: 'rules', name: 'test', version: '1', providerLabel: 'test' },
    completion: {
      status: o.completion ?? 'completed',
      traineeTurns: 6,
      evidence: o.overallEvidence ?? 'sufficient',
      note: null,
    },
    summary: { overall: 'ok', overallScore: 3, coachingFocus: [] },
    dimensions: DIMENSION_IDS.map((id) => ({
      id,
      score: o.scores?.[id] ?? 3,
      label: 'Developing' as const,
      rationale: 'r',
      evidence: o.evidence?.[id] ?? [{ turnIndex: 2, quote: `quote for ${id}` }],
      sufficiency: o.sufficiency ?? 'sufficient',
      guidance: 'g',
    })),
    strengths: [],
    improvements: [],
    discovery: {
      results: (o.discovery ?? []).map((d, i) => ({
        factId: `f${i}`,
        label: 'a fact',
        importance: 'critical' as const,
        status: 'discovered' as const,
        revealedAtTurn: 4,
        revealingQuestion: 'When did it start?',
        whatWasHidden: 'x',
        betterQuestion: 'y',
        consequence: 'z',
        ...d,
      })),
      found: 0,
      partial: 0,
      missed: 0,
      total: 0,
    },
    journey: {
      points: (o.points ?? []).map((p, i, all) => ({
        turnIndex: p.turnIndex,
        temperature: p.temperature,
        band: 'calm',
        kind:
          i === 0
            ? ('start' as const)
            : i === all.length - 1
              ? ('end' as const)
              : ('turn' as const),
        delta: p.delta,
        reason: null,
        quote: p.quote,
      })),
      start: 0,
      end: 0,
      peak: 0,
      lowest: 0,
    },
    curveball: o.curveball ?? null,
    nextPractice: {
      dimension: 'clarity',
      recommendation: 'r',
      suggestedDifficulty: 'standard',
      suggestedScenarioId: null,
      suggestedScenarioTitle: null,
    },
    trainingNote: 'n',
  };
}

const ids = (
  r: CoachingReport,
  proficiency: 'novice' | 'intermediate' | 'expert' = 'intermediate',
) => deriveAchievements(r, { proficiency }).map((a) => a.id);

describe('deriveAchievements', () => {
  it('awards nothing for an ordinary call', () => {
    expect(ids(report())).toEqual([]);
  });

  it('awards nothing when the call ended early or the evidence is insufficient', () => {
    const strong = { scores: { closing: 5, 'ownership-next-steps': 5 } as const };
    expect(ids(report({ ...strong, completion: 'ended-early' }))).toEqual([]);
    expect(ids(report({ ...strong, overallEvidence: 'insufficient' }))).toEqual([]);
  });

  it('needs sufficient evidence on the dimension itself', () => {
    const r = report({ scores: { closing: 5 }, sufficiency: 'limited' });
    expect(ids(r)).toEqual([]);
  });

  it('awards Found the Signal only for a critical fact opened by a real question', () => {
    expect(ids(report({ discovery: [{}] }))).toEqual(['found-the-signal']);
    expect(ids(report({ discovery: [{ importance: 'helpful' }] }))).toEqual([]);
    expect(ids(report({ discovery: [{ status: 'partial' }] }))).toEqual([]);
    expect(ids(report({ discovery: [{ revealingQuestion: null }] }))).toEqual([]);
    const earned = deriveAchievements(report({ discovery: [{}] }), { proficiency: 'expert' })[0];
    expect(earned?.proof).toMatchObject({ turnIndex: 4, quote: 'When did it start?' });
  });

  it('awards Steady the Call for a real recovery, pointing at the moment it cooled', () => {
    const recovered = report({
      points: [
        { turnIndex: 0, temperature: 40, delta: 0, quote: null },
        { turnIndex: 2, temperature: 78, delta: 38, quote: null },
        { turnIndex: 4, temperature: 52, delta: -26, quote: 'I can hear how stressful this is.' },
        { turnIndex: 6, temperature: 30, delta: -22, quote: 'I will call you at nine.' },
      ],
    });
    const earned = deriveAchievements(recovered, { proficiency: 'intermediate' });
    expect(earned.map((a) => a.id)).toEqual(['steady-the-call']);
    expect(earned[0]?.proof.quote).toBe('I can hear how stressful this is.');
    expect(earned[0]?.proof.turnIndex).toBe(4);
  });

  it('does not award Steady the Call for a call that never got tense or never cooled', () => {
    const mild = report({
      points: [
        { turnIndex: 0, temperature: 10, delta: 0, quote: null },
        { turnIndex: 2, temperature: 30, delta: 20, quote: null },
        { turnIndex: 4, temperature: 5, delta: -25, quote: 'quote' },
      ],
    });
    expect(ids(mild)).toEqual([]);
    const stayedHot = report({
      points: [
        { turnIndex: 0, temperature: 40, delta: 0, quote: null },
        { turnIndex: 2, temperature: 80, delta: 40, quote: null },
        { turnIndex: 4, temperature: 70, delta: -10, quote: 'quote' },
      ],
    });
    expect(ids(stayedHot)).toEqual([]);
    const peakAtTheEnd = report({
      points: [
        { turnIndex: 0, temperature: 40, delta: 0, quote: null },
        { turnIndex: 2, temperature: 90, delta: 50, quote: null },
      ],
    });
    expect(ids(peakAtTheEnd)).toEqual([]);
  });

  it('awards the dimension achievements from the score and a quoted turn', () => {
    const r = report({ scores: { 'ownership-next-steps': 5, closing: 4, clarity: 4 } });
    expect(ids(r)).toEqual(['clear-ownership', 'complete-the-loop']);
    expect(ids(report({ scores: { 'ownership-next-steps': 4 } }))).toEqual([]);
  });

  it('awards Plain Language only when the customer was new to the technology', () => {
    const r = report({ scores: { clarity: 4 } });
    expect(ids(r, 'novice')).toEqual(['plain-language']);
    expect(ids(r, 'expert')).toEqual([]);
  });

  it('never awards a dimension achievement without a quote to point at', () => {
    const r = report({ scores: { closing: 5 }, evidence: { closing: [] } });
    expect(ids(r)).toEqual([]);
  });

  it('awards Handled the Turn only for a resolved curveball', () => {
    const base = { type: 'ask-manager' as const, firedAtTurn: 5, assessment: 'a' };
    expect(ids(report({ curveball: { ...base, status: 'resolved' } }))).toEqual([
      'handled-the-turn',
    ]);
    expect(ids(report({ curveball: { ...base, status: 'unresolved' } }))).toEqual([]);
    expect(ids(report({ curveball: { ...base, status: 'active' } }))).toEqual([]);
  });
});
