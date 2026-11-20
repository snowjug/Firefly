import { PULSE_SECONDS, type World } from './world-model.ts';

// Draws the field with Canvas2D. Dark: light is added (`lighter`), so strands glow where they meet.
// Light: ink-safe, ordinary blending with the lights turned to darker tones. Every colour comes from
// the design tokens, read once per theme change (never per frame), and nothing here allocates per
// frame: colour strings are cached and the bloom reuses two small canvases.
//
// What a frame costs is decided here, and the browser's GPU process pays for it, not the page's
// scripts: a stroke exactly one device pixel wide takes a fast hairline path, and a wider one is
// tessellated, which measured about twice as expensive. So every strand is a hairline (brightness
// does the work of weight), a frayed strand is cut into pieces rather than dashed, and the glow is a
// soft, smaller copy of the canvas added back over it instead of a wide stroke under each line.

export type RGB = readonly [number, number, number];

/** The token values the field is coloured from (any CSS colour a browser reports as hex or rgb()). */
export interface FieldTokens {
  aqua: string;
  sage: string;
  amber: string;
  coral: string;
  ember: string;
  field: string;
  ink: string;
}

export const TOKEN_NAMES: Readonly<Record<keyof FieldTokens, string>> = {
  aqua: '--aqua',
  sage: '--sage',
  amber: '--amber',
  coral: '--coral',
  ember: '--ember',
  field: '--field-0',
  ink: '--ink-1',
};

const FALLBACK: Readonly<Record<keyof FieldTokens, string>> = {
  aqua: '#8ed8e6',
  sage: '#92d0b0',
  amber: '#f2c463',
  coral: '#ff7f63',
  ember: '#ee4b4b',
  field: '#060c0f',
  ink: '#ece7da',
};

