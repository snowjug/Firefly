import { useId, useMemo, useState } from 'react';
import type { CalibrationRecordDTO } from '#shared/domain/api.ts';
import { DIMENSION_IDS, DIMENSIONS } from '#shared/domain/vocab.ts';
import { formatDate } from '../../lib/format.ts';
import { Field, SelectInput, Tag } from '../trainer/bridge.tsx';
import { differenceText, signed } from './bias.ts';
import {
  averageGap,
  DEFAULT_SORT,
  describeSort,
  nextSort,
  SORT_LABELS,
  sortRecords,
  sortWords,
  startSort,
  type SortKey,
  type SortState,
} from './records-model.ts';
import { SampleTag } from './tags.tsx';

const SORTABLE = Object.keys(SORT_LABELS) as SortKey[];

/** A column heading that sorts: a real button in the header, with `aria-sort` on the cell. */
function SortHeading({
  column,
  sort,
  onSort,
  className,
}: {
  column: SortKey;
  sort: SortState;
  onSort(key: SortKey): void;
  className?: string;
}) {
  const active = sort.key === column;
  return (
    <th scope="col" className={className} aria-sort={active ? sort.direction : undefined}>
      <button type="button" className="cal-sort" onClick={() => onSort(column)}>
        {SORT_LABELS[column]}
        <span className="cal-sort__mark" data-direction={active ? sort.direction : undefined} />
      </button>
    </th>
  );
}

/**
 * Every stored comparison as a real table on hairlines: when, which call, who scored it, where the
 * scores came from, the two scores and their difference for each skill, and the average gap. The
 * headings sort. Where there is no room for columns (under 40rem) each record becomes a short stack
 * of lines, and the sorting moves to a select and a button above it.
 */
export function RecordsTable({ records }: { records: CalibrationRecordDTO[] }) {
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const orderId = useId();
  const sorted = useMemo(() => sortRecords(records, sort), [records, sort]);
  const turn = (key: SortKey) => setSort((current) => nextSort(current, key));

  return (
    <div className="cal-records-block">
      <p className="cal-foot">
        Each skill cell reads: AI score, mentor score, difference (AI minus mentor).{' '}
        <span className="cal-scroll-hint">Scroll sideways to see every column.</span>
      </p>

      <div className="cal-sortbar">
        <Field label="Sort by">
          <SelectInput
            value={sort.key}
            onChange={(event) => setSort(startSort(event.target.value as SortKey))}
            options={SORTABLE.map((key) => ({ value: key, label: SORT_LABELS[key] }))}
          />
        </Field>
        <button
          type="button"
          className="action action--quiet action--compact"
          onClick={() => turn(sort.key)}
        >
          {sortWords(sort).charAt(0).toUpperCase() + sortWords(sort).slice(1)}
        </button>
      </div>

      <div
        className="cal-scroll"
        role="region"
        aria-label="Calibration records"
        // A scrolling region has to be reachable from the keyboard.
        tabIndex={0}
      >
        <table className="cal-table cal-records" aria-describedby={orderId}>
          <caption className="sr-only">
            Calibration records, with the AI and mentor score for each skill
          </caption>
          <thead>
            <tr>
              <SortHeading column="date" sort={sort} onSort={turn} />
              <SortHeading column="scenario" sort={sort} onSort={turn} />
              <SortHeading column="reviewer" sort={sort} onSort={turn} />
              <SortHeading column="source" sort={sort} onSort={turn} />
              {DIMENSION_IDS.map((dimension) => (
                <th key={dimension} scope="col" className="cal-c-skill">
                  <span className="sr-only">{DIMENSIONS[dimension].label}</span>
                  <span aria-hidden="true">{DIMENSIONS[dimension].short}</span>
                </th>
              ))}
              <SortHeading column="gap" sort={sort} onSort={turn} className="cal-c-gap" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((record) => (
              <tr key={record.id}>
                <td className="cal-c-date" data-label="Date">
                  <time dateTime={record.createdAt}>{formatDate(record.createdAt)}</time>
                </td>
                <th scope="row" className="cal-c-scenario">
                  <span className="cal-records__title">{record.scenarioTitle}</span>
                  {record.notes ? <span className="cal-meta">Notes: {record.notes}</span> : null}
                  <span className="cal-meta cal-versions">
                    {record.evaluatorVersion} &middot; {record.rubricVersion}
                  </span>
                </th>
                <td className="cal-c-reviewer" data-label="Reviewer">
                  {record.reviewer}
                </td>
                <td className="cal-c-source" data-label="Source">
                  {record.source === 'sample' ? <SampleTag /> : <Tag>Mentor</Tag>}
                </td>
                {DIMENSION_IDS.map((dimension) => {
                  const ai = record.ai[dimension];
                  const mentor = record.mentor[dimension];
                  return (
                    <td
                      key={dimension}
                      className="cal-c-skill"
                      data-label={DIMENSIONS[dimension].short}
                    >
                      <span className="cal-pairtext" aria-hidden="true">
                        <span className="cal-num">{ai}</span>
                        <i>&middot;</i>
                        <span className="cal-num">{mentor}</span>
                        <i>&middot;</i>
                        <b className="cal-num" data-gap={Math.min(2, Math.abs(ai - mentor))}>
                          {signed(ai - mentor, 0)}
                        </b>
                      </span>
                      <span className="sr-only">
                        AI {ai}, mentor {mentor}. {differenceText(ai, mentor)}.
                      </span>
                    </td>
                  );
                })}
                <td className="cal-c-gap cal-num" data-label="Average gap">
                  {averageGap(record).toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p id={orderId} className="sr-only" role="status">
        Sorted by {describeSort(sort)}.
      </p>
    </div>
  );
}
