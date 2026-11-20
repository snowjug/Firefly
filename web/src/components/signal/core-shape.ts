import { TAU, TOP, num, pt, tickPaths, clampMinutes, TICK_COUNT } from './geometry.ts';
import type { Pose } from './poses.ts';
import { BAND_SEGMENTS } from './poses.ts';
import { PRESENCE_BOX, detailFor } from './presence-shape.ts';
import { dotAt, ringPath } from './rings.ts';

// The scenario core: what is engraved where. Everything here is a number or a path string, so the
// component only places it. The instrument is drawn in 200 units, inside a box of 224 that leaves
// room round it for the lettered marks.

export const CORE_BOX = 224;
export const CORE_HALF = CORE_BOX / 2;
export const CORE_INSTRUMENT = PRESENCE_BOX;
export const LIMB_RADIUS = 96;
export const MINUTE_RADIUS = 68;
export const BAND_RADIUS = 86.5;
export const SCALE_RADIUS = 92;
export const CORE_ORBIT = 54;
/** The needle sweeps 60 degrees either side of the top. */
export const NEEDLE_SWEEP = 60;

const deg = (degrees: number) => (degrees * Math.PI) / 180;
const arc = (radius: number, from: number, to: number) =>
  `M${pt(radius, from)}A${radius} ${radius} 0 ${to - from > Math.PI ? 1 : 0} 1 ${pt(radius, to)}`;

/** The 24 segments of the pressure band, from the left, round clockwise. */
export const BAND_PATHS: readonly string[] = Array.from({ length: BAND_SEGMENTS }, (_, i) =>
  arc(
    BAND_RADIUS,
    -Math.PI + (i / BAND_SEGMENTS) * TAU + deg(1.6),
    -Math.PI + ((i + 1) / BAND_SEGMENTS) * TAU - deg(1.6),
  ),
);

/** How lit a band segment is for a (fractional) number of lit segments. */
export const segmentGlow = (lit: number, index: number): number =>
  Math.min(1, Math.max(0, lit - index)) * 0.95 + 0.07;

export interface MinuteTicks {
  on: string;
  off: string;
  numerals: { n: number; x: number; y: number; on: boolean }[];
}

/** One engraved tick per minute, with the numerals 5, 10 and 15 where those minutes fall. */
export function minuteTicks(minutes: number): MinuteTicks {
  const lit = clampMinutes(minutes);
  const { on, off } = tickPaths(minutes, MINUTE_RADIUS, 6, 8);
  return {
    on,
    off,
    numerals: [5, 10, 15].map((n) => {
      const angle = TOP + ((n - 1) * TAU) / TICK_COUNT;
      return {
        n,
        x: num(79.5 * Math.cos(angle)),
        y: num(79.5 * Math.sin(angle) + 1.4),
        on: n <= lit,
      };
    }),
  };
}

/** The arc the needle points along, and the four stops (calm to angry) on it. */
export const NEEDLE_SCALE = (() => {
  const from = deg(-90 - NEEDLE_SWEEP);
  const to = deg(-90 + NEEDLE_SWEEP);
  const stops = [0, 1, 2, 3].map((i) => from + ((to - from) * i) / 3);
  return {
    arc: arc(SCALE_RADIUS, from, to),
    stops: stops.map((angle) => `M${pt(88.5, angle)}L${pt(95.5, angle)}`),
  };
})();

/** The graticule: a crosshair and two circles always, a finer net as the customer knows more. */
export const GRATICULE = (() => {
  const line = (angle: number) => `M${pt(26, angle)}L${pt(84, angle)}`;
  const circle = (r: number) =>
    `M${num(-r)} 0A${r} ${r} 0 1 0 ${num(r)} 0A${r} ${r} 0 1 0 ${num(-r)} 0`;
  let coarse = circle(24) + circle(78);
  let fine = circle(36) + circle(70);
  for (let i = 0; i < 4; i += 1) coarse += line(TOP + (i * TAU) / 4);
  for (let i = 0; i < 4; i += 1) fine += line(TOP + ((i + 0.5) * TAU) / 4);
  for (let i = 0; i < 8; i += 1) fine += line(TOP + ((i + 0.5) * TAU) / 8);
  return { coarse, fine };
})();

/** An n-pointed star polygon: each vertex joined to the one `step` further round. */
function star(radius: number, points: number, step: number): string {
  let d = '';
  for (let i = 0; i < points; i += 1) {
    const from = TOP + (i / points) * TAU;
    const to = TOP + (((i + step) % points) / points) * TAU;
    d += `M${pt(radius, from)}L${pt(radius, to)}`;
  }
  return d;
}

