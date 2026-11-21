import {
  SPEECH_LANGUAGES,
  type SpeechLanguage,
  type VoiceDirection,
} from '#shared/domain/speech.ts';
import { normalizeWhitespace, sentences } from '#shared/domain/text.ts';
import type { TemperatureBandId } from '#shared/domain/vocab.ts';

// How a customer's line is voiced: which Azure voice speaks it and how it is delivered. Everything
// here is pure, so it can be tested without any speech service.
//
// Mood is shown in the customer's voice in two ways. Where the chosen voice really lists an
// expressive style, that style is applied at a reduced, controlled degree. Everywhere else mood is
// approximated by speaking rate and pitch alone, and the response says which one happened. Nothing
// here clones, imitates or evokes a real person, and nothing is ever inferred from the trainee's voice.

export type Speaker = VoiceDirection['speaker'];

/** Voice names that replace the defaults for a speaker (null or absent keeps the default). */
export type VoiceOverrides = Partial<Record<Speaker, string | null>>;

/**
 * The built-in voices: standard neural voices whose locale is the language they are used for. Every
 * name appears in the "Text to speech voices" table of Microsoft's language support page.
 */
export const DEFAULT_VOICES: Record<SpeechLanguage, Record<Speaker, string>> = {
  'en-GB': { female: 'en-GB-SoniaNeural', male: 'en-GB-RyanNeural' },
  'en-US': { female: 'en-US-AriaNeural', male: 'en-US-GuyNeural' },
  'en-IE': { female: 'en-IE-EmilyNeural', male: 'en-IE-ConnorNeural' },
  'en-AU': { female: 'en-AU-NatashaNeural', male: 'en-AU-WilliamNeural' },
  'en-IN': { female: 'en-IN-NeerjaNeural', male: 'en-IN-PrabhatNeural' },
};

/**
 * The speaking styles each voice lists in that same table, copied from it. A voice that is absent
 * from this table has no verified styles, so no style is ever applied to it (an administrator's
 * own voice choice, for example). An empty list means the table lists no styles for the voice.
 * `shouting` is listed by some voices and is deliberately never used by Firefly.
 */
export const VOICE_STYLES: Readonly<Record<string, readonly string[]>> = {
  'en-GB-SoniaNeural': ['cheerful', 'sad'],
  'en-GB-RyanNeural': ['chat', 'cheerful', 'sad', 'whispering'],
  'en-IE-EmilyNeural': [],
  'en-IE-ConnorNeural': [],
  'en-AU-NatashaNeural': [],
  'en-AU-WilliamNeural': [],
  'en-IN-NeerjaNeural': ['cheerful', 'empathetic', 'newscast'],
  'en-IN-PrabhatNeural': [],
  'en-US-AriaNeural': [
    'angry',
    'chat',
    'cheerful',
    'customerservice',
    'empathetic',
    'excited',
    'friendly',
    'hopeful',
    'narration-professional',
    'newscast-casual',
    'newscast-formal',
    'sad',
    'shouting',
    'terrified',
    'unfriendly',
    'whispering',
  ],
  'en-US-GuyNeural': [
    'angry',
    'cheerful',
    'excited',
    'friendly',
    'hopeful',
    'newscast',
    'sad',
    'shouting',
    'terrified',
    'unfriendly',
    'whispering',
  ],
  'en-US-JennyNeural': [
    'angry',
    'assistant',
    'chat',
    'cheerful',
    'customerservice',
    'excited',
    'friendly',
    'hopeful',
    'newscast',
    'sad',
    'shouting',
    'terrified',
    'unfriendly',
    'whispering',
  ],
  'en-US-DavisNeural': [
    'angry',
    'chat',
    'cheerful',
    'excited',
    'friendly',
    'hopeful',
    'sad',
    'shouting',
    'terrified',
    'unfriendly',
    'whispering',
  ],
  'en-US-JaneNeural': [
    'angry',
    'cheerful',
    'excited',
    'friendly',
    'hopeful',
    'sad',
    'shouting',
    'terrified',
    'unfriendly',
    'whispering',
  ],
  'en-US-JasonNeural': [
    'angry',
    'cheerful',
    'excited',
    'friendly',
    'hopeful',
    'sad',
    'shouting',
    'terrified',
    'unfriendly',
    'whispering',
  ],
  'en-US-SaraNeural': [
    'angry',
    'cheerful',
    'excited',
    'friendly',
    'hopeful',
    'sad',
    'shouting',
    'terrified',
    'unfriendly',
    'whispering',
  ],
};

