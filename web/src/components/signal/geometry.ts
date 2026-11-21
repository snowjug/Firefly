import type {
  BusinessImpact,
  CallStage,
  Difficulty,
  StartTemperature,
} from '#shared/domain/vocab.ts';
import type { GlyphTraits } from './types.ts';

// The geometry of the signal instrument as plain numbers and path strings: no DOM, no React, so it
// can be tested and so a glyph is the same everywhere it is drawn. A glyph is drawn in a box of 92
// units; the scale is whatever size it is shown at, and the parts that have to stay legible when it
// is small (line widths, the heart, how many dashes and teeth the edge has) are worked out in
// pixels, the way type is optically sized.

export const TAU = Math.PI * 2;

export const clamp = (value: number, low = 0, high = 1): number =>
  Number.isNaN(value) ? low : Math.min(high, Math.max(low, value));
export const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;
export const smoothstep = (low: number, high: number, value: number): number => {
  const t = clamp((value - low) / (high - low));
  return t * t * (3 - 2 * t);
};

/** Two decimals, no "-0": short, stable path strings. */
export const num = (value: number): number => {
  const rounded = Math.round(value * 100) / 100;
  return rounded === 0 ? 0 : rounded;
};

/** "x y" for a radius and an angle (radians, 0 at 3 o'clock, clockwise because y points down). */
export const pt = (radius: number, angle: number): string =>
  `${num(radius * Math.cos(angle))} ${num(radius * Math.sin(angle))}`;

export const TOP = -Math.PI / 2;

// ------------------------------------------------------------------------------------------
// The grammar

/** Overall size: business impact. Multiplies every ring radius. */
export const IMPACT_SCALE: Record<BusinessImpact, number> = { low: 0.36, medium: 0.44, high: 0.52 };
/** Rings: difficulty. */
export const RING_COUNT: Record<Difficulty, 1 | 2 | 3> = { starter: 1, standard: 2, challenge: 3 };
/** Radii of the outer, middle and inner ring before the impact scale. */
export const RING_RADII = [62, 46, 30] as const;
/** One tick is one minute; a full circle is fifteen. */
export const TICK_COUNT = 15;

export const GLYPH_BOX = 92;
export const GLYPH_HALF = GLYPH_BOX / 2;

export const clampMinutes = (minutes: number): number =>
  Number.isFinite(minutes) ? Math.max(0, Math.min(TICK_COUNT, Math.round(minutes))) : 0;

// ------------------------------------------------------------------------------------------
// The heart: stage is its shape, status is its fill

export type HeartShapeName = 'circle' | 'diamond' | 'triangle' | 'square';

export const HEART_SHAPES: Record<CallStage, HeartShapeName> = {
  'first-contact': 'circle',
  'follow-up': 'diamond',
  escalated: 'triangle',
  closure: 'square',
};

/** A circle, a diamond, a triangle and a square of about the same visual weight at radius `r`. */
export function heartPath(stage: CallStage, r: number): string {
  switch (HEART_SHAPES[stage] ?? 'circle') {
    case 'diamond': {
      const q = r * 1.18;
      return `M0 ${num(-q)}L${num(q)} 0L0 ${num(q)}L${num(-q)} 0Z`;
    }
    case 'triangle': {
      const q = r * 1.3;
      return `M0 ${num(-q)}L${num(q * 0.866)} ${num(q * 0.5)}L${num(-q * 0.866)} ${num(q * 0.5)}Z`;
    }
    case 'square': {
      const s = r * 0.9;
      return `M${num(-s)} ${num(-s)}H${num(s)}V${num(s)}H${num(-s)}Z`;
    }
    default:
      return `M${num(-r)} 0A${num(r)} ${num(r)} 0 1 0 ${num(r)} 0A${num(r)} ${num(r)} 0 1 0 ${num(-r)} 0Z`;
  }
}

