import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import {
  DIFFICULTIES,
  type BusinessImpact,
  type CallStage,
  type CommunicationStyle,
  type Difficulty,
  type Proficiency,
  type StartTemperature,
} from '#shared/domain/vocab.ts';
import {
  DIFFICULTY_TAGLINES,
  curveballsOn,
  type SettingKey,
  type SetupChoices,
} from '../scenario/setup-model.ts';

// The numbers behind the "scenario core": the object on the calibration screen that visibly
// changes as the scenario settings change. Every parameter is a number from 0 to 1, taken from the
// settings alone (the same `SetupChoices` the practice page uses), so what the core shows is what
// the call will be like and never anything that is not already a visible setting.

/**
 * Each is 0..1 and follows one setting, except disturbance, which follows the difficulty and the
 * curveball switch.
 */
export interface CoreParams {
  /** How much is riding on the call: business impact. */
  pressure: number;
  /** How settled the customer is: the starting temperature, inverted (calm is steady). */
  stability: number;
  /** How much technical information the field carries: the customer's proficiency. */
  density: number;
  /** How the conversation flows: the customer's communication style. */
  rhythm: number;
  /** How much history the customer brings: the call stage. */
  horizon: number;
  /** How much there is to untangle: the difficulty. */
  complexity: number;
  /** How likely a surprise is: nothing when curveballs are off, more with difficulty when on. */
  disturbance: number;
}

export const CORE_KEYS = [
  'pressure',
  'stability',
  'density',
  'rhythm',
  'horizon',
  'complexity',
  'disturbance',
] as const satisfies readonly (keyof CoreParams)[];

/** What a setting that has no value of its own falls back to: the middle, so nothing breaks. */
const NEUTRAL = 0.5;

const PRESSURE: Record<BusinessImpact, number> = { low: 0.2, medium: 0.55, high: 0.9 };
const STABILITY: Record<StartTemperature, number> = {
  calm: 0.9,
  anxious: 0.65,
  frustrated: 0.4,
  angry: 0.18,
};
const DENSITY: Record<Proficiency, number> = { novice: 0.3, intermediate: 0.6, expert: 0.9 };
// Style is not a scale, so these are how fast and full the conversation feels, not how good it is.
const RHYTHM: Record<CommunicationStyle, number> = {
  talkative: 0.8,
  terse: 0.25,
  demanding: 0.65,
  vague: 0.45,
  'non-native': 0.5,
};
const HORIZON: Record<CallStage, number> = {
  'first-contact': 0.2,
  'follow-up': 0.5,
  escalated: 0.8,
  closure: 0.95,
};
// These follow the strictness of DIFFICULTY_PROFILES (a test keeps them in step with it).
const COMPLEXITY: Record<Difficulty, number> = { starter: 0.25, standard: 0.55, challenge: 0.9 };
const DISTURBANCE: Record<Difficulty, number> = { starter: 0.25, standard: 0.45, challenge: 0.7 };

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function lookup<K extends string>(table: Record<K, number>, key: K): number {
  const value: number | undefined = table[key];
  return value === undefined || !Number.isFinite(value) ? NEUTRAL : clamp01(value);
}

/** The core for a set of choices. A value that is not a known option reads as the middle. */
export function coreParams(config: SetupChoices): CoreParams {
  return {
    pressure: lookup(PRESSURE, config.impact),
    stability: lookup(STABILITY, config.startingTemperature),
    density: lookup(DENSITY, config.proficiency),
    rhythm: lookup(RHYTHM, config.style),
    horizon: lookup(HORIZON, config.callStage),
    complexity: lookup(COMPLEXITY, config.difficulty),
    disturbance: curveballsOn(config) ? lookup(DISTURBANCE, config.difficulty) : 0,
  };
}

/**
 * A point between two cores, so a change of preset can glide instead of jump. `t` is clamped to
 * 0..1; 0 gives exactly `a` and 1 exactly `b`, and every parameter stays between its two ends
 * (even where rounding would let the blend drift a hair past one of them).
 */
export function interpolate(a: CoreParams, b: CoreParams, t: number): CoreParams {
  const k = Number.isFinite(t) ? clamp01(t) : 0;
  const blend = (key: keyof CoreParams) => {
    const from = a[key];
    const to = b[key];
    const value = from * (1 - k) + to * k;
    return clamp01(Math.min(Math.max(from, to), Math.max(Math.min(from, to), value)));
  };
  return {
    pressure: blend('pressure'),
    stability: blend('stability'),
    density: blend('density'),
    rhythm: blend('rhythm'),
    horizon: blend('horizon'),
    complexity: blend('complexity'),
    disturbance: blend('disturbance'),
  };
}

// ------------------------------------------------------------------------------------------
// Words

/** The settings that drive the core, in the order the practice page shows them. */
export const CORE_SETTINGS = [
  'difficulty',
  'impact',
  'startingTemperature',
  'proficiency',
  'style',
  'callStage',
  'curveballs',
] as const satisfies readonly (SettingKey | 'curveballs')[];
export type CoreSetting = (typeof CORE_SETTINGS)[number];

/**
 * What each option changes about the call, in plain words. They describe the customer and the
 * situation only: nothing about hidden details, and nothing about how a call is scored or how to
 * do well, so they are as safe to show before a call as the settings themselves.
 */