export interface CoreShape {
  edge: string;
  ring2: string;
  ring3: string;
  /** Hexagon and hexagram for the second ring, a twelve-pointed star for the third. */
  facetsA: string;
  facetsB: string;
  dasharray: string;
  round: boolean;
  /** Where the heart is drawn and its scale (the stage shape is drawn at radius 16). */
  heartScale: number;
  heartRadius: number;
  /** Line widths in units: the edge, the inner rings, the hairlines, the heart and the band. */
  width: { edge: number; inner: number; hair: number; heart: number; band: number };
}

export function coreShape(pose: Pose, size: number): CoreShape {
  const safe = Number.isFinite(size) && size > 0 ? size : 420;
  const pxPerUnit = safe / CORE_BOX;
  // Lines are engraved at a fixed number of pixels, so the plate is as fine at any size.
  const units = (pixels: number) => pixels / pxPerUnit;
  const detail = detailFor((safe * CORE_INSTRUMENT) / CORE_BOX);
  const teeth =
    detail === 'full' ? [44, 30, 22] : detail === 'medium' ? [34, 24, 18] : [24, 18, 14];

  const heartRadius = 12 + pose.impact * 3;
  const radius2 = heartRadius + 6 + (46 - heartRadius - 6) * pose.r2;
  const radius3 = heartRadius + 4 + (30 - heartRadius - 4) * pose.r3;
  const stretch = Math.min(3, Math.max(1, 0.9 / pxPerUnit));
  return {
    edge: ringPath(
      { radius: 62, weight: 1, teeth: teeth[0] ?? 44, phase: 0, fragments: false },
      pose,
    ),
    ring2: ringPath(
      { radius: radius2, weight: 0.45, teeth: teeth[1] ?? 30, phase: 0.7, fragments: false },
      pose,
    ),
    ring3: ringPath(
      { radius: radius3, weight: 0.28, teeth: teeth[2] ?? 22, phase: 1.9, fragments: false },
      pose,
    ),
    facetsA: star(radius2, 6, 1) + star(radius2 * 0.5, 6, 2),
    facetsB: star(62 * 0.74, 12, 5),
    dasharray: `${num(Math.exp(pose.ld1) * stretch)} ${num(pose.g1 * stretch)} ${num(Math.exp(pose.ld2) * stretch)} ${num(pose.g2 * stretch)}`,
    round: Math.exp(pose.ld1) < 2.2,
    heartScale: heartRadius / 16,
    heartRadius,
    width: {
      edge: units(Math.max(pose.lw, 1.15)),
      inner: units(1),
      hair: units(0.9),
      heart: units(1.4),
      band: units(2.6),
    },
  };
}

/** A dormant dot: where it sits, and how present it is while the difficulty moves. */
export function dormantDot(index: number, soc: number) {
  const { x, y } = dotAt(index, CORE_ORBIT);
  const present = Math.min(1, Math.max(0, soc - index));
  return { x, y, scale: 0.4 + 0.6 * present, opacity: present };
}

// ------------------------------------------------------------------------------------------
// The lettered marks: a letter outside the limb, a hairline to the part it names

export interface CoreMark {
  letter: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  /** Degrees from the top, clockwise. All six sit on the left, in reading order from the top. */
  angle: number;
  /** Radius of the part the mark names, in units. */
  part: number;
}

export const CORE_MARKS: readonly CoreMark[] = [
  { letter: 'A', angle: -42, part: 72 },
  { letter: 'B', angle: -70, part: BAND_RADIUS },
  { letter: 'C', angle: -98, part: 19 },
  { letter: 'D', angle: -126, part: 62 },
  { letter: 'E', angle: -154, part: 46 },
  { letter: 'F', angle: -176, part: CORE_ORBIT },
];

/** Where the letter itself sits, in units from the centre. */
export const MARK_RADIUS = 107;
const LEADER_END = 101;

/** A point at `angle` degrees from the top and `radius` units out, in units from the centre. */
export const onCore = (angle: number, radius: number) => ({
  x: num(radius * Math.sin(deg(angle))),
  y: num(-radius * Math.cos(deg(angle))),
});

/** A point on the core as a share of its box, for placing a letter with CSS. */
export const corePercent = (angle: number, radius: number) => {
  const { x, y } = onCore(angle, radius);
  return {
    left: `${num(((x + CORE_HALF) / CORE_BOX) * 100)}%`,
    top: `${num(((y + CORE_HALF) / CORE_BOX) * 100)}%`,
  };
};

export const leaderPath = (mark: CoreMark): string => {
  const from = onCore(mark.angle, mark.part);
  const to = onCore(mark.angle, LEADER_END);
  return `M${from.x} ${from.y}L${to.x} ${to.y}`;
};
