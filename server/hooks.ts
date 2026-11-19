import type { ProviderErrorCode } from './providers/types.ts';
import { ProviderError } from './providers/types.ts';

// Test-only failure injection. When FIREFLY_TEST_HOOKS=1 the automated tests can ask the next N
// provider calls of a given kind to fail, to exercise failure recovery end to end. Disabled (and
// the endpoint absent) in normal use.

export type FailureTarget = 'customer' | 'classifier' | 'evaluator';

export interface FailureHooks {
  readonly enabled: boolean;
  setNext(target: FailureTarget, count: number, code?: ProviderErrorCode): void;
  /** Throws a ProviderError if a failure was queued for this target. */
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
