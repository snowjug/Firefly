import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import type { ScenarioOverrides } from '#shared/domain/scenario.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import {
  CALL_STAGES,
  CALL_STAGE_LABELS,
  CURVEBALL_LABELS,
  CURVEBALL_TYPES,
  DIFFICULTIES,
  IMPACTS,
  IMPACT_LABELS,
  ISSUE_TYPE_LABELS,
  PROFICIENCIES,
  PROFICIENCY_LABELS,
  START_TEMPERATURES,
  START_TEMPERATURE_LABELS,
  STYLES,
  STYLE_LABELS,
  temperatureBand,
  type BusinessImpact,
  type CallStage,
  type CommunicationStyle,
  type CurveballType,
  type Difficulty,
  type Proficiency,
  type StartTemperature,
  type TemperatureBandId,
} from '#shared/domain/vocab.ts';
import { isOneOf, isRecord } from './guards.ts';

// Pure logic for the call setup flow: the eight steps, the choices a trainee can make, how they map
// to the `overrides` sent to the server (only what differs from the scenario), and the plain-language
// description shown in the live preview. Nothing here goes beyond the public scenario.

export const SETUP_STEPS = [
  { id: 'issue', name: 'Issue', title: 'The issue' },
  { id: 'impact', name: 'Impact', title: 'Business impact' },
  { id: 'temperament', name: 'Temperament', title: 'Customer temperament' },
  { id: 'style', name: 'Style', title: 'Communication style' },
  { id: 'stage', name: 'Stage', title: 'Call stage' },
  { id: 'difficulty', name: 'Difficulty', title: 'Difficulty' },
  { id: 'curveballs', name: 'Curveballs', title: 'Curveballs' },
  { id: 'review', name: 'Review', title: 'Review and begin' },
] as const;

export const STEP_COUNT = SETUP_STEPS.length;

/** A step number from the URL, kept within 1..STEP_COUNT. */
export function parseStep(raw: string | null): number {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) ? Math.min(STEP_COUNT, Math.max(1, n)) : 1;
}

export type SettingKey =
  'impact' | 'startingTemperature' | 'style' | 'proficiency' | 'callStage' | 'difficulty';

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
  if (mode === 'none') overrides.curveballs = [];
  else if (mode === 'choose') {
    overrides.curveballs = fitCurveballs(
      choices.curveballs,
      choices.difficulty,
      scenario.curveballOptions,
    ).picks;
  }
  return overrides;
}

// ------------------------------------------------------------------------------------------
// Rows for summaries

export interface SettingRow {
  key: SettingKey | 'curveballs' | 'issue';
  /** The setup step where this can be changed. */
  step: number;
  term: string;
  value: string;
  description: string;
  defaultValue: string;
  changed: boolean;
  /** Set for the temperament row so it can show the orb. */
  band?: TemperatureBandId;
}

const DIFFICULTY_TABLE = Object.fromEntries(
  DIFFICULTIES.map((d) => [
    d,
    { label: DIFFICULTY_PROFILES[d].label, description: DIFFICULTY_PROFILES[d].summary },
  ]),
) as Record<Difficulty, { label: string; description: string }>;

export function temperatureBandFor(temperature: StartTemperature): TemperatureBandId {
  return temperatureBand(START_TEMPERATURE_LABELS[temperature].startValue).id;
}

/** The scenario itself as the first row of a review. It is chosen on the library, so it never reads "changed". */
export function issueRow(scenario: PublicScenarioDTO): SettingRow {
  return {
    key: 'issue',
    step: 1,
    term: 'Issue',
    value: scenario.title,
    description: ISSUE_TYPE_LABELS[scenario.issueType],
    defaultValue: scenario.title,
    changed: false,
  };
}

export function settingRows(scenario: PublicScenarioDTO, choices: SetupChoices): SettingRow[] {
  const defaults = defaultChoices(scenario);
  const simple = <K extends SettingKey>(
    key: K,
    step: number,
    term: string,
    table: Record<SetupChoices[K], { label: string; description: string }>,
  ): SettingRow => ({
    key,
    step,
    term,
    value: table[choices[key]].label,
    description: table[choices[key]].description,
    defaultValue: table[defaults[key]].label,
    changed: choices[key] !== defaults[key],
  });

  const temperament = simple(
    'startingTemperature',
    3,
    'Customer temperament',
    START_TEMPERATURE_LABELS,
  );
  temperament.band = temperatureBandFor(choices.startingTemperature);

  return [
    simple('impact', 2, 'Business impact', IMPACT_LABELS),
    temperament,
    simple('style', 4, 'Communication style', STYLE_LABELS),
    simple('proficiency', 4, 'Technical proficiency', PROFICIENCY_LABELS),
    simple('callStage', 5, 'Call stage', CALL_STAGE_LABELS),
    simple('difficulty', 6, 'Difficulty', DIFFICULTY_TABLE),
    curveballRow(scenario, choices),
  ];
}

