import { createAzureSpeechProvider, type AzureSpeechOptions } from './azure.ts';
import { createMockSpeechProvider } from './mock.ts';
import {
  loadSpeechConfig,
  SPEECH_LIMITS,
  SPEECH_OFF_MESSAGES,
  SpeechError,
  type LoadedSpeechConfig,
  type SpeechProvider,
} from './types.ts';

export const NONE_SPEECH_LABEL = 'Not configured';

/** Speech switched off: typed calls only. Every call to it fails with `speech_unavailable`. */
export function createNoneSpeechProvider(notice: string | null = null): SpeechProvider {
  return {
    kind: 'none',
    label: NONE_SPEECH_LABEL,
    demo: false,
    capabilities: () => ({
      provider: 'none',
      label: NONE_SPEECH_LABEL,
      demo: false,
      transcribe: false,
      synthesize: false,
      expressiveStyles: false,
      notice,
      limits: SPEECH_LIMITS,
    }),
    transcribe: () =>
      Promise.reject(new SpeechError('speech_unavailable', SPEECH_OFF_MESSAGES.transcribe, false)),
    synthesize: () =>
      Promise.reject(new SpeechError('speech_unavailable', SPEECH_OFF_MESSAGES.synthesize, false)),
  };
}

/** The provider a configuration describes: none, the scripted demonstration, or Azure AI Speech. */
export function createSpeechProvider(
  loaded: LoadedSpeechConfig,
  options: Omit<AzureSpeechOptions, 'notice'> = {},
): SpeechProvider {
  const { config, problem } = loaded;
  if (config.kind === 'azure-speech') {
    return createAzureSpeechProvider(config, { ...options, notice: problem });
  }
  return config.kind === 'mock' ? createMockSpeechProvider() : createNoneSpeechProvider(problem);
}

/**
 * Builds the provider from environment variables. If Azure was requested but not fully configured
 * the provider is `none` and its notice says why (never including secret values).
 */
export function createSpeechProviderFromEnv(env: NodeJS.ProcessEnv = process.env): SpeechProvider {
  return createSpeechProvider(loadSpeechConfig(env));
}
