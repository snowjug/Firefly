import { Link } from 'react-router';
import type { SessionSummaryDTO } from '#shared/domain/api.ts';
import { DIMENSION_IDS, DIMENSIONS, START_TEMPERATURE_LABELS } from '#shared/domain/vocab.ts';
import { formatDateTime, formatDuration, formatRelative, plural } from '../../lib/format.ts';
import { DifficultyChip } from '../Chips.tsx';
import { Icon } from '../Icon.tsx';
import { SAMPLE_ROW_NOTE, reportHref, scoreText, transcriptHref } from '../report/labels.ts';
import { statusOf } from './status.ts';
import '../../styles/history.css';

/** Six tiny bars, one per skill. Decorative: the numbers are available as text next to them. */
function MiniBars({ scores }: { scores: NonNullable<SessionSummaryDTO['dimensionScores']> }) {
  return (
    <span className="hs-bars" aria-hidden="true">
      {DIMENSION_IDS.map((id) => {
        const score = scores[id];
        return (
          <span key={id} className="hs-bar" data-empty={score === undefined ? 'true' : undefined}>
            <span style={{ height: `${((score ?? 0) / 5) * 100}%` }} />
          </span>
        );
      })}
    </span>
  );
}

export function skillScoresText(scores: NonNullable<SessionSummaryDTO['dimensionScores']>): string {
  return DIMENSION_IDS.filter((id) => scores[id] !== undefined)
    .map((id) => `${DIMENSIONS[id].short} ${scores[id]}`)
    .join(', ');
}

export interface CompareControl {
  checked: boolean;
  disabled: boolean;
  onChange(checked: boolean): void;
}

/** One practice session: what it was, how it went and what you can do with it. */
export function SessionRow({
  session,
  compare,
  onDelete,
}: {
  session: SessionSummaryDTO;
  /** Present only for sessions that can be compared (completed, with scores). */
  compare: CompareControl | null;
  onDelete(session: SessionSummaryDTO): void;
}) {
  const status = statusOf(session);
  const active = session.status === 'active';
  const absolute = formatDateTime(session.startedAt);
  const scores = session.dimensionScores;
  const titleId = `hs-title-${session.id}`;

  return (
    <article className="surface hs-row" data-row-id={session.id} aria-labelledby={titleId}>
      <div className="hs-main">
        <h3 id={titleId} className="hs-title" tabIndex={-1} data-row-focus="">
          {session.scenarioTitle}
        </h3>
        <p className="hs-meta">
          <time dateTime={session.startedAt} title={absolute}>
            {formatRelative(session.startedAt)}
          </time>
          <span className="sr-only"> ({absolute})</span>
          {session.durationSeconds !== null ? (
            <span>
              <Icon name="clock" size={14} />
              <span className="sr-only">Duration: </span>
              {formatDuration(session.durationSeconds)}
            </span>
          ) : null}
          {session.traineeTurns > 0 ? <span>{plural(session.traineeTurns, 'message')}</span> : null}
        </p>
        <ul role="list" className="hs-chips">
          <li>
            <DifficultyChip difficulty={session.difficulty} />
          </li>
          <li>
            <span className="chip">
              Starts {START_TEMPERATURE_LABELS[session.startingTemperature].label.toLowerCase()}
            </span>
          </li>
          <li>
            <span
              className={`chip chip-${status.tone}`}
              title={
                status.label === 'Ended early' ? 'This call stopped before a wrap-up.' : undefined
              }
            >
              <span className="sr-only">Status: </span>
              {status.label}
            </span>
          </li>
          {session.isSample ? (
            <li>
              <span className="chip chip-accent">Sample</span>
            </li>
          ) : null}
          {session.mentorReviewed ? (
            <li>
              <span className="chip chip-positive">Mentor reviewed</span>
            </li>
          ) : null}
        </ul>
        {session.isSample ? <p className="hs-sample t-meta">{SAMPLE_ROW_NOTE}</p> : null}
      </div>

      <div className="hs-score">
        {session.overallScore !== null ? (
          <>
            <p className="hs-score-num">
              <span className="tabular">{scoreText(session.overallScore)}</span>
              <span className="hs-score-of"> of 5</span>
            </p>
            <span className="t-meta">Overall</span>
            {scores ? (
              <>
                <MiniBars scores={scores} />
                <span className="sr-only">Skill scores: {skillScoresText(scores)}.</span>
              </>
            ) : null}
          </>
        ) : (
          <p className="t-small t-muted">
            {session.status === 'completed' ? 'No overall score' : 'No score yet'}
          </p>
        )}
      </div>

      <div className="hs-actions">
        {active ? (
          <Link
            to={`/calls/${encodeURIComponent(session.id)}`}
            className="btn btn-primary"
            viewTransition
          >
            Resume <Icon name="arrow-right" size={16} />
          </Link>
        ) : (
          <Link to={reportHref(session.id)} className="btn btn-primary" viewTransition>
            Open report <Icon name="arrow-right" size={16} />
          </Link>
        )}
        {active ? null : (
          <Link to={transcriptHref(session.id)} className="btn btn-secondary btn-sm" viewTransition>
            Transcript
          </Link>
        )}
        <Link
          to={`/scenarios/${encodeURIComponent(session.scenarioId)}/setup`}
          className="btn btn-secondary btn-sm"
          viewTransition
        >
          Practise again
        </Link>
        <button
          type="button"
          className="btn btn-ghost btn-sm hs-delete"
          onClick={() => onDelete(session)}
          aria-label={`Delete ${session.scenarioTitle}, ${absolute}`}
        >
          <Icon name="trash" size={16} />
          Delete
        </button>
        {compare ? (
          <label className="hs-compare">
            <input
              type="checkbox"
              checked={compare.checked}
              disabled={compare.disabled}
              aria-label={`Compare ${session.scenarioTitle}, ${absolute}`}
              onChange={(event) => compare.onChange(event.target.checked)}
            />
            <span>Compare</span>
          </label>
        ) : null}
      </div>
    </article>
  );
}
