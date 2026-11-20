import { describe, expect, it } from 'vitest';
import { describeMarker } from './markers.ts';

describe('describeMarker', () => {
  it('says a hidden fact came out in words, whichever way the evaluator wrote it', () => {
    expect(describeMarker({ kind: 'discovery', label: 'Uncovered: The phone' })).toEqual({
      shape: 'star',
      text: 'Discovered: The phone',
      tone: 'discovery',
    });
    expect(describeMarker({ kind: 'discovery', label: 'Partly uncovered: The phone' }).text).toBe(
      'Partly discovered: The phone',
    );
    expect(describeMarker({ kind: 'discovery', label: 'The phone' }).text).toBe(
      'Discovery: The phone',
    );
  });

  it('does not say "curveball" twice', () => {
    expect(
      describeMarker({ kind: 'curveball', label: 'Curveball: customer asked for a manager' }),
    ).toEqual({
      shape: 'triangle',
      text: 'Curveball: customer asked for a manager',
      tone: 'curveball',
    });
    expect(describeMarker({ kind: 'curveball', label: 'customer asked for a manager' }).text).toBe(
      'Curveball: customer asked for a manager',
    );
  });

  it('gives each way the customer’s mood can move its own words and shape, and never a number', () => {
    const eased = describeMarker({ kind: 'state', label: 'Showed empathy', delta: -6 });
    expect(eased).toEqual({
      shape: 'down',
      text: 'Customer mood eased: Showed empathy',
      tone: 'eased',
    });
    expect(eased.text).not.toMatch(/\d/);
    expect(describeMarker({ kind: 'state', label: 'Blamed them', delta: 4 })).toEqual({
      shape: 'up',
      text: 'Customer mood rose: Blamed them',
      tone: 'rose',
    });
    expect(describeMarker({ kind: 'state', label: 'Kept it brief', delta: 0 })).toEqual({
      shape: 'dot',
      text: 'Customer mood: Kept it brief',
      tone: 'mood',
    });
    expect(describeMarker({ kind: 'state', label: 'No change recorded' }).shape).toBe('dot');
  });
});
