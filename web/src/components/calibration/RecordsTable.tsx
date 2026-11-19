import type { CalibrationRecordDTO } from '#shared/domain/api.ts';
import { DIMENSION_IDS, DIMENSIONS } from '#shared/domain/vocab.ts';
import { formatDate } from '../../lib/format.ts';
import { differenceText, signed } from './bias.ts';
import { SampleChip } from './SampleChip.tsx';

/** Every stored comparison: who scored it, where the scores came from and how they differ. */
export function RecordsTable({ records }: { records: CalibrationRecordDTO[] }) {
  return (
    <div className="stack" style={{ ['--stack-gap' as string]: 'var(--sp-3)' }}>
      <p className="t-meta">
        Each skill cell reads: AI score, mentor score, difference (AI minus mentor).{' '}
        <span className="cal-scroll-hint">Scroll sideways to see every column.</span>
      </p>
      <div
        className="table-wrap cal-table-wrap"
        role="region"
        aria-label="Calibration records"
        // A scrolling region has to be reachable from the keyboard.
        tabIndex={0}
      >
        <table className="table cal-records">
          <caption className="sr-only">
            Calibration records, newest first, with the AI and mentor score for each skill
          </caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Scenario</th>
              <th scope="col">Reviewer</th>
              <th scope="col">Source</th>
              {DIMENSION_IDS.map((dimension) => (
                <th key={dimension} scope="col">
                  <span className="sr-only">{DIMENSIONS[dimension].label}</span>
                  <span aria-hidden="true">{DIMENSIONS[dimension].short}</span>
                </th>
              ))}
              <th scope="col">Versions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                <td className="nowrap">{formatDate(record.createdAt)}</td>
                <td className="cal-records-scenario">
                  <span className="cal-records-title">{record.scenarioTitle}</span>
                  {record.notes ? <span className="t-meta">Notes: {record.notes}</span> : null}
                </td>
                <td className="cal-records-reviewer">{record.reviewer}</td>
                <td>
                  {record.source === 'sample' ? (
                    <SampleChip />
                  ) : (
                    <span className="chip chip-accent">Mentor</span>
                  )}
                </td>
                {DIMENSION_IDS.map((dimension) => {
                  const ai = record.ai[dimension];
                  const mentor = record.mentor[dimension];
                  const gap = Math.min(2, Math.abs(ai - mentor));
                  return (
                    <td key={dimension}>
                      <span className="cal-pair tabular" aria-hidden="true">
                        {ai}
                        <span className="cal-pair-sep">&middot;</span>
                        {mentor}
                        <span className="cal-pair-sep">&middot;</span>
                        <b data-gap={gap}>{signed(ai - mentor, 0)}</b>
                      </span>
                      <span className="sr-only">
                        AI {ai}, mentor {mentor}. {differenceText(ai, mentor)}.
                      </span>
                    </td>
                  );
                })}
                <td className="t-meta cal-records-versions">
                  <span>{record.evaluatorVersion}</span>
                  <span>{record.rubricVersion}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
