import { describe, expect, it } from 'vitest';
import type { SessionSummaryDTO } from '#shared/domain/api.ts';
import { recommendMission } from '#shared/domain/recommend.ts';
import { makeSummary } from '../report/report.fixtures.ts';
import { makeScenario } from '../scenario/scenario-fixtures.ts';
import {
  activeCall,
  demandText,
  formatPracticeTime,
  hasPractised,
  heroMissionOf,
  missionFacts,
  pickScenarios,
  practiceStats,
  recentCalls,
} from './dashboard-model.ts';

let counter = 0;
/** A finished, full call unless told otherwise. Each one gets its own id and a later end time. */
function call(overrides: Partial<SessionSummaryDTO> = {}): SessionSummaryDTO {
  counter += 1;
  const minute = String(counter).padStart(2, '0');
  return makeSummary({
    id: `call-${counter}`,
    startedAt: `2026-11-10T10:${minute}:00.000Z`,
    endedAt: `2026-11-10T10:${minute}:30.000Z`,
    ...overrides,
  });
}

describe('practiceStats', () => {
  it('counts only full calls that are not samples, and averages only the scored ones', () => {
    const stats = practiceStats([
      call({ overallScore: 4, durationSeconds: 600 }),
      call({ overallScore: 3, durationSeconds: 300 }),
      call({ overallScore: null, durationSeconds: 60 }),
      call({ isSample: true, overallScore: 5, durationSeconds: 3600 }),
    ]);
    expect(stats.completed).toBe(3);
    expect(stats.averageScore).toBe(3.5);
    expect(stats.practiceSeconds).toBe(960);
  });

  it('keeps time from a call that ended early, but does not count it as a completion', () => {
    const stats = practiceStats([
      call({ completion: 'ended-early', overallScore: 2, durationSeconds: 120 }),
      call({ status: 'active', completion: null, endedAt: null, durationSeconds: null }),
    ]);
    expect(stats.completed).toBe(0);
    expect(stats.averageScore).toBeNull();
    expect(stats.practiceSeconds).toBe(120);
  });

  it('is all zeros and no average when there is nothing yet', () => {
    expect(practiceStats([])).toEqual({ completed: 0, averageScore: null, practiceSeconds: 0 });
  });
});

describe('formatPracticeTime', () => {
  it.each([
    [0, '0 min'],
    [-30, '0 min'],
    [20, '1 min'],
    [45 * 60, '45 min'],
    [60 * 60, '1 h'],
    [90 * 60, '1.5 h'],
    [10 * 3600, '10 h'],
    [11.6 * 3600, '12 h'],
  ])('writes %i seconds as %s', (seconds, text) => {
    expect(formatPracticeTime(seconds)).toBe(text);
  });
});

describe('activeCall and recentCalls', () => {
  it('offers the newest open call, and never a sample', () => {
    const older = call({ id: 'older', status: 'active', completion: null, endedAt: null });
    const newer = call({ id: 'newer', status: 'active', completion: null, endedAt: null });
    const sample = call({ id: 'sample', isSample: true, status: 'active', endedAt: null });
    expect(activeCall([older, sample, newer])?.id).toBe('newer');
    expect(activeCall([call()])).toBeNull();
  });

  it('lists the latest three finished calls, newest first, without samples or open calls', () => {
    const calls = [
      call({ id: 'a' }),
      call({ id: 'b' }),
      call({ id: 'sample', isSample: true }),
      call({ id: 'c' }),
      call({ id: 'open', status: 'active', completion: null, endedAt: null }),
      call({ id: 'd' }),
    ];
    expect(recentCalls(calls).map((s) => s.id)).toEqual(['d', 'c', 'b']);
  });
});

