import type {
  CalibrationDTO,
  CalibrationRecordDTO,
  DimensionTrendDTO,
  MentorScoreRequest,
  ProgressDTO,
} from '#shared/domain/api.ts';
import { computeCalibration, type CalibrationPair } from '#shared/domain/calibration.ts';
import { CoachingReportSchema } from '#shared/domain/report.ts';
import { DIMENSION_IDS, DIMENSIONS, type DimensionId } from '#shared/domain/vocab.ts';
import type { Repository } from '../db/repository.ts';
import { RUBRIC_VERSION } from '../engine/types.ts';
import { AppError, conflict, notFound } from '../errors.ts';
import { toSummary } from './dto.ts';

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
const round1 = (n: number) => Math.round(n * 10) / 10;

export interface ProgressInput {
  id: string;
  startedAt: string;
  scores: Partial<Record<DimensionId, number>>;
  overall: number | null;
  improvementDimensions: DimensionId[];
}

const PROGRESS_NOTE =
  'Based only on your completed practice sessions. Scores are coaching feedback to guide practice; they are not a performance rating and are never compared with colleagues.';

function change(values: number[], threshold: number): 'up' | 'steady' | 'down' | 'not-enough-data' {
  if (values.length < 4) return 'not-enough-data';
  const recent = mean(values.slice(-3));
  const previous = mean(values.slice(Math.max(0, values.length - 6), values.length - 3));
  const diff = recent - previous;
  return diff >= threshold ? 'up' : diff <= -threshold ? 'down' : 'steady';
}

/** Pure aggregation, kept separate so it can be tested without a database. */
export function computeProgress(
  sessions: ProgressInput[],
  totalSessions = sessions.length,
): ProgressDTO {
  const ordered = [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  const dimensionTrends: DimensionTrendDTO[] = DIMENSION_IDS.map((dimension) => {
    const points = ordered
      .filter((s) => typeof s.scores[dimension] === 'number')
      .map((s) => ({ sessionId: s.id, at: s.startedAt, score: s.scores[dimension] as number }));
    const values = points.map((p) => p.score);
    return {
      dimension,
      points,
      average: values.length > 0 ? round1(mean(values)) : null,
      latest: values.length > 0 ? (values[values.length - 1] as number) : null,
      change: change(values, 0.4),
    };
  });

  const withAverage = dimensionTrends.filter((t) => t.average !== null);
  const strongest =
    ordered.length >= 2 && withAverage.length > 0
      ? ([...withAverage].sort((a, b) => (b.average as number) - (a.average as number))[0]
          ?.dimension ?? null)
      : null;
  const lowest = [...withAverage].sort((a, b) => (a.average as number) - (b.average as number))[0];
  const focus = lowest?.dimension ?? null;

  const counts = new Map<DimensionId, number>();
  for (const s of ordered) {
    for (const d of new Set(s.improvementDimensions)) counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const repeatedOpportunities = [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([dimension, sessionsCount]) => ({
      dimension,
      sessions: sessionsCount,
      message: `${DIMENSIONS[dimension].label} came up as an improvement area in ${sessionsCount} of ${ordered.length} sessions.`,
    }));

  const overall = ordered.map((s) => s.overall).filter((v): v is number => typeof v === 'number');
  const trend = change(overall, 0.3);
  const recentChange =
    trend === 'up'
      ? 'improving'
      : trend === 'down'
        ? 'declining'
        : trend === 'steady'
          ? 'steady'
          : 'not-enough-data';

  return {
    totalSessions,
    completedSessions: ordered.length,
    dimensionTrends,
    strongest,
    focus,
    focusReason:
      focus && lowest
        ? `${DIMENSIONS[focus].label} averaged ${lowest.average} across ${lowest.points.length} session${lowest.points.length === 1 ? '' : 's'}.`
        : null,
    repeatedOpportunities,
    recentChange,
    note: PROGRESS_NOTE,
  };
}

export class InsightsService {
  private readonly repo: Repository;
  constructor(repo: Repository) {
    this.repo = repo;
  }

  progress(profileId: string, includeSamples: boolean): ProgressDTO {
    const all = this.repo.listSessions(profileId, { includeSamples, limit: 200 });
    const completed = all.rows.filter((r) => r.status === 'completed' && r.dimensionScores);
    const inputs: ProgressInput[] = completed.map((r) => {
      const stored = this.repo.getEvaluation(r.id);
      const report = stored ? CoachingReportSchema.safeParse(stored.report) : null;
      return {
        id: r.id,
        startedAt: r.startedAt,
        scores: r.dimensionScores ?? {},
        overall: r.overallScore,
        improvementDimensions: report?.success
          ? report.data.improvements.map((i) => i.dimension)
          : [],
      };
    });
    return computeProgress(inputs, all.total);
  }

  calibration(profileId: string, includeSamples: boolean): CalibrationDTO {
    const rows = this.repo.listMentorEvaluations(profileId, includeSamples);
    const records: CalibrationRecordDTO[] = [];
    const pairs: CalibrationPair[] = [];
    for (const r of rows) {
      const ai = r.aiScores;
      if (!ai || !DIMENSION_IDS.every((d) => typeof ai[d] === 'number')) continue;
      const aiScores = ai as Record<DimensionId, number>;
      records.push({
        id: r.id,
        sessionId: r.sessionId,
        scenarioTitle: r.scenarioTitle,
        reviewer: r.reviewer,
        source: r.source,
        evaluatorVersion: r.evaluatorVersion ?? 'unknown',
        rubricVersion: r.rubricVersion,
        ai: aiScores,
        mentor: r.scores,
        notes: r.notes,
        createdAt: r.createdAt,
      });
      pairs.push({
        sessionId: r.sessionId,
        evaluatorVersion: r.evaluatorVersion ?? 'unknown',
        rubricVersion: r.rubricVersion,
        source: r.source,
        ai: aiScores,
        mentor: r.scores,
      });
    }

    const reviewed = this.repo.sessionIdsWithMentorReview(profileId);
    const sessions = this.repo.listSessions(profileId, {
      status: 'completed',
      includeSamples,
      limit: 50,
    });
    const counts = this.repo.traineeTurnCounts(sessions.rows.map((s) => s.id));
    return {
      metrics: computeCalibration(pairs),
      records,
      includesSamples: includeSamples,
      reviewable: sessions.rows
        .filter((s) => !reviewed.has(s.id))
        .map((s) => {
          // The queue never carries the AI's scores, so a review starts from the transcript alone.
          const {
            overallScore: _overall,
            dimensionScores: _scores,
            ...summary
          } = toSummary(s, counts.get(s.id) ?? 0, false);
          return summary;
        }),
    };
  }

  mentorScore(
    profileId: string,
    sessionId: string,
    request: MentorScoreRequest,
    source: 'mentor' | 'sample' = 'mentor',
  ): void {
    const session = this.repo.getSession(sessionId, profileId);
    if (!session) throw notFound('That session');
    if (session.status !== 'completed') {
      throw conflict('Only completed sessions can be reviewed.');
    }
    if (!session.dimensionScores) {
      throw new AppError(409, 'conflict', 'This session has no AI scores to compare with.');
    }
    this.repo.saveMentorEvaluation({
      sessionId,
      reviewer: request.reviewer,
      scores: request.scores,
      notes: request.notes?.trim() ? request.notes.trim() : null,
      rubricVersion: RUBRIC_VERSION,
      source,
    });
  }
}
