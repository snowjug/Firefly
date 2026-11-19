import { describe, expect, it } from 'vitest';
import { pairsFromFile, parseCalibrationFile } from './calibration-file.ts';
import { computeCalibration, sampleSizeBand, type CalibrationPair } from './calibration.ts';
import { DIMENSION_IDS, type DimensionId } from './vocab.ts';

const scores = (values: number[]) =>
  Object.fromEntries(DIMENSION_IDS.map((id, i) => [id, values[i] as number])) as Record<
    DimensionId,
    number
  >;

const pair = (
  sessionId: string,
  ai: number[],
  mentor: number[],
  versions = { evaluatorVersion: 'rules-1.0.0', rubricVersion: 'rubric-1' },
): CalibrationPair => ({
  sessionId,
  source: 'mentor',
  ...versions,
  ai: scores(ai),
  mentor: scores(mentor),
});

describe('computeCalibration', () => {
  // Differences (AI - mentor) per dimension: A = 0,-1,+1,0,+2,0 and B = 0,+1,-2,0,0,-1.
  const pairs = [
    pair('a', [4, 3, 5, 3, 4, 2], [4, 4, 4, 3, 2, 2]),
    pair('b', [3, 3, 3, 3, 3, 3], [3, 2, 5, 3, 3, 4]),
  ];

  it('computes overall mean absolute difference, agreement within one point and bias', () => {
    const { overall, sessions, scores: compared } = computeCalibration(pairs);
    expect(sessions).toBe(2);
    expect(compared).toBe(12);
    expect(overall).toEqual({ meanAbsoluteDifference: 0.67, withinOne: 0.83, bias: 0 });
  });

  it('computes agreement and systematic over- or under-scoring for each dimension', () => {
    const byId = Object.fromEntries(
      computeCalibration(pairs).perDimension.map((d) => [d.dimension, d]),
    );
    expect(byId['empathy-deescalation']).toMatchObject({
      n: 2,
      meanAbsoluteDifference: 1.5,
      withinOne: 0.5,
      bias: -0.5,
    });
    expect(byId['ownership-next-steps']).toMatchObject({ withinOne: 0.5, bias: 1 });
    expect(byId['opening-rapport']).toMatchObject({ meanAbsoluteDifference: 0, withinOne: 1 });
  });

  it('never reports numbers when there is nothing to compare', () => {
    const none = computeCalibration([]);
    expect(none.overall).toBeNull();
    expect(none.perDimension).toEqual([]);
    expect(none.sampleSize).toBe('none');
    expect(none.caveat).toMatch(/nothing to compare/i);
  });

  it('tracks evaluator and rubric versions so results are never mixed up silently', () => {
    const metrics = computeCalibration([
      ...pairs,
      pair('c', [3, 3, 3, 3, 3, 3], [3, 3, 3, 3, 3, 3], {
        evaluatorVersion: 'rules-1.1.0',
        rubricVersion: 'rubric-1',
      }),
    ]);
    expect(metrics.evaluatorVersions).toEqual(['rules-1.0.0', 'rules-1.1.0']);
    expect(metrics.rubricVersions).toEqual(['rubric-1']);
  });

  it('describes small samples as anecdotal instead of implying precision', () => {
    expect(sampleSizeBand(0)).toBe('none');
    expect(sampleSizeBand(4)).toBe('very-small');
    expect(sampleSizeBand(5)).toBe('small');
    expect(sampleSizeBand(19)).toBe('small');
    expect(sampleSizeBand(20)).toBe('moderate');
    expect(computeCalibration(pairs).caveat).toMatch(/fewer than 5/i);
  });
});

describe('calibration files', () => {
  const record = {
    sessionId: 'demo-1',
    evaluatorVersion: 'rules-1.0.0',
    rubricVersion: 'rubric-1',
    ai: scores([3, 3, 3, 3, 3, 3]),
    mentor: scores([4, 3, 2, 3, 3, 3]),
  };

  it('accepts a valid file and treats records as mentor reviews unless marked as samples', () => {
    const parsed = parseCalibrationFile({ records: [record] });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.file.records[0]?.source).toBe('mentor');
    expect(pairsFromFile(parsed.file)).toHaveLength(1);
  });

  it('explains what is wrong in plain words', () => {
    const bad = parseCalibrationFile({
      records: [{ ...record, mentor: { ...record.mentor, clarity: 6 }, ai: { clarity: 3 } }],
    });
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.errors.some((e) => e.startsWith('records.0.mentor.clarity'))).toBe(true);
    expect(bad.errors.some((e) => e.startsWith('records.0.ai.'))).toBe(true);

    const empty = parseCalibrationFile({ records: [] });
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.errors[0]).toMatch(/at least one record/);
  });
});
