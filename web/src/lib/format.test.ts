import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatRelative, formatTime } from './format.ts';

// Built from local time parts, so the result does not depend on the time zone of the machine.
const local = (y: number, month: number, d: number, h: number, min: number) =>
  new Date(y, month - 1, d, h, min).toISOString();

describe('dates and times', () => {
  it('are written in British English, whatever the locale of the machine or browser', () => {
    expect(formatDate(local(2026, 11, 19, 14, 19))).toBe('19 Nov 2026');
    expect(formatTime(local(2026, 11, 19, 14, 19))).toBe('2:19 pm');
    expect(formatDateTime(local(2026, 11, 19, 19, 19))).toBe('19 Nov 2026, 7:19 pm');
    expect(formatTime(local(2026, 11, 19, 0, 5))).toBe('12:05 am');
  });

  it('say how long ago something was, and fall back to the date after two weeks', () => {
    const now = new Date(2026, 10, 19, 12, 0).getTime();
    const ago = (seconds: number) => new Date(now - seconds * 1000).toISOString();
    expect(formatRelative(ago(20), now)).toBe('just now');
    expect(formatRelative(ago(5 * 60), now)).toBe('5 min ago');
    expect(formatRelative(ago(3 * 3600), now)).toBe('3 h ago');
    expect(formatRelative(ago(2 * 86400), now)).toBe('2 days ago');
    expect(formatRelative(ago(20 * 86400), now)).toBe('30 Oct 2026');
  });
});
