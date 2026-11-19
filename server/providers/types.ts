import type { EvaluationDraft } from '#shared/domain/report.ts';
import type { EvaluationInput } from '../engine/types.ts';
import type { TurnClassification } from '#shared/domain/classification.ts';
import type { EffectiveScenario } from '#shared/domain/config.ts';
import type { ProviderKind } from '#shared/domain/api.ts';
import type { CustomerGeneration, CustomerGenerationContext } from '../engine/pipeline.ts';

// A model provider supplies the three judgement calls of a simulated call. The deterministic parts
// (customer state, discovery gating, curveball timing, score arithmetic, evidence verification)
// never depend on the provider.

export interface ClassifyArgs {
  scenario: EffectiveScenario;
  traineeText: string;
  traineeTurnNumber: number;
  lastCustomerText: string | null;
}

export interface PromptVersions {
  customer: string;
  classifier: string;
  evaluator: string;
}

export interface ModelProvider {
  readonly kind: ProviderKind;
  /** Shown in the UI and stored with every session. Never claims a model that was not used. */
  readonly label: string;
  readonly demo: boolean;
  readonly prompts: PromptVersions;
  /** Describes the trainee's turn. Throws ProviderError on failure (the caller falls back to rules). */
  classifyTurn(args: ClassifyArgs, signal?: AbortSignal): Promise<TurnClassification>;
  /** Writes the customer's reply. Throws ProviderError on failure; there is no silent fallback. */
  generateCustomer(
    ctx: CustomerGenerationContext,
    signal?: AbortSignal,
  ): Promise<CustomerGeneration>;
  /**
   * Live providers return a model-written judgement that the evaluator then verifies and merges with
   * facts computed in code. Demo mode omits this and uses the rules evaluator instead.
   */
  evaluateDraft?(input: EvaluationInput, signal?: AbortSignal): Promise<EvaluationDraft>;
}

export type ProviderErrorCode =
  | 'provider_not_configured'
  | 'provider_unavailable'
  | 'provider_timeout'
  | 'provider_rate_limited'
  | 'provider_bad_output'
  | 'provider_content_filtered';

/** A provider failure with a safe, user-facing message. Never carries secrets or raw payloads. */
export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly retryable: boolean;
  constructor(code: ProviderErrorCode, message: string, retryable: boolean, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'ProviderError';
    this.code = code;
    this.retryable = retryable;
  }
}

export type ProviderConfig =
  | { kind: 'mock'; mockDelayMs: number }
  | {
      kind: 'azure-openai';
      endpoint: string;
      apiKey: string;
      deployment: string;
      apiVersion: string;
      timeoutMs: number;
      maxRetries: number;
    }
  | {
      kind: 'openai-compatible';
      baseUrl: string;
      apiKey: string;
      model: string;
      timeoutMs: number;
      maxRetries: number;
    };

export interface LoadedProviderConfig {
  config: ProviderConfig;
  /** Set when a live provider was requested but could not be configured; demo mode is used. */
  problem: string | null;
}

const present = (v: string | undefined): v is string =>
  typeof v === 'string' && v.trim() !== '' && !/^<.*>$/.test(v.trim());

/**
 * Reads provider settings from the environment. If a live provider is requested but its settings
 * are missing, the app stays usable in demo mode and reports the problem (never the secret values).
 */
export function loadProviderConfig(env: NodeJS.ProcessEnv = process.env): LoadedProviderConfig {
  const mockDelayMs = Math.max(0, Number(env.FIREFLY_MOCK_DELAY_MS ?? 700) || 0);
  const kind = (env.FIREFLY_PROVIDER ?? 'mock').trim().toLowerCase();
  const timeoutMs = Math.max(1000, Number(env.FIREFLY_LLM_TIMEOUT_MS ?? 30000) || 30000);
  const maxRetries = Math.min(3, Math.max(0, Number(env.FIREFLY_LLM_MAX_RETRIES ?? 1) || 0));

  if (kind === 'azure-openai') {
    const missing = [
      'AZURE_OPENAI_ENDPOINT',
      'AZURE_OPENAI_API_KEY',
      'AZURE_OPENAI_DEPLOYMENT',
      'AZURE_OPENAI_API_VERSION',
    ].filter((name) => !present(env[name]));
    if (missing.length > 0) {
      return {
        config: { kind: 'mock', mockDelayMs },
        problem: `FIREFLY_PROVIDER=azure-openai but ${missing.join(', ')} ${missing.length > 1 ? 'are' : 'is'} not set.`,
      };
    }
    return {
      config: {
        kind: 'azure-openai',
        endpoint: (env.AZURE_OPENAI_ENDPOINT as string).trim().replace(/\/+$/, ''),
        apiKey: (env.AZURE_OPENAI_API_KEY as string).trim(),
        deployment: (env.AZURE_OPENAI_DEPLOYMENT as string).trim(),
        apiVersion: (env.AZURE_OPENAI_API_VERSION as string).trim(),
        timeoutMs,
        maxRetries,
      },
      problem: null,
    };
  }

  if (kind === 'openai-compatible') {
    const missing = ['FIREFLY_LLM_BASE_URL', 'FIREFLY_LLM_API_KEY', 'FIREFLY_LLM_MODEL'].filter(
      (name) => !present(env[name]),
    );
    if (missing.length > 0) {
      return {
        config: { kind: 'mock', mockDelayMs },
        problem: `FIREFLY_PROVIDER=openai-compatible but ${missing.join(', ')} ${missing.length > 1 ? 'are' : 'is'} not set.`,
      };
    }
    return {
      config: {
        kind: 'openai-compatible',
        baseUrl: (env.FIREFLY_LLM_BASE_URL as string).trim().replace(/\/+$/, ''),
        apiKey: (env.FIREFLY_LLM_API_KEY as string).trim(),
        model: (env.FIREFLY_LLM_MODEL as string).trim(),
        timeoutMs,
        maxRetries,
      },
      problem: null,
    };
  }

  if (kind !== 'mock') {
    return {
      config: { kind: 'mock', mockDelayMs },
      problem: `FIREFLY_PROVIDER="${kind}" is not recognised. Use mock, azure-openai or openai-compatible.`,
    };
  }
  return { config: { kind: 'mock', mockDelayMs }, problem: null };
}
