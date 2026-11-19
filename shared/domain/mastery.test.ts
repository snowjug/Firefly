import { describe, expect, it } from 'vitest';
import { assessMastery, brightest, type MasterySession } from './mastery.ts';
import type { Difficulty, DimensionId } from './vocab.ts';

let counter = 0;
function call(
  scenarioId: string,
  difficulty: Difficulty,
  scores: Partial<Record<DimensionId, number>>,
  overrides: Partial<MasterySession> = {},
): MasterySession {
  counter += 1;
  const minute = String(counter).padStart(2, '0');
  return {
    id: `s${counter}`,
    scenarioId,
    difficulty,
    completion: 'completed',
    isSample: false,
    startedAt: `2026-02-01T10:${minute}:00.000Z`,
    endedAt: `2026-02-01T10:${minute}:30.000Z`,
    dimensionScores: scores,
    ...overrides,
  };
}

const find = (sessions: MasterySession[], id: DimensionId) =>
  assessMastery(sessions).find((m) => m.dimension === id)!;

describe('assessMastery', () => {
  it('starts every constellation dormant and says what is needed to light it', () => {
    const all = assessMastery([]);
    expect(all).toHaveLength(6);
    for (const m of all) {
      expect(m.tier).toBe('dormant');
      expect(m.calls).toBe(0);
      expect(m.next).toEqual({
        tier: 'kindling',
        needs: ['a completed call that scores this skill'],
      });
    }
  });

  it('lights a skill with its first completed call, whatever the score', () => {
    const m = find([call('a', 'starter', { clarity: 1 })], 'clarity');
    expect(m.tier).toBe('kindling');
    expect(m.best).toBe(1);
    expect(m.next?.tier).toBe('glowing');
    expect(m.next?.needs).toEqual([
      '1 more completed call',
      'a recent average of 3.0 or more (now 1.0)',
    ]);
  });

  it('needs a second call and a solid average to glow', () => {
    const m = find(
      [call('a', 'starter', { clarity: 3 }), call('a', 'starter', { clarity: 4 })],
      'clarity',
    );
    expect(m.tier).toBe('glowing');
    expect(m.recentAverage).toBeCloseTo(3.5);
    expect(m.latest).toBe(4);
  });

  it('asks for variety and a harder call before radiant', () => {
    const sameScenario = [
      call('a', 'starter', { closing: 5 }),
      call('a', 'starter', { closing: 5 }),
      call('a', 'starter', { closing: 5 }),
    ];
    const m = find(sameScenario, 'closing');
    expect(m.tier).toBe('glowing');
    expect(m.next?.needs).toEqual([
      'a call in a different scenario',
      'a Standard or Challenge call scoring 4 or more',
    ]);

    const varied = [
      call('a', 'starter', { closing: 4 }),
      call('b', 'standard', { closing: 4 }),
      call('c', 'starter', { closing: 4 }),
    ];
    expect(find(varied, 'closing').tier).toBe('radiant');
  });

  it('reserves beacon for consistent strength including a Challenge call', () => {
    const strongButEasy = [
      call('a', 'starter', { clarity: 5 }),
      call('b', 'standard', { clarity: 5 }),
      call('c', 'standard', { clarity: 5 }),
      call('d', 'starter', { clarity: 5 }),
    ];
    const easy = find(strongButEasy, 'clarity');
    expect(easy.tier).toBe('radiant');
    expect(easy.next?.needs).toEqual(['a Challenge call scoring 4 or more']);

    const withChallenge = [...strongButEasy, call('e', 'challenge', { clarity: 4 })];
    expect(find(withChallenge, 'clarity').tier).toBe('beacon');
    expect(find(withChallenge, 'clarity').next).toBeNull();
  });

  it('only counts completed, non-sample calls', () => {
    const sessions = [
      call('a', 'starter', { clarity: 5 }, { isSample: true }),
      call('b', 'starter', { clarity: 5 }, { completion: 'ended-early' }),
      call('c', 'starter', { clarity: 5 }, { completion: null }),
    ];
    expect(find(sessions, 'clarity').tier).toBe('dormant');
  });

  it('judges the most recent five calls, so skills can improve', () => {
    const older = Array.from({ length: 5 }, (_, i) => call(`o${i}`, 'starter', { clarity: 1 }));
    const newer = Array.from({ length: 5 }, (_, i) => call(`n${i}`, 'standard', { clarity: 4 }));
    const m = find([...older, ...newer], 'clarity');
    expect(m.recentAverage).toBe(4);
    expect(m.calls).toBe(10);
    expect(m.tier).toBe('radiant');
  });

  it('is not affected by volume: more calls at the same level change nothing', () => {
    const few = [call('a', 'starter', { clarity: 3 }), call('b', 'starter', { clarity: 3 })];
    const many = [...few, ...Array.from({ length: 8 }, () => call('b', 'starter', { clarity: 3 }))];
    expect(find(many, 'clarity').tier).toBe(find(few, 'clarity').tier);
  });
});

describe('brightest', () => {
  it('is null until something is lit, then the highest tier', () => {
    expect(brightest(assessMastery([]))).toBeNull();
    const m = assessMastery([
      call('a', 'starter', { clarity: 3, closing: 5 }),
      call('b', 'starter', { clarity: 3, closing: 5 }),
    ]);
    expect(brightest(m)?.tier).toBe('glowing');
  });
});
