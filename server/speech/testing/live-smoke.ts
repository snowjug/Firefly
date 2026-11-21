import { VOICE_IDS } from '#shared/domain/voices.ts';
import type { AzureSpeechConfig } from '../azure.ts';
import { loadSpeechConfig, type SpeechProvider } from '../types.ts';
import { voiceDirection } from '../voices.ts';
import { validateWav } from '../wav.ts';

// The optional smoke test of the real Azure AI Speech service: speak one short, fixed, synthetic
// sentence and transcribe it back. It is the only thing in the repository that can call the live
// service, and it runs only when somebody asks it to, on their own machine, with their own key. It
// is never run in CI. No audio is written anywhere: the sentence goes from the service into memory
// and straight back to the service.

export const SMOKE_SENTENCE = 'Hello, this is a short speech check for Firefly.';
/** What a recogniser should find in the sentence, whichever way it spells the last word. */
export const SMOKE_KEYWORDS = ['hello', 'short', 'speech', 'check', 'firefly'] as const;
/** How many of those must come back for the round trip to count. */
export const SMOKE_MIN_MATCHES = 3;

export type SmokeGate = { run: true; config: AzureSpeechConfig } | { run: false; reason: string };

/**
 * Whether the live smoke test may run: only when FIREFLY_LIVE_SPEECH_SMOKE=1, it is not CI, and the
 * Azure Speech settings (AZURE_SPEECH_KEY and AZURE_SPEECH_REGION or AZURE_SPEECH_ENDPOINT) are in
 * the environment. The reason names variables and never their values.
 */
export function liveSmokeGate(env: NodeJS.ProcessEnv): SmokeGate {
  if (env.FIREFLY_LIVE_SPEECH_SMOKE !== '1') {
    return { run: false, reason: 'FIREFLY_LIVE_SPEECH_SMOKE is not 1.' };
  }
  if (env.CI) return { run: false, reason: 'This is CI, where the live smoke test never runs.' };
  const loaded = loadSpeechConfig({ ...env, FIREFLY_SPEECH_PROVIDER: 'azure-speech' });
  if (loaded.config.kind !== 'azure-speech') {
    return { run: false, reason: loaded.problem ?? 'Azure AI Speech is not configured.' };
  }
  return { run: true, config: loaded.config };
}

export interface SmokeResult {
  status: 'recognised' | 'no-speech';
  /** What the service heard. Always the fixed sentence above, synthesised: never a person. */
  transcript: string;
  matched: string[];
  audioMs: number;
}

/**
 * Speaks `SMOKE_SENTENCE` through the provider and transcribes the audio it gets back. The provider
 * must have been built to return WAV (`outputFormat`), because speech to text cannot read an mp3.
 */
export async function runSpeechSmoke(provider: SpeechProvider): Promise<SmokeResult> {
  const spoken = await provider.synthesize({
    text: SMOKE_SENTENCE,
    direction: voiceDirection({
      speaker: 'female',
      language: 'en-GB',
      mood: 'calm',
      voice: VOICE_IDS[0],
    }),
  });
  const wav = validateWav(spoken.audio);
  if (!wav.ok) throw new Error(`The spoken sentence was not a usable recording: ${wav.message}`);
  const heard = await provider.transcribe({
    audio: wav.wav,
    language: 'en-GB',
    durationMs: wav.durationMs,
  });
  const lower = heard.text.toLowerCase();
  return {
    status: heard.status,
    transcript: heard.text,
    matched: SMOKE_KEYWORDS.filter((word) => lower.includes(word)),
    audioMs: wav.durationMs,
  };
}
