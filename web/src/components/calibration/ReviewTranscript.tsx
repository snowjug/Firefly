import { useId } from 'react';
import type { TranscriptDTO } from '#shared/domain/api.ts';
import { LoadingNotice } from '../trainer/bridge.tsx';
import { StudioError } from '../trainer/StudioFrame.tsx';

/** What the review shows of each turn: who spoke, in which position, and the words. */
export type TranscriptTurn = Pick<TranscriptDTO['turns'][number], 'index' | 'role' | 'text'>;

/**
 * The call as a typeset page, the way the chamber sets a conversation: who spoke and which turn in
 * a mono margin, the customer's words in large serif and the trainee's in a smaller italic that
 * recedes, a hairline running down the page between them. Only turn numbers, roles and text are
 * drawn, and the transcript endpoint supplies nothing else, so a blind review cannot show a score.
 */
export function ReviewTranscript({
  turns,
  persona,
  loading,
  error,
  onRetry,
}: {
  turns: TranscriptTurn[] | null;
  persona: TranscriptDTO['persona'] | null;
  loading: boolean;
  error: unknown;
  onRetry(): void;
}) {
  const titleId = useId();
  return (
    <section className="cal-transcript" aria-labelledby={titleId}>
      <header className="cal-transcript__head">
        <h3 id={titleId} className="cal-transcript__title type-label">
          Transcript
        </h3>
        {persona ? (
          <p className="cal-transcript__who">
            {persona.name}, {persona.role}, {persona.organisation}
          </p>
        ) : null}
      </header>
      {turns ? (
        <div
          className="cal-transcript__scroll"
          role="region"
          aria-label="Call transcript"
          // A scrolling region has to be reachable from the keyboard.
          tabIndex={0}
        >
          <ol className="cal-turns">
            {turns.map((turn) => (
              <li key={turn.index} className="cal-turn" data-role={turn.role}>
                <p className="cal-turn__label">
                  <span className="cal-turn__who">
                    {turn.role === 'customer' ? 'Customer' : 'Trainee'}
                  </span>
                  <span className="cal-turn__index">Turn {turn.index}</span>
                </p>
                <span className="cal-turn__spine" aria-hidden="true" />
                <p className="cal-turn__text">{turn.text}</p>
              </li>
            ))}
          </ol>
        </div>
      ) : error ? (
        <StudioError error={error} onRetry={onRetry} title="Could not load the transcript" />
      ) : loading ? (
        <LoadingNotice label="Loading the transcript" lines={5} />
      ) : null}
    </section>
  );
}
