// Text handling for the customer's voice: cleaning what is spoken, cutting it at sentence ends so a
// browser voice never has to speak more than a few seconds at a time, estimating how long it takes,
// and shaping a believable level meter from the words when the audio itself cannot be measured.
// Pure functions.

import { toSpokenText } from '#shared/domain/spoken-text.ts';

// The server already sends plain speech, and cleans it with the same shared function (markdown,
// JSON, stage directions, notes for the simulation, speaker labels); this is a second net for
// anything that reached the browser's own voices, with a few browser-only extras. Like the server,
// only actions at the very start or end go: *emphasis* inside a sentence is kept.
const DIRECTION = String.raw`(?:\*(?!\*)[^*\n]{1,80}\*(?!\*)|\([A-Za-z][A-Za-z' -]{0,30}\)|\[[A-Za-z][A-Za-z' -]{0,30}\])`;
const LEADING_DIRECTION = new RegExp(String.raw`^\s*${DIRECTION}\s*`);
const TRAILING_DIRECTION = new RegExp(String.raw`\s*${DIRECTION}\s*$`);

/** Removes markdown, links, JSON, emoji, stage directions and speaker labels so that the voice reads only what was said. */
export function cleanForSpeech(text: string): string {
  let cleaned = toSpokenText(text);
  for (let i = 0; i < 3; i++) {
    cleaned = cleaned.replace(LEADING_DIRECTION, '').replace(TRAILING_DIRECTION, '');
  }
  return cleaned
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/^[ \t]*(?:#{1,6}|>|[-*\u2022]|\d{1,2}[.)])[ \t]+/gm, '')
    .replace(/(\*{1,3}|_{1,3}|~~)(?=\S)([^*_~\n]+?)(?<=\S)\1/g, '$2')
    .replace(/[*_`~#>|\\^]+/g, ' ')
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .replace(/([^.!?\u2026:;,\s])[ \t]*\n+[ \t]*/g, '$1. ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .trim();
}

export interface SpeechChunk {
  text: string;
  /** Where the chunk starts in the cleaned text. */
  start: number;
}

interface Span {
  start: number;
  end: number;
}

// Chromium stops a long utterance after about fifteen seconds, so text is spoken a sentence or two
// at a time. About 140 characters is around ten seconds, which leaves a wide margin.
export const MAX_CHUNK_CHARS = 140;
const SENTENCE_END = /[.!?\u2026]+["'\u201d\u2019)\]]*(?=\s|$)/g;
const ABBREVIATION = /\b(?:mr|mrs|ms|dr|prof|st|vs|no)\.$/i;

function sentenceSpans(text: string): Span[] {
  const spans: Span[] = [];
  let start = 0;
  for (const match of text.matchAll(SENTENCE_END)) {
    const end = (match.index ?? 0) + match[0].length;
    const following = /^\s+(\S)/.exec(text.slice(end))?.[1] ?? '';
    // "e.g. the" and "Mr. Smith" do not end a sentence.
    if (/[a-z]/.test(following) || ABBREVIATION.test(text.slice(start, end))) continue;
    spans.push({ start, end });
    start = end + (/^\s*/.exec(text.slice(end))?.[0].length ?? 0);
  }
  if (start < text.length) spans.push({ start, end: text.length });
  return spans;
}

// A sentence that is too long is cut at a comma or similar, or failing that at a space.
function splitLong(text: string, span: Span, max: number): Span[] {
  const parts: Span[] = [];
  let start = span.start;
  while (span.end - start > max) {
    const window = text.slice(start, start + max);
    const clause = Math.max(
      window.lastIndexOf(', '),
      window.lastIndexOf('; '),
      window.lastIndexOf(': '),
      window.lastIndexOf(' \u2014 '),
    );
    const space = window.lastIndexOf(' ');
    const cut = clause > max / 3 ? clause + 1 : space > 0 ? space : max;
    parts.push({ start, end: start + cut });
    start += cut;
    while (text[start] === ' ') start++;
  }
  parts.push({ start, end: span.end });
  return parts;
}

/** Splits cleaned text into pieces that are safe to speak one after another. */
export function splitForSpeech(text: string, max: number = MAX_CHUNK_CHARS): SpeechChunk[] {
  const pieces = sentenceSpans(text).flatMap((span) =>
    span.end - span.start > max ? splitLong(text, span, max) : [span],
  );
  const merged: Span[] = [];
  for (const piece of pieces) {
    const last = merged[merged.length - 1];
    if (last && piece.end - last.start <= max) last.end = piece.end;
    else merged.push({ ...piece });
  }
  return merged
    .map(({ start, end }) => ({ text: text.slice(start, end), start }))
    .filter((chunk) => /[\p{L}\p{N}]/u.test(chunk.text));
}

// ---------------------------------------------------------------------------------------
// Timing

const CHARS_PER_SECOND = 15;
const SENTENCE_PAUSE_MS = 280;
const COMMA_PAUSE_MS = 120;
// The last part of each word's time is the gap before the next word.
const VOICED_SHARE = 0.85;

interface Beat {
  start: number;
  end: number;
  amplitude: number;
}

// FNV-1a: small and stable, so the same word always has the same weight.
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// One model of how long speech takes, used for both the length estimate and the level meter, so the
// two always agree: each word takes time in proportion to its length, and sentence and clause ends
// add a pause.
function timeline(text: string, rate: number): { beats: Beat[]; totalMs: number } {
  const scale = 1 / Math.max(rate, 0.5);
  const beats: Beat[] = [];
  let at = 0;
  for (const word of cleanForSpeech(text).split(/\s+/).filter(Boolean)) {
    const length = Math.max(110, ((word.length + 1) / CHARS_PER_SECOND) * 1000) * scale;
    beats.push({
      start: at,
      end: at + length * VOICED_SHARE,
      amplitude: 0.55 + (hash(word) % 45) / 100,
    });
    at += length;
    if (/[.!?\u2026]["')\]]*$/.test(word)) at += SENTENCE_PAUSE_MS * scale;
    else if (/[,;:]$/.test(word)) at += COMMA_PAUSE_MS * scale;
  }
  return { beats, totalMs: at };
}

/** A rough length for speaking `text` at `rate` (1 is normal speed), never under a second. */
export function estimateSpeechMs(text: string, rate = 1): number {
  return Math.max(1000, Math.round(timeline(text, rate).totalMs));
}

/**
 * A level meter for speech the page cannot measure (a browser voice), shaped from the words: each
 * word swells and fades, with gaps between words and longer ones at the ends of sentences. Returns a
 * function from "milliseconds since the voice started" to a level between 0 and 1.
 */
export function createLevelShaper(text: string, rate = 1): (elapsedMs: number) => number {
  const { beats } = timeline(text, rate);
  return (elapsedMs) => {
    if (elapsedMs < 0) return 0;
    const beat = beats.find(
      (candidate) => elapsedMs >= candidate.start && elapsedMs < candidate.end,
    );
    if (!beat) return 0.05;
    const fraction = (elapsedMs - beat.start) / (beat.end - beat.start);
    const swell = Math.sin(Math.PI * fraction) ** 0.6;
    return Math.round(Math.min(1, 0.12 + swell * beat.amplitude * 0.88) * 100) / 100;
  };
}
