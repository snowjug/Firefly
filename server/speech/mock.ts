import type { SpeechLanguage, VoiceDirection } from '#shared/domain/speech.ts';
import { VOICE_IDS, voiceChoice } from '#shared/domain/voices.ts';
import {
  NOTHING_TO_SPEAK_MESSAGE,
  SPEECH_LIMITS,
  SpeechError,
  type SpeechProvider,
  type SynthesizeRequest,
  type SynthesizeResult,
  type TranscribeRequest,
  type TranscribeResult,
  type VoiceOption,
} from './types.ts';
import { describeVoices, prepareSpokenText } from './voices.ts';
import { encodeWav, WAV_SAMPLE_RATE } from './wav.ts';

// Demo speech: a scripted stand-in for tests and demonstrations, turned on explicitly with
// FIREFLY_SPEECH_PROVIDER=mock and labelled as such. It does not understand audio. It does not speak
// either: the "voice" is a short, soft sound whose length follows the length of the line, and
// whose length and texture follow the voice that was asked for, so a test can see that the right
// choice reached the provider. The four choices are one placeholder sound told apart by pace alone,
// which the voice list says (`shared`), because a demonstration has no voices to choose between.

export const MOCK_SPEECH_LABEL = 'Demo speech (scripted)';

/** Recordings shorter than this are treated as silence. */
export const MOCK_MIN_AUDIO_MS = 150;

/** What "recognised" speech says, in order, then round again. Plain things a support engineer says. */
export const MOCK_UTTERANCES: readonly string[] = [
  "Hello, thanks for calling. My name is Sam. I'm sorry you're having trouble, so can you tell me what is happening?",
  'That sounds frustrating. When did this start, and was there a time when it last worked?',
  'Who else is affected by this, just you or other people on your team as well?',
  'Has anything changed recently, like an update or a new setting?',
  'What have you already tried so far, and what did you see when you tried it?',
  "Thank you for explaining that. I'll take ownership of this case and I'll call you back by three o'clock with an update.",
  'Let me summarise what I have so far to make sure I have it right. Does that sound correct?',
  'Is there anything else I can help you with today?',
];

const CHARACTERS_PER_SECOND = 15;
const MIN_SECONDS = 0.5;
const MAX_SECONDS = 8;
// An RMS level of about -37 dBFS (peaks about -26 dBFS): audible, never startling.
const LEVEL = 3000;
// How quickly the noise changes: a larger number is a brighter, busier sound. The four voice
// choices differ in it a little, so a test can hear (as bytes) which choice reached the provider.
const TEXTURE: Record<string, number> = {
  'voice-a': 0.12,
  'voice-b': 0.16,
  'voice-c': 0.09,
  'voice-d': 0.14,
};
const DEFAULT_TEXTURE = 0.12;

const hash = (text: string): number => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** Soft, low-passed noise with short fades, the same every time for the same seed. */
function softNoise(seconds: number, seed: number, texture = DEFAULT_TEXTURE): Buffer {
  const samples = Math.round(seconds * WAV_SAMPLE_RATE);
  const pcm = Buffer.alloc(samples * 2);
  const fade = Math.min(samples / 2, WAV_SAMPLE_RATE * 0.03);
  let state = seed || 1;
  let smooth = 0;
  for (let i = 0; i < samples; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    smooth += ((state / 0xffffffff) * 2 - 1 - smooth) * texture;
    const envelope = Math.min(1, i / fade, (samples - 1 - i) / fade);
    pcm.writeInt16LE(Math.round(smooth * LEVEL * envelope), i * 2);
  }
  return pcm;
}

/** The demonstration's four choices: one placeholder sound, told apart by pace alone. */
export function mockVoiceOptions(_language?: SpeechLanguage): readonly VoiceOption[] {
  return VOICE_IDS.map((id, index) => ({
    id,
    providerVoice: 'mock',
    shared: index > 0,
    styles: false,
  }));
}

/** A slower voice choice makes a longer sound and a quicker one a shorter sound. */
const secondsFor = (text: string, direction: Pick<VoiceDirection, 'voice'>): number => {
  const pace = direction.voice ? voiceChoice(direction.voice).paceDelta : 0;
  const seconds = text.length / CHARACTERS_PER_SECOND / (1 + pace / 100);
  return Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, seconds));
};

export function createMockSpeechProvider(
  options: { utterances?: readonly string[] } = {},
): SpeechProvider {
  const lines = options.utterances?.length ? options.utterances : MOCK_UTTERANCES;
  let next = 0;
  return {
    kind: 'mock',
    label: MOCK_SPEECH_LABEL,
    demo: true,
    capabilities: () => ({
      provider: 'mock',
      label: MOCK_SPEECH_LABEL,
      demo: true,
      transcribe: true,
      synthesize: true,
      expressiveStyles: false,
      notice: null,
      voices: describeVoices(mockVoiceOptions),
      limits: SPEECH_LIMITS,
    }),
    listVoices: mockVoiceOptions,
    transcribe(request: TranscribeRequest): Promise<TranscribeResult> {
      if (request.durationMs < MOCK_MIN_AUDIO_MS) {
        return Promise.resolve({ status: 'no-speech', text: '', durationMs: request.durationMs });
      }
      const text = lines[next % lines.length] as string;
      next += 1;
      return Promise.resolve({ status: 'recognised', text, durationMs: request.durationMs });
    },
    synthesize(request: SynthesizeRequest): Promise<SynthesizeResult> {
      // The same rule as the real provider: only what would be spoken counts, and a line with
      // nothing in it to speak is refused the same way.
      const spoken = prepareSpokenText(request.text).text;
      if (spoken === '') {
        return Promise.reject(new SpeechError('speech_failed', NOTHING_TO_SPEAK_MESSAGE, false));
      }
      const { voice } = request.direction;
      return Promise.resolve({
        audio: encodeWav(
          softNoise(
            secondsFor(spoken, request.direction),
            hash(`${voice ?? ''}|${spoken}`),
            voice ? TEXTURE[voice] : DEFAULT_TEXTURE,
          ),
        ),
        contentType: 'audio/wav',
        voice: 'mock',
        style: 'none',
        ...(voice ? { voiceId: voice } : {}),
      });
    },
  };
}
