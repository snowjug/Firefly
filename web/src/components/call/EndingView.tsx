import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { SessionDTO } from '#shared/domain/api.ts';
import { EVALUATION_PHASES, type EvaluationPhase } from '#shared/domain/vocab.ts';
import { api, errorMessage } from '../../lib/api.ts';
import { plural } from '../../lib/format.ts';
import { useDocumentTitle, useInterval } from '../../lib/hooks.ts';
import { Icon } from '../Icon.tsx';
import { atmosphereFor, cueLevelFor } from './atmosphere.ts';
import { PRESENCE_POOL, SignalPresence } from './signal-bridge.tsx';

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

const STATE_WORDS = { done: ', done', current: ', in progress', todo: ', waiting' } as const;

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

/**
 * The call has ended and the coaching is being made. The presence is held still where the call
 * left it and the page is quiet; the list says which real step the server has reached. When the
 * report exists it opens; when it could not be made, this says why and what can be done.
 */
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
      () => void navigate(`/sessions/${id}/report`, { replace: true, viewTransition: true }),
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

  // The presence is held where the call left it. In immersive practice that is the neutral one: the
  // customer's mood is only ever shown in the report.
  const atmosphere = useMemo(
    () => atmosphereFor(session.state, cueLevelFor(session.scenario.config.mode)),
    [session.state, session.scenario.config.mode],
  );
  const presence = (
    <div className="ch-wrap__presence" aria-hidden="true">
      <SignalPresence
        atmosphere={atmosphere}
        discovered={session.scenario.config.mode === 'guided' ? session.state.discoveredCount : 0}
        pool={Math.max(PRESENCE_POOL, session.state.discoveredCount + 2)}
        shifts={0}
        frozen
        size={240}
      />
    </div>
  );

  const phaseIndex = session.evaluationPhase
    ? EVALUATION_PHASES.indexOf(session.evaluationPhase)
    : 0;
  const note = shortCallNote(session);

  if (failed) {
    const retryable = session.evaluationError?.retryable ?? true;
    return (
      <div className="ch-wrap" data-state="failed" data-mood={atmosphere.mood}>
        {presence}
        <section className="ch-wrap__main world-veil" aria-labelledby="wrap-title">
          <p className="ch-eyebrow">Call ended</p>
          <h1 id="wrap-title" className="ch-wrap__title" ref={heading} tabIndex={-1}>
            We could not finish your report
          </h1>
          <p className="ch-wrap__lead">
            {session.evaluationError?.message ??
              'Something went wrong while preparing your feedback.'}
          </p>
          <p className="ch-aside" data-tone="positive">
            <Icon name="check" size={16} />
            <span>Your transcript is saved. Nothing from the call has been lost.</span>
          </p>
          {retryError ? (
            <p className="ch-aside" data-tone="negative" role="alert">
              <Icon name="alert" size={16} />
              <span>{retryError}</span>
            </p>
          ) : null}
          <div className="ch-wrap__actions">
            {retryable ? (
              <button
                type="button"
                className="ch-button"
                data-tone="primary"
                onClick={retry}
                disabled={retrying}
              >
                {retrying ? 'Trying again…' : 'Try again'}
                <Icon name="refresh" size={16} />
              </button>
            ) : null}
            <Link className="ch-link" to={`/sessions/${id}/transcript`}>
              View transcript
            </Link>
            <Link className="ch-link" to="/home">
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
    <div
      className="ch-wrap"
      data-state={complete ? 'complete' : 'working'}
      data-mood={atmosphere.mood}
    >
      {presence}
      <section className="ch-wrap__main world-veil" aria-labelledby="wrap-title">
        <p className="ch-eyebrow">Call ended</p>
        <h1 id="wrap-title" className="ch-wrap__title" ref={heading} tabIndex={-1}>
          {complete ? 'Your report is ready' : 'Wrapping up your call'}
        </h1>
        <p className="ch-wrap__lead">
          {complete
            ? 'Opening your coaching report.'
            : 'Firefly is turning your conversation into coaching that points to what you actually said. Scores are for practice, not performance assessment.'}
        </p>
        {note && !complete ? <p className="ch-wrap__note">{note}</p> : null}
        <ol className="ch-steps" role="list" aria-label="Progress">
          {STEPS.map((step, index) => {
            const state = stepState(index, activeIndex, complete);
            return (
              <li key={step.phase} className="ch-step" data-state={state}>
                <span className="ch-step__mark" aria-hidden="true" data-ambient="step" />
                <span className="ch-step__text">
                  <span className="ch-step__title">{step.title}</span>
                  {state === 'current' ? (
                    <span className="ch-step__detail">{step.detail}</span>
                  ) : null}
                  <span className="sr-only">{STATE_WORDS[state]}</span>
                </span>
              </li>
            );
          })}
        </ol>
        <p className="sr-only" role="status" aria-live="polite">
          {complete ? 'Your report is ready.' : `${currentStep?.title ?? 'Working'}.`}
        </p>
        {waited >= SLOW_AFTER_SECONDS && !complete ? (
          <p className="ch-aside">
            <Icon name="info" size={16} />
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
