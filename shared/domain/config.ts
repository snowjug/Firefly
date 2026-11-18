import { genericCurveball } from './curveballs.ts';
import type {
  CurveballDefinition,
  HiddenFact,
  ImpactVariant,
  KnownFact,
  ScenarioDefinition,
  ScenarioOverrides,
  ScenarioPersona,
} from './scenario.ts';
import { difficultyProfile } from './state.ts';
import {
  DIFFICULTY_RANK,
  type BusinessImpact,
  type CallStage,
  type CommunicationStyle,
  type CurveballType,
  type Difficulty,
  type DimensionId,
  type IssueType,
  type PracticeMode,
  type Proficiency,
  type StartTemperature,
} from './vocab.ts';

// A scenario plus the settings chosen for one call. This is the snapshot stored with every
// session, so a session can always be replayed and evaluated exactly as it was configured.

export interface EffectiveConfig {
  impact: BusinessImpact;
  startingTemperature: StartTemperature;
  proficiency: Proficiency;
  style: CommunicationStyle;
  callStage: CallStage;
  difficulty: Difficulty;
  curveballTypes: CurveballType[];
  mode: PracticeMode;
  seed: number;
}

export interface EffectiveScenario {
  scenarioId: string;
  scenarioVersion: number;
  title: string;
  summary: string;
  issueType: IssueType;
  tags: string[];
  estimatedMinutes: number;
  config: EffectiveConfig;
  persona: ScenarioPersona;
  environment: { product: string; details: string[] };
  customerObjective: string;
  brief: { situation: string; goal: string; groundRules: string[] };
  openingCore: string;
  stageFrame: { opening: string; brief: string };
  impactVariant: ImpactVariant;
  priorHistory: { when: string; summary: string }[];
  knownFacts: KnownFact[];
  hiddenFacts: HiddenFact[];
  incorrectAssumptions: { id: string; statement: string; truth: string }[];
  curveballs: CurveballDefinition[];
  expectedDiscoveryAreas: string[];
  successCriteria: string[];
  coachingFocus: DimensionId[];
  poorApproaches: string[];
  goodBehaviours: string[];
  expectedOutcome: string;
  evaluatorNotes: string;
}

export const GENERIC_STAGE_FRAMES: Record<CallStage, { opening: string; brief: string }> = {
  'first-contact': { opening: '', brief: '' },
  'follow-up': {
    opening: "I'm following up on the case I opened earlier, and I haven't had a proper update.",
    brief:
      'This is a follow-up on an open case. The customer expects progress, so check what has happened so far.',
  },
  escalated: {
    opening: "This has already been escalated and I'm still waiting for a proper answer.",
    brief:
      'The case was escalated after earlier contacts did not resolve it. Expect strained trust and little patience for repetition.',
  },
  closure: {
    opening: "I'm calling to see where we've landed on this and whether we can close it.",
    brief:
      'This is a closure call. The customer expects a wrap-up: confirm the outcome, agree anything outstanding and close professionally.',
  },
};

const unique = <T>(items: T[]): T[] => [...new Set(items)];

export function applyConfig(
  base: ScenarioDefinition,
  overrides: ScenarioOverrides = {},
  options: { mode?: PracticeMode; seed?: number } = {},
): EffectiveScenario {
  const difficulty = overrides.difficulty ?? base.difficulty;
  const profile = difficultyProfile(difficulty);
  const impact = overrides.impact ?? base.impact;
  const callStage = overrides.callStage ?? base.callStage;

  const authored = new Map(base.curveballs.map((c) => [c.type, c] as const));
  const requested: CurveballType[] =
    overrides.curveballs !== undefined
      ? unique(overrides.curveballs)
      : base.curveballs
          .filter((c) => DIFFICULTY_RANK[c.minDifficulty] <= DIFFICULTY_RANK[difficulty])
          .slice(0, profile.defaultCurveballCount)
          .map((c) => c.type);

  const curveballs: CurveballDefinition[] = [];
  for (const type of requested) {
    const def = authored.get(type) ?? genericCurveball(type);
    if (def) curveballs.push(def);
    if (curveballs.length >= profile.maxCurveballs) break;
  }

  const stageFrame = base.stageFrames[callStage] ?? GENERIC_STAGE_FRAMES[callStage];
  const situation = [base.brief.situation, stageFrame.brief].filter(Boolean).join(' ');

  return {
    scenarioId: base.id,
    scenarioVersion: base.version,
    title: base.title,
    summary: base.summary,
    issueType: base.issueType,
    tags: base.tags,
    estimatedMinutes: base.estimatedMinutes,
    config: {
      impact,
      startingTemperature: overrides.startingTemperature ?? base.startingTemperature,
      proficiency: overrides.proficiency ?? base.proficiency,
      style: overrides.style ?? base.style,
      callStage,
      difficulty,
      curveballTypes: curveballs.map((c) => c.type),
      mode: options.mode ?? profile.defaultMode,
      seed: options.seed ?? 1,
    },
    persona: base.persona,
    environment: base.environment,
    customerObjective: base.customerObjective,
    brief: { ...base.brief, situation },
    openingCore: base.openingCore,
    stageFrame,
    impactVariant: base.impactVariants[impact],
    priorHistory: base.priorHistory,
    knownFacts: base.knownFacts,
    hiddenFacts: base.hiddenFacts.filter(
      (f) => DIFFICULTY_RANK[f.minDifficulty] <= DIFFICULTY_RANK[difficulty],
    ),
    incorrectAssumptions: base.incorrectAssumptions,
    curveballs,
    expectedDiscoveryAreas: base.expectedDiscoveryAreas,
    successCriteria: base.successCriteria,
    coachingFocus: base.coachingFocus,
    poorApproaches: base.poorApproaches,
    goodBehaviours: base.goodBehaviours,
    expectedOutcome: base.expectedOutcome,
    evaluatorNotes: base.evaluatorNotes,
  };
}

/** Curveball types a scenario can offer: authored ones plus every generic type. */
export function availableCurveballTypes(base: ScenarioDefinition): CurveballType[] {
  const types = new Set<CurveballType>(base.curveballs.map((c) => c.type));
  for (const type of [
    'ask-manager',
    'threaten-cancel',
    'deadline',
    'go-silent',
    'previous-bad-experience',
    'unsupported-guarantee',
    'challenge-credibility',
  ] as const) {
    types.add(type);
  }
  return [...types];
}
