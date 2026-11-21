import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import type { ScenarioOverrides } from '#shared/domain/scenario.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import {
  CALL_STAGES,
  DIFFICULTIES,
  IMPACTS,
  PROFICIENCIES,
  START_TEMPERATURES,
  STYLES,
  type BusinessImpact,
  type CallStage,
  type CommunicationStyle,
  type CurveballType,
  type Difficulty,
  type PracticeMode,
  type Proficiency,
  type StartTemperature,
} from '#shared/domain/vocab.ts';
import { curveballChoices } from './labels.ts';
import { defaultVoiceFor, isVoiceId, type VoiceId } from './voice-choice.ts';

// The call configuration, and how it travels in the address bar.
//
// THE QUERY KEYS ARE A CONTRACT. The report page builds the same query for "Repeat this scenario",
// so these names must not change: `difficulty` (starter | standard | challenge), `impact` (low |
// medium | high), `temperature` (the starting temperature: calm | anxious | frustrated | angry),
// `proficiency` (novice | intermediate | expert), `style` (talkative | terse | demanding | vague |
// non-native), `stage` (first-contact | follow-up | escalated | closure), `curveballs` (`none`, or a
// comma-separated list of curveball types; absent means the difficulty's own default) and `hints`
// (`on` | `off`; absent means the difficulty's own default: on for Starter, off otherwise). One key
// is added to those eight and is not sent by the report: `voice` (voice-a to voice-d; absent means
// the scenario's own voice).
//
// A value that is missing or not valid is ignored and the scenario's own value is used: nothing here
// throws. Values equal to the scenario's own settings are left out of a serialised query.

export const CONFIG_KEYS = [
  'difficulty',
  'impact',
  'temperature',
  'proficiency',
  'style',
  'stage',
  'curveballs',
  'hints',
  'voice',
] as const;
export type ConfigKey = (typeof CONFIG_KEYS)[number];

/** What the configuration needs to know about a scenario: its own settings and what it offers. */
export type ConfigScenario = Pick<
  PublicScenarioDTO,
  | 'id'
  | 'difficulty'
  | 'impact'
  | 'startingTemperature'
  | 'proficiency'
  | 'style'
  | 'callStage'
  | 'curveballOptions'
>;

/** `default` follows the difficulty, `none` switches curveballs off, `choose` lists the ones picked. */
export type CurveballSetting =
  { mode: 'default' } | { mode: 'none' } | { mode: 'choose'; types: CurveballType[] };

export interface CallConfig {
  difficulty: Difficulty;
  impact: BusinessImpact;
  temperature: StartTemperature;
  proficiency: Proficiency;
  style: CommunicationStyle;
  stage: CallStage;
  curveballs: CurveballSetting;
  /** `null` follows the difficulty: on for Starter, off for Standard and Challenge. */
  hints: boolean | null;
  /** `null` is the scenario's own voice (see `defaultVoiceFor`). */
  voice: VoiceId | null;
}

// ---- Difficulty-dependent defaults -------------------------------------------------------

/** Live hints are on by default for exactly the difficulties whose practice mode is guided. */
export function hintsDefault(difficulty: Difficulty): boolean {
  return DIFFICULTY_PROFILES[difficulty].defaultMode === 'guided';
}

/** Whether live hints are on for this call. */
export function hintsOn(config: Pick<CallConfig, 'difficulty' | 'hints'>): boolean {
  return config.hints ?? hintsDefault(config.difficulty);
}

/** How many curveballs a call at this difficulty can have. */
export function maxCurveballs(difficulty: Difficulty): number {
  return DIFFICULTY_PROFILES[difficulty].maxCurveballs;
}

/**
 * Keeps the curveballs the scenario offers, once each, and no more than the difficulty allows. The
 * earliest are kept, so a lower difficulty drops the latest ones.
 */
