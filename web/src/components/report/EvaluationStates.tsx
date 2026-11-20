import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { SessionDTO } from '#shared/domain/api.ts';
import { EVALUATION_PHASES, type EvaluationPhase } from '#shared/domain/vocab.ts';
import { api, errorMessage } from '../../lib/api.ts';
import { Icon } from '../Icon.tsx';
import { atmosphereFor, cueLevelFor } from '../call/atmosphere.ts';
import { SignalPresence } from '../signal/SignalPresence.tsx';
import { LoadingNotice, PageFrame, PageHead } from './bridge.tsx';
import { transcriptHref } from './labels.ts';
import '../../styles/report.css';

// The same real steps, in the same words, as the call's own wrap-up (components/call/EndingView):
// the page the learner is on when the call ends and the page they land on if they come back while
// the coaching is still being made are one continuous moment. Each step is shown only because the
// server has reported reaching it.
const STEPS: Record<EvaluationPhase, { title: string; detail: string }> = {
  transcript_locked: {
    title: 'Transcript saved',
    detail: 'Your conversation is saved and can no longer change.',
  },
  discovery_review: {
    title: 'Reviewing what you uncovered',
    detail: 'Checking which hidden facts came up and which questions revealed them.',
  },
  scoring: {
    title: 'Finding evidence and scoring',
    detail: 'Matching what you said to the six coaching areas, turn by turn.',
  },
  building_report: {
    title: 'Building your coaching report',
    detail: 'Writing feedback tied to exact moments in your call.',
  },
  saved: { title: 'Report ready', detail: 'Opening your report.' },
};

/** The real evaluation phases, as a line of points. The current phase is also named in text. */
export function EvaluationProgress({
  session,
  stalled,
}: {
  session: SessionDTO;
  stalled: boolean;
}) {
  const phase = session.evaluationPhase ?? 'transcript_locked';
  const current = EVALUATION_PHASES.indexOf(phase);
  const finished = phase === 'saved';
  const shown = finished ? EVALUATION_PHASES.length - 1 : current;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  // Until the report is ready the customer's mood stays unseen in immersive practice, exactly as it
  // was during the call: the presence is the neutral one.
  const atmosphere = useMemo(
    () => atmosphereFor(session.state, cueLevelFor(session.scenario.config.mode)),
    [session.state, session.scenario.config.mode],
  );

  return (
    <PageFrame title="Preparing your report" className="rp rp--wait">
      <div className="rp-wait" data-mood={atmosphere.mood}>
        <div className="rp-wait__presence" aria-hidden="true">
          <SignalPresence
            atmosphere={atmosphere}
            discovered={0}
            pool={7}
            shifts={0}
            frozen
            size={240}
          />
        </div>
        <section className="rp-wait__main" aria-labelledby="rp-wait-title">
          <p className="type-label">Call ended</p>
          <h1 id="rp-wait-title" className="rp-wait__title" tabIndex={-1} ref={heading}>
            Wrapping up your call
          </h1>
          <p className="rp-wait__lead">
            Your call &ldquo;{session.scenarioTitle}&rdquo; has ended. Firefly is turning your
            conversation into coaching that points to what you actually said. This usually takes a
            few seconds, and you can stay on this page. Scores are for practice, not performance
            assessment.
          </p>

          <ol role="list" className="rp-steps" aria-label="Report progress">
            {EVALUATION_PHASES.map((id, index) => {
              const state =
                index < shown || finished ? 'done' : index === shown ? 'current' : 'todo';
              return (
                <li
                  key={id}
                  className="rp-step"
                  data-state={state}
                  aria-current={state === 'current' ? 'step' : undefined}
                >
                  <span className="rp-step__mark" aria-hidden="true" data-ambient="step" />
                  <span className="rp-step__text">
                    <span className="rp-step__title">{STEPS[id].title}</span>
                    {state === 'current' ? (
                      <span className="rp-step__detail">{STEPS[id].detail}</span>
                    ) : null}
                  </span>
                  <span className="rp-step__state type-label">
                    {state === 'done' ? 'Done' : state === 'current' ? 'In progress' : 'Waiting'}
                  </span>
                </li>
              );
            })}
          </ol>

          <p role="status" className="sr-only">
            {`Step ${Math.min(shown, EVALUATION_PHASES.length - 1) + 1} of ${EVALUATION_PHASES.length}: ${STEPS[phase].title}`}
          </p>
          {stalled ? (
            <p className="rp-note" role="status">
              We are having trouble checking on your report. We will keep trying, and your
              transcript is safe.
            </p>
          ) : null}
          <p>
            <Link to={transcriptHref(session.id)} className="text-link">
              Read your transcript while you wait
            </Link>
          </p>
        </section>
      </div>
    </PageFrame>
  );
}

