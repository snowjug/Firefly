import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import type { MissionRecommendation } from '#shared/domain/recommend.ts';
import type { ScenarioOverrides } from '#shared/domain/scenario.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import {
  CALL_STAGES,
  CURVEBALL_TYPES,
  DIFFICULTIES,
  DIFFICULTY_RANK,
  IMPACTS,
  ISSUE_TYPES,
  PRACTICE_MODES,
  PROFICIENCIES,
  START_TEMPERATURES,
  START_TEMPERATURE_LABELS,
  STYLES,
  temperatureBand,
  type BusinessImpact,
  type CallStage,
  type CommunicationStyle,
  type CurveballType,
  type Difficulty,
  type IssueType,
  type PracticeMode,
  type Proficiency,
  type StartTemperature,
  type TemperatureBandId,
} from '#shared/domain/vocab.ts';
import type { HintsPreference } from '../../lib/profile.ts';
import { isOneOf, isRecord } from './guards.ts';

// Pure logic for the practice setup page: the choices a trainee can make, how they map to the
// `overrides` sent to the server (only what differs from the scenario), which scenario to start
// from, and how the curveball switch and its list behave. Nothing here goes beyond the public
// scenario: hidden facts are never part of it.

export type SettingKey =
  'difficulty' | 'impact' | 'startingTemperature' | 'proficiency' | 'style' | 'callStage';

/** The settings in the order the page shows them. */
const SETTING_KEYS: readonly SettingKey[] = [
  'difficulty',
  'impact',
  'startingTemperature',
  'proficiency',
  'style',
  'callStage',
];

export const SETTING_NAMES: Record<SettingKey | 'curveballs', string> = {
  difficulty: 'Difficulty',
  impact: 'Business impact',
  startingTemperature: 'Customer temperature',
  proficiency: 'Technical proficiency',
  style: 'Communication style',
  callStage: 'Call stage',
  curveballs: 'Curveballs',
};

/** One short line for each Quick start card. The full summary of the chosen one sits under them. */
export const DIFFICULTY_TAGLINES: Record<Difficulty, string> = {
  starter: 'Clearer clues, a friendlier customer',
  standard: 'Moderate ambiguity',
  challenge: 'High pressure, less to go on',
};

/**
 * "recommended" leaves curveballs to the difficulty, "none" switches them off and "choose" lists the
 * ones the trainee picked.
 */
export type CurveballMode = 'recommended' | 'none' | 'choose';

export interface SetupChoices {
  impact: BusinessImpact;
  startingTemperature: StartTemperature;
  style: CommunicationStyle;
  proficiency: Proficiency;
  callStage: CallStage;
  difficulty: Difficulty;
  curveballMode: CurveballMode;
  /** Only used while `curveballMode` is "choose". */
  curveballs: CurveballType[];
}

export function defaultChoices(scenario: PublicScenarioDTO): SetupChoices {
  return {
    impact: scenario.impact,
    startingTemperature: scenario.startingTemperature,
    style: scenario.style,
    proficiency: scenario.proficiency,
    callStage: scenario.callStage,
    difficulty: scenario.difficulty,
    curveballMode: 'recommended',
    curveballs: [],
  };
}

// ------------------------------------------------------------------------------------------
// Curveballs

export function maxCurveballs(difficulty: Difficulty): number {
  return DIFFICULTY_PROFILES[difficulty].maxCurveballs;
}

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four'];
const numberWord = (n: number) => NUMBER_WORDS[n] ?? String(n);

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "one curveball", "two curveballs". */
export function curveballCount(n: number): string {
  return `${numberWord(n)} ${n === 1 ? 'curveball' : 'curveballs'}`;
}

/**
 * Keeps only curveballs the scenario offers, without repeats, and no more than the difficulty
 * allows. The earliest picks are kept, so lowering the difficulty drops the latest ones.
 */
