import { describe, expect, it } from 'vitest';
import { CoachingReportSchema } from '#shared/domain/report.ts';
import { DIMENSION_IDS } from '#shared/domain/vocab.ts';
import { mergeModelDraft } from './merge.ts';
import { evaluate, NOW, strongCall, weakCall } from './testing.ts';

// An older call can be evaluated again after its scenario has left the library. The report only
// uses the library to suggest what to practise next, so nothing may depend on the call's own
// scenario still being in it.

const entry = (id: string, coachingFocus: (typeof DIMENSION_IDS)[number][]) => ({
  id,
  title: `Scenario ${id}`,
  difficulty: 'standard' as const,
  coachingFocus,
});

const OTHERS = [
  entry('other-scenario-a', ['scoping-discovery']),
  entry('other-scenario-b', ['clarity']),
  entry('other-scenario-c', ['empathy-deescalation', 'closing']),
];

const META = { name: 'Model', version: 'evaluator-3', providerLabel: 'Test model' };

describe('a call whose scenario has left the library', () => {
  const call = strongCall();
  const retired = { ...call, library: OTHERS };

  it('still produces a valid report, suggesting a scenario that still exists', () => {
    const report = evaluate(retired);
    expect(CoachingReportSchema.safeParse(report).success).toBe(true);
    const id = report.nextPractice.suggestedScenarioId;
    expect(id === null || OTHERS.some((s) => s.id === id)).toBe(true);
    expect(id).not.toBe(call.scenario.scenarioId);
  });

  it('does the same on the model path', () => {
    const draft = {
      summary: 'You opened well. Keep asking one question at a time.',
      dimensions: DIMENSION_IDS.map((id) => ({
        id,
        score: 3,
        rationale: 'Scored from the transcript.',
        evidence: [],
        sufficiency: 'limited' as const,
        guidance: 'Try one thing.',
      })),
      strengths: [],
      improvements: [],
      nextPractice: {
        dimension: 'clarity' as const,
        recommendation: 'Explain it in one plain sentence.',
      },
    };
    const { report } = mergeModelDraft(draft, retired, META, { now: NOW });
    expect(report.version).toBe(2);
    expect(
      OTHERS.some((s) => s.id === report.nextPractice.suggestedScenarioId) ||
        report.nextPractice.suggestedScenarioId === null,
    ).toBe(true);
  });

  it('does not change what was read from the call', () => {
    const inLibrary = evaluate(call);
    const gone = evaluate(retired);
    expect(gone.care).toEqual(inLibrary.care);
    expect(gone.journey).toEqual(inLibrary.journey);
    expect(gone.dimensions).toEqual(inLibrary.dimensions);
    expect(gone.cbcf).toEqual(inLibrary.cbcf);
  });
});

describe('an empty library', () => {
  it('suggests nothing, and nothing throws, for a strong call and a weak one', () => {
    for (const call of [strongCall(), weakCall()]) {
      const report = evaluate({ ...call, library: [] });
      expect(CoachingReportSchema.safeParse(report).success).toBe(true);
      expect(report.nextPractice.suggestedScenarioId).toBeNull();
      expect(report.nextPractice.suggestedScenarioTitle).toBeNull();
      expect(report.nextPractice.recommendation.length).toBeGreaterThan(0);
    }
  });

  it('suggests nothing when no scenario in the library practises the weak area', () => {
    const report = evaluate({ ...weakCall(), library: [entry('practises-nothing', [])] });
    expect(report.nextPractice.suggestedScenarioId).toBeNull();
  });
});
