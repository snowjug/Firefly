import type { PerfTier } from '../../lib/perf-tier.ts';
import { noise, signedNoise } from '../../lib/seeded-noise.ts';
import {
  NEUTRAL_POSE,
  type WorldPoint,
  type WorldPose,
  type WorldPulseKind,
} from './world-store.ts';

// The shape of the field: bundles of hair-thin strands that flow across the window like currents.
// Pure and deterministic (the same seed, poses and frame times always give the same strands), so it
// can be tested without a screen. The draw code only reads the arrays this fills in.
//
// How the customer's state becomes shape (never colour alone; see the design bible, section 3):
//   open / calm      a few wide ribbons, long smooth waves, slow
//   tension rising   more ribbons appear and gather toward the focus; the waves shorten
//   frustrated       compressed and uneven: the spacing inside each ribbon bunches up
//   angry            the ribbons cross at the focus, and the waves turn from sine to sawtooth
//   escalating       outer strands fray into fragments and drift off; the shape jitters, slowly
//   recovering       slower, the strands fall back into step with each other, and the colour cools
// Nothing flashes: movement is geometry only, no part moves faster than 1 Hz, and every number the
// state drives is smoothed, so no frame differs much from the one before it.

export const STRAND_POINTS: Readonly<Record<PerfTier, readonly [strands: number, points: number]>> =
  { high: [90, 28], medium: [60, 22], low: [0, 0] };

const PER_BUNDLE = 10;
const MAX_LIGHTS: Readonly<Record<PerfTier, number>> = { high: 5, medium: 3, low: 0 };
/** The strands run a little past both edges of the window, so no end is ever seen. */
export const X_MIN = -0.08;
export const X_MAX = 1.08;
/** How far past the top and bottom a strand may stray (as a share of the height). */
export const Y_LIMIT = 0.3;
export const PULSE_SECONDS = 0.9;
const TAU = Math.PI * 2;
const PULSE_STRANDS = 8;
const STATIC_TIME = 7.3;
const GOLDEN = 0.6180339887;

/**
 * Seconds to settle [when the number rises, when it falls]. The room closes in fast and opens again
 * slowly: tension, warmth and energy rise quickly and ease back slowly, and `open` is the other way.
 */
const SETTLE = {
  tension: [0.5, 1.5],
  open: [1.4, 0.6],
  warmth: [0.8, 1.6],
  energy: [0.7, 1.8],
  intensity: [0.9, 1.1],
  rec: [1.2, 1.2],
  fx: [0.9, 0.9],
  fy: [0.9, 0.9],
} as const satisfies Record<string, readonly [number, number]>;

interface Smoothed {
  tension: number;
  open: number;
  warmth: number;
  energy: number;
  intensity: number;
  /** 0 to 1: how far into recovering the field is. */
  rec: number;
  /** Where the field leans, in field coordinates (x is 0..1 across the strands' run). */
  fx: number;
  fy: number;
}

export interface World {
  readonly tier: PerfTier;
  readonly count: number;
  /** Points per strand. */
  readonly size: number;
  /** x, y for each point of each strand: x across the strands' run, y as a fraction of the height. */
  readonly pos: Float32Array;
  /** How visible each strand is, 0 to 1 (density, depth and presence are already in it). */
  readonly alpha: Float32Array;
  /** Line width in CSS pixels. */
  readonly width: Float32Array;
  /** The warmth (0..1) each strand is coloured by. */
  readonly warmth: Float32Array;
  /** 0 to 1: how frayed each strand is (gaps along it). */
  readonly fray: Float32Array;
  /** Travelling lights, three numbers each: strand, position along it (0..1), brightness (0..1). */
  readonly lights: Float32Array;
  readonly lightCount: number;
  /** 0 to 1: how angular the strands are (the draw rounds the corners of a smooth field). */
  crisp: number;
  /** Seconds of field time: slow when the room is calm. */
  time: number;
  readonly state: Smoothed;
  readonly pulse: {
    kind: 0 | 1 | 2;
    age: number;
    x: number;
    y: number;
    strands: Int16Array;
    points: Int16Array;
    found: number;
  };
  readonly seed: number;
  readonly views: readonly Float32Array[];
  readonly set: Statics;
}

