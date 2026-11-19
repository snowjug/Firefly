import type { DimensionTrendDTO, ProgressDTO } from '#shared/domain/api.ts';
import { DIMENSION_IDS, DIMENSIONS } from '#shared/domain/vocab.ts';
import type { IconName } from '../Icon.tsx';
import type { Tone } from '../ui/StatCard.tsx';

// Wording and chart geometry for the My progress page. Every number comes from the progress summary.

const SEPARATOR = ' \u00b7 ';

/** How many calls the server needs before it names a direction for a skill. */
export const CALLS_FOR_TREND = 4;

const DIRECTIONS: Record<'up' | 'steady' | 'down', { word: string; icon: IconName }> = {
  up: { word: 'rising', icon: 'trending-up' },
  steady: { word: 'steady', icon: 'arrow-right' },
  down: { word: 'lower lately', icon: 'trending-down' },
};

export interface TrendSummary {
  /** The visible line under a skill's chart, for example "Latest 4 · average 3.2 · rising". */
  text: string;
  /** Only present when there are enough calls to name a direction; shown with an icon, never alone. */
  direction: { word: string; icon: IconName } | null;
}

export function trendSummary(trend: DimensionTrendDTO): TrendSummary {
  const count = trend.points.length;
  if (count === 0 || trend.latest === null) return { text: 'Not scored yet', direction: null };

  const parts = [`Latest ${trend.latest}`];
  if (count === 1) {
    parts.push('Complete 2+ calls to see a trend');
    return { text: parts.join(SEPARATOR), direction: null };
  }
  if (trend.average !== null) parts.push(`average ${trend.average.toFixed(1)}`);
  if (trend.change === 'not-enough-data') {
    parts.push(`a trend shows after ${CALLS_FOR_TREND} calls`);
    return { text: parts.join(SEPARATOR), direction: null };
  }
  const direction = DIRECTIONS[trend.change];
  parts.push(direction.word);
  return { text: parts.join(SEPARATOR), direction };
}

/** What a screen reader gets for the chart: every score, oldest to newest. */
export function trendAlt(trend: DimensionTrendDTO): string {
  const scores = trend.points.map((p) => p.score);
  const calls = scores.length === 1 ? '1 call' : `${scores.length} calls`;
  return `${DIMENSIONS[trend.dimension].label} scores across ${calls}, oldest to newest: ${scores.join(', ')}.`;
}

/** The six skills in the order the report lists them, whatever order the server sent. */
export function orderedTrends(trends: readonly DimensionTrendDTO[]): DimensionTrendDTO[] {
  return [...trends].sort(
    (a, b) => DIMENSION_IDS.indexOf(a.dimension) - DIMENSION_IDS.indexOf(b.dimension),
  );
}

export interface ChangeView {
  label: string;
  text: string;
  icon: IconName;
  tone: Tone;
}

/** The overall direction of recent calls, in calm words. A dip is never drawn in alarm colours. */
export const RECENT_CHANGE: Record<ProgressDTO['recentChange'], ChangeView> = {
  improving: {
    label: 'Improving',
    text: 'Your most recent calls scored a little higher overall than the ones before them.',
    icon: 'trending-up',
    tone: 'green',
  },
  steady: {
    label: 'Steady',
    text: 'Your most recent calls scored about the same overall as the ones before them.',
    icon: 'arrow-right',
    tone: 'blue',
  },
  declining: {
    label: 'A little lower',
    text: 'Your most recent calls scored a little lower overall than the ones before them. That can happen when you try a harder scenario or a different kind of customer.',
    icon: 'trending-down',
    tone: 'violet',
  },
  'not-enough-data': {
    label: 'Not enough data yet',
    text: `A few more completed calls are needed before Firefly can describe how your scores are changing. It looks for ${CALLS_FOR_TREND} or more.`,
    icon: 'info',
    tone: 'blue',
  },
};

export interface ScoreRow {
  sessionId: string;
  at: string;
  scores: Partial<Record<string, number>>;
}

/** One row per call (oldest first) with its score for each skill, for the table version of the charts. */
export function scoreRows(trends: readonly DimensionTrendDTO[]): ScoreRow[] {
  const rows = new Map<string, ScoreRow>();
  for (const trend of trends) {
    for (const point of trend.points) {
      const row = rows.get(point.sessionId) ?? {
        sessionId: point.sessionId,
        at: point.at,
        scores: {},
      };
      row.scores[trend.dimension] = point.score;
      rows.set(point.sessionId, row);
    }
  }
  return [...rows.values()].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

export const SPARK = { width: 240, height: 64, padX: 10, padY: 9 } as const;

export interface SparkPoint {
  x: number;
  y: number;
}

export interface SparkGeometry {
  points: SparkPoint[];
  /** The line through every point. Empty for a single point. */
  line: string;
  /** The same line closed along the bottom, for a soft fill under it. */
  area: string;
  /** Vertical position of the 1, 3 and 5 gridlines. */
  grid: number[];
}

const round = (value: number) => Number(value.toFixed(1));

/** Scores run from 1 to 5 and are spaced evenly by call, oldest on the left. */
export function sparkGeometry(scores: readonly number[]): SparkGeometry {
  const { width, height, padX, padY } = SPARK;
  const count = scores.length;
  const y = (score: number) =>
    round(padY + ((5 - Math.min(5, Math.max(1, score))) / 4) * (height - padY * 2));
  const x = (index: number) =>
    count === 1 ? width / 2 : round(padX + (index * (width - padX * 2)) / (count - 1));

  const points = scores.map((score, index) => ({ x: x(index), y: y(score) }));
  const first = points[0];
  const last = points[points.length - 1];
  const line =
    points.length > 1 ? points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ') : '';
  const base = height - padY;
  const area =
    first && last && points.length > 1 ? `${line} L${last.x} ${base} L${first.x} ${base} Z` : '';
  return { points, line, area, grid: [y(1), y(3), y(5)] };
}
