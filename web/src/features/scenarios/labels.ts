import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import {
  CURVEBALL_TYPES,
  IMPACT_LABELS,
  START_TEMPERATURE_LABELS,
  type BusinessImpact,
  type CallStage,
  type CurveballType,
  type Difficulty,
  type StartTemperature,
} from '#shared/domain/vocab.ts';

// Small, pure helpers for wording. Every label comes from the shared vocabulary; this file only
// joins them into phrases. It imports nothing from the interface, so the logic modules stay pure.

/** The customer states the design system draws. A starting temperature is one of these four. */
export type StartState = 'calm' | 'concerned' | 'frustrated' | 'angry';

/** "Anxious" has no shape of its own: it is drawn as the amber "concerned" state. */
export const START_STATE: Record<StartTemperature, StartState> = {
  calm: 'calm',
  anxious: 'concerned',
  frustrated: 'frustrated',
  angry: 'angry',
};

/** "frustrated", "angry": the first word of the label, for use inside a sentence. */
export function temperatureWord(temperature: StartTemperature): string {
  const label = START_TEMPERATURE_LABELS[temperature].label;
  return (label.split('/')[0] ?? label).trim().toLowerCase();
}

/** "Starts frustrated". */
export function startsLabel(temperature: StartTemperature): string {
  return `Starts ${temperatureWord(temperature)}`;
}

/** "High impact". */
export function impactLabel(impact: BusinessImpact): string {
  return `${IMPACT_LABELS[impact].label} impact`;
}

export function difficultyLabel(difficulty: Difficulty): string {
  return DIFFICULTY_PROFILES[difficulty].label;
}

/** "About 12 min" in a list row, "About 12 minutes" in a sentence. */
export function minutesLabel(minutes: number, long = false): string {
  return `About ${minutes} ${long ? (minutes === 1 ? 'minute' : 'minutes') : 'min'}`;
}

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four'];

export function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

/** "one complication", "two complications". */
export function complicationCount(n: number): string {
  return `${numberWord(n)} ${n === 1 ? 'complication' : 'complications'}`;
}

/**
 * The curveballs a scenario offers, in the order the vocabulary lists them. A server that does not
 * send the list yet offers none to choose from (the difficulty's own default still applies).
 */
export function curveballChoices(scenario: {
  curveballOptions?: readonly CurveballType[];
}): CurveballType[] {
  const offered = scenario.curveballOptions ?? [];
  return CURVEBALL_TYPES.filter((type) => offered.includes(type));
}

/**
 * What the trainee is told about the case, as paragraphs: the scenario's situation, then the note
 * for the chosen call stage (which is empty for some first contacts). A server that does not send
 * the stage notes yet gives just the situation.
 */
export function situationParagraphs(
  scenario: {
    brief: Pick<PublicScenarioDTO['brief'], 'situation'>;
    stageBriefs?: Partial<Record<CallStage, string>>;
  },
  stage: CallStage,
): string[] {
  return [scenario.brief.situation, scenario.stageBriefs?.[stage]]
    .map((text) => text?.trim() ?? '')
    .filter(Boolean);
}
