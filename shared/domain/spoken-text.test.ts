import { describe, expect, it } from 'vitest';
import { toSpokenText } from './spoken-text.ts';

describe('toSpokenText: what a voice is allowed to read', () => {
  it('leaves a plain line exactly as it is', () => {
    for (const plain of [
      'Hello, I cannot sign in to my account.',
      "I've tried option (b) and it failed twice.",
      'We lost access about three o’clock, and it is costing us money.',
      'It took 5 minutes. Then, nothing: no error, no message.',
      'The other one (the second one) is the one that broke.',
      'Can you check order 4471, please? It is urgent!',
      '',
    ]) {
      expect(toSpokenText(plain), plain).toBe(plain);
    }
  });

  it('removes markdown but keeps the words', () => {
    expect(toSpokenText('**Hello**, I need *help* with `Outlook` today.')).toBe(
      'Hello, I need help with Outlook today.',
    );
    expect(toSpokenText('# Heading\n- item one\n- item two\n1. third')).toBe(
      'Heading. item one. item two. third',
    );
    expect(
      toSpokenText('See [the guide](https://example.com/g) or https://example.com/x now.'),
    ).toBe('See the guide or now.');
    expect(toSpokenText('Look ![chart](a.png) here.')).toBe('Look here.');
    expect(toSpokenText('```js\nconsole.log(1)\n```Please help.')).toBe('Please help.');
    expect(toSpokenText('~~old~~ and __bold__ words')).toBe('old and bold words');
  });

  it('removes JSON, however it is laid out, and never says a key or a brace', () => {
    expect(toSpokenText('{"mood":"angry","text":"I want a refund"}')).toBe('');
    expect(toSpokenText('{\n  "reply": "Hello",\n  "state": { "temperature": 72 }\n}')).toBe('');
    expect(toSpokenText('I want a refund. {"mood": "angry"} Please.')).toBe(
      'I want a refund. Please.',
    );
    expect(toSpokenText('["a","b"]')).toBe('');
    expect(toSpokenText("{'mood': 'angry'} Hello.")).toBe('Hello.');
    // Something in brackets that is not data is not removed as data.
    expect(toSpokenText('I said [option two] was fine.')).toBe('I said [option two] was fine.');
  });

  it('removes stage directions that stand alone, and keeps emphasis and asides', () => {
    expect(toSpokenText('*sighs* I have been waiting for two days.')).toBe(
      'I have been waiting for two days.',
    );
    expect(toSpokenText('I have been waiting for two days (sighs).')).toBe(
      'I have been waiting for two days.',
    );
    expect(toSpokenText('Hello. (long pause) I need help. [pauses]')).toBe('Hello. I need help.');
    expect(toSpokenText('(clears throat) Hello there.')).toBe('Hello there.');
    expect(toSpokenText('Hello there. [laughs nervously]')).toBe('Hello there.');
    expect(toSpokenText('It is *really* important.')).toBe('It is really important.');
    expect(toSpokenText('It is (honestly) important.')).toBe('It is (honestly) important.');
  });

  it('removes notes meant for the simulation: bracketed key-value pairs, whole-line fields and redaction notes', () => {
    expect(toSpokenText('[mood: angry] I am not happy. (state=frustrated) Really.')).toBe(
      'I am not happy. Really.',
    );
    expect(toSpokenText('{temperature=72} Hello.')).toBe('Hello.');
    expect(toSpokenText('mood: angry\nI want my money back')).toBe('I want my money back');
    expect(
      toSpokenText('Write to [email removed] or call [phone removed] or [number removed].'),
    ).toBe('Write to or call or.');
  });

  it('removes speaker and role labels, however they are written', () => {
    expect(toSpokenText('Customer: Hello there')).toBe('Hello there');
    expect(toSpokenText('**Customer:** Hello there')).toBe('Hello there');
    expect(toSpokenText('Customer (angry): Hello there')).toBe('Hello there');
    expect(toSpokenText('Customer: Hello.\nSupport: Hi.\nAI: Fine.')).toBe('Hello. Hi. Fine.');
    // "Customer service" is words, not a label.
    expect(toSpokenText('Customer service never called me back.')).toBe(
      'Customer service never called me back.',
    );
  });

  it('removes HTML-like tags and emoji', () => {
    expect(toSpokenText('<b>Hello</b> <br/> there \u{1F642}')).toBe('Hello there');
    expect(toSpokenText('It took 5 < 6 days and 7 > 3.')).toBe('It took 5 < 6 days and 7 > 3.');
  });

  it('puts separate lines into separate sentences and tidies spacing', () => {
    expect(toSpokenText('First line\nsecond line\n\nthird line.')).toBe(
      'First line. second line. third line.',
    );
    expect(toSpokenText('Hello   there ,  how are you ?')).toBe('Hello there, how are you?');
  });

  it('is the same on a second pass, whatever it is given', () => {
    for (const text of [
      '**a** *b* (c d) [mood: x] {"k": 1}',
      'Hello. (pause) Hello there. [sighs]',
      '# H\n> quote\n- item',
      'Customer: *sighs* ok',
    ]) {
      const once = toSpokenText(text);
      expect(toSpokenText(once), text).toBe(once);
    }
  });

  it('stays quick on hostile input: long runs of brackets, quotes and asterisks', () => {
    const started = Date.now();
    for (const hostile of [
      '['.repeat(20_000),
      '{"a":'.repeat(4_000),
      '*'.repeat(20_000),
      '(' + 'word '.repeat(4_000) + ')',
      "'".repeat(20_000) + '{',
    ]) {
      expect(typeof toSpokenText(hostile)).toBe('string');
    }
    expect(Date.now() - started).toBeLessThan(2_000);
  });
});
