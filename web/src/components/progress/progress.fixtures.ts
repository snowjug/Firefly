import type { DimensionTrendDTO, ProgressDTO } from '#shared/domain/api.ts';
import { DIMENSION_IDS, type DimensionId } from '#shared/domain/vocab.ts';

// Progress as the server returns it, for tests. Every number here is invented.

export const PROGRESS_NOTE =
  'Based only on your completed practice sessions. Scores are coaching feedback to guide practice; they are not a performance rating and are never compared with colleagues.';

/** One skill's scores across calls, oldest first, one call per day from `firstDay` of November 2026. */
export function trend(
  dimension: DimensionId,
  scores: number[],
  change: DimensionTrendDTO['change'],
  firstDay = 1,
): DimensionTrendDTO {
  return {
    dimension,
    points: scores.map((score, index) => ({
      sessionId: `call-${index + 1}`,
      at: new Date(Date.UTC(2026, 10, firstDay + index)).toISOString(),
      score,
    })),
    average: scores.length
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : null,
    latest: scores.length ? (scores[scores.length - 1] as number) : null,
    change,
  };
}

/** Nothing completed yet. */
export const EMPTY_PROGRESS: ProgressDTO = {
  totalSessions: 0,
  completedSessions: 0,
  dimensionTrends: DIMENSION_IDS.map((dimension) => trend(dimension, [], 'not-enough-data')),
  strongest: null,
  focus: null,
  focusReason: null,
  repeatedOpportunities: [],
  recentChange: 'not-enough-data',
  note: PROGRESS_NOTE,
};

/** Five completed calls (six started). Opening rises, Scoping falls, the rest hold steady. */
export const PROGRESS_WITH_DATA: ProgressDTO = {
  totalSessions: 6,
  completedSessions: 5,
  dimensionTrends: DIMENSION_IDS.map((dimension, index) =>
    trend(
      dimension,
      [2 + (index % 2), 3, 3 + (index % 3 === 0 ? 1 : 0), 4, 4],
      index === 0 ? 'up' : index === 1 ? 'down' : 'steady',
    ),
  ),
  strongest: 'closing',
  focus: 'scoping-discovery',
  focusReason: 'Scoping & Discovery averaged 2.5 across 5 sessions.',
  repeatedOpportunities: [
    { dimension: 'empathy-deescalation', sessions: 3, message: 'server message' },
  ],
  recentChange: 'improving',
  note: PROGRESS_NOTE,
};
