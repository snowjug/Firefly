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
  [/\byou're\b/gi, 'you are'],
  [/\bthey're\b/gi, 'they are'],
  [/\bwhat's\b/gi, 'what is'],
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

// Words that make a cue a fixed phrase ("tell your", "who else", "the board"): such a cue only ever
// matches as written, because letting other words in between would match "tell me your name".
const CUE_FUNCTION_WORDS = new Set(
  'the a an your you them it me my our we they their his her its this that these those and or of to for with who what when how'.split(
    ' ',
  ),
);

/**
 * Does the lower-cased text mention the cue? A cue always matches as a plain substring. A cue made
 * of several content words also matches when its words appear in order with at most two other
 * words between them, so "roll back" is found in "roll that change back" and "other device" in
 * "any other kind of device". Each word may continue ("revert" matches "reverting").
 */
export function cueMatches(textLower: string, cue: string): boolean {
  const wanted = cue.trim().toLowerCase();
  if (!wanted) return false;
  if (textLower.includes(wanted)) return true;
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
