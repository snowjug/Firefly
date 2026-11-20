import { num } from './geometry.ts';
import type { Pose } from './poses.ts';
import { ringPath } from './rings.ts';

// What the presence draws for a pose at a size: three rings, the edge's dash pattern, and the
// sizes of the small parts. Pure numbers and strings, so it can be tested without a browser.

export type Detail = 'full' | 'medium' | 'small';

export const PRESENCE_BOX = 200;
export const PRESENCE_HALF = PRESENCE_BOX / 2;
/** Where the bezel's ticks start, and the track the dormant dots sit on. */
export const BEZEL_RADIUS = 96;
export const ORBIT_RADIUS = 80;

/** Smaller presences get fewer teeth and ticks, and heavier lines: legibility over detail. */
export const detailFor = (size: number): Detail =>
  size >= 160 ? 'full' : size >= 96 ? 'medium' : 'small';

const TEETH: Record<Detail, readonly [number, number, number]> = {
  full: [44, 30, 22],
  medium: [34, 24, 18],
  small: [24, 18, 14],
};

export interface PresenceShape {
  edge: string;
  ring2: string;
  ring3: string;
  dasharray: string;
  round: boolean;
  /** Line widths in units: the edge, the inner rings, the bezel. */
  width: { edge: number; inner: number; bezel: number };
  /** Radii of the heart's parts and of a dormant dot, in units. */
  heart: { halo: number; dot: number; pip: number };
  dot: number;
}

export function presenceShape(pose: Pose, size: number): PresenceShape {
  const safe = Number.isFinite(size) && size > 0 ? size : 240;
  const detail = detailFor(safe);
  const pxPerUnit = safe / PRESENCE_BOX;
  const units = (pixels: number) => pixels / pxPerUnit;
  const [edgeTeeth, midTeeth, innerTeeth] = TEETH[detail];

  const edge = ringPath(
    { radius: 62 * pose.scale, weight: 1, teeth: edgeTeeth, phase: 0, fragments: true },
    pose,
  );
  const ring2 = ringPath(
    { radius: 46 * pose.scale, weight: 0.45, teeth: midTeeth, phase: 0.7, fragments: false },
    pose,
  );
  const ring3 = ringPath(
    { radius: 30 * pose.scale, weight: 0.28, teeth: innerTeeth, phase: 1.9, fragments: false },
    pose,
  );

  // The dash pattern stretches when the presence is small, so dashes stay visible.
  const stretch = Math.min(3.5, Math.max(1, 0.9 / pxPerUnit));
  const dash1 = Math.exp(pose.ld1) * stretch;
  const dash2 = Math.exp(pose.ld2) * stretch;
  return {
    edge,
    ring2,
    ring3,
    dasharray: `${num(dash1)} ${num(pose.g1 * stretch)} ${num(dash2)} ${num(pose.g2 * stretch)}`,
    round: Math.exp(pose.ld1) < 2.2,
    width: {
      edge: units(Math.max(pose.lw, 1.15)),
      inner: units(1),
      bezel: units(0.9),
    },
    heart: {
      halo: Math.max(9.5, units(6)),
      dot: Math.max(3.6, units(2.6)),
      pip: Math.max(1.4, units(1.2)),
    },
    dot: Math.max(2.5, units(2.3)),
  };
}
