import type { DiscoveryResult } from '#shared/domain/report.ts';
import type { PublicStateDTO } from '#shared/domain/api.ts';
import { atmosphereFor, type Atmosphere } from '../call/atmosphere.ts';
import { spineSegment } from '../call/spine-model.ts';
import type { BandInfo, Direction, Moment } from './timeline-model.ts';

// The geometry behind the debrief's journey: the customer's mood as the same filament the call
// chamber hangs its conversation from. Pure, so it can be tested without a browser: points in, path
// data and positions out. Where the filament is straight the customer was composed; where it
// sways, trembles, kinks or breaks they were not, and the shapes come from the chamber's own
// `spineSegment`, so a mood looks the same in the call and in its debrief.

/** One stretch of the filament: the line that arrives at a point from the one before it. */
export interface FilamentPiece {
  /** The index of the moment this stretch arrives at (the first moment has none before it). */
  to: number;
  d: string;
  band: BandInfo;
  /** A dash pattern for a broken line, or null for a whole one. */
  dash: string | null;
  join: 'round' | 'miter';
  weight: number;
  /** The customer's situation turned here: the line takes a sharp jog. */
  kink: boolean;
}

const CENTRE = 22;
const NUMBER = /-?\d+(?:\.\d+)?/g;

const trim = (value: number) => {
  const text = value.toFixed(1);
  return text === '-0.0' ? '0' : text.replace(/\.0$/, '');
};

/**
 * The filament between every pair of neighbouring points. Each stretch is drawn from the mood at the
 * point it arrives at (the customer's mood after what was said), softened when it is easing and
 * jogged at a curveball. The chamber draws its stretch down a page; here the same line is laid
 * along the way from one point to the next, with its sideways swing measured from that way.
 */
export function filamentPieces(
  moments: readonly Moment[],
  xs: readonly number[],
  ys: readonly number[],
): FilamentPiece[] {
  const pieces: FilamentPiece[] = [];
  for (let to = 1; to < moments.length; to += 1) {
    const moment = moments[to] as Moment;
    const x0 = xs[to - 1] as number;
    const y0 = ys[to - 1] as number;
    const x1 = xs[to] as number;
    const y1 = ys[to] as number;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const length = Math.hypot(dx, dy);
    const kink = moment.point.kind === 'curveball';
    const stretch = spineSegment({
      mood: moment.band.id,
      easing: moment.direction === 'eased',
      kink,
      seed: `${moment.turn}-${to}`,
      height: Math.max(40, length),
    });
    const straight = stretch.d.includes('V') || length < 1;
    let d: string;
    if (straight) {
      d = `M${trim(x0)} ${trim(y0)}L${trim(x1)} ${trim(y1)}`;
    } else {
      // The stretch is drawn down a 44 x 100 box: its y is how far along, its x the swing from the
      // centre. Put it on the way between the two points, the swing at right angles to that way.
      const numbers = stretch.d.match(NUMBER)?.map(Number) ?? [];
      const nx = -dy / length;
      const ny = dx / length;
      const parts: string[] = [];
      for (let i = 0; i + 1 < numbers.length; i += 2) {
        const along = (numbers[i + 1] as number) / 100;
        const swing = (numbers[i] as number) - CENTRE;
        parts.push(`${trim(x0 + dx * along + nx * swing)} ${trim(y0 + dy * along + ny * swing)}`);
      }
      d = `M${parts.join('L')}`;
    }
    pieces.push({
      to,
      d,
      band: moment.band,
      dash: stretch.dash,
      join: stretch.join,
      weight: stretch.weight,
      kink,
    });
  }
  return pieces;
}

// ---------------------------------------------------------------------------------------
// The strip: the whole journey as a thin line across the head of the page

export interface StripLayout {
  width: number;
  height: number;
  xs: number[];
  ys: number[];
  /** Where the ruler under the line sits. */
  baseY: number;
  markerSize: number;
}