// ---------------------------------------------------------------------------------------
// Mood -> delivery

const DELIVERY: Record<TemperatureBandId, Pick<VoiceDirection, 'pace' | 'intensity'>> = {
  calm: { pace: 'measured', intensity: 0 },
  concerned: { pace: 'brisk', intensity: 0.25 },
  frustrated: { pace: 'firm', intensity: 0.5 },
  angry: { pace: 'firm', intensity: 0.75 },
  escalating: { pace: 'firm', intensity: 1 },
};

/** How a customer in this mood sounds: calm is measured, and the hotter the mood the firmer the delivery. */
export function voiceDirection(args: {
  speaker: Speaker;
  language: SpeechLanguage;
  mood: TemperatureBandId;
}): VoiceDirection {
  return { ...args, ...DELIVERY[args.mood] };
}

/** The one expressive style each mood asks for. Calm and concerned ask for none. */
const MOOD_STYLE: Partial<Record<TemperatureBandId, string>> = {
  frustrated: 'unfriendly',
  angry: 'angry',
  escalating: 'angry',
};

/** Even the strongest mood is delivered below the style's default intensity (1): firm, never shouting. */
const MAX_STYLE_DEGREE_HUNDREDTHS = 90;

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
const percent = (n: number) => `${n >= 0 ? '+' : '-'}${Math.abs(Math.round(n))}%`;

export function chooseVoice(
  direction: Pick<VoiceDirection, 'speaker' | 'language'>,
  overrides: VoiceOverrides = {},
): string {
  return overrides[direction.speaker] ?? DEFAULT_VOICES[direction.language][direction.speaker];
}

/** The style to apply for this mood, only when the voice really lists it, else null. */
export function styleFor(
  voice: string,
  direction: Pick<VoiceDirection, 'mood' | 'intensity'>,
): { style: string; degree: number } | null {
  const style = MOOD_STYLE[direction.mood];
  if (!style || !VOICE_STYLES[voice]?.includes(style)) return null;
  // The degree grows with intensity from 0.2 and stops at 0.9.
  const hundredths = Math.min(
    MAX_STYLE_DEGREE_HUNDREDTHS,
    Math.round(20 + 70 * clamp01(direction.intensity)),
  );
  return { style, degree: hundredths / 100 };
}

/**
 * Speaking rate and pitch for a delivery, as the relative percentages SSML accepts (the documented
 * limits are far wider than anything used here). A style carries the tone by itself, so pitch is
 * only changed when no style is applied.
 */
export function prosodyFor(
  direction: Pick<VoiceDirection, 'pace' | 'intensity'>,
  styleApplied: boolean,
): { rate: string; pitch: string | null } {
  const i = clamp01(direction.intensity);
  if (direction.pace === 'measured') return { rate: percent(-4), pitch: null };
  const brisk = direction.pace === 'brisk';
  return {
    rate: percent(brisk ? 2 + 16 * i : 2 + 12 * i),
    pitch: styleApplied ? null : percent(brisk ? 1 + 8 * i : -4 * i),
  };
}

