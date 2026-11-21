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
 * Pace and pitch for a customer: a steady base pitch per seed, a little quicker and higher when
 * tense. A browser voice has no expressive styles, so this is all the mood can change.
 */
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
  const primary = primaryLanguage(lang);
  const pool = voices.filter((voice) => primaryLanguage(voice.lang) === primary);
  if (pool.length === 0) return null;
  const best = Math.max(...pool.map((voice) => rankVoice(voice, lang)));
  const top = pool.filter((voice) => rankVoice(voice, lang) === best).sort(byUri);
  return top[hash(seed) % top.length] ?? null;
}
