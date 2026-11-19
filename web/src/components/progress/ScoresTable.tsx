import type { DimensionTrendDTO } from '#shared/domain/api.ts';
import { DIMENSION_IDS, DIMENSIONS } from '#shared/domain/vocab.ts';
import { formatDate } from '../../lib/format.ts';
import { scoreRows } from './progress-model.ts';

const NO_SCORE = '\u2013';

/** The same scores as the charts, as a table: one row per completed call, one column per skill. */
export function ScoresTable({ trends }: { trends: readonly DimensionTrendDTO[] }) {
  const rows = scoreRows(trends);
  return (
    <div
      className="pg-table-scroll"
      role="region"
      aria-label="Skill scores for each call, oldest first"
      tabIndex={0}
    >
      <table className="table pg-table">
        <caption className="sr-only">Skill scores out of 5 for each completed call</caption>
        <thead>
          <tr>
            <th scope="col">Call</th>
            {DIMENSION_IDS.map((id) => (
              <th key={id} scope="col">
                {DIMENSIONS[id].short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.sessionId}>
              <th scope="row">
                {index + 1}
                <span className="t-meta"> &middot; {formatDate(row.at)}</span>
              </th>
              {DIMENSION_IDS.map((dimension) => (
                <td key={dimension} className="tabular">
                  {row.scores[dimension] ?? NO_SCORE}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