describe('pickScenarios', () => {
  const library = [
    makeScenario({
      id: 'in-1',
      issueType: 'sign-in-access',
      difficulty: 'starter',
      estimatedMinutes: 7,
    }),
    makeScenario({
      id: 'in-2',
      issueType: 'sign-in-access',
      difficulty: 'starter',
      estimatedMinutes: 8,
    }),
    makeScenario({ id: 'slow', issueType: 'slow-performance', difficulty: 'standard' }),
    makeScenario({ id: 'bill', issueType: 'billing-licence', difficulty: 'challenge' }),
    makeScenario({ id: 'outage', issueType: 'service-outage', difficulty: 'challenge' }),
  ];
  const recommend = (sessions: SessionSummaryDTO[]) =>
    recommendMission({ scenarios: library, sessions, progress: null });

  it('puts the recommendation first with its own reason, then adds variety up to four cards', () => {
    const picks = pickScenarios({
      scenarios: library,
      sessions: [],
      recommendation: recommend([]),
    });
    expect(picks).toHaveLength(4);
    expect(picks[0]).toMatchObject({ recommended: true });
    expect(picks[0]?.reason).toMatch(/A gentle place to start/);
    expect(picks.slice(1).every((pick) => !pick.recommended)).toBe(true);
    // Four different scenarios, each a different kind of customer issue.
    expect(new Set(picks.map((p) => p.scenario.id)).size).toBe(4);
    expect(new Set(picks.map((p) => p.scenario.issueType)).size).toBe(4);
  });

  it('puts scenarios not tried yet ahead of ones already practised, and says why', () => {
    const four = library.slice(0, 4);
    const sessions = [call({ scenarioId: 'in-1', issueType: 'sign-in-access', overallScore: 3.5 })];
    const picks = pickScenarios({
      scenarios: four,
      sessions,
      recommendation: recommendMission({ scenarios: four, sessions, progress: null }),
    });
    // The two untried kinds of call tie, so the one that sorts first by id comes first.
    expect(picks.map((p) => p.scenario.id)).toEqual(['in-2', 'bill', 'slow', 'in-1']);
    expect(picks[0]).toMatchObject({ recommended: true });
    expect(picks[1]?.reason).toBe('A new kind of call for you: billing or licence question.');
    expect(picks[3]?.reason).toBe(
      'You scored 3.5 of 5 here before. A second try shows what has changed.',
    );
  });

  it('never offers a scenario that has a call in progress', () => {
    const sessions = [
      call({ scenarioId: 'slow', status: 'active', completion: null, endedAt: null }),
    ];
    const picks = pickScenarios({
      scenarios: library,
      sessions,
      recommendation: recommend(sessions),
    });
    expect(picks.map((p) => p.scenario.id)).not.toContain('slow');
  });

  it('offers what there is when the library is small, and nothing when it is empty', () => {
    const two = library.slice(0, 2);
    const some = pickScenarios({
      scenarios: two,
      sessions: [],
      recommendation: recommendMission({ scenarios: two, sessions: [], progress: null }),
    });
    expect(some).toHaveLength(2);
    expect(pickScenarios({ scenarios: [], sessions: [], recommendation: null })).toEqual([]);
  });
});

describe('demandText', () => {
  it('says how demanding a call is in two plain settings', () => {
    expect(demandText(makeScenario({ impact: 'high', difficulty: 'challenge' }))).toBe(
      'High impact \u00b7 Challenge',
    );
    expect(demandText(makeScenario({ impact: 'low', difficulty: 'starter' }))).toBe(
      'Low impact \u00b7 Starter',
    );
  });
});

describe('missionFacts', () => {
  it('lists the public settings of a mission as short facts, and nothing about scoring', () => {
    expect(
      missionFacts({
        impact: 'medium',
        difficulty: 'standard',
        start: 'frustrated',
        stage: 'follow-up',
        minutes: 9,
      }),
    ).toEqual(['Medium impact \u00b7 Standard', 'Starts frustrated', 'Follow-up', '9 min']);
  });

  it('leaves out the stage and the length when a call has no scenario to ask about', () => {
    expect(missionFacts({ impact: 'low', difficulty: 'starter', start: 'calm' })).toEqual([
      'Low impact \u00b7 Starter',
      'Starts calm',
    ]);
    expect(
      missionFacts({
        impact: 'low',
        difficulty: 'starter',
        start: 'calm',
        stage: 'first-contact',
        minutes: 1,
      }).at(-1),
    ).toBe('1 min');
  });
});

describe('heroMissionOf', () => {
  it('turns a scenario into a mission that has not been tried, with the glint, from public fields only', () => {
    const scenario = makeScenario({
      id: 'unusual',
      title: 'An unusual kind of call',
      difficulty: 'challenge',
      impact: 'high',
      startingTemperature: 'angry',
      callStage: 'escalated',
      estimatedMinutes: 14,
      persona: {
        name: 'Hannah Becker',
        role: 'CTO',
        organisation: 'Lucerne Publishing',
        // Anything else a server might add must not ride along.
        secret: 'hidden',
      } as never,
    });
    const mission = heroMissionOf(scenario);
    expect(mission).toEqual({
      id: 'unusual',
      title: 'An unusual kind of call',
      persona: { name: 'Hannah Becker', role: 'CTO', organisation: 'Lucerne Publishing' },
      difficulty: 'challenge',
      impact: 'high',
      start: 'angry',
      stage: 'escalated',
      minutes: 14,
      status: 'new',
      recommended: true,
    });
  });
});

describe('hasPractised', () => {
  it('is false until something has finished, so "none yet" is never dressed as data', () => {
    expect(hasPractised(practiceStats([]), [])).toBe(false);
    const open = call({ status: 'active', completion: null, endedAt: null, durationSeconds: null });
    expect(hasPractised(practiceStats([open]), recentCalls([open]))).toBe(false);
  });

  it('is true for any finished call, including one that ended early and has no score', () => {
    const early = call({ completion: 'ended-early', overallScore: null, durationSeconds: 90 });
    expect(hasPractised(practiceStats([early]), recentCalls([early]))).toBe(true);
    // Only a sample exists: samples are demonstration data, so it still counts as nothing.
    const sample = call({ isSample: true });
    expect(hasPractised(practiceStats([sample]), recentCalls([sample]))).toBe(false);
  });
});