export function fitCurveballs(
  types: readonly CurveballType[],
  difficulty: Difficulty,
  scenario: Pick<PublicScenarioDTO, 'curveballOptions'>,
): { kept: CurveballType[]; dropped: CurveballType[] } {
  const offered = new Set(curveballChoices(scenario));
  const unique = [...new Set(types)].filter((type) => offered.has(type));
  const max = maxCurveballs(difficulty);
  return { kept: unique.slice(0, max), dropped: unique.slice(max) };
}

// ---- Defaults, parsing and serialising ---------------------------------------------------

/** The scenario exactly as written: every control at its own setting. */
export function defaultConfig(scenario: ConfigScenario): CallConfig {
  return {
    difficulty: scenario.difficulty,
    impact: scenario.impact,
    temperature: scenario.startingTemperature,
    proficiency: scenario.proficiency,
    style: scenario.style,
    stage: scenario.callStage,
    curveballs: { mode: 'default' },
    hints: null,
    voice: null,
  };
}

/** The voice a call will use: the one chosen, else the scenario's own. */
export function effectiveVoice(config: Pick<CallConfig, 'voice'>, scenarioId: string): VoiceId {
  return config.voice ?? defaultVoiceFor(scenarioId);
}

/** The valid values in a query, key by key. A key that is missing, empty or not valid is `undefined`. */
export interface ConfigQuery {
  difficulty?: Difficulty;
  impact?: BusinessImpact;
  temperature?: StartTemperature;
  proficiency?: Proficiency;
  style?: CommunicationStyle;
  stage?: CallStage;
  /** `none`, or a comma-separated list: read against the scenario afterwards. */
  curveballs?: string;
  hints?: 'on' | 'off';
  voice?: VoiceId;
}

const HINTS_VALUES = ['on', 'off'] as const;

/** The member of `list` that `value` is, exactly (the case matters), or undefined. */
function oneOf<T extends string>(list: readonly T[], value: string | undefined): T | undefined {
  return list.find((item) => item === value);
}

/**
 * Keeps what is valid in a raw query and drops the rest, key by key: it never throws, and one bad
 * value never spoils another. Written by hand rather than with a schema library, so the web app
 * does not have to ship one.
 */
export function parseConfigQuery(
  raw: Readonly<Record<ConfigKey, string | undefined>>,
): ConfigQuery {
  return {
    difficulty: oneOf(DIFFICULTIES, raw.difficulty),
    impact: oneOf(IMPACTS, raw.impact),
    temperature: oneOf(START_TEMPERATURES, raw.temperature),
    proficiency: oneOf(PROFICIENCIES, raw.proficiency),
    style: oneOf(STYLES, raw.style),
    stage: oneOf(CALL_STAGES, raw.stage),
    curveballs: raw.curveballs,
    hints: oneOf(HINTS_VALUES, raw.hints),
    voice: isVoiceId(raw.voice) ? raw.voice : undefined,
  };
}

function toParams(search: string | URLSearchParams): URLSearchParams {
  return search instanceof URLSearchParams ? search : new URLSearchParams(search);
}

function readQuery(params: URLSearchParams): Record<ConfigKey, string | undefined> {
  const raw = {} as Record<ConfigKey, string | undefined>;
  for (const key of CONFIG_KEYS) {
    const value = params.get(key)?.trim();
    raw[key] = value ? value : undefined;
  }
  return raw;
}

function parseCurveballs(
  raw: string | undefined,
  difficulty: Difficulty,
  scenario: ConfigScenario,
): { setting: CurveballSetting; ignored: boolean } {
  if (raw === undefined) return { setting: { mode: 'default' }, ignored: false };
  if (raw.toLowerCase() === 'none') return { setting: { mode: 'none' }, ignored: false };
  const asked = [
    ...new Set(
      raw
        .split(',')
        .map((token) => token.trim())
        .filter(Boolean),
    ),
  ] as CurveballType[];
  const { kept } = fitCurveballs(asked, difficulty, scenario);
  if (kept.length === 0) return { setting: { mode: 'default' }, ignored: true };
  return { setting: { mode: 'choose', types: kept }, ignored: kept.length !== asked.length };
}

