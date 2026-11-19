// Text helpers used for safety (redaction, sanitising model output) and for evidence matching.

export const MAX_MESSAGE_CHARS = 1500;

/** Collapses whitespace and trims. */
export function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

/** Lower-cases and strips punctuation and typographic quotes, for forgiving comparisons. */
export function fold(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\u2018\u2019\u201a\u201b]/g, "'")
    .replace(/[\u201c\u201d\u201e\u201f]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when `quote` appears in `turnText` (ignoring case, punctuation and spacing). */
export function quoteInText(turnText: string, quote: string): boolean {
  const q = fold(quote);
  if (q.length < 3) return false;
  return fold(turnText).includes(q);
}

export function truncate(input: string, max: number): string {
  const text = normalizeWhitespace(input);
  if (text.length <= max) return text;
  const cut = text.slice(0, Math.max(1, max - 1));
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + '\u2026';
}

/** Splits text into sentences (simple and predictable; not linguistically perfect). */
export function sentences(input: string): string[] {
  return normalizeWhitespace(input)
    .split(/(?<=[.!?])\s+(?=[A-Z"'\u201c(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function firstSentence(input: string): string {
  return sentences(input)[0] ?? normalizeWhitespace(input);
}

/** Picks the sentence of `input` that best contains `needle` (for short, relevant quotes). */
export function sentenceContaining(input: string, needle: RegExp): string | null {
  for (const s of sentences(input)) if (needle.test(s)) return s;
  return null;
}

/**
 * Cleans text produced by a model before it is stored or shown: removes HTML, markdown links,
 * images and code fences, control characters and speaker labels, then limits its length.
 * The web app additionally renders everything as plain text (never as HTML).
 */
export function sanitizeModelText(input: string, maxLen = 1200): string {
  let text = input
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|\s)[*_]{1,2}([^*_]+)[*_]{1,2}(?=\s|$)/g, '$1$2')
    .replace(/^\s*(customer|trainee|assistant|user)\s*:\s*/i, '');
  text = normalizeWhitespace(text);
  return text.length > maxLen ? truncate(text, maxLen) : text;
}

// ---------------------------------------------------------------------------------------
// Sensitive-data redaction. Firefly is for fictional scenarios only; if a trainee types
// something that looks like real contact or payment data, it is replaced before storage and
// before it reaches any model.

export type RedactionKind = 'email' | 'phone' | 'card' | 'id';

export function redactSensitive(input: string): { text: string; redactions: RedactionKind[] } {
  const found = new Set<RedactionKind>();
  let text = input;
  text = text.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, () => {
    found.add('email');
    return '[email removed]';
  });
  text = text.replace(/\b(?:\d[ -]?){13,19}\b/g, (match) => {
    const digits = match.replace(/\D/g, '');
    if (digits.length >= 13 && digits.length <= 19) {
      found.add('card');
      return '[number removed]';
    }
    return match;
  });
  text = text.replace(
    /(?<![\w])(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?)?\d{3,4}[\s.-]\d{3,4}(?:[\s.-]\d{2,4})?(?![\w])/g,
    (match) => {
      const digits = match.replace(/\D/g, '');
      if (digits.length >= 9 && digits.length <= 15) {
        found.add('phone');
        return '[phone removed]';
      }
      return match;
    },
  );
  text = text.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, () => {
    found.add('id');
    return '[id removed]';
  });
  return { text, redactions: [...found] };
}

/** Light client-side check used to warn the trainee before they send. */
export function looksSensitive(input: string): RedactionKind[] {
  return redactSensitive(input).redactions;
}

export const REDACTION_LABELS: Record<RedactionKind, string> = {
  email: 'an email address',
  phone: 'a phone number',
  card: 'a long number',
  id: 'an identifier',
};
