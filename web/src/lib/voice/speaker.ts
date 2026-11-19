import type { TemperatureBandId } from '#shared/domain/vocab.ts';
import { DEFAULT_VOICE_LANG, getSynthesis, getUtteranceConstructor } from './support.ts';

// Speaks the customer's replies with the browser's own voices. Nothing here is sent anywhere by Firefly;
// which voice speaks, and whether it runs on this device, is up to the browser.

export interface SpeechBoundary {
  name: 'word' | 'sentence';
  /** Position in the text that is spoken (after markdown and stage directions are removed). */
  charIndex: number;
}

export type SpeakerErrorCode = 'unsupported' | 'blocked' | 'failed' | 'stalled';

export interface SpeakerError {
  code: SpeakerErrorCode;
  message: string;
}

export interface SpeakOptions {
  /** Anything stable for one customer (such as the persona's name): the same seed keeps the same voice. */
  voiceSeed: string;
  /** The customer's mood sets the pace and pitch. */
  mood: TemperatureBandId;
  /** BCP 47 tag. Voices in the same language are used. Defaults to British English. */
  lang?: string;
  /** The first words are being spoken. */
  onStart?: () => void;
  /** All of the text has been spoken. Once per speak() call, also after onError, never after cancel(). */
  onEnd?: () => void;
  onBoundary?: (boundary: SpeechBoundary) => void;
  onError?: (error: SpeakerError) => void;
}

export interface Speaker {
  /** Speaks after anything already being spoken has finished. */
  speak(text: string, options: SpeakOptions): void;
  /** Stops at once and forgets everything queued. No callbacks are made for what was cancelled. */
  cancel(): void;
  pause(): void;
  resume(): void;
  isSpeaking(): boolean;
  /** Calls `listener` when the browser's list of voices changes. Returns a function that stops it. */
  onVoicesChanged(listener: () => void): () => void;
  /** Call from a click or tap: some browsers only allow speech after one has been spoken in a gesture. */
  prime(): void;
  /** Cancels and detaches from the browser. */
  dispose(): void;
}

// ---------------------------------------------------------------------------------------
// Voice and delivery

// FNV-1a: small, stable across browsers and runs.
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const MOOD_RATE: Record<TemperatureBandId, number> = {
  calm: 0.96,
  concerned: 1,
  frustrated: 1.05,
  angry: 1.1,
  escalating: 1.14,
};
const MOOD_PITCH_LIFT: Record<TemperatureBandId, number> = {
  calm: 0,
  concerned: 0.01,
  frustrated: 0.03,
  angry: 0.05,
  escalating: 0.07,
};

/** Pace and pitch for a customer: a steady base pitch per seed, a little quicker and higher when tense. */
export function deliveryFor(
  mood: TemperatureBandId,
  voiceSeed: string,
): { rate: number; pitch: number } {
  const basePitch = 0.92 + (hash(`${voiceSeed}:pitch`) % 19) / 100; // 0.92 to 1.10
  return {
    rate: clamp(MOOD_RATE[mood] ?? 1, 0.8, 1.3),
    pitch: clamp(basePitch + (MOOD_PITCH_LIFT[mood] ?? 0), 0.85, 1.2),
  };
}

// macOS ships a set of joke voices; none of them should ever play a customer.
const NOVELTY_VOICE =
  /^(?:albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|pipe organ|superstar|trinoids|whisper|wobble|zarvox)\b/i;
const QUALITY_VOICE = /\b(?:natural|neural|online|premium|enhanced)\b/i;

// Android reports "en_GB", others "en-GB".
const normaliseLang = (lang: string) => lang.replace('_', '-').toLowerCase();
const primaryLanguage = (lang: string) => normaliseLang(lang).split('-')[0] ?? '';

const byUri = (a: SpeechSynthesisVoice, b: SpeechSynthesisVoice) =>
  a.voiceURI < b.voiceURI
    ? -1
    : a.voiceURI > b.voiceURI
      ? 1
      : a.name < b.name
        ? -1
        : a.name > b.name
          ? 1
          : 0;

/**
 * Chooses a voice for a customer. Only voices in the requested language are considered. Higher-quality
 * voices rank first, then voices that run on the device, then voices for the exact region asked for.
 * The best-ranked voices are sorted by `voiceURI` and the seed picks one, so the choice does not
 * depend on the order the browser lists voices in.
 */
