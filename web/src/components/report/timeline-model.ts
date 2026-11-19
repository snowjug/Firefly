import type { JourneyPoint } from '#shared/domain/report.ts';
import {
  TEMPERATURE_BANDS,
  temperatureBand,
  type TemperatureBandId,
} from '#shared/domain/vocab.ts';

// Pure logic behind the customer temperature timeline: which band a point sits in, how it moved,
// what to say about it and where to draw it. Kept free of React so it can be tested directly.

export type PointKind = JourneyPoint['kind'];
export type Direction = 'start' | 'rose' | 'eased' | 'steady';

export interface BandInfo {
  id: TemperatureBandId;
  label: string;
  /** 0 is the calmest band, 4 the most heated. */
  index: number;
}

export const BANDS: readonly BandInfo[] = TEMPERATURE_BANDS.map((band, index) => ({
  id: band.id,
  label: band.label,
  index,
}));

/** Used in the detail panel (chips are only shown for the notable kinds). */
export const KIND_LABELS: Record<PointKind, string> = {
  start: 'Start of the call',
  turn: 'Customer reply',
  'turning-point': 'Turning point',
  curveball: 'Curveball',
  end: 'End of the call',
};

/** Short names for the legend. */
export const KIND_LEGEND: Record<PointKind, string> = {
  start: 'Start',
  turn: 'Turn',
  'turning-point': 'Turning point',
  curveball: 'Curveball',
  end: 'End',
};

export const DIRECTION_LABELS: Record<Direction, string> = {
  start: 'Start',
  rose: 'Rose',
  eased: 'Eased',
  steady: 'Held steady',
};

/** Moves smaller than this inside one band are described as holding steady. */
const STEADY_DELTA = 3;
const BAND_COUNT = BANDS.length;

export function bandOf(point: Pick<JourneyPoint, 'temperature'>): BandInfo {
  const id = temperatureBand(point.temperature).id;
  return BANDS.find((band) => band.id === id) ?? (BANDS[0] as BandInfo);
}

export interface Moment {
  index: number;
  point: JourneyPoint;
  turn: number;
  band: BandInfo;
  direction: Direction;
  /** "Rose", "Eased", "Held steady" or "Start". */
  directionLabel: string;
  /** A full sentence, for example "Rose from Frustrated to Angry." */
  change: string;
  /** Present for the kinds worth a chip (everything except an ordinary turn). */
  kindLabel: string | null;
  /** Accessible name for the point's button. */
  name: string;
}

function directionOf(
  point: JourneyPoint,
  band: BandInfo,
  previousBand: BandInfo | null,
): Direction {
  if (!previousBand) return 'start';
  if (band.index !== previousBand.index) return band.index > previousBand.index ? 'rose' : 'eased';
  if (point.delta >= STEADY_DELTA) return 'rose';
  if (point.delta <= -STEADY_DELTA) return 'eased';
  return 'steady';
}

function changeSentence(
  direction: Direction,
  band: BandInfo,
  previousBand: BandInfo | null,
): string {
  if (direction === 'start') return `The customer started ${band.label}.`;
  if (direction === 'steady') return `Held steady at ${band.label}.`;
  const verb = direction === 'rose' ? 'Rose' : 'Eased';
  return previousBand && previousBand.index !== band.index
    ? `${verb} from ${previousBand.label} to ${band.label}.`
    : `${verb}, still ${band.label}.`;
}

export function buildMoments(points: readonly JourneyPoint[]): Moment[] {
  const ordered = [...points].sort((a, b) => a.turnIndex - b.turnIndex);
  return ordered.map((point, index) => {
    const previous = index > 0 ? ordered[index - 1] : undefined;
    const band = bandOf(point);
    const previousBand = previous ? bandOf(previous) : null;
    const direction = directionOf(point, band, previousBand);
    const kindLabel =
      point.kind === 'turn' || (point.kind === 'start' && index === 0)
        ? null
        : KIND_LABELS[point.kind];
    const parts = [
      `Turn ${point.turnIndex}`,
      band.label,
      direction === 'start' ? 'start of the call' : DIRECTION_LABELS[direction].toLowerCase(),
    ];
    if (kindLabel && direction !== 'start') parts.push(kindLabel.toLowerCase());
    return {
      index,
      point,
      turn: point.turnIndex,
      band,
      direction,
      directionLabel: DIRECTION_LABELS[direction],
      change: changeSentence(direction, band, previousBand),
      kindLabel,
      name: parts.join(', '),
    };
  });
}

/**
 * One calm sentence fragment describing the whole journey, for example
 * "started Frustrated, peaked Angry at turn 6, ended Calm". It only names bands, never raw numbers.
 */
export function summariseJourney(moments: readonly Moment[]): string {
  const first = moments[0];
  const last = moments[moments.length - 1];
  if (!first || !last) return 'no points were recorded';
  if (moments.length === 1) return `was ${first.band.label}`;
  if (moments.every((m) => m.band.index === first.band.index)) {
    return `stayed ${first.band.label} throughout`;
  }
  const interior = moments.slice(1, -1);
  let peak: Moment | undefined;
  let low: Moment | undefined;
  for (const m of interior) {
    if (!peak || m.point.temperature > peak.point.temperature) peak = m;
    if (!low || m.point.temperature < low.point.temperature) low = m;
  }
  const extremes: { turn: number; text: string }[] = [];
  if (peak && peak.band.index > Math.max(first.band.index, last.band.index)) {
    extremes.push({ turn: peak.turn, text: `peaked ${peak.band.label} at turn ${peak.turn}` });
  }
  if (low && low.band.index < Math.min(first.band.index, last.band.index)) {
    extremes.push({ turn: low.turn, text: `dipped to ${low.band.label} at turn ${low.turn}` });
  }
  extremes.sort((a, b) => a.turn - b.turn);
  return [
    `started ${first.band.label}`,
    ...extremes.map((e) => e.text),
    `ended ${last.band.label}`,
  ].join(', ');
}

