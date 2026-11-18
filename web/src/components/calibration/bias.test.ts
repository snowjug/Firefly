import { describe, expect, it } from 'vitest';
import {
  biasLabel,
  differenceText,
  MIN_SESSIONS_FOR_PATTERN,
  readBias,
  sampleSizeMessage,
  signed,
} from './bias.ts';

describe('readBias', () => {
  it('describes no direction until enough sessions support one', () => {
    expect(readBias(1.2, MIN_SESSIONS_FOR_PATTERN - 1)).toEqual({
      kind: 'too-few',
      direction: null,
    });
  });

  it('separates no lean, a slight lean and a clear lean in either direction', () => {
    expect(readBias(0.1, 8).kind).toBe('none');
    expect(readBias(-0.2, 8).kind).toBe('none');
    expect(readBias(0.3, 8)).toEqual({ kind: 'slight', direction: 'higher' });
    expect(readBias(-0.4, 8)).toEqual({ kind: 'slight', direction: 'lower' });
    expect(readBias(0.6, 8)).toEqual({ kind: 'clear', direction: 'higher' });
    expect(readBias(-1, 8)).toEqual({ kind: 'clear', direction: 'lower' });
  });
});

describe('wording', () => {
  it('writes a lean in plain words with its size', () => {
    expect(biasLabel(readBias(0.6, 8), 0.6)).toBe('AI tends to score higher (+0.6)');
    expect(biasLabel(readBias(-0.3, 8), -0.3)).toBe('Slightly lower (\u22120.3)');
    expect(biasLabel(readBias(0.05, 8), 0.05)).toBe('No consistent bias');
    expect(biasLabel(readBias(0.9, 3), 0.9)).toBe('Too few reviews to say');
  });

  it('shows signed figures with a true minus and no negative zero', () => {
    expect(signed(0.04)).toBe('0');
    expect(signed(-0.04)).toBe('0');
    expect(signed(2, 0)).toBe('+2');
    expect(signed(-1, 0)).toBe('\u22121');
  });

  it('compares one pair of scores from the AI side', () => {
    expect(differenceText(3, 3)).toBe('Same score');
    expect(differenceText(4, 3)).toBe('AI 1 point higher');
    expect(differenceText(1, 3)).toBe('AI 2 points lower');
  });

  it('says how many sessions the figures rest on, and that few are not enough', () => {
    expect(sampleSizeMessage(0).text).toBe('No mentor-reviewed sessions yet');
    expect(sampleSizeMessage(1).text).toBe('Based on 1 session: too few to draw conclusions');
    expect(sampleSizeMessage(2).text).toBe('Based on 2 sessions: too few to draw conclusions');
    expect(sampleSizeMessage(12).text).toBe('Based on 12 sessions: indicative only');
    expect(sampleSizeMessage(25).text).toBe('Based on 25 sessions');
  });
});
