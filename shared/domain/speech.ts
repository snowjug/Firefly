import type { TemperatureBandId } from './vocab.ts';

// The contract for spoken calls between the web app and the server. Audio itself never appears in
// the transcript API: the trainee's speech is turned into text, the customer's text is turned into
// speech, and the session service only ever stores text. The web app imports this module, so it
// holds no runtime schema library: the server validates the query string itself.

export const SPEECH_PROVIDER_KINDS = ['none', 'mock', 'azure-speech'] as const;
export type SpeechProviderKind = (typeof SPEECH_PROVIDER_KINDS)[number];

/** Languages offered for speech. Recognition and the customer's voice both use the chosen one. */
export const SPEECH_LANGUAGES = ['en-GB', 'en-US', 'en-IE', 'en-AU', 'en-IN'] as const;
export type SpeechLanguage = (typeof SPEECH_LANGUAGES)[number];
export const DEFAULT_SPEECH_LANGUAGE: SpeechLanguage = 'en-GB';

/** How a trainee turn reached the server. Stored with the turn so a report can say it was spoken. */
export const INPUT_MODES = ['text', 'voice'] as const;
export type InputMode = (typeof INPUT_MODES)[number];

/** What the server's speech provider can do right now. Sent with /api/config. */
export interface SpeechCapabilitiesDTO {
  provider: SpeechProviderKind;
  /** Plain label for status lines, such as "Azure AI Speech" or "Demo speech (scripted)". */
  label: string;
  /** True for the scripted provider that does not understand audio (tests and demonstrations). */
  demo: boolean;
  /** The server can turn the trainee's recorded speech into text. */
  transcribe: boolean;
  /** The server can speak the customer's replies in a synthetic voice. */
  synthesize: boolean;
  /**
   * True only when the provider can really perform the expressive styles Firefly asks for (for
   * example "unfriendly" for a frustrated customer). When false, mood is approximated by speaking
   * rate and pitch only.
   */
  expressiveStyles: boolean;
  /** Why speech is unavailable or degraded (a misconfiguration), safe to show. Null when fine. */
  notice: string | null;
  limits: {
    /** The largest audio upload accepted, in bytes. */
    maxAudioBytes: number;
    /** The longest single utterance accepted, in seconds. */
    maxAudioSeconds: number;
    /** The one sample rate accepted: 16-bit mono PCM in a WAV container. */
    sampleRate: 16000;
  };
}

/** The response of POST /api/speech/transcribe (the request body is audio/wav). */
export interface TranscribeResponse {
  /** `no-speech` means the audio held no recognisable speech; the text is then empty. */
  status: 'recognised' | 'no-speech';
  text: string;
  durationMs: number;
}

/**
 * Headers on the audio returned by POST /api/sessions/:id/turns/:index/speech. They say what was
 * really used, so the interface never claims more than the provider did.
 */
export const SPEECH_RESPONSE_HEADERS = {
  provider: 'x-firefly-speech-provider',
  voice: 'x-firefly-speech-voice',
  /** The expressive style that was applied, or `none` when mood was approximated by rate and pitch. */
  style: 'x-firefly-speech-style',
} as const;

/** The voice a customer turn is spoken with, chosen by the server from the scenario and the mood. */
export interface VoiceDirection {
  speaker: 'female' | 'male';
  language: SpeechLanguage;
  mood: TemperatureBandId;
  pace: 'measured' | 'brisk' | 'firm';
  /** 0 for plain speech, up to 1 for the strongest delivery the provider supports. */
  intensity: number;
}
