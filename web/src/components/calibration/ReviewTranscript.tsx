import { useId } from 'react';
import type { TranscriptDTO } from '#shared/domain/api.ts';
import { ErrorState, SkeletonBlock } from '../Page.tsx';

/** What the review shows of each turn: who spoke, in which position, and the words. */
export type TranscriptTurn = Pick<TranscriptDTO['turns'][number], 'index' | 'role' | 'text'>;

/**
 * The call as plain text, with each speaker named in words. Only turn numbers, roles and text are
 * drawn, and the transcript endpoint supplies nothing else, so a blind review cannot show a score.
 */
export function ReviewTranscript({
  turns,
  loading,
  error,
  onRetry,
}: {
  turns: TranscriptTurn[] | null;
  loading: boolean;
  error: unknown;
  onRetry(): void;
}) {
  const titleId = useId();
  return (
    <section className="cal-transcript" aria-labelledby={titleId}>
      <h3 id={titleId} className="t-body cal-subhead">
        Transcript
      </h3>
      {turns ? (
        <div
          className="cal-transcript-scroll"
          role="region"
          aria-label="Call transcript"
          // A scrolling region has to be reachable from the keyboard.
          tabIndex={0}
        >
          <ol role="list" className="cal-turns">
            {turns.map((turn) => (
              <li key={turn.index} className="cal-turn" data-role={turn.role}>
                <p className="cal-turn-role">
                  {turn.role === 'customer' ? 'Customer' : 'Trainee'}
                  <span className="cal-turn-index"> &middot; turn {turn.index}</span>
                </p>
                <p className="cal-turn-text">{turn.text}</p>
              </li>
            ))}
          </ol>
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} title="Could not load the transcript" />
      ) : loading ? (
        <div className="stack" role="status" aria-label="Loading the transcript">
          <SkeletonBlock height={64} />
          <SkeletonBlock height={64} />
          <SkeletonBlock height={64} />
        </div>
      ) : null}
    </section>
  );
}
