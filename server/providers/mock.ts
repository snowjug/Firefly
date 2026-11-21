import { classifyTurnRules } from '../engine/classifier.ts';
import { mockGenerate } from '../engine/mock/index.ts';
import type { ClassifyArgs, ModelProvider, PromptVersions } from './types.ts';

// Demo mode: Firefly's built-in rules engine. No network, no credentials. It is always labelled as
// demo mode in the UI and in stored sessions, and never presented as a model.

export const MOCK_PROMPTS: PromptVersions = {
  customer: 'rules-customer-3',
  classifier: 'rules-classifier-2',
  evaluator: 'rules-evaluator-1',
};

export function createMockProvider(options: { delayMs?: number } = {}): ModelProvider {
  const delayMs = options.delayMs ?? 0;
  return {
    kind: 'mock',
    label: 'Demo mode (built-in rules engine)',
    demo: true,
    prompts: MOCK_PROMPTS,
    classifyTurn(args: ClassifyArgs) {
      return Promise.resolve(
        classifyTurnRules(args.traineeText, {
          scenario: args.scenario,
          traineeTurnNumber: args.traineeTurnNumber,
        }),
      );
    },
    async generateCustomer(ctx, signal) {
      if (delayMs > 0) {
        // A short pause so the typing indicator is visible; configurable and zero in tests.
        const wait = Math.round(delayMs * (0.6 + ctx.rng() * 0.8));
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, wait);
          signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('aborted', 'AbortError'));
          });
        });
      }
      return mockGenerate(ctx);
    },
  };
}
