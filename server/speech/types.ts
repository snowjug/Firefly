import type {
  SpeechCapabilitiesDTO,
  SpeechLanguage,
  SpeechProviderKind,
  TranscribeResponse,
  VoiceDirection,
} from '#shared/domain/speech.ts';
import type { VoiceId } from '#shared/domain/voices.ts';

// A speech provider turns the trainee's recorded speech into text and speaks the customer's lines.
// It does only that: the conversation, the customer's mood and what is said all come from the
// simulation. The provider never learns who the trainee is, never keeps audio or text, and is
// never asked to judge the trainee's voice or emotion.
//
// There are three ports in all, and the two spoken ones are here: speech to text (`SpeechToTextPort`)
// and text to speech (`TextToSpeechPort`). The third, the customer-response model, is
// `ModelProvider` in ../providers/types.ts. None of the three knows about the others, about HTTP or
// about the database. The one place that picks an adapter for each is `createRuntime` in
// ../bootstrap.ts, and tests give it in-memory fakes instead.

/** What the server accepts and promises. The same numbers are sent to the web app in /api/config. */
export const SPEECH_LIMITS: SpeechCapabilitiesDTO['limits'] = {
  maxAudioBytes: 1_500_000,
  maxAudioSeconds: 30,
  sampleRate: 16000,
};

/** What a person is told when a request needs speech that is switched off. */
export const SPEECH_OFF_MESSAGES = {
  transcribe: 'Speech is not turned on for this server, so type your reply instead.',
  synthesize: "The customer's voice is not turned on for this server, so read their reply instead.",
} as const;

/** What a person is told when a line holds nothing a voice could say (every provider answers alike). */
export const NOTHING_TO_SPEAK_MESSAGE = 'There is nothing to speak in that line.';

export interface TranscribeRequest {
  /** A validated 16 kHz, 16-bit, mono PCM WAV file. */
  audio: Buffer;
  language: SpeechLanguage;
  /** The length of the recording, measured from the WAV container. */
  durationMs: number;
}

/** `no-speech` means the audio held no recognisable speech; the text is then empty. */
export type TranscribeResult = TranscribeResponse;

export interface SynthesizeRequest {
  /** The customer's stored line. The server reads it from the call, never from the browser. */
  text: string;
  direction: VoiceDirection;
}

export interface SynthesizeResult {
  audio: Buffer;
  contentType: string;
  /** The voice that really spoke. */
  voice: string;
  /** The expressive style that was really applied, or `none` when mood was only approximated. */
  style: string;
  /** The neutral voice choice the audio was made for, when the request named one. */
  voiceId?: VoiceId;
}

/** How a provider makes one of the four neutral customer voices in one language. */
export interface VoiceOption {
  id: VoiceId;
  /** The provider's own name for the voice that speaks, or `mock`. It is never offered as a choice. */
  providerVoice: string;
  /** An earlier choice in this language uses the same provider voice: the two differ by pace alone. */
  shared: boolean;
  /** Mood is performed with a speaking style on this voice, and not only by pace and pitch. */
  styles: boolean;
}

/** Speech to text: one recording in, plain words out. */
export interface SpeechToTextPort {
  /** Throws SpeechError on failure, and when the provider cannot transcribe. */
  transcribe(request: TranscribeRequest, signal?: AbortSignal): Promise<TranscribeResult>;
}

/** Text to speech: one customer line in, synthetic audio out. */
export interface TextToSpeechPort {
  /** Throws SpeechError on failure, and when the provider cannot speak. */
  synthesize(request: SynthesizeRequest, signal?: AbortSignal): Promise<SynthesizeResult>;
  /** The four neutral customer voices as this provider makes them in `language`; empty when it cannot speak. */
  listVoices(language: SpeechLanguage): readonly VoiceOption[];
}

export interface SpeechProvider extends SpeechToTextPort, TextToSpeechPort {
  readonly kind: SpeechProviderKind;
  /** Shown in the interface. Never claims a service that was not used. */
  readonly label: string;
  readonly demo: boolean;
  capabilities(): SpeechCapabilitiesDTO;
}

