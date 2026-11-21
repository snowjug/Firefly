import {
  SPEECH_LANGUAGES,
  type SpeechLanguage,
  type SpeechVoiceDTO,
  type VoiceDirection,
} from '#shared/domain/speech.ts';
import { toSpokenText } from '#shared/domain/spoken-text.ts';
import { VOICE_CHOICES, VOICE_IDS, voiceChoice, type VoiceId } from '#shared/domain/voices.ts';
import { normalizeWhitespace, sentences } from '#shared/domain/text.ts';
import type { TemperatureBandId } from '#shared/domain/vocab.ts';
import type { VoiceOption } from './types.ts';

// How a customer's line is voiced: which Azure voice speaks it and how it is delivered. Everything
// here is pure, so it can be tested without any speech service.
//
// Mood is shown in the customer's voice in two ways. Where the chosen voice really lists an
// expressive style, that style is applied at a reduced, controlled degree. Everywhere else mood is
// approximated by speaking rate and pitch alone, and the response says which one happened. Nothing
// here clones, imitates or evokes a real person, and nothing is ever inferred from the trainee's voice.
//
// Pauses are not varied. The documentation describes SSML breaks and sentence-boundary silence, but
// how each voice treats them (added to its own pauses, or in place of them) has not been checked
// against the live service, so Firefly leaves every voice's own pauses alone rather than claim a
// pause it cannot vouch for.

export type Speaker = VoiceDirection['speaker'];

/** Voice names that replace the defaults for a speaker (null or absent keeps the default). */
export type VoiceOverrides = Partial<Record<Speaker, string | null>>;

/**
 * The built-in voices: standard neural voices whose locale is the language they are used for. Every
 * name appears in the "Text to speech voices" table of Microsoft's language support page. This is
 * the pairing used when no voice is chosen (calls saved before voices could be chosen, and older
 * clients), and the one the administrator's own voice names replace.
 */
export const DEFAULT_VOICES: Record<SpeechLanguage, Record<Speaker, string>> = {
  'en-GB': { female: 'en-GB-SoniaNeural', male: 'en-GB-RyanNeural' },
  'en-US': { female: 'en-US-AriaNeural', male: 'en-US-GuyNeural' },
  'en-IE': { female: 'en-IE-EmilyNeural', male: 'en-IE-ConnorNeural' },
  'en-AU': { female: 'en-AU-NatashaNeural', male: 'en-AU-WilliamNeural' },
  'en-IN': { female: 'en-IN-NeerjaNeural', male: 'en-IN-PrabhatNeural' },
};

/**
 * The provider voice behind each of the four neutral choices, in every language. Every name is in
 * the same table of Microsoft's language support page (checked against the page dated 18 November
 * 2026; no voice was heard or called live). Where the provider has fewer than four standard voices
 * in a language (Ireland has two), a choice shares the voice of an earlier one and differs by pace
 * alone, and the voice list says so.
 *
 * The voices are arranged so that no choice always lands on the same kind of voice: across the four
 * languages that have four, each choice gets two voices of each presentation. Nothing else in
 * Firefly knows or uses a voice's presentation, and the choice a trainee sees is only a label and a
 * delivery.
 */
