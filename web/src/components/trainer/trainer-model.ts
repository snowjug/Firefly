import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import {
  CALL_STAGE_LABELS,
  CURVEBALL_LABELS,
  IMPACT_LABELS,
  START_TEMPERATURE_LABELS,
  STYLE_LABELS,
  type Difficulty,
} from '#shared/domain/vocab.ts';
import type { GlyphTraits } from './bridge.tsx';

export interface Highlight {
  title: string;
  text: string;
}

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

const joinList = (items: string[]) =>
  items.length <= 1
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/** The scenario's public settings in plain words, in the order they read best. */
export function scenarioFacts(scenario: PublicScenarioDTO): string[] {
  return [
    DIFFICULTY_PROFILES[scenario.difficulty].label,
    `${IMPACT_LABELS[scenario.impact].label} impact`,
    START_TEMPERATURE_LABELS[scenario.startingTemperature].label,
    STYLE_LABELS[scenario.style].label,
    CALL_STAGE_LABELS[scenario.callStage].label,
  ];
}

/**
 * The scenario as the instrument draws it. The call it stands for has not been made, so its heart
 * is open; the difficulty can be the one chosen for the call rather than the scenario's own, which
 * is how the rings answer the choice.
 */
export function scenarioTraits(
  scenario: PublicScenarioDTO,
  difficulty: Difficulty = scenario.difficulty,
): GlyphTraits {
  return {
    difficulty,
    impact: scenario.impact,
    start: scenario.startingTemperature,
    stage: scenario.callStage,
    status: 'new',
    minutes: scenario.estimatedMinutes,
  };
}

/** What the spotlight scenario shows, worded only from its public fields and the difficulty presets. */
export function spotlightHighlights(scenario: PublicScenarioDTO): Highlight[] {
  const profile = DIFFICULTY_PROFILES[scenario.difficulty];
  const areas = scenario.expectedDiscoveryAreas;
  const kinds = scenario.curveballOptions.map((type) => CURVEBALL_LABELS[type].label);
  const examples = joinList(kinds.slice(0, 2).map((kind) => `\u201c${kind}\u201d`));
  const byDefault = profile.defaultCurveballCount;

  return [
    {
      title: 'Configurable',
      text: `Starts at ${profile.label} difficulty with ${IMPACT_LABELS[scenario.impact].label.toLowerCase()} business impact and a ${START_TEMPERATURE_LABELS[scenario.startingTemperature].label.toLowerCase()} customer. Every setting can be changed before the call.`,
    },
    {
      title: 'Hidden facts',
      // Never how many there are: the page does not know, and the call does not say, until the report.
      text:
        areas.length > 0
          ? `Some areas hold details the customer shares only when asked, for example ${lowerFirst(areas[0] as string)}.`
          : 'The customer holds some details back until you ask about them.',
    },
    {
      title: 'A curveball',
      text:
        byDefault === 0
          ? `${profile.label} difficulty starts with no curveball. You can switch one on in setup, from ${kinds.length} kinds such as ${examples}.`
          : `${profile.label} difficulty switches on up to ${byDefault === 1 ? 'one curveball' : `${byDefault} curveballs`} by default: an unexpected turn partway through the call. Setup offers ${kinds.length} kinds, such as ${examples}.`,
    },
    {
      title: 'Evidence in the report',
      text: 'The customer\u2019s mood moves with what you say. The report quotes your own words, shows the temperature timeline and suggests alternative phrasing.',
    },
  ];
}
