import { useState } from 'react';
import { Link } from 'react-router';
import type {
  DimensionTrendDTO,
  ProgressDTO,
  PublicScenarioDTO,
  SessionSummaryDTO,
} from '#shared/domain/api.ts';
import type { DimensionMastery } from '#shared/domain/mastery.ts';
import { scenarioForSkill } from '#shared/domain/recommend.ts';
import { DIMENSION_IDS, DIMENSIONS } from '#shared/domain/vocab.ts';
import { formatDate, plural } from '../../lib/format.ts';
import { Icon, type IconName } from '../Icon.tsx';
import { setupPath } from '../scenario/paths.ts';
import { DimensionTrendCard } from './DimensionTrendCard.tsx';
import '../../styles/progress.css';

const RECENT_CHANGE: Record<
  ProgressDTO['recentChange'],
  { label: string; text: string; icon: IconName }
> = {
  improving: {
    label: 'Improving',
    text: 'Your most recent calls scored a little higher overall than the ones before them.',
    icon: 'chevron-up',
  },
  steady: {
    label: 'Steady',
    text: 'Your most recent calls scored about the same overall as the ones before them.',
    icon: 'arrow-right',
  },
  declining: {
    label: 'A little lower',
    text: 'Your most recent calls scored a little lower overall than the ones before them. That can happen when you try a harder scenario or a different kind of customer.',
    icon: 'chevron-down',
  },
  'not-enough-data': {
    label: 'Not enough data yet',
    text: 'A few more completed calls are needed before Firefly can describe how your scores are changing.',
    icon: 'info',
  },
};

