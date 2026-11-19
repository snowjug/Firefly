import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { SessionDTO } from '#shared/domain/api.ts';
import { EVALUATION_PHASES, type EvaluationPhase } from '#shared/domain/vocab.ts';
import { api, errorMessage } from '../../lib/api.ts';
import { Icon } from '../Icon.tsx';
import { Page, SkeletonBlock } from '../Page.tsx';
import { transcriptHref } from './labels.ts';
import '../../styles/report.css';

const PHASE_TEXT: Record<EvaluationPhase, { label: string; detail: string }> = {
  transcript_locked: {
    label: 'Transcript secured',
    detail: 'Your conversation is saved and locked, so nothing below can change it.',
  },
  discovery_review: {
    label: 'Analysing discovery',
    detail: 'Checking which of the customer\u2019s hidden facts your questions brought out.',
  },
  scoring: {
    label: 'Finding evidence and scoring',
    detail: 'Looking for quotes in your transcript for each of the six skills.',
  },
  building_report: {
    label: 'Building your coaching report',
    detail: 'Putting the summary, strengths and next steps together.',
  },
  saved: {
    label: 'Report saved',
    detail: 'Your report is ready.',
  },
};

/** The real evaluation phases, as a stepper. The current phase is also named in text. */
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

  return (
    <Page title="Preparing your report" width="narrow" className="rp-root">
      <section className="glass glass-strong rp-wait" aria-labelledby="rp-wait-title">
        <p className="t-label">Practice coaching report</p>
        <h1 id="rp-wait-title" className="t-title" tabIndex={-1} ref={heading}>
          Preparing your coaching report
        </h1>
        <p className="t-lead">
          Your call &ldquo;{session.scenarioTitle}&rdquo; has ended. This usually takes a few
          seconds, and you can stay on this page.
        </p>

        <ol role="list" className="rp-steps" aria-label="Report progress">
          {EVALUATION_PHASES.map((id, index) => {
            const state = index < shown || finished ? 'done' : index === shown ? 'current' : 'todo';
            return (
              <li
                key={id}
                className="rp-step"
                data-state={state}
                aria-current={state === 'current' ? 'step' : undefined}
              >
                <span className="rp-step-mark" aria-hidden="true">
                  {state === 'done' ? (
                    <Icon name="check" size={16} />
                  ) : state === 'current' ? (
                    <span className="spinner" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="rp-step-text">
                  <span className="rp-step-label">{PHASE_TEXT[id].label}</span>
                  <span className="rp-step-detail t-meta">{PHASE_TEXT[id].detail}</span>
                </span>
                <span className="rp-step-state t-meta">
                  {state === 'done' ? 'Done' : state === 'current' ? 'In progress' : 'Waiting'}
                </span>
              </li>
            );
          })}
        </ol>

        <p role="status" className="sr-only">
          {`Step ${Math.min(shown, EVALUATION_PHASES.length - 1) + 1} of ${EVALUATION_PHASES.length}: ${PHASE_TEXT[phase].label}`}
        </p>
        {stalled ? (
          <div className="callout callout-caution" role="status">
            <Icon name="info" size={18} />
            <p>
              We are having trouble checking on your report. We will keep trying, and your
              transcript is safe.
            </p>
          </div>
        ) : null}
        <p className="t-small">
          <Link to={transcriptHref(session.id)}>Read your transcript while you wait</Link>
        </p>
      </section>
    </Page>
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
    <Page title="Report not ready" width="narrow" className="rp-root">
      <section className="glass glass-strong rp-wait rp-failed" aria-labelledby="rp-failed-title">
        <span className="state-icon" aria-hidden="true">
          <Icon name="alert" size={26} />
        </span>
        <p className="t-label">Practice coaching report</p>
        <h1 id="rp-failed-title" className="t-title">
          We couldn&rsquo;t finish your coaching report
        </h1>
        <p className="t-lead">
          {error?.message ?? 'Something went wrong while preparing your report.'}
        </p>
        <p className="rp-safe">
          <Icon name="shield" size={18} />
          <Link to={transcriptHref(session.id)}>Your transcript is safe &ndash; read it here</Link>
        </p>

        {retryable ? (
          <div className="cluster">
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={retry}
              disabled={busy}
            >
              {busy ? (
                <span className="spinner" aria-hidden="true" />
              ) : (
                <Icon name="refresh" size={18} />
              )}
              Retry evaluation
            </button>
            <Link to="/history" className="btn btn-secondary btn-lg" viewTransition>
              Back to history
            </Link>
          </div>
        ) : (
          <>
            <p className="t-small t-muted">
              Trying again is unlikely to help right now. Your transcript is saved, and you can
              practise again from the library.
            </p>
            <Link to="/history" className="btn btn-secondary" viewTransition>
              Back to history
            </Link>
          </>
        )}
        <p role="status" className={statusText ? 't-small' : 'sr-only'}>
          {statusText}
        </p>
        {problem ? (
          <p className="field-error" role="alert">
            {errorMessage(problem)}
          </p>
        ) : null}
      </section>
    </Page>
  );
}

/** The report could not be read back from storage even though the call is complete. */
export function ReportUnavailable({ session }: { session: SessionDTO }) {
  return (
    <Page title="Report unavailable" width="narrow" className="rp-root">
      <section className="glass glass-strong rp-wait rp-failed" aria-labelledby="rp-missing-title">
        <span className="state-icon" aria-hidden="true">
          <Icon name="alert" size={26} />
        </span>
        <p className="t-label">Practice coaching report</p>
        <h1 id="rp-missing-title" className="t-title">
          This report can&rsquo;t be opened
        </h1>
        <p className="t-lead">
          The saved report for &ldquo;{session.scenarioTitle}&rdquo; could not be read. Your
          transcript is still available.
        </p>
        <div className="cluster">
          <Link to={transcriptHref(session.id)} className="btn btn-primary" viewTransition>
            <Icon name="notes" size={18} /> Read your transcript
          </Link>
          <Link to="/history" className="btn btn-secondary" viewTransition>
            Back to history
          </Link>
        </div>
      </section>
    </Page>
  );
}

export function ReportSkeleton() {
  return (
    <Page title="Loading report" className="rp-root">
      <h1 className="sr-only">Call feedback</h1>
      <div className="rp-skeleton" role="status" aria-label="Loading your report">
        <div className="stack" style={{ ['--stack-gap' as string]: 'var(--sp-2)' }}>
          <SkeletonBlock height={32} width="min(18rem, 60%)" />
          <SkeletonBlock height={18} width="min(28rem, 85%)" />
        </div>
        <div className="glass card stack" style={{ ['--stack-gap' as string]: 'var(--sp-3)' }}>
          <SkeletonBlock height={14} width="30%" />
          <SkeletonBlock height={28} width="60%" />
          <SkeletonBlock height={16} width="55%" />
          <SkeletonBlock height={72} />
        </div>
        <div className="rp-scores">
          <div className="glass card rp-overall">
            <SkeletonBlock height={168} width={168} />
          </div>
          <div className="glass card stack" style={{ ['--stack-gap' as string]: 'var(--sp-3)' }}>
            {Array.from({ length: 6 }, (_, i) => (
              <SkeletonBlock key={i} height={20} />
            ))}
          </div>
        </div>
        <span className="sr-only">Loading your report&hellip;</span>
      </div>
    </Page>
  );
}
