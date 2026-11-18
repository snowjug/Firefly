import { z } from 'zod';
import { DIMENSION_IDS, type DimensionId } from './vocab.ts';

// Calibration compares AI scores with mentor scores on the same sessions. It only ever reports
// numbers computed from stored records; with few records it says so instead of implying precision.

export type CalibrationSource = 'mentor' | 'sample';

export interface CalibrationPair {
  sessionId: string;
  evaluatorVersion: string;
  rubricVersion: string;
  source: CalibrationSource;
  ai: Record<DimensionId, number>;
  mentor: Record<DimensionId, number>;
}

export interface DimensionAgreement {
  dimension: DimensionId;
  n: number;
  meanAbsoluteDifference: number;
  withinOne: number; // 0..1 share of scores within +-1 point
  bias: number; // mean (AI - mentor): positive means the AI scores higher than mentors
}

export type SampleSize = 'none' | 'very-small' | 'small' | 'moderate';

export interface CalibrationMetrics {
  sessions: number;
  scores: number;
  overall: { meanAbsoluteDifference: number; withinOne: number; bias: number } | null;
  perDimension: DimensionAgreement[];
  evaluatorVersions: string[];
  rubricVersions: string[];
  sampleSize: SampleSize;
  caveat: string;
}

const round = (n: number, places = 2) => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};

export function sampleSizeBand(sessions: number): SampleSize {
  if (sessions === 0) return 'none';
  if (sessions < 5) return 'very-small';
  if (sessions < 20) return 'small';
  return 'moderate';
}

const CAVEATS: Record<SampleSize, string> = {
  none: 'No mentor-reviewed sessions yet, so there is nothing to compare.',
  'very-small':
    'Fewer than 5 reviewed sessions. These figures are anecdotal and say little about how reliable the AI scoring is.',
  small:
    'Fewer than 20 reviewed sessions. Treat these figures as indicative only, not as evidence of reliability.',
  moderate:
    'Agreement depends on who the mentors were and which scenarios were reviewed. Keep reviewing, and revisit the rubric where mentors and the AI disagree.',
};

export function computeCalibration(pairs: CalibrationPair[]): CalibrationMetrics {
  const sessions = new Set(pairs.map((p) => p.sessionId)).size;
  const perDimension: DimensionAgreement[] = [];
  let totalN = 0;
  let totalAbs = 0;
  let totalWithin = 0;
  let totalBias = 0;

  for (const dimension of DIMENSION_IDS) {
    let n = 0;
    let abs = 0;
    let within = 0;
    let bias = 0;
    for (const pair of pairs) {
      const ai = pair.ai[dimension];
      const mentor = pair.mentor[dimension];
      if (typeof ai !== 'number' || typeof mentor !== 'number') continue;
      const diff = ai - mentor;
      n += 1;
      abs += Math.abs(diff);
      bias += diff;
      if (Math.abs(diff) <= 1) within += 1;
    }
    if (n > 0) {
      perDimension.push({
        dimension,
        n,
        meanAbsoluteDifference: round(abs / n),
        withinOne: round(within / n),
        bias: round(bias / n),
      });
    }
    totalN += n;
    totalAbs += abs;
    totalWithin += within;
    totalBias += bias;
  }

  const sampleSize = sampleSizeBand(sessions);
  return {
    sessions,
    scores: totalN,
    overall:
      totalN > 0
        ? {
            meanAbsoluteDifference: round(totalAbs / totalN),
            withinOne: round(totalWithin / totalN),
            bias: round(totalBias / totalN),
          }
        : null,
    perDimension,
    evaluatorVersions: [...new Set(pairs.map((p) => p.evaluatorVersion))].sort(),
    rubricVersions: [...new Set(pairs.map((p) => p.rubricVersion))].sort(),
    sampleSize,
    caveat: CAVEATS[sampleSize],
  };
}

/** A calibration file is a list of records in this shape (see docs/calibration.md). */
const score = z.number().int().min(1).max(5);
const scores = z.object(
  Object.fromEntries(DIMENSION_IDS.map((id) => [id, score])) as Record<DimensionId, typeof score>,
);

export const CalibrationRecordFileSchema = z.object({
  /** Free text for people reading the file, for example where the records came from. */
  note: z.string().max(500).optional(),
  records: z
    .array(
      z.object({
        sessionId: z.string().min(1).max(64),
        evaluatorVersion: z.string().min(1).max(64),
        rubricVersion: z.string().min(1).max(64),
        source: z.enum(['mentor', 'sample']).default('mentor'),
        reviewer: z.string().max(40).optional(),
        ai: scores,
        mentor: scores,
      }),
    )
    .min(1, 'A calibration file needs at least one record.'),
});
export type CalibrationRecordFile = z.infer<typeof CalibrationRecordFileSchema>;

/** Parses calibration JSON and explains, in plain words, anything that is wrong with it. */
export function parseCalibrationFile(
  input: unknown,
): { ok: true; file: CalibrationRecordFile } | { ok: false; errors: string[] } {
  const parsed = CalibrationRecordFileSchema.safeParse(input);
  if (parsed.success) return { ok: true, file: parsed.data };
  return {
    ok: false,
    errors: parsed.error.issues.map((issue) => {
      const where = issue.path.length > 0 ? issue.path.join('.') : 'the file';
      return `${where}: ${issue.message}`;
    }),
  };
}

export function pairsFromFile(file: CalibrationRecordFile): CalibrationPair[] {
  return file.records.map((r) => ({
    sessionId: r.sessionId,
    evaluatorVersion: r.evaluatorVersion,
    rubricVersion: r.rubricVersion,
    source: r.source,
    ai: r.ai,
    mentor: r.mentor,
  }));
}