export function SummaryCards({ progress }: { progress: ProgressDTO }) {
  const change = RECENT_CHANGE[progress.recentChange];
  const strongest = progress.strongest ? DIMENSIONS[progress.strongest] : null;
  const focus = progress.focus ? DIMENSIONS[progress.focus] : null;
  return (
    <section aria-labelledby="pg-summary-title" className="pg-section">
      <h2 id="pg-summary-title" className="sr-only">
        Summary
      </h2>
      <div className="pg-summary">
        <div className="surface pg-card">
          <p className="t-label">Completed calls</p>
          <p className="pg-big tabular">{progress.completedSessions}</p>
          <p className="t-small t-muted">
            {progress.totalSessions > progress.completedSessions
              ? `${plural(progress.totalSessions, 'session')} started in all. Only completed calls are scored.`
              : 'Each has a coaching report.'}
          </p>
        </div>

        <div className="surface pg-card">
          <p className="t-label">Recent change</p>
          <p className="pg-word">
            <Icon name={change.icon} size={20} />
            {change.label}
          </p>
          <p className="t-small t-muted">{change.text}</p>
          <p className="t-meta pg-note">{progress.note}</p>
        </div>

        <div className="surface pg-card">
          <p className="t-label">Strongest so far</p>
          {strongest ? (
            <>
              <p className="pg-word">{strongest.label}</p>
              <p className="t-small t-muted">{strongest.description}</p>
            </>
          ) : (
            <p className="t-small t-muted">
              This appears once you have a few completed calls to compare.
            </p>
          )}
        </div>

        <div className="surface pg-card pg-card-focus">
          <p className="t-label">Suggested focus</p>
          {focus ? (
            <>
              <p className="pg-word">{focus.label}</p>
              {progress.focusReason ? <p className="t-small">{progress.focusReason}</p> : null}
              <p className="t-small t-muted">{focus.description}</p>
              <Link to="/scenarios" className="pg-link" viewTransition>
                Find a scenario to practise <Icon name="arrow-right" size={16} />
              </Link>
            </>
          ) : (
            <p className="t-small t-muted">A focus is suggested after your first completed call.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function ScoresTable({ trends }: { trends: readonly DimensionTrendDTO[] }) {
  const rows = new Map<string, { at: string; scores: Partial<Record<string, number>> }>();
  for (const trend of trends) {
    for (const point of trend.points) {
      const row = rows.get(point.sessionId) ?? { at: point.at, scores: {} };
      row.scores[trend.dimension] = point.score;
      rows.set(point.sessionId, row);
    }
  }
  const ordered = [...rows.entries()].sort((a, b) => Date.parse(a[1].at) - Date.parse(b[1].at));
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
          {ordered.map(([id, row], index) => (
            <tr key={id}>
              <th scope="row">
                {index + 1}
                <span className="t-meta"> &middot; {formatDate(row.at)}</span>
              </th>
              {DIMENSION_IDS.map((dimension) => (
                <td key={dimension} className="tabular">
                  {row.scores[dimension] ?? '\u2013'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TrendsSection({
  progress,
  mastery,
}: {
  progress: ProgressDTO;
  mastery?: readonly DimensionMastery[];
}) {
  const [table, setTable] = useState(false);
  const ordered = [...progress.dimensionTrends].sort(
    (a, b) => DIMENSION_IDS.indexOf(a.dimension) - DIMENSION_IDS.indexOf(b.dimension),
  );
  return (
    <section aria-labelledby="pg-trends-title" className="pg-section">
      <div className="pg-section-head">
        <div>
          <h2 id="pg-trends-title" className="t-section">
            Skill by skill
          </h2>
          <p className="t-small t-muted pg-lead">
            Each line follows one skill across your completed calls, oldest on the left. The scale
            runs from 1 to 5.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          aria-expanded={table}
          aria-controls="pg-scores-table"
          onClick={() => setTable((v) => !v)}
        >
          <Icon name="grid" size={16} />
          {table ? 'Hide scores table' : 'Show scores as a table'}
        </button>
      </div>
      <div className="pg-trends">
        {ordered.map((trend) => (
          <DimensionTrendCard
            key={trend.dimension}
            trend={trend}
            strongest={progress.strongest === trend.dimension}
            focus={progress.focus === trend.dimension}
            mastery={mastery?.find((m) => m.dimension === trend.dimension)}
          />
        ))}
      </div>
      {table ? (
        <div id="pg-scores-table" className="pg-table-box">
          <ScoresTable trends={ordered} />
        </div>
      ) : null}
    </section>
  );
}

export function OpportunitiesSection({
  progress,
  scenarios,
  sessions,
}: {
  progress: ProgressDTO;
  /** With these, each repeated opportunity also points at a scenario built to practise it. */
  scenarios?: readonly PublicScenarioDTO[];
  sessions?: readonly SessionSummaryDTO[];
}) {
  const items = progress.repeatedOpportunities;
  return (
    <section aria-labelledby="pg-repeat-title" className="pg-section">
      <div className="pg-section-head">
        <div>
          <h2 id="pg-repeat-title" className="t-section">
            Opportunities that keep coming up
          </h2>
          <p className="t-small t-muted pg-lead">
            Skills that appeared as an improvement area in more than one call.
          </p>
        </div>
      </div>
      {items.length > 0 ? (
        <ul role="list" className="pg-repeat">
          {items.map((item) => {
            const practice = scenarios
              ? scenarioForSkill(scenarios, sessions ?? [], item.dimension)
              : null;
            return (
              <li key={item.dimension} className="surface pg-repeat-item">
                <p className="pg-repeat-name">{DIMENSIONS[item.dimension].label}</p>
                <p className="t-small t-muted">
                  Came up as an improvement area in {item.sessions} of{' '}
                  {plural(progress.completedSessions, 'completed call')}.
                </p>
                {practice ? (
                  <Link to={setupPath(practice.id)} className="pg-link" viewTransition>
                    Practise it in &ldquo;{practice.title}&rdquo;{' '}
                    <Icon name="arrow-right" size={16} />
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="pg-empty">
          No skill has come up as an improvement area in more than one call yet.
        </p>
      )}
    </section>
  );
}
