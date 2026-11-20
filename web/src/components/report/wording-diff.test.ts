import { describe, expect, it } from 'vitest';
import { seeded, type Random } from '../../test-rng.ts';
import {
  changeSummary,
  similarity,
  wordDiff,
  type DiffKind,
  type DiffSegment,
} from './wording-diff.ts';

const seg = (kind: DiffKind, text: string): DiffSegment => ({ kind, text });
const keep = (text: string) => seg('keep', text);
const remove = (text: string) => seg('remove', text);
const add = (text: string) => seg('add', text);

const joined = (segments: readonly DiffSegment[], ...kinds: DiffKind[]) =>
  segments
    .filter((segment) => kinds.includes(segment.kind))
    .map((segment) => segment.text)
    .join('');

describe('wordDiff', () => {
  it('has nothing to say about two empty texts', () => {
    expect(wordDiff('', '')).toEqual([]);
  });

  it('shows a text that appears or disappears as one added or removed run', () => {
    expect(wordDiff('', 'Hello there')).toEqual([add('Hello there')]);
    expect(wordDiff('Hello there', '')).toEqual([remove('Hello there')]);
    expect(wordDiff('  ', '')).toEqual([remove('  ')]);
  });

  it('keeps identical text as one run, spacing and all', () => {
    expect(wordDiff('Thanks for waiting.', 'Thanks for waiting.')).toEqual([
      keep('Thanks for waiting.'),
    ]);
    expect(wordDiff('  \n ', '  \n ')).toEqual([keep('  \n ')]);
    expect(wordDiff('...', '...')).toEqual([keep('...')]);
  });

  it('shows completely different wording as everything removed, then everything added', () => {
    expect(wordDiff('apple pie', 'orange juice')).toEqual([
      remove('apple pie'),
      add('orange juice'),
    ]);
    expect(wordDiff('Hello.', 'Goodbye.')).toEqual([remove('Hello'), add('Goodbye'), keep('.')]);
  });

  it('shows a replaced word as one removed run followed by one added run', () => {
    expect(wordDiff('I will check it now', 'I will check it today')).toEqual([
      keep('I will check it '),
      remove('now'),
      add('today'),
    ]);
    expect(wordDiff('I was waiting', 'I am still waiting')).toEqual([
      keep('I '),
      remove('was'),
      add('am still'),
      keep(' waiting'),
    ]);
  });

  it('keeps what carries over around words that go and words that come in', () => {
    expect(wordDiff('Please kindly restart the app', 'Please restart the app now')).toEqual([
      keep('Please '),
      remove('kindly '),
      keep('restart the app'),
      add(' now'),
    ]);
    expect(
      wordDiff("I'll look into it", "I'll look into the sign-in failure and update you."),
    ).toEqual([keep("I'll look into "), remove('it'), add('the sign-in failure and update you.')]);
  });

  it('marks a change of punctuation as a small change of its own, not a changed word', () => {
    expect(wordDiff('Thanks for waiting', 'Thanks for waiting.')).toEqual([
      keep('Thanks for waiting'),
      add('.'),
    ]);
    expect(wordDiff('Hello there', 'Hello, there')).toEqual([
      keep('Hello'),
      add(','),
      keep(' there'),
    ]);
    expect(wordDiff('Well, hello there!', 'Well hello there')).toEqual([
      keep('Well'),
      remove(','),
      keep(' hello there'),
      remove('!'),
    ]);
    expect(wordDiff('Is it ready?', 'Is it ready!')).toEqual([
      keep('Is it ready'),
      remove('?'),
      add('!'),
    ]);
    expect(wordDiff('...', '!!!')).toEqual([remove('...'), add('!!!')]);
  });

  it('matches words without regard to case and writes kept words as in the new text', () => {
    expect(wordDiff('please call me back', 'Please call me back')).toEqual([
      keep('Please call me back'),
    ]);
    expect(wordDiff('I Will CALL', 'i will call you')).toEqual([keep('i will call'), add(' you')]);
  });

  it('treats a curly and a straight apostrophe as the same, but keeps contractions whole', () => {
    expect(wordDiff("I can't do that", 'I can\u2019t do that')).toEqual([
      keep('I can\u2019t do that'),
    ]);
    expect(wordDiff("I don't know", 'I do not know')).toEqual([
      keep('I '),
      remove("don't"),
      add('do not'),
      keep(' know'),
    ]);
    expect(wordDiff("the dogs' toys", 'the dogs toys')).toEqual([
      keep('the dogs'),
      remove("'"),
      keep(' toys'),
    ]);
  });

  it('carries spacing over exactly and marks only where it differs', () => {
    expect(wordDiff('a  b', 'a b')).toEqual([keep('a '), remove(' '), keep('b')]);
    expect(wordDiff('a\tb', 'a\nb')).toEqual([keep('a'), remove('\t'), add('\n'), keep('b')]);
    expect(wordDiff('  hi', 'hi')).toEqual([remove('  '), keep('hi')]);
    expect(wordDiff('hi', 'hi\n')).toEqual([keep('hi'), add('\n')]);
    expect(wordDiff('a b', 'a  b')).toEqual([keep('a '), add(' '), keep('b')]);
  });

  it('shows reordered words as one moving out and in again', () => {
    expect(wordDiff('a b', 'b a')).toEqual([remove('a '), keep('b'), add(' a')]);
  });

  it('keeps the first of several repeated words and removes the rest', () => {
    expect(wordDiff('the the the cat', 'the cat')).toEqual([
      keep('the '),
      remove('the the '),
      keep('cat'),
    ]);
  });

  it('treats accented letters as letters, and different accents as different words', () => {
    expect(wordDiff('Café au lait', 'café au lait')).toEqual([keep('café au lait')]);
    expect(wordDiff('naïve', 'naive')).toEqual([remove('naïve'), add('naive')]);
  });

  it('keeps symbols and emoji the two texts share, and replaces a changed one whole', () => {
    expect(wordDiff('Great 👍', 'Great 👍 job')).toEqual([keep('Great 👍'), add(' job')]);
    expect(wordDiff('Cost: $5 today', 'Cost: $5 now')).toEqual([
      keep('Cost: $5 '),
      remove('today'),
      add('now'),
    ]);
    expect(wordDiff('a ✓ b', 'a ✗ b')).toEqual([keep('a '), remove('✓'), add('✗'), keep(' b')]);
    expect(wordDiff('Thanks 🙏', 'Thanks 😀')).toEqual([keep('Thanks '), remove('🙏'), add('😀')]);
    // A joined emoji (three people and two joiners) is replaced as one piece, never cut.
    const before = 'Hi \u{1F468}\u200D\u{1F469}\u200D\u{1F467}';
    const after = 'Hi \u{1F468}\u200D\u{1F469}\u200D\u{1F466}';
    expect(wordDiff(before, after)).toEqual([
      keep('Hi '),
      remove('\u{1F468}\u200D\u{1F469}\u200D\u{1F467}'),
      add('\u{1F468}\u200D\u{1F469}\u200D\u{1F466}'),
    ]);
  });

  it('never cuts a word in half', () => {
    expect(wordDiff('cat sat', 'cart')).toEqual([remove('cat sat'), add('cart')]);
    expect(wordDiff('running late', 'run late')).toEqual([
      remove('running'),
      add('run'),
      keep(' late'),
    ]);
    // The start of a contraction is a word of its own to the eye, but not to the diff.
    expect(wordDiff("x's y", 'x z')).toEqual([remove("x's y"), add('x z')]);
    expect(wordDiff("the dog's bone", 'the dog bone')).toEqual([
      keep('the '),
      remove("dog's"),
      add('dog'),
      keep(' bone'),
    ]);
  });

  it('does not take a stray combining mark for a word', () => {
    // A heart followed by an emoji variation selector: one symbol, no words.
    expect(changeSummary(wordDiff('I \u2764\uFE0F it', 'I \u2764\uFE0F it a lot'))).toEqual({
      kept: 2,
      removed: 0,
      added: 2,
    });
  });

  it('does not align a very large input word by word, but still keeps its start and end', () => {
    const words = (prefix: string, count: number) =>
      Array.from({ length: count }, (_, i) => `${prefix}${i}`);
    const before = ['start', ...words('old', 3000), 'end'].join(' ');
    const after = ['start', ...words('new', 3000), 'end'].join(' ');
    const began = performance.now();
    const segments = wordDiff(before, after);
    expect(performance.now() - began).toBeLessThan(1000);
    expect(segments).toEqual([
      keep('start '),
      remove(words('old', 3000).join(' ')),
      add(words('new', 3000).join(' ')),
      keep(' end'),
    ]);
  });
});

