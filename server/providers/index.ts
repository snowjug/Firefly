import { createLiveProvider } from './live.ts';
import { createMockProvider } from './mock.ts';
import { loadProviderConfig, type LoadedProviderConfig, type ModelProvider } from './types.ts';

/** Demo mode for a mock configuration, otherwise the live provider the configuration describes. */
export function createProvider(loaded: LoadedProviderConfig): ModelProvider {
  const { config } = loaded;
  return config.kind === 'mock'
    ? createMockProvider({ delayMs: config.mockDelayMs })
    : createLiveProvider(config);
}

/**
 * Builds the provider from environment variables. If a live provider was requested but not fully
 * configured, the provider is demo mode and `problem` says why (never including secret values).
 */
export function createProviderFromEnv(env: NodeJS.ProcessEnv = process.env): {
  provider: ModelProvider;
  problem: string | null;
} {
  const loaded = loadProviderConfig(env);
  return { provider: createProvider(loaded), problem: loaded.problem };
}
