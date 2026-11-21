import type { EffectiveScenario } from '#shared/domain/config.ts';
import type { PublicStateDTO } from '#shared/domain/api.ts';
import { difficultyProfile, startingState } from '#shared/domain/state.ts';
import { temperatureBand } from '#shared/domain/vocab.ts';
import { composeOpening } from './opening.ts';
import { rngFor } from './rng.ts';
import type { EngineRuntime } from './types.ts';

/** The engine state at the start of a call. */
export function createInitialRuntime(scenario: EffectiveScenario): EngineRuntime {
  const cfg = scenario.config;
  const assumption = scenario.incorrectAssumptions[0];
  // At Starter difficulty the opening already drops one clear clue; don't repeat it later.
  const openingHint = difficultyProfile(cfg.difficulty).hintsEnabled
    ? scenario.hiddenFacts.find((f) => f.hint)
    : undefined;
  return {
    customer: startingState({
      startingTemperature: cfg.startingTemperature,
      difficulty: cfg.difficulty,
      callStage: cfg.callStage,
      impact: cfg.impact,
    }),
    discovery: {},
    traineeTurns: 0,
    askedIntents: {},
    answeredIntents: [],
    toldKnownFacts:
      assumption && cfg.proficiency === 'expert' ? { [`assumption-${assumption.id}`]: 1 } : {},
    unlockedKnownFacts: [],
    hintsGiven: openingHint ? [openingHint.id] : [],
    firedCurveballs: [],
    lastCurveballTurn: 0,
    curveballFollowUpGiven: false,
    behaviourStreak: {},
    turnsWithoutEmpathy: 0,
    lastTemperatureDelta: 0,
    lastCustomerLines: [],
    asksForTimelineAtTurn: 0,
  };
}

/** The customer's first message (turn 1). Deterministic for a given scenario and seed. */
export function openingMessage(scenario: EffectiveScenario): string {
  return composeOpening(scenario, rngFor(scenario.config.seed, 0));
}

/** What the trainee may see about the customer's state during the call: a band, never a number. */
export function publicState(runtime: EngineRuntime): PublicStateDTO {
  const band = temperatureBand(runtime.customer.temperature);
  const delta = runtime.lastTemperatureDelta;
  return {
    band: { id: band.id, label: band.label },
    trend: delta >= 3 ? 'rising' : delta <= -3 ? 'falling' : 'steady',
    discoveredCount: Object.keys(runtime.discovery).length,
    silent: runtime.customer.silentUntilEngaged,
    shifts: runtime.firedCurveballs.length,
  };
}
