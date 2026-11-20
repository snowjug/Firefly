import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import {
  CALL_STAGE_LABELS,
  IMPACT_LABELS,
  type CallStage,
  type StartTemperature,
} from '#shared/domain/vocab.ts';
import type { CoreParams } from '../atlas/core-params.ts';
import { TICK_COUNT, clampMinutes } from './geometry.ts';
import {
  BAND_SEGMENTS,
  DENSITY_WORDS,
  densityOf,
  difficultyOf,
  impactOf,
  litSegments,
  ringsOf,
  startOf,
} from './poses.ts';
import type { CoreTraits, GlyphStatus, GlyphTraits } from './types.ts';

// Plain English for the instrument, from the same inputs that draw it, so what a screen reader is
// told can never differ from what is shown. Only public settings are named: nothing about hidden
// details, and never how many of them there are.

export const EDGE_WORDS: Record<StartTemperature, string> = {
  calm: 'a smooth edge',
  anxious: 'round dashes',
  frustrated: 'long and short dashes',
  angry: 'a serrated edge',
};

export const SHAPE_WORDS: Record<CallStage, string> = {
  'first-contact': 'circle',
  'follow-up': 'diamond',
  escalated: 'triangle',
  closure: 'square',
};

/** The call stages in the short words the legend uses. */
export const STAGE_WORDS: Record<CallStage, string> = {
  'first-contact': 'first contact',
  'follow-up': 'follow-up',
  escalated: 'escalated',
  closure: 'closure',
};

export const FILL_WORDS: Record<GlyphStatus, string> = {
  new: 'open',
  attempted: 'half filled',
  completed: 'filled',
};

const STANDING: Record<GlyphStatus, string> = {
  new: 'Not tried yet.',
  attempted: 'Started, not completed yet.',
  completed: 'Completed.',
};

const minutesPhrase = (minutes: number): string => {
  const whole = Math.max(1, Math.round(Number.isFinite(minutes) ? minutes : 1));
  return whole === 1 ? 'About 1 minute.' : `About ${whole} minutes.`;
};

/** "Standard difficulty, medium impact. The customer starts frustrated. First contact. ..." */
export function describeGlyph(traits: GlyphTraits): string {
  const difficulty = DIFFICULTY_PROFILES[traits.difficulty]?.label ?? traits.difficulty;
  const impact = (IMPACT_LABELS[traits.impact]?.label ?? traits.impact).toLowerCase();
  const stage = CALL_STAGE_LABELS[traits.stage]?.label ?? traits.stage;
  const parts = [
    `${difficulty} difficulty, ${impact} impact.`,
    `The customer starts ${traits.start}.`,
    `${stage}.`,
    STANDING[traits.status] ?? STANDING.new,
    minutesPhrase(traits.minutes),
  ];
  if (traits.recommended) parts.push('Suggested next.');
  return parts.join(' ');
}

export interface CorePart {
  letter: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  name: string;
  value: string;
}

/** What the core reads from the traits: the other three channels come from the parameters. */
export type CoreFacts = Pick<CoreTraits, 'stage' | 'status' | 'minutes'>;

/**
 * The six lettered parts of the core and what each shows now. The pressure, the starting
 * temperature and the difficulty are read from the parameters (the instrument's own source), the
 * stage, the fill and the minutes from the traits. Signal density is a word, never a count.
 */
export function describeCoreParts(traits: CoreFacts, params: CoreParams): CorePart[] {
  const impact = impactOf(params.pressure);
  const start = startOf(params.stability);
  const difficulty = difficultyOf(params.complexity);
  const rings = ringsOf(params.complexity);
  return [
    {
      letter: 'A',
      name: 'Minute ticks',
      value: `${clampMinutes(traits.minutes)} of ${TICK_COUNT} engraved`,
    },
    {
      letter: 'B',
      name: 'Pressure band',
      value: `${impact}, ${litSegments(params.pressure)} of ${BAND_SEGMENTS} lit`,
    },
    {
      letter: 'C',
      name: 'Heart',
      value: `${SHAPE_WORDS[traits.stage] ?? 'circle'}, ${STAGE_WORDS[traits.stage] ?? traits.stage}, ${FILL_WORDS[traits.status] ?? 'open'}`,
    },
    { letter: 'D', name: 'Edge and needle', value: `${start}, ${EDGE_WORDS[start]}` },
    { letter: 'E', name: 'Rings', value: `${difficulty}, ${rings} ring${rings === 1 ? '' : 's'}` },
    {
      letter: 'F',
      name: 'Signal density',
      value: `${DENSITY_WORDS[densityOf(params.complexity)].toLowerCase()}, still hidden`,
    },
  ];
}

/** One description of the whole core, for assistive technology. */
export function describeCore(traits: CoreFacts, params: CoreParams): string {
  const parts = describeCoreParts(traits, params);
  return `Scenario core. ${parts.map((part) => `${part.name}: ${part.value}.`).join(' ')}`;
}
