import type { TurnMarker } from '#shared/domain/api.ts';

export type MarkerTone = 'eased' | 'rose' | 'mood' | 'discovery' | 'curveball';
/** The mark drawn beside a marker's words, so its meaning never rests on colour. */
export type MarkerShape = 'star' | 'triangle' | 'down' | 'up' | 'dot';

/**
 * Words, a shape and a tone for an analysis marker on a turn. The words always carry the meaning:
 * a four-point star for a hidden fact, a triangle for a curveball, an arrow for the customer's mood
 * moving, a dot when it did not.
 */
export function describeMarker(marker: TurnMarker): {
  shape: MarkerShape;
  text: string;
  tone: MarkerTone;
} {
  const label = marker.label.trim();
  if (marker.kind === 'discovery') {
    const match = /^(partly\s+)?uncovered:\s*(.*)$/i.exec(label);
    const text = match
      ? `${match[1] ? 'Partly discovered' : 'Discovered'}: ${match[2]}`
      : `Discovery: ${label}`;
    return { shape: 'star', text, tone: 'discovery' };
  }
  if (marker.kind === 'curveball') {
    return {
      shape: 'triangle',
      text: /^curveball/i.test(label) ? label : `Curveball: ${label}`,
      tone: 'curveball',
    };
  }
  if (marker.delta !== undefined && marker.delta < 0) {
    return { shape: 'down', text: `Customer mood eased: ${label}`, tone: 'eased' };
  }
  if (marker.delta !== undefined && marker.delta > 0) {
    return { shape: 'up', text: `Customer mood rose: ${label}`, tone: 'rose' };
  }
  return { shape: 'dot', text: `Customer mood: ${label}`, tone: 'mood' };
}
