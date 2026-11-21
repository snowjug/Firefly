import { VOICE_IDS, voiceChoice, type VoiceId } from '#shared/domain/voices.ts';
import type { TemperatureBandId } from '#shared/domain/vocab.ts';

// Choosing and delivering a browser voice for the customer. Nothing here knows a voice by name: a
// voice is judged by what the browser says about it (its language, whether it runs on this device
// or online, whether it calls itself natural or neural, whether it is the default), so the choice
// keeps working as browsers add and rename voices.

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

/**
 * Pace and pitch for a customer: a little quicker and higher when tense. A browser voice has no
 * expressive styles, so this is all the mood can change. With no voice chosen, a steady base pitch
 * per seed keeps one customer sounding the same for the whole call. With a voice chosen, the pitch
 * is left plain (pitch is never what tells the four choices apart) and the voice's own small pace is
 * added to the rate, as the server's voices do.
 */
export function deliveryFor(
  mood: TemperatureBandId,
  voiceSeed: string,
  voice?: VoiceId,
): { rate: number; pitch: number } {
  const basePitch = voice ? 1 : 0.92 + (hash(`${voiceSeed}:pitch`) % 19) / 100; // 0.92 to 1.10
  const pace = voice ? 1 + voiceChoice(voice).paceDelta / 100 : 1;
  return {
    rate: clamp((MOOD_RATE[mood] ?? 1) * pace, 0.8, 1.3),
    pitch: clamp(basePitch + (MOOD_PITCH_LIFT[mood] ?? 0), 0.85, 1.2),
  };
}

// Voices that describe themselves as high quality.
const QUALITY_NAME = /\b(?:natural|neural|premium|enhanced|studio|online)\b/i;
// macOS lists its old speech-synthesis voices (including the novelty ones) under this identifier
// family; the voices it ships for real use have another.
const CLASSIC_VOICE_URI = /\.speech\.synthesis\.voice\./i;

// Android reports "en_GB", others "en-GB".
export const normaliseLang = (lang: string) => lang.replace('_', '-').toLowerCase();
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

/** Higher is better. Exported so tests (and callers) can see why a voice was chosen. */
export function rankVoice(voice: SpeechSynthesisVoice, lang: string): number {
  return (
    (QUALITY_NAME.test(voice.name) ? 8 : 0) +
    (voice.localService === false ? 4 : 0) +
    (normaliseLang(voice.lang) === normaliseLang(lang) ? 2 : 0) +
    (voice.default ? 1 : 0) -
    (CLASSIC_VOICE_URI.test(voice.voiceURI) ? 16 : 0)
  );
}

/** The best-ranked voices in the language, in a fixed order (by `voiceURI`), or none. */
function topVoices(voices: readonly SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice[] {
  const primary = primaryLanguage(lang);
  const pool = voices.filter((voice) => primaryLanguage(voice.lang) === primary);
  if (pool.length === 0) return [];
  const best = Math.max(...pool.map((voice) => rankVoice(voice, lang)));
  return pool.filter((voice) => rankVoice(voice, lang) === best).sort(byUri);
}

/**
 * Chooses a voice for a customer. Only voices in the requested language are considered. Natural or
 * online voices rank first, then voices for the exact region asked for, then the browser's default.
 * The best-ranked voices are sorted by `voiceURI` and the seed picks one, so one customer keeps one
 * voice and the choice does not depend on the order the browser lists voices in. Returns null when
 * the browser has no voice in the language (it then uses its own default).
 */
export function pickVoice(
  voices: readonly SpeechSynthesisVoice[],
  seed: string,
  lang: string,
): SpeechSynthesisVoice | null {
  const top = topVoices(voices, lang);
  return top[hash(seed) % top.length] ?? null;
}

/**
 * The browser voice for one of the four choices. The best-ranked voices are taken in a fixed order
 * and the choices are dealt out to them in turn, so with four or more voices every choice has a
 * voice of its own, with fewer some share one, and the result never depends on the order the browser
 * lists voices in. Returns null when the browser has no voice in the language.
 */
export function pickVoiceForChoice(
  voices: readonly SpeechSynthesisVoice[],
  choice: VoiceId,
  lang: string,
): SpeechSynthesisVoice | null {
  const top = topVoices(voices, lang);
  return top.length === 0 ? null : (top[VOICE_IDS.indexOf(choice) % top.length] ?? null);
}

export interface BrowserVoiceChoice {
  id: VoiceId;
  /** The browser's own name for the voice that will speak, or null when it has none in the language. */
  name: string | null;
  /** True when the voice runs on this device, false when it is online, null when there is none. */
  local: boolean | null;
}

export interface BrowserVoiceReport {
  choices: BrowserVoiceChoice[];
  /** How many different browser voices the four choices come to. */
  distinct: number;
  /** The four choices sound different because of the voice, and not only because of the pace. */
  tellApart: boolean;
  /** A plain sentence for the trainee when the choices cannot all be told apart, otherwise null. */
  note: string | null;
}

/**
 * What the four choices come to in this browser, said honestly: a browser with one English voice
 * cannot give four voices, and the trainee is told so, not left to wonder why they sound alike.
 */
export function describeBrowserVoices(
  voices: readonly SpeechSynthesisVoice[],
  lang: string,
): BrowserVoiceReport {
  const choices = VOICE_IDS.map((id): BrowserVoiceChoice => {
    const voice = pickVoiceForChoice(voices, id, lang);
    return { id, name: voice?.name ?? null, local: voice ? voice.localService : null };
  });
  const distinct = new Set(choices.map((choice) => choice.name ?? '')).size;
  const none = choices.every((choice) => choice.name === null);
  const note = none
    ? 'This browser has no English voice of its own to offer, so it will use its default voice and the four choices differ only in pace.'
    : distinct >= VOICE_IDS.length
      ? null
      : distinct === 1
        ? 'This browser has one English voice, so the four choices differ only in pace.'
        : `This browser has ${distinct} English voices, so some of the four choices sound alike.`;
  return { choices, distinct: none ? 0 : distinct, tellApart: note === null, note };
}