/**
 * Reads the configuration from a query string, and says which keys were present but could not be
 * used (not valid, not offered by this scenario, or more curveballs than the difficulty allows).
 */
export function inspectConfig(
  search: string | URLSearchParams,
  scenario: ConfigScenario,
): { config: CallConfig; ignored: ConfigKey[] } {
  const raw = readQuery(toParams(search));
  const parsed = parseConfigQuery(raw);
  const base = defaultConfig(scenario);
  const difficulty = parsed.difficulty ?? base.difficulty;
  const curveballs = parseCurveballs(raw.curveballs, difficulty, scenario);
  const explicitHints = parsed.hints === undefined ? null : parsed.hints === 'on';
  const config: CallConfig = {
    difficulty,
    impact: parsed.impact ?? base.impact,
    temperature: parsed.temperature ?? base.temperature,
    proficiency: parsed.proficiency ?? base.proficiency,
    style: parsed.style ?? base.style,
    stage: parsed.stage ?? base.stage,
    curveballs: curveballs.setting,
    // A value that says what the difficulty would say anyway is the same as no value.
    hints: explicitHints === hintsDefault(difficulty) ? null : explicitHints,
    voice:
      parsed.voice === undefined || parsed.voice === defaultVoiceFor(scenario.id)
        ? null
        : parsed.voice,
  };
  const ignored = CONFIG_KEYS.filter((key) => {
    if (raw[key] === undefined) return false;
    if (key === 'curveballs') return curveballs.ignored;
    return parsed[key] === undefined;
  });
  return { config, ignored };
}

/** The configuration in a query string. Anything missing or invalid takes the scenario's value. */
export function parseConfig(
  search: string | URLSearchParams,
  scenario: ConfigScenario,
): CallConfig {
  return inspectConfig(search, scenario).config;
}

/** The query parameters for a configuration, leaving out everything the scenario already says. */
export function serializeConfig(config: CallConfig, scenario: ConfigScenario): URLSearchParams {
  const base = defaultConfig(scenario);
  const params = new URLSearchParams();
  if (config.difficulty !== base.difficulty) params.set('difficulty', config.difficulty);
  if (config.impact !== base.impact) params.set('impact', config.impact);
  if (config.temperature !== base.temperature) params.set('temperature', config.temperature);
  if (config.proficiency !== base.proficiency) params.set('proficiency', config.proficiency);
  if (config.style !== base.style) params.set('style', config.style);
  if (config.stage !== base.stage) params.set('stage', config.stage);
  const { curveballs } = config;
  if (
    curveballs.mode === 'none' ||
    (curveballs.mode === 'choose' && curveballs.types.length === 0)
  ) {
    params.set('curveballs', 'none');
  } else if (curveballs.mode === 'choose') {
    params.set('curveballs', curveballs.types.join(','));
  }
  if (config.hints !== null && config.hints !== hintsDefault(config.difficulty)) {
    params.set('hints', config.hints ? 'on' : 'off');
  }
  if (config.voice !== null && config.voice !== defaultVoiceFor(scenario.id)) {
    params.set('voice', config.voice);
  }
  return params;
}

/** A query string with a leading `?` (empty when there are no parameters) and readable commas. */
export function toSearch(params: URLSearchParams): string {
  const text = params.toString().replace(/%2C/gi, ',');
  return text ? `?${text}` : '';
}

/** The call brief for a scenario with this configuration. */
export function briefPath(
  scenarioId: string,
  config: CallConfig,
  scenario: ConfigScenario,
): string {
  return `/scenarios/${encodeURIComponent(scenarioId)}/brief${toSearch(serializeConfig(config, scenario))}`;
}