export function fitCurveballs(
  picks: readonly CurveballType[],
  difficulty: Difficulty,
  offered: readonly CurveballType[],
): { picks: CurveballType[]; removed: CurveballType[] } {
  const allowed = new Set(offered);
  const unique = [...new Set(picks)].filter((pick) => allowed.has(pick));
  const max = maxCurveballs(difficulty);
  return { picks: unique.slice(0, max), removed: unique.slice(max) };
}

/** Never says when or how a curveball happens, only that the customer may do something unexpected. */
export function recommendedCurveballText(difficulty: Difficulty): string {
  const n = DIFFICULTY_PROFILES[difficulty].defaultCurveballCount;
  if (n === 0) return 'No curveballs.';
  return n === 1
    ? 'One curveball may come up. You will not be told when.'
    : `Up to ${numberWord(n)} curveballs may come up. You will not be told when.`;
}

function effectiveCurveballMode(choices: SetupChoices): CurveballMode {
  return choices.curveballMode === 'choose' && choices.curveballs.length === 0
    ? 'none'
    : choices.curveballMode;
}

/** The curveballs this scenario offers, in the order they are listed everywhere. */
export function availableCurveballs(scenario: PublicScenarioDTO): CurveballType[] {
  return CURVEBALL_TYPES.filter((type) => scenario.curveballOptions.includes(type));
}

/**
 * Whether the curveball switch reads "on". The difficulty's own recommendation counts as on when it
 * includes a curveball; Starter recommends none, so it reads "off" until one is chosen.
 */
export function curveballsOn(choices: SetupChoices): boolean {
  const mode = effectiveCurveballMode(choices);
  return (
    mode === 'choose' ||
    (mode === 'recommended' && DIFFICULTY_PROFILES[choices.difficulty].defaultCurveballCount > 0)
  );
}

/**
 * Flips the curveball switch. Off means none. On means what the difficulty recommends; where that
 * is nothing (Starter) the first curveball the scenario offers is ticked, so "on" never means "none".
 */
export function withCurveballsOn(
  scenario: PublicScenarioDTO,
  choices: SetupChoices,
  on: boolean,
): SetupChoices {
  if (!on) return { ...choices, curveballMode: 'none', curveballs: [] };
  if (DIFFICULTY_PROFILES[choices.difficulty].defaultCurveballCount > 0) {
    return { ...choices, curveballMode: 'recommended', curveballs: [] };
  }
  const first = availableCurveballs(scenario)[0];
  return first
    ? { ...choices, curveballMode: 'choose', curveballs: [first] }
    : { ...choices, curveballMode: 'none', curveballs: [] };
}

/**
 * Ticks or unticks one curveball. Ticking never goes past what the difficulty allows. Once nothing
 * is ticked the choice goes back to what the difficulty recommends.
 */
export function withCurveballPick(
  scenario: PublicScenarioDTO,
  choices: SetupChoices,
  type: CurveballType,
  picked: boolean,
): SetupChoices {
  const current = choices.curveballMode === 'choose' ? choices.curveballs : [];
  const next = picked
    ? [...current.filter((pick) => pick !== type), type]
    : current.filter((pick) => pick !== type);
  const { picks } = fitCurveballs(next, choices.difficulty, scenario.curveballOptions);
  return picks.length > 0
    ? { ...choices, curveballMode: 'choose', curveballs: picks }
    : { ...choices, curveballMode: 'recommended', curveballs: [] };
}

/** The line under the curveball switch. It never says when a curveball will happen. */
export function curveballSummary(choices: SetupChoices): string {
  if (!curveballsOn(choices)) return 'No curveballs on this call.';
  if (effectiveCurveballMode(choices) === 'choose') {
    const n = choices.curveballs.length;
    return `${capitalise(curveballCount(n))} chosen. You will not be told when ${n === 1 ? 'it' : 'one'} may come up.`;
  }
  return recommendedCurveballText(choices.difficulty);
}

function curveballsChanged(choices: SetupChoices): boolean {
  const mode = effectiveCurveballMode(choices);
  if (mode === 'choose') return true;
  return mode === 'none' && DIFFICULTY_PROFILES[choices.difficulty].defaultCurveballCount > 0;
}

