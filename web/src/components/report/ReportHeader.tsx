import type { RefObject } from 'react';
import { Link } from 'react-router';
import type { SessionDTO } from '#shared/domain/api.ts';
import type { CoachingReport } from '#shared/domain/report.ts';
import { PRACTICE_MODE_LABELS } from '#shared/domain/vocab.ts';
import { formatDateTime, formatDuration } from '../../lib/format.ts';
import { DifficultyChip } from '../Chips.tsx';
import { Icon } from '../Icon.tsx';
import { ScoreMeter } from '../ScoreMeter.tsx';
import { TemperatureOrb } from '../TemperatureOrb.tsx';
import { ReportConstellation } from './ReportConstellation.tsx';
import {
  ENDED_EARLY_NOTE,
  SAMPLE_NOTE,
  SUFFICIENCY_BADGE,
  dimensionLabel,
  scoreOfFive,
  scoreText,
  transcriptHref,
} from './labels.ts';
import { buildMoments } from './timeline-model.ts';

/** The summary header: the one place in the report that uses glass. */
export function ReportHeader({
  session,
  report,
  headingRef,
}: {
  session: SessionDTO;
  report: CoachingReport;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const { summary, completion, evaluator } = report;
  const endedEarly = completion.status === 'ended-early';
  const evidenceBadge = SUFFICIENCY_BADGE[completion.evidence];
  const moments = buildMoments(report.journey.points);
  const firstBand = moments[0]?.band.label;
  const lastBand = moments[moments.length - 1]?.band.label;
  const mood =
    firstBand && lastBand
      ? firstBand === lastBand
        ? `Stayed ${firstBand}`
        : `${firstBand} to ${lastBand}`
      : null;
  return (
    <header className="glass glass-strong rp-hero" aria-labelledby="rp-title">
      <div className="rp-hero-top">
        <div className="rp-hero-id">
          <p className="t-label">Practice coaching report</p>
          <h1 id="rp-title" className="t-title rp-title" tabIndex={-1} ref={headingRef}>
            {session.scenarioTitle}
          </h1>
          <ul role="list" className="rp-meta">
            <li>
              <time dateTime={session.startedAt}>{formatDateTime(session.startedAt)}</time>
            </li>
            <li>
              <Icon name="clock" size={15} />
              <span>
                <span className="sr-only">Duration: </span>
                {formatDuration(session.durationSeconds)}
              </span>
            </li>
            <li>
              <DifficultyChip difficulty={session.difficulty} />
            </li>
            <li>{PRACTICE_MODE_LABELS[session.mode].label}</li>
          </ul>
          <ul role="list" className="rp-status" aria-label="How the call went">
            <li>
              <span className={`chip ${endedEarly ? 'chip-caution' : 'chip-positive'}`}>
                <Icon name={endedEarly ? 'flag' : 'check'} size={14} />
                {endedEarly ? 'Ended early' : 'Completed'}
              </span>
            </li>
            <li>
              <span className="chip">
                <TemperatureOrb band={session.state.band.id} />
                Customer at the end: {session.state.band.label}
              </span>
            </li>
            {evidenceBadge ? (
              <li>
                <span className="chip chip-caution">{evidenceBadge}</span>
              </li>
            ) : null}
            <li>
              <span className="chip chip-info" title="How the coaching in this report was produced">
                <Icon name="info" size={14} />
                {evaluator.providerLabel}
              </span>
            </li>
            {session.isSample ? (
              <li>
                <span className="chip chip-accent">Sample session</span>
              </li>
            ) : null}
            {session.mentorReviewed ? (
              <li>
                <span className="chip chip-positive">Mentor reviewed</span>
              </li>
            ) : null}
          </ul>
          {endedEarly ? (
            <p className="rp-ended-note t-small t-muted">
              <Icon name="info" size={16} />
              <span>{ENDED_EARLY_NOTE}</span>
            </p>
          ) : null}
        </div>

        <div className="rp-hero-text">
          <p className="rp-summary">{summary.overall}</p>

          {evidenceBadge ? (
            <div className="callout callout-caution rp-evidence-note" role="note">
              <Icon name="info" size={18} />
              <div>
                <p>
                  <strong>{evidenceBadge}.</strong>{' '}
                  {completion.note ??
                    'This report rests on a small amount of the conversation, so treat it as a starting point.'}
                </p>
              </div>
            </div>
          ) : completion.note ? (
            <p className="t-small t-muted rp-note">{completion.note}</p>
          ) : null}

          {session.isSample ? <p className="t-small t-muted rp-note">{SAMPLE_NOTE}</p> : null}
        </div>

        <div className="rp-side">
          <div className="rp-const-wrap">
            <ReportConstellation dimensions={report.dimensions} />
            <div className="rp-overall">
              <p className="t-label">Overall</p>
              <p className="rp-overall-score">
                {summary.overallScore !== null ? (
                  <>
                    <span className="rp-overall-num tabular">
                      {scoreText(summary.overallScore)}
                    </span>
                    <span className="rp-overall-of"> of 5</span>
                  </>
                ) : (
                  <span className="rp-overall-num" aria-hidden="true">
                    &ndash;
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="rp-overall-more">
            {summary.overallScore !== null ? (
              <>
                <span aria-hidden="true">
                  <ScoreMeter
                    score={summary.overallScore}
                    label={scoreOfFive(summary.overallScore)}
                  />
                </span>
                <p className="t-meta">
                  Across the six skills. A practice signal, not a grade or a ranking.
                </p>
              </>
            ) : (
              <p className="t-small t-muted">No overall score for this call.</p>
            )}
          </div>
          <dl className="rp-glance" aria-label="At a glance">
            {report.discovery.total > 0 ? (
              <div>
                <dt>Hidden facts found</dt>
                <dd>
                  {report.discovery.found} of {report.discovery.total}
                </dd>
              </div>
            ) : null}
            {mood ? (
              <div>
                <dt>Customer mood</dt>
                <dd>{mood}</dd>
              </div>
            ) : null}
            <div>
              <dt>Your turns</dt>
              <dd>{completion.traineeTurns}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="rp-hero-foot">
        {summary.coachingFocus.length > 0 ? (
          <div className="rp-focus">
            <p className="t-label">Coaching focus</p>
            <ul role="list" className="cluster">
              {summary.coachingFocus.map((id) => (
                <li key={id}>
                  <a href={`#dim-${id}`} className="chip chip-accent rp-focus-chip">
                    {dimensionLabel(id)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <span />
        )}
        <div className="cluster rp-actions">
          <Link to={transcriptHref(session.id)} className="btn btn-secondary" viewTransition>
            <Icon name="notes" size={18} /> Review transcript
          </Link>
          <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
            <Icon name="print" size={18} /> Print or save as PDF
          </button>
        </div>
      </div>
    </header>
  );
}
