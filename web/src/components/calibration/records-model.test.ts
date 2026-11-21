import { describe, expect, it } from 'vitest';
import type { CalibrationRecordDTO } from '#shared/domain/api.ts';
import { DIMENSION_IDS, type DimensionId } from '#shared/domain/vocab.ts';
import {
  averageGap,
  comparisonSummary,
  DEFAULT_SORT,
  describeSort,
  differences,
  nextSort,
  sortRecords,
  startSort,
} from './records-model.ts';

const scores = (value: number, overrides: Partial<Record<DimensionId, number>> = {}) =>
  Object.fromEntries(DIMENSION_IDS.map((id) => [id, overrides[id] ?? value])) as Record<
    DimensionId,
    number
  >;

function record(
  id: number,
  extra: Partial<CalibrationRecordDTO> = {},
  ai = scores(3),
  mentor = scores(3),
): CalibrationRecordDTO {
  return {
    id,
    sessionId: `s${id}`,
    scenarioTitle: `Scenario ${id}`,
    reviewer: 'AB',
    source: 'mentor',
    evaluatorVersion: 'rules-1.0.0',
    rubricVersion: 'rubric-1',
    ai,
    mentor,
    notes: null,
    createdAt: `2026-11-${String(10 + id).padStart(2, '0')}T09:00:00.000Z`,
    ...extra,
  };
}

describe('what a record says about itself', () => {
  it('works out the gap from the stored scores only', () => {
    const r = record(1, {}, scores(3, { clarity: 5, closing: 1 }), scores(3));
    expect(differences(r)).toEqual([0, 0, 0, 2, 0, -2]);
    expect(averageGap(r)).toBeCloseTo(4 / 6);
    expect(averageGap(record(2))).toBe(0);
  });

  it('writes the summary the way the comparison reads it', () => {
    expect(comparisonSummary(record(1))).toBe(
      'On average they differ by 0.0 points, and all six skills are within 1 point.',
    );
    expect(comparisonSummary(record(1, {}, scores(3, { clarity: 5 }), scores(3)))).toBe(
      'On average they differ by 0.3 points, and 5 of 6 skills are within 1 point.',
    );
    expect(
      comparisonSummary(record(1, {}, scores(5, { clarity: 1 }), scores(1, { clarity: 5 }))),
    ).toBe('On average they differ by 4.0 points, and 0 of 6 skills are within 1 point.');
  });
});

describe('sorting the records', () => {
  const records = [
    record(1, { scenarioTitle: 'Beta', reviewer: 'ZK' }, scores(5), scores(3)),
    record(2, { scenarioTitle: 'alpha', reviewer: 'AB', source: 'sample' }),
    record(3, { scenarioTitle: 'Gamma 10', reviewer: 'AB' }, scores(3, { clarity: 4 })),
    record(4, { scenarioTitle: 'Gamma 9', reviewer: 'CD' }),
  ];
  const ids = (list: CalibrationRecordDTO[]) => list.map((r) => r.id);

  it('starts newest first and does not change the list it was given', () => {
    expect(ids(sortRecords(records, DEFAULT_SORT))).toEqual([4, 3, 2, 1]);
    expect(ids(records)).toEqual([1, 2, 3, 4]);
  });

  it('sorts words without regard to case, and numbers as numbers', () => {
    expect(ids(sortRecords(records, startSort('scenario')))).toEqual([2, 1, 4, 3]);
    expect(ids(sortRecords(records, { key: 'scenario', direction: 'descending' }))).toEqual([
      3, 4, 1, 2,
    ]);
  });

  it('keeps ties in a fixed order, newest first, whichever way the column runs', () => {
    expect(ids(sortRecords(records, startSort('reviewer')))).toEqual([3, 2, 4, 1]);
    expect(ids(sortRecords(records, { key: 'reviewer', direction: 'descending' }))).toEqual([
      1, 4, 3, 2,
    ]);
  });

  it('sorts by source and by average gap, largest first to begin with', () => {
    expect(ids(sortRecords(records, startSort('source')))).toEqual([4, 3, 1, 2]);
    expect(ids(sortRecords(records, startSort('gap')))).toEqual([1, 3, 4, 2]);
    expect(ids(sortRecords(records, { key: 'gap', direction: 'ascending' }))).toEqual([4, 2, 3, 1]);
  });

  it('turns a column round when it is chosen again, and starts another where it usually starts', () => {
    expect(nextSort(DEFAULT_SORT, 'date')).toEqual({ key: 'date', direction: 'ascending' });
    expect(nextSort(DEFAULT_SORT, 'scenario')).toEqual({
      key: 'scenario',
      direction: 'ascending',
    });
    expect(nextSort({ key: 'gap', direction: 'descending' }, 'gap').direction).toBe('ascending');
    expect(describeSort(DEFAULT_SORT)).toBe('Date, newest first');
    expect(describeSort({ key: 'scenario', direction: 'descending' })).toBe('Scenario, Z to A');
    expect(describeSort({ key: 'gap', direction: 'ascending' })).toBe(
      'Average gap, smallest first',
    );
  });
});