// ------------------------------------------------------------------------------------------
// Choices <-> overrides

/** Turns saved overrides (which may be stale or edited by hand) into valid choices. */
export function choicesFromOverrides(
  scenario: PublicScenarioDTO,
  overrides: unknown,
): SetupChoices {
  const base = defaultChoices(scenario);
  if (!isRecord(overrides)) return base;
  const difficulty = isOneOf(DIFFICULTIES, overrides.difficulty)
    ? overrides.difficulty
    : base.difficulty;
  const choices: SetupChoices = {
    ...base,
    difficulty,
    impact: isOneOf(IMPACTS, overrides.impact) ? overrides.impact : base.impact,
    startingTemperature: isOneOf(START_TEMPERATURES, overrides.startingTemperature)
      ? overrides.startingTemperature
      : base.startingTemperature,
    style: isOneOf(STYLES, overrides.style) ? overrides.style : base.style,
    proficiency: isOneOf(PROFICIENCIES, overrides.proficiency)
      ? overrides.proficiency
      : base.proficiency,
    callStage: isOneOf(CALL_STAGES, overrides.callStage) ? overrides.callStage : base.callStage,
  };
  const saved = overrides.curveballs;
  if (Array.isArray(saved)) {
    if (saved.length === 0) {
      choices.curveballMode = 'none';
    } else {
      const fit = fitCurveballs(
        saved.filter((c): c is CurveballType => isOneOf(CURVEBALL_TYPES, c)),
        difficulty,
        scenario.curveballOptions,
      );
      if (fit.picks.length > 0) {
        choices.curveballMode = 'choose';
        choices.curveballs = fit.picks;
      }
    }
  }
  return choices;
}

/** Only what differs from the scenario's own defaults. An empty object means "as written". */
export function overridesFromChoices(
  scenario: PublicScenarioDTO,
  choices: SetupChoices,
): ScenarioOverrides {
  const overrides: ScenarioOverrides = {};
  if (choices.impact !== scenario.impact) overrides.impact = choices.impact;
  if (choices.startingTemperature !== scenario.startingTemperature) {
    overrides.startingTemperature = choices.startingTemperature;
  }
  if (choices.style !== scenario.style) overrides.style = choices.style;
  if (choices.proficiency !== scenario.proficiency) overrides.proficiency = choices.proficiency;
  if (choices.callStage !== scenario.callStage) overrides.callStage = choices.callStage;
  if (choices.difficulty !== scenario.difficulty) overrides.difficulty = choices.difficulty;
  const mode = effectiveCurveballMode(choices);
  if (mode === 'none') {
    // A difficulty that recommends no curveballs already means "none".
    if (DIFFICULTY_PROFILES[choices.difficulty].defaultCurveballCount > 0) {
      overrides.curveballs = [];
    }
  } else if (mode === 'choose') {
    overrides.curveballs = fitCurveballs(
      choices.curveballs,
      choices.difficulty,
      scenario.curveballOptions,
    ).picks;
  }
  return overrides;
}

/** What differs from the scenario as written, in the order the page shows it. */
export function changedSettings(
  scenario: PublicScenarioDTO,
  choices: SetupChoices,
): (SettingKey | 'curveballs')[] {
  const base = defaultChoices(scenario);
  const changed: (SettingKey | 'curveballs')[] = SETTING_KEYS.filter(
    (key) => choices[key] !== base[key],
  );
  if (curveballsChanged(choices)) changed.push('curveballs');
  return changed;
}

// ------------------------------------------------------------------------------------------
// Which scenario

/** Issue types that have at least one scenario, in the order the vocabulary lists them. */
export function issueTypesOf(scenarios: readonly PublicScenarioDTO[]): IssueType[] {
  const present = new Set(scenarios.map((scenario) => scenario.issueType));
  return ISSUE_TYPES.filter((type) => present.has(type));
}

