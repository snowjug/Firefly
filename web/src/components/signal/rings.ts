import { TAU, TOP, num, pt } from './geometry.ts';
import type { Pose } from './poses.ts';

// The rings of the presence and the core: closed lines that are uneven, serrated or broken up as
// the customer's state gets tighter. They are drawn as polylines on a fixed angular grid (four
// points to a tooth) so the teeth stay crisp and a path only changes while the pose is moving.

const FRAGMENTS = 7;
/** Each fragment of a broken edge sits a little in or out of line, by these shares. */
const OFFSETS = [0.9, -0.6, 0.4, -1, 0.7, -0.3, 0.8] as const;
/** How much the fragments of an edge slip radially, at full fragmentation, in units. */
const SLIP = 5.5;

export interface RingSpec {
  radius: number;
  /** How much of the pose's unevenness the ring takes: 1 for the edge, less for those inside. */
  weight: number;
  /** Teeth round the ring when serrated; four points are drawn for each. */
  teeth: number;
  /** Shifts the unevenness round the ring so the rings do not move in unison. */
  phase: number;
  /** Only the edge breaks into fragments. */
  fragments: boolean;
}

type RingPose = Pick<Pose, 'amp' | 'wob' | 'zig' | 'frag'>;

/** A triangle wave with `teeth` periods round the circle, from -1 to 1. */
function tooth(angle: number, teeth: number): number {
  const u = ((angle / TAU) * teeth) % 1;
  const w = u < 0 ? u + 1 : u;
  return w < 0.5 ? 4 * w - 1 : 3 - 4 * w;
}

/** How far the line is from a true circle at an angle: slow lobes, finer ones, and the teeth. */
function unevenness(angle: number, pose: RingPose, spec: RingSpec): number {
  const amp = pose.amp * spec.weight;
  const lobes =
    0.62 * Math.sin(5 * angle + 1.3 + spec.phase) +
    0.38 * Math.sin(11 * angle + 0.4 + spec.phase * 2) * pose.wob;
  return amp * lobes + pose.zig * amp * 0.85 * tooth(angle, spec.teeth);
}

/** The path of one ring for a pose. */
export function ringPath(spec: RingSpec, pose: RingPose): string {
  const points = spec.teeth * 4;
  const frag = spec.fragments ? pose.frag : 0;
  let d = '';
  if (frag < 0.015) {
    for (let i = 0; i < points; i += 1) {
      const angle = TOP + (i / points) * TAU;
      d += `${i === 0 ? 'M' : 'L'}${pt(spec.radius + unevenness(angle, pose, spec), angle)}`;
    }
    return `${d}Z`;
  }
  const gap = frag * 0.2;
  for (let s = 0; s < FRAGMENTS; s += 1) {
    const from = TOP + (s / FRAGMENTS) * TAU + gap / 2;
    const to = TOP + ((s + 1) / FRAGMENTS) * TAU - gap / 2;
    const steps = Math.max(8, Math.round(((to - from) / TAU) * points));
    const slip = (OFFSETS[s] ?? 0) * frag * SLIP * spec.weight;
    for (let j = 0; j <= steps; j += 1) {
      const angle = from + ((to - from) * j) / steps;
      d += `${j === 0 ? 'M' : 'L'}${pt(spec.radius + slip + unevenness(angle, pose, spec), angle)}`;
    }
  }
  return d;
}

// ------------------------------------------------------------------------------------------
// The bezel and the dormant dots

/** The bezel's ticks: a fine one every 3 degrees, a longer one every 5th and 10th. */
export function bezelPaths(radius: number, detail: 'full' | 'medium' | 'small') {
  const count = detail === 'full' ? 120 : detail === 'medium' ? 60 : 12;
  const major = detail === 'full' ? 10 : detail === 'medium' ? 5 : 1;
  const mid = detail === 'full' ? 5 : 0;
  let fine = '';
  let strong = '';
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * TAU;
    const long = i % major === 0 ? 4.4 : mid > 0 && i % mid === 0 ? 3 : 1.7;
    const segment = `M${pt(radius, angle)}L${pt(radius + long, angle)}`;
    if (i % major === 0) strong += segment;
    else fine += segment;
  }
  return { fine, strong };
}

/** The golden angle: dormant dots placed by it never crowd, and earlier ones keep their place. */
export const GOLDEN_ANGLE = 2.399963;

export const dotAt = (index: number, radius: number): { x: number; y: number } => {
  const angle = TOP + index * GOLDEN_ANGLE;
  return { x: num(radius * Math.cos(angle)), y: num(radius * Math.sin(angle)) };
};
