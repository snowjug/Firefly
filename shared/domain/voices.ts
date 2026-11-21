// The customer's voice: four neutral choices a trainee can pick between, the sentence "Test voice"
// speaks, and the voice a scenario starts with.
//
// This is its own module on purpose. The web app's first load (`lib/api.ts`) needs the small
// constants and types in speech.ts, and a bundler puts a whole module in the chunk that needs any of
// it, so everything here (the catalogue, the labels, the hash behind the default) would travel with
// them into the first load although only the brief and call pages use it. speech.ts therefore never
// imports this module except for types, which are erased, and nothing re-exports it from there.
// web/src/features/voice/entry-weight.test.ts holds that line.

/**
 * The customer voices a trainee can choose between. The ids are stable: they travel on requests and
 * are never reused for another voice. The labels describe how a voice is delivered and nothing
 * else: never a person, a gender, an accent or an age.
 */
export const VOICE_IDS = ['voice-a', 'voice-b', 'voice-c', 'voice-d'] as const;
export type VoiceId = (typeof VOICE_IDS)[number];

export function isVoiceId(value: unknown): value is VoiceId {
  return typeof value === 'string' && (VOICE_IDS as readonly string[]).includes(value);
}

export const VOICE_TRAITS = ['Warm', 'Direct', 'Measured', 'Concise'] as const;
export type VoiceTrait = (typeof VOICE_TRAITS)[number];

export interface VoiceChoice {
  id: VoiceId;
  /** Shown to the trainee, for example "Voice A - Warm". */
  label: string;
  trait: VoiceTrait;
  /** One neutral sentence about how the voice is delivered. */
  description: string;
  /** Speaking rate against the plain voice, in percent. Every provider applies it the same way. */
  paceDelta: number;
}

export const VOICE_CHOICES: readonly VoiceChoice[] = [
  {
    id: 'voice-a',
    label: 'Voice A - Warm',
    trait: 'Warm',
    description: 'A relaxed, friendly pace.',
    paceDelta: -2,
  },
  {
    id: 'voice-b',
    label: 'Voice B - Direct',
    trait: 'Direct',
    description: 'A brisk pace that gets to the point.',
    paceDelta: 4,
  },
  {
    id: 'voice-c',
    label: 'Voice C - Measured',
    trait: 'Measured',
    description: 'A slow, steady pace.',
    paceDelta: -6,
  },
  {
    id: 'voice-d',
    label: 'Voice D - Concise',
    trait: 'Concise',
    description: 'A crisp, even pace.',
    paceDelta: 2,
  },
];

export function voiceChoice(id: VoiceId): VoiceChoice {
  return VOICE_CHOICES.find((choice) => choice.id === id) as VoiceChoice;
}

/** The one sentence spoken by "Test voice". It is fixed on the server, so it cannot be changed from the browser. */
export const VOICE_PREVIEW_TEXT = 'Hello, this is a test of the voice you chose.';

// FNV-1a: small, and the same in every browser and every run.
function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The voice a scenario starts with. It depends on the scenario's id and on nothing about the
 * customer, so it never follows a gender, an accent or an age, and the same scenario always starts
 * with the same voice. The trainee can pick another.
 */
export function defaultVoiceFor(scenarioId: string): VoiceId {
  const h = fnv1a(`voice:${scenarioId.trim().toLowerCase()}`);
  return VOICE_IDS[((h ^ (h >>> 15)) >>> 0) % VOICE_IDS.length] as VoiceId;
}
