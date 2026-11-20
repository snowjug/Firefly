// A word-level diff for the debrief's "better wording" view: what the trainee said, what could be
// said instead, and which words carry over. It compares whole words, not characters, so a small
// edit reads as a small change.
//
// A word is a run of letters and digits; an apostrophe between two of them stays inside it, so
// "don't" is one word. Words compare without regard to case or the shape of the apostrophe, and
// kept words are written as they appear in `after`. Everything between words (spaces, punctuation)
// is carried over exactly and only its differences are marked, so a changed comma is a change of
// one character, not of a word. Reading the result back:
//
//   keep + add     is `after`, exactly
//   keep + remove  is `before`, apart from the case and apostrophes of kept words

export type DiffKind = 'keep' | 'remove' | 'add';

export interface DiffSegment {
  kind: DiffKind;
  text: string;
}

export interface ChangeSummary {
  kept: number;
  removed: number;
  added: number;
}

// Marks may only follow a letter or digit, so a stray combining mark (an emoji variation selector,
// say) is never mistaken for a word of its own.
const WORD = /[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:['\u2019\u02BC][\p{L}\p{N}][\p{L}\p{M}\p{N}]*)*/gu;

/**
 * The pieces a stretch between words is read in when looking for what two versions share: a word
 * (never shared), a single space or punctuation mark, or a whole run of anything else (symbols,
 * emoji and the joiners and marks that bind them). A run is shared or replaced as one, so a changed
 * emoji shows as one change and no emoji, surrogate pair or joined sequence is ever cut in half.
 */
const PIECE = /[\p{L}\p{N}][\p{L}\p{M}\p{N}]*|[\s\p{P}]|[^\s\p{P}\p{L}\p{N}]+/gu;
const isWordPiece = (piece: string) => /^[\p{L}\p{N}]/u.test(piece);

/** Above this many cells the stretch between a shared start and end is replaced, not aligned. */
const MAX_TABLE_CELLS = 1_000_000;

interface Word {
  key: string;
  start: number;
  end: number;
}

const keyOf = (word: string) => word.toLowerCase().replace(/[\u2019\u02BC]/g, "'");

function wordsOf(text: string): Word[] {
  return Array.from(text.matchAll(WORD), (match) => ({
    key: keyOf(match[0]),
    start: match.index,
    end: match.index + match[0].length,
  }));
}

/**
 * Which words carry over, as pairs of positions in `before` and `after`: a longest common
 * subsequence. Words shared at the start and end are matched first, which is nearly always most of
 * them, so the table only covers what is left. Among equally long matches the earliest wins.
 */
function carriedOver(before: readonly Word[], after: readonly Word[]): [number, number][] {
  const ids = new Map<string, number>();
  const intern = (words: readonly Word[]) =>
    Int32Array.from(words, ({ key }) => {
      const known = ids.get(key);
      if (known !== undefined) return known;
      ids.set(key, ids.size);
      return ids.size - 1;
    });
  const a = intern(before);
  const b = intern(after);

  const pairs: [number, number][] = [];
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) {
    pairs.push([head, head]);
    head++;
  }
  let tailA = a.length;
  let tailB = b.length;
  while (tailA > head && tailB > head && a[tailA - 1] === b[tailB - 1]) {
    tailA--;
    tailB--;
  }

  const rows = tailA - head;
  const cols = tailB - head;
  if (rows > 0 && cols > 0 && rows * cols <= MAX_TABLE_CELLS) {
    // common[i * width + j]: how many words a[head + i..] and b[head + j..] have in common.
    const width = cols + 1;
    const common = new Uint16Array((rows + 1) * width);
    const at = (i: number, j: number) => common[i * width + j] ?? 0;
    for (let i = rows - 1; i >= 0; i--) {
      for (let j = cols - 1; j >= 0; j--) {
        common[i * width + j] =
          a[head + i] === b[head + j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
      }
    }
    let i = 0;
    let j = 0;
    while (i < rows && j < cols) {
      if (a[head + i] === b[head + j]) {
        pairs.push([head + i, head + j]);
        i++;
        j++;
      } else if (at(i + 1, j) >= at(i, j + 1)) {
        i++;
      } else {
        j++;
      }
    }
  }

  for (let k = 0; tailA + k < a.length; k++) pairs.push([tailA + k, tailB + k]);
  return pairs;
}

/** Appends a segment, merging it into the previous one of the same kind. Empty text is dropped. */
function push(out: DiffSegment[], kind: DiffKind, text: string): void {
  if (text === '') return;
  const last = out[out.length - 1];
  if (last?.kind === kind) last.text += text;
  else out.push({ kind, text });
}

/** How many pieces two lists share at their start, stopping at a word and at `limit`. */
function sharedStart(a: readonly string[], b: readonly string[], limit: number): number {
  let count = 0;
  while (count < limit) {
    const piece = a[count];
    if (piece === undefined || piece !== b[count] || isWordPiece(piece)) break;
    count++;
  }
  return count;
}

/**
 * The text between two carried-over words (or before the first, or after the last). Spacing,
 * punctuation and symbols shared at either end are kept; what is left between them was removed
 * from `before` and added in `after`.
 */
function pushBetween(out: DiffSegment[], before: string, after: string): void {
  if (before === after) {
    push(out, 'keep', after);
    return;
  }
  const a = before.match(PIECE) ?? [];
  const b = after.match(PIECE) ?? [];
  const room = Math.min(a.length, b.length);
  const start = sharedStart(a, b, room);
  const end = sharedStart([...a].reverse(), [...b].reverse(), room - start);
  push(out, 'keep', b.slice(0, start).join(''));
  push(out, 'remove', a.slice(start, a.length - end).join(''));
  push(out, 'add', b.slice(start, b.length - end).join(''));
  push(out, 'keep', b.slice(b.length - end).join(''));
}

/**
 * How `before` becomes `after`, as alternating runs: what stays, what goes and what comes in.
 * Between two kept runs there is at most one removed run, followed by at most one added run, and
 * no run is empty. Very large inputs (over a thousand words each way) are not aligned word by
 * word: whatever lies between their shared start and end is shown as replaced.
 */
export function wordDiff(before: string, after: string): DiffSegment[] {
  if (before === after) return before === '' ? [] : [{ kind: 'keep', text: before }];

  const oldWords = wordsOf(before);
  const newWords = wordsOf(after);
  const out: DiffSegment[] = [];
  let oldAt = 0;
  let newAt = 0;
  for (const [i, j] of carriedOver(oldWords, newWords)) {
    const old = oldWords[i] as Word;
    const next = newWords[j] as Word;
    pushBetween(out, before.slice(oldAt, old.start), after.slice(newAt, next.start));
    push(out, 'keep', after.slice(next.start, next.end));
    oldAt = old.end;
    newAt = next.end;
  }
  pushBetween(out, before.slice(oldAt), after.slice(newAt));
  return out;
}

/** The number of words in some text, by the same definition the diff uses. */
const countWords = (text: string) => text.match(WORD)?.length ?? 0;

/**
 * How many words were kept, removed and added. Only words count: a changed comma or a new space
 * is a visible change in the diff, but not a change of wording.
 */
export function changeSummary(segments: readonly DiffSegment[]): ChangeSummary {
  const summary: ChangeSummary = { kept: 0, removed: 0, added: 0 };
  for (const { kind, text } of segments) {
    const words = countWords(text);
    if (kind === 'keep') summary.kept += words;
    else if (kind === 'remove') summary.removed += words;
    else summary.added += words;
  }
  return summary;
}

/**
 * How much of the wording carries over, from 0 (nothing) to 1 (every word): the kept words as a
 * share of all the words in the diff. Case, spacing and punctuation do not count, so only a
 * change of words lowers it. It is the same whichever text comes first. Two texts with no words
 * at all are alike (1) only when nothing differs between them.
 */
export function similarity(before: string, after: string): number {
  const segments = wordDiff(before, after);
  const { kept, removed, added } = changeSummary(segments);
  const total = kept + removed + added;
  if (total === 0) return segments.every((segment) => segment.kind === 'keep') ? 1 : 0;
  return kept / total;
}
