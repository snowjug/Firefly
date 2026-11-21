import type { BusinessImpact, Difficulty, StartTemperature } from '#shared/domain/vocab.ts';
import type { CoreParams } from '../atlas/core-params.ts';
import type { Atmosphere } from '../call/atmosphere.ts';
import { clamp, lerp } from './geometry.ts';

// The numbers behind the moving instrument. A pose is a flat record of numbers, so any two poses
// can be blended, and a change of mood is just a change of target that the tween glides towards.
// The presence takes its pose from the room's atmosphere (the same numbers that tint the room);
// the core takes it from the calibration settings. Nothing here reads a hidden fact: the inputs are
// public settings and the customer's public state.

export type Pose = {
  /** How much room the rings take, 0.46 (compressed) to 1 (wide). */
  scale: number;
  /** How uneven the rings are, in units. */
  amp: number;
  /** Weight of the second, finer unevenness. */
  wob: number;
  /** Serration of the edge, 0 to 1. */
  zig: number;
  /** Fragmentation of the edge, 0 to 1. */
  frag: number;
  /** The edge dash pattern: long dash, gap, short dash, gap. Dash lengths are natural logs. */
  ld1: number;
  g1: number;
  ld2: number;
  g2: number;
  /** Width of the edge line, in units. */
  lw: number;
  /** How far the rings drift off the heart, 0 to 1. */
  cross: number;
  /** Position along the mood colours (calm 0, escalating 1) and how much cool is mixed back in. */
  hue: number;
  cool: number;
  /** Strength of the glow behind the instrument. */
  glow: number;
  /** 1 when the customer has gone quiet: the rings dim. */
  dim: number;
  /** How restless it is, 0 to 1. */
  energy: number;
  // The core only.
  /** Needle position, 0 (calm) to 1 (angry). */
  needle: number;
  /** How present the second and third ring are, 0 to 1. */
  r2: number;
  r3: number;
  /** How many dormant dots there are (fractional while it moves). */
  soc: number;
  /** Business pressure, 0 to 1. */
  impact: number;
  /** How fine the graticule is engraved: the customer's technical proficiency, 0 to 1. */
  dens: number;
};

export const POSE_KEYS = [
  'scale',
  'amp',
  'wob',
  'zig',
  'frag',
  'ld1',
  'g1',
  'ld2',
  'g2',
  'lw',
  'cross',
  'hue',
  'cool',
  'glow',
  'dim',
  'energy',
  'needle',
  'r2',
  'r3',
  'soc',
  'impact',
  'dens',
] as const satisfies readonly (keyof Pose)[];

export const interpolatePose = (a: Pose, b: Pose, t: number): Pose => {
  const k = clamp(Number.isFinite(t) ? t : 0);
  const out = { ...a };
  for (const key of POSE_KEYS) out[key] = lerp(a[key], b[key], k);
  return out;
};

export const posesEqual = (a: Pose, b: Pose, tolerance = 1e-6): boolean =>
  POSE_KEYS.every((key) => Math.abs(a[key] - b[key]) <= tolerance);

// ------------------------------------------------------------------------------------------
// How the edge looks at each temperature: the same grammar as a glyph's outer edge

type Dash = readonly [number, number, number, number];
const SOLID: Dash = [Math.log(400), 0, Math.log(400), 0];
const ROUND: Dash = [Math.log(1.2), 2.8, Math.log(1.2), 2.8];
const LONG_SHORT: Dash = [Math.log(9), 3.2, Math.log(3), 3.2];

interface Look {
  amp: number;
  zig: number;
  frag: number;
  dash: Dash;
  cross: number;
  lw: number;
  hue: number;
}

/** Calm: a smooth line. Concerned: round dashes. Frustrated: long and short. Angry: serrated. */
const CALM: Look = { amp: 0.25, zig: 0, frag: 0, dash: SOLID, cross: 0, lw: 1.1, hue: 0 };
const CONCERNED: Look = { amp: 1, zig: 0, frag: 0, dash: ROUND, cross: 0, lw: 1.15, hue: 0.25 };
const FRUSTRATED: Look = {
  amp: 1.9,
  zig: 0.18,
  frag: 0.1,
  dash: LONG_SHORT,
  cross: 0.25,
  lw: 1.3,
  hue: 0.5,
};
const ANGRY: Look = { amp: 3, zig: 0.92, frag: 0.28, dash: SOLID, cross: 0.6, lw: 1.5, hue: 0.75 };
const ESCALATING: Look = { amp: 4.2, zig: 1, frag: 0.92, dash: SOLID, cross: 0.9, lw: 1.6, hue: 1 };

