import type { TurnClassification } from '#shared/domain/classification.ts';
import type { EffectiveScenario } from '#shared/domain/config.ts';
import type { CoachingReport } from '#shared/domain/report.ts';
import type { CustomerState, StateEvent } from '#shared/domain/state.ts';
import type { Difficulty, DimensionId, DiscoveryIntent } from '#shared/domain/vocab.ts';

// Types shared by the simulation engine, the evaluator and the session pipeline.

export interface TranscriptTurn {
  index: number; // 1-based over the whole conversation; turn 1 is the customer's opening
  role: 'customer' | 'trainee';
  text: string;
}

export interface DiscoveryRecord {
  factId: string;
  status: 'partial' | 'discovered';
  turnIndex: number; // the trainee turn whose question revealed it
  question: string; // that question (the trainee's text, trimmed)
}
export type DiscoveryMap = Record<string, DiscoveryRecord>;

/** Persisted with a session and updated after every trainee turn. */
export interface EngineRuntime {
  customer: CustomerState;
  discovery: DiscoveryMap;
  traineeTurns: number; // trainee turns processed so far
  askedIntents: Partial<Record<DiscoveryIntent, number>>; // how often each topic was asked about
  answeredIntents: DiscoveryIntent[]; // topics the customer has already answered
  toldKnownFacts: Record<string, number>; // known fact id -> times told
  unlockedKnownFacts: string[]; // known facts introduced by a curveball
  hintsGiven: string[]; // hidden-fact ids whose hint has been offered
  firedCurveballs: string[]; // curveball definition ids
  lastCurveballTurn: number; // trainee turn number, 0 if none
  curveballFollowUpGiven: boolean;
  behaviourStreak: Record<string, number>; // consecutive turns showing a behaviour
  turnsWithoutEmpathy: number;
  lastTemperatureDelta: number; // net temperature change caused by the latest trainee turn
  lastCustomerLines: string[]; // recent openers/fillers, to avoid repetition
  asksForTimelineAtTurn: number; // last trainee turn at which the customer pushed for a timeline
}

export interface EvaluationInput {
  scenario: EffectiveScenario;
  turns: TranscriptTurn[];
  // Classification of each trainee turn, keyed by that trainee turn's conversation index.
  classifications: Record<number, TurnClassification>;
  stateEvents: StateEvent[];
  discovery: DiscoveryMap;
  startState: CustomerState;
  finalState: CustomerState;
  endedEarly: boolean; // the trainee ended before a natural close (no wrap-up)
  durationSeconds: number;
  provider: { kind: 'mock' | 'azure-openai' | 'openai-compatible' | 'gemini'; label: string };
  // Library summary used to suggest what to practise next.
  library: {
    id: string;
    title: string;
    difficulty: Difficulty;
    coachingFocus: DimensionId[];
  }[];
}

export interface EvaluatorMeta {
  name: string;
  version: string;
}

export interface Evaluator {
  evaluate(input: EvaluationInput): Promise<CoachingReport> | CoachingReport;
}

export const RUBRIC_VERSION = 'rubric-1';
