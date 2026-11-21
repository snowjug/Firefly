import type { ProviderErrorCode } from './providers/types.ts';
import { ProviderError } from './providers/types.ts';
import { SpeechError } from './speech/types.ts';

// Test-only failure injection. When FIREFLY_TEST_HOOKS=1 the automated tests can ask the next N
// calls of a given kind to fail, to exercise failure recovery end to end: a model call (the
// customer's reply, turn classification, evaluation) or a speech call (turning a recording into
// text, speaking a customer's line). Disabled (and the endpoint absent) in normal use.

export const FAILURE_TARGETS = [
  'customer',
  'classifier',
  'evaluator',
  'transcribe',
  'synthesize',
] as const;
export type FailureTarget = (typeof FAILURE_TARGETS)[number];

const isSpeechTarget = (target: FailureTarget) =>
  target === 'transcribe' || target === 'synthesize';

export interface FailureHooks {
  readonly enabled: boolean;
  /** `code` only changes a model failure: a speech failure is always `speech_failed`. */
  setNext(target: FailureTarget, count: number, code?: ProviderErrorCode): void;
  /** Throws a ProviderError (a model call) or a SpeechError (a speech call) if a failure was queued. */
  maybeFail(target: FailureTarget): void;
  reset(): void;
}

export function createFailureHooks(enabled: boolean): FailureHooks {
  const pending = new Map<FailureTarget, { count: number; code: ProviderErrorCode }>();
  return {
    enabled,
    setNext(target, count, code = 'provider_unavailable') {
      if (enabled) pending.set(target, { count, code });
    },
    maybeFail(target) {
      const entry = pending.get(target);
      if (!enabled || !entry || entry.count <= 0) return;
      entry.count -= 1;
      // A retryable failure, as a service that is briefly unavailable gives.
      if (isSpeechTarget(target)) {
        throw new SpeechError(
          'speech_failed',
          'The speech service is temporarily unavailable (simulated failure).',
          true,
        );
      }
      throw new ProviderError(
        entry.code,
        'The AI service is temporarily unavailable (simulated failure).',
        true,
      );
    },
    reset() {
      pending.clear();
    },
  };
}
