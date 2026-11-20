import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { SessionSummaryDTO } from '#shared/domain/api.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import { IMPACT_LABELS, START_TEMPERATURE_LABELS } from '#shared/domain/vocab.ts';
import { formatDuration, formatScore, plural } from '../../lib/format.ts';
import { Tag } from '../frame/Tag.tsx';
import { Icon } from '../Icon.tsx';
import { SAMPLE_ROW_NOTE, reportHref, transcriptHref } from '../report/labels.ts';
import { SignalGlyph } from '../signal/SignalGlyph.tsx';
import { statusOf } from './status.ts';
import { callGlyphTraits, formatWhen, statusTone, type ScenarioFacts } from './trail-model.ts';

export interface CompareControl {
  checked: boolean;
  disabled: boolean;
  onChange(checked: boolean): void;
}

/**
 * One practice call on the trail. Its instrument is the node on the line; beside it, when it was,
 * how it ended (in words, and by the instrument's heart: solid only for a call taken to a close),
 * what it was, how demanding, and the actions that fit its state. Every action names the call, so a
 * list of links can be read on its own.
 */
export function TrailRow({
  session,
  scenario,
  badges,
  compare,
  retrying,
  onDelete,
  onRetry,
}: {
  session: SessionSummaryDTO;
  /** What the library knows about the scenario (its stage and length), if it is in the library. */
  scenario: ScenarioFacts | undefined;
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
  const absolute = formatWhen(session.startedAt);
  const label = `${session.scenarioTitle}, ${absolute}`;
  const score = session.overallScore;
  // Who the customer was, how demanding it was set up to be and how long it ran: the words the old
  // table kept in columns.
  const meta: ReactNode[] = [];
  if (scenario?.customer) meta.push(`with ${scenario.customer}`);
  meta.push(
    DIFFICULTY_PROFILES[session.difficulty].label,
    `${IMPACT_LABELS[session.impact].label} impact`,
    `Starts ${START_TEMPERATURE_LABELS[session.startingTemperature].label.toLowerCase()}`,
  );
  if (session.durationSeconds !== null) {
    meta.push(
      <>
        <span className="sr-only">Duration: </span>
        {formatDuration(session.durationSeconds)}
      </>,
    );
  }
  if (session.traineeTurns > 0) meta.push(plural(session.traineeTurns, 'message'));

  return (
    <li className="trail__call" data-row-id={session.id}>
      <div className="trail__node" aria-hidden="true">
        <span className="trail__seg trail__seg--lead" />
        <SignalGlyph traits={callGlyphTraits(session, scenario)} size={44} />
        <span className="trail__seg" />
      </div>

      <div className="trail__top">
        <time className="trail__when" dateTime={session.startedAt}>
          {absolute}
        </time>
        <Tag tone={statusTone(session)}>{status.label}</Tag>
        {session.isSample ? <Tag>Sample</Tag> : null}
        {session.mentorReviewed ? <Tag tone="sage">Mentor reviewed</Tag> : null}
        {badges.map((title) => (
          <Tag key={title} tone="amber">
            {title}
          </Tag>
        ))}
      </div>

      <h4 className="trail__title">{session.scenarioTitle}</h4>

      <p className="trail__meta">
        {meta.map((part, index) => (
          <Fragment key={index}>
            {index > 0 ? <span aria-hidden="true">{'\u00a0\u00b7 '}</span> : null}
            {part}
          </Fragment>
        ))}
      </p>

      <p className="trail__score">
        {score !== null ? (
          <>
            <span className="trail__figure">{formatScore(score)}</span>{' '}
            <span className="trail__of" aria-hidden="true">
              of 5
            </span>
            <span className="sr-only"> out of 5</span>
          </>
        ) : (
          <span className="trail__none">
            {session.status === 'completed' ? 'No overall score' : 'No score yet'}
          </span>
        )}
      </p>

      {session.isSample ? <p className="trail__note">{SAMPLE_ROW_NOTE}</p> : null}

      <div className="trail__actions">
        {active ? (
          <Link
            to={`/calls/${encodeURIComponent(session.id)}`}
            className="trail__act trail__act--primary"
            aria-label={`Resume call: ${label}`}
            data-row-focus=""
            viewTransition
          >
            Resume call <Icon name="arrow-right" size={16} />
          </Link>
        ) : failed ? (
          <button
            type="button"
            className="trail__act trail__act--primary"
            aria-label={`Retry report: ${label}`}
            aria-disabled={retrying || undefined}
            data-row-focus=""
            onClick={() => {
              if (!retrying) onRetry(session);
            }}
          >
            <Icon name="refresh" size={16} />
            {retrying ? 'Retrying\u2026' : 'Retry report'}
          </button>
        ) : (
          <Link
            to={reportHref(session.id)}
            className="trail__act trail__act--primary"
            aria-label={`View report: ${label}`}
            data-row-focus=""
            viewTransition
          >
            View report <Icon name="arrow-right" size={16} />
          </Link>
        )}
        {active ? null : (
          <Link
            to={transcriptHref(session.id)}
            className="trail__act"
            aria-label={`Transcript: ${label}`}
            viewTransition
          >
            Transcript
          </Link>
        )}
        <Link
          to={`/scenarios/${encodeURIComponent(session.scenarioId)}/setup`}
          className="trail__act"
          aria-label={`Practise again: ${session.scenarioTitle}`}
          viewTransition
        >
          Practise again
        </Link>
        <button
          type="button"
          className="trail__act trail__act--delete"
          aria-label={`Delete ${label}`}
          onClick={() => onDelete(session)}
        >
          Delete
        </button>
      </div>

      {compare ? (
        <label className="trail__pick">
          <input
            type="checkbox"
            checked={compare.checked}
            disabled={compare.disabled}
            aria-label={`Compare ${label}`}
            onChange={(event) => compare.onChange(event.target.checked)}
          />
          <span aria-hidden="true">Compare</span>
        </label>
      ) : null}
    </li>
  );
}
