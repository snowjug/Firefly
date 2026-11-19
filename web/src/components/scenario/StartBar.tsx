import { useEffect, useRef } from 'react';
import { errorMessage, isApiError } from '../../lib/api.ts';
import { Icon } from '../Icon.tsx';

interface StartBarProps {
  /** The scenario that will start. */
  title: string;
  /** What else is set, in a few words: "Standard · Guided practice · About 10 minutes". */
  summary: string;
  pending: boolean;
  /** Whatever stopped the last attempt, if anything. */
  failure: unknown;
  onStart(): void;
}

/**
 * The one way to start the call. It stays at the bottom of the screen, so it is always in reach
 * however far the setup has been scrolled, and it says what went wrong, and what is kept, when
 * starting fails.
 */
export function StartBar({ title, summary, pending, failure, onStart }: StartBarProps) {
  const errorRef = useRef<HTMLDivElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const retryable = failure !== null && (!isApiError(failure) || failure.retryable);

  // When a start fails, the launch screen (or the button that was pressed) has just gone, so bring
  // focus to the explanation and its Retry button instead of leaving it nowhere.
  useEffect(() => {
    if (failure !== null) (retryRef.current ?? errorRef.current)?.focus();
  }, [failure]);

  return (
    <div className="stp-bar" role="group" aria-label="Start the call">
      {failure !== null ? (
        <div
          ref={errorRef}
          tabIndex={-1}
          className="callout callout-negative stp-error"
          role="alert"
        >
          <Icon name="alert" size={20} />
          <div className="stp-error-body">
            <p>
              <strong>We couldn't start your call.</strong> {errorMessage(failure)}
            </p>
            <p>Your choices are kept.</p>
            {retryable ? (
              <button ref={retryRef} type="button" className="btn btn-secondary" onClick={onStart}>
                <Icon name="refresh" size={16} /> Retry
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="stp-bar-row">
        <p className="stp-bar-summary">
          <strong>{title}</strong>
          <span>{summary}</span>
        </p>
        {/* aria-disabled keeps keyboard focus on the button while the call is being created. */}
        <button
          type="button"
          className="btn btn-primary btn-lg stp-start"
          onClick={onStart}
          aria-disabled={pending || undefined}
        >
          {pending ? (
            <>
              <span className="spinner" aria-hidden="true" /> Starting call…
            </>
          ) : (
            <>
              Start call simulation <Icon name="arrow-right" size={18} />
            </>
          )}
        </button>
      </div>
      <p className="sr-only" role="status">
        {pending ? 'Starting your call…' : ''}
      </p>
    </div>
  );
}
