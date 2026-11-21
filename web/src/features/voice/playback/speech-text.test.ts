import { describe, expect, it } from 'vitest';
import {
  cleanForSpeech,
  createLevelShaper,
  estimateSpeechMs,
  splitForSpeech,
} from './speech-text.ts';

const LONG_REPLY =
  'I have been waiting for my replacement card for almost three weeks and nobody has told me why. Every time I call, someone says it is on its way, and then nothing arrives at all. Please just tell me exactly when I can expect it.';

describe('cleanForSpeech', () => {
  it('strips markdown, links, emoji and stage directions so only what was said is read', () => {
    expect(
      cleanForSpeech(
        '*sighs* Hello **there**, this is _really_ bad. [More](http://x.test) \u{1F621} ',
      ),
    ).toBe('Hello there, this is really bad. More');
    expect(cleanForSpeech('(pause) Right. [laughs]')).toBe('Right.');
    expect(cleanForSpeech('Visit https://example.com now')).toBe('Visit now');
    expect(cleanForSpeech('# Heading\n- one\n- two')).toBe('Heading. one. two');
  });

  it('keeps emphasis inside a sentence and ordinary punctuation', () => {
    expect(cleanForSpeech("It's *really* urgent, isn't it?")).toBe("It's really urgent, isn't it?");
  });
});

describe('splitForSpeech', () => {
  it('splits long text at sentence ends, in pieces short enough to speak in one go', () => {
    const text = cleanForSpeech(LONG_REPLY);
    const chunks = splitForSpeech(text);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(140);
      expect(chunk.text).toMatch(/[.!?]$/);
      expect(text.slice(chunk.start, chunk.start + chunk.text.length)).toBe(chunk.text);
    }
    expect(chunks.map((chunk) => chunk.text).join(' ')).toBe(text);
  });

  it('keeps short sentences together, does not end a sentence at "Mr.", and cuts a run-on at spaces', () => {
    expect(splitForSpeech('Hi. How are you? Fine.')).toHaveLength(1);
    expect(splitForSpeech('Mr. Hall called. He was upset.', 20).map((c) => c.text)).toEqual([
      'Mr. Hall called.',
      'He was upset.',
    ]);
    const runOn = splitForSpeech('word '.repeat(80).trim());
    expect(runOn.length).toBeGreaterThan(2);
    expect(runOn.every((chunk) => chunk.text.length <= 140)).toBe(true);
  });

  it('has nothing to say for text without letters or numbers', () => {
    expect(splitForSpeech('...')).toEqual([]);
    expect(splitForSpeech('')).toEqual([]);
  });
});

describe('estimateSpeechMs', () => {
  it('grows with the length of the text and shrinks at a faster rate', () => {
    const short = estimateSpeechMs('Hello there, thanks for calling.');
    const long = estimateSpeechMs(LONG_REPLY);
    expect(long).toBeGreaterThan(short);
    expect(estimateSpeechMs(LONG_REPLY, 1.2)).toBeLessThan(long);
    expect(estimateSpeechMs(LONG_REPLY, 0.8)).toBeGreaterThan(long);
  });

  it('is never under a second, and gives sentence ends a pause', () => {
    expect(estimateSpeechMs('Hi.')).toBe(1000);
    expect(estimateSpeechMs('')).toBe(1000);
    expect(estimateSpeechMs('One. Two. Three. Four. Five. Six. Seven. Eight.')).toBeGreaterThan(
      estimateSpeechMs('One Two Three Four Five Six Seven Eight'),
    );
  });
});

describe('createLevelShaper', () => {
  it('shapes a level from the words: always between 0 and 1, rising and falling, the same every time', () => {
    const shape = createLevelShaper(LONG_REPLY);
    const again = createLevelShaper(LONG_REPLY);
    const levels: number[] = [];
    for (let at = 0; at < 6000; at += 33) levels.push(shape(at));
    expect(levels.every((level) => level >= 0 && level <= 1)).toBe(true);
    expect(Math.max(...levels)).toBeGreaterThan(0.6);
    expect(Math.min(...levels)).toBeLessThan(0.3);
    expect(new Set(levels).size).toBeGreaterThan(10);
    expect(levels).toEqual(Array.from({ length: levels.length }, (_, i) => again(i * 33)));
  });

  it('is quiet before the voice starts and after it has finished', () => {
    const shape = createLevelShaper('Hello there.');
    expect(shape(-10)).toBe(0);
    expect(shape(60_000)).toBeLessThanOrEqual(0.05);
  });

  it('stretches with a slower rate', () => {
    const normal = createLevelShaper(LONG_REPLY, 1);
    const slow = createLevelShaper(LONG_REPLY, 0.5);
    // Late in the speech the normal-speed voice is done and the slow one is still going.
    const late = estimateSpeechMs(LONG_REPLY, 1) + 500;
    const quietNormal = Array.from({ length: 30 }, (_, i) => normal(late + i * 20));
    const slowLevels = Array.from({ length: 30 }, (_, i) => slow(late + i * 20));
    expect(Math.max(...quietNormal)).toBeLessThanOrEqual(0.05);
    expect(Math.max(...slowLevels)).toBeGreaterThan(0.3);
  });
});
