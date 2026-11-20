import { Link } from 'react-router';
import type { DimensionTrendDTO } from '#shared/domain/api.ts';
import { DIMENSION_IDS, DIMENSIONS } from '#shared/domain/vocab.ts';
import { formatDate } from '../../lib/format.ts';
import { reportHref } from '../report/labels.ts';
import { scoreRows } from './progress-model.ts';
import '../../styles/progress.css';

const NO_SCORE = '\u2013';

/**
 * The same scores as the lines, as a table: one row per completed call, one column per skill. The
 * call's date opens its report, so every number can be traced back to where it came from.
 */
export function ScoresTable({ trends }: { trends: readonly DimensionTrendDTO[] }) {
  const rows = scoreRows(trends);
  return (
    <div
      className="pg-table-scroll"
      role="region"
      aria-label="Skill scores for each call, oldest first"
      tabIndex={0}
    >
      <table className="pg-table">
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
                <span className="pg-table__when">
                  {' '}
                  &middot;{' '}
                  <Link to={reportHref(row.sessionId)} className="text-link" viewTransition>
                    {formatDate(row.at)}
                  </Link>
                </span>
              </th>
              {DIMENSION_IDS.map((dimension) => (
                <td key={dimension}>{row.scores[dimension] ?? NO_SCORE}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
