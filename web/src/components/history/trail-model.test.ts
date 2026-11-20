import { describe, expect, it } from 'vitest';
import { makeSummary } from '../report/report.fixtures.ts';
import { statusOf } from './status.ts';
import { callGlyphTraits, groupByMonth, isFullyCompleted, statusTone } from './trail-model.ts';

const local = (month: number, day: number, hour = 12) =>
  new Date(2026, month - 1, day, hour).toISOString();

describe('isFullyCompleted and callGlyphTraits', () => {
  it('fills the heart only for a call taken all the way to a close', () => {
    const library = { stage: 'follow-up', minutes: 9 } as const;
    const full = makeSummary();
    const early = makeSummary({ completion: 'ended-early' });
    const open = makeSummary({ status: 'active', completion: null });
    const failed = makeSummary({ status: 'evaluation_failed', completion: null });
    expect(isFullyCompleted(full)).toBe(true);
    expect([early, open, failed].some(isFullyCompleted)).toBe(false);
    expect(callGlyphTraits(full, library).status).toBe('completed');
    for (const call of [early, open, failed]) {
      expect(callGlyphTraits(call, library).status).toBe('attempted');
    }
  });

  it('draws the call\u2019s own settings, and the stage and length from the library', () => {
    const call = makeSummary({
      difficulty: 'challenge',
      impact: 'high',
      startingTemperature: 'angry',
    });
    expect(callGlyphTraits(call, { stage: 'escalated', minutes: 14 })).toEqual({
      difficulty: 'challenge',
      impact: 'high',
      start: 'angry',
      stage: 'escalated',
      status: 'completed',
      minutes: 14,
    });
  });

  it('guesses nothing about a scenario the library does not know', () => {
    const traits = callGlyphTraits(makeSummary(), undefined);
    expect(traits.stage).toBe('first-contact');
    expect(traits.minutes).toBe(0);
    expect(traits.recommended).toBeUndefined();
  });
});

describe('statusTone', () => {
  it('keeps coral for the one state that needs doing something about', () => {
    const tones = {
      completed: statusTone(makeSummary()),
      early: statusTone(makeSummary({ completion: 'ended-early' })),
      open: statusTone(makeSummary({ status: 'active', completion: null })),
      waiting: statusTone(makeSummary({ status: 'completing', completion: null })),
      failed: statusTone(makeSummary({ status: 'evaluation_failed', completion: null })),
    };
    expect(tones).toEqual({
      completed: 'sage',
      early: 'neutral',
      open: 'aqua',
      waiting: 'aqua',
      failed: 'coral',
    });
  });

  it('goes with the words the status model already uses', () => {
    expect(statusOf(makeSummary({ completion: 'ended-early' })).label).toBe('Ended early');
  });
});

describe('groupByMonth', () => {
  it('splits newest-first calls into runs by month, in the order they came', () => {
    const calls = [
      makeSummary({ id: 'a', startedAt: local(11, 28) }),
      makeSummary({ id: 'b', startedAt: local(11, 2) }),
      makeSummary({ id: 'c', startedAt: local(10, 30) }),
      makeSummary({ id: 'd', startedAt: local(10, 1) }),
      makeSummary({ id: 'e', startedAt: local(9, 12) }),
    ];
    const months = groupByMonth(calls);
    expect(months.map((m) => m.key)).toEqual(['2026-11', '2026-10', '2026-09']);
    expect(months.map((m) => m.calls.map((c) => c.id))).toEqual([['a', 'b'], ['c', 'd'], ['e']]);
    expect(months[0]?.label).toMatch(/2026/);
  });

  it('starts a new run, rather than reordering, when a month comes round again', () => {
    const calls = [
      makeSummary({ id: 'a', startedAt: local(11, 5) }),
      makeSummary({ id: 'b', startedAt: local(10, 5) }),
      makeSummary({ id: 'c', startedAt: local(11, 1) }),
    ];
    expect(groupByMonth(calls).map((m) => m.calls.map((c) => c.id))).toEqual([['a'], ['b'], ['c']]);
  });

  it('copes with no calls and with a date it cannot read', () => {
    expect(groupByMonth([])).toEqual([]);
    const [broken] = groupByMonth([makeSummary({ startedAt: 'not a date' })]);
    expect(broken?.label).toBe('Date unknown');
  });
});
