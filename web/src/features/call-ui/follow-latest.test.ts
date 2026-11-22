import { describe, expect, it } from 'vitest';
import { FOLLOW_SLACK_PX, followAfterScroll } from './follow-latest.ts';

describe('what a scroll means for following the newest turn', () => {
  const scroll = (distanceFromEnd: number, pinning: boolean, following: boolean) =>
    followAfterScroll({ distanceFromEnd, pinning, following });

  it('follows again whenever the log is at the end, whoever got it there', () => {
    expect(scroll(0, false, false)).toBe(true);
    expect(scroll(0, true, false)).toBe(true);
    expect(scroll(FOLLOW_SLACK_PX, false, false)).toBe(true);
  });

  it('lets go as soon as the log is further from the end than the slack', () => {
    expect(scroll(FOLLOW_SLACK_PX + 1, false, true)).toBe(false);
    expect(
      followAfterScroll({ distanceFromEnd: 90, pinning: false, following: true, slack: 100 }),
    ).toBe(true);
  });

  it('does not take the page’s own scroll to the end for a person leaving it', () => {
    // A scroll the page asked for passes through places that are not the end.
    expect(scroll(300, true, true)).toBe(true);
    // And it never starts following for a log the person had left.
    expect(scroll(300, true, false)).toBe(false);
  });
});