/** The scenarios of one issue type, gentlest first. */
export function scenariosOfIssue(
  scenarios: readonly PublicScenarioDTO[],
  issueType: IssueType,
): PublicScenarioDTO[] {
  return scenarios
    .filter((scenario) => scenario.issueType === issueType)
    .sort(
      (a, b) =>
        DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty] ||
        a.title.localeCompare(b.title),
    );
}

/** The scenario of this issue type written for the difficulty, else the gentlest one. */
export function scenarioForIssue(
  scenarios: readonly PublicScenarioDTO[],
  issueType: IssueType,
  difficulty: Difficulty,
): PublicScenarioDTO | null {
  const family = scenariosOfIssue(scenarios, issueType);
  return family.find((scenario) => scenario.difficulty === difficulty) ?? family[0] ?? null;
}

/**
 * Moves what the trainee changed onto another scenario. Their changes are theirs, not the
 * scenario's, so they stay, and so does the difficulty they have chosen; everything else they did
 * not touch takes the new scenario's own value.
 */
export function carryChoices(
  from: PublicScenarioDTO,
  to: PublicScenarioDTO,
  choices: SetupChoices,
): SetupChoices {
  return choicesFromOverrides(to, {
    ...overridesFromChoices(from, choices),
    difficulty: choices.difficulty,
  });
}

/**
 * Switching the issue type: the scenario of that type written for the chosen difficulty, or the
 * gentlest one, with the trainee's changes carried over.
 */
export function switchIssue(
  scenarios: readonly PublicScenarioDTO[],
  issueType: IssueType,
  from: PublicScenarioDTO,
  choices: SetupChoices,
): { scenario: PublicScenarioDTO; choices: SetupChoices } | null {
  const scenario = scenarioForIssue(scenarios, issueType, choices.difficulty);
  return scenario ? { scenario, choices: carryChoices(from, scenario, choices) } : null;
}

export interface StartPick {
  scenario: PublicScenarioDTO;
  /** Why it was suggested, when the history decided. Null when it is simply the first one. */
  reason: string | null;
}

/**
 * The scenario the practice page opens on: the recommended one among those written for the
 * difficulty, or the first of them. A difficulty with no scenario falls back to the whole library.
 */
export function chooseStartScenario(
  scenarios: readonly PublicScenarioDTO[],
  difficulty: Difficulty,
  recommend: (pool: PublicScenarioDTO[]) => MissionRecommendation | null,
): StartPick | null {
  const written = scenarios.filter((scenario) => scenario.difficulty === difficulty);
  const pool = written.length > 0 ? written : [...scenarios];
  const recommendation = recommend(pool);
  if (recommendation) return { scenario: recommendation.scenario, reason: recommendation.reason };
  const first = pool[0];
  return first ? { scenario: first, reason: null } : null;
}

// ------------------------------------------------------------------------------------------
// Practice mode

/** Guided or immersive when nothing has been chosen: the hints setting wins, else the difficulty. */
export function defaultMode(difficulty: Difficulty, hints: HintsPreference): PracticeMode {
  if (hints === 'on') return 'guided';
  if (hints === 'off') return 'immersive';
  return DIFFICULTY_PROFILES[difficulty].defaultMode;
}

// ------------------------------------------------------------------------------------------
// Temperature

export function temperatureBandFor(temperature: StartTemperature): TemperatureBandId {
  return temperatureBand(START_TEMPERATURE_LABELS[temperature].startValue).id;
}

// ------------------------------------------------------------------------------------------
// Draft

export interface DraftLike {
  scenarioId: string;
  overrides: ScenarioOverrides;
  mode?: PracticeMode;
}

/** The saved draft counts only when it is for this scenario. */
export function draftFor<T extends DraftLike>(draft: T | null, scenarioId: string): T | null {
  return draft && draft.scenarioId === scenarioId && isRecord(draft.overrides) ? draft : null;
}

/** The practice mode the trainee chose, if the draft holds a valid one. */
export function modeFromDraft(draft: { mode?: unknown } | null): PracticeMode | null {
  return isOneOf(PRACTICE_MODES, draft?.mode) ? draft.mode : null;
}