/** The tension of each band, as the room's atmosphere has it, with the look that goes with it. */
const BAND_LOOKS: readonly (readonly [number, Look])[] = [
  [0.08, CALM],
  [0.3, CONCERNED],
  [0.56, FRUSTRATED],
  [0.8, ANGRY],
  [0.94, ESCALATING],
];

const blendLook = (a: Look, b: Look, t: number): Look => ({
  amp: lerp(a.amp, b.amp, t),
  zig: lerp(a.zig, b.zig, t),
  frag: lerp(a.frag, b.frag, t),
  dash: [
    lerp(a.dash[0], b.dash[0], t),
    lerp(a.dash[1], b.dash[1], t),
    lerp(a.dash[2], b.dash[2], t),
    lerp(a.dash[3], b.dash[3], t),
  ],
  cross: lerp(a.cross, b.cross, t),
  lw: lerp(a.lw, b.lw, t),
  hue: lerp(a.hue, b.hue, t),
});

/** The look at a tension: the nearest bands blended, so a pose is a smooth function of the room. */
export function lookAt(tension: number): Look {
  const t = Number.isFinite(tension) ? tension : 0;
  const first = BAND_LOOKS[0];
  const last = BAND_LOOKS[BAND_LOOKS.length - 1];
  if (!first || !last) return CALM;
  if (t <= first[0]) return first[1];
  if (t >= last[0]) return last[1];
  for (let i = 1; i < BAND_LOOKS.length; i += 1) {
    const upper = BAND_LOOKS[i];
    const lower = BAND_LOOKS[i - 1];
    if (upper && lower && t <= upper[0]) {
      return blendLook(lower[1], upper[1], (t - lower[0]) / (upper[0] - lower[0]));
    }
  }
  return last[1];
}

const BASE: Pose = {
  scale: 1,
  amp: CALM.amp,
  wob: 0.46,
  zig: 0,
  frag: 0,
  ld1: SOLID[0],
  g1: 0,
  ld2: SOLID[2],
  g2: 0,
  lw: CALM.lw,
  cross: 0,
  hue: 0,
  cool: 0,
  glow: 0.08,
  dim: 0,
  energy: 0.22,
  needle: 0,
  r2: 1,
  r3: 1,
  soc: 7,
  impact: 0.5,
  dens: 0.5,
};

// ------------------------------------------------------------------------------------------
// Presence

/** Rings never shrink below this share of their calm size, even at the highest tension. */
export const MIN_RING_SCALE = 0.46;

const RECOVERING_LOOSENING = 0.4;
const RECOVERING_COOL = 0.78;

type PresenceInput = Pick<Atmosphere, 'tension' | 'open' | 'energy' | 'recovering' | 'silent'>;

/**
 * The pose for a room. Tension decides how uneven, serrated and fragmented the rings are and
 * which texture the edge has; openness how much room they take; recovery widens them, lets the
 * fragments rejoin and brings cool back; silence dims and stills them.
 */
export function presencePose(atmosphere: PresenceInput): Pose {
  const tension = clamp(atmosphere.tension);
  const easing = atmosphere.recovering ? 1 : 0;
  const open =
    clamp(atmosphere.open) + (1 - clamp(atmosphere.open)) * RECOVERING_LOOSENING * easing;
  const look = lookAt(tension);
  return {
    ...BASE,
    scale: lerp(MIN_RING_SCALE, 1, open),
    amp: look.amp * (1 - 0.4 * easing),
    wob: 0.4 + tension,
    zig: look.zig * (1 - 0.6 * easing),
    frag: look.frag * (1 - 0.85 * easing),
    ld1: look.dash[0],
    g1: look.dash[1],
    ld2: look.dash[2],
    g2: look.dash[3],
    lw: look.lw,
    cross: look.cross * (1 - 0.7 * easing),
    hue: look.hue * (1 - 0.9 * easing),
    cool: RECOVERING_COOL * easing,
    glow: lerp(0.07, 0.27, tension) * (1 + (1 - open) * 0.2),
    dim: atmosphere.silent ? 1 : 0,
    energy: atmosphere.silent ? 0 : clamp(atmosphere.energy),
  };
}