export type SpeechErrorCode =
  'speech_unavailable' | 'speech_failed' | 'speech_timeout' | 'speech_rate_limited';

/**
 * A speech failure with a message that is safe to show. It never carries the key, the provider's own
 * text, the audio or a line of the conversation. `retryable` says whether trying again can help.
 */
export class SpeechError extends Error {
  readonly code: SpeechErrorCode;
  readonly retryable: boolean;
  constructor(code: SpeechErrorCode, message: string, retryable: boolean, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'SpeechError';
    this.code = code;
    this.retryable = retryable;
  }
}

// ---------------------------------------------------------------------------------------
// Configuration

export type SpeechConfig =
  | { kind: 'none' }
  | { kind: 'mock' }
  | {
      kind: 'azure-speech';
      apiKey: string;
      /** The speech-to-text and text-to-speech REST endpoints, as complete addresses. */
      sttUrl: string;
      ttsUrl: string;
      /** Voice names that replace the built-in defaults for a speaker (null keeps the default). */
      voices: { female: string | null; male: string | null };
      timeoutMs: number;
    };

export interface LoadedSpeechConfig {
  config: SpeechConfig;
  /**
   * Set when speech was requested but could not be configured (speech is then off) or when an
   * optional setting had to be ignored. It names variables, never their values.
   */
  problem: string | null;
}

export const DEFAULT_SPEECH_TIMEOUT_MS = 15_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 60_000;

const STT_PATH = '/speech/recognition/conversation/cognitiveservices/v1';
const TTS_PATH = '/cognitiveservices/v1';
// A resource with a custom domain serves both services from one host, under a service prefix.
const CUSTOM_STT_PATH = `/stt${STT_PATH}`;
const CUSTOM_TTS_PATH = `/tts${TTS_PATH}`;

const REGION = /^[a-z][a-z0-9]{2,30}$/;
const REGIONAL_HOST =
  /^([a-z][a-z0-9]{2,30})\.(?:stt|tts)\.speech\.(microsoft\.com|azure\.us|azure\.cn)$/;
// For example en-GB-SoniaNeural, or en-US-Ava:DragonHDLatestNeural.
const VOICE_NAME = /^[A-Za-z]{2,3}-[A-Za-z]{2,4}-[A-Za-z0-9]{2,40}(?::[A-Za-z0-9]{2,40})?$/;
// A key is sent in a header, so it has to be visible ASCII.
const HEADER_VALUE = /^[\x21-\x7e]{1,256}$/;

const present = (v: string | undefined): v is string =>
  typeof v === 'string' && v.trim() !== '' && !/^<.*>$/.test(v.trim());

const off = (problem: string): LoadedSpeechConfig => ({
  config: { kind: 'none' },
  problem: `${problem} Spoken calls are turned off.`,
});

/**
 * Works out the two Azure endpoints from a region name or from an explicit address. An address wins
 * when both are given. Any https address is accepted, because private endpoints, sovereign clouds and
 * gateways each have their own host; a regional speech host such as uksouth.stt.speech.microsoft.com
 * is recognised and gets its matching text-to-speech host.
 */
