import { describe, expect, it } from 'vitest';
import { conformCustomerReply, sentenceCount } from './conform.ts';

const conform = (text: string, maxSentences = 3, maxChars?: number) =>
  conformCustomerReply(
    text,
    maxChars === undefined ? { maxSentences } : { maxSentences, maxChars },
  );

describe('conforming a customer reply', () => {
  it('leaves a short, plain reply exactly as it is', () => {
    const result = conform("I can't sign in. It started this morning.");
    expect(result).toEqual({
      text: "I can't sign in. It started this morning.",
      changed: false,
      problems: [],
    });
  });

  it('cuts a long reply at a sentence boundary, never in the middle of one', () => {
    const result = conform(
      'One thing happened. A second thing happened. A third thing happened. And a fourth.',
      2,
    );
    expect(result.text).toBe('One thing happened. A second thing happened.');
    expect(result.problems).toContain('too-long');
    expect(sentenceCount(result.text)).toBe(2);
  });

  it('keeps at least the first sentence, and uses the character limit as a second limit', () => {
    expect(conform('A very long first sentence that goes on and on.', 0).text).toBe(
      'A very long first sentence that goes on and on.',
    );
    const limited = conform('First short one. Second short one. Third short one.', 5, 30);
    expect(limited.text).toBe('First short one.');
    expect(limited.problems).toContain('too-long');
  });

  it('flattens lists, headings and line breaks into plain speech', () => {
    const result = conform(
      'Here is what I did:\n- Restarted the laptop\n- Tried the phone\n\n## Notes\n1. Nothing worked',
      6,
    );
    expect(result.text).not.toMatch(/\n/);
    expect(result.text).not.toMatch(/(?:^|\s)(?:-|#|\d\.)\s/);
    expect(result.text).toContain('Restarted the laptop.');
    expect(result.problems).toContain('list-or-heading');
  });

  it('removes praise for the engineer, and turns "that is correct" into what a customer says', () => {
    const praised = conform('Great question! My phone has been acting up. You did a great job.');
    expect(praised.text).toBe('My phone has been acting up.');
    expect(praised.problems).toContain('praise');
    expect(conform("That's correct. I did change it this morning.").text).toBe(
      "That's right. I did change it this morning.",
    );
    expect(conform('Well done, spot on.').problems).toEqual(
      expect.arrayContaining(['praise', 'empty']),
    );
  });

  it('never coaches the engineer or announces what it is holding back', () => {
    const coached = conform(
      'It keeps asking for a password. You should have asked about my phone first. Ask me about the screen.',
    );
    expect(coached.text).toBe('It keeps asking for a password.');
    expect(coached.problems).toContain('coaching');
    const announced = conform(
      'Here is another hidden fact for you. I changed my password at eight.',
    );
    expect(announced.text).toBe('I changed my password at eight.');
    expect(announced.problems).toContain('announces-facts');
  });

  it('is empty, and says so, when nothing of the reply can be kept', () => {
    for (const text of ['', '   ', '- ', 'You should ask me about the phone.']) {
      const result = conform(text);
      expect(result.text, text).toBe('');
      expect(result.problems, text).toContain('empty');
    }
  });

  it('never makes a reply longer than the limit it was given, whatever the model sent', () => {
    for (let n = 1; n <= 8; n++) {
      const text = Array.from(
        { length: n + 3 },
        (_, i) => `Sentence number ${i + 1} is here.`,
      ).join(' ');
      expect(sentenceCount(conform(text, n).text)).toBeLessThanOrEqual(n);
    }
  });
});
