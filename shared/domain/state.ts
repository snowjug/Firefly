import {
  DIFFICULTIES,
  START_TEMPERATURE_LABELS,
  type BusinessImpact,
  type CallStage,
  type CurveballType,
  type Difficulty,
  type PracticeMode,
  type StartTemperature,
} from './vocab.ts';

// ---------------------------------------------------------------------------------------
// Difficulty presets. They bundle how patient and trusting the customer starts, how strongly
// good and bad behaviour moves them, how many curveballs are in play, and how clear the clues are.

export interface DifficultyProfile {
  id: Difficulty;
  label: string;
  summary: string;
  startingTrust: number;
  startingPatience: number;
  positiveScale: number; // multiplies helpful state changes
  negativeScale: number; // multiplies harmful state changes
  patienceDecay: number; // patience lost each trainee turn that makes no progress
  maxCurveballs: number;
  defaultCurveballCount: number;
  hintsEnabled: boolean; // clearer clues for hidden facts
  defaultMode: PracticeMode;
  cooperation: number; // 0..1, how readily the customer volunteers helpful context
}

export const DIFFICULTY_PROFILES: Record<Difficulty, DifficultyProfile> = {
  starter: {
    id: 'starter',
    label: 'Starter',
    summary:
      'Clearer clues, fewer hidden facts, a more cooperative customer and at most one optional curveball.',
    startingTrust: 65,
    startingPatience: 80,
    positiveScale: 1.25,
    negativeScale: 0.75,
    patienceDecay: 1,
    maxCurveballs: 1,
    defaultCurveballCount: 0,
    hintsEnabled: true,
    defaultMode: 'guided',
    cooperation: 0.85,
  },
  standard: {
    id: 'standard',
    label: 'Standard',
    summary:
      'Moderate ambiguity, several hidden facts and one possible curveball. The customer rewards focused questions.',
    startingTrust: 50,
    startingPatience: 60,
    positiveScale: 1,
    negativeScale: 1,
    patienceDecay: 2,
    maxCurveballs: 1,
    defaultCurveballCount: 1,
    hintsEnabled: false,
    defaultMode: 'immersive',
    cooperation: 0.5,
  },
  challenge: {
    id: 'challenge',
    label: 'Challenge',
    summary:
      'High pressure, incomplete first information, every hidden fact in play, stricter trust and patience, and up to two curveballs.',
    startingTrust: 35,
    startingPatience: 45,
    positiveScale: 0.8,
    negativeScale: 1.3,
    patienceDecay: 3,
    maxCurveballs: 2,
    defaultCurveballCount: 2,
    hintsEnabled: false,
    defaultMode: 'immersive',
    cooperation: 0.25,
  },
};

export function difficultyProfile(difficulty: Difficulty): DifficultyProfile {
  return DIFFICULTY_PROFILES[difficulty] ?? DIFFICULTY_PROFILES.standard;
}

export { DIFFICULTIES };

// ---------------------------------------------------------------------------------------
// Customer state. Everything here is bounded and produced by explicit rules (see
// server/engine/state.ts); a model can suggest what the trainee did, never the numbers.

export const STATE_KEYS = [
  'temperature',
  'trust',
  'patience',
  'confidence',
  'urgency',
  'ownershipConfidence',
  'clarification',
] as const;
export type StateKey = (typeof STATE_KEYS)[number];

export type CurveballStatus = 'none' | 'active' | 'resolved' | 'unresolved';

export interface CustomerState {
  temperature: number; // 0-100: 0 calm .. 100 escalating
  trust: number; // 0-100
  patience: number; // 0-100
  confidence: number; // 0-100: confidence that support can help
  urgency: number; // 0-100: how time-critical the customer feels
  ownershipConfidence: number; // 0-100: how convinced they are that someone owns the problem
  clarification: number; // 0-100: how clearly the trainee has been communicating
  impactAcknowledged: boolean;
  ownershipStated: boolean;
  nextStepsStated: boolean;
  discoveryCoverage: number; // 0-1, weighted share of hidden facts discovered
  curveball: {
    status: CurveballStatus;
    type: CurveballType | null;
    firedAtTurn: number | null;
    resolvedAtTurn: number | null;
    firedCount: number;
  };
  silentUntilEngaged: boolean;
  lastChange: {
    turnIndex: number;
    key: StateKey | 'curveball';
    delta: number;
    reason: string;
    category: StateCategory;
  } | null;
}

