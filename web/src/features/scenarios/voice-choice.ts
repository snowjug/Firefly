import {
  DEFAULT_SPEECH_LANGUAGE,
  SPEECH_LANGUAGES,
  type SpeechCapabilitiesDTO,
  type SpeechLanguage,
  type SpeechVoiceDTO,
} from '#shared/domain/speech.ts';
import {
  VOICE_CHOICES,
  VOICE_IDS,
  defaultVoiceFor,
  isVoiceId,
  voiceChoice,
  type VoiceId,
} from '#shared/domain/voices.ts';
import type { PlaybackKind } from '../voice/support.ts';

// The one place in this feature that turns the speech contract's voices into what the screens offer.
// The ids, the labels, their order and the scenario's starting voice all come from the shared
// voice catalogue (`shared/domain/voices.ts`), which the server and the call use too, so a choice made here
// means the same thing there. Labels are neutral on purpose: no voice is named after a person, a
// gender or a stereotype, and nothing about the customer's behaviour depends on the choice.

export { VOICE_IDS, defaultVoiceFor, isVoiceId };
export type { VoiceId };

export interface VoiceOption {
  id: VoiceId;
  /** For example "Voice A - Warm". */
  label: string;
  /** One neutral sentence about how the voice is delivered. */
  description: string;
}

const option = ({ id, label, description }: VoiceOption): VoiceOption => ({
  id,
  label,
  description,
});

/**
 * The voices to offer. A server that speaks lists the voices it can make. When the browser's own
 * voices will speak, the four neutral choices are offered and the browser gives each the best voice
 * it has. When nothing will speak there is no choice, and neither is there when the server speaks but
 * lists no voices: it is from before voices could be chosen, so it could not honour a choice, and no
 * request should name one. While the setup is still unknown the four are shown, so the control does
 * not appear and then change.
 */
export function voiceChoices(
  speech: Pick<SpeechCapabilitiesDTO, 'voices'> | null,
  playback: PlaybackKind | null,
): readonly VoiceOption[] {
  if (playback === 'none') return [];
  if (playback === 'server-speech' && speech) {
    return (speech.voices ?? []).filter((voice) => isVoiceId(voice.id)).map(option);
  }
  return VOICE_CHOICES.map(option);
}

/** The voice to use: the one wanted if it is on offer, otherwise the first on offer, otherwise none. */
export function offeredVoice(
  offered: readonly VoiceOption[],
  wanted: VoiceId,
): VoiceId | undefined {
  return offered.some((voice) => voice.id === wanted) ? wanted : offered[0]?.id;
}

export function voiceLabel(id: VoiceId): string {
  return voiceChoice(id).label;
}

/**
 * Says so when the speech service has fewer voices of its own in this language than there are
 * choices, so that some share one synthetic voice and differ only in pace. Null when each has its own.
 */
export function sharedVoiceNote(
  voices: readonly Pick<SpeechVoiceDTO, 'languages'>[] | undefined,
  language: SpeechLanguage,
): string | null {
  const shared = (voices ?? []).some((voice) => voice.languages[language]?.voice === 'shared');
  return shared ? 'Some of these voices share one synthetic voice and differ only in pace.' : null;
}

function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  if (navigator.languages?.length) return navigator.languages;
  return navigator.language ? [navigator.language] : [];
}

/**
 * The language a call from this browser will speak: the first of the browser's languages that speech
 * offers, which is how the call page chooses, or British English. A sample is in the same language, so
 * it sounds as the call will.
 */
export function speechLanguage(tags: readonly string[] = browserLanguages()): SpeechLanguage {
  for (const tag of tags) {
    const match = SPEECH_LANGUAGES.find((code) => code.toLowerCase() === tag.toLowerCase());
    if (match) return match;
  }
  return DEFAULT_SPEECH_LANGUAGE;
}
