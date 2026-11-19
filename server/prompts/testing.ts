import type { TurnClassification } from '#shared/domain/classification.ts';
import type { EffectiveScenario } from '#shared/domain/config.ts';
import { mockClassifier } from '../engine/mock/index.ts';
import { processTraineeTurn, type CustomerGenerationContext } from '../engine/pipeline.ts';
import { createInitialRuntime, openingMessage } from '../engine/session.ts';
import type { TranscriptTurn } from '../engine/types.ts';

// Test helper: builds real customer-generation contexts by running trainee lines through the real
// engine pipeline, so tests exercise genuine state, discovery and curveball results rather than
// hand-built objects.

export interface ScriptedLine {
  text: string;
  /** Overrides applied on top of the rules classifier's result for this line. */
  classification?: Partial<TurnClassification>;
  /** What the customer says in reply, so later turns have realistic history. */
  reply?: string;
}

/** One context per line, as the customer generator would receive it. */
export async function captureContexts(
  scenario: EffectiveScenario,
  lines: (string | ScriptedLine)[],
): Promise<CustomerGenerationContext[]> {
  let runtime = createInitialRuntime(scenario);
  const history: TranscriptTurn[] = [
    { index: 1, role: 'customer', text: openingMessage(scenario) },
  ];
  const rules = mockClassifier(scenario);
  const seen: CustomerGenerationContext[] = [];

  for (const line of lines) {
    const scripted: ScriptedLine = typeof line === 'string' ? { text: line } : line;
    const turnIndex = history.length + 1;
    const result = await processTraineeTurn({
      scenario,
      runtime,
      traineeText: scripted.text,
      turnIndex,
      history,
      classify: async (text, turn) => ({
        ...(await rules(text, turn)),
        ...scripted.classification,
      }),
      generate: (ctx) => {
        seen.push(ctx);
        return Promise.resolve({ text: scripted.reply ?? 'Okay.', source: 'live' });
      },
    });
    runtime = result.runtime;
    history.push(
      { index: turnIndex, role: 'trainee', text: scripted.text },
      { index: turnIndex + 1, role: 'customer', text: result.customerText },
    );
  }
  return seen;
}