/** The workspace with this scenario selected and this configuration chosen. */
export function editPath(scenarioId: string, config: CallConfig, scenario: ConfigScenario): string {
  const params = new URLSearchParams({ scenario: scenarioId });
  for (const [key, value] of serializeConfig(config, scenario)) params.set(key, value);
  return `/scenarios${toSearch(params)}`;
}

/**
 * The same, from a brief's own address: the configuration keys are carried over as they are, and
 * the workspace reads them against the scenario (so this works before the scenario has loaded).
 */
export function editPathFromSearch(scenarioId: string, search: string | URLSearchParams): string {
  const from = toParams(search);
  const params = new URLSearchParams({ scenario: scenarioId });
  for (const key of CONFIG_KEYS) {
    const value = from.get(key);
    if (value) params.set(key, value);
  }
  return `/scenarios${toSearch(params)}`;
}

// ---- What is sent to the server ----------------------------------------------------------

export interface CallSettings {
  /** Only what differs from the scenario as written; `{}` means "as authored". */
  overrides: ScenarioOverrides;
  /** `guided` when live hints are on, `immersive` otherwise. */
  mode: PracticeMode;
}

/** The exact `overrides` and `mode` for `POST /api/sessions`. */
export function toOverrides(config: CallConfig, scenario: ConfigScenario): CallSettings {
  const overrides: ScenarioOverrides = {};
  if (config.difficulty !== scenario.difficulty) overrides.difficulty = config.difficulty;
  if (config.impact !== scenario.impact) overrides.impact = config.impact;
  if (config.temperature !== scenario.startingTemperature) {
    overrides.startingTemperature = config.temperature;
  }
  if (config.proficiency !== scenario.proficiency) overrides.proficiency = config.proficiency;
  if (config.style !== scenario.style) overrides.style = config.style;
  if (config.stage !== scenario.callStage) overrides.callStage = config.stage;
  const { curveballs } = config;
  if (curveballs.mode === 'none') overrides.curveballs = [];
  else if (curveballs.mode === 'choose') {
    overrides.curveballs = fitCurveballs(curveballs.types, config.difficulty, scenario).kept;
  }
  return { overrides, mode: hintsOn(config) ? 'guided' : 'immersive' };
}

// ---- What differs from the scenario ------------------------------------------------------

/** The controls that are not at the scenario's own setting, in the order the page shows them. */
export function changedFromDefault(config: CallConfig, scenario: ConfigScenario): ConfigKey[] {
  const base = defaultConfig(scenario);
  const changed: ConfigKey[] = [];
  if (config.difficulty !== base.difficulty) changed.push('difficulty');
  if (config.impact !== base.impact) changed.push('impact');
  if (config.temperature !== base.temperature) changed.push('temperature');
  if (config.proficiency !== base.proficiency) changed.push('proficiency');
  if (config.style !== base.style) changed.push('style');
  if (config.stage !== base.stage) changed.push('stage');
  if (config.curveballs.mode !== 'default') changed.push('curveballs');
  if (config.hints !== null && config.hints !== hintsDefault(config.difficulty)) {
    changed.push('hints');
  }
  if (config.voice !== null && config.voice !== defaultVoiceFor(scenario.id)) {
    changed.push('voice');
  }
  return changed;
}

/** The same configuration with another difficulty: chosen curveballs are trimmed to what it allows. */
export function withDifficulty(
  config: CallConfig,
  difficulty: Difficulty,
  scenario: ConfigScenario,
): { config: CallConfig; dropped: CurveballType[] } {
  const next: CallConfig = { ...config, difficulty };
  let dropped: CurveballType[] = [];
  if (config.curveballs.mode === 'choose') {
    const fit = fitCurveballs(config.curveballs.types, difficulty, scenario);
    dropped = fit.dropped;
    next.curveballs = { mode: 'choose', types: fit.kept };
  }
  return { config: next, dropped };
}