/** True when every language and speaker resolves to a voice that lists the styles moods ask for. */
export function moodStylesAvailable(overrides: VoiceOverrides = {}): boolean {
  const wanted = new Set(Object.values(MOOD_STYLE));
  return SPEECH_LANGUAGES.every((language) =>
    (['female', 'male'] as const).every((speaker) => {
      const styles = VOICE_STYLES[chooseVoice({ speaker, language }, overrides)] ?? [];
      return [...wanted].every((style) => styles.includes(style));
    }),
  );
}

// ---------------------------------------------------------------------------------------
// Text and SSML

/**
 * The longest line that is spoken. The simulation keeps customer lines under 900 characters, so this
 * only matters for text that came from somewhere unexpected. It also bounds the size of the request.
 */
export const MAX_SPOKEN_CHARS = 1_200;

// Characters that are not allowed in XML or that only confuse a voice: control codes, invisible
// formatting, and surrogates that are not part of a pair. Ordinary whitespace is kept for later.
const UNSPOKEN =
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u0008\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufffd-\uffff]|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g;

function cutAtSentence(text: string, max: number): { text: string; truncated: boolean } {
  if (text.length <= max) return { text, truncated: false };
  let kept = '';
  for (const sentence of sentences(text)) {
    const next = kept ? `${kept} ${sentence}` : sentence;
    if (next.length > max) break;
    kept = next;
  }
  if (kept) return { text: kept, truncated: true };
  // One sentence alone is too long: stop at the last whole word.
  let head = text.slice(0, max);
  // Never end on half of an emoji or another character stored as a surrogate pair.
  if (/[\ud800-\udbff]$/.test(head)) head = head.slice(0, -1);
  const space = head.lastIndexOf(' ');
  return { text: (space > max / 2 ? head.slice(0, space) : head).trimEnd(), truncated: true };
}

/** Text without control characters or invisible formatting, on one line with single spaces. */
export const cleanText = (text: string): string => normalizeWhitespace(text.replace(UNSPOKEN, ''));

/**
 * The words that will be spoken for a stored line: control characters removed, whitespace tidied,
 * and a line that is too long cut at a sentence boundary. The stored text is never changed.
 */
export function prepareSpokenText(
  text: string,
  max = MAX_SPOKEN_CHARS,
): { text: string; truncated: boolean } {
  return cutAtSentence(cleanText(text), max);
}

const XML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

export const escapeXml = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => XML_ENTITIES[c] as string);

/** The locale a voice speaks, read from its name (en-GB-SoniaNeural is en-GB). */
const localeOf = (voice: string): string | null =>
  /^([a-z]{2,3}-[A-Za-z]{2,4})-/.exec(voice)?.[1] ?? null;

export interface SpeechPlan {
  ssml: string;
  voice: string;
  /** The style that is really applied, or `none` when only rate and pitch change. */
  style: string;
  /** What will be spoken: the stored line, cleaned and cut at a sentence boundary when long. */
  text: string;
  truncated: boolean;
}

/** The SSML request for one customer line, and what it will really do. */
export function planSpeech(
  text: string,
  direction: VoiceDirection,
  overrides: VoiceOverrides = {},
): SpeechPlan {
  const voice = chooseVoice(direction, overrides);
  const styled = styleFor(voice, direction);
  const spoken = prepareSpokenText(text);
  const { rate, pitch } = prosodyFor(direction, styled !== null);

  let body = `<prosody rate="${rate}"${pitch ? ` pitch="${pitch}"` : ''}>${escapeXml(spoken.text)}</prosody>`;
  if (styled) {
    body = `<mstts:express-as style="${styled.style}" styledegree="${styled.degree}">${body}</mstts:express-as>`;
  }
  const ssml =
    '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" ' +
    `xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${escapeXml(localeOf(voice) ?? direction.language)}">` +
    `<voice name="${escapeXml(voice)}">${body}</voice></speak>`;
  return {
    ssml,
    voice,
    style: styled?.style ?? 'none',
    text: spoken.text,
    truncated: spoken.truncated,
  };
}
