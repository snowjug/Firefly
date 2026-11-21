import type { WorldPose } from '../world/world-store.ts';
import type { CoreParams } from './core-params.ts';

// The field behind the calibration page answers the settings: a call with more riding on it, a less
// settled customer or a surprise in store makes the room a little tighter and warmer; a gentle,
// settled call keeps it open and cool. It stays well inside the range of a call in progress (a
// form is a quiet page), and it is a pure function of the same numbers the core is drawn from.

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const round = (value: number) => Math.round(value * 1000) / 1000;

/** How the room should look for these core parameters. Every number is within 0 to 1. */
export function worldPoseFor(
  params: CoreParams,
): Pick<WorldPose, 'tension' | 'open' | 'warmth' | 'energy'> {
  const unsettled = 1 - params.stability;
  return {
    tension: round(
      clamp01(0.08 + 0.34 * params.pressure + 0.18 * params.disturbance + 0.1 * unsettled),
    ),
    open: round(clamp01(0.45 + 0.55 * params.stability)),
    warmth: round(clamp01(0.4 + 0.4 * unsettled + 0.08 * params.pressure)),
    energy: round(clamp01(0.18 + 0.16 * params.rhythm + 0.1 * params.disturbance)),
  };
}
