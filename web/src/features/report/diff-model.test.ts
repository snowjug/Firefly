import { describe, expect, it } from 'vitest';
import { diffWords, type DiffRun } from './diff-model.ts';

/** A side of the diff written back as a sentence, to check that no word was lost or invented. */
const written = (runs: readonly DiffRun[]) => runs.map((r) => r.text + r.gap).join('');
const kinds = (runs: readonly DiffRun[]) => runs.map((r) => `${r.kind}:${r.text}`);

describe('diffWords', () => {
  it('marks what was removed from the original and what was added to the improvement, as whole runs', () => {
    const { before, after, changed } = diffWords(
      'I can\u2019t guarantee anything. You\u2019ll need to wait.',
      'I\u2019ll own the investigation and update you by 3 PM, even if the issue is still being worked.',
    );
    expect(changed).toBe(true);
    expect(before.map((r) => r.kind)).toEqual(['removed']);
    expect(after.map((r) => r.kind)).toEqual(['added']);
    expect(written(before)).toBe('I can\u2019t guarantee anything. You\u2019ll need to wait.');
    expect(written(after)).toBe(
      'I\u2019ll own the investigation and update you by 3 PM, even if the issue is still being worked.',
    );
  });

  it('keeps the words both lines share as common ground, and marks only the difference', () => {
    const { before, after } = diffWords(
      'Please wait while I check the storage location',
      'Please wait while I check the storage location and call you at 3 PM',
    );
    expect(kinds(before)).toEqual(['same:Please wait while I check the storage location']);
    expect(kinds(after)).toEqual([
      'same:Please wait while I check the storage location',
      'added:and call you at 3 PM',
    ]);
  });

  it('handles an insert, a delete and a replace in the same sentence', () => {
    const { before, after } = diffWords(
      'I will look at it soon and tell you',
      'I will look at the logs today and tell you',
    );
    expect(kinds(before)).toEqual(['same:I will look at', 'removed:it soon', 'same:and tell you']);
    expect(kinds(after)).toEqual([
      'same:I will look at',
      'added:the logs today',
      'same:and tell you',
    ]);
  });

  it('does not count a change of case or punctuation as a different word', () => {
    const { before, after, changed } = diffWords('Wait, please.', 'wait please');
    expect(changed).toBe(false);
    expect(kinds(before)).toEqual(['same:Wait, please.']);
    // The improved line keeps its own capitals and marks.
    expect(kinds(after)).toEqual(['same:wait please']);
  });

  it('is an omission when nothing was said: the whole improvement is added and there is nothing to strike', () => {
    const { before, after, changed } = diffWords('', 'What have you already tried so far?');
    expect(changed).toBe(true);
    expect(before).toEqual([]);
    expect(kinds(after)).toEqual(['added:What have you already tried so far?']);
  });

  it('is empty on both sides for two empty texts, and all removed when the improvement is empty', () => {
    expect(diffWords('', '')).toEqual({ before: [], after: [], changed: false });
    const none = diffWords('Soon.', '   ');
    expect(none.after).toEqual([]);
    expect(kinds(none.before)).toEqual(['removed:Soon.']);
  });

  it('shows two identical sentences as unchanged', () => {
    const { before, after, changed } = diffWords('Is that right?', 'Is that right?');
    expect(changed).toBe(false);
    expect(before.map((r) => r.kind)).toEqual(['same']);
    expect(after.map((r) => r.kind)).toEqual(['same']);
  });

  it('does not cut a replacement in pieces for the sake of one small shared word', () => {
    const { before, after } = diffWords(
      'We will get back to you soon',
      'I will own this and call you by 2 PM today',
    );
    // "will" is shared and sits at the start, but "you" (three letters) lies between two changes.
    expect(written(before)).toBe('We will get back to you soon');
    expect(written(after)).toBe('I will own this and call you by 2 PM today');
    expect(before.some((r) => r.kind === 'same' && r.text === 'you')).toBe(false);
    expect(after.some((r) => r.kind === 'same' && r.text === 'you')).toBe(false);
  });

  it('writes each side back exactly (no word lost or invented), whatever the white space', () => {
    const original = 'Have you   tried\trestarting it? Clear the cache.';
    const improved = 'Before I suggest anything,  what do you see?';
    const { before, after } = diffWords(original, improved);
    expect(written(before)).toBe(original.trim());
    expect(written(after)).toBe(improved.trim());
  });

  it('keeps white space outside the marked text, so a strike never runs under a space', () => {
    const { before } = diffWords('a b c', 'a x c');
    for (const run of before) expect(run.text).toBe(run.text.trim());
  });

  it('copes with a very long text without freezing, by calling it all different', () => {
    const long = Array.from({ length: 800 }, (_, i) => `word${i}`).join(' ');
    const other = Array.from({ length: 800 }, (_, i) => `other${i}`).join(' ');
    const { before, after } = diffWords(long, other);
    expect(before.map((r) => r.kind)).toEqual(['removed']);
    expect(after.map((r) => r.kind)).toEqual(['added']);
  });
});