export const VOICE_CATALOGUE: Record<SpeechLanguage, Record<VoiceId, string>> = {
  'en-GB': {
    'voice-a': 'en-GB-SoniaNeural',
    'voice-b': 'en-GB-RyanNeural',
    'voice-c': 'en-GB-LibbyNeural',
    'voice-d': 'en-GB-ThomasNeural',
  },
  'en-US': {
    'voice-a': 'en-US-GuyNeural',
    'voice-b': 'en-US-AriaNeural',
    'voice-c': 'en-US-DavisNeural',
    'voice-d': 'en-US-JennyNeural',
  },
  'en-IE': {
    'voice-a': 'en-IE-ConnorNeural',
    'voice-b': 'en-IE-EmilyNeural',
    'voice-c': 'en-IE-ConnorNeural',
    'voice-d': 'en-IE-EmilyNeural',
  },
  'en-AU': {
    'voice-a': 'en-AU-NatashaNeural',
    'voice-b': 'en-AU-WilliamNeural',
    'voice-c': 'en-AU-DarrenNeural',
    'voice-d': 'en-AU-AnnetteNeural',
  },
  'en-IN': {
    'voice-a': 'en-IN-AaravNeural',
    'voice-b': 'en-IN-NeerjaNeural',
    'voice-c': 'en-IN-AashiNeural',
    'voice-d': 'en-IN-KunalNeural',
  },
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
  'en-GB-LibbyNeural': [],
  'en-GB-ThomasNeural': [],
  'en-IE-EmilyNeural': [],
  'en-IE-ConnorNeural': [],
  'en-AU-NatashaNeural': [],
  'en-AU-WilliamNeural': [],
  'en-AU-DarrenNeural': [],
  'en-AU-AnnetteNeural': [],
  'en-IN-NeerjaNeural': ['cheerful', 'empathetic', 'newscast'],
  'en-IN-PrabhatNeural': [],
  'en-IN-AaravNeural': [],
  'en-IN-AashiNeural': [],
  'en-IN-KunalNeural': [],
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
  /** The voice the trainee chose. Left out, the speaker picks the voice. */
  voice?: VoiceId;
  /** The customer is cooling down: a little slower and calmer than the mood alone would be. */
  recovering?: boolean;
}): VoiceDirection {
  const { voice, recovering, ...rest } = args;
  return {
    ...rest,
    ...DELIVERY[args.mood],
    ...(voice ? { voice } : {}),
    ...(recovering ? { recovering: true } : {}),
  };
}

/** The one expressive style each mood asks for. Calm and concerned ask for none. */
const MOOD_STYLE: Partial<Record<TemperatureBandId, string>> = {
  frustrated: 'unfriendly',
  angry: 'angry',
  escalating: 'angry',
};

/** Even the strongest mood is delivered below the style's default intensity (1): firm, never shouting. */
const MAX_STYLE_DEGREE_HUNDREDTHS = 90;

// However a mood, a recovery and a voice's pace add up, delivery stays inside these limits (percent).
// The documented limits are far wider; these keep every customer plain, intelligible and unhurried.
export const MAX_RATE_PERCENT = 22;
export const MIN_RATE_PERCENT = -15;
export const MAX_PITCH_PERCENT = 6;
/** A customer who is cooling down speaks this much slower than their mood alone would make them. */
const RECOVERY_RATE_DROP = 3;

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const percent = (n: number) => {
  const whole = Math.round(n);
  return `${whole >= 0 ? '+' : '-'}${Math.abs(whole)}%`;
};

export function chooseVoice(
  direction: Pick<VoiceDirection, 'speaker' | 'language'> & Partial<Pick<VoiceDirection, 'voice'>>,
  overrides: VoiceOverrides = {},
): string {
  // The administrator's own voice names replace the pairing by speaker, never a voice the trainee chose.
  const chosen = direction.voice
    ? VOICE_CATALOGUE[direction.language]?.[direction.voice]
    : undefined;
  if (chosen) return chosen;
  return overrides[direction.speaker] ?? DEFAULT_VOICES[direction.language][direction.speaker];
}

