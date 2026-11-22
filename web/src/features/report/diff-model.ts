import { fold } from '#shared/domain/text.ts';

// A word-level difference between what was said and the better wording, for the "Better wording"
// component. It never touches the transcript: it only says which words of each line to mark.
//
// Words are compared by what they say: case and the punctuation around a word do not make it a
// different word ("Wait." and "wait" are the same), so a change of capital or comma is not drawn as
// a removed word and an added one. The longest common subsequence of words is kept; everything else
// is removed from the original or added to the improvement.

export type DiffKind = 'same' | 'removed' | 'added';

/** A stretch of words that share one kind, with the space that followed it left outside the mark. */
export interface DiffRun {
  kind: DiffKind;
  text: string;
  /** The white space after the run (nothing at the end), kept out of the marked text. */
  gap: string;
}

export interface WordDiff {
  /** The original, in order: `same` and `removed` runs. Empty for an omission. */
  before: DiffRun[];
  /** The improved wording, in order: `same` and `added` runs. */
  after: DiffRun[];
  /** False when the two say the same words. */
  changed: boolean;
}

interface Token {
  /** The word as written, punctuation and all. */
  word: string;
  /** What decides whether two words are the same word. */
  key: string;
  /** The white space after it. */
  gap: string;
}

function tokenise(text: string): Token[] {
  return [...text.trim().matchAll(/(\S+)(\s*)/g)].map((match) => {
    const word = match[1] as string;
    return { word, key: fold(word) || word, gap: match[2] as string };
  });
}

type Op =
  | { kind: 'same'; a: number; b: number }
  | { kind: 'removed'; a: number }
  | { kind: 'added'; b: number };

/** Beyond this many comparisons the two are treated as different wording altogether. */
const MAX_CELLS = 250_000;

function operations(a: readonly Token[], b: readonly Token[]): Op[] {
  const n = a.length;
  const m = b.length;
  if (n * m > MAX_CELLS) {
    return [
      ...a.map((_, i): Op => ({ kind: 'removed', a: i })),
      ...b.map((_, j): Op => ({ kind: 'added', b: j })),
    ];
  }
  // common[i][j]: how many words the tails a[i..] and b[j..] have in common, in order.
  const common = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      common[i][j] =
        a[i].key === b[j].key
          ? common[i + 1][j + 1] + 1
          : Math.max(common[i + 1][j], common[i][j + 1]);
    }
  }
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i].key === b[j].key) {
      ops.push({ kind: 'same', a: i, b: j });
      i += 1;
      j += 1;
    } else if (common[i + 1][j] >= common[i][j + 1]) {
      ops.push({ kind: 'removed', a: i });
      i += 1;
    } else {
      ops.push({ kind: 'added', b: j });
      j += 1;
    }
  }
  for (; i < n; i += 1) ops.push({ kind: 'removed', a: i });
  for (; j < m; j += 1) ops.push({ kind: 'added', b: j });
  return ops;
}

/**
 * A single short word that two changed stretches share ("to", "a", "you") is not worth keeping as
 * common ground: it would cut one clear replacement into pieces. It is shown as changed instead.
 */
function dropIsolatedSmallWords(ops: readonly Op[], a: readonly Token[]): Op[] {
  return ops.flatMap((op, at): Op[] => {
    const before = ops[at - 1];
    const after = ops[at + 1];
    const isolated =
      op.kind === 'same' &&
      before !== undefined &&
      before.kind !== 'same' &&
      after !== undefined &&
      after.kind !== 'same';
    return isolated && a[op.a].key.length <= 3
      ? [
          { kind: 'removed', a: op.a },
          { kind: 'added', b: op.b },
        ]
      : [op];
  });
}

function runsOf(tokens: readonly { token: Token; kind: DiffKind }[]): DiffRun[] {
  const merged: DiffRun[] = [];
  for (const { token, kind } of tokens) {
    const last = merged[merged.length - 1];
    if (last && last.kind === kind) {
      last.text += `${last.gap}${token.word}`;
      last.gap = token.gap;
    } else {
      merged.push({ kind, text: token.word, gap: token.gap });
    }
  }
  return merged;
}

/**
 * Compares the original wording with the improved one, word by word. The original keeps its `same`
 * and `removed` runs, the improvement its `same` and `added` runs. With nothing said before (an
 * omission) the whole improvement is added.
 */
export function diffWords(original: string, improved: string): WordDiff {
  const a = tokenise(original);
  const b = tokenise(improved);
  const ops = dropIsolatedSmallWords(operations(a, b), a);
  const before = runsOf(
    ops.flatMap((op) =>
      op.kind === 'added'
        ? []
        : [{ token: a[op.a], kind: op.kind === 'same' ? ('same' as const) : ('removed' as const) }],
    ),
  );
  const after = runsOf(
    ops.flatMap((op) =>
      op.kind === 'removed'
        ? []
        : [{ token: b[op.b], kind: op.kind === 'same' ? ('same' as const) : ('added' as const) }],
    ),
  );
  return { before, after, changed: ops.some((op) => op.kind !== 'same') };
}
