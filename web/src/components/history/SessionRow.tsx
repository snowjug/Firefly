/* eslint-disable jsx-a11y/no-interactive-element-to-noninteractive-role --
   The explicit table roles keep the row's table semantics when the stylesheet turns the row into a
   stacked card (some browsers drop them once a table part is no longer displayed as a table). */
import { Link } from 'react-router';
import type { SessionSummaryDTO } from '#shared/domain/api.ts';
import {
  IMPACT_LABELS,
  START_TEMPERATURE_LABELS,
  type BusinessImpact,
} from '#shared/domain/vocab.ts';
import {
  formatDate,
  formatDateTime,
  formatDuration,
  formatScore,
  formatTime,
  plural,
} from '../../lib/format.ts';
import { DifficultyChip } from '../Chips.tsx';
import { Icon } from '../Icon.tsx';
import { ENDED_EARLY_NOTE, SAMPLE_ROW_NOTE, reportHref, transcriptHref } from '../report/labels.ts';
import { statusOf } from './status.ts';

// High impact reads red, medium blue and low stays neutral. Amber is kept for rewards, and the words
// carry the meaning, so colour is never the only signal.
const IMPACT_CHIP: Record<BusinessImpact, string> = {
  high: 'chip-negative',
  medium: 'chip-info',
  low: '',
};

/** Scores are practice signals, so they are tinted calmly: no red or amber for a lower score. */
export function scoreChipClass(score: number): string {
  return score >= 4 ? 'chip-positive' : score >= 3 ? 'chip-info' : '';
}

export interface CompareControl {
  checked: boolean;
  disabled: boolean;
  onChange(checked: boolean): void;
}

/**
 * One practice call as a table row. On narrow screens the stylesheet stacks the cells into a card,
 * using each cell's `data-label` as its caption.
 */