export function pickVoice(
  voices: readonly SpeechSynthesisVoice[],
  seed: string,
  lang: string = DEFAULT_VOICE_LANG,
): SpeechSynthesisVoice | null {
  const wanted = normaliseLang(lang);
  const primary = primaryLanguage(lang);
  const pool = voices.filter(
    (voice) => primaryLanguage(voice.lang) === primary && !NOVELTY_VOICE.test(voice.name),
  );
  const rank = (voice: SpeechSynthesisVoice) =>
    (QUALITY_VOICE.test(voice.name) ? 4 : 0) +
    (voice.localService ? 2 : 0) +
    (normaliseLang(voice.lang) === wanted ? 1 : 0);
  const best = Math.max(...pool.map(rank));
  const top = pool.filter((voice) => rank(voice) === best).sort(byUri);
  return top[hash(seed) % top.length] ?? null;
}

// ---------------------------------------------------------------------------------------
// Text

// The server already sends plain speech; this is a second net for a stray action or markdown marker.
// Like the server, only actions at the very start or end go: *emphasis* inside a sentence is kept.
const DIRECTION = String.raw`(?:\*(?!\*)[^*\n]{1,80}\*(?!\*)|\([A-Za-z][A-Za-z' -]{0,30}\)|\[[A-Za-z][A-Za-z' -]{0,30}\])`;
const LEADING_DIRECTION = new RegExp(String.raw`^\s*${DIRECTION}\s*`);
const TRAILING_DIRECTION = new RegExp(String.raw`\s*${DIRECTION}\s*$`);

