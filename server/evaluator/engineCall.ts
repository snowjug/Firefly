import type { TurnClassification } from '#shared/domain/classification.ts';
import type { ScenarioOverrides } from '#shared/domain/scenario.ts';
import { startingState } from '#shared/domain/state.ts';
import { simulate } from '#server/engine/simulate.ts';
import type { EvaluationInput } from '#server/engine/types.ts';
import { LIBRARY, makeScenario, type BuildOptions } from './testing.ts';

// Kept apart from ./testing.ts so that only the tests which run the whole engine depend on it.

/** A call run through the real engine in demo mode: its classifications, events and discovery. */
export async function engineCall(
  lines: string[],
  scenarioOverrides: ScenarioOverrides = {},
  options: BuildOptions = {},
): Promise<EvaluationInput> {
  const scenario = makeScenario(scenarioOverrides);
  const sim = await simulate(scenario, lines);
  const classifications: Record<number, TurnClassification> = {};
  sim.turns.forEach((t, i) => (classifications[2 + 2 * i] = t.classification));
  const cfg = scenario.config;
  return {
    scenario,
    turns: sim.transcript,
    classifications,
    stateEvents: sim.events,
    discovery: sim.runtime.discovery,
    startState: startingState({
      startingTemperature: cfg.startingTemperature,
      difficulty: cfg.difficulty,
      callStage: cfg.callStage,
      impact: cfg.impact,
    }),
    finalState: sim.runtime.customer,
    endedEarly: options.endedEarly ?? false,
    durationSeconds: 300,
    provider: { kind: 'mock', label: 'Demo mode (no live model)' },
    library: options.library ?? LIBRARY,
  };
}