export function azureEndpoints(
  region: string | undefined,
  endpoint: string | undefined,
): { sttUrl: string; ttsUrl: string } | { problem: string } {
  if (present(endpoint)) {
    let url: URL;
    try {
      url = new URL(endpoint.trim());
    } catch {
      return { problem: 'AZURE_SPEECH_ENDPOINT is not a valid web address.' };
    }
    if (url.protocol !== 'https:') {
      return { problem: 'AZURE_SPEECH_ENDPOINT must be an https address.' };
    }
    if (url.username || url.password || url.search || url.hash) {
      return {
        problem:
          'AZURE_SPEECH_ENDPOINT must be just the address, with no sign-in details, query or fragment.',
      };
    }
    const regional = REGIONAL_HOST.exec(url.hostname);
    if (regional) {
      const [, name, domain] = regional;
      return {
        sttUrl: `https://${name}.stt.speech.${domain}${STT_PATH}`,
        ttsUrl: `https://${name}.tts.speech.${domain}${TTS_PATH}`,
      };
    }
    const base = `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
    return { sttUrl: `${base}${CUSTOM_STT_PATH}`, ttsUrl: `${base}${CUSTOM_TTS_PATH}` };
  }
  const name = (region ?? '').trim().toLowerCase();
  if (!REGION.test(name)) {
    return { problem: 'AZURE_SPEECH_REGION is not a region name such as uksouth.' };
  }
  return {
    sttUrl: `https://${name}.stt.speech.microsoft.com${STT_PATH}`,
    ttsUrl: `https://${name}.tts.speech.microsoft.com${TTS_PATH}`,
  };
}

/**
 * Reads speech settings from the environment. Speech is off unless it is asked for. If Azure is
 * requested but not fully configured, the app stays usable (typed calls) and reports the problem,
 * naming variables and never their values.
 */
export function loadSpeechConfig(env: NodeJS.ProcessEnv = process.env): LoadedSpeechConfig {
  const requested = (env.FIREFLY_SPEECH_PROVIDER ?? '').trim().toLowerCase() || 'none';
  if (requested === 'none') return { config: { kind: 'none' }, problem: null };
  if (requested === 'mock') return { config: { kind: 'mock' }, problem: null };
  if (requested !== 'azure-speech') {
    return off('FIREFLY_SPEECH_PROVIDER is not recognised. Use none, mock or azure-speech.');
  }

  const missing: string[] = [];
  if (!present(env.AZURE_SPEECH_KEY)) missing.push('AZURE_SPEECH_KEY is not set');
  if (!present(env.AZURE_SPEECH_REGION) && !present(env.AZURE_SPEECH_ENDPOINT)) {
    missing.push('neither AZURE_SPEECH_REGION nor AZURE_SPEECH_ENDPOINT is set');
  }
  if (missing.length > 0) {
    return off(`FIREFLY_SPEECH_PROVIDER=azure-speech but ${missing.join(' and ')}.`);
  }

  const apiKey = (env.AZURE_SPEECH_KEY as string).trim();
  if (!HEADER_VALUE.test(apiKey)) {
    return off('AZURE_SPEECH_KEY contains characters that cannot be sent to the speech service.');
  }
  const endpoints = azureEndpoints(env.AZURE_SPEECH_REGION, env.AZURE_SPEECH_ENDPOINT);
  if ('problem' in endpoints) return off(endpoints.problem);

  const ignored: string[] = [];
  const voice = (name: 'AZURE_SPEECH_VOICE_FEMALE' | 'AZURE_SPEECH_VOICE_MALE') => {
    const value = env[name];
    if (!present(value)) return null;
    if (VOICE_NAME.test(value.trim())) return value.trim();
    ignored.push(name);
    return null;
  };
  const voices = {
    female: voice('AZURE_SPEECH_VOICE_FEMALE'),
    male: voice('AZURE_SPEECH_VOICE_MALE'),
  };

  const timeout = Number(env.FIREFLY_SPEECH_TIMEOUT_MS ?? DEFAULT_SPEECH_TIMEOUT_MS);
  const timeoutMs = Math.min(
    MAX_TIMEOUT_MS,
    Math.max(MIN_TIMEOUT_MS, timeout || DEFAULT_SPEECH_TIMEOUT_MS),
  );

  const many = ignored.length > 1;
  return {
    config: { kind: 'azure-speech', apiKey, ...endpoints, voices, timeoutMs },
    problem:
      ignored.length === 0
        ? null
        : `${ignored.join(' and ')} ${many ? 'are not voice names' : 'is not a voice name'} such as en-GB-SoniaNeural, so the default ${many ? 'voices are' : 'voice is'} used.`,
  };
}