/** Calm failure state: what happened, a retry when it can help, and the way back to the transcript. */
export function EvaluationFailed({
  session,
  onResult,
}: {
  session: SessionDTO;
  onResult(session: SessionDTO): void;
}) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<unknown>(null);
  const [retried, setRetried] = useState(false);
  const error = session.evaluationError;
  const retryable = error?.retryable ?? true;
  const statusText = busy
    ? 'Trying again\u2026'
    : retried && !problem
      ? 'We tried again, but the report still could not be built.'
      : '';

  const retry = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const next = await api.evaluate(session.id);
      setRetried(true);
      onResult(next);
    } catch (caught) {
      setProblem(caught);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageFrame title="Report not ready" width="narrow" className="rp rp--wait">
      <PageHead
        eyebrow="Practice coaching report"
        title="We couldn’t finish your coaching report"
        lead={error?.message ?? 'Something went wrong while preparing your report.'}
      />
      <div className="rp-safe">
        <Icon name="shield" size={18} />
        <Link to={transcriptHref(session.id)} className="text-link">
          Your transcript is safe &ndash; read it here
        </Link>
      </div>

      {retryable ? (
        <div className="action-row">
          <button type="button" className="action" onClick={retry} disabled={busy} aria-busy={busy}>
            <Icon name="refresh" size={18} />
            Retry evaluation
          </button>
          <Link to="/history" className="text-link" viewTransition>
            Back to history
          </Link>
        </div>
      ) : (
        <>
          <p className="rp-quiet">
            Trying again is unlikely to help right now. Your transcript is saved, and you can
            practise again from the library.
          </p>
          <div className="action-row">
            <Link to="/history" className="action action--quiet" viewTransition>
              Back to history
            </Link>
          </div>
        </>
      )}
      <p role="status" className={statusText ? 'rp-quiet' : 'sr-only'}>
        {statusText}
      </p>
      {problem ? (
        <p className="rp-note rp-note--error" role="alert">
          {errorMessage(problem)}
        </p>
      ) : null}
    </PageFrame>
  );
}

/** The report could not be read back from storage even though the call is complete. */
export function ReportUnavailable({ session }: { session: SessionDTO }) {
  return (
    <PageFrame title="Report unavailable" width="narrow" className="rp rp--wait">
      <PageHead
        eyebrow="Practice coaching report"
        title="This report can’t be opened"
        lead={`The saved report for \u201c${session.scenarioTitle}\u201d could not be read. Your transcript is still available.`}
      />
      <div className="action-row">
        <Link to={transcriptHref(session.id)} className="action" viewTransition>
          <Icon name="notes" size={18} /> Read your transcript
        </Link>
        <Link to="/history" className="text-link" viewTransition>
          Back to history
        </Link>
      </div>
    </PageFrame>
  );
}

/** The report while it loads: the title is there for screen readers, the page is hairlines. */
export function ReportSkeleton() {
  return (
    <PageFrame title="Loading report" className="rp rp--wait">
      <h1 className="sr-only">Call feedback</h1>
      <p className="type-label">Practice coaching report</p>
      <LoadingNotice label="Loading your report" lines={5} />
    </PageFrame>
  );
}
