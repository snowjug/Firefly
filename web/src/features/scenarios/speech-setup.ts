import type { AppConfigDTO } from '#shared/domain/api.ts';
import type { SpeechCapabilitiesDTO } from '#shared/domain/speech.ts';
import {
  chooseCapture,
  choosePlayback,
  type CaptureKind,
  type PlaybackKind,
  type VoiceFeatures,
} from '../voice/support.ts';

// What the call brief knows about speech here. It is worked out from what this server and this
// browser can really do, with the same decision the call screen makes (`chooseCapture` and
// `choosePlayback`), so the brief never promises more than the call does. The sentences about where
// audio goes are the voice feature's (`privacyDetails`), and are not written again here.

export interface SpeechSetup {
  capture: CaptureKind;
  playback: PlaybackKind;
  /** A spoken call can be held: the microphone can be used and something can turn speech into text. */
  canSpeak: boolean;
  /** Why a spoken call cannot be held, when it cannot: the page is not secure, or nothing can listen. */
  typedBecause: 'insecure' | 'unsupported' | null;
  /** Why speech is degraded or off, from the server (safe to show), or null. */
  notice: string | null;
}

export function describeSpeechSetup(
  speech: Pick<SpeechCapabilitiesDTO, 'transcribe' | 'synthesize' | 'notice'>,
  features: VoiceFeatures,
): SpeechSetup {
  const capture = chooseCapture(speech, features);
  const playback = choosePlayback(speech, features);
  return {
    capture,
    playback,
    canSpeak: capture !== 'none',
    typedBecause: capture !== 'none' ? null : features.secureContext ? 'unsupported' : 'insecure',
    notice: speech.notice,
  };
}

/** Who plays the customer: the built-in rules engine, or a named language model. */
export function describeCustomer(provider: AppConfigDTO['provider']): string {
  return provider.demo
    ? "Demo mode: the customer is played by Firefly's built-in rules engine."
    : `Live model: ${provider.label}. The customer's replies come from this language model.`;
}
