import { describe, expect, it } from 'vitest';
import type { PublicScenarioDTO, SessionSummaryDTO } from './api.ts';
import { recommendMission, summariseScenarioPractice } from './recommend.ts';
import type { Difficulty, DimensionId } from './vocab.ts';

function scenario(
  id: string,
  difficulty: Difficulty,
  focus: DimensionId[] = ['clarity'],
  minutes = 10,
): PublicScenarioDTO {
  return {
    id,
    version: 1,
    title: `Scenario ${id}`,
    summary: 's',
    tags: [],
    estimatedMinutes: minutes,
    issueType: 'sign-in-access',
    impact: 'low',
    startingTemperature: 'calm',
    proficiency: 'intermediate',
    style: 'talkative',
    callStage: 'first-contact',
    difficulty,
    persona: { name: 'P', role: 'r', organisation: 'o' },
    brief: { situation: 's', goal: 'g', groundRules: [] },
    expectedDiscoveryAreas: [],
    coachingFocus: focus,
    curveballOptions: [],
    spotlight: false,
    synthetic: true,
  } as PublicScenarioDTO;
}

let n = 0;
function session(
  scenarioId: string,
  difficulty: Difficulty,
  overall: number | null,
  extra: Partial<SessionSummaryDTO> = {},
): SessionSummaryDTO {
  n += 1;
  const stamp = `2026-03-01T09:${String(n).padStart(2, '0')}:00.000Z`;
  return {
    id: `s${n}`,
    scenarioId,
    scenarioTitle: scenarioId,
    difficulty,
    status: 'completed',
    completion: 'completed',
    isSample: false,
    overallScore: overall,
    startedAt: stamp,
    endedAt: stamp,
    ...extra,
  } as SessionSummaryDTO;
}

const progress = (focus: DimensionId | null, average: number | null = 2.4) => ({
  focus,
  dimensionTrends: focus
    ? [{ dimension: focus, points: [], average, latest: average, change: 'steady' as const }]
    : [],
});

describe('summariseScenarioPractice', () => {
  it('tracks completed, in-progress and untouched scenarios, ignoring samples', () => {
    const map = summariseScenarioPractice([
      session('a', 'starter', 3),
      session('a', 'starter', 4.5),
      session('b', 'starter', null, { status: 'active', completion: null, endedAt: null }),
      session('c', 'starter', 5, { isSample: true }),
    ]);
    expect(map.get('a')).toMatchObject({
      state: 'practised',
      completed: 2,
      best: 4.5,
      latest: 4.5,
    });
    expect(map.get('b')?.state).toBe('in-progress');
    expect(map.has('c')).toBe(false);
  });
});

describe('recommendMission', () => {
  const scenarios = [
    scenario('easy-short', 'starter', ['clarity'], 7),
    scenario('easy-long', 'starter', ['clarity'], 9),
    scenario('mid-discovery', 'standard', ['scoping-discovery']),
    scenario('mid-closing', 'standard', ['closing']),
    scenario('hard', 'challenge', ['empathy-deescalation']),
  ];

  it('returns null without scenarios', () => {
    expect(recommendMission({ scenarios: [], sessions: [], progress: null })).toBeNull();
  });

  it('suggests a short Starter call to someone with no completed practice', () => {
    const rec = recommendMission({ scenarios, sessions: [], progress: null });
    expect(rec?.kind).toBe('first-call');
    expect(rec?.scenario.id).toBe('easy-short');
  });

  it('points a first-timer elsewhere when the short one is already running', () => {
    const rec = recommendMission({
      scenarios,
      sessions: [session('easy-short', 'starter', null, { status: 'active', completion: null })],
      progress: null,
    });
    expect(rec?.scenario.id).toBe('easy-long');
  });

  it('aims at the weakest skill and says so with the evidence', () => {
    const rec = recommendMission({
      scenarios,
      sessions: [session('easy-short', 'starter', 3.2)],
      progress: progress('scoping-discovery', 2.4),
    });
    expect(rec?.kind).toBe('build-skill');
    expect(rec?.scenario.id).toBe('mid-discovery');
    expect(rec?.dimension).toBe('scoping-discovery');
    expect(rec?.reason).toContain('Scoping & Discovery');
    expect(rec?.reason).toContain('2.4');
  });

  it('steps up after strong recent calls', () => {
    const rec = recommendMission({
      scenarios,
      sessions: [session('easy-short', 'starter', 4.4), session('easy-long', 'starter', 4.2)],
      progress: progress(null),
    });
    expect(rec?.kind).toBe('step-up');
    expect(rec?.difficulty).toBe('standard');
    expect(rec?.reason).toContain('4.3');
  });

  it('eases back after a run of hard calls, without blame', () => {
    const rec = recommendMission({
      scenarios,
      sessions: [
        session('mid-closing', 'standard', 2.1),
        session('mid-discovery', 'standard', 2.3),
      ],
      progress: progress(null),
    });
    expect(rec?.kind).toBe('ease-back');
    expect(rec?.difficulty).toBe('starter');
    expect(rec?.reason).not.toMatch(/fail|poor|bad/i);
  });

  it('suggests something new before repeating a scenario', () => {
    const rec = recommendMission({
      scenarios,
      sessions: [session('easy-short', 'starter', 3.2)],
      progress: progress(null),
    });
    expect(rec?.scenario.id).not.toBe('easy-short');
  });

  it('offers a revisit when everything has been tried', () => {
    const all = scenarios.map((s) => session(s.id, s.difficulty, 3.4));
    const rec = recommendMission({ scenarios, sessions: all, progress: progress(null) });
    expect(rec?.kind).toBe('revisit');
    expect(rec?.reason).toContain('3.4');
  });

  it('never counts sample calls as practice', () => {
    const rec = recommendMission({
      scenarios,
      sessions: [session('easy-short', 'starter', 5, { isSample: true })],
      progress: null,
    });
    expect(rec?.kind).toBe('first-call');
  });
});
