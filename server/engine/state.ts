import type { EvidenceBehaviour, TurnClassification } from '#shared/domain/classification.ts';
import type { EffectiveScenario } from '#shared/domain/config.ts';
import {
  clampState,
  difficultyProfile,
  type CustomerState,
  type StateCategory,
  type StateEvent,
  type StateKey,
} from '#shared/domain/state.ts';
import { FACT_WEIGHT, type DiscoveryIntent } from '#shared/domain/vocab.ts';
import type { EngineRuntime } from './types.ts';

// The customer-state engine. Given what the trainee did (a classification), it decides how the
// customer's temperature, trust, patience and confidence move. All numbers come from the tables
// below and are bounded; a model may describe behaviour but can never set a value.

export interface TurnAssessment {
  c: TurnClassification;
  repeated: boolean; // every topic asked about had already been answered
  newInfoCount: number; // pieces of information the customer gave this turn
  answeredIntents: DiscoveryIntent[];
}

export interface StateTurnInput {
  scenario: EffectiveScenario;
  runtime: EngineRuntime;
  assessment: TurnAssessment;
  turnIndex: number; // conversation index of this trainee turn
  traineeTurnNumber: number; // 1-based count of trainee turns including this one
}

export interface Effect {
  category: StateCategory;
  reason: string;
  quote?: string;
  temperature?: number;
  trust?: number;
  patience?: number;
  confidence?: number;
  ownershipConfidence?: number;
  clarification?: number;
  urgency?: number;
}

const KEY_OF: Record<string, StateKey> = {
  temperature: 'temperature',
  trust: 'trust',
  patience: 'patience',
  confidence: 'confidence',
  ownershipConfidence: 'ownershipConfidence',
  clarification: 'clarification',
  urgency: 'urgency',
};

// Keys where a negative number is "good for the trainee".
const LOWER_IS_BETTER = new Set<string>(['temperature']);

/** Events are recorded for large changes only, to keep the history readable. */
const EVENT_THRESHOLD: Record<string, number> = {
  temperature: 1,
  trust: 4,
  patience: 4,
  confidence: 4,
  ownershipConfidence: 4,
  clarification: 8,
  urgency: 99,
};

const MAX_TEMPERATURE_SWING = 20;

export function weightedCoverage(scenario: EffectiveScenario, runtime: EngineRuntime): number {
  let total = 0;
  let got = 0;
  for (const fact of scenario.hiddenFacts) {
    const weight = FACT_WEIGHT[fact.importance];
    total += weight;
    const record = runtime.discovery[fact.id];
    if (record) got += record.status === 'discovered' ? weight : weight * 0.5;
  }
  return total === 0 ? 0 : Math.round((got / total) * 100) / 100;
}

function quoteFor(c: TurnClassification, behaviours: EvidenceBehaviour[]): string | undefined {
  return c.evidence.find((e) => behaviours.includes(e.behaviour))?.quote;
}

