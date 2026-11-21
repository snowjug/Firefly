import type { ReviewableSessionDTO } from '#shared/domain/api.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import { formatDate, plural } from '../../lib/format.ts';
import { Icon } from '../trainer/bridge.tsx';
import { ENDED_EARLY_NOTE, EndedEarlyTag, SampleTag } from './tags.tsx';

export const queueButtonId = (sessionId: string) => `cal-review-${sessionId}`;

/**
 * Completed sessions that no mentor has scored yet, one line of words each. Only identifying
 * details are shown: the AI's scores for these sessions are deliberately left out so a reviewer
 * never sees them first.
 */
export function ReviewQueue({
  sessions,
  onScore,
}: {
  sessions: ReviewableSessionDTO[];
  onScore(session: ReviewableSessionDTO): void;
}) {
  return (
    <ul className="cal-queue">
      {sessions.map((session) => (
        <li key={session.id} className="cal-queue__item">
          <div className="cal-queue__text">
            <p className="cal-queue__title">{session.scenarioTitle}</p>
            <p className="cal-facts type-label">
              <span>
                <time dateTime={session.startedAt}>{formatDate(session.startedAt)}</time>
              </span>
              <span>{DIFFICULTY_PROFILES[session.difficulty].label}</span>
              <span>{plural(session.traineeTurns, 'trainee message')}</span>
              {session.completion === 'ended-early' ? <EndedEarlyTag /> : null}
              {session.isSample ? <SampleTag /> : null}
            </p>
            {session.completion === 'ended-early' ? (
              <p className="cal-queue__note">{ENDED_EARLY_NOTE}</p>
            ) : null}
          </div>
          <button
            type="button"
            id={queueButtonId(session.id)}
            className="action action--quiet"
            aria-label={`Score this session: ${session.scenarioTitle}, ${formatDate(session.startedAt)}`}
            onClick={() => onScore(session)}
          >
            Score this session <Icon name="arrow-right" size={18} />
          </button>
        </li>
      ))}
    </ul>
  );
}
