import { describe, expect, it } from 'vitest';
import { estimatedRange, formatEstimate } from './duration.ts';

describe('the estimated length of a call, as a range', () => {
  it.each([
    [5, 4, 6],
    [8, 6, 10],
    [10, 8, 12],
    [12, 10, 14],
    [15, 12, 18],
    [30, 24, 36],
  ])('shows %i minutes as %i to %i', (minutes, min, max) => {
    expect(estimatedRange(minutes)).toEqual({ min, max });
  });

  it('is 20% either side for every length a scenario may state, never narrower than one minute', () => {
    for (let minutes = 5; minutes <= 30; minutes++) {
      const { min, max } = estimatedRange(minutes);
      expect(min, `${minutes}`).toBe(Math.round(minutes * 0.8));
      expect(max, `${minutes}`).toBe(Math.round(minutes * 1.2));
      expect(max, `${minutes}`).toBeGreaterThan(min);
    }
  });

  it('keeps a short call at least three minutes, and the top of the range above the bottom', () => {
    for (const minutes of [0, 1, 2, 3]) {
      const { min, max } = estimatedRange(minutes);
      expect(min, `${minutes}`).toBeGreaterThanOrEqual(3);
      expect(max, `${minutes}`).toBeGreaterThan(min);
    }
  });

  it('never shows a number that is not one, whatever it is given', () => {
    for (const minutes of [Number.NaN, Number.POSITIVE_INFINITY, -4]) {
      const { min, max } = estimatedRange(minutes);
      expect(Number.isInteger(min) && Number.isInteger(max), `${minutes}`).toBe(true);
      expect(max, `${minutes}`).toBeGreaterThan(min);
    }
  });

  it('is written with an en dash and a space before "min"', () => {
    expect(formatEstimate(10)).toBe('8\u201312 min');
    expect(formatEstimate(8)).toBe('6\u201310 min');
    expect(formatEstimate(30)).toBe('24\u201336 min');
    expect(formatEstimate(10)).not.toContain('-');
  });
});
