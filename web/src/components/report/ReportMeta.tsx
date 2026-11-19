import type { SessionDTO } from '#shared/domain/api.ts';
import type { CoachingReport } from '#shared/domain/report.ts';
import { PRACTICE_MODE_LABELS } from '#shared/domain/vocab.ts';
import { formatDateTime, formatDuration } from '../../lib/format.ts';
import { DifficultyChip } from '../Chips.tsx';
import { Icon } from '../Icon.tsx';
import { CustomerAvatar } from '../illustration/index.ts';
import { TemperatureOrb } from '../TemperatureOrb.tsx';
import { ENDED_EARLY_NOTE, SAMPLE_NOTE, SUFFICIENCY_BADGE } from './labels.ts';

/**
 * What this report is about: the call, how it ended, how the coaching was produced and what the
 * coach said overall. Notes about thin evidence sit with the summary they qualify.
 */
export function ReportMeta({ session, report }: { session: SessionDTO; report: CoachingReport }) {
  const { summary, completion, evaluator } = report;
  const endedEarly = completion.status === 'ended-early';
  const evidenceBadge = SUFFICIENCY_BADGE[completion.evidence];
  return (
    <section className="glass card rp-meta" aria-labelledby="rp-meta-title">
      <div className="rp-meta-top">
        <span className="rp-meta-avatar" aria-hidden="true">
          <CustomerAvatar seed={session.scenario.persona.name} mood={session.state.band.id} />
        </span>
        <div className="rp-meta-id">
          <p className="t-label">Practice coaching report</p>
          <h2 id="rp-meta-title" className="rp-meta-title">
            {session.scenarioTitle}
          </h2>
        </div>
      </div>

      <ul role="list" className="rp-meta-line">
        <li>
          <Icon name="calendar" size={15} />
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

      <div className="rp-meta-body">
        <p className="rp-summary">{summary.overall}</p>
        {evidenceBadge ? (
          <div className="callout callout-caution rp-evidence-note" role="note">
            <Icon name="info" size={18} />
            <p>
              <strong>{evidenceBadge}.</strong>{' '}
              {completion.note ??
                'This report rests on a small amount of the conversation, so treat it as a starting point.'}
            </p>
          </div>
        ) : completion.note ? (
          <p className="t-small t-muted rp-note">{completion.note}</p>
        ) : null}
        {session.isSample ? <p className="t-small t-muted rp-note">{SAMPLE_NOTE}</p> : null}
      </div>
    </section>
  );
}
