// Word budgets for the text a trainee reads. Counting is by words, the way a person reads, so a
// long word never fails a budget the way a character limit can.

export const BUDGETS = {
  /** `summary.overall` */
  summaryWords: 45,
  /** A strength's title and `whyItHelped` together; its quote is not counted. */
  strengthWords: 35,
  /** An improvement's `risk`; its quote and its better wording have budgets of their own. */
  riskWords: 45,
  /** An improvement's `betterPhrasing`: a short rewrite, not a speech. */
  betterPhrasingWords: 45,
  /** A CARE principal's one-sentence summary ("about 25 words"). */
  careSummaryWords: 32,
  maxStrengths: 3,
  maxImprovements: 3,
} as const;

export const wordCount = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

const OPEN_QUOTE = '\u201c';
const CLOSE_QUOTE = '\u201d';

/** Splits at the end of a sentence, but never inside a quotation. */
export function sentencesOf(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] as string;
    if (ch === OPEN_QUOTE) depth += 1;
    else if (ch === CLOSE_QUOTE) depth = Math.max(0, depth - 1);
    else if (depth === 0 && /[.!?]/.test(ch) && /\s/.test(text[i + 1] ?? ' ')) {
      const next = text.slice(i + 1).trimStart()[0];
      if (next === undefined) continue; // the end of the text
      out.push(text.slice(start, i + 1).trim());
      start = i + 1;
    }
  }
  const rest = text.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

const closeQuotes = (text: string): string => {
  const opened = (text.match(/\u201c/g) ?? []).length;
  const closed = (text.match(/\u201d/g) ?? []).length;
  return opened > closed ? `${text}${CLOSE_QUOTE}` : text;
};

/**
 * Cuts `text` to at most `max` words. Whole sentences are kept while they fit; only when the first
 * sentence alone is too long is it cut at a word, with an ellipsis, closing any open quotation.
 */
export function fitWords(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (wordCount(clean) <= max) return clean;
  let out = '';
  for (const sentence of sentencesOf(clean)) {
    const next = out ? `${out} ${sentence}` : sentence;
    if (wordCount(next) > max) break;
    out = next;
  }
  if (out) return out;
  const words = clean.split(' ').slice(0, Math.max(1, max - 1));
  const cut = words.join(' ').replace(/[\s,;:\u2014-]+$/, '');
  return closeQuotes(`${cut}\u2026`);
}

/** The first variant within `max` words, or the last one cut to size. */
export function firstFittingWords(max: number, variants: (string | null)[]): string {
  const usable = variants.filter((v): v is string => typeof v === 'string' && v.length > 0);
  return usable.find((v) => wordCount(v) <= max) ?? fitWords(usable[usable.length - 1] ?? '', max);
}
