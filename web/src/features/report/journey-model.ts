import type { CoachingReport, JourneyPoint } from '#shared/domain/report.ts';
import { TEMPERATURE_BANDS, type TemperatureBandId } from '#shared/domain/vocab.ts';
import { plainUnexpectedTurn } from './copy.ts';

// The customer's temperature through the call as plain data: the list under the chart, the table
// that is the chart's alternative, and the geometry of the chart itself. The 0 to 100 temperature is
// used only to place a point; it is never printed, because the report talks about bands and direction.

type Journey = CoachingReport['journey'];
export type PointKind = JourneyPoint['kind'];

export const POINT_KIND_LABELS: Record<PointKind, string> = {
  start: 'Start',
  turn: 'Turn',
  'turning-point': 'Turning point',
  curveball: 'Unexpected turn',
  end: 'End of call',
};

/** The kinds the list "What moved the customer" is made of. */
const LISTED: readonly PointKind[] = ['start', 'turning-point', 'curveball', 'end'];

export interface JourneyItem {
  point: JourneyPoint;
  kindLabel: string;
  /** "Turn 6: Frustrated to Angry". */
  heading: string;
  /** The evaluator's reason, in the report's words. */
  reason: string | null;
  /** What the trainee said at that turn, verbatim. */
  quote: string | null;
}

/** How the temperature moved at a point, in words: "Frustrated to Angry", "Still Calm". */
export function changeText(previous: JourneyPoint | null, point: JourneyPoint): string {
  if (point.kind === 'start' || !previous) return `Started ${point.band}`;
  if (previous.band !== point.band) return `${previous.band} to ${point.band}`;
  if (point.delta > 0) return `Still ${point.band}, temperature rose`;
  if (point.delta < 0) return `Still ${point.band}, temperature eased`;
  return `Still ${point.band}`;
}

export function journeyListItems(journey: Journey): JourneyItem[] {
  const items: JourneyItem[] = [];
  journey.points.forEach((point, index) => {
    if (!LISTED.includes(point.kind)) return;
    const previous = index > 0 ? (journey.points[index - 1] ?? null) : null;
    items.push({
      point,
      kindLabel: POINT_KIND_LABELS[point.kind],
      heading: `Turn ${point.turnIndex}: ${changeText(previous, point)}`,
      reason: point.reason ? plainUnexpectedTurn(point.reason) : null,
      quote: point.quote,
    });
  });
  return items;
}

export interface JourneyRow {
  turnIndex: number;
  kindLabel: string;
  band: string;
  change: string;
  reason: string | null;
}

/** Every point, as the rows of the table that stands in for the chart. */
export function journeyTableRows(journey: Journey): JourneyRow[] {
  return journey.points.map((point) => ({
    turnIndex: point.turnIndex,
    kindLabel: POINT_KIND_LABELS[point.kind],
    band: point.band,
    change:
      point.kind === 'start'
        ? 'Start of the call'
        : point.delta > 0
          ? 'Rose'
          : point.delta < 0
            ? 'Eased'
            : 'No change',
    reason: point.reason ? plainUnexpectedTurn(point.reason) : null,
  }));
}

/** The chart in one sentence, for people who cannot see it. The list below says the rest. */
export function journeySentence(journey: Journey): string {
  const { points } = journey;
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return 'The customer temperature was not recorded for this call.';
  const peak = points.find((p) => p.temperature === journey.peak) ?? first;
  const peakText =
    peak === first || peak.band === first.band
      ? ''
      : ` It was highest at turn ${peak.turnIndex}, when the customer was ${peak.band}.`;
  return `The customer started ${first.band} and ended ${last.band}.${peakText}`;
}

// ---- Chart geometry -------------------------------------------------------------------------

export interface ChartBand {
  id: TemperatureBandId;
  label: string;
  top: number;
  bottom: number;
}

export interface ChartPoint {
  x: number;
  y: number;
  kind: PointKind;
  turnIndex: number;
  band: string;
}

export interface ChartTick {
  x: number;
  label: string;
}

export interface ChartGeometry {
  width: number;
  height: number;
  plot: { left: number; right: number; top: number; bottom: number };
  bands: ChartBand[];
  points: ChartPoint[];
  /** The line through every point, as an SVG path. */
  path: string;
  ticks: ChartTick[];
}

export interface ChartSize {
  width: number;
  height: number;
  /** Room on the left for the band names. */
  gutter?: number;
}

const PAD_TOP = 10;
const PAD_BOTTOM = 40;
const PAD_RIGHT = 14;
const PAD_X = 14;
const TICK_SPACING = 34;

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** Where each band, point and axis label goes. Hot is at the top, calm at the bottom. */
export function layoutChart(points: readonly JourneyPoint[], size: ChartSize): ChartGeometry {
  const gutter = size.gutter ?? 104;
  const plot = {
    left: gutter,
    right: Math.max(gutter + 40, size.width - PAD_RIGHT),
    top: PAD_TOP,
    bottom: Math.max(PAD_TOP + 100, size.height - PAD_BOTTOM),
  };
  const bandHeight = (plot.bottom - plot.top) / TEMPERATURE_BANDS.length;
  const bands: ChartBand[] = [...TEMPERATURE_BANDS].reverse().map((band, i) => ({
    id: band.id,
    label: band.label,
    top: plot.top + i * bandHeight,
    bottom: plot.top + (i + 1) * bandHeight,
  }));

  const inner = plot.right - plot.left - 2 * PAD_X;
  const laid: ChartPoint[] = points.map((point, i) => ({
    x:
      points.length === 1
        ? plot.left + (plot.right - plot.left) / 2
        : plot.left + PAD_X + (i / (points.length - 1)) * inner,
    y: plot.top + (1 - clamp(point.temperature, 0, 100) / 100) * (plot.bottom - plot.top),
    kind: point.kind,
    turnIndex: point.turnIndex,
    band: point.band,
  }));

  // Label as many turns as fit, always the first and the last.
  const fit = Math.max(2, Math.floor(inner / TICK_SPACING));
  const step = Math.max(1, Math.ceil(laid.length / fit));
  const ticks: ChartTick[] = laid
    .map((p, i) => ({ p, i }))
    .filter(
      ({ i }) =>
        i === 0 || i === laid.length - 1 || (i % step === 0 && laid.length - 1 - i >= step),
    )
    .map(({ p }) => ({ x: p.x, label: String(p.turnIndex) }));

  const path = laid
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  return { width: size.width, height: size.height, plot, bands, points: laid, path, ticks };
}
