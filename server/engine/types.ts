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

/**
 * Where the call is in its first exchange. A first-contact customer opens with a greeting only and
 * waits; once the engineer has answered, the customer says why they are calling. Every other call
 * stage opens with its purpose, so those calls start as `reason-given`.
 */
export type OpeningPhase = 'awaiting-engineer' | 'reason-given';

/**
 * Something one side of the call has said they will do. The engineer's commitments (an owner, an
 * action and a time) calm or fail to calm the customer; the customer's own ("I'll ask our
 * administrator") are remembered so that the customer can refer back to them.
 */
export interface Commitment {
  id: string;
  by: 'engineer' | 'customer';
  turnIndex: number; // conversation index of the turn in which it was made
  kind: 'ownership' | 'follow-up' | 'action' | 'check';
  action: string; // what was promised, in a few plain words ("own the case and update me")
  due: string | null; // the time as it was said ("by 3pm"), null when none was given
  clarity: 'clear' | 'vague'; // an owner and an action with a time are clear; "soon" is vague
  supported: boolean; // false for an outcome the engineer cannot know they can promise
  reflected: boolean; // the customer has already said it back
}

/** A question the engineer asked, kept so a real repeat can be told from a follow-up. */
export interface AskedQuestion {
  turnIndex: number; // conversation index of the trainee turn
  intents: DiscoveryIntent[];
  words: string[]; // the question's content words, lightly stemmed
}

/** Something the customer or the engineer got wrong, and had to put right. */
export interface Misunderstanding {
  by: 'customer' | 'engineer'; // who misunderstood
  turnIndex: number;
  about: 'term' | 'summary' | 'product';
}

/**
 * Persisted with a session and updated after every trainee turn. Fields added after the first
 * release are filled in by `normaliseRuntime` when an older session is read.
 */
export interface EngineRuntime {
  customer: CustomerState;
  discovery: DiscoveryMap;
  traineeTurns: number; // trainee turns processed so far
  askedIntents: Partial<Record<DiscoveryIntent, number>>; // how often each topic was asked about
  answeredIntents: DiscoveryIntent[]; // topics the customer has already answered
  /**
   * What the customer has already said, by id and number of times: known, vague, checkable,
   * unknown and irrelevant facts (by fact id, and `<id>#confirmed` once a vague fact was firmed
   * up), the opening's parts ("reason", "impact"), personal details ("name", "organisation",
   * "case-reference"), "impact-detail", "impact-deadline", "history" and "assumption-<id>".
   */
  toldKnownFacts: Record<string, number>;
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

  opening: OpeningPhase;
  /** Trainee turns that only answered the greeting. Timing rules do not count them. */
  greetingTurns: number;
  asked: AskedQuestion[]; // the engineer's recent questions
  commitments: Commitment[]; // recent commitments, newest last
  /** The customer has just asked the engineer to confirm a commitment ("So you'll call at 3?"). */
  awaitingConfirmation: boolean;
  /** Stage expectations the engineer has met (see stage.ts), so each one counts once. */
  stageMet: string[];
  /** The last trainee turn at which the customer made each kind of push ("update", "owner"...). */
  pushes: Record<string, number>;
  assumptionsCorrected: string[]; // incorrect-assumption ids the engineer has set right
  misunderstandings: Misunderstanding[];
  /** The ids (see `toldKnownFacts`, and hidden-fact ids) of what the customer said in their last reply. */
  lastToldIds: string[];
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