/** The left half of the same shape: the fill of a mission that was started and not finished. */
export function heartHalfPath(stage: CallStage, r: number): string {
  switch (HEART_SHAPES[stage] ?? 'circle') {
    case 'diamond': {
      const q = r * 1.18;
      return `M0 ${num(-q)}L${num(-q)} 0L0 ${num(q)}Z`;
    }
    case 'triangle': {
      const q = r * 1.3;
      return `M0 ${num(-q)}L${num(-q * 0.866)} ${num(q * 0.5)}L0 ${num(q * 0.5)}Z`;
    }
    case 'square': {
      const s = r * 0.9;
      return `M0 ${num(-s)}H${num(-s)}V${num(s)}H0Z`;
    }
    default:
      return `M0 ${num(-r)}A${num(r)} ${num(r)} 0 0 0 0 ${num(r)}Z`;
  }
}

// ------------------------------------------------------------------------------------------
// The outer edge: how the customer starts

export type EdgeKind = 'smooth' | 'round-dashes' | 'long-short' | 'serrated';

export const EDGE_KINDS: Record<StartTemperature, EdgeKind> = {
  calm: 'smooth',
  anxious: 'round-dashes',
  frustrated: 'long-short',
  angry: 'serrated',
};

export type EdgeShape =
  | { kind: 'smooth'; radius: number }
  | { kind: 'round-dashes' | 'long-short'; radius: number; dasharray: string; round: boolean }
  | { kind: 'serrated'; d: string };

/** The dash pattern, in units, whose cycles are scaled so a whole number of them fits the ring. */
function fitDashes(
  pattern: readonly number[],
  circumference: number,
  circumferencePx: number,
  minCyclePx: number,
): string {
  const cycle = pattern.reduce((sum, part) => sum + part, 0);
  const wanted = Math.round(circumference / cycle);
  const legible = Math.floor(circumferencePx / minCyclePx);
  const cycles = Math.max(3, Math.min(wanted, legible));
  return pattern.map((part) => num((part * circumference) / cycles / cycle)).join(' ');
}

/** A closed zig-zag around `radius`: `teeth` points out and `teeth` in, `amplitude` either side. */
export function serratedPath(radius: number, teeth: number, amplitude: number): string {
  let d = '';
  for (let i = 0; i < teeth * 2; i += 1) {
    const angle = TOP + (i / (teeth * 2)) * TAU;
    d += `${i === 0 ? 'M' : 'L'}${pt(radius + (i % 2 === 1 ? amplitude : -amplitude), angle)}`;
  }
  return `${d}Z`;
}

/**
 * The edge for a starting temperature. `scale` is pixels per unit, so a small glyph gets fewer,
 * larger dashes and teeth instead of a blur.
 */
export function edgeShape(start: StartTemperature, radius: number, scale: number): EdgeShape {
  const kind = EDGE_KINDS[start] ?? 'smooth';
  const circumference = TAU * radius;
  const circumferencePx = circumference * scale;
  switch (kind) {
    case 'round-dashes':
      return {
        kind,
        radius,
        // A near-zero dash with round caps is a dot as wide as the line.
        dasharray: fitDashes([0.01, 3.99], circumference, circumferencePx, 3.4),
        round: true,
      };
    case 'long-short':
      return {
        kind,
        radius,
        dasharray: fitDashes([8, 3, 2, 3], circumference, circumferencePx, 9),
        round: false,
      };
    case 'serrated': {
      const wanted = Math.round(circumference / 5);
      const legible = Math.floor(circumferencePx / 3.2);
      const teeth = Math.max(8, Math.min(Math.max(12, wanted), legible));
      return { kind, d: serratedPath(radius, teeth, Math.max(1.9, 1.25 / scale)) };
    }
    default:
      return { kind: 'smooth', radius };
  }
}

// ------------------------------------------------------------------------------------------
// Ticks and glint

/** Fifteen ticks round the rim from the top; every fifth is long. Those below `minutes` are lit. */
export function tickPaths(
  minutes: number,
  inner: number,
  short: number,
  long: number,
): { on: string; off: string } {
  const lit = clampMinutes(minutes);
  let on = '';
  let off = '';
  for (let i = 0; i < TICK_COUNT; i += 1) {
    const angle = TOP + (i * TAU) / TICK_COUNT;
    const length = (i + 1) % 5 === 0 ? long : short;
    const segment = `M${pt(inner, angle)}L${pt(inner + length, angle)}`;
    if (i < lit) on += segment;
    else off += segment;
  }
  return { on, off };
}