/** The style to apply for this mood, only when the voice really lists it, else null. */
export function styleFor(
  voice: string,
  direction: Pick<VoiceDirection, 'mood' | 'intensity'> &
    Partial<Pick<VoiceDirection, 'recovering'>>,
): { style: string; degree: number } | null {
  // A customer who is cooling down is calmer than their band says: no style, only a slower pace.
  if (direction.recovering) return null;
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
 * Speaking rate and pitch for a delivery, as the relative percentages SSML accepts. A style carries
 * the tone by itself, so pitch is only changed when no style is applied. A customer who is
 * recovering is slower and calmer than their mood alone; the chosen voice adds its own small pace
 * (Warm a little slower, Direct a little quicker, and so on). The sum always stays inside the limits
 * above.
 */
export function prosodyFor(
  direction: Pick<VoiceDirection, 'pace' | 'intensity'> &
    Partial<Pick<VoiceDirection, 'voice' | 'recovering'>>,
  styleApplied: boolean,
): { rate: string; pitch: string | null } {
  const i = clamp01(direction.intensity);
  const brisk = direction.pace === 'brisk';
  let rate = direction.pace === 'measured' ? -4 : brisk ? 2 + 16 * i : 2 + 12 * i;
  let pitch = direction.pace === 'measured' || styleApplied ? null : brisk ? 1 + 8 * i : -4 * i;
  if (direction.recovering) {
    rate = (rate > 0 ? rate / 2 : rate) - RECOVERY_RATE_DROP;
    pitch = pitch === null ? null : pitch / 2;
  }
  if (direction.voice) rate += voiceChoice(direction.voice).paceDelta;
  return {
    rate: percent(clamp(rate, MIN_RATE_PERCENT, MAX_RATE_PERCENT)),
    pitch: pitch === null ? null : percent(clamp(pitch, -MAX_PITCH_PERCENT, MAX_PITCH_PERCENT)),
  };
}

/** True when every language and speaker resolves to a voice that lists the styles moods ask for. */
export function moodStylesAvailable(overrides: VoiceOverrides = {}): boolean {
  return SPEECH_LANGUAGES.every((language) =>
    (['female', 'male'] as const).every((speaker) =>
      listsMoodStyles(chooseVoice({ speaker, language }, overrides)),
    ),
  );
}

/** True when the table lists every style moods ask for on this voice. */
export function listsMoodStyles(voice: string): boolean {
  const styles = VOICE_STYLES[voice] ?? [];
  return Object.values(MOOD_STYLE).every((style) => styles.includes(style as string));
}

// ---------------------------------------------------------------------------------------
// The four neutral choices

/** How the catalogue makes each of the four choices in one language. */
export function voiceOptions(language: SpeechLanguage): readonly VoiceOption[] {
  const used = new Set<string>();
  return VOICE_IDS.map((id) => {
    const providerVoice = VOICE_CATALOGUE[language][id];
    const shared = used.has(providerVoice);
    used.add(providerVoice);
    return { id, providerVoice, shared, styles: listsMoodStyles(providerVoice) };
  });
}

/**
 * The four choices as the web app sees them: label, trait and description, and for each language
 * whether the choice has a synthetic voice of its own there and whether mood can be performed with
 * a style. It carries no provider voice name, so nothing in it names or suggests a person.
 */
export function describeVoices(
  optionsFor: (language: SpeechLanguage) => readonly VoiceOption[],
): SpeechVoiceDTO[] {
  return VOICE_CHOICES.map(({ id, label, trait, description }) => {
    const languages: SpeechVoiceDTO['languages'] = {};
    for (const language of SPEECH_LANGUAGES) {
      const option = optionsFor(language).find((candidate) => candidate.id === id);
      if (option) {
        languages[language] = { voice: option.shared ? 'shared' : 'own', styles: option.styles };
      }
    }
    return { id, label, trait, description, languages };
  });
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
 * The words that will be spoken for a stored line: control characters removed, anything that is not
 * speech taken out (markdown, JSON, stage directions, notes meant for the simulation, speaker
 * labels, see `toSpokenText`), whitespace tidied, and a line that is too long cut at a sentence
 * boundary. The stored text is never changed.
 */
export function prepareSpokenText(
  text: string,
  max = MAX_SPOKEN_CHARS,
): { text: string; truncated: boolean } {
  // Control characters go first, but lines stay lines: speaker labels, bullets and notes are
  // recognised by where a line starts.
  return cutAtSentence(cleanText(toSpokenText(text.replace(UNSPOKEN, ''))), max);
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
  /** The neutral voice choice this was planned for, or null when no voice was chosen. */
  voiceId: VoiceId | null;
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
    voiceId: direction.voice ?? null,
    style: styled?.style ?? 'none',
    text: spoken.text,
    truncated: spoken.truncated,
  };
}
