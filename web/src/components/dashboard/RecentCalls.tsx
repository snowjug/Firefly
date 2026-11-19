import { Link } from 'react-router';
import type { SessionSummaryDTO } from '#shared/domain/api.ts';
import { formatDate } from '../../lib/format.ts';
import { DifficultyChip } from '../Chips.tsx';
import { Icon } from '../Icon.tsx';
import { NONE } from './dashboard-model.ts';

/** The last few finished calls, each with its score and a link to the coaching report. */
export function RecentCalls({ calls }: { calls: readonly SessionSummaryDTO[] }) {
  return (
    <ul role="list" className="dash-recent">
      {calls.map((call) => {
        const when = call.endedAt ?? call.startedAt;
        return (
          <li key={call.id} className="dash-recent-item">
            <div className="dash-recent-main">
              <p className="dash-recent-title">{call.scenarioTitle}</p>
              <p className="dash-recent-meta">
                <time dateTime={when}>{formatDate(when)}</time>
                <DifficultyChip difficulty={call.difficulty} />
                {call.completion === 'ended-early' ? (
                  <span className="chip chip-caution">Ended early</span>
                ) : null}
              </p>
            </div>
            <p className="dash-recent-score">
              <span className="tabular">
                {call.overallScore === null ? NONE : call.overallScore.toFixed(1)}
              </span>
              <span className="dash-recent-of">
                {call.overallScore === null ? <span className="sr-only">No score</span> : ' of 5'}
              </span>
            </p>
            <Link
              to={`/sessions/${encodeURIComponent(call.id)}/report`}
              className="btn btn-secondary btn-sm"
              aria-label={`View report: ${call.scenarioTitle}`}
              viewTransition
            >
              View report
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** For someone who has not finished a call yet: calm, and pointing at the way in. */
export function NoRecentCalls() {
  return (
    <div className="dash-empty">
      <span className="tone-icon" data-tone="blue" aria-hidden="true">
        <Icon name="history" size={22} />
      </span>
      <div className="stack" style={{ ['--stack-gap' as string]: 'var(--sp-2)' }}>
        <p className="dash-empty-title">No finished calls yet</p>
        <p className="t-small t-muted">
          Your last three calls will show up here once you finish one, each with its score and a
          link to the coaching report.
        </p>
        <div>
          <Link to="/practice" className="btn btn-secondary btn-sm" viewTransition>
            Start practising
          </Link>
        </div>
      </div>
    </div>
  );
}