/** Reads `#rgb`, `#rrggbb`, `rgb()` and `rgba()`. Anything else is not a colour the field knows. */
export function parseColor(text: string | undefined | null): RGB | null {
  const value = (text ?? '').trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(value);
  if (hex) {
    const h = hex[1]!.length === 3 ? hex[1]!.replace(/./g, '$&$&') : hex[1]!;
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const fn = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(value);
  return fn ? [Number(fn[1]), Number(fn[2]), Number(fn[3])] : null;
}

const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const css = (c: RGB) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
const luminance = (c: RGB) => {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
};

/** Where on the warmth scale each light sits: cool aqua, sage (calm), amber, coral, ember. */
const STOPS = [0, 0.4, 0.56, 0.8, 1] as const;
export const RAMP_STEPS = 48;

export interface Palette {
  /** A light theme: ink-safe colours drawn with ordinary blending. */
  readonly light: boolean;
  /** `rgb()` strings along the warmth scale, from cool to hot. */
  readonly ramp: readonly string[];
  /** The same colours as numbers, for the worst-case contrast check. */
  readonly rgb: readonly RGB[];
  /** A paler (on dark) or deeper (on light) version of each colour, for the travelling lights. */
  readonly pale: readonly string[];
  /** The amber light, and the same colour with no opacity (the end of a gradient that fades out). */
  readonly amber: string;
  readonly amberClear: string;
}

/** The colours for a theme, from raw token values. Pure, so tests can use the real tokens. */
export function buildPalette(tokens: Partial<FieldTokens>): Palette {
  const t = (key: keyof FieldTokens) => parseColor(tokens[key]) ?? parseColor(FALLBACK[key])!;
  const light = luminance(t('field')) > 0.4;
  const ink = t('ink');
  // On a light field the lights are turned toward ink so a hairline stays visible and ink-safe.
  const tone = (c: RGB): RGB => (light ? mix(c, ink, 0.3) : c);
  const stops = [t('aqua'), t('sage'), t('amber'), t('coral'), t('ember')].map(tone);
  const rgb: RGB[] = [];
  for (let k = 0; k < RAMP_STEPS; k += 1) {
    const w = k / (RAMP_STEPS - 1);
    let s = 0;
    while (s < STOPS.length - 2 && w > STOPS[s + 1]!) s += 1;
    rgb.push(mix(stops[s]!, stops[s + 1]!, (w - STOPS[s]!) / (STOPS[s + 1]! - STOPS[s]!)));
  }
  const amber = tone(t('amber'));
  return {
    light,
    ramp: rgb.map(css),
    rgb,
    pale: rgb.map((c) => css(light ? mix(c, ink, 0.35) : mix(c, [255, 246, 226], 0.6))),
    amber: css(amber),
    amberClear: css(amber).replace('rgb(', 'rgba(').replace(')', ',0)'),
  };
}

/** Reads the tokens from the page. Call it when the theme changes, not every frame. */
export function readPalette(root: HTMLElement = document.documentElement): Palette {
  const style = getComputedStyle(root);
  const tokens: Partial<FieldTokens> = {};
  for (const key of Object.keys(TOKEN_NAMES) as (keyof FieldTokens)[]) {
    tokens[key] = style.getPropertyValue(TOKEN_NAMES[key]).trim();
  }
  return buildPalette(tokens);
}

export interface View {
  w: number;
  h: number;
  /** Device pixels per CSS pixel. */
  dpr: number;
  /** CSS pixels the strands' run covers across: at least the window, wider on tall windows. */
  span: number;
}

/** How wide the strands' run is on a window of this size (a phone sees the middle of a longer run). */
export const spanFor = (w: number, h: number) => Math.max(w, 1.3 * h);
/** Field x (0..1 across the run) to window x in CSS pixels. */
export const toPx = (view: View, x: number) => view.w / 2 + (x - 0.5) * view.span;
/** A window position (0..1) to field coordinates, for `focus` and for the place of a pulse. */
export const windowToField = (view: View, x: number) => 0.5 + (x - 0.5) * (view.w / view.span);

/** What the pointer is doing to the field (fine pointers only): strands near it brighten. */
export interface PointerLight {
  x: number;
  y: number;
  /** 0 to 1: how much of it shows (it fades in on arrival and out after a while). */
  k: number;
}

/**
 * A strand is brighter in the canvas than its model says: the page caps the whole canvas
 * (`--world-cap`, checked in the legibility test against a fully white pile-up), so the brightness
 * in here is free to be generous without making any text harder to read.
 */
const GAIN = { dark: 1.6, light: 1.4 } as const;
/** How much of the soft copy is added back (the bloom), by theme. */
const BLOOM = { dark: 1.15, light: 0.6 } as const;
/** A travelling light: the tail's reach in points and its opacity, longest first. */
const COMET: readonly (readonly [number, number])[] = [
  [7, 0.14],
  [4, 0.3],
  [1.8, 0.7],
];
/** A frayed strand is a run of pieces, long then short, drifting along it (in points). */
const FRAY_CYCLE = 7;
/** The pointer's reach (twice the variance of a 130 px bell) and how much it brightens at most. */
const LENS_REACH = 2 * 130 * 130;
const LENS_GAIN = 1.6;
const TAU = Math.PI * 2;

const spot = [0, 0];

interface Soft {
  half: HTMLCanvasElement;
  quarter: HTMLCanvasElement;
  halfCtx: CanvasRenderingContext2D;
  quarterCtx: CanvasRenderingContext2D;
  owner: CanvasRenderingContext2D;
}
let soft: Soft | null = null;

function softOf(ctx: CanvasRenderingContext2D): Soft | null {
  if (soft?.owner === ctx) return soft;
  const half = document.createElement('canvas');
  const quarter = document.createElement('canvas');
  const halfCtx = half.getContext('2d');
  const quarterCtx = quarter.getContext('2d');
  soft = halfCtx && quarterCtx ? { half, quarter, halfCtx, quarterCtx, owner: ctx } : null;
  return soft;
}

/** Adds a soft, smaller copy of what is drawn back over it: light bleeding from the strands. */
function bloom(ctx: CanvasRenderingContext2D, strength: number, light: boolean) {
  const s = softOf(ctx);
  if (!s) return;
  const { width: cw, height: ch } = ctx.canvas;
  const hw = Math.max(1, cw >> 1);
  const hh = Math.max(1, ch >> 1);
  const qw = Math.max(1, cw >> 2);
  const qh = Math.max(1, ch >> 2);
  if (s.half.width !== hw || s.half.height !== hh) {
    s.half.width = hw;
    s.half.height = hh;
    s.quarter.width = qw;
    s.quarter.height = qh;
  }
  // Two halvings, not one quarter: a one-pixel line would fall between the samples of a single step.
  s.halfCtx.globalCompositeOperation = 'copy';
  s.halfCtx.drawImage(ctx.canvas, 0, 0, hw, hh);
  s.quarterCtx.globalCompositeOperation = 'copy';
  s.quarterCtx.drawImage(s.half, 0, 0, qw, qh);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = light ? 'source-over' : 'lighter';
  ctx.globalAlpha = strength;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(s.quarter, 0, 0, cw, ch);
}

/** The window position of a (fractional) point on a strand, written to `spot`. */
function pointOn(world: World, view: View, strand: number, at: number) {
  const { size, pos } = world;
  const j = Math.min(size - 2, Math.max(0, Math.floor(at)));
  const f = at - j;
  const o = strand * size * 2 + j * 2;
  spot[0] = toPx(view, pos[o]! * (1 - f) + pos[o + 2]! * f);
  spot[1] = (pos[o + 1]! * (1 - f) + pos[o + 3]! * f) * view.h;
}

/** Adds the part of a strand between two (fractional) point positions to the current path. */
function piece(
  ctx: CanvasRenderingContext2D,
  world: World,
  view: View,
  strand: number,
  from: number,
  to: number,
) {
  const a = Math.max(0, from);
  const b = Math.min(world.size - 1, to);
  if (b <= a) return;
  const o = strand * world.size * 2;
  pointOn(world, view, strand, a);
  ctx.moveTo(spot[0]!, spot[1]!);
  for (let j = Math.floor(a) + 1; j < b; j += 1) {
    ctx.lineTo(toPx(view, world.pos[o + j * 2]!), world.pos[o + j * 2 + 1]! * view.h);
  }
  pointOn(world, view, strand, b);
  ctx.lineTo(spot[0]!, spot[1]!);
}

/**
 * Adds a whole strand to the current path. `round` is how much of each corner is rounded off: all of
 * it (1) is a smooth curve through the midpoints of the points, none (0) leaves the corners sharp.
 */
function whole(
  ctx: CanvasRenderingContext2D,
  world: World,
  view: View,
  strand: number,
  round: number,
) {
  const { size, pos } = world;
  const x0 = toPx(view, 0);
  const sx = view.span;
  const h = view.h;
  const o = strand * size * 2;
  ctx.moveTo(x0 + pos[o]! * sx, pos[o + 1]! * h);
  for (let j = 1; j < size - 1; j += 1) {
    const p = o + j * 2;
    const x = x0 + pos[p]! * sx;
    const y = pos[p + 1]! * h;
    if (round < 0.02) {
      ctx.lineTo(x, y);
      continue;
    }
    const k = 0.5 * round;
    // From a point a fraction of the way back along the incoming segment, a curve around the corner
    // to the same fraction along the outgoing one. At full rounding the two meet at the midpoints.
    if (round < 0.98) {
      ctx.lineTo(x - (x - (x0 + pos[p - 2]! * sx)) * k, y - (y - pos[p - 1]! * h) * k);
    }
    ctx.quadraticCurveTo(x, y, x + (x0 + pos[p + 2]! * sx - x) * k, y + (pos[p + 3]! * h - y) * k);
  }
  const end = o + (size - 1) * 2;
  ctx.lineTo(x0 + pos[end]! * sx, pos[end + 1]! * h);
}

/** How much the pointer brightens a strand: the bell of the nearest of its points to the pointer. */
function lensOf(world: World, view: View, strand: number, light: PointerLight): number {
  const { size, pos } = world;
  const x0 = toPx(view, 0);
  const o = strand * size * 2;
  let near = Infinity;
  for (let j = 0; j < size; j += 1) {
    const dx = x0 + pos[o + j * 2]! * view.span - light.x;
    const dy = pos[o + j * 2 + 1]! * view.h - light.y;
    const d = dx * dx + dy * dy;
    if (d < near) near = d;
  }
  return light.k * Math.exp(-near / LENS_REACH);
}

export function drawWorld(
  ctx: CanvasRenderingContext2D,
  world: World,
  view: View,
  palette: Palette,
  pointer: PointerLight | null,
): void {
  const { w, h, dpr } = view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (world.count === 0) return;
  const light = palette.light;
  ctx.globalCompositeOperation = light ? 'source-over' : 'lighter';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'butt';
  ctx.lineWidth = 1 / dpr;
  const gain = light ? GAIN.light : GAIN.dark;
  const { size, alpha, warmth, fray } = world;
  const round = Math.max(0, Math.min(1, 1 - world.crisp * 1.2));
  const lens = pointer && pointer.k > 0.02 ? pointer : null;

  for (let i = 0; i < world.count; i += 1) {
    let a = alpha[i]! * gain;
    if (a < 0.012) continue;
    if (lens) a *= 1 + LENS_GAIN * lensOf(world, view, i, lens);
    ctx.strokeStyle = palette.ramp[Math.round(warmth[i]! * (RAMP_STEPS - 1))]!;
    ctx.globalAlpha = Math.min(1, a);
    ctx.beginPath();
    const gap = fray[i]!;
    if (gap > 0.04) {
      // Pieces of the strand, long then short, drifting slowly along it.
      const long = FRAY_CYCLE * (0.62 - 0.4 * gap);
      const short = FRAY_CYCLE * (0.3 - 0.18 * gap);
      const phase = (world.time * 0.5 + i * 0.37) % FRAY_CYCLE;
      for (let s = phase - FRAY_CYCLE; s < size; s += FRAY_CYCLE) {
        piece(ctx, world, view, i, s, s + long);
        const next = s + long + FRAY_CYCLE * 0.12;
        piece(ctx, world, view, i, next, next + short);
      }
    } else whole(ctx, world, view, i, round);
    ctx.stroke();
  }

  // Travelling lights: a short comet along a strand with a point at its head.
  for (let l = 0; l < world.lightCount; l += 1) {
    const level = world.lights[l * 3 + 2]!;
    const strand = world.lights[l * 3]!;
    const a = alpha[strand]!;
    if (level < 0.02 || a < 0.02) continue;
    const head = world.lights[l * 3 + 1]! * (size - 1);
    ctx.strokeStyle = ctx.fillStyle = palette.pale[Math.round(warmth[strand]! * (RAMP_STEPS - 1))]!;
    for (const [reach, strength] of COMET) {
      ctx.globalAlpha = Math.min(1, level * (0.5 + a) * strength * gain * 1.5);
      ctx.beginPath();
      piece(ctx, world, view, strand, head - reach, head);
      ctx.stroke();
    }
    if (head >= 0 && head <= size - 1) {
      pointOn(world, view, strand, head);
      ctx.globalAlpha = Math.min(1, level * (0.6 + a) * gain);
      ctx.beginPath();
      ctx.arc(spot[0]!, spot[1]!, 1.8, 0, TAU);
      ctx.fill();
    }
  }

  drawPulse(ctx, world, view, palette, gain);

  bloom(ctx, light ? BLOOM.light : BLOOM.dark, light);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
}

/** A discovery: a warm bloom spreads along the nearest strands from the point, then is gone. */
function drawPulse(
  ctx: CanvasRenderingContext2D,
  world: World,
  view: View,
  palette: Palette,
  gain: number,
) {
  const p = world.pulse;
  if (p.kind !== 1) return;
  const t = p.age / PULSE_SECONDS;
  const swell = Math.sin(Math.PI * Math.min(1, t));
  const reach = 1 - Math.pow(1 - t, 2.4);
  ctx.strokeStyle = palette.amber;
  ctx.lineCap = 'round';
  // The page caps the whole canvas, so an event has to be bold in here to be seen out there.
  for (let k = 0; k < p.found; k += 1) {
    const at = p.points[k]!;
    const strength = swell * (1 - k * 0.07) * gain;
    ctx.beginPath();
    piece(ctx, world, view, p.strands[k]!, at - 0.5 - 9 * reach, at + 0.5 + 9 * reach);
    ctx.lineWidth = 8;
    ctx.globalAlpha = Math.min(1, strength * 0.22);
    ctx.stroke();
    ctx.lineWidth = 2.6 - k * 0.1;
    ctx.globalAlpha = Math.min(1, strength);
    ctx.stroke();
  }
  const cx = toPx(view, p.x);
  const cy = p.y * view.h;
  const radius = 90 + 150 * reach;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  g.addColorStop(0, palette.amber);
  g.addColorStop(1, palette.amberClear);
  ctx.globalAlpha = swell * (palette.light ? 0.6 : 0.95);
  ctx.fillStyle = g;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  ctx.lineCap = 'butt';
  ctx.lineWidth = 1 / view.dpr;
}
