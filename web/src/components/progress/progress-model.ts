import type { DimensionTrendDTO, ProgressDTO } from '#shared/domain/api.ts';
import { DIMENSION_IDS, DIMENSIONS, type DimensionId } from '#shared/domain/vocab.ts';
import { plural } from '../../lib/format.ts';
import {
  CLUSTER_NODE_CAP,
  type SkillInput,
  type SkillLevel,
} from '../atlas/constellation-layout.ts';
import type { IconName } from '../Icon.tsx';

// Wording and chart geometry for the progress page. Every number comes from the progress summary;
// nothing here estimates, ranks or compares.

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
}

/** The overall direction of recent calls, in calm words. A dip is never put in alarm wording. */
export const RECENT_CHANGE: Record<ProgressDTO['recentChange'], ChangeView> = {
  improving: {
    label: 'Improving',
    text: 'Your most recent calls scored a little higher overall than the ones before them.',
  },
  steady: {
    label: 'Steady',
    text: 'Your most recent calls scored about the same overall as the ones before them.',
  },
  declining: {
    label: 'A little lower',
    text: 'Your most recent calls scored a little lower overall than the ones before them. That can happen when you try a harder scenario or a different kind of customer.',
  },
  'not-enough-data': {
    label: 'Not enough data yet',
    text: `A few more completed calls are needed before Firefly can describe how your scores are changing. It looks for ${CALLS_FOR_TREND} or more.`,
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

// ------------------------------------------------------------------------------------------
// The sky: how a skill is read from its stars

/** "01" to "06": a skill's place in the report order, which is also how the sky numbers it. */
export const skillNumber = (id: DimensionId): string =>
  String(DIMENSION_IDS.indexOf(id) + 1).padStart(2, '0');

/** Every skill has this many stars; the ones beyond the evidence stay dormant. */
export const STARS_PER_SKILL = CLUSTER_NODE_CAP;
export const STARS_IN_SKY = STARS_PER_SKILL * DIMENSION_IDS.length;

/**
 * What it takes to burn at each light. These are the thresholds `levelFor` applies (a test keeps the
 * two in step), written out so the key to the sky can say them instead of hiding them.
 */
export const LIGHT_STEPS: readonly {
  light: 1 | 2 | 3 | 4;
  calls: number;
  average: number | null;
}[] = [
  { light: 1, calls: 1, average: null },
  { light: 2, calls: 2, average: 2.5 },
  { light: 3, calls: 3, average: 3.5 },
  { light: 4, calls: 5, average: 4.2 },
];

/** "No evidence yet", or "Light 2 of 4": a skill with practice is always at least light 1. */
export function lightText(level: SkillLevel): string {
  return level === 0 ? 'No evidence yet' : `Light ${level} of 4`;
}

/** What the next light asks for, or what lights the first star, or that this is the brightest. */
export function lightNext(level: SkillLevel): string {
  if (level >= 4) return 'This is the brightest light.';
  const step = LIGHT_STEPS[level];
  if (!step) return '';
  if (level === 0) return 'A star lights once a completed call is scored on this skill.';
  return `Light ${step.light} asks for ${plural(step.calls, 'call')} averaging ${step.average?.toFixed(1)} or more.`;
}

/** "3 calls scored", "1 call scored" or "Not scored yet". */
export function callsScored(evidence: number): string {
  return evidence > 0 ? `${plural(evidence, 'call')} scored` : 'Not scored yet';
}

/** The short line under a skill's name in the sky: "3 calls · light 2 of 4". */
export function skillCaption(skill: Pick<SkillInput, 'level' | 'evidence'>): string {
  if (skill.evidence <= 0) return 'No evidence yet';
  return [plural(skill.evidence, 'call'), `light ${skill.level} of 4`].join(SEPARATOR);
}

/** How many stars a skill has lit: one per scored call, up to the cap. */
export const litStarsOf = (evidence: number): number =>
  Math.min(STARS_PER_SKILL, Math.max(0, Math.floor(Number.isFinite(evidence) ? evidence : 0)));

export function starCounts(skills: readonly Pick<SkillInput, 'evidence'>[]): {
  lit: number;
  total: number;
} {
  return {
    lit: skills.reduce((sum, skill) => sum + litStarsOf(skill.evidence), 0),
    total: STARS_IN_SKY,
  };
}

/** The mean of every score in every skill, or null when nothing has been scored. */
export function overallAverage(trends: readonly DimensionTrendDTO[]): number | null {
  const scores = trends.flatMap((trend) => trend.points.map((point) => point.score));
  if (scores.length === 0) return null;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

/** The newest scored call, across every skill: the one whose stars have just been lit. */
export function latestCall(
  trends: readonly DimensionTrendDTO[],
): { sessionId: string; at: string } | null {
  let latest: { sessionId: string; at: string } | null = null;
  for (const trend of trends) {
    for (const point of trend.points) {
      if (!latest || Date.parse(point.at) > Date.parse(latest.at)) latest = point;
    }
  }
  return latest ? { sessionId: latest.sessionId, at: latest.at } : null;
}

/**
 * The stars the newest call lit: for each skill it was scored on, the last of its lit stars. The
 * sky marks these in amber and pulses them once when someone arrives from a report.
 */
export function recentStarIds(trends: readonly DimensionTrendDTO[]): ReadonlySet<string> {
  const latest = latestCall(trends);
  const ids = new Set<string>();
  if (!latest) return ids;
  for (const trend of trends) {
    const last = trend.points[trend.points.length - 1];
    if (last?.sessionId !== latest.sessionId) continue;
    ids.add(`${trend.dimension}:${litStarsOf(trend.points.length) - 1}`);
  }
  return ids;
}

/** What moved on the latest call: the two newest scores side by side, in plain numbers. */
export function movedText(trend: DimensionTrendDTO): string | null {
  const [before, last] = trend.points.slice(-2);
  if (!before || !last || trend.points.length < 2) return null;
  if (last.score > before.score)
    return `Latest ${last.score}, up from ${before.score} on the call before.`;
  if (last.score < before.score)
    return `Latest ${last.score}, down from ${before.score} on the call before.`;
  return `Latest ${last.score}, the same as the call before.`;
}

/** One sentence for assistive technology: what the cluster is made of, with every figure in words. */
export function describeSkill(skill: SkillInput, trend: DimensionTrendDTO | undefined): string {
  const label = DIMENSIONS[skill.id].label;
  if (skill.evidence <= 0) {
    return `${label}: no evidence yet. A star lights once a completed call is scored on this skill.`;
  }
  const lit = litStarsOf(skill.evidence);
  const parts = [
    `${label}: ${plural(lit, 'star')} lit of ${STARS_PER_SKILL}, ${callsScored(skill.evidence)}, light ${skill.level} of 4.`,
  ];
  if (trend) parts.push(`${trendSummary(trend).text}.`);
  if (skill.focus) parts.push('Suggested next focus.');
  return parts.join(' ');
}