/** Removes markdown, links, emoji and stage directions so that the voice reads only what was said. */
export function cleanForSpeech(text: string): string {
  let cleaned = text;
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

// Chromium stops a long utterance after about fifteen seconds, so text is spoken a sentence or two at
// a time. About 140 characters is around ten seconds, which leaves a wide margin.
const MAX_CHUNK = 140;
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
export function splitForSpeech(text: string, max: number = MAX_CHUNK): SpeechChunk[] {
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
// The speaker

const VOICE_WAIT_MS = 1500;
const VOICE_POLL_MS = 150;
// Chromium can ignore a speak() that comes straight after a cancel().
const CANCEL_SETTLE_MS = 60;
// Watchdogs for browsers that sometimes never report that an utterance started or ended.
const START_WAIT_MS = 6000;
const END_BASE_MS = 6000;
const END_PER_CHAR_MS = 160;

interface Chain {
  chunks: SpeechChunk[];
  index: number;
  started: boolean;
  voice: SpeechSynthesisVoice | null;
  rate: number;
  pitch: number;
  lang: string;
  options: SpeakOptions;
}

type UtteranceConstructor = new (text?: string) => SpeechSynthesisUtterance;

function inertSpeaker(): Speaker {
  let epoch = 0;
  return {
    speak(_text, options) {
      const mine = epoch;
      queueMicrotask(() => {
        if (mine !== epoch) return;
        options.onError?.({ code: 'unsupported', message: 'This browser cannot speak aloud.' });
        options.onEnd?.();
      });
    },
    cancel() {
      epoch++;
    },
    pause() {},
    resume() {},
    isSpeaking: () => false,
    onVoicesChanged: () => () => undefined,
    prime() {},
    dispose() {
      epoch++;
    },
  };
}

function browserSpeaker(synth: SpeechSynthesis, Utterance: UtteranceConstructor): Speaker {
  // Anything that was queued, started or timed before a cancel() carries an older epoch and is ignored.
  let epoch = 0;
  const queue: Chain[] = [];
  let active: Chain | null = null;
  // Kept so the utterance cannot be garbage collected while it is being spoken (Chromium then never
  // reports that it ended).
  let current: SpeechSynthesisUtterance | null = null;
  let paused = false;
  let startTimer: ReturnType<typeof setTimeout> | undefined;
  let endTimer: ReturnType<typeof setTimeout> | undefined;
  let delayTimer: ReturnType<typeof setTimeout> | undefined;
  let lastCancel = Number.NEGATIVE_INFINITY;
  let gaveUpWaitingForVoices = false;
  const choices = new Map<string, SpeechSynthesisVoice | null>();
  const listeners = new Set<() => void>();
  let relaying = false;

  const readVoices = (): SpeechSynthesisVoice[] => {
    try {
      return Array.from(synth.getVoices());
    } catch {
      return [];
    }
  };
  readVoices(); // Chromium only starts loading its voices when asked.

  const clearTimers = () => {
    clearTimeout(startTimer);
    clearTimeout(endTimer);
    clearTimeout(delayTimer);
    startTimer = endTimer = delayTimer = undefined;
  };

  // The same customer keeps one voice for the whole call, even if the browser's list changes.
  const voiceFor = (seed: string, lang: string) => {
    const key = `${lang}|${seed}`;
    if (choices.has(key)) return choices.get(key) ?? null;
    const voices = readVoices();
    const voice = pickVoice(voices, seed, lang);
    if (voices.length > 0) choices.set(key, voice);
    return voice;
  };

  const whenVoicesReady = (): Promise<void> => {
    if (gaveUpWaitingForVoices || readVoices().length > 0) return Promise.resolve();
    return new Promise((resolve) => {
      // Chromium starts with no voices and announces them later, but not always, so also poll.
      const poll = setInterval(check, VOICE_POLL_MS);
      const limit = setTimeout(() => done(true), VOICE_WAIT_MS);
      function check() {
        if (readVoices().length > 0) done(false);
      }
      function done(timedOut: boolean) {
        clearInterval(poll);
        clearTimeout(limit);
        try {
          synth.removeEventListener('voiceschanged', check);
        } catch {
          // Not every browser lets listeners come and go.
        }
        if (timedOut) gaveUpWaitingForVoices = true;
        resolve();
      }
      try {
        synth.addEventListener('voiceschanged', check);
      } catch {
        // Polling still works.
      }
    });
  };

  // Chromium sometimes leaves `speaking` true (or the engine paused) after an utterance was interrupted,
  // and then queues new speech behind the phantom one for ever.
  const clearPhantomSpeech = (): boolean => {
    let cancelled = false;
    try {
      if (synth.speaking || synth.pending) {
        synth.cancel();
        lastCancel = Date.now();
        cancelled = true;
      }
      if (synth.paused) synth.resume();
    } catch {
      // Best effort.
    }
    return cancelled;
  };

  const finish = (chain: Chain) => {
    if (active !== chain) return;
    clearTimers();
    current = null;
    active = null;
    paused = false;
    chain.options.onEnd?.();
    next(false);
  };

  const fail = (chain: Chain, error: SpeakerError) => {
    if (active !== chain) return;
    chain.options.onError?.(error);
    finish(chain);
  };

  const stall = (chain: Chain, mine: number) => {
    if (epoch !== mine || active !== chain) return;
    try {
      synth.cancel();
      lastCancel = Date.now();
    } catch {
      // Best effort.
    }
    fail(chain, { code: 'stalled', message: 'The browser stopped speaking.' });
  };

  const armStart = (chain: Chain, mine: number) => {
    clearTimeout(startTimer);
    startTimer = setTimeout(() => stall(chain, mine), START_WAIT_MS);
  };

  const armEnd = (chain: Chain, mine: number) => {
    clearTimeout(endTimer);
    const chunk = chain.chunks[chain.index];
    if (paused || !chunk) return;
    const ms = END_BASE_MS + (chunk.text.length * END_PER_CHAR_MS) / Math.max(chain.rate, 0.5);
    endTimer = setTimeout(() => stall(chain, mine), ms);
  };

  const speakChunk = (chain: Chain, mine: number) => {
    const chunk = chain.chunks[chain.index];
    if (!chunk) {
      finish(chain);
      return;
    }
    const utterance = new Utterance(chunk.text);
    if (chain.voice) {
      utterance.voice = chain.voice;
      utterance.lang = chain.voice.lang;
    } else {
      utterance.lang = chain.lang;
    }
    utterance.rate = chain.rate;
    utterance.pitch = chain.pitch;
    utterance.volume = 1;
    const isCurrent = () => epoch === mine && active === chain && current === utterance;
    utterance.onstart = () => {
      if (!isCurrent()) return;
      clearTimeout(startTimer);
      armEnd(chain, mine);
      if (!chain.started) {
        chain.started = true;
        chain.options.onStart?.();
      }
    };
    utterance.onend = () => {
      if (!isCurrent()) return;
      clearTimers();
      chain.index++;
      if (chain.index < chain.chunks.length) speakChunk(chain, mine);
      else finish(chain);
    };
    utterance.onerror = (event) => {
      if (!isCurrent()) return;
      clearTimers();
      // Cancelled by something other than this speaker (a cancel() here makes isCurrent() false).
      if (event.error === 'canceled' || event.error === 'interrupted') {
        finish(chain);
        return;
      }
      fail(
        chain,
        event.error === 'not-allowed'
          ? { code: 'blocked', message: 'The browser did not allow speech yet.' }
          : { code: 'failed', message: 'The browser could not speak this reply.' },
      );
    };
    utterance.onboundary = (event) => {
      if (!isCurrent()) return;
      chain.options.onBoundary?.({
        name: event.name === 'sentence' ? 'sentence' : 'word',
        charIndex: chunk.start + event.charIndex,
      });
    };
    current = utterance;
    armStart(chain, mine);
    try {
      synth.speak(utterance);
    } catch {
      fail(chain, { code: 'failed', message: 'The browser could not speak this reply.' });
    }
  };

  const begin = (chain: Chain, mine: number, fresh: boolean) => {
    const go = () => {
      if (epoch !== mine || active !== chain) return;
      chain.voice = voiceFor(chain.options.voiceSeed, chain.lang);
      const cleared = fresh && clearPhantomSpeech();
      const wait = cleared
        ? CANCEL_SETTLE_MS
        : Math.max(0, CANCEL_SETTLE_MS - (Date.now() - lastCancel));
      if (wait > 0) delayTimer = setTimeout(() => speakChunk(chain, mine), wait);
      else speakChunk(chain, mine);
    };
    if (gaveUpWaitingForVoices || readVoices().length > 0) go();
    else void whenVoicesReady().then(go);
  };

  function next(fresh: boolean): void {
    if (active) return;
    const chain = queue.shift();
    if (!chain) return;
    active = chain;
    const mine = epoch;
    if (chain.chunks.length === 0) {
      queueMicrotask(() => {
        if (epoch === mine && active === chain) finish(chain);
      });
      return;
    }
    begin(chain, mine, fresh);
  }

  const relay = () => {
    for (const listener of [...listeners]) listener();
  };
  const stopRelaying = () => {
    if (!relaying) return;
    relaying = false;
    try {
      synth.removeEventListener('voiceschanged', relay);
    } catch {
      // Nothing to undo.
    }
  };

  const cancel = () => {
    epoch++;
    queue.length = 0;
    active = null;
    current = null;
    paused = false;
    clearTimers();
    lastCancel = Date.now();
    try {
      synth.cancel();
    } catch {
      // Best effort.
    }
  };

  return {
    speak(text, options) {
      const { rate, pitch } = deliveryFor(options.mood, options.voiceSeed);
      queue.push({
        chunks: splitForSpeech(cleanForSpeech(text)),
        index: 0,
        started: false,
        voice: null,
        rate,
        pitch,
        lang: options.lang ?? DEFAULT_VOICE_LANG,
        options,
      });
      next(true);
    },
    cancel,
    pause() {
      try {
        synth.pause();
      } catch {
        // Best effort.
      }
      if (active) {
        paused = true;
        clearTimeout(startTimer);
        clearTimeout(endTimer);
      }
    },
    resume() {
      try {
        synth.resume();
      } catch {
        // Best effort.
      }
      if (paused && active) {
        paused = false;
        if (active.started) armEnd(active, epoch);
        else armStart(active, epoch);
      }
    },
    isSpeaking: () => active !== null || queue.length > 0,
    onVoicesChanged(listener) {
      listeners.add(listener);
      if (!relaying) {
        relaying = true;
        try {
          synth.addEventListener('voiceschanged', relay);
        } catch {
          // Not every browser lets listeners come and go.
        }
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) stopRelaying();
      };
    },
    prime() {
      if (active || queue.length > 0) return;
      try {
        const silent = new Utterance('');
        silent.volume = 0;
        synth.speak(silent);
      } catch {
        // Best effort.
      }
    },
    dispose() {
      cancel();
      listeners.clear();
      stopRelaying();
    },
  };
}

export function createSpeaker(): Speaker {
  const synth = getSynthesis();
  const Utterance = getUtteranceConstructor();
  return synth && Utterance ? browserSpeaker(synth, Utterance) : inertSpeaker();
}