/** What the trainee's behaviour means for the customer, before any scaling. */
export function effectsForTurn(input: StateTurnInput): Effect[] {
  const { scenario, runtime, assessment, traineeTurnNumber } = input;
  const c = assessment.c;
  const state = runtime.customer;
  const effects: Effect[] = [];
  const cfg = scenario.config;
  const unclearUrgency = cfg.impact === 'high' || state.urgency >= 70;

  if (c.injectionAttempt) {
    // Asking the customer to leave the role earns nothing and costs nothing.
    return effects;
  }

  if (traineeTurnNumber === 1 && c.introduces) {
    effects.push({
      category: 'rapport',
      reason: 'Opened with a greeting and an offer to help',
      quote: quoteFor(c, ['greeting', 'introduction', 'offers-help']),
      temperature: -3,
      trust: 4,
    });
  } else if (traineeTurnNumber === 1 && (c.troubleshooting || c.blame || c.dismissive)) {
    effects.push({
      category: 'rapport',
      reason: 'Started without a greeting or introduction',
      temperature: 2,
      trust: -2,
    });
  }

  if (c.empathy === 'specific') {
    effects.push({
      category: 'empathy',
      reason: 'Showed specific empathy for the customer’s situation',
      quote: quoteFor(c, ['empathy-specific']),
      temperature: -7,
      trust: 6,
      patience: 4,
    });
  } else if (c.empathy === 'generic') {
    effects.push({
      category: 'empathy',
      reason: 'Offered general empathy or an apology',
      quote: quoteFor(c, ['empathy-generic']),
      temperature: -3,
      trust: 3,
    });
  }

  if (c.acknowledgesImpact) {
    const first = !state.impactAcknowledged;
    effects.push({
      category: 'impact',
      reason: first ? 'Acknowledged the business impact' : 'Acknowledged the impact again',
      quote: quoteFor(c, ['impact-acknowledged']),
      temperature: first ? -8 : -2,
      trust: first ? 6 : 1,
      patience: first ? 6 : 0,
      confidence: first ? 5 : 0,
    });
  }

  if (assessment.newInfoCount > 0) {
    effects.push({
      category: 'discovery',
      reason: 'Asked a focused question that uncovered new information',
      quote: quoteFor(c, ['discovery-question']),
      temperature: -Math.min(2, assessment.newInfoCount),
      trust: 2,
      confidence: 2,
    });
  }

  if (assessment.repeated) {
    effects.push({
      category: 'repetition',
      reason: 'Asked about something the customer had already answered',
      quote: quoteFor(c, ['discovery-question']),
      temperature: 5,
      patience: -6,
      trust: -3,
    });
  }

  if (c.summarises) {
    effects.push({
      category: 'summary',
      reason: 'Summarised their understanding',
      quote: quoteFor(c, ['summary']),
      temperature: -4,
      trust: 4,
      clarification: 10,
    });
  }

  if (c.ownership === 'clear') {
    effects.push({
      category: 'ownership',
      reason: 'Took clear ownership',
      quote: quoteFor(c, ['ownership-clear']),
      temperature: -6,
      trust: 5,
      confidence: 8,
      ownershipConfidence: 25,
    });
  } else if (c.ownership === 'vague') {
    effects.push({
      category: 'ownership',
      reason: 'Ownership was vague',
      quote: quoteFor(c, ['ownership-vague']),
      temperature: -1,
      ownershipConfidence: 5,
    });
  }

  if (c.nextSteps === 'specific') {
    effects.push({
      category: 'next-steps',
      reason: 'Gave specific next steps with a time',
      quote: quoteFor(c, ['next-steps-specific']),
      temperature: -5,
      trust: 4,
      confidence: 6,
    });
  } else if (c.nextSteps === 'vague' && c.ownership !== 'clear') {
    effects.push({
      category: 'next-steps',
      reason: 'Next steps were vague',
      quote: quoteFor(c, ['next-steps-vague']),
      temperature: unclearUrgency ? 2 : 0,
      patience: unclearUrgency ? -4 : -1,
    });
  }

  if (c.promise === 'realistic') {
    effects.push({
      category: 'promise',
      reason: 'Was honest about what could be committed to',
      quote: quoteFor(c, ['promise-realistic']),
      temperature: -2,
      trust: 3,
    });
  } else if (c.promise === 'unverified') {
    effects.push({
      category: 'promise',
      reason: 'Promised an outcome or time that could not yet be verified',
      quote: quoteFor(c, ['promise-unverified']),
      temperature: 2,
      trust: -6,
      confidence: -6,
    });
  }

  if (c.correctsAssumption && scenario.incorrectAssumptions.length > 0) {
    effects.push({
      category: 'clarity',
      reason: 'Respectfully tested the customer’s assumption',
      quote: quoteFor(c, ['corrects-assumption']),
      temperature: -1,
      trust: cfg.proficiency === 'expert' ? 4 : 3,
    });
  }

  if (c.clarity === 'clear') {
    effects.push({
      category: 'clarity',
      reason: 'Communicated clearly',
      temperature: -1,
      clarification: 6,
    });
  } else if (c.clarity === 'unclear') {
    effects.push({
      category: 'clarity',
      reason: 'The message was hard to follow',
      temperature: 1,
      patience: -2,
      clarification: -8,
    });
  }

  if (c.jargon === 'unexplained') {
    const sentences = c.evidence.filter((e) => e.behaviour === 'jargon-unexplained').length;
    if (cfg.proficiency === 'novice') {
      effects.push({
        category: 'jargon',
        reason: 'Used technical terms the customer did not understand',
        quote: quoteFor(c, ['jargon-unexplained']),
        temperature: 5,
        trust: -4,
        patience: -4,
        clarification: -12,
      });
    } else if (cfg.proficiency === 'intermediate' && sentences >= 2) {
      effects.push({
        category: 'jargon',
        reason: 'Used a lot of technical terms without explaining them',
        quote: quoteFor(c, ['jargon-unexplained']),
        temperature: 2,
        clarification: -5,
      });
    }
  } else if (c.jargon === 'explained') {
    effects.push({
      category: 'jargon',
      reason: 'Explained technical terms in plain words',
      clarification: 4,
    });
  }

  if (c.blame) {
    effects.push({
      category: 'blame',
      reason: 'Blamed the customer or another team',
      quote: quoteFor(c, ['blame']),
      temperature: 10,
      trust: -10,
      patience: -6,
    });
  }
  if (c.dismissive) {
    effects.push({
      category: 'dismissal',
      reason: 'Dismissed the customer’s concern',
      quote: quoteFor(c, ['dismissive']),
      temperature: 10,
      trust: -8,
      patience: -8,
    });
  }

  const earlyUnscopedFix =
    c.troubleshooting &&
    traineeTurnNumber <= 2 &&
    !state.impactAcknowledged &&
    !c.acknowledgesImpact &&
    Object.keys(runtime.discovery).length === 0 &&
    assessment.newInfoCount === 0;
  if (earlyUnscopedFix) {
    effects.push({
      category: 'premature-troubleshooting',
      reason: 'Jumped into fixes before understanding the situation',
      quote: quoteFor(c, ['troubleshooting']),
      temperature: 5,
      trust: -4,
      patience: -3,
    });
  }

  if (c.lowEffort) {
    effects.push({
      category: 'low-effort',
      reason: 'A very short reply that moved nothing forward',
      patience: -3,
    });
  }

  if ((c.wrapsUp || c.confirmsNextContact || c.asksAnythingElse) && traineeTurnNumber >= 3) {
    effects.push({
      category: 'closing',
      reason: 'Closed with a summary or a check that everything is clear',
      quote: quoteFor(c, ['wrap-up', 'next-contact', 'anything-else']),
      temperature: -2,
      trust: 3,
    });
  }

  if (
    !state.impactAcknowledged &&
    !c.acknowledgesImpact &&
    (traineeTurnNumber === 3 || traineeTurnNumber === 6)
  ) {
    effects.push({
      category: 'impact',
      reason: `The impact still had not been acknowledged after ${traineeTurnNumber} replies`,
      temperature: traineeTurnNumber === 3 ? 4 : 3,
      patience: -4,
    });
  }

  const progressCategories = new Set([
    'discovery',
    'empathy',
    'impact',
    'ownership',
    'next-steps',
    'summary',
    'closing',
  ]);
  const madeProgress = effects.some(
    (e) =>
      progressCategories.has(e.category) &&
      (e.temperature ?? 0) <= 0 &&
      e.reason !== 'Next steps were vague',
  );
  if (!madeProgress && !c.blame && !c.dismissive) {
    effects.push({
      category: 'delay',
      reason: 'Nothing moved the customer’s concern forward this turn',
      patience: -difficultyProfile(cfg.difficulty).patienceDecay,
    });
  }

  if (state.patience < 10) {
    effects.push({
      category: 'delay',
      reason: 'The customer’s patience has run out',
      temperature: 4,
    });
  } else if (state.patience < 25) {
    effects.push({
      category: 'delay',
      reason: 'The customer’s patience is wearing thin',
      temperature: 2,
    });
  }

  if (
    state.temperature >= 61 &&
    c.empathy === 'none' &&
    !c.acknowledgesImpact &&
    c.ownership !== 'clear'
  ) {
    if (runtime.turnsWithoutEmpathy >= 1) {
      effects.push({
        category: 'empathy',
        reason: 'The customer’s frustration went unaddressed',
        temperature: 3,
        trust: -2,
      });
    }
  }

  if (
    unclearUrgency &&
    traineeTurnNumber >= 5 &&
    !state.nextStepsStated &&
    c.nextSteps !== 'specific' &&
    traineeTurnNumber - runtime.asksForTimelineAtTurn >= 2
  ) {
    effects.push({
      category: 'next-steps',
      reason: 'No timeline or next update had been given despite the urgency',
      patience: -4,
      temperature: 2,
    });
  }

  return effects;
}

