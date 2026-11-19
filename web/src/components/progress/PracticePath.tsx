import { Link } from 'react-router';
import type { SessionSummaryDTO } from '#shared/domain/api.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import { DIFFICULTY_RANK } from '#shared/domain/vocab.ts';
import { formatDate, formatScore, plural } from '../../lib/format.ts';
import '../../styles/progress.css';

/** The most recent completed calls, newest first. Older ones stay in History. */
export const PATH_LENGTH = 12;

/** How brightly a call is drawn: a gentle ramp from its overall score, never hidden. */
export function pathLight(score: number | null): number {
  if (score === null) return 0.35;
  return Math.min(1, Math.max(0.35, 0.35 + ((score - 1) / 4) * 0.65));
}

/**
 * The calls so far as one path of lights. A bigger light is a harder scenario, a brighter one a
 * higher overall score, and every one opens its coaching report. A low score is still a lit call.
 */
export function PracticePath({
  calls,
  total,
  includeSamples,
}: {
  /** Completed calls, newest first. */
  calls: readonly SessionSummaryDTO[];
  /** How many completed calls there are in all. */
  total: number;
  includeSamples: boolean;
}) {
  const shown = calls.slice(0, PATH_LENGTH);
  return (
    <section aria-labelledby="pg-path-title" className="pg-section">
      <div className="pg-section-head">
        <div>
          <h2 id="pg-path-title" className="t-section">
            Your path so far
          </h2>
          <p className="t-small t-muted pg-lead">
            Each light is a completed call, newest first. Bigger lights are harder scenarios and
            brighter ones scored higher overall. Open one to read its coaching report.
          </p>
        </div>
      </div>
      {shown.length > 0 ? (
        <ol role="list" className="pg-path" aria-label="Completed calls, newest first">
          {shown.map((call) => {
            const level = DIFFICULTY_RANK[call.difficulty];
            return (
              <li
                key={call.id}
                className="pg-path-item"
                data-level={level}
                style={{ ['--lit' as string]: pathLight(call.overallScore).toFixed(2) }}
              >
                <Link to={`/sessions/${call.id}/report`} className="pg-path-link" viewTransition>
                  <span className="pg-path-node" aria-hidden="true" />
                  <span className="pg-path-body">
                    <span className="pg-path-title">{call.scenarioTitle}</span>
                    <span className="t-meta">
                      {formatDate(call.endedAt ?? call.startedAt)} &middot;{' '}
                      {DIFFICULTY_PROFILES[call.difficulty].label}
                      {call.isSample && includeSamples ? ' \u00b7 Sample' : ''}
                    </span>
                  </span>
                  <span
                    className="pg-path-score tabular"
                    aria-label={
                      call.overallScore === null
                        ? 'No score'
                        : `Overall ${formatScore(call.overallScore)} out of 5`
                    }
                  >
                    {formatScore(call.overallScore)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="pg-empty">No completed calls to show yet.</p>
      )}
      {total > shown.length ? (
        <p className="t-meta pg-path-more">
          Showing the latest {shown.length} of {plural(total, 'completed call')}. Earlier ones are
          in{' '}
          <Link to="/history" viewTransition>
            History
          </Link>
          .
        </p>
      ) : null}
    </section>
  );
}