export const OPTION_EXPLANATIONS: {
  [K in SettingKey]: Record<SetupChoices[K], string>;
} & { curveballs: Record<'on' | 'off', string> } = {
  impact: {
    low: 'Lower pressure: few people are affected and there is time to work through it.',
    medium: 'Moderate pressure: a team is held up and the customer expects regular updates.',
    high: 'Higher pressure: the customer expects quick progress and will notice delays.',
  },
  startingTemperature: {
    calm: 'A steadier start: the customer is cooperative and patient.',
    anxious:
      'A more cautious start: the customer is worried about consequences and welcomes reassurance.',
    frustrated: 'A tenser start: the customer is short on patience and expects to see progress.',
    angry:
      'The least settled start: the customer is upset, may escalate quickly and needs to feel heard.',
  },
  proficiency: {
    novice:
      'Less technical detail: the customer uses everyday words, so unexplained jargon can cause confusion.',
    intermediate:
      'A balanced amount of technical detail: the customer knows common terms and basic troubleshooting.',
    expert: 'More technical detail: the customer uses specialist terms and expects you to keep up.',
  },
  style: {
    talkative: 'A fuller conversation: long answers with plenty of context, and the odd tangent.',
    terse: 'A sparser conversation: short answers that share only what is asked.',
    demanding: 'A more direct conversation: the customer asks for commitments and timelines.',
    vague: 'A less defined conversation: the customer starts out imprecise.',
    'non-native': 'A measured conversation: simple vocabulary and an even pace.',
  },
  callStage: {
    'first-contact': 'A fresh start: the customer is explaining the issue for the first time.',
    'follow-up': 'Some history: an open case where the customer expects to see progress.',
    escalated:
      'A long history: earlier contacts have not resolved it, so trust is already strained.',
    closure: 'A wrap-up: the customer expects the case to be summarised and confirmed.',
  },
  difficulty: {
    starter:
      'A gentler call: clearer clues, a more cooperative customer and at most one optional curveball.',
    standard: 'A balanced call: moderate ambiguity, and one curveball is possible.',
    challenge:
      'A more demanding call: less is offered up front, trust and patience are tighter, and up to two curveballs may come up.',
  },
  curveballs: {
    on: 'Surprises are possible: the customer may do something unexpected during the call. You will not be told when.',
    off: 'No curveballs: the conversation follows its own course, without sudden changes.',
  },
};

/** The option a setting currently holds, as the key used in `OPTION_EXPLANATIONS`. */
function optionOf(choices: SetupChoices, setting: CoreSetting): string {
  return setting === 'curveballs' ? (curveballsOn(choices) ? 'on' : 'off') : choices[setting];
}

/** What the option chosen for one setting changes. For the hint under each control. */
export function explanationFor(choices: SetupChoices, setting: CoreSetting): string {
  const table: Record<string, string> = OPTION_EXPLANATIONS[setting];
  return table[optionOf(choices, setting)] ?? '';
}

/** How a parameter moving up or down reads, to follow "The call now has". */
const SHIFTS: Record<keyof CoreParams, { up: string; down: string }> = {
  pressure: { up: 'more pressure', down: 'less pressure' },
  stability: { up: 'a steadier customer', down: 'a less settled customer' },
  density: { up: 'more technical detail', down: 'less technical detail' },
  rhythm: { up: 'a quicker, fuller conversation', down: 'a slower, sparser conversation' },
  horizon: { up: 'more history behind it', down: 'less history behind it' },
  complexity: { up: 'more to untangle', down: 'less to untangle' },
  disturbance: { up: 'more chance of surprises', down: 'fewer surprises' },
};

/** Moves smaller than this are not worth a mention. */
const NOTICEABLE = 0.05;

/** "a", "a and b", "a, b and c": spelled out, so the wording never depends on locale data. */
function joinWords(words: readonly string[]): string {
  if (words.length <= 2) return words.join(' and ');
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

/**
 * One short sentence about what a change did. A single setting gets its own explanation; several
 * at once (a preset, or a difficulty that also switches curveballs) get a summary of how the call
 * itself moved. Nothing changed, nothing to explain.
 */
export function explainChange(before: SetupChoices, after: SetupChoices): string {
  const changed = CORE_SETTINGS.filter((s) => optionOf(before, s) !== optionOf(after, s));
  const [only] = changed;
  if (changed.length === 0) return 'Nothing has changed.';
  if (changed.length === 1 && only) return explanationFor(after, only);

  const from = coreParams(before);
  const to = coreParams(after);
  const moves = CORE_KEYS.flatMap((key) => {
    const delta = to[key] - from[key];
    return Math.abs(delta) < NOTICEABLE ? [] : [SHIFTS[key][delta > 0 ? 'up' : 'down']];
  });
  return moves.length > 0
    ? `The call now has ${joinWords(moves)}.`
    : 'The call has shifted slightly.';
}

// ------------------------------------------------------------------------------------------
// Presets

/** One of the practice page's Quick start cards, which set only the difficulty. */
export interface CorePreset {
  id: Difficulty;
  label: string;
  tagline: string;
  /** Apply it with the page's own difficulty update, which also trims curveballs to fit. */
  patch: Pick<SetupChoices, 'difficulty'>;
}

export const PRESETS: readonly CorePreset[] = DIFFICULTIES.map((difficulty) => ({
  id: difficulty,
  label: DIFFICULTY_PROFILES[difficulty].label,
  tagline: DIFFICULTY_TAGLINES[difficulty],
  patch: { difficulty },
}));

/** Where the core ends up if the preset is chosen from these choices: the target to glide to. */
export function presetParams(choices: SetupChoices, preset: CorePreset): CoreParams {
  return coreParams({ ...choices, ...preset.patch });
}
