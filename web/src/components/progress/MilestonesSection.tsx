import { Link } from 'react-router';
import type { AsyncState } from '../../lib/hooks.ts';
import { formatDate, plural } from '../../lib/format.ts';
import type { Milestones } from '../../lib/milestones.ts';
import { SkeletonBlock } from '../Page.tsx';
import '../../styles/progress.css';

const STAR = 'M24 10l3.6 9.4 10 .6-7.8 6.3 2.6 9.7L24 30.6l-8.4 5.4 2.6-9.7L10.4 20l10-.6L24 10z';

/**
 * The six practice milestones, lit when a recent call earned them and left dim, with what they
 * take, when it did not. They are read from the saved coaching reports by the same rules the report
 * page uses, so a milestone never appears here unless a report shows the words that earned it.
 */
export function MilestonesSection({ state }: { state: AsyncState<Milestones> }) {
  const data = state.loading ? null : state.data;
  const earned = data ? data.tally.filter((t) => t.count > 0).length : 0;
  return (
    <section aria-labelledby="pg-ms-title" className="pg-section">
      <div className="pg-section-head">
        <div>
          <h2 id="pg-ms-title" className="t-section">
            Milestones
          </h2>
          <p className="t-small t-muted pg-lead">
            A milestone is awarded only when the words in a call support it. They mark practice, not
            ability.
            {data && data.inspected > 0
              ? ` Checked against your latest ${plural(data.inspected, 'completed call')}.`
              : ''}
          </p>
        </div>
        {data && data.inspected > 0 ? (
          <p className="pg-ms-count t-small">
            {earned} of {data.tally.length} earned so far
          </p>
        ) : null}
      </div>

      {state.loading ? (
        <ul role="list" className="pg-ms-list" aria-label="Loading milestones">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <li key={i} className="pg-ms">
              <SkeletonBlock height={60} />
            </li>
          ))}
        </ul>
      ) : state.error || !data ? (
        <div className="pg-empty" role="alert">
          <p>We couldn&rsquo;t read your recent reports to check milestones.</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={state.reload}>
            Try again
          </button>
        </div>
      ) : (
        <>
          <ul role="list" className="pg-ms-list">
            {data.tally.map(({ definition, count, latest }) => (
              <li key={definition.id} className="pg-ms" data-earned={count > 0}>
                <span className="pg-ms-mark" aria-hidden="true">
                  <svg viewBox="0 0 48 48" focusable="false">
                    <circle cx="24" cy="24" r="21" className="pg-ms-ring" />
                    <path d={STAR} className="pg-ms-star" />
                  </svg>
                </span>
                <div className="pg-ms-body">
                  <h3 className="pg-ms-title">{definition.title}</h3>
                  <p className="t-small t-muted">{definition.criteria}</p>
                  {latest ? (
                    <>
                      <p className="t-small pg-ms-earned">
                        Earned in {plural(count, 'call')}. Most recently in{' '}
                        <Link to={`/sessions/${latest.sessionId}/report`} viewTransition>
                          {latest.scenarioTitle}
                        </Link>
                        , {formatDate(latest.at)}.
                      </p>
                      {latest.proof.quote ? (
                        <blockquote className="pg-ms-quote">
                          &ldquo;{latest.proof.quote}&rdquo;
                        </blockquote>
                      ) : null}
                      <p className="t-meta">{latest.proof.detail}</p>
                    </>
                  ) : (
                    <p className="t-meta">Not earned yet.</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {data.unavailable > 0 ? (
            <p className="t-meta pg-ms-note">
              {plural(data.unavailable, 'report')} could not be read just now, so{' '}
              {data.unavailable === 1 ? 'it was' : 'they were'} left out.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
