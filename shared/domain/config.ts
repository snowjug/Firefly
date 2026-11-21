import { genericCurveball } from './curveballs.ts';
import type {
  CareExpectations,
  CheckableFact,
  CurveballDefinition,
  HiddenFact,
  ImpactVariant,
  IrrelevantFact,
  KnownFact,
  ProductRef,
  PublicBrief,
  ScenarioDefinition,
  ScenarioOverrides,
  ScenarioPersona,
  UnknownFact,
  VagueFact,
} from './scenario.ts';
import { difficultyProfile } from './state.ts';
import {
  DIFFICULTY_RANK,
  PRODUCT_INFO,
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
  /** Which greeting fits ("Good morning"). Chosen by the trainee's clock when they start. */
  timeOfDay: TimeOfDay;
}

export const TIMES_OF_DAY = ['morning', 'afternoon', 'evening'] as const;
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

export interface EffectiveScenario {
  scenarioId: string;
  scenarioVersion: number;
  title: string;
  summary: string;
  issueType: IssueType;
  tags: string[];
  estimatedMinutes: number;
  config: EffectiveConfig;
  product: ProductRef | null; // null only for sessions saved before Firefly was Microsoft-only
  caseReference: string | null;
  persona: ScenarioPersona;
  // product is the product's name, taken from product so the two always agree.
  environment: { product: string; details: string[] };
  affectedUsers: { count: number | null; summary: string }; // for the chosen impact level
  customerObjective: string;
  customerExpectation: string;
  desiredOutcome: string;
  previousTroubleshooting: string[];
  recentChanges: string[];
  publicBrief: PublicBrief;
  brief: { situation: string; goal: string; groundRules: string[] };
  openingCore: string;
  stageFrame: { opening: string; brief: string };
  impactVariant: ImpactVariant;
  priorHistory: { when: string; summary: string }[];
  knownFacts: KnownFact[];
  vagueFacts: VagueFact[];
  checkableFacts: CheckableFact[];
  unknownFacts: UnknownFact[];
  irrelevantFacts: IrrelevantFact[];
  hiddenFacts: HiddenFact[];
  incorrectAssumptions: { id: string; statement: string; truth: string }[];
  curveballs: CurveballDefinition[];
  expectedDiscoveryAreas: string[];
  successCriteria: string[];
  coachingFocus: DimensionId[];
  careExpectations: CareExpectations;
  cbcfBehaviours: string[];
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

/** The fact as it reads at this impact level: its own wording if it has some, else the default. */
function forImpact(fact: HiddenFact, impact: BusinessImpact): HiddenFact {
  const own = fact.byImpact?.[impact];
  if (!own) return fact;
  const { partialStatement: _p, statementTerse: _t, statementSimple: _s, ...rest } = fact;
  return { ...rest, ...own };
}

export function applyConfig(
  base: ScenarioDefinition,
  overrides: ScenarioOverrides = {},
  options: { mode?: PracticeMode; seed?: number; timeOfDay?: TimeOfDay } = {},
): EffectiveScenario {
  const difficulty = overrides.difficulty ?? base.difficulty;
  const profile = difficultyProfile(difficulty);
  const impact = overrides.impact ?? base.impact;
  const callStage = overrides.callStage ?? base.callStage;

  const allowed = new Set(base.allowedCurveballs);
  const authored = new Map(base.curveballs.map((c) => [c.type, c] as const));
  const requested: CurveballType[] =
    overrides.curveballs !== undefined
      ? unique(overrides.curveballs).filter((type) => allowed.has(type))
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
  // Facts limited to some call stages exist only in those.
  const atStage = <T extends { stages?: CallStage[] | undefined }>(items: T[]): T[] =>
    items.filter((item) => !item.stages || item.stages.includes(callStage));

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
      timeOfDay:
        options.timeOfDay ?? TIMES_OF_DAY[(options.seed ?? 1) % TIMES_OF_DAY.length] ?? 'morning',
    },
    product: base.product,
    caseReference: base.caseReference ?? null,
    persona: base.persona,
    environment: { product: PRODUCT_INFO[base.product.id].name, details: base.environment.details },
    affectedUsers: base.affectedUsers[impact],
    customerObjective: base.customerObjective,
    customerExpectation: base.customerExpectation,
    desiredOutcome: base.desiredOutcome,
    previousTroubleshooting: base.previousTroubleshooting,
    recentChanges: base.recentChanges,
    publicBrief: base.publicBrief,
    brief: { ...base.brief, situation },
    openingCore: base.openingCore,
    stageFrame,
    impactVariant: base.impactVariants[impact],
    priorHistory: base.priorHistory,
    knownFacts: atStage(base.knownFacts),
    vagueFacts: atStage(base.vagueFacts),
    checkableFacts: atStage(base.checkableFacts),
    unknownFacts: atStage(base.unknownFacts),
    irrelevantFacts: atStage(base.irrelevantFacts),
    hiddenFacts: base.hiddenFacts
      .filter((f) => DIFFICULTY_RANK[f.minDifficulty] <= DIFFICULTY_RANK[difficulty])
      .filter((f) => !f.stages || f.stages.includes(callStage))
      .map((f) => forImpact(f, impact)),
    incorrectAssumptions: atStage(base.incorrectAssumptions),
    curveballs,
    expectedDiscoveryAreas: base.expectedDiscoveryAreas,
    successCriteria: base.successCriteria,
    coachingFocus: base.coachingFocus,
    careExpectations: base.careExpectations,
    cbcfBehaviours: base.cbcfBehaviours,
    poorApproaches: base.poorApproaches,
    goodBehaviours: base.goodBehaviours,
    expectedOutcome: base.expectedOutcome,
    evaluatorNotes: base.evaluatorNotes,
  };
}

const NO_CARE_EXPECTATIONS: CareExpectations = {
  communicate: [],
  accountable: [],
  resourceful: [],
  empathetic: [],
};

/**
 * Sessions saved before Firefly became a Microsoft-only simulator hold a scenario snapshot without
 * the fields added since. This fills those in with empty values so that such a session can still
 * be listed, read and shown; it never invents content.
 */
export function normaliseStoredScenario(stored: EffectiveScenario): EffectiveScenario {
  const old = stored as Partial<EffectiveScenario> & EffectiveScenario;
  return {
    ...old,
    config: { ...old.config, timeOfDay: old.config.timeOfDay ?? 'morning' },
    product: old.product ?? null,
    caseReference: old.caseReference ?? null,
    affectedUsers: old.affectedUsers ?? { count: null, summary: '' },
    customerExpectation: old.customerExpectation ?? '',
    desiredOutcome: old.desiredOutcome ?? '',
    previousTroubleshooting: old.previousTroubleshooting ?? [],
    recentChanges: old.recentChanges ?? [],
    publicBrief: old.publicBrief ?? {
      issue: old.brief?.situation ?? '',
      impact: { low: '', medium: '', high: '' },
      objective: old.brief?.goal ?? '',
    },
    vagueFacts: old.vagueFacts ?? [],
    checkableFacts: old.checkableFacts ?? [],
    unknownFacts: old.unknownFacts ?? [],
    irrelevantFacts: old.irrelevantFacts ?? [],
    careExpectations: old.careExpectations ?? NO_CARE_EXPECTATIONS,
    cbcfBehaviours: old.cbcfBehaviours ?? [],
  };
}

/** The curveball types this scenario can be configured with: exactly the ones it allows. */
export function availableCurveballTypes(base: ScenarioDefinition): CurveballType[] {
  return [...base.allowedCurveballs];
}