// ------------------------------------------------------------------------------------------
// Core: what each setting turns

const IMPACT_PRESSURE: Record<BusinessImpact, number> = { low: 0.2, medium: 0.55, high: 0.9 };
const STABILITY: Record<StartTemperature, number> = {
  calm: 0.9,
  anxious: 0.65,
  frustrated: 0.4,
  angry: 0.18,
};
const COMPLEXITY: Record<Difficulty, number> = { starter: 0.25, standard: 0.55, challenge: 0.9 };

/** The key of the entry in `table` whose number is closest to `value`. */
function nearest<K extends string>(table: Record<K, number>, value: number): K {
  const entries = Object.entries(table) as [K, number][];
  let best = entries[0] as [K, number];
  for (const entry of entries) {
    if (Math.abs(entry[1] - value) < Math.abs(best[1] - value)) best = entry;
  }
  return best[0];
}

/** The setting a pressure belongs to. The core is read from its parameters, never from a copy. */
export const impactOf = (pressure: number): BusinessImpact => nearest(IMPACT_PRESSURE, pressure);
export const startOf = (stability: number): StartTemperature => nearest(STABILITY, stability);
export const difficultyOf = (complexity: number): Difficulty => nearest(COMPLEXITY, complexity);

export const BAND_SEGMENTS = 24;
/** How many of the 24 segments of the pressure band are lit: about 5, 15 and 24. */
export const litSegments = (pressure: number): number =>
  Math.round(BAND_SEGMENTS * clamp(pressure / IMPACT_PRESSURE.high));

/** 0 for a calm start up to 1 for an angry one: where the needle points. */
export const heatOf = (stability: number): number =>
  clamp((STABILITY.calm - stability) / (STABILITY.calm - STABILITY.angry));

export const ringsOf = (complexity: number): 1 | 2 | 3 => {
  const rings = difficultyOf(complexity);
  return rings === 'starter' ? 1 : rings === 'standard' ? 2 : 3;
};

/** The dormant dots: a fixed pool by difficulty (3, 5, 7), a density cue and never a count. */
export const dormantDots = (complexity: number): number =>
  complexity <= COMPLEXITY.starter
    ? 3
    : complexity <= COMPLEXITY.standard
      ? lerp(3, 5, (complexity - COMPLEXITY.starter) / (COMPLEXITY.standard - COMPLEXITY.starter))
      : Math.min(
          7,
          lerp(
            5,
            7,
            (complexity - COMPLEXITY.standard) / (COMPLEXITY.challenge - COMPLEXITY.standard),
          ),
        );

export type Density = 'light' | 'moderate' | 'dense';
export const DENSITY_WORDS: Record<Density, string> = {
  light: 'Light',
  moderate: 'Moderate',
  dense: 'Dense',
};
export const densityOf = (complexity: number): Density => {
  const level = difficultyOf(complexity);
  return level === 'starter' ? 'light' : level === 'standard' ? 'moderate' : 'dense';
};

const START_LOOKS: Record<StartTemperature, Look> = {
  calm: CALM,
  anxious: CONCERNED,
  frustrated: FRUSTRATED,
  angry: ANGRY,
};
/** The heat at which each start sits on the needle scale. */
const START_HEAT: readonly (readonly [StartTemperature, number])[] = [
  ['calm', 0],
  ['anxious', heatOf(STABILITY.anxious)],
  ['frustrated', heatOf(STABILITY.frustrated)],
  ['angry', 1],
];

/** The edge look at a heat: the starts either side of it, blended. */
function lookAtHeat(heat: number): Look {
  const h = clamp(heat);
  for (let i = 1; i < START_HEAT.length; i += 1) {
    const upper = START_HEAT[i];
    const lower = START_HEAT[i - 1];
    if (upper && lower && h <= upper[1]) {
      return blendLook(
        START_LOOKS[lower[0]],
        START_LOOKS[upper[0]],
        (h - lower[1]) / (upper[1] - lower[1]),
      );
    }
  }
  return ANGRY;
}

