import { sampleSizeBand, type SampleSize } from '#shared/domain/calibration.ts';
import { plural } from '../../lib/format.ts';

// Plain-language readings of calibration figures. Direction is only described when enough
// mentor-reviewed sessions support it, so a handful of reviews never reads as a pattern.

/** The fewest reviewed sessions before the page describes a lean in the AI's scoring. */
export const MIN_SESSIONS_FOR_PATTERN = 5;
/** Average difference (in score points) below which the AI shows no consistent lean. */
const NO_LEAN_BELOW = 0.25;
/** Average difference from which the AI is said to "tend to" score higher or lower. */
const CLEAR_LEAN_FROM = 0.5;

export type BiasKind = 'too-few' | 'none' | 'slight' | 'clear';

export interface BiasReading {
  kind: BiasKind;
  /** Which way the AI leans relative to mentors; null unless a lean is described. */
  direction: 'higher' | 'lower' | null;
}

/** `bias` is the mean of (AI score - mentor score); `reviews` is how many reviews it rests on. */
export function readBias(bias: number, reviews: number): BiasReading {
  if (reviews < MIN_SESSIONS_FOR_PATTERN) return { kind: 'too-few', direction: null };
  const size = Math.abs(bias);
  if (size < NO_LEAN_BELOW) return { kind: 'none', direction: null };
  return {
    kind: size >= CLEAR_LEAN_FROM ? 'clear' : 'slight',
    direction: bias > 0 ? 'higher' : 'lower',
  };
}

/** A signed one-decimal figure with a true minus sign, e.g. "+0.6", "\u22120.4" or "0". */
export function signed(value: number, places = 1): string {
  const rounded = Number(value.toFixed(places));
  if (rounded === 0) return '0';
  return `${rounded > 0 ? '+' : '\u2212'}${Math.abs(rounded).toFixed(places)}`;
}

/** Short wording for a table cell. */
export function biasLabel(reading: BiasReading, bias: number): string {
  switch (reading.kind) {
    case 'too-few':
      return 'Too few reviews to say';
    case 'none':
      return 'No consistent bias';
    case 'slight':
      return `Slightly ${reading.direction} (${signed(bias)})`;
    case 'clear':
      return `AI tends to score ${reading.direction} (${signed(bias)})`;
  }
}

/** A full sentence about the overall lean. */
export function overallBiasSentence(reading: BiasReading, bias: number): string {
  switch (reading.kind) {
    case 'too-few':
      return `Fewer than ${MIN_SESSIONS_FOR_PATTERN} reviewed sessions, so no pattern is described yet.`;
    case 'none':
      return 'The AI does not lean towards scoring higher or lower than mentors.';
    case 'slight':
    case 'clear':
      return `On average the AI scores ${Math.abs(bias).toFixed(1)} points ${reading.direction} than mentors.`;
  }
}

/** How one AI and mentor score compare, from the AI's side. */
export function differenceText(ai: number, mentor: number): string {
  const difference = ai - mentor;
  if (difference === 0) return 'Same score';
  const size = Math.abs(difference);
  return `AI ${size} ${size === 1 ? 'point' : 'points'} ${difference > 0 ? 'higher' : 'lower'}`;
}

export interface SampleSizeMessage {
  band: SampleSize;
  text: string;
}

/** The headline about how much the figures rest on. */
export function sampleSizeMessage(sessions: number): SampleSizeMessage {
  const band = sampleSizeBand(sessions);
  switch (band) {
    case 'none':
      return { band, text: 'No mentor-reviewed sessions yet' };
    case 'very-small':
      return { band, text: `Based on ${plural(sessions, 'session')}: too few to draw conclusions` };
    case 'small':
      return { band, text: `Based on ${plural(sessions, 'session')}: indicative only` };
    case 'moderate':
      return { band, text: `Based on ${plural(sessions, 'session')}` };
  }
}