function curveballRow(scenario: PublicScenarioDTO, choices: SetupChoices): SettingRow {
  const profile = DIFFICULTY_PROFILES[choices.difficulty];
  const mode = effectiveCurveballMode(choices);
  const base = { key: 'curveballs' as const, step: 7, term: 'Curveballs' };
  const defaultValue = 'Recommended for the difficulty';
  if (mode === 'none') {
    return {
      ...base,
      value: 'None',
      description: 'No curveballs on this call.',
      defaultValue,
      changed: profile.defaultCurveballCount > 0,
    };
  }
  if (mode === 'choose') {
    const picks = fitCurveballs(
      choices.curveballs,
      choices.difficulty,
      scenario.curveballOptions,
    ).picks;
    return {
      ...base,
      value: picks.map((p) => CURVEBALL_LABELS[p].label).join(', '),
      description: 'The customer may do something unexpected. You will not be told when.',
      defaultValue,
      changed: true,
    };
  }
  return {
    ...base,
    value: `Recommended for ${profile.label}`,
    description: recommendedCurveballText(choices.difficulty),
    defaultValue,
    changed: false,
  };
}

// ------------------------------------------------------------------------------------------
// The sentence in "Your call so far"

const TEMPERAMENT_WORDS: Record<StartTemperature, string> = {
  calm: 'calm',
  anxious: 'anxious',
  frustrated: 'frustrated',
  angry: 'angry',
};

const STYLE_WORDS: Record<CommunicationStyle, string> = {
  talkative: 'talkative',
  terse: 'terse',
  demanding: 'demanding',
  vague: 'vague',
  'non-native': 'a non-native English speaker',
};

const STAGE_SENTENCES: Record<CallStage, string> = {
  'first-contact': "It's a first contact.",
  'follow-up': "It's a follow-up on an open case.",
  escalated: "It's an escalated case.",
  closure: "It's a closure call.",
};

const isAcronym = (word: string) =>
  word.length > 1 && /[A-Z]/.test(word) && word === word.toUpperCase();

/** "IT administrator" stays as written; "Senior Platform Engineer" becomes "senior platform engineer". */
function lowerRole(role: string): string {
  return role
    .trim()
    .split(/\s+/)
    .map((word) => (isAcronym(word) ? word : word.toLowerCase()))
    .join(' ');
}

function withArticle(phrase: string): string {
  const first = phrase.split(/\s+/)[0] ?? '';
  let vowelSound: boolean;
  if (isAcronym(first)) vowelSound = /^[AEFHILMNORSX]/.test(first);
  else if (/^(uni|use|usu|eur|one|once)/i.test(first)) vowelSound = false;
  else if (/^(hour|honest|honou?r|heir)/i.test(first)) vowelSound = true;
  else vowelSound = /^[aeiou]/i.test(first);
  return `${vowelSound ? 'an' : 'a'} ${phrase}`;
}

/** One plain sentence about the call, built only from the public scenario and the current choices. */
export function describeCall(scenario: PublicScenarioDTO, choices: SetupChoices): string {
  const { name, role, organisation } = scenario.persona;
  const knowledge = PROFICIENCY_LABELS[choices.proficiency].label.toLowerCase();
  return [
    `${name}, ${withArticle(lowerRole(role))} at ${organisation}, is ${TEMPERAMENT_WORDS[choices.startingTemperature]} and ${STYLE_WORDS[choices.style]}, with ${knowledge} technical knowledge.`,
    STAGE_SENTENCES[choices.callStage],
    `Business impact is ${IMPACT_LABELS[choices.impact].label.toLowerCase()}.`,
  ].join(' ');
}

// ------------------------------------------------------------------------------------------
// Draft

export interface DraftLike {
  scenarioId: string;
  overrides: ScenarioOverrides;
}

/** The saved draft counts only when it is for this scenario. */
export function draftFor<T extends DraftLike>(draft: T | null, scenarioId: string): T | null {
  return draft && draft.scenarioId === scenarioId && isRecord(draft.overrides) ? draft : null;
}
