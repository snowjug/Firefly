import type { ReviewableSessionDTO } from '#shared/domain/api.ts';
import { formatDate, plural } from '../../lib/format.ts';
import { DifficultyChip } from '../Chips.tsx';
import { ENDED_EARLY_NOTE, EndedEarlyChip } from './EndedEarly.tsx';
import { SampleChip } from './SampleChip.tsx';

export const queueButtonId = (sessionId: string) => `cal-review-${sessionId}`;

/**
 * Completed sessions that no mentor has scored yet. Only identifying details are shown: the AI's
 * scores for these sessions are deliberately left out so a reviewer never sees them first.
 */
export function ReviewQueue({
  sessions,
  onScore,
}: {
  sessions: ReviewableSessionDTO[];
  onScore(session: ReviewableSessionDTO): void;
}) {
  return (
    <ul role="list" className="cal-queue">
      {sessions.map((session) => (
        <li key={session.id} className="cal-queue-item">
          <div className="cal-queue-text">
            <p className="cal-queue-title">{session.scenarioTitle}</p>
            <p className="t-meta cal-queue-meta">
              <span>{formatDate(session.startedAt)}</span>
              <DifficultyChip difficulty={session.difficulty} />
              <span>{plural(session.traineeTurns, 'trainee message')}</span>
              {session.completion === 'ended-early' ? <EndedEarlyChip /> : null}
              {session.isSample ? <SampleChip /> : null}
            </p>
            {session.completion === 'ended-early' ? (
              <p className="t-meta cal-queue-note">{ENDED_EARLY_NOTE}</p>
            ) : null}
          </div>
          <button
            type="button"
            id={queueButtonId(session.id)}
            className="btn btn-secondary"
            aria-label={`Score this session: ${session.scenarioTitle}, ${formatDate(session.startedAt)}`}
            onClick={() => onScore(session)}
          >
            Score this session
          </button>
        </li>
      ))}
    </ul>
  );
}
