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