interface Modifier {
  positive: number;
  negative: number;
}

function styleModifier(scenario: EffectiveScenario, effect: Effect): number {
  const { style, startingTemperature, proficiency } = scenario.config;
  let factor = 1;
  if (
    style === 'demanding' &&
    (effect.category === 'ownership' || effect.category === 'next-steps')
  )
    factor *= 1.25;
  if (style === 'demanding' && effect.category === 'empathy') factor *= 0.85;
  if (
    startingTemperature === 'anxious' &&
    (effect.category === 'empathy' || effect.category === 'next-steps')
  )
    factor *= 1.2;
  if (
    proficiency === 'expert' &&
    effect.category === 'empathy' &&
    effect.reason.startsWith('Offered general')
  )
    factor *= 0.8;
  return factor;
}

function streakFactor(category: StateCategory, streak: number, positive: boolean): number {
  if (!positive) return 1;
  if (category === 'empathy' || category === 'summary' || category === 'clarity') {
    return streak <= 0 ? 1 : streak === 1 ? 0.7 : 0.45;
  }
  return 1;
}

export interface ApplyResult {
  customer: CustomerState;
  events: StateEvent[];
}

/** Applies effects one after another, scaling them for difficulty and style, and records events. */
export function applyEffects(
  base: CustomerState,
  effects: Effect[],
  scenario: EffectiveScenario,
  turnIndex: number,
  streaks: Record<string, number> = {},
): ApplyResult {
  const profile = difficultyProfile(scenario.config.difficulty);
  const customer: CustomerState = JSON.parse(JSON.stringify(base)) as CustomerState;
  const events: StateEvent[] = [];
  let swing = 0;
  let biggest: { delta: number; effect: Effect } | null = null;

  for (const effect of effects) {
    const mod: Modifier = { positive: profile.positiveScale, negative: profile.negativeScale };
    const style = styleModifier(scenario, effect);
    for (const [name, raw] of Object.entries(effect)) {
      if (typeof raw !== 'number' || raw === 0 || !(name in KEY_OF)) continue;
      const key = KEY_OF[name] as StateKey;
      const good = LOWER_IS_BETTER.has(name) ? raw < 0 : raw > 0;
      let delta = raw * (good ? mod.positive : mod.negative);
      if (effect.category !== 'curveball') {
        delta *= good
          ? style * streakFactor(effect.category, streaks[effect.category] ?? 0, true)
          : style;
      }
      delta = Math.round(delta);
      if (key === 'temperature') {
        const allowed =
          Math.max(-MAX_TEMPERATURE_SWING, Math.min(MAX_TEMPERATURE_SWING, swing + delta)) - swing;
        delta = allowed;
        swing += delta;
      }
      if (delta === 0) continue;
      const previous = customer[key];
      const next = clampState(previous + delta);
      if (next === previous) continue;
      customer[key] = next;
      if (Math.abs(next - previous) >= (EVENT_THRESHOLD[name] ?? 4)) {
        events.push({
          turnIndex,
          key,
          previous,
          next,
          delta: next - previous,
          category: effect.category,
          reason: effect.reason,
          ...(effect.quote ? { evidenceQuote: effect.quote } : {}),
        });
      }
      if (
        key === 'temperature' &&
        (!biggest || Math.abs(next - previous) > Math.abs(biggest.delta))
      ) {
        biggest = { delta: next - previous, effect };
      }
    }
  }

  const top = biggest as { delta: number; effect: Effect } | null;
  if (top) {
    customer.lastChange = {
      turnIndex,
      key: 'temperature',
      delta: top.delta,
      reason: top.effect.reason,
      category: top.effect.category,
    };
  }
  return { customer, events };
}

export interface StateTurnResult extends ApplyResult {
  streaks: Record<string, number>;
  turnsWithoutEmpathy: number;
}

export function applyTraineeTurn(input: StateTurnInput): StateTurnResult {
  const { scenario, runtime, assessment, turnIndex } = input;
  const c = assessment.c;
  const effects = effectsForTurn(input);
  const { customer, events } = applyEffects(
    runtime.customer,
    effects,
    scenario,
    turnIndex,
    runtime.behaviourStreak,
  );

  if (c.acknowledgesImpact && !c.injectionAttempt) customer.impactAcknowledged = true;
  if (c.ownership === 'clear') customer.ownershipStated = true;
  if (c.nextSteps === 'specific') customer.nextStepsStated = true;
  customer.discoveryCoverage = weightedCoverage(scenario, runtime);

  const streaks: Record<string, number> = {};
  for (const e of effects) streaks[e.category] = (runtime.behaviourStreak[e.category] ?? 0) + 1;

  const addressedFeelings = c.empathy !== 'none' || c.acknowledgesImpact || c.ownership === 'clear';
  return {
    customer,
    events,
    streaks,
    turnsWithoutEmpathy: addressedFeelings ? 0 : runtime.turnsWithoutEmpathy + 1,
  };
}
