// Small text helpers for composing customer lines.

const CONTRACTIONS: [RegExp, string][] = [
  [/\bcan't\b/gi, 'cannot'],
  [/\bwon't\b/gi, 'will not'],
  [/\bdon't\b/gi, 'do not'],
  [/\bdoesn't\b/gi, 'does not'],
  [/\bdidn't\b/gi, 'did not'],
  [/\bisn't\b/gi, 'is not'],
  [/\baren't\b/gi, 'are not'],
  [/\bwasn't\b/gi, 'was not'],
  [/\bweren't\b/gi, 'were not'],
  [/\bhaven't\b/gi, 'have not'],
  [/\bhasn't\b/gi, 'has not'],
  [/\bwouldn't\b/gi, 'would not'],
  [/\bcouldn't\b/gi, 'could not'],
  [/\bI'm\b/g, 'I am'],
  [/\bI've\b/g, 'I have'],
  [/\bI'll\b/g, 'I will'],
  [/\bI'd\b/g, 'I would'],
  [/\bit's\b/gi, 'it is'],
  [/\bthat's\b/gi, 'that is'],
  [/\bthere's\b/gi, 'there is'],
  [/\bwe're\b/gi, 'we are'],
  [/\bwe've\b/gi, 'we have'],
  [/\bwe'll\b/gi, 'we will'],
  [/\bwe'd\b/gi, 'we would'],
  [/\byou're\b/gi, 'you are'],
  [/\byou'll\b/gi, 'you will'],
  [/\byou've\b/gi, 'you have'],
  [/\byou'd\b/gi, 'you would'],
  [/\bthey're\b/gi, 'they are'],
  [/\bthey'll\b/gi, 'they will'],
  [/\bthey've\b/gi, 'they have'],
  [/\bthey'd\b/gi, 'they would'],
  [/\bhe'll\b/gi, 'he will'],
  [/\bshe'll\b/gi, 'she will'],
  [/\bshouldn't\b/gi, 'should not'],
  [/\bmustn't\b/gi, 'must not'],
  [/\bhadn't\b/gi, 'had not'],
  [/\bcould've\b/gi, 'could have'],
  [/\bwould've\b/gi, 'would have'],
  [/\bshould've\b/gi, 'should have'],
  [/\bwhat's\b/gi, 'what is'],
  [/\bwho's\b/gi, 'who is'],
  [/\bhere's\b/gi, 'here is'],
  [/\bhow's\b/gi, 'how is'],
  [/\bwhere's\b/gi, 'where is'],
  [/\blet's\b/gi, 'let us'],
];

/** Plain-language form used for non-native speakers: spoken contractions are written out. */
export function expandContractions(text: string): string {
  let out = text.replace(/[\u2019]/g, "'");
  for (const [pattern, replacement] of CONTRACTIONS) {
    out = out.replace(pattern, (match) =>
      match[0] === match[0]?.toUpperCase()
        ? replacement[0]?.toUpperCase() + replacement.slice(1)
        : replacement,
    );
  }
  return out;
}

export function ensureSentence(s: string): string {
  const t = s.trim();
  if (!t) return '';
  return /[.!?\u2026]["')]?$/.test(t) ? t : `${t}.`;
}

export function joinSentences(parts: string[]): string {
  return parts.map(ensureSentence).filter(Boolean).join(' ');
}

export function wordCount(s: string): number {
  return (s.match(/\S+/g) ?? []).length;
}

export function firstSentenceOf(s: string): string {
  const m = s.trim().match(/^.*?[.!?](?=\s|$)/);
  return (m ? m[0] : s).trim();
}

export function capFirst(s: string): string {
  return s ? s[0]?.toUpperCase() + s.slice(1) : s;
}

const QUANTITY_QUESTION =
  /\bhow (?:many|much|long|often|big|large|old)\b|\bnumber of\b|\bhow few\b/i;
const QUANTITY =
  /\d|\b(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozen|twenty|thirty|forty|fifty|hundred|thousand|couple|few|several)\b/i;

/** The question asks for an amount: how many, how much, how long. */
export function asksQuantity(question: string): boolean {
  return QUANTITY_QUESTION.test(question);
}

/** The line gives an amount: a number, or a word for one. */
export function givesQuantity(text: string): boolean {
  return QUANTITY.test(text);
}

/**
 * The sentence of an answer that best answers a question: the one that shares the most of its
 * words, and gives an amount when an amount was asked for. The first sentence when none stands out.
 */
export function bestSentenceFor(answer: string, question: string): string {
  const parts = answer
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter((part) => part.trim() !== '');
  if (parts.length < 2) return answer.trim();
  const wanted = new Set(questionWords(question));
  const quantity = asksQuantity(question);
  let best = parts[0] as string;
  let bestScore = -1;
  for (const part of parts) {
    const shared = questionWords(part).filter((word) => wanted.has(word)).length;
    const score = shared + (quantity && givesQuantity(part) ? 2 : 0);
    if (score > bestScore) {
      best = part;
      bestScore = score;
    }
  }
  return best;
}

/** Lower-cases the first letter so a sentence can follow "As I said, ". "I" and names stay. */
export function lowerFirst(s: string, keep: readonly string[] = []): string {
  const word = s.match(/^[A-Za-z]+(?:'[a-z]+)?/)?.[0] ?? '';
  if (!word || word === 'I' || /^I'/.test(word) || keep.includes(word)) return s;
  return s[0]?.toLowerCase() + s.slice(1);
}

const QUESTION_STOP = new Set(
  "what when where which who whom whose how why can could would will shall should you your yours are were was did does the and for with that this these those have has had tell please about there anything any can't don't didn't isn't aren't i'm i've it's that's you're you've let know mind also just still really kind sort".split(
    ' ',
  ),
);

function stemWord(raw: string): string {
  const word = raw.replace(/'s$/, '');
  if (word.length > 5) {
    for (const suffix of ['ing', 'ed', 'es', 's']) {
      if (word.endsWith(suffix) && word.length - suffix.length >= 4)
        return word.slice(0, -suffix.length);
    }
  } else if (word.length > 4 && word.endsWith('s') && !word.endsWith('ss')) {
    return word.slice(0, -1);
  }
  return word;
}

/** The content words of a question, lightly stemmed, so two questions can be compared. */
export function questionWords(text: string): string[] {
  const words =
    text
      .toLowerCase()
      .replace(/[\u2018\u2019]/g, "'")
      .match(/[a-z][a-z0-9']*/g) ?? [];
  return [...new Set(words.filter((w) => w.length > 2 && !QUESTION_STOP.has(w)).map(stemWord))];
}

/** Shared share of two word lists: 1 for the same words, 0 for none in common. */
export function overlap(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const set = new Set(a);
  const shared = b.filter((w) => set.has(w)).length;
  return shared / (a.length + b.length - shared);
}

// Words that say how much or how, not what: they are left out when two lines are compared for
// saying the same thing, so that "some browser tabs" and "a few tabs" are the same tabs.
const FILLER_WORDS = new Set(
  'some few but much made real many lot bit little quite very each every such more most only even then than over into from when while after before'.split(
    ' ',
  ),
);

/**
 * Whether two lines say the same thing, even when one is a paraphrase of the other: they share
 * most of the content words of the shorter one. Two authors' wordings of one event do not match
 * word for word, so the plain overlap of the two lines is not enough.
 */
export function saysTheSame(a: string, b: string): boolean {
  const x = questionWords(a);
  const y = questionWords(b);
  const small = Math.min(x.length, y.length);
  if (small === 0) return false;
  if (overlap(x, y) >= 0.45) return true;
  const keep = (words: string[]) => words.filter((w) => !FILLER_WORDS.has(w));
  const [cx, cy] = [keep(x), keep(y)];
  const smaller = Math.min(cx.length, cy.length);
  const shared = cy.filter((w) => cx.includes(w)).length;
  return (smaller >= 3 && shared / smaller >= 0.6) || (shared >= 5 && shared / smaller >= 0.45);
}

const UNITS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

/** Numbers written as digits or in words ("27", "twenty-seven"), in the order they appear. */
export function numbersIn(text: string): number[] {
  const lower = text.toLowerCase().replace(/-/g, ' ');
  const found: { at: number; value: number }[] = [];
  for (const m of lower.matchAll(/\b\d+(?:\.\d+)?\b/g))
    found.push({ at: m.index, value: Number(m[0]) });
  const words = [...lower.matchAll(/[a-z]+/g)];
  for (let i = 0; i < words.length; i++) {
    const word = words[i]?.[0] ?? '';
    const at = words[i]?.index ?? 0;
    if (word in TENS) {
      const next = words[i + 1]?.[0] ?? '';
      const unit = UNITS[next];
      if (unit !== undefined && unit >= 1 && unit <= 9) {
        found.push({ at, value: (TENS[word] ?? 0) + unit });
        i++;
      } else {
        found.push({ at, value: TENS[word] ?? 0 });
      }
    } else if (word in UNITS) {
      found.push({ at, value: UNITS[word] ?? 0 });
    }
  }
  return found.sort((a, b) => a.at - b.at).map((f) => f.value);
}

const COUNTED =
  /\b(\d{1,5}|(?:(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[ -](?:one|two|three|four|five|six|seven|eight|nine))?|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen))\s+(?:more\s+|other\s+)?(?:users?|people|staff|colleagues|employees|members|accounts|devices|laptops|machines|sites|offices|customers|clients|mailboxes|licen[cs]es|of us|of you|of them)\b/g;

/** How many people or things a message says are affected ("27 users"), or null when it gives no count. */
export function countedIn(text: string): number | null {
  const counts: number[] = [];
  for (const m of text.toLowerCase().matchAll(COUNTED)) counts.push(...numbersIn(m[1] ?? ''));
  return counts.length > 0 ? (counts[0] ?? null) : null;
}

// Words that make a cue a fixed phrase ("tell your", "who else", "the board"): such a cue only ever
// matches as written, because letting other words in between would match "tell me your name".
const CUE_FUNCTION_WORDS = new Set(
  'the a an your you them it me my our we they their his her its this that these those and or of to for with who what when how'.split(
    ' ',
  ),
);

const cueExpressions = new Map<string, RegExp>();

/** The cue as it must appear in text: starting at the start of a word. */
function cueAtWordStart(cue: string): RegExp {
  let expression = cueExpressions.get(cue);
  if (!expression) {
    expression = new RegExp(`(?<![a-z0-9])${cue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
    cueExpressions.set(cue, expression);
  }
  return expression;
}

/**
 * Does the lower-cased text mention the cue? A cue matches where it starts at the start of a word,
 * and it may continue: "reinstall" matches "reinstalled" and "change" matches "changed", but
 * "change" does not match "exchange", "cause" does not match "because" and "load" does not match
 * "upload". A cue made of several content words also matches when its words appear in order with
 * at most two other words between them, so "roll back" is found in "roll that change back" and
 * "other device" in "any other kind of device". Each of those words may continue as well
 * ("revert" matches "reverting").
 */
export function cueMatches(textLower: string, cue: string): boolean {
  const wanted = cue.trim().toLowerCase();
  if (!wanted) return false;
  if (cueAtWordStart(wanted).test(textLower)) return true;
  const words = wanted.split(/\s+/);
  if (words.length < 2 || words.some((word) => CUE_FUNCTION_WORDS.has(word))) return false;
  const tokens = textLower.match(/[a-z0-9']+/g) ?? [];
  const startsWithWord = (token: string | undefined, word: string | undefined) =>
    token !== undefined && word !== undefined && token.startsWith(word);
  for (let first = 0; first < tokens.length; first++) {
    if (!startsWithWord(tokens[first], words[0])) continue;
    let at = first;
    let matched = true;
    for (let next = 1; next < words.length && matched; next++) {
      let found = -1;
      for (let gap = 1; gap <= 3 && at + gap < tokens.length; gap++) {
        if (startsWithWord(tokens[at + gap], words[next])) {
          found = at + gap;
          break;
        }
      }
      if (found < 0) matched = false;
      else at = found;
    }
    if (matched) return true;
  }
  return false;
}

/**
 * Asking how to reach the customer ("your best phone number", "this phone call") is not asking
 * about a phone or any other device, so it is removed before device cues are looked for.
 */
export function withoutContactTalk(textLower: string): string {
  return textLower.replace(
    /\b(?:phone|mobile|cell|telephone|contact|call-?back|direct)\s+(?:number|numbers|no\.?|details|line)\b|\b(?:phone|telephone)\s+(?:call|conversation)\b/g,
    ' ',
  );
}

const STOP_WORDS = new Set(
  'the and but for with that this our your you are was were have has had not can cannot will would just now its from they them then than into out all any too very'.split(
    ' ',
  ),
);

function contentWords(sentence: string): Set<string> {
  const words = sentence.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) ?? [];
  return new Set(
    words
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
      .map((w) => (w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w)),
  );
}

/**
 * Drops a sentence that mostly repeats an earlier one. Customer openings are assembled from several
 * authored pieces (the problem, its impact, a belief the customer holds), and pieces written
 * separately can say nearly the same thing twice. Short sentences are never compared.
 */
export function dropRedundantSentences(parts: string[]): string[] {
  const kept: { text: string; words: Set<string> }[] = [];
  const out: string[] = [];
  for (const part of parts) {
    const sentences = part.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
    const keptHere: string[] = [];
    for (const sentence of sentences) {
      const words = contentWords(sentence);
      const repeats =
        words.size >= 4 &&
        kept.some((earlier) => {
          if (earlier.words.size < 4) return false;
          let shared = 0;
          for (const w of words) if (earlier.words.has(w)) shared++;
          return shared / (words.size + earlier.words.size - shared) >= 0.5;
        });
      if (repeats) continue;
      kept.push({ text: sentence, words });
      keptHere.push(sentence);
    }
    if (keptHere.length > 0) out.push(keptHere.join(' '));
  }
  return out;
}