interface Statics {
  bundles: number;
  /** Per bundle. */
  offset: Float32Array;
  depth: Float32Array;
  amp: Float32Array;
  waves: Float32Array;
  phase: Float32Array;
  flow: Float32Array;
  slope: Float32Array;
  ribbon: Float32Array;
  pinch: Float32Array;
  pinchPhase: Float32Array;
  pinchFlow: Float32Array;
  rank: Float32Array;
  hue: Float32Array;
  /** Per strand. */
  bundle: Uint8Array;
  lane: Float32Array;
  laneNoise: Float32Array;
  ripple: Float32Array;
  rippleK: Float32Array;
  phi: Float32Array;
  order: Float32Array;
  edge: Float32Array;
  line: Float32Array;
  tone: Float32Array;
  side: Float32Array;
  /** Scratch, per bundle and point: the centreline, the half-width, and per bundle: its gate. */
  centre: Float32Array;
  span: Float32Array;
  gate: Float32Array;
  lightSeed: Float32Array;
  lightSpeed: Float32Array;
  lightGen: Uint16Array;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const unit = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? clamp(v, 0, 1) : fallback;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
/** A triangle wave that lines up with sine: 0 at 0, 1 at a quarter turn. */
const tri = (a: number) => {
  const f = a / TAU - Math.floor(a / TAU);
  return f < 0.25 ? 4 * f : f < 0.75 ? 2 - 4 * f : 4 * f - 4;
};

/** The strands for a tier. Low has none: the field is the still gradient only. */
export function createWorld(seed: number, tier: PerfTier): World {
  const [count, size] = STRAND_POINTS[tier] ?? STRAND_POINTS.low;
  const bundles = Math.ceil(count / PER_BUNDLE);
  const lightCount = MAX_LIGHTS[tier] ?? 0;
  const n = (key: string) => noise(seed, key);
  const f = (len: number) => new Float32Array(len);
  const set: Statics = {
    bundles,
    offset: f(bundles),
    depth: f(bundles),
    amp: f(bundles),
    waves: f(bundles),
    phase: f(bundles),
    flow: f(bundles),
    slope: f(bundles),
    ribbon: f(bundles),
    pinch: f(bundles),
    pinchPhase: f(bundles),
    pinchFlow: f(bundles),
    rank: f(bundles),
    hue: f(bundles),
    bundle: new Uint8Array(count),
    lane: f(count),
    laneNoise: f(count),
    ripple: f(count),
    rippleK: f(count),
    phi: f(count),
    order: f(count),
    edge: f(count),
    line: f(count),
    tone: f(count),
    side: f(count),
    centre: f(bundles * size),
    span: f(bundles * size),
    gate: f(bundles),
    lightSeed: f(lightCount),
    lightSpeed: f(lightCount),
    lightGen: new Uint16Array(lightCount),
  };
  for (let b = 0; b < bundles; b += 1) {
    const k = `b${b}`;
    set.offset[b] = clamp(-1 + (2 * (b + 0.5 + 0.3 * signedNoise(seed, `${k}o`))) / bundles, -1, 1);
    set.depth[b] = n(`${k}z`);
    set.amp[b] = 0.035 + 0.05 * n(`${k}a`);
    set.waves[b] = 0.55 + 0.8 * n(`${k}k`);
    set.phase[b] = TAU * n(`${k}p`);
    set.flow[b] = (0.45 + 0.7 * n(`${k}w`)) * (0.6 + 0.6 * set.depth[b]!);
    set.slope[b] = -0.05 + 0.16 * signedNoise(seed, `${k}s`);
    set.ribbon[b] = 0.032 + 0.05 * n(`${k}r`);
    set.pinch[b] = 0.7 + 0.9 * n(`${k}c`);
    set.pinchPhase[b] = TAU * n(`${k}q`);
    set.pinchFlow[b] = 0.3 + 0.4 * n(`${k}v`);
    // Which ribbons a calm room shows: spread out, so the first few are never neighbours.
    const spread = b * GOLDEN + 0.12 * n(`${k}d`);
    set.rank[b] = spread - Math.floor(spread);
    set.hue[b] = signedNoise(seed, `${k}h`);
  }
  for (let i = 0; i < count; i += 1) {
    const s = i % PER_BUNDLE;
    const k = `s${i}`;
    const half = (PER_BUNDLE - 1) / 2;
    set.bundle[i] = Math.floor(i / PER_BUNDLE);
    set.lane[i] = clamp((s - half) / half + 0.14 * signedNoise(seed, `${k}l`), -1, 1);
    set.laneNoise[i] = signedNoise(seed, `${k}u`);
    set.ripple[i] = 0.3 + 0.7 * n(`${k}r`);
    set.rippleK[i] = 8 + 6 * n(`${k}k`);
    set.phi[i] = TAU * n(`${k}p`);
    set.edge[i] = Math.abs(set.lane[i]!);
    // Inside a ribbon the middle strands come first and the outer ones last.
    set.order[i] = 0.62 * set.edge[i]! + 0.38 * n(`${k}d`);
    set.line[i] = 0.8 + 0.4 * n(`${k}w`);
    set.tone[i] = signedNoise(seed, `${k}h`);
    set.side[i] = n(`${k}g`) < 0.5 ? -1 : 1;
  }
  for (let l = 0; l < lightCount; l += 1) {
    set.lightSeed[l] = n(`l${l}`);
    set.lightSpeed[l] = 0.7 + 0.6 * n(`l${l}v`);
  }
  const pos = f(count * size * 2);
  const views = Array.from({ length: count }, (_, i) =>
    pos.subarray(i * size * 2, (i + 1) * size * 2),
  );
  const lights = f(lightCount * 3);
  for (let l = 0; l < lightCount; l += 1) {
    lights[l * 3] = Math.floor(set.lightSeed[l]! * count) % count;
    lights[l * 3 + 1] = (l + 0.5) / lightCount;
  }
  const world: World = {
    tier,
    count,
    size,
    pos,
    alpha: f(count),
    width: f(count),
    warmth: f(count),
    fray: f(count),
    lights,
    lightCount,
    crisp: 0,
    time: STATIC_TIME,
    state: {
      tension: NEUTRAL_POSE.tension,
      open: NEUTRAL_POSE.open,
      warmth: NEUTRAL_POSE.warmth,
      energy: NEUTRAL_POSE.energy,
      intensity: NEUTRAL_POSE.intensity,
      rec: 0,
      fx: 0.5,
      fy: 0.5,
    },
    pulse: {
      kind: 0,
      age: 0,
      x: 0.5,
      y: 0.5,
      strands: new Int16Array(PULSE_STRANDS),
      points: new Int16Array(PULSE_STRANDS),
      found: 0,
    },
    seed,
    views,
    set,
  };
  layout(world);
  return world;
}

const NO_POINTS = new Float32Array(0);
/** The points of one strand, as x, y, x, y... The same array every time: nothing is allocated. */
export function pointsOf(world: World, index: number): Float32Array {
  return world.views[index] ?? NO_POINTS;
}

/** What the field is heading for, written into `out`: the pose, made safe (no missing or bad numbers). */
function aim(pose: Partial<WorldPose>, out: Smoothed): Smoothed {
  const focus = pose.focus;
  const n = NEUTRAL_POSE;
  out.tension = unit(pose.tension, n.tension);
  out.open = unit(pose.open, n.open);
  out.warmth = unit(pose.warmth, n.warmth);
  out.energy = unit(pose.energy, n.energy);
  out.intensity = unit(pose.intensity, n.intensity);
  out.rec = pose.recovering === true ? 1 : 0;
  out.fx = focus ? unit(focus.x, 0.5) : 0.5;
  out.fy = focus ? unit(focus.y, 0.5) : 0.5;
  return out;
}

// Reused every frame, so a frame allocates nothing.
const GOAL: Smoothed = {
  tension: 0,
  open: 0,
  warmth: 0,
  energy: 0,
  intensity: 0,
  rec: 0,
  fx: 0,
  fy: 0,
};
const KEYS = Object.keys(SETTLE) as (keyof Smoothed)[];

/** True when the field has arrived at the pose (and no event is running): nothing is left to animate. */
export function isSettled(world: World, pose: Partial<WorldPose>): boolean {
  if (world.pulse.kind !== 0) return false;
  const goal = aim(pose, GOAL);
  for (const key of KEYS) if (Math.abs(goal[key] - world.state[key]) > 0.012) return false;
  return true;
}

/** Moves the smoothed state toward the pose; each number has its own pace for rising and falling. */
function ease(world: World, pose: Partial<WorldPose>, dt: number) {
  const goal = aim(pose, GOAL);
  const state = world.state;
  for (const key of KEYS) {
    const now = state[key];
    const [rise, fall] = SETTLE[key];
    const pace = goal[key] >= now ? rise : fall;
    state[key] = dt > 0 ? now + (goal[key] - now) * (1 - Math.exp(-dt / pace)) : goal[key];
  }
}

/** Takes the pose at once, with no easing: for the first frame and for a still frame. */
export function settleWorld(world: World, pose: Partial<WorldPose>): void {
  ease(world, pose, 0);
  world.pulse.kind = 0;
  layout(world);
}

/**
 * Starts a new field (a cheaper tier) from where the old one was, so stepping down changes how many
 * strands there are but not the mood: no pop, and an easing in progress carries on.
 */
export function carryOver(from: World, to: World): void {
  Object.assign(to.state, from.state);
  to.time = from.time;
  layout(to);
}

/** Moves the field on by `dt` seconds toward `pose`. Time is clamped so a stalled tab cannot leap. */
export function stepWorld(world: World, dt: number, pose: Partial<WorldPose>): void {
  if (world.count === 0) return;
  const step = Number.isFinite(dt) ? clamp(dt, 0, 0.1) : 0;
  ease(world, pose, step);
  const s = world.state;
  const quiet = 0.45 + 0.55 * s.intensity;
  world.time += step * (0.04 + 0.96 * s.energy * (1 - 0.45 * s.rec) * quiet);
  const p = world.pulse;
  if (p.kind !== 0) {
    p.age += step;
    if (p.age >= PULSE_SECONDS) p.kind = 0;
  }
  layout(world);
  moveLights(world, step);
}

/** Lays out every strand for the current state and time, and decides how each one looks. */
function layout(world: World) {
  const { count, size, pos, set } = world;
  if (count === 0) return;
  const { tension: T, open: O, warmth: W, intensity: P, rec: R, fx, fy } = world.state;
  const t = world.time;
  const squeeze = clamp(0.62 * T + 0.38 * (1 - O), 0, 1);
  const band = lerp(0.4, 0.07, Math.pow(squeeze, 0.9));
  const cross = smooth(0.55, 0.9, T);
  const sharp = smooth(0.35, 0.9, T);
  const uneven = smooth(0.25, 0.7, T) * (1 - 0.6 * R);
  const fray = smooth(0.78, 1, T) * (1 - 0.8 * R);
  const kmul = 1 + 1.6 * T;
  const amp = lerp(1, 0.4, T) * (0.6 + 0.4 * O);
  const align = clamp(0.85 - 0.8 * T + 0.6 * R, 0, 1);
  const jit = (0.003 + 0.02 * T * T) * (1 - 0.7 * R);
  const ribbon = lerp(1, 0.35, squeeze);
  const du = (X_MAX - X_MIN) / (size - 1);
  const crossK = 3.2 * band;
  world.crisp = sharp;

  for (let b = 0; b < set.bundles; b += 1) {
    const side = set.offset[b]!;
    const lean = set.slope[b]! * (1 - cross);
    const flow = t * set.flow[b]!;
    const k = set.waves[b]! * kmul * TAU;
    for (let j = 0; j < size; j += 1) {
      const u = X_MIN + j * du;
      const a = k * u + set.phase[b]! + flow;
      const wave = Math.sin(a) * (1 - sharp) + tri(a) * sharp;
      // The ribbons keep their spacing while the room is open. As it closes they tilt about the
      // focus, so they cross exactly there and swap sides, spreading out again on the far side.
      const spacing = band * (1 - cross) - crossK * cross * (u - fx);
      set.centre[b * size + j] = fy + side * spacing + lean * (u - fx) + set.amp[b]! * amp * wave;
      const swell =
        0.55 +
        0.45 * Math.sin(set.pinch[b]! * u * TAU + set.pinchPhase[b]! - t * set.pinchFlow[b]!);
      set.span[b * size + j] = set.ribbon[b]! * ribbon * swell;
    }
  }

  const kink = world.pulse.kind === 2 ? kinkEnvelope(world.pulse.age / PULSE_SECONDS) : 0;
  const kinkAt = world.pulse.x;
  for (let i = 0; i < count; i += 1) {
    const b = set.bundle[i]!;
    const lane = set.lane[i]! * (1 + 0.5 * uneven * set.laneNoise[i]!);
    const phi = set.phi[i]! * (1 - align);
    const drift = fray * smooth(0.45, 0.95, set.edge[i]!);
    const ph7 = set.phi[i]! * 7;
    const ph3 = set.phi[i]! * 3;
    const rip = set.ripple[i]! * 0.0055;
    const rk = set.rippleK[i]!;
    const side = set.side[i]!;
    let o = i * size * 2;
    for (let j = 0; j < size; j += 1) {
      const u = X_MIN + j * du;
      let y = set.centre[b * size + j]! + lane * set.span[b * size + j]!;
      y += rip * Math.sin(rk * u + phi + t * 0.6);
      if (jit > 0.0005) {
        y += jit * (Math.sin(j * 1.9 + ph7 + t * 4.2) + 0.5 * Math.sin(j * 3.7 + ph3 - t * 6.1));
      }
      if (drift > 0) y += drift * side * 0.05 * (0.5 + 0.5 * Math.sin(j * 0.35 + ph7 + t * 0.5));
      if (kink > 0) {
        const d = (u - kinkAt) / 0.2;
        y += kink * 0.12 * side * Math.exp(-d * d) * (0.7 + 0.3 * Math.sin(j * 0.9 + i));
      }
      pos[o] = u;
      pos[o + 1] = clamp(y, -Y_LIMIT, 1 + Y_LIMIT);
      o += 2;
    }
  }

  // How each strand looks. A calm room shows a few whole ribbons with a lot of space between them; a
  // tense one shows every ribbon, gathered. Whole ribbons come and go, never single hairlines.
  // Brightness here is a share of the canvas: the page then caps the canvas as a whole (world.css).
  const presence = 0.55 + 0.45 * P;
  const ribbons = lerp(0.46, 1.04, smooth(0.08, 0.75, T)) * presence;
  const strands = lerp(0.86, 1.06, T);
  const body = lerp(0.88, 1, Math.pow(T, 0.8)) * (0.14 + 0.86 * P);
  for (let b = 0; b < set.bundles; b += 1)
    set.gate[b] = clamp((ribbons - set.rank[b]!) / 0.16, 0, 1);
  for (let i = 0; i < count; i += 1) {
    const b = set.bundle[i]!;
    const gate = set.gate[b]! * clamp((strands - set.order[i]!) / 0.16, 0, 1);
    world.alpha[i] = gate * (0.62 + 0.38 * set.depth[b]!) * body;
    world.width[i] = (0.8 + 0.7 * set.depth[b]!) * set.line[i]! * lerp(1, 0.85, T);
    // Colour wanders a little more toward cool than toward warm, so a calm room stays sage and aqua.
    const tone = set.hue[b]! * 0.6 + set.tone[i]! * 0.4;
    world.warmth[i] = clamp(W + (tone < 0 ? tone * 0.14 : tone * 0.05) - 0.18 * R, 0, 1);
    world.fray[i] = fray * smooth(0.45, 0.95, set.edge[i]!) * (0.75 + 0.25 * set.tone[i]!);
  }
}

function kinkEnvelope(p: number): number {
  const rise = smooth(0, 0.12, p);
  const fall = (1 - p) * (1 - p);
  return rise * fall * (1 + 0.35 * Math.cos(p * 11));
}

/** Travelling lights: a few slow points of light that carry along the strands. */
function moveLights(world: World, dt: number) {
  const { lights, lightCount, set, count, state } = world;
  const activity = clamp(0.35 + 0.65 * state.energy * 1.4, 0, 1) * (0.3 + 0.7 * state.intensity);
  const speed = 0.025 + 0.09 * state.energy * (1 - 0.45 * state.rec);
  for (let l = 0; l < lightCount; l += 1) {
    const at = l * 3;
    let along = lights[at + 1]! + dt * speed * set.lightSpeed[l]!;
    if (along > 1.12) {
      along = -0.12;
      set.lightGen[l] = (set.lightGen[l]! + 1) & 0xffff;
      // A new strand, and one that can be seen: the first of a few draws that is lit.
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const pick =
          Math.floor(noise(world.seed, `L${l}.${set.lightGen[l]}.${attempt}`) * count) % count;
        lights[at] = pick;
        if (world.alpha[pick]! > 0.25) break;
      }
    }
    lights[at + 1] = along;
    const shown = smooth(l / lightCount, l / lightCount + 0.35, activity);
    lights[at + 2] = shown * smooth(0, 0.14, along) * smooth(1, 0.86, along);
  }
}

