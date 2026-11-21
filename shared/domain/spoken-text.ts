// What is read aloud.
//
// The customer's lines are written by a model and checked on the server before they are stored, but
// what reaches a voice is cleaned once more here, by the server and by the browser's own voices
// alike: a voice must never read markdown, a JSON object, a stage direction, a note meant for the
// simulation or a speaker label. Only what is plainly not speech is removed, so a line that is
// already plain comes out as it went in. Nothing here changes the stored line.
//
// This is its own module on purpose: only the call page and the server speak, so the first load of
// the web app must not carry these patterns (see voices.ts, and web/src/features/voice/entry-weight.test.ts).

const MAX_SPOKEN_INPUT = 10_000;
const MAX_STRUCTURE_CHARS = 2_000;

const CODE_FENCE = /```[\s\S]*?(?:```|$)/g;
const MARKDOWN_IMAGE = /!\[[^\]\n]*\]\([^)\n]*\)/g;
const MARKDOWN_LINK = /\[([^\]\n]+)\]\([^)\n]*\)/g;
// An address, up to the last character that is not punctuation, so a full stop after it stays.
const WEB_ADDRESS = /\b(?:https?:\/\/|www\.)[^\s<>"]*[^\s<>".,;:!?)\]]/gi;
const MARKUP_TAG = /<\/?[A-Za-z][\w:-]*(?:\s[^<>\n]*)?\/?>/g;
// What the redaction step writes in place of an email address, a phone number or an identifier.
const REDACTION_NOTE = /\[(?:email|phone|number|id) removed\]/gi;
// (mood: angry), [temperature=72], {state: calm}: a key, a colon or equals sign, then a short value.
const METADATA_GROUP = /[[({]\s*[A-Za-z_][\w-]{0,20}\s*[:=][^\])}\n]{0,80}[\])}]/g;
const METADATA_LINE =
  /^[ \t]*(?:mood|state|temperature|emotion|tone|style|intensity|voice|speaker|role|turn|metadata|meta|status|stage)[ \t]*[:=].*$/gim;
const ROLE_LABEL =
  /(^|\n)[ \t]*[*_]{0,3}(?:customer|caller|client|trainee|agent|support|engineer|assistant|user|system|narrator|ai)(?:[ \t]*\([^)\n]{1,24}\))?[*_]{0,3}[ \t]*:[*_]{0,3}[ \t]*/gi;

// A stage direction is a word or two in asterisks, brackets or parentheses, such as *sighs* or
// (long pause). Only one that stands alone is removed: at the start or end of the line, or on its
// own at the edge of a sentence. A word in asterisks inside a sentence is emphasis and stays, and a
// longer aside in parentheses is something the customer said.
const WORD = String.raw`[A-Za-z][A-Za-z']{2,20}`;
const direction = (body: string) => String.raw`(?:\*(?!\*)${body}\*(?!\*)|\(${body}\)|\[${body}\])`;
const SHORT_DIRECTION = direction(String.raw`${WORD}(?: ${WORD})?`);
const LONG_DIRECTION = direction(String.raw`${WORD}(?: ${WORD}){0,4}`);
const DIRECTION_STARTS_SENTENCE = new RegExp(
  String.raw`(^|[.!?\u2026]["')\]]?[ \t]+|\n[ \t]*)${SHORT_DIRECTION}(?=[ \t]|\n|$)[ \t]*`,
  'g',
);
const DIRECTION_ENDS_SENTENCE = new RegExp(
  String.raw`[ \t]+${SHORT_DIRECTION}(?=[.!?\u2026]+(?:[ \t]|\n|$))`,
  'g',
);
const DIRECTION_LEADS_TEXT = new RegExp(String.raw`^\s*${LONG_DIRECTION}\s*`);
const DIRECTION_TRAILS_TEXT = new RegExp(String.raw`\s*${LONG_DIRECTION}\s*$`);

const EMPHASIS = /(\*{1,3}|_{1,3}|~~)(?=\S)([^*_~\n]+?)(?<=\S)\1/g;
const LINE_MARKER = /^[ \t]*(?:#{1,6}|>|[-*\u2022]|\d{1,2}[.)])[ \t]+/gm;
const EMOJI = /[\p{Extended_Pictographic}\uFE0F\u200D]/gu;

// The index of the bracket that closes the one at `start`, looking no further than a short way and
// knowing about quoted strings, or -1.
function closingBracket(text: string, start: number): number {
  const limit = Math.min(text.length, start + MAX_STRUCTURE_CHARS);
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < limit; i++) {
    const ch = text[i] as string;
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '{' || ch === '[') {
      depth++;
    } else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function looksLikeData(span: string): boolean {
  if (/(["'])[^"'\n]{1,60}\1\s*:/.test(span)) return true;
  try {
    const value: unknown = JSON.parse(span);
    return typeof value === 'object' && value !== null;
  } catch {
    return false;
  }
}

/** Removes anything that looks like a JSON object or array, such as {"mood": "angry"}. */
function withoutData(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i] as string;
    if (ch === '{' || ch === '[') {
      const end = closingBracket(text, i);
      if (end !== -1 && looksLikeData(text.slice(i, end + 1))) {
        out += ' ';
        i = end + 1;
        continue;
      }
    }
    out += ch;
    i++;
  }
  return out;
}

/**
 * The words a voice should say for a customer's line: markdown, links and addresses, JSON, HTML-like
 * tags, stage directions, notes meant for the simulation, speaker labels and emoji are taken out,
 * and the result is on one line with single spaces. A line that is already plain speech is returned
 * unchanged, and running this again changes nothing.
 */
export function toSpokenText(input: string): string {
  let text = input
    .slice(0, MAX_SPOKEN_INPUT)
    .replace(/\r\n?/g, '\n')
    .replace(CODE_FENCE, ' ')
    .replace(MARKDOWN_IMAGE, ' ')
    .replace(MARKDOWN_LINK, '$1')
    // Tags go before addresses, so an address inside a tag's attribute takes the tag with it.
    .replace(MARKUP_TAG, ' ')
    .replace(WEB_ADDRESS, ' ');
  text = withoutData(text)
    .replace(REDACTION_NOTE, ' ')
    .replace(METADATA_LINE, ' ')
    .replace(METADATA_GROUP, ' ')
    .replace(ROLE_LABEL, '$1');
  for (let i = 0; i < 3; i++) {
    text = text
      .replace(DIRECTION_STARTS_SENTENCE, '$1')
      .replace(DIRECTION_ENDS_SENTENCE, '')
      .replace(DIRECTION_LEADS_TEXT, '')
      .replace(DIRECTION_TRAILS_TEXT, '');
  }
  return text
    .replace(EMPHASIS, '$2')
    .replace(LINE_MARKER, '')
    .replace(EMOJI, '')
    .replace(/[*_`~#|\\^]+/g, ' ')
    .replace(/([^.!?\u2026:;,\s])[ \t]*\n+[ \t]*/g, '$1. ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .trim();
}