/** The journey squeezed into a strip `height` tall. Points are spaced evenly, as in the chart. */
export function layoutStrip(moments: readonly Moment[], width: number, height = 72): StripLayout {
  const pad = Math.min(24, Math.max(10, width * 0.02));
  const left = pad;
  const right = Math.max(left + 1, width - pad);
  const baseY = height - 14;
  const top = 12;
  const count = moments.length;
  const step = count > 1 ? (right - left) / (count - 1) : 0;
  return {
    width,
    height,
    baseY,
    markerSize: count > 1 && step < 9 ? 2.4 : count > 1 && step < 18 ? 3 : 3.6,
    xs: moments.map((_, i) => (count > 1 ? left + step * i : (left + right) / 2)),
    ys: moments.map(
      (m) => baseY - (Math.min(100, Math.max(0, m.point.temperature)) / 100) * (baseY - top),
    ),
  };
}

// ---------------------------------------------------------------------------------------
// Signals found, placed on the journey

export interface JourneyDiscovery {
  turn: number;
  label: string;
  /** Partly found facts still lit a star, and say "partly" where they are named. */
  status: 'discovered' | 'partial';
}

/** The facts the call brought out, in the order they came out. Missed facts have no place here. */
export function journeyDiscoveries(results: readonly DiscoveryResult[]): JourneyDiscovery[] {
  return results
    .flatMap((fact) =>
      fact.status !== 'missed' && fact.revealedAtTurn !== null
        ? [{ turn: fact.revealedAtTurn, label: fact.label, status: fact.status }]
        : [],
    )
    .sort((a, b) => a.turn - b.turn);
}

/** The moment a signal belongs to: the first at or after its turn, or the last if it came later. */
export function discoveryMoment(turn: number, moments: readonly Moment[]): number {
  const at = moments.findIndex((moment) => moment.turn >= turn);
  return at === -1 ? Math.max(0, moments.length - 1) : at;
}

export interface PlacedDiscovery extends JourneyDiscovery {
  /** The moment it belongs to. */
  moment: number;
  x: number;
  y: number;
}

/**
 * Where each signal sits on the line: at its own turn, between the two points either side of it
 * when it fell between them. Straight between the points, because the star needs only a place to
 * stand, not the line's wobble.
 */
export function placeDiscoveries(
  discoveries: readonly JourneyDiscovery[],
  moments: readonly Moment[],
  xs: readonly number[],
  ys: readonly number[],
): PlacedDiscovery[] {
  return discoveries.flatMap((discovery) => {
    const last = moments.length - 1;
    if (last < 0) return [];
    const after = discoveryMoment(discovery.turn, moments);
    const before = Math.max(0, after - 1);
    const spanTurns = (moments[after]?.turn ?? 0) - (moments[before]?.turn ?? 0);
    const share =
      after === before || spanTurns <= 0
        ? 1
        : Math.min(1, Math.max(0, (discovery.turn - (moments[before] as Moment).turn) / spanTurns));
    const x = (xs[before] as number) + ((xs[after] as number) - (xs[before] as number)) * share;
    const y = (ys[before] as number) + ((ys[after] as number) - (ys[before] as number)) * share;
    return [{ ...discovery, moment: after, x, y }];
  });
}

/** How many signals had been found by a moment (counting every moment up to and including it). */
export function foundBy(
  moment: number,
  placed: readonly Pick<PlacedDiscovery, 'moment'>[],
): number {
  return placed.filter((discovery) => discovery.moment <= moment).length;
}

// ---------------------------------------------------------------------------------------
// The frozen presence at a moment

export const trendOf = (direction: Direction): Atmosphere['trend'] =>
  direction === 'rose' ? 'rising' : direction === 'eased' ? 'falling' : 'steady';

/**
 * The room as it was at a moment of the call, for the frozen presence. A report is where the
 * customer's mood is first shown in full, whichever way the call was practised, so the cues are on.
 */
export function atmosphereAt(
  band: Pick<BandInfo, 'id' | 'label'>,
  trend: Atmosphere['trend'],
): Atmosphere {
  const state: PublicStateDTO = {
    band: { id: band.id, label: band.label },
    trend,
    discoveredCount: 0,
    silent: false,
    shifts: 0,
  };
  return atmosphereFor(state, 'full');
}
