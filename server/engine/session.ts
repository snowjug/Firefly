import type { EffectiveScenario } from '#shared/domain/config.ts';
import type { PublicStateDTO } from '#shared/domain/api.ts';
import { startingState } from '#shared/domain/state.ts';
import { temperatureBand } from '#shared/domain/vocab.ts';
import { openingPlan } from './opening.ts';
import type { EngineRuntime } from './types.ts';

/**
 * The engine state at the start of a call. What the opening already said is remembered, so the
 * customer does not say it again: a first-contact customer has only said hello (and perhaps what is
 * at stake) and will give the reason for the call once the engineer has answered; a customer who
 * calls back has stated their purpose, which is also what the case already records about the
 * earlier contact (asked about again, it is "as I told you before").
 */
export function createInitialRuntime(scenario: EffectiveScenario): EngineRuntime {
  const cfg = scenario.config;
  const opening = openingPlan(scenario);
  const toldKnownFacts: Record<string, number> = {};
  if (opening.voicedImpact) toldKnownFacts.impact = 1;
  if (opening.givesPurpose) toldKnownFacts.history = 1;
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
    toldKnownFacts,
    unlockedKnownFacts: [],
    hintsGiven: [],
    firedCurveballs: [],
    lastCurveballTurn: 0,
    curveballFollowUpGiven: false,
    closingAtTurn: 0,
    behaviourStreak: {},
    turnsWithoutEmpathy: 0,
    lastTemperatureDelta: 0,
    lastCustomerLines: [],
    asksForTimelineAtTurn: 0,
    opening: opening.givesPurpose ? 'reason-given' : 'awaiting-engineer',
    greetingTurns: 0,
    asked: [],
    commitments: [],
    awaitingConfirmation: false,
    stageMet: [],
    pushes: {},
    assumptionsCorrected: [],
    misunderstandings: [],
    lastToldIds: [],
  };
}

/** The customer's first message (turn 1). Deterministic for a given scenario and seed. */
export function openingMessage(scenario: EffectiveScenario): string {
  return openingPlan(scenario).text;
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
