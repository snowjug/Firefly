import type { TemperatureBandId } from '#shared/domain/vocab.ts';
import { hash32 } from '../../lib/seeded-noise.ts';
import type { TurnMood } from './useCall.ts';

// The filament: the hairline the conversation hangs from. Each turn owns the stretch of it that
// runs from its own point down to the next, drawn once from the customer's mood at that moment, so
// the line records how composed the customer was along the whole call: straight where they were
// calm, swaying, trembling, kinked or broken as they were not. Both ends of every stretch sit on the
// line's centre, so stretches of different moods join without a seam, and nothing is redrawn while
// a mood eases: only a new turn adds a stretch. Pure and deterministic: a turn always draws the
// same line.

export type SpineMood = TemperatureBandId | 'neutral';

/** A stretch is drawn in a box this wide, stretched down to the height of its turn. */
export const SPINE_WIDTH = 44;
/** The drawing height. The box is stretched, so only the proportions matter. */
export const SPINE_HEIGHT = 100;
const CENTRE = SPINE_WIDTH / 2;

type Kind = 'straight' | 'sway' | 'tremor' | 'kinked' | 'broken';

interface Shape {
  kind: Kind;
  /** The furthest the line strays from the centre, in pixels, at its middle. */
  amp: number;
  /** Line weight in pixels. */
  weight: number;
  /** Broken stretches, in pixels along the line; null for a whole line. */
  dash: string | null;
}

const SHAPES: Readonly<Record<SpineMood, Shape>> = {
  neutral: { kind: 'straight', amp: 0, weight: 1, dash: null },
  calm: { kind: 'straight', amp: 0, weight: 1, dash: null },
  concerned: { kind: 'sway', amp: 2.6, weight: 1, dash: null },
  frustrated: { kind: 'tremor', amp: 3.4, weight: 1, dash: null },
  angry: { kind: 'kinked', amp: 5.5, weight: 1.2, dash: null },
  escalating: { kind: 'broken', amp: 7, weight: 1.4, dash: '26 9 11 15 34 8 16 11' },
};

/** Easing back softens the line one step and aligns it: fragments join, kinks relax. */
const EASED: Readonly<Record<Kind, Kind>> = {
  straight: 'straight',
  sway: 'sway',
  tremor: 'sway',
  kinked: 'tremor',
  broken: 'kinked',
};
const EASED_AMP = 0.5;

/** How far a turn that carried a curveball jogs the line sideways, in pixels. */
export const KINK_REACH = 13;
const KINK_AT = 0.32;
const KINK_HALF_WIDTH = 0.11;

/** How tall a turn is taken to be when the caller has no better idea, in pixels. */
export const DEFAULT_HEIGHT = 150;

export interface SpineSegment {
  /** Path data in the (SPINE_WIDTH x SPINE_HEIGHT) box. */
  d: string;
  /** A dash pattern for a line that is broken, or null. */
  dash: string | null;
  /** Kinked and broken lines keep sharp corners; the rest are round. */
  join: 'round' | 'miter';
  weight: number;
  /** The furthest the line strays from the centre, in pixels. */
  reach: number;
}