export function journeyAriaLabel(moments: readonly Moment[]): string {
  return `Customer mood timeline: ${summariseJourney(moments)}.`;
}

/** The point to show first: where the customer's mood moved most, otherwise the last point. */
export function defaultSelection(moments: readonly Moment[]): number {
  let best = -1;
  let bestSize = 0;
  moments.forEach((m, i) => {
    if (i === 0) return;
    const size = Math.abs(m.point.delta);
    if (size > bestSize) {
      best = i;
      bestSize = size;
    }
  });
  if (best >= 0) return best;
  return Math.max(0, moments.length - 1);
}

// ---------------------------------------------------------------------------------------
// Geometry

export interface ChartLayout {
  width: number;
  height: number;
  compact: boolean;
  /** True when points are too close together to give every one its own breathing room. */
  dense: boolean;
  plot: { left: number; right: number; top: number; bottom: number };
  bandHeight: number;
  xs: number[];
  ys: number[];
  step: number;
  markerSize: number;
  tickY: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function layoutChart(moments: readonly Moment[], width: number): ChartLayout {
  const compact = width < 440;
  const gutter = compact ? 82 : 102;
  const bandHeight = compact ? 36 : 44;
  const top = 14;
  const plotHeight = bandHeight * BAND_COUNT;
  const left = gutter;
  const right = width - (compact ? 14 : 22);
  const pad = compact ? 10 : 18;
  const x0 = left + pad;
  const x1 = Math.max(x0, right - pad);
  const count = moments.length;
  const step = count > 1 ? (x1 - x0) / (count - 1) : 0;
  const bottom = top + plotHeight;
  return {
    width,
    height: bottom + 36,
    compact,
    dense: count > 1 && step < 22,
    plot: { left, right, top, bottom },
    bandHeight,
    xs: moments.map((_, i) => (count > 1 ? x0 + step * i : (x0 + x1) / 2)),
    ys: moments.map((m) => bottom - (clamp(m.point.temperature, 0, 100) / 100) * plotHeight),
    step,
    markerSize: count > 1 && step < 14 ? 4 : count > 1 && step < 26 ? 5 : 6,
    tickY: bottom + 22,
  };
}

export interface PointLabel {
  index: number;
  text: string;
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
}

const CHAR_WIDTH = 7;

function labelText(m: Moment): string {
  if (m.point.kind === 'curveball') return 'Curveball';
  const arrow = m.direction === 'rose' ? '\u2191 ' : m.direction === 'eased' ? '\u2193 ' : '';
  return `${arrow}Turn ${m.turn}`;
}

/**
 * Direct labels for turning points and curveballs. A label that would collide with one already
 * placed is left out, so dense journeys only label what fits.
 */
export function planLabels(moments: readonly Moment[], layout: ChartLayout): PointLabel[] {
  const rank = (m: Moment) => (m.point.kind === 'curveball' ? 0 : 1);
  const candidates = moments
    .filter((m) => m.point.kind === 'curveball' || m.point.kind === 'turning-point')
    .sort(
      (a, b) =>
        rank(a) - rank(b) || Math.abs(b.point.delta) - Math.abs(a.point.delta) || a.index - b.index,
    );
  const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
  const labels: PointLabel[] = [];
  for (const m of candidates) {
    const text = labelText(m);
    const w = text.length * CHAR_WIDTH;
    const cx = layout.xs[m.index] as number;
    const cy = layout.ys[m.index] as number;
    const above = cy - layout.markerSize - 9 > layout.plot.top - 2;
    const y = above ? cy - layout.markerSize - 8 : cy + layout.markerSize + 17;
    let anchor: PointLabel['anchor'] = 'middle';
    let x = cx;
    let x0 = cx - w / 2;
    if (x0 < layout.plot.left + 2) {
      anchor = 'start';
      x = cx - 6;
      x0 = x;
    } else if (cx + w / 2 > layout.width - 2) {
      anchor = 'end';
      x = cx + 6;
      x0 = x - w;
    }
    const box = { x0: x0 - 4, x1: x0 + w + 4, y0: y - 13, y1: y + 4 };
    const clash = placed.some(
      (p) => box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0,
    );
    if (clash) continue;
    placed.push(box);
    labels.push({ index: m.index, text, x, y, anchor });
  }
  return labels;
}

export interface Tick {
  index: number;
  text: string;
  x: number;
}

/** Turn-number ticks along the bottom, thinned so they never touch. */
export function planTicks(moments: readonly Moment[], layout: ChartLayout): Tick[] {
  const count = moments.length;
  if (count === 0) return [];
  const minGap = layout.compact ? 26 : 34;
  const every = layout.step > 0 ? Math.max(1, Math.ceil(minGap / layout.step)) : 1;
  const indices: number[] = [];
  for (let i = 0; i < count - 1; i += every) indices.push(i);
  const last = count - 1;
  const lastKept = indices[indices.length - 1];
  if (
    lastKept !== undefined &&
    (layout.xs[last] as number) - (layout.xs[lastKept] as number) < minGap
  ) {
    indices.pop();
  }
  indices.push(last);
  return indices.map((i) => ({
    index: i,
    text: String((moments[i] as Moment).turn),
    x: layout.xs[i] as number,
  }));
}
