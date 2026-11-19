import { z } from 'zod';
import type { CalibrationPair } from './calibration.ts';
import { DIMENSION_IDS, type DimensionId } from './vocab.ts';

// The file format read by `npm run calibrate` (see docs/calibration.md). It lives apart from the
// calibration maths so the web app, which only needs the maths, does not bundle the validator.

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