export interface SpineOptions {
  /** The customer's mood over this stretch. `neutral` (no mood known, or cues off) is straight. */
  mood: SpineMood;
  /** The customer is easing back from a tense state. */
  easing?: boolean;
  /** The turn carried a curveball: the line takes a sharp jog sideways. */
  kink?: boolean;
  /** Anything stable for the turn (its key): the same seed always draws the same line. */
  seed: string;
  /**
   * About how tall the stretch will be, in pixels. The box is stretched to the real height, so
   * this only decides how many bends fit: a tall turn gets more of them, a short one fewer, and the
   * line keeps the same character at any height.
   */
  height?: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** 0 at both ends, so every stretch meets the next on the centre line; 1 through the middle. */
export function envelope(t: number): number {
  return smoothstep(0.12, 0.34, t) * (1 - smoothstep(0.7, 0.94, t));
}

/** A stable number in [0, 1) for a seed and a slot. */
function unit(seed: string, slot: string | number): number {
  return hash32(`${seed}|${slot}`) / 0x100000000;
}

/** How far apart the bends of each kind are along the line, in pixels. */
const WAVELENGTH = { sway: 150, tremorSlow: 62, tremorFast: 24, kinked: 20, broken: 13 } as const;
const SAMPLE_EVERY = { sway: 10, tremor: 5 } as const;

/** The line at `t` (0 to 1) as an offset from the centre, before the envelope is applied. */
function baseOffset(kind: Kind, amp: number, seed: string, height: number): (t: number) => number {
  const phase = unit(seed, 'p') * Math.PI * 2;
  switch (kind) {
    case 'straight':
      return () => 0;
    case 'sway': {
      const cycles = (height / WAVELENGTH.sway) * (0.85 + unit(seed, 'c') * 0.3);
      return (t) => amp * Math.sin(Math.PI * 2 * cycles * t + phase);
    }
    case 'tremor': {
      const slow = (height / WAVELENGTH.tremorSlow) * (0.9 + unit(seed, 'c') * 0.2);
      const fast = (height / WAVELENGTH.tremorFast) * (0.9 + unit(seed, 'f') * 0.2);
      return (t) =>
        amp *
        (0.62 * Math.sin(Math.PI * 2 * slow * t + phase) +
          0.38 * Math.sin(Math.PI * 2 * fast * t + phase * 1.7));
    }
    case 'kinked':
    case 'broken': {
      // Straight runs between sharp corners that swing from one side to the other.
      const count = cornersFor(kind, height);
      const corners = Array.from({ length: count }, (_, i) => {
        const side = i % 2 === 0 ? -1 : 1;
        return side * amp * (0.55 + 0.45 * unit(seed, i));
      });
      return (t) => {
        const at = clamp01(t) * (count - 1);
        const i = Math.min(count - 2, Math.floor(at));
        const from = corners[i] ?? 0;
        const to = corners[i + 1] ?? 0;
        return from + (to - from) * (at - i);
      };
    }
  }
}

/** How many corners a sharp line has over a height. */
function cornersFor(kind: 'kinked' | 'broken', height: number): number {
  const step = kind === 'kinked' ? WAVELENGTH.kinked : WAVELENGTH.broken;
  return Math.max(5, Math.round(height / step) + 1);
}

/** Where the line is sampled: even steps for a smooth line, the corners themselves for a sharp one. */
function samplesFor(kind: Kind, kink: boolean, height: number): number[] {
  let steps = 1;
  if (kind === 'sway') steps = Math.max(12, Math.round(height / SAMPLE_EVERY.sway));
  else if (kind === 'tremor') steps = Math.max(24, Math.round(height / SAMPLE_EVERY.tremor));
  else if (kind === 'kinked' || kind === 'broken') steps = cornersFor(kind, height) - 1;
  const ts = Array.from({ length: steps + 1 }, (_, i) => i / steps);
  if (kink) ts.push(KINK_AT - KINK_HALF_WIDTH, KINK_AT, KINK_AT + KINK_HALF_WIDTH);
  return [...new Set(ts)].sort((a, b) => a - b);
}

const num = (value: number) => {
  const text = value.toFixed(1);
  return text === '-0.0' ? '0' : text.replace(/\.0$/, '');
};

/** The stretch of filament for one turn. Both ends sit on the centre line. */
export function spineSegment({
  mood,
  easing = false,
  kink = false,
  seed,
  height = DEFAULT_HEIGHT,
}: SpineOptions): SpineSegment {
  const shape = SHAPES[mood] ?? SHAPES.neutral;
  const eased = easing && shape.kind !== 'straight';
  const kind = eased ? EASED[shape.kind] : shape.kind;
  const amp = eased ? shape.amp * EASED_AMP : shape.amp;
  const dash = eased ? null : shape.dash;
  const sharp = kind === 'kinked' || kind === 'broken' || kink;
  const tall = Math.min(1200, Math.max(40, height));

  if (kind === 'straight' && !kink) {
    return {
      d: `M${CENTRE} 0V${SPINE_HEIGHT}`,
      dash,
      join: 'round',
      weight: shape.weight,
      reach: 0,
    };
  }

  const offset = baseOffset(kind, amp, seed, tall);
  const sign = unit(seed, 'k') < 0.5 ? -1 : 1;
  let reach = 0;
  const points = samplesFor(kind, kink, tall).map((t) => {
    let x = envelope(t) * offset(t);
    if (kink) x += sign * KINK_REACH * clamp01(1 - Math.abs(t - KINK_AT) / KINK_HALF_WIDTH);
    reach = Math.max(reach, Math.abs(x));
    return `${num(CENTRE + x)} ${num(t * SPINE_HEIGHT)}`;
  });
  return {
    d: `M${points.join('L')}`,
    dash,
    join: sharp ? 'miter' : 'round',
    weight: shape.weight,
    reach,
  };
}

// ---------------------------------------------------------------------------------------
// Which mood each stretch is drawn from

/**
 * The mood each turn's stretch of filament is drawn from. A customer turn takes the mood known at
 * their reply, and a trainee turn the mood of the customer reply before it (the state the message
 * was said into). A turn whose mood the screen never saw is `null`: the line stays straight and
 * plain, which says nothing rather than something untrue.
 */
export function spineMoods(
  turns: readonly { key: string; role: 'customer' | 'trainee' }[],
  known: Readonly<Record<string, TurnMood>>,
): (TurnMood | null)[] {
  let current: TurnMood | null = null;
  return turns.map((turn) => {
    if (turn.role === 'customer') current = known[turn.key] ?? null;
    return current;
  });
}

/**
 * About how tall a turn will be, from its words alone: a line is roughly fifty characters wide and
 * a little over thirty pixels tall, with the gap to the next turn. Only the shape of the filament
 * depends on it (see `SpineOptions.height`), so it need not be exact.
 */
export function estimateHeight(text: string, role: 'customer' | 'trainee'): number {
  const perLine = role === 'customer' ? 46 : 54;
  const lines = text
    .split('\n')
    .reduce((count, line) => count + Math.max(1, Math.ceil(line.length / perLine)), 0);
  return Math.max(1, lines) * 30 + 44;
}