/** Starts a one-off event. `at` is in field coordinates (0..1). Replaces one that is running. */
export function startPulse(world: World, kind: WorldPulseKind, at?: WorldPoint): void {
  if (world.count === 0) return;
  const p = world.pulse;
  p.kind = kind === 'discovery' ? 1 : 2;
  p.age = 0;
  p.x = at && Number.isFinite(at.x) ? clamp(at.x, 0, 1) : world.state.fx;
  p.y = at && Number.isFinite(at.y) ? clamp(at.y, 0, 1) : world.state.fy;
  p.found = 0;
  if (kind !== 'discovery') return;
  // The nearest lit strands to the point, with the place on each that is closest to it.
  const best = new Float32Array(PULSE_STRANDS).fill(Infinity);
  for (let i = 0; i < world.count; i += 1) {
    if (world.alpha[i]! < 0.15) continue;
    const strand = world.views[i]!;
    let near = Infinity;
    let nearAt = 0;
    for (let j = 0; j < world.size; j += 1) {
      const dx = (strand[j * 2]! - p.x) * 1.6;
      const dy = strand[j * 2 + 1]! - p.y;
      const d = dx * dx + dy * dy;
      if (d < near) {
        near = d;
        nearAt = j;
      }
    }
    for (let k = 0; k < PULSE_STRANDS; k += 1) {
      if (near >= best[k]!) continue;
      for (let m = PULSE_STRANDS - 1; m > k; m -= 1) {
        best[m] = best[m - 1]!;
        p.strands[m] = p.strands[m - 1]!;
        p.points[m] = p.points[m - 1]!;
      }
      best[k] = near;
      p.strands[k] = i;
      p.points[k] = nearAt;
      p.found = Math.min(PULSE_STRANDS, p.found + 1);
      break;
    }
  }
}

/** The sum of every strand's visibility: a cheap measure of how much light the field holds. */
export function totalAlpha(world: World): number {
  let sum = 0;
  for (let i = 0; i < world.count; i += 1) sum += world.alpha[i]!;
  return sum;
}
