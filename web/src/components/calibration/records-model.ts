import type { CalibrationRecordDTO } from '#shared/domain/api.ts';
import { DIMENSION_IDS } from '#shared/domain/vocab.ts';
import { plural } from '../../lib/format.ts';

// Everything here is worked out from the stored scores of a record, nothing else: no figure is
// invented, and a record with scores that agree reads as agreeing.

type Pair = Pick<CalibrationRecordDTO, 'ai' | 'mentor'>;

/** The signed differences (AI minus mentor), one per skill, in the order of the six skills. */
export function differences(record: Pair): number[] {
  return DIMENSION_IDS.map((dimension) => record.ai[dimension] - record.mentor[dimension]);
}

/** How far apart the two sets of scores are on average, in points: 0 when they are the same. */
export function averageGap(record: Pair): number {
  const gaps = differences(record);
  return gaps.reduce((sum, gap) => sum + Math.abs(gap), 0) / gaps.length;
}

/** "On average they differ by 0.7 points, and 5 of 6 skills are within 1 point." */
export function comparisonSummary(record: Pair): string {
  const gaps = differences(record);
  const close = gaps.filter((gap) => Math.abs(gap) <= 1).length;
  const within =
    close === gaps.length
      ? 'all six skills are'
      : `${close} of ${plural(gaps.length, 'skill')} ${close === 1 ? 'is' : 'are'}`;
  return `On average they differ by ${averageGap(record).toFixed(1)} points, and ${within} within 1 point.`;
}

export type SortKey = 'date' | 'scenario' | 'reviewer' | 'source' | 'gap';
export type SortDirection = 'ascending' | 'descending';
export interface SortState {
  key: SortKey;
  direction: SortDirection;
}

/** Newest first: the order the records arrive in, and the one a reader expects. */
export const DEFAULT_SORT: SortState = { key: 'date', direction: 'descending' };

export const SORT_LABELS: Record<SortKey, string> = {
  date: 'Date',
  scenario: 'Scenario',
  reviewer: 'Reviewer',
  source: 'Source',
  gap: 'Average gap',
};

/** The direction a column starts in when it is first chosen: dates and gaps start with the most. */
const FIRST_DIRECTION: Record<SortKey, SortDirection> = {
  date: 'descending',
  scenario: 'ascending',
  reviewer: 'ascending',
  source: 'ascending',
  gap: 'descending',
};

/** Choosing the column that is already sorted turns it round; choosing another starts afresh. */
export function nextSort(current: SortState, key: SortKey): SortState {
  if (current.key !== key) return startSort(key);
  return { key, direction: current.direction === 'ascending' ? 'descending' : 'ascending' };
}

/** A column chosen from a list rather than turned round: it starts where it usually starts. */
export function startSort(key: SortKey): SortState {
  return { key, direction: FIRST_DIRECTION[key] };
}

const WORDS: Record<SortKey, Record<SortDirection, string>> = {
  date: { ascending: 'oldest first', descending: 'newest first' },
  scenario: { ascending: 'A to Z', descending: 'Z to A' },
  reviewer: { ascending: 'A to Z', descending: 'Z to A' },
  source: { ascending: 'A to Z', descending: 'Z to A' },
  gap: { ascending: 'smallest first', descending: 'largest first' },
};

/** The order in two or three words: "newest first", "A to Z". */
export function sortWords(sort: SortState): string {
  return WORDS[sort.key][sort.direction];
}

/** What the order is, in words, for the one who cannot see the arrow. */
export function describeSort(sort: SortState): string {
  return `${SORT_LABELS[sort.key]}, ${sortWords(sort)}`;
}

const text = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

/** A sorted copy. Ties keep the newest first, so the order never depends on how they arrived. */
export function sortRecords(
  records: readonly CalibrationRecordDTO[],
  sort: SortState,
): CalibrationRecordDTO[] {
  const sign = sort.direction === 'ascending' ? 1 : -1;
  const compare = (a: CalibrationRecordDTO, b: CalibrationRecordDTO): number => {
    switch (sort.key) {
      case 'date':
        return Date.parse(a.createdAt) - Date.parse(b.createdAt);
      case 'scenario':
        return text.compare(a.scenarioTitle, b.scenarioTitle);
      case 'reviewer':
        return text.compare(a.reviewer, b.reviewer);
      case 'source':
        return text.compare(a.source, b.source);
      case 'gap':
        return averageGap(a) - averageGap(b);
    }
  };
  return [...records].sort(
    (a, b) =>
      sign * compare(a, b) || Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id - a.id,
  );
}
