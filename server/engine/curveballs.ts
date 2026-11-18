import type { TurnClassification } from '#shared/domain/classification.ts';
import type { EffectiveScenario } from '#shared/domain/config.ts';
import { curveballEffects } from '#shared/domain/curveballs.ts';
import type { CurveballDefinition } from '#shared/domain/scenario.ts';
import { difficultyProfile, type CustomerState, type StateEvent } from '#shared/domain/state.ts';
import { CURVEBALL_LABELS, type CurveballType } from '#shared/domain/vocab.ts';
import { applyEffects, type Effect } from './state.ts';
import type { DiscoveryMap, EngineRuntime } from './types.ts';

// Controlled curveballs: configured per scenario, appropriate to the difficulty, triggered by
// explicit conditions (never random), fired at most once each, never back to back, and judged on
// how the trainee responds.

export interface CurveballTurnInput {
  scenario: EffectiveScenario;
  runtime: EngineRuntime;
  customer: CustomerState; // state after this turn's behaviour effects
  classification: TurnClassification;
  turnIndex: number; // conversation index of the trainee turn
  traineeTurnNumber: number;
  discovery: DiscoveryMap; // including anything revealed this turn
}

export interface CurveballTurnResult {
  customer: CustomerState;
  events: StateEvent[];
  fired: CurveballDefinition | null;
  followUp: CurveballDefinition | null;
  statusChange: 'resolved' | 'unresolved' | null;
  unlockedFactIds: string[];
}

/** Did the trainee respond to this kind of curveball in a way that works? */
export function isHandled(type: CurveballType, c: TurnClassification): boolean {
  const feelings = c.empathy !== 'none';
  const harmful = c.blame || c.dismissive;
  switch (type) {
    case 'ask-manager':
      return (feelings || c.ownership !== 'none' || c.nextSteps !== 'none') && !harmful;
    case 'threaten-cancel':
      return (
        feelings &&
        (c.ownership !== 'none' || c.nextSteps !== 'none') &&
        !harmful &&
        c.promise !== 'unverified'
      );
    case 'deadline':
      return (
        (c.acknowledgesImpact || feelings) &&
        (c.nextSteps !== 'none' || c.promise === 'realistic') &&
        c.promise !== 'unverified' &&
        !c.dismissive
      );
    case 'change-issue':
      return (c.askedQuestion || c.acknowledgesImpact || feelings) && !harmful;
    case 'go-silent':
      return feelings || (c.askedQuestion && !c.troubleshooting && !c.blame);
    case 'previous-bad-experience':
      return feelings && c.ownership === 'clear' && !c.blame;
    case 'unsupported-guarantee':
      return (
        c.promise !== 'unverified' &&
        (c.promise === 'realistic' || c.nextSteps === 'specific' || c.ownership === 'clear') &&
        !c.dismissive
      );
    case 'challenge-credibility':
      return (
        !harmful &&
        !c.lowEffort &&
        (c.ownership !== 'none' || c.askedQuestion || c.nextSteps !== 'none')
      );
  }
}

function conditionsHold(def: CurveballDefinition, input: CurveballTurnInput): boolean {
  const t = def.trigger;
  const n = input.traineeTurnNumber;
  if (n < t.earliestTurn) return false;
  if (t.latestTurn !== undefined && n >= t.latestTurn) return true; // forced
  if (
    t.whenTemperatureAtLeast !== undefined &&
    input.customer.temperature < t.whenTemperatureAtLeast
  )
    return false;
  if (t.whenImpactUnacknowledged && input.customer.impactAcknowledged) return false;
  if (t.whenOwnershipUnclear && input.customer.ownershipStated) return false;
  if (t.afterFact && input.discovery[t.afterFact]?.status !== 'discovered') return false;
  return true;
}

function pickCurveball(input: CurveballTurnInput): CurveballDefinition | null {
  const { runtime, scenario, classification: c, traineeTurnNumber } = input;
  const profile = difficultyProfile(scenario.config.difficulty);
  if (input.customer.curveball.status === 'active') return null;
  if (input.customer.curveball.firedCount >= profile.maxCurveballs) return null;
  if (runtime.lastCurveballTurn > 0 && traineeTurnNumber - runtime.lastCurveballTurn < 3)
    return null;
  if (c.wrapsUp || c.injectionAttempt) return null;
  return (
    scenario.curveballs.find(
      (def) => !runtime.firedCurveballs.includes(def.id) && conditionsHold(def, input),
    ) ?? null
  );
}

export function processCurveball(input: CurveballTurnInput): CurveballTurnResult {
  const { scenario, runtime, classification: c, turnIndex, traineeTurnNumber } = input;
  let customer = input.customer;
  const events: StateEvent[] = [];
  let fired: CurveballDefinition | null = null;
  let followUp: CurveballDefinition | null = null;
  let statusChange: CurveballTurnResult['statusChange'] = null;
  const unlockedFactIds: string[] = [];

  const apply = (effects: Effect[]) => {
    const result = applyEffects(customer, effects, scenario, turnIndex, runtime.behaviourStreak);
    customer = result.customer;
    events.push(...result.events);
  };

  const active = customer.curveball;
  if (active.status === 'active' && active.type) {
    const type = active.type;
    const label = CURVEBALL_LABELS[type].label.toLowerCase();
    const firedAtTrainee = Math.round((active.firedAtTurn ?? turnIndex) / 2);
    const quote = c.evidence[0]?.quote;
    const immediateFailure =
      c.blame || c.dismissive || (type === 'unsupported-guarantee' && c.promise === 'unverified');
    if (isHandled(type, c)) {
      customer = {
        ...customer,
        silentUntilEngaged: false,
        curveball: { ...customer.curveball, status: 'resolved', resolvedAtTurn: turnIndex },
      };
      statusChange = 'resolved';
      apply([
        {
          category: 'curveball',
          reason: `Handled the curveball well (customer ${label})`,
          ...(quote ? { quote } : {}),
          temperature: -6,
          trust: 5,
        },
      ]);
    } else if (immediateFailure || traineeTurnNumber - firedAtTrainee >= 2) {
      customer = {
        ...customer,
        silentUntilEngaged: false,
        curveball: { ...customer.curveball, status: 'unresolved' },
      };
      statusChange = 'unresolved';
      apply([
        {
          category: 'curveball',
          reason: `The curveball was not addressed (customer ${label})`,
          temperature: 4,
          trust: -4,
        },
      ]);
      const def = scenario.curveballs.find((d) => d.type === type);
      if (def?.followUp && !runtime.curveballFollowUpGiven) followUp = def;
    }
  }

  const next = pickCurveball({ ...input, customer });
  if (next) {
    fired = next;
    const effects = curveballEffects(next);
    const label = CURVEBALL_LABELS[next.type].label.toLowerCase();
    apply([
      {
        category: 'curveball',
        reason: `Curveball: customer ${label}`,
        temperature: effects.temperature,
        trust: effects.trust,
        patience: effects.patience,
        ...(next.type === 'deadline' ? { urgency: 20 } : {}),
      },
    ]);
    customer = {
      ...customer,
      silentUntilEngaged: next.type === 'go-silent',
      curveball: {
        status: 'active',
        type: next.type,
        firedAtTurn: turnIndex,
        resolvedAtTurn: null,
        firedCount: customer.curveball.firedCount + 1,
      },
    };
    for (const fact of next.introducesFacts ?? []) unlockedFactIds.push(fact.id);
  }

  return { customer, events, fired, followUp, statusChange, unlockedFactIds };
}
