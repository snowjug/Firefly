import type { TurnClassification } from '#shared/domain/classification.ts';
import type { EffectiveScenario } from '#shared/domain/config.ts';
import type { StateEvent } from '#shared/domain/state.ts';
import { mockClassifier, mockGenerate } from './mock/index.ts';
import { processTraineeTurn } from './pipeline.ts';
import { createInitialRuntime, openingMessage } from './session.ts';
import type { EngineRuntime, TranscriptTurn } from './types.ts';

// Runs a scripted trainee conversation through the real engine in demo mode. Used by tests and by
// the simulate script to look at conversations.

export interface SimulatedTurn {
  trainee: string;
  customer: string;
  classification: TurnClassification;
  events: StateEvent[];
  temperature: number;
  runtime: EngineRuntime;
}

export interface Simulation {
  opening: string;
  turns: SimulatedTurn[];
  transcript: TranscriptTurn[];
  runtime: EngineRuntime;
  events: StateEvent[];
}

export async function simulate(scenario: EffectiveScenario, lines: string[]): Promise<Simulation> {
  let runtime = createInitialRuntime(scenario);
  const opening = openingMessage(scenario);
  const transcript: TranscriptTurn[] = [{ index: 1, role: 'customer', text: opening }];
  const turns: SimulatedTurn[] = [];
  const events: StateEvent[] = [];
  const classify = mockClassifier(scenario);

  for (const line of lines) {
    const turnIndex = transcript.length + 1;
    const result = await processTraineeTurn({
      scenario,
      runtime,
      traineeText: line,
      turnIndex,
      history: transcript,
      classify,
      generate: mockGenerate,
    });
    runtime = result.runtime;
    transcript.push({ index: turnIndex, role: 'trainee', text: line });
    transcript.push({ index: turnIndex + 1, role: 'customer', text: result.customerText });
    events.push(...result.stateEvents);
    turns.push({
      trainee: line,
      customer: result.customerText,
      classification: result.classification,
      events: result.stateEvents,
      temperature: runtime.customer.temperature,
      runtime,
    });
  }
  return { opening, turns, transcript, runtime, events };
}
