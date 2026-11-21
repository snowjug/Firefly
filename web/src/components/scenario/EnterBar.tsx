import { useEffect, useRef } from 'react';
import { errorMessage, isApiError } from '../../lib/api.ts';
import { Icon } from '../Icon.tsx';

interface EnterBarProps {
  /** What else is set, in a few words: "Standard · Guided practice · About 10 minutes". */
  summary: string;
  pending: boolean;
  /** Whatever stopped the last attempt, if anything. */
  failure: unknown;
  onStart(): void;
}

/**
 * The one way into the call. It stays above the dock, so it is always in reach however far the
 * calibration has been scrolled, and it says what went wrong, and what is kept, when starting fails.
 */
export function EnterBar({ summary, pending, failure, onStart }: EnterBarProps) {
  const errorRef = useRef<HTMLDivElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const retryable = failure !== null && (!isApiError(failure) || failure.retryable);

  // When a start fails, the opening screen (or the button that was pressed) has just gone, so bring
  // focus to the explanation and its Retry button instead of leaving it nowhere.
  useEffect(() => {
    if (failure !== null) (retryRef.current ?? errorRef.current)?.focus();
  }, [failure]);

  return (
    <div className="cal-bar" role="group" aria-label="Start the call">
      {failure !== null ? (
        <div ref={errorRef} tabIndex={-1} className="cal-bar__error" role="alert">
          <p>
            <strong>We couldn&apos;t start your call.</strong> {errorMessage(failure)}
          </p>
          <p>Your choices are kept.</p>
          {retryable ? (
            <button
              ref={retryRef}
              type="button"
              className="action action--quiet action--compact"
              onClick={onStart}
            >
              <Icon name="refresh" size={16} /> Retry
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="cal-bar__row">
        <p className="cal-bar__summary type-label">{summary}</p>
        {/* aria-disabled keeps keyboard focus on the button while the call is being created. */}
        <button
          type="button"
          className="action"
          onClick={onStart}
          aria-disabled={pending || undefined}
          aria-busy={pending || undefined}
        >
          {pending ? (
            'Opening the call…'
          ) : (
            <>
              Enter the call <Icon name="arrow-right" size={18} />
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