export const STATE_CATEGORIES = [
  'rapport',
  'empathy',
  'impact',
  'discovery',
  'repetition',
  'clarity',
  'jargon',
  'ownership',
  'next-steps',
  'promise',
  'blame',
  'dismissal',
  'premature-troubleshooting',
  'summary',
  'curveball',
  'closing',
  'delay',
  'low-effort',
] as const;
export type StateCategory = (typeof STATE_CATEGORIES)[number];

export interface StateEvent {
  turnIndex: number; // the trainee turn that caused the change (1-based over all turns)
  key: StateKey | 'curveball';
  previous: number;
  next: number;
  delta: number;
  category: StateCategory;
  reason: string; // short, human readable
  evidenceQuote?: string; // short trainee quote supporting it
}

export interface StartingContext {
  startingTemperature: StartTemperature;
  difficulty: Difficulty;
  callStage: CallStage;
  impact: BusinessImpact;
}

const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

const TRUST_BY_TEMP: Record<StartTemperature, number> = {
  calm: 10,
  anxious: 0,
  frustrated: -8,
  angry: -15,
};
const PATIENCE_BY_TEMP: Record<StartTemperature, number> = {
  calm: 10,
  anxious: 0,
  frustrated: -10,
  angry: -18,
};
const TRUST_BY_STAGE: Record<CallStage, number> = {
  'first-contact': 0,
  'follow-up': -5,
  escalated: -12,
  closure: 5,
};
const PATIENCE_BY_STAGE: Record<CallStage, number> = {
  'first-contact': 0,
  'follow-up': -5,
  escalated: -10,
  closure: 0,
};
const CONFIDENCE_BY_STAGE: Record<CallStage, number> = {
  'first-contact': 55,
  'follow-up': 45,
  escalated: 28,
  closure: 58,
};
const OWNERSHIP_BY_STAGE: Record<CallStage, number> = {
  'first-contact': 40,
  'follow-up': 25,
  escalated: 15,
  closure: 50,
};
const URGENCY_BY_IMPACT: Record<BusinessImpact, number> = { low: 25, medium: 55, high: 85 };

export function startingState(ctx: StartingContext): CustomerState {
  const profile = difficultyProfile(ctx.difficulty);
  return {
    temperature: START_TEMPERATURE_LABELS[ctx.startingTemperature].startValue,
    trust: clamp(
      profile.startingTrust +
        TRUST_BY_TEMP[ctx.startingTemperature] +
        TRUST_BY_STAGE[ctx.callStage],
    ),
    patience: clamp(
      profile.startingPatience +
        PATIENCE_BY_TEMP[ctx.startingTemperature] +
        PATIENCE_BY_STAGE[ctx.callStage],
    ),
    confidence: clamp(
      CONFIDENCE_BY_STAGE[ctx.callStage] + TRUST_BY_TEMP[ctx.startingTemperature] / 2,
    ),
    urgency: URGENCY_BY_IMPACT[ctx.impact],
    ownershipConfidence: OWNERSHIP_BY_STAGE[ctx.callStage],
    clarification: 50,
    impactAcknowledged: false,
    ownershipStated: false,
    nextStepsStated: false,
    discoveryCoverage: 0,
    curveball: {
      status: 'none',
      type: null,
      firedAtTurn: null,
      resolvedAtTurn: null,
      firedCount: 0,
    },
    silentUntilEngaged: false,
    lastChange: null,
  };
}

export function clampState(value: number): number {
  return clamp(value);
}
