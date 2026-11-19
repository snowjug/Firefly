import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { SessionDTO } from '#shared/domain/api.ts';
import { EVALUATION_PHASES, type EvaluationPhase } from '#shared/domain/vocab.ts';
import { api, errorMessage } from '../../lib/api.ts';
import { plural } from '../../lib/format.ts';
import { useDocumentTitle, useInterval } from '../../lib/hooks.ts';
import { Icon } from '../Icon.tsx';

// What the end of a call really does, in order. Each step is shown only because the server has
// reported reaching it, so the progress is never an animation pretending to be work.
const STEPS: { phase: EvaluationPhase; title: string; detail: string }[] = [
  {
    phase: 'transcript_locked',
    title: 'Transcript saved',
    detail: 'Your conversation is saved and can no longer change.',
  },
  {
    phase: 'discovery_review',
    title: 'Reviewing what you uncovered',
    detail: 'Checking which hidden facts came up and which questions revealed them.',
  },
  {
    phase: 'scoring',
    title: 'Finding evidence and scoring',
    detail: 'Matching what you said to the six coaching areas, turn by turn.',
  },
  {
    phase: 'building_report',
    title: 'Building your coaching report',
    detail: 'Writing feedback tied to exact moments in your call.',
  },
  { phase: 'saved', title: 'Report ready', detail: 'Opening your report.' },
];

const SLOW_AFTER_SECONDS = 25;
// Fewer replies than this give the report limited evidence to work from.
const FIRM_COACHING_TURNS = 5;

function stepState(index: number, current: number, complete: boolean): 'done' | 'current' | 'todo' {
  if (complete || index < current) return 'done';
  return index === current ? 'current' : 'todo';
}

/** One honest sentence about a short call, before the report says it in detail. */
function shortCallNote(session: SessionDTO): string | null {
  if (session.completion === 'ended-early') {
    return 'You ended this call early, so the report will be a first look at what was said rather than a full review.';
  }
  if (session.traineeTurns < FIRM_COACHING_TURNS) {
    // The report decides whether a short call counts as ended early (it depends on whether there was
    // a wrap-up), so this says what may happen rather than what will.
    return `This was a short call (${plural(session.traineeTurns, 'reply', 'replies')}), so the report will rest on limited evidence. If it stopped before a wrap-up, it will be marked as ended early.`;
  }
  return null;
}

