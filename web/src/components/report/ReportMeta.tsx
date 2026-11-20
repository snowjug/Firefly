import type { SessionDTO } from '#shared/domain/api.ts';
import type { CoachingReport } from '#shared/domain/report.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import { PRACTICE_MODE_LABELS } from '#shared/domain/vocab.ts';
import { formatDateTime, formatDuration } from '../../lib/format.ts';
import { usedVoice } from '../../lib/voice-sessions.ts';
import { Tag } from './bridge.tsx';
import { ENDED_EARLY_NOTE, SAMPLE_NOTE, SUFFICIENCY_BADGE, VOICE_NOTE } from './labels.ts';

/**
 * What this report is about, in the mono line under the title: when, how long, how hard, how it was
 * practised, how it ended and who coached. The notes that qualify the result (an early end, thin
 * evidence, voice, a sample) follow it, before anything is read, because how far the report can be
 * trusted comes first.
 */
export function ReportMeta({ session, report }: { session: SessionDTO; report: CoachingReport }) {
  const { completion, evaluator } = report;
  const endedEarly = completion.status === 'ended-early';
  const evidenceBadge = SUFFICIENCY_BADGE[completion.evidence];
  const voice = usedVoice(session.id);
  return (
    <div className="rp-meta">
      <ul role="list" className="rp-meta__line" aria-label="About this call">
        <li>
          <time dateTime={session.startedAt}>{formatDateTime(session.startedAt)}</time>
        </li>
        <li>
          <span>
            <span className="sr-only">Duration: </span>
            {formatDuration(session.durationSeconds)}
          </span>
        </li>
        <li>{DIFFICULTY_PROFILES[session.difficulty].label}</li>
        <li>{PRACTICE_MODE_LABELS[session.mode].label}</li>
        {voice ? <li>Voice used</li> : null}
      </ul>

      <ul role="list" className="rp-meta__status" aria-label="How the call went">
        <li>
          <Tag tone={endedEarly ? 'amber' : 'sage'}>{endedEarly ? 'Ended early' : 'Completed'}</Tag>
        </li>
        {evidenceBadge ? (
          <li>
            <Tag tone="amber">{evidenceBadge}</Tag>
          </li>
        ) : null}
        <li title="How the coaching in this report was produced">
          <Tag tone="aqua">{evaluator.providerLabel}</Tag>
        </li>
        {session.isSample ? (
          <li>
            <Tag tone="amber">Sample session</Tag>
          </li>
        ) : null}
        {session.mentorReviewed ? (
          <li>
            <Tag tone="sage">Mentor reviewed</Tag>
          </li>
        ) : null}
      </ul>

      <div className="rp-notes">
        {endedEarly ? <p className="rp-note">{ENDED_EARLY_NOTE}</p> : null}
        {voice ? <p className="rp-note">{VOICE_NOTE}</p> : null}
        {evidenceBadge ? (
          <p className="rp-note" role="note">
            <strong>{evidenceBadge}.</strong>{' '}
            {completion.note ??
              'This report rests on a small amount of the conversation, so treat it as a starting point.'}
          </p>
        ) : completion.note ? (
          <p className="rp-note">{completion.note}</p>
        ) : null}
        {session.isSample ? <p className="rp-note">{SAMPLE_NOTE}</p> : null}
      </div>
    </div>
  );
}