describe('changeSummary', () => {
  it('counts words, not runs', () => {
    expect(
      changeSummary([keep('Hello, '), remove('old words'), add('new'), keep(' end.')]),
    ).toEqual({ kept: 2, removed: 2, added: 1 });
  });

  it('counts nothing for nothing, and nothing for punctuation and spacing', () => {
    expect(changeSummary([])).toEqual({ kept: 0, removed: 0, added: 0 });
    expect(changeSummary([keep('a'), remove(' ,'), add('...')])).toEqual({
      kept: 1,
      removed: 0,
      added: 0,
    });
  });

  it('counts a contraction as one word', () => {
    expect(changeSummary([keep("don't"), add('can\u2019t'), remove('it\u2019s')])).toEqual({
      kept: 1,
      removed: 1,
      added: 1,
    });
  });
});

describe('similarity', () => {
  it('is 1 for the same words and 0 for none in common', () => {
    expect(similarity('Thanks for waiting', 'Thanks for waiting')).toBe(1);
    expect(similarity('apple pie', 'orange juice')).toBe(0);
    expect(similarity('a', '')).toBe(0);
    expect(similarity('', 'a')).toBe(0);
  });

  it('is the share of kept words among all the words in the diff', () => {
    expect(similarity('a b c d', 'a b c e')).toBeCloseTo(0.6, 10);
    expect(similarity('a b', 'a b c d')).toBeCloseTo(0.5, 10);
    expect(similarity('I was waiting', 'I am still waiting')).toBeCloseTo(0.4, 10);
  });

  it('ignores case, spacing and punctuation, so only a change of words lowers it', () => {
    expect(similarity('Thanks for waiting', 'thanks,  for waiting.')).toBe(1);
    expect(similarity("I can't", 'I can\u2019t')).toBe(1);
  });

  it('counts two empty texts as alike, and two different texts without words as not', () => {
    expect(similarity('', '')).toBe(1);
    expect(similarity('...', '...')).toBe(1);
    expect(similarity('...', '!!!')).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------
// Random sentences

const VOCABULARY = [
  'please',
  'could',
  'you',
  'tell',
  'me',
  'when',
  'it',
  'started',
  "don't",
  'don\u2019t',
  'we',
  'check',
  'the',
  'sign-in',
  'logs',
  'now',
  'Maya',
  'I',
  'will',
  'update',
  'by',
  '3pm',
  'café',
  'thanks',
  'for',
  'waiting',
  '🙏',
  '$5',
  '(urgent)',
  // Emoji made of several code points: joined people, a skin tone, a flag and a coloured heart.
  '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}',
  '\u{1F44D}\u{1F3FD}',
  '\u{1F1FA}\u{1F1F8}',
  '\u2764\uFE0F',
];
const GAPS = [
  ' ',
  ' ',
  ' ',
  '  ',
  ', ',
  '. ',
  '? ',
  '! ',
  ' - ',
  '\n',
  '\t',
  '… ',
  ' — ',
  '; ',
  ': ',
  '',
];
const LEADS = ['', '', '', ' ', '\n', '  '];

interface Token {
  word: string;
  gap: string;
}

const recase = (rand: Random, word: string) =>
  rand.pick([
    word,
    word.toUpperCase(),
    word.toLowerCase(),
    word.slice(0, 1).toUpperCase() + word.slice(1),
  ]);

const newToken = (rand: Random): Token => ({
  word: recase(rand, rand.pick(VOCABULARY)),
  gap: rand.pick(GAPS),
});

const render = (lead: string, tokens: readonly Token[]) =>
  lead + tokens.map((token) => token.word + token.gap).join('');

function edit(rand: Random, tokens: readonly Token[]): Token[] {
  const next = tokens.map((token) => ({ ...token }));
  for (let n = rand.int(0, 4); n > 0; n--) {
    const at = rand.int(0, Math.max(0, next.length - 1));
    const target = next[at];
    switch (rand.int(0, 5)) {
      case 0:
        next.splice(at, 1);
        break;
      case 1:
        next.splice(at, 0, newToken(rand));
        break;
      case 2:
        if (target) target.word = recase(rand, rand.pick(VOCABULARY));
        break;
      case 3:
        if (target) target.word = recase(rand, target.word);
        break;
      case 4:
        if (target) target.gap = rand.pick(GAPS);
        break;
      default: {
        const other = next[at + 1];
        if (target && other) [next[at], next[at + 1]] = [other, target];
      }
    }
  }
  return next;
}

function randomPair(rand: Random): [string, string] {
  const roll = rand.next();
  const tokens = Array.from({ length: rand.int(0, 14) }, () => newToken(rand));
  if (roll < 0.8) {
    return [render(rand.pick(LEADS), tokens), render(rand.pick(LEADS), edit(rand, tokens))];
  }
  const other = Array.from({ length: rand.int(0, 14) }, () => newToken(rand));
  if (roll < 0.95) return [render(rand.pick(LEADS), tokens), render(rand.pick(LEADS), other)];
  return rand.chance(0.5) ? ['', render('', tokens)] : [render('', tokens), ''];
}

// What the diff treats as the same text: case and the shape of the apostrophe do not matter.
const fold = (text: string) => text.toLowerCase().replaceAll('\u2019', "'");

const wordList = (text: string) =>
  (text.match(/[\p{L}\p{N}]+(?:['\u2019][\p{L}\p{N}]+)*/gu) ?? []).map(fold);

function longestCommon(a: readonly string[], b: readonly string[]): number {
  let previous = new Array<number>(b.length + 1).fill(0);
  for (const left of a) {
    const row = [0];
    b.forEach((right, j) => {
      row.push(
        left === right ? (previous[j] ?? 0) + 1 : Math.max(previous[j + 1] ?? 0, row[j] ?? 0),
      );
    });
    previous = row;
  }
  return previous[b.length] ?? 0;
}

function eachPair(
  seed: number,
  count: number,
  run: (before: string, after: string, label: string) => void,
) {
  const rand = seeded(seed);
  for (let n = 0; n < count; n++) {
    const [before, after] = randomPair(rand);
    run(before, after, `seed ${seed}, pair ${n}: ${JSON.stringify([before, after])}`);
  }
}

describe('on random sentences', () => {
  it('gives back the new text exactly, and the old text apart from the case of kept words', () => {
    eachPair(201, 600, (before, after, label) => {
      const segments = wordDiff(before, after);
      expect(joined(segments, 'keep', 'add'), label).toBe(after);
      expect(fold(joined(segments, 'keep', 'remove')), label).toBe(fold(before));
    });
  });

  it('keeps spacing and punctuation exactly: only kept words may differ from the old text', () => {
    const lettersOnly = (text: string) => text.replace(/[\p{L}\p{M}\p{N}'\u2019]/gu, '');
    eachPair(202, 600, (before, after, label) => {
      const segments = wordDiff(before, after);
      expect(lettersOnly(joined(segments, 'keep', 'remove')), label).toBe(lettersOnly(before));
    });
  });

  it('returns alternating runs: none empty, none repeated, and removals before additions', () => {
    eachPair(203, 600, (before, after, label) => {
      const segments = wordDiff(before, after);
      segments.forEach((segment, i) => {
        expect(segment.text, label).not.toBe('');
        const next = segments[i + 1];
        if (!next) return;
        expect(next.kind, label).not.toBe(segment.kind);
        expect(segment.kind === 'add' && next.kind === 'remove', label).toBe(false);
      });
    });
  });

  it('never cuts a character or an emoji in half', () => {
    const graphemes = new Intl.Segmenter('en', { granularity: 'grapheme' });
    const edges = (text: string) =>
      new Set([...graphemes.segment(text)].map((part) => part.index).concat(text.length));
    const cuts = (segments: readonly DiffSegment[], ...kinds: DiffKind[]) => {
      let offset = 0;
      return segments
        .filter((segment) => kinds.includes(segment.kind))
        .map((segment) => (offset += segment.text.length));
    };
    eachPair(208, 600, (before, after, label) => {
      const segments = wordDiff(before, after);
      const afterEdges = edges(after);
      for (const cut of cuts(segments, 'keep', 'add')) {
        expect(afterEdges.has(cut), label).toBe(true);
      }
      const beforeEdges = edges(before);
      for (const cut of cuts(segments, 'keep', 'remove')) {
        expect(beforeEdges.has(cut), label).toBe(true);
      }
    });
  });

  it('keeps as many words as any alignment could: it is a longest common subsequence', () => {
    eachPair(204, 600, (before, after, label) => {
      const old = wordList(before);
      const next = wordList(after);
      const common = longestCommon(old, next);
      expect(changeSummary(wordDiff(before, after)), label).toEqual({
        kept: common,
        removed: old.length - common,
        added: next.length - common,
      });
    });
  });

  it('is the same whichever text comes first, and always between 0 and 1', () => {
    eachPair(205, 600, (before, after, label) => {
      const score = similarity(before, after);
      expect(score, label).toBeGreaterThanOrEqual(0);
      expect(score, label).toBeLessThanOrEqual(1);
      expect(similarity(after, before), label).toBe(score);
    });
  });

  it('has nothing to show between a text and itself, or a recased copy of it', () => {
    eachPair(206, 300, (text, _other, label) => {
      expect(wordDiff(text, text), label).toEqual(text === '' ? [] : [keep(text)]);
      expect(similarity(text, text), label).toBe(1);
      const shouted = text.toUpperCase();
      expect(joined(wordDiff(text, shouted), 'keep', 'add'), label).toBe(shouted);
      expect(similarity(text, shouted), label).toBe(1);
    });
  });

  it('gives the same answer every time', () => {
    eachPair(207, 200, (before, after, label) => {
      expect(wordDiff(before, after), label).toEqual(wordDiff(before, after));
    });
  });
});

describe('speed', () => {
  const rand = seeded(301);
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const word = (min: number, max: number) =>
    Array.from({ length: rand.int(min, max) }, () => letters.charAt(rand.int(0, 25))).join('');
  const text = (words: readonly string[]) => words.join(' ').slice(0, 300);

  /** The fastest of several runs, so a busy machine cannot fail a test about the algorithm. */
  function fastest(before: string, after: string): number {
    let best = Infinity;
    for (let run = 0; run < 25; run++) {
      const began = performance.now();
      wordDiff(before, after);
      best = Math.min(best, performance.now() - began);
    }
    return best;
  }

  it('compares two 300-character texts that share half their words in under 5 ms', () => {
    const shared = Array.from({ length: 60 }, () => word(2, 8));
    const before = text(shared);
    const after = text(shared.map((w, i) => (i % 2 === 0 ? w : word(2, 8))));
    expect(before).toHaveLength(300);
    expect(fastest(before, after)).toBeLessThan(5);
  });

  it('compares two 300-character texts of very short, entirely different words in under 5 ms', () => {
    const before = text(Array.from({ length: 151 }, () => `${letters.charAt(rand.int(0, 12))}`));
    const after = text(Array.from({ length: 151 }, () => `${letters.charAt(rand.int(13, 25))}`));
    expect(before).toHaveLength(300);
    expect(fastest(before, after)).toBeLessThan(5);
  });

  it('aligns a thousand words each way, the most it will, in well under a second', () => {
    const vocabulary = Array.from({ length: 60 }, () => word(2, 6));
    const make = () => Array.from({ length: 1000 }, () => rand.pick(vocabulary));
    const before = make();
    const after = make();
    const began = performance.now();
    const segments = wordDiff(before.join(' '), after.join(' '));
    expect(performance.now() - began).toBeLessThan(1000);
    expect(joined(segments, 'keep', 'add')).toBe(after.join(' '));
    expect(changeSummary(segments).kept).toBe(longestCommon(before, after));
  });
});