/**
 * The pose for a set of calibration parameters: each one turns a part of the instrument. The
 * pressure lights the band, the start sets the edge and the needle, the difficulty adds rings and
 * dormant dots; the rest are quieter: proficiency engraves a finer graticule, the conversation
 * style makes the edge busier, and the chance of a surprise lets the rings sit off the heart.
 */
export function corePose(params: CoreParams): Pose {
  const heat = heatOf(params.stability);
  const look = lookAtHeat(heat);
  return {
    ...BASE,
    scale: 1,
    amp: look.amp,
    wob: 0.4 + lerp(0.06, 0.8, heat) * 0.7 + clamp(params.rhythm) * 0.4,
    zig: look.zig,
    frag: 0,
    ld1: look.dash[0],
    g1: look.dash[1],
    ld2: look.dash[2],
    g2: look.dash[3],
    lw: look.lw,
    cross: clamp(params.disturbance) * 0.5,
    hue: look.hue,
    glow: lerp(0.05, 0.25, clamp(params.pressure / IMPACT_PRESSURE.high)),
    energy: lerp(0.1, 0.74, heat),
    needle: heat,
    r2: clamp(
      (params.complexity - COMPLEXITY.starter) / (COMPLEXITY.standard - COMPLEXITY.starter),
    ),
    r3: clamp(
      (params.complexity - COMPLEXITY.standard) / (COMPLEXITY.challenge - COMPLEXITY.standard),
    ),
    soc: dormantDots(params.complexity),
    // Whole segments, so the band at rest shows exactly the count the legend says.
    impact: litSegments(params.pressure) / BAND_SEGMENTS,
    dens: clamp(params.density),
  };
}

// ------------------------------------------------------------------------------------------
// Moving between poses: a damped spring per number

/** Seconds for a critically damped spring to settle to within 2% of its target. */
export const omegaFor = (seconds: number): number => 5.83 / Math.max(0.05, seconds);

/** Rising tension is quick and easing is slow, so the room tightens at once and relaxes gently. */
export const RISE_SECONDS = 0.5;
export const EASE_SECONDS = 1.5;
export const CORE_SECONDS = 0.9;

/** How long a move from one pose to another should take: quick up, slow down. */
export const settleSeconds = (from: Pose, to: Pose): number =>
  to.amp > from.amp + 1e-3 ? RISE_SECONDS : EASE_SECONDS;

/** Springy needle and drift: they overshoot a little, like a physical part would. */
const DAMPING: Partial<Record<keyof Pose, number>> = { needle: 0.62, cross: 0.7 };

const SUBSTEP = 1 / 240;
const REST_DISTANCE = 0.003;
const REST_SPEED = 0.02;

export interface PoseState {
  pose: Pose;
  velocity: Pose;
}

export const restingState = (pose: Pose): PoseState => ({
  pose: { ...pose },
  velocity: Object.fromEntries(POSE_KEYS.map((key) => [key, 0])) as Pose,
});

/**
 * Advances a pose towards a target by `dt` seconds with one damped spring per number (critically
 * damped unless `DAMPING` says otherwise). Returns whether everything has come to rest on the
 * target; at rest the pose is the target exactly, so a loop can stop.
 */
export function stepPose(
  state: PoseState,
  target: Pose,
  dt: number,
  omega: number,
): PoseState & { settled: boolean } {
  const pose = { ...state.pose };
  const velocity = { ...state.velocity };
  const steps = Math.max(1, Math.ceil(Math.min(dt, 0.1) / SUBSTEP));
  const h = Math.min(dt, 0.1) / steps;
  let settled = true;
  for (const key of POSE_KEYS) {
    const zeta = DAMPING[key] ?? 1;
    let x = pose[key];
    let v = velocity[key];
    const goal = target[key];
    for (let i = 0; i < steps; i += 1) {
      v += (-omega * omega * (x - goal) - 2 * zeta * omega * v) * h;
      x += v * h;
    }
    if (Math.abs(x - goal) <= REST_DISTANCE && Math.abs(v) <= REST_SPEED) {
      x = goal;
      v = 0;
    } else {
      settled = false;
    }
    pose[key] = x;
    velocity[key] = v;
  }
  return { pose, velocity, settled };
}