export function EndingView({ session: initial }: { session: SessionDTO }) {
  const navigate = useNavigate();
  const [session, setSession] = useState(initial);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [waited, setWaited] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const id = initial.id;
  const failed = session.status === 'evaluation_failed';
  const complete = session.status === 'completed';
  useDocumentTitle(failed ? 'Report not finished' : 'Wrapping up your call');

  useEffect(() => {
    heading.current?.focus();
  }, [failed]);

  useInterval(() => setWaited((seconds) => seconds + 1), 1000, session.status === 'completing');

  // Follow the server until the evaluation finishes, backing off while the tab is hidden.
  useEffect(() => {
    if (session.status !== 'completing') return;
    let cancelled = false;
    let timer = 0;
    const controller = new AbortController();
    const poll = async () => {
      try {
        const next = await api.getSession(id, controller.signal);
        if (cancelled) return;
        setSession(next);
        if (next.status !== 'completing') return;
      } catch {
        if (cancelled) return;
      }
      timer = window.setTimeout(poll, document.hidden ? 3000 : 800);
    };
    timer = window.setTimeout(poll, 500);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [id, session.status]);

  useEffect(() => {
    if (!complete) return;
    const timer = window.setTimeout(
      () => navigate(`/sessions/${id}/report`, { replace: true }),
      700,
    );
    return () => window.clearTimeout(timer);
  }, [complete, id, navigate]);

  const retry = async () => {
    setRetrying(true);
    setRetryError(null);
    try {
      setSession(await api.evaluate(id));
      setWaited(0);
    } catch (error) {
      setRetryError(errorMessage(error));
    } finally {
      setRetrying(false);
    }
  };

  const phaseIndex = session.evaluationPhase
    ? EVALUATION_PHASES.indexOf(session.evaluationPhase)
    : 0;
  const note = shortCallNote(session);

  if (failed) {
    const retryable = session.evaluationError?.retryable ?? true;
    return (
      <div className="wrap">
        <section className="wrap-card glass" aria-labelledby="wrap-title" data-state="failed">
          <span className="tone-icon wrap-icon" data-tone="red">
            <Icon name="alert" size={26} />
          </span>
          <h1 id="wrap-title" className="t-title" ref={heading} tabIndex={-1}>
            We could not finish your report
          </h1>
          <p className="t-lead">
            {session.evaluationError?.message ??
              'Something went wrong while preparing your feedback.'}
          </p>
          <p className="callout callout-positive">
            <Icon name="check" />
            <span>Your transcript is saved. Nothing from the call has been lost.</span>
          </p>
          {retryError ? (
            <p className="callout callout-negative" role="alert">
              <Icon name="alert" />
              <span>{retryError}</span>
            </p>
          ) : null}
          <div className="wrap-actions">
            {retryable ? (
              <button type="button" className="btn btn-primary" onClick={retry} disabled={retrying}>
                {retrying ? (
                  <span className="spinner" aria-hidden="true" />
                ) : (
                  <Icon name="refresh" size={18} />
                )}
                {retrying ? 'Trying again…' : 'Try again'}
              </button>
            ) : null}
            <Link className="btn btn-secondary" to={`/sessions/${id}/transcript`}>
              View transcript
            </Link>
            <Link className="btn btn-ghost" to="/home">
              Back to home
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const activeIndex = complete
    ? STEPS.length - 1
    : Math.min(Math.max(phaseIndex, 0), STEPS.length - 1);
  const currentStep = STEPS[activeIndex];
  return (
    <div className="wrap">
      <section className="wrap-card glass" aria-labelledby="wrap-title" data-state="working">
        <span className="tone-icon wrap-icon" data-tone={complete ? 'green' : 'blue'}>
          {complete ? (
            <Icon name="check" size={26} />
          ) : (
            <Icon name="phone" size={26} className="call-end-icon" />
          )}
        </span>
        <p className="t-label">Call ended</p>
        <h1 id="wrap-title" className="t-title" ref={heading} tabIndex={-1}>
          {complete ? 'Your report is ready' : 'Wrapping up your call'}
        </h1>
        <p className="t-lead">
          {complete
            ? 'Opening your coaching report.'
            : 'Firefly is turning your conversation into coaching that points to what you actually said. Scores are for practice, not performance assessment.'}
        </p>
        {note && !complete ? <p className="wrap-note t-small">{note}</p> : null}
        <ol className="wrap-steps" role="list" aria-label="Progress">
          {STEPS.map((step, index) => {
            const state = stepState(index, activeIndex, complete);
            return (
              <li key={step.phase} className="wrap-step" data-state={state}>
                <span className="wrap-mark" aria-hidden="true">
                  {state === 'done' ? (
                    <Icon name="check" size={16} />
                  ) : state === 'current' ? (
                    <span className="spinner" />
                  ) : null}
                </span>
                <span>
                  <span className="wrap-step-title">{step.title}</span>
                  {state === 'current' ? (
                    <span className="t-meta wrap-step-detail">{step.detail}</span>
                  ) : null}
                  <span className="sr-only">
                    {state === 'done'
                      ? ', done'
                      : state === 'current'
                        ? ', in progress'
                        : ', waiting'}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
        <p className="sr-only" role="status" aria-live="polite">
          {complete ? 'Your report is ready.' : `${currentStep?.title ?? 'Working'}.`}
        </p>
        {waited >= SLOW_AFTER_SECONDS && !complete ? (
          <p className="callout callout-caution">
            <Icon name="info" />
            <span>
              This is taking longer than usual. Your transcript is saved, so you can wait here or
              come back later from <Link to="/history">History</Link>.
            </span>
          </p>
        ) : null}
      </section>
    </div>
  );
}
