import { describe, expect, it } from 'vitest';
import {
  citationsByTurn,
  citedTurns,
  linkedTurn,
  markQuotes,
  type TextPiece,
} from './citations.ts';
import { makeEarlyReport, makeReport } from './report.fixtures.ts';

const quoted = (pieces: TextPiece[]) => pieces.filter((piece) => piece.quoted).map((p) => p.text);
const joined = (pieces: TextPiece[]) => pieces.map((piece) => piece.text).join('');

describe('citationsByTurn', () => {
  it('gives no citations when there is no report', () => {
    expect(citationsByTurn(null).size).toBe(0);
    expect(citedTurns(null).size).toBe(0);
  });

  it('names every reason a turn is cited, in the order of the report, with the words quoted', () => {
    const cited = citationsByTurn(makeReport());
    expect(cited.get(4)).toEqual([
      { label: 'Evidence: Opening', quote: 'Evidence quote for opening-rapport.' },
      { label: 'Evidence: Empathy', quote: 'Evidence quote for empathy-deescalation.' },
      { label: 'Evidence: Clarity', quote: 'Evidence quote for clarity.' },
      { label: 'Evidence: Ownership', quote: 'Evidence quote for ownership-next-steps.' },
      {
        label: 'Discovery: Started right after the password change',
        quote: 'When did it start, and did anything change recently?',
      },
      { label: 'Turning point', quote: 'Please clear your cache.' },
    ]);
    expect(cited.get(6)).toEqual([
      { label: 'To improve: Empathy', quote: 'You should have updated it.' },
      { label: 'Turning point', quote: 'You should have updated it.' },
    ]);
    // Turn numbers are the transcript's: the report never cites turn 0, and a missed fact cites none.
    expect(cited.has(0)).toBe(false);
    expect([...cited.keys()].sort((a, b) => a - b)).toEqual([2, 4, 6, 8, 10]);
  });

  it('cites a curveball once, whichever part of the report says it, and without a quote', () => {
    const cited = citationsByTurn(makeEarlyReport());
    expect(cited.get(4)?.filter((item) => item.label === 'Curveball')).toEqual([
      { label: 'Curveball', quote: null },
    ]);
  });

  it('lists just the reasons, once each, for marking a turn', () => {
    const labels = citedTurns(makeReport());
    expect(labels.get(6)).toEqual(['To improve: Empathy', 'Turning point']);
    expect(labels.get(10)).toEqual(['Evidence: Closing', 'Went well: Closing']);
  });
});

describe('linkedTurn', () => {
  it('reads ?turn= first and #turn-N next', () => {
    expect(linkedTurn(new URLSearchParams('turn=7'), '')).toBe(7);
    expect(linkedTurn(new URLSearchParams(''), '#turn-6')).toBe(6);
    expect(linkedTurn(new URLSearchParams('turn=3'), '#turn-6')).toBe(3);
  });

  it('ignores anything that is not a turn number', () => {
    for (const bad of ['0', '-2', '1.5', 'x', '']) {
      expect(linkedTurn(new URLSearchParams({ turn: bad }), '')).toBeNull();
    }
    expect(linkedTurn(new URLSearchParams(''), '#turn-0')).toBeNull();
    expect(linkedTurn(new URLSearchParams(''), '#somewhere')).toBeNull();
  });
});

describe('markQuotes', () => {
  it('splits a turn around the words the report quotes', () => {
    const pieces = markQuotes('Well. You should have updated it. Anyway.', [
      'You should have updated it.',
    ]);
    expect(pieces).toEqual([
      { text: 'Well. ', quoted: false },
      { text: 'You should have updated it.', quoted: true },
      { text: ' Anyway.', quoted: false },
    ]);
  });

  it('finds a quote a model has tidied: case, spacing, curly quotes, dashes and ellipses', () => {
    const text = 'I\u2019ll  look into it \u2013 and call you at 3pm, honestly.';
    expect(quoted(markQuotes(text, ["i'll look into it - and call you at 3pm"]))).toEqual([
      'I\u2019ll  look into it \u2013 and call you at 3pm',
    ]);
    expect(quoted(markQuotes('First, restart it. Then wait.', ['\u2026restart it\u2026']))).toEqual(
      ['restart it'],
    );
    expect(quoted(markQuotes('First, restart it. Then wait.', ['...restart it...']))).toEqual([
      'restart it',
    ]);
  });

  it('always gives back the text it was given, whole and in order', () => {
    const text = 'Hello there. Please restart it. Thanks, bye.';
    expect(joined(markQuotes(text, ['Please restart it.', 'Thanks']))).toBe(text);
    expect(joined(markQuotes(text, ['not here']))).toBe(text);
  });

  it('merges quotes that overlap or touch into one stretch', () => {
    const text = 'One two three four five six.';
    expect(quoted(markQuotes(text, ['two three four', 'three four five']))).toEqual([
      'two three four five',
    ]);
  });

  it('marks several separate quotes in the order they are said', () => {
    const text = 'Start here, then go there, and finish.';
    expect(quoted(markQuotes(text, ['finish', 'Start here']))).toEqual(['Start here', 'finish']);
  });

  it('leaves the turn plain when the words are not in it, or are too short to mean anything', () => {
    expect(markQuotes('Please restart it.', ['Please clear your cache.'])).toEqual([
      { text: 'Please restart it.', quoted: false },
    ]);
    expect(markQuotes('Please restart it.', ['', ' ', 'a'])).toEqual([
      { text: 'Please restart it.', quoted: false },
    ]);
    expect(markQuotes('Please restart it.', [])).toEqual([
      { text: 'Please restart it.', quoted: false },
    ]);
  });

  it('leaves the turn plain when one quote is all of it: the tag says it is cited', () => {
    expect(markQuotes('I will call you at 3pm.', ['I will call you at 3pm.'])).toEqual([
      { text: 'I will call you at 3pm.', quoted: false },
    ]);
    expect(markQuotes('I will call you at 3pm.', ['i will call you at 3pm'])).toHaveLength(2);
  });
});
