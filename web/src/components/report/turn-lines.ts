import type { TurnDTO } from '#shared/domain/api.ts';
import type { JourneyPoint } from '#shared/domain/report.ts';
import { buildMoments, type BandInfo, type Moment } from './timeline-model.ts';

// What the filament in the evidence lens is drawn from, turn by turn. The call chamber draws a
// turn's stretch from the customer's mood at that moment; afterwards the report knows that mood
// for every point of the call, so the transcript can draw the same line with the same shapes.

export interface TurnLine {
  /** The customer's mood this stretch is drawn from, or null where the report recorded none. */
  band: BandInfo | null;
  /** The customer was easing back from a tense state. */
  easing: boolean;
  /** A curveball landed in this turn: the line takes a sharp jog. */
  kink: boolean;
  /** A hidden fact came out in this turn: a star on the line. */
  signal: boolean;
}

/** The last recorded moment at or before a turn, or null before the first one. */
function knownAt(moments: readonly Moment[], turn: number): Moment | null {
  let found: Moment | null = null;
  for (const moment of moments) {
    if (moment.turn > turn) break;
    found = moment;
  }
  return found;
}

/**
 * The line for every turn. A customer's turn takes the mood after what was said just before it,
 * and a trainee's turn the mood it was said into (the customer's reply before it), as in the
 * chamber. A turn from before the report recorded anything is plain and straight, which says
 * nothing rather than something untrue.
 */
export function turnLines(
  points: readonly JourneyPoint[],
  turns: readonly TurnDTO[],
  curveballTurn: number | null = null,
): TurnLine[] {
  const moments = buildMoments(points);
  return turns.map((turn) => {
    const reference = Math.max(1, turn.role === 'customer' ? turn.index - 1 : turn.index - 2);
    const moment = knownAt(moments, reference);
    const markers = turn.markers ?? [];
    return {
      band: moment?.band ?? null,
      easing: moment?.direction === 'eased',
      kink: markers.some((marker) => marker.kind === 'curveball') || curveballTurn === turn.index,
      signal: markers.some((marker) => marker.kind === 'discovery'),
    };
  });
}
