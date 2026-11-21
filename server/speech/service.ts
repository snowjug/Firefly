import type { SpeechLanguage, VoiceDirection } from '#shared/domain/speech.ts';
import { VOICE_PREVIEW_TEXT, type VoiceId } from '#shared/domain/voices.ts';
import type { TemperatureBandId } from '#shared/domain/vocab.ts';
import {
  SPEECH_OFF_MESSAGES,
  SpeechError,
  type SpeechProvider,
  type SynthesizeResult,
  type TranscribeRequest,
  type TranscribeResult,
} from './types.ts';
import { voiceDirection, type Speaker } from './voices.ts';

// The speech use cases, with no HTTP in them: what it takes to turn a recording into words, to speak
// one stored customer line, and to play the short voice preview. Each takes the speech port it needs
// and plain values, and returns plain values, so each can be tested with an in-memory provider. The
// HTTP routes only read the request, call one of these and write the answer.

type CapabilityReader = Pick<SpeechProvider, 'capabilities'>;

/** Turns a request away, before any audio is read, when speech is not switched on for this job. */
export function requireSpeech(provider: CapabilityReader, job: 'transcribe' | 'synthesize'): void {
  if (!provider.capabilities()[job]) {
    throw new SpeechError('speech_unavailable', SPEECH_OFF_MESSAGES[job], false);
  }
}

export interface SpokenLine {
  /** The customer's stored line. It is the only source of words for speech. */
  text: string;
  /** Only used to pair a voice when none was chosen: calls saved before voices could be chosen. */
  speaker: Speaker;
  mood: TemperatureBandId;
  /** The customer is cooling down: a little slower and calmer than their mood alone. */
  recovering?: boolean;
}

export interface VoiceChoiceOptions {
  language: SpeechLanguage;
  /** The voice the trainee chose. Left out, the persona's speaker picks one, as it always did. */
  voice?: VoiceId | undefined;
}

/** How one stored customer line should sound. */
export function directionForLine(
  line: Pick<SpokenLine, 'speaker' | 'mood' | 'recovering'>,
  options: VoiceChoiceOptions,
): VoiceDirection {
  return voiceDirection({
    speaker: line.speaker,
    language: options.language,
    mood: line.mood,
    ...(options.voice ? { voice: options.voice } : {}),
    ...(line.recovering ? { recovering: true } : {}),
  });
}

/** Speaks one stored customer line in the voice the trainee chose (or the old pairing). */
export async function speakLine(
  provider: Pick<SpeechProvider, 'capabilities' | 'synthesize'>,
  line: SpokenLine,
  options: VoiceChoiceOptions,
  signal?: AbortSignal,
): Promise<SynthesizeResult> {
  requireSpeech(provider, 'synthesize');
  return provider.synthesize(
    { text: line.text, direction: directionForLine(line, options) },
    signal,
  );
}

/**
 * The preview: the one fixed sentence, in a calm voice, for the chosen voice. Its words never come
 * from the caller, so it cannot be used to make the voice say anything else.
 */
export async function previewVoice(
  provider: Pick<SpeechProvider, 'capabilities' | 'synthesize'>,
  options: { language: SpeechLanguage; voice: VoiceId },
  signal?: AbortSignal,
): Promise<SynthesizeResult> {
  requireSpeech(provider, 'synthesize');
  return provider.synthesize(
    {
      text: VOICE_PREVIEW_TEXT,
      direction: voiceDirection({
        // Unused when a voice is named: the speaker only pairs a voice for older clients.
        speaker: 'female',
        language: options.language,
        mood: 'calm',
        voice: options.voice,
      }),
    },
    signal,
  );
}

/** Turns one validated recording into words. The recording is read, never kept. */
export async function transcribeRecording(
  provider: Pick<SpeechProvider, 'capabilities' | 'transcribe'>,
  request: TranscribeRequest,
  signal?: AbortSignal,
): Promise<TranscribeResult> {
  requireSpeech(provider, 'transcribe');
  return provider.transcribe(request, signal);
}
