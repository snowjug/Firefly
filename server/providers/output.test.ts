import { describe, expect, it } from 'vitest';
import { cleanCustomerText, extractJsonObject, OutputProblem, replyProblem } from './output.ts';

describe('extractJsonObject', () => {
  it.each([
    ['plain JSON', '{"a": 1}', { a: 1 }],
    ['a fenced block', '```json\n{"a": 1}\n```', { a: 1 }],
    ['a fence without a language', '```\n{"a": 1}\n```', { a: 1 }],
    ['prose before and after', 'Here you go: {"a": 1} Hope that helps!', { a: 1 }],
    ['nested objects and arrays', '{"a": {"b": [1, {"c": 2}]}}', { a: { b: [1, { c: 2 }] } }],
    ['braces inside strings', '{"a": "}{ not structure {"}', { a: '}{ not structure {' }],
    ['escaped quotes', '{"a": "she said \\"hi\\" }"}', { a: 'she said "hi" }' }],
    ['a trailing comma', '{"a": [1, 2,], "b": 3,}', { a: [1, 2], b: 3 }],
    ['a bad candidate before a good one', '{oops} then {"a": 1}', { a: 1 }],
    ['an unbalanced brace before the object', '{ "x": {"a": 1}', { a: 1 }],
    [
      'reasoning text before the answer',
      '<think>maybe {"guess": true} or not</think>\n{"a": 1}',
      { a: 1 },
    ],
  ])('finds the object in %s', (_name, text, expected) => {
    expect(extractJsonObject(text)).toEqual(expected);
  });

  it.each([
    ['nothing at all', ''],
    ['text without an object', 'I could not decide.'],
    ['an array', '[1, 2, 3]'],
    ['a truncated object', '{"a": 1, "b": [1, 2'],
    ['reasoning that never ends', '<think>{"a": 1}'],
  ])('rejects %s with a fixed message that does not repeat the reply', (_name, text) => {
    expect(() => extractJsonObject(text)).toThrow(OutputProblem);
    expect(() => extractJsonObject(text)).toThrow('The reply was not a single valid JSON object.');
  });
});

describe('cleanCustomerText', () => {
  const clean = (raw: string, finishReason: string | null = 'stop') =>
    cleanCustomerText(raw, { finishReason, speakerNames: ['Maya Okafor', 'Maya', 'Customer'] });

  it.each([
    ['plain speech', 'It is slow today.', 'It is slow today.'],
    ['the full name as a label', 'Maya Okafor: It is slow today.', 'It is slow today.'],
    ['the first name as a label', 'maya: It is slow today.', 'It is slow today.'],
    ['a generic label', 'Customer: It is slow today.', 'It is slow today.'],
    ['straight wrapping quotes', '"It is slow today."', 'It is slow today.'],
    ['curly wrapping quotes', '\u201cIt is slow today.\u201d', 'It is slow today.'],
    ['a label and wrapping quotes', 'Maya: "It is slow today."', 'It is slow today.'],
    [
      'asterisk and bracket actions at both ends',
      '*sighs* It is slow today. (pauses)',
      'It is slow today.',
    ],
    ['stacked leading actions', '*sighs* (pauses) It is slow today.', 'It is slow today.'],
    ['bold markup', 'It is **very** slow today.', 'It is very slow today.'],
    ['emphasis inside a sentence', "I *can't* open it.", "I can't open it."],
    ['a bullet list', '- It is slow.\n- I cannot open it.', 'It is slow. I cannot open it.'],
    ['a numbered list', '1. It is slow.\n2) I cannot open it.', 'It is slow. I cannot open it.'],
    [
      'list items with no full stop, which are sentences of their own',
      'Here is what I have:\n- The laptop is a Dell\n- It started Monday\n- I tried a restart',
      'Here is what I have: The laptop is a Dell. It started Monday. I tried a restart.',
    ],
    ['a code fence', 'It is slow.\n```\nnot speech\n```\nThanks.', 'It is slow. Thanks.'],
    ['HTML tags', 'It is <b>slow</b> today.', 'It is slow today.'],
    ['reasoning text', '<think>Plan the reply.</think>It is slow today.', 'It is slow today.'],
    ['unfinished reasoning', 'It is slow.<think>and then I should', 'It is slow.'],
    ['a link', 'See [the page](http://example.test) now.', 'See the page now.'],
    ['extra whitespace', '  It   is\n\nslow   today .  ', 'It is slow today.'],
    ['inner quotes, which stay', 'She said "hello" to me.', 'She said "hello" to me.'],
    [
      'a parenthetical inside a sentence, which stays',
      'I tried it (twice) and failed.',
      'I tried it (twice) and failed.',
    ],
  ])('handles %s', (_name, raw, expected) => {
    expect(clean(raw)).toBe(expected);
  });

  it('drops a sentence cut off by the length limit, but only then', () => {
    expect(clean('I tried it. It failed and then I', 'length')).toBe('I tried it.');
    expect(clean('I tried it. It failed and then I', 'stop')).toBe(
      'I tried it. It failed and then I',
    );
    expect(clean('It failed and then I', 'length')).toBe('It failed and then I');
    expect(clean('I tried it. It failed.', 'length')).toBe('I tried it. It failed.');
  });

  it('does not treat a name that merely starts a sentence as a label', () => {
    expect(clean('Maya is on leave: call back later.')).toBe('Maya is on leave: call back later.');
  });
});

describe('replyProblem', () => {
  it('accepts ordinary replies, including words that only sound technical', () => {
    for (const reply of [
      'It stopped letting me in after I changed my password.',
      "I'm not a technical person, so please go slowly.",
      'The simulation software at work crashed last week.',
      'My assistant is also locked out.',
      'I followed the instructions on the screen.',
      'The model number is on the back.',
    ]) {
      expect(replyProblem(reply)).toBeNull();
    }
  });

  it('rejects empty and over-long replies', () => {
    expect(replyProblem('')).toBe('empty');
    expect(replyProblem('   \n ')).toBe('empty');
    expect(replyProblem('x'.repeat(900))).toBeNull();
    expect(replyProblem('x'.repeat(901))).toBe('too-long');
  });

  it.each([
    'As an AI language model I cannot do that.',
    "I'm an AI and I do not have a laptop.",
    'I am a large language model.',
    'ChatGPT would say the same.',
    'My system prompt tells me to be polite.',
    'According to my instructions I should refuse.',
    'The rubric says you should apologise.',
    'This simulation is going well.',
    'Let us stay in character here.',
    "I can't assist with that request.",
    'I\u2019m a simulated customer.',
  ])('rejects a reply that breaks role: %s', (reply) => {
    expect(replyProblem(reply)).toBe('role-break');
  });
});
