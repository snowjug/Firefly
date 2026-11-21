import '../../styles/chamber-kit.css';

export type ConnectingPhase = 'opening' | 'slow' | 'failed';

const STATE_LINES: Record<Exclude<ConnectingPhase, 'failed'>, string> = {
  opening: 'Opening the call.',
  slow: 'Taking longer than usual.',
};

/**
 * The moment between asking for a call and being on it. It says one true thing: the customer's
 * name once it is known, and whether the line is opening, taking longer than usual, or has not
 * opened at all. An amber point travels a hairline while it waits; that is activity, never
 * progress, so there is no bar and no percentage, and it never shows for longer than the real wait.
 * Used by the call page while a call loads, and by calibration when a call is begun.
 */
export function ConnectingView({
  name,
  role,
  phase,
  onSkip,
  onRetry,
  error,
}: {
  /** The customer's name. Empty while it is not known yet. */
  name: string;
  /** Their role and organisation, when known. */
  role?: string;
  phase: ConnectingPhase;
  /** When given, a way to stop waiting for the opening moment and go straight to the call. */
  onSkip?: () => void;
  /** When given (and the line has not opened), a way to try again. */
  onRetry?: () => void;
  /** What went wrong, for the `failed` phase. */
  error?: string;
}) {
  const line = phase === 'failed' ? (error ?? 'The call could not be opened.') : STATE_LINES[phase];
  const named = name.trim() !== '';
  return (
    <section className="ch-connect" data-phase={phase} data-named={named || undefined}>
      <p className="ch-eyebrow">Your call</p>
      {named ? (
        <>
          <h1 className="ch-connect__name">{name}</h1>
          {role ? <p className="ch-connect__role">{role}</p> : null}
          <p
            className="ch-connect__state"
            role={phase === 'failed' ? 'alert' : 'status'}
            data-tone={phase === 'failed' ? 'negative' : undefined}
          >
            {line}
          </p>
        </>
      ) : (
        <>
          <h1 className="ch-connect__name ch-connect__name--state">{line}</h1>
          <p className="sr-only" role={phase === 'failed' ? 'alert' : 'status'}>
            {line}
          </p>
        </>
      )}
      <div className="ch-connect__line" aria-hidden="true" data-ambient="connect" />
      {onRetry || onSkip ? (
        <div className="ch-connect__actions">
          {onRetry && phase === 'failed' ? (
            <button type="button" className="ch-button" data-tone="primary" onClick={onRetry}>
              Try again
            </button>
          ) : null}
          {onSkip && phase !== 'failed' ? (
            <button type="button" className="ch-link" onClick={onSkip}>
              Skip
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