/** The four-point glint: long strokes at the compass points and short ones between them. */
export function glintPaths(radius: number): { cardinal: string; diagonal: string } {
  const near = radius + 7;
  const far = radius + 21;
  const mid = radius + 12;
  const a = mid * 0.7;
  const b = mid * 0.9;
  return {
    cardinal: `M0 ${num(-near)}V${num(-far)}M0 ${num(near)}V${num(far)}M${num(-near)} 0H${num(-far)}M${num(near)} 0H${num(far)}`,
    diagonal: `M${num(a)} ${num(-a)}L${num(b)} ${num(-b)}M${num(-a)} ${num(a)}L${num(-b)} ${num(b)}M${num(a)} ${num(a)}L${num(b)} ${num(b)}M${num(-a)} ${num(-a)}L${num(-b)} ${num(-b)}`,
  };
}

// ------------------------------------------------------------------------------------------
// A whole glyph

export interface GlyphModel {
  box: number;
  /** Pixels per unit. */
  scale: number;
  /** True when the glyph is small enough that detail has been traded for legibility. */
  compact: boolean;
  radius: number;
  /** Radii of the plain rings inside the edge, outermost first. */
  rings: number[];
  edge: EdgeShape;
  heart: { d: string; half: string | null; solid: boolean; radius: number };
  ticks: { on: string; off: string | null };
  glint: { cardinal: string; diagonal: string } | null;
  width: { hair: number; edge: number; tick: number; heart: number; glint: number };
}

/** Below this many pixels the glyph is drawn in its compact, high-contrast form. */
export const COMPACT_BELOW = 64;
/** Below this the faint ghost ticks are left out: they would only add noise. */
const GHOST_BELOW = 40;

export function buildGlyph(traits: GlyphTraits, size: number): GlyphModel {
  const safeSize = Number.isFinite(size) && size > 0 ? size : GLYPH_BOX;
  const scale = safeSize / GLYPH_BOX;
  const px = (pixels: number) => pixels / scale;
  const compact = safeSize < COMPACT_BELOW;

  const impact = IMPACT_SCALE[traits.impact] ?? IMPACT_SCALE.medium;
  const count = RING_COUNT[traits.difficulty] ?? 2;

  // The ticks sit outside the edge. Their reach is fixed in pixels when small, so the biggest
  // glyph has to be fitted to the box and the others shrink by the same factor (keeping the
  // differences in size).
  const tickGap = compact ? Math.max(3, px(1.6)) : 3;
  const shortTick = compact ? Math.max(3.2, px(2.1)) : 3.2;
  const longTick = compact ? Math.max(5.4, px(3.4)) : 5.4;
  const room = GLYPH_HALF - 0.6 - tickGap - longTick;
  const fit = Math.min(1, room / (RING_RADII[0] * IMPACT_SCALE.high));

  const all = RING_RADII.slice(0, count).map((radius) => radius * impact * fit);
  const radius = all[0] ?? 0;
  const innermost = all[all.length - 1] ?? radius;

  const width = {
    hair: px(compact ? 1.1 : 1),
    edge: px(compact ? 1.4 : 1.2),
    tick: px(compact ? 1.3 : 1.15),
    heart: px(compact ? 1.5 : 1.3),
    glint: px(compact ? 1.3 : 1.1),
  };

  const wanted = 14 * impact * fit;
  const heartRadius = compact
    ? Math.min(Math.max(wanted, px(2.5)), Math.max(innermost - px(1.7), px(1.4)))
    : wanted;
  const half = traits.status === 'attempted' ? heartHalfPath(traits.stage, heartRadius) : null;

  const ticks = tickPaths(traits.minutes, radius + tickGap, shortTick, longTick);
  const edge = edgeShape(traits.start, radius, scale);

  return {
    box: GLYPH_BOX,
    scale,
    compact,
    radius,
    rings: all.slice(1),
    edge,
    heart: {
      d: heartPath(traits.stage, heartRadius),
      half,
      solid: traits.status === 'completed',
      radius: heartRadius,
    },
    ticks: { on: ticks.on, off: safeSize < GHOST_BELOW ? null : ticks.off },
    glint: traits.recommended ? glintPaths(radius) : null,
    width,
  };
}