export function SessionRow({
  session,
  badges,
  compare,
  retrying,
  onDelete,
  onRetry,
}: {
  session: SessionSummaryDTO;
  /** Titles of the badges this call earned; empty when none, or when rewards are unavailable. */
  badges: readonly string[];
  /** Present only for calls that can be compared (completed, with scores). */
  compare: CompareControl | null;
  retrying: boolean;
  onDelete(session: SessionSummaryDTO): void;
  onRetry(session: SessionSummaryDTO): void;
}) {
  const status = statusOf(session);
  const active = session.status === 'active';
  const failed = session.status === 'evaluation_failed';
  const endedEarly = session.completion === 'ended-early';
  const absolute = formatDateTime(session.startedAt);
  const label = `${session.scenarioTitle}, ${absolute}`;
  const score = session.overallScore;

  return (
    <tr data-row-id={session.id} role="row">
      <td className="hs-c-pick" role="cell">
        {compare ? (
          <label className="hs-pick">
            <input
              type="checkbox"
              checked={compare.checked}
              disabled={compare.disabled}
              aria-label={`Compare ${label}`}
              onChange={(event) => compare.onChange(event.target.checked)}
            />
            <span className="hs-pick-text" aria-hidden="true">
              Compare
            </span>
          </label>
        ) : null}
      </td>

      <td className="hs-c-date" data-label="Date" role="cell">
        <time dateTime={session.startedAt}>{formatDate(session.startedAt)}</time>
        <span className="hs-sub">{formatTime(session.startedAt)}</span>
      </td>

      <th scope="row" className="hs-c-scenario" role="rowheader">
        <span className="hs-title">{session.scenarioTitle}</span>
        <ul role="list" className="hs-chips">
          <li>
            <DifficultyChip difficulty={session.difficulty} />
          </li>
          {session.status === 'completed' ? null : (
            <li>
              <span className={`chip chip-${status.tone}`}>
                <span className="sr-only">Status: </span>
                {status.label}
              </span>
            </li>
          )}
          {session.isSample ? (
            <li>
              <span className="chip chip-violet">Sample</span>
            </li>
          ) : null}
          {session.mentorReviewed ? (
            <li>
              <span className="chip chip-positive">Mentor reviewed</span>
            </li>
          ) : null}
        </ul>
        <span className="hs-facts">
          <span>
            Starts {START_TEMPERATURE_LABELS[session.startingTemperature].label.toLowerCase()}
          </span>
          {session.durationSeconds !== null ? (
            <span>
              <span className="sr-only">Duration: </span>
              {formatDuration(session.durationSeconds)}
            </span>
          ) : null}
          {session.traineeTurns > 0 ? <span>{plural(session.traineeTurns, 'message')}</span> : null}
        </span>
        {session.isSample ? <span className="hs-note">{SAMPLE_ROW_NOTE}</span> : null}
      </th>

      <td className="hs-c-impact" data-label="Impact" role="cell">
        <span className={`chip ${IMPACT_CHIP[session.impact]}`.trim()}>
          {IMPACT_LABELS[session.impact].label}
        </span>
      </td>

      <td className="hs-c-score" data-label="Score" role="cell">
        <div className="hs-score-cell">
          {score !== null ? (
            <span className={`chip hs-score ${scoreChipClass(score)}`.trim()}>
              {formatScore(score)}
              <span className="sr-only"> out of 5</span>
            </span>
          ) : (
            <>
              <span aria-hidden="true">&mdash;</span>
              <span className="sr-only">
                {session.status === 'completed' ? 'No overall score' : 'No score yet'}
              </span>
            </>
          )}
          {endedEarly ? (
            <span className="chip" title={ENDED_EARLY_NOTE}>
              Ended early
            </span>
          ) : null}
        </div>
      </td>

      <td className="hs-c-badges" data-label="Badges" role="cell">
        {badges.length > 0 ? (
          <ul role="list" className="hs-badges">
            {badges.map((title) => (
              <li key={title}>
                <span className="chip chip-amber">
                  <Icon name="star" size={14} fill="currentColor" />
                  {title}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <>
            <span aria-hidden="true">&mdash;</span>
            <span className="sr-only">No badges earned in this call</span>
          </>
        )}
      </td>

      <td className="hs-c-actions" role="cell">
        <div className="hs-actions">
          {active ? (
            <Link
              to={`/calls/${encodeURIComponent(session.id)}`}
              className="btn btn-primary btn-sm hs-primary"
              aria-label={`Resume call: ${label}`}
              data-row-focus=""
              viewTransition
            >
              Resume <Icon name="arrow-right" size={16} />
            </Link>
          ) : failed ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm hs-primary"
              aria-label={`Retry report: ${label}`}
              aria-disabled={retrying || undefined}
              data-row-focus=""
              onClick={() => {
                if (!retrying) onRetry(session);
              }}
            >
              {retrying ? (
                <span className="spinner" aria-hidden="true" />
              ) : (
                <Icon name="refresh" size={16} />
              )}
              {retrying ? 'Retrying\u2026' : 'Retry report'}
            </button>
          ) : (
            <Link
              to={reportHref(session.id)}
              className="btn btn-sm hs-primary hs-soft"
              aria-label={`View report: ${label}`}
              data-row-focus=""
              viewTransition
            >
              View
            </Link>
          )}
          {active ? null : (
            <Link
              to={transcriptHref(session.id)}
              className="btn btn-ghost btn-sm btn-icon hs-icon-btn"
              aria-label={`Transcript: ${label}`}
              title="Transcript"
              viewTransition
            >
              <Icon name="file-text" size={18} />
              <span className="hs-act-text" aria-hidden="true">
                Transcript
              </span>
            </Link>
          )}
          <Link
            to={`/scenarios/${encodeURIComponent(session.scenarioId)}/setup`}
            className="btn btn-ghost btn-sm btn-icon hs-icon-btn"
            aria-label={`Practise again: ${session.scenarioTitle}`}
            title="Practise again"
            viewTransition
          >
            <Icon name="repeat" size={18} />
            <span className="hs-act-text" aria-hidden="true">
              Practise again
            </span>
          </Link>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon hs-icon-btn hs-delete"
            aria-label={`Delete ${label}`}
            title="Delete"
            onClick={() => onDelete(session)}
          >
            <Icon name="trash" size={18} />
          </button>
        </div>
      </td>
    </tr>
  );
}
