import { useEffect, useMemo, useState } from 'react';
import type { SessionDTO } from '#shared/domain/api.ts';
import {
  Button,
  Icon,
  LinkButton,
  MessageBar,
  Skeleton,
  Spinner,
  VisuallyHidden,
  useAnnouncer,
} from '../../design/index.ts';
import { SCENARIO_LIST } from './brief-href.ts';
import { DeleteCall } from './Actions.tsx';
import { TranscriptReview } from './Transcript.tsx';
import { PHASE_STEPS, phaseAnnouncement, stepStatuses, type StepStatus } from './evaluation.ts';
import { EvidenceProvider, SectionLink } from './evidence.tsx';
import { evidenceTurns } from './evidence-model.ts';
import type { ReportClient, ReportViewState } from './useReportSession.ts';
import './states.css';

type Failed = Extract<ReportViewState, { kind: 'failed' }>;

/**
 * How long a wait is before there is anything to show for it, in milliseconds. A page that comes in
 * faster than this never shows its placeholder at all, which is better than a grey flash. It is not
 * motion, so it does not shrink when motion is reduced: a flash is as unwelcome there.
 */
export const WAIT_MS = 150;

/** False until `ms` have passed. */
function useAfter(ms: number): boolean {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setPast(true), ms);
    return () => window.clearTimeout(timer);
  }, [ms]);
  return past;
}

function Title({ children }: { children: string }) {
  return (
    <h1 id="report-title" className="t-title2" tabIndex={-1}>
      {children}
    </h1>
  );
}

/**
 * While the call is being fetched: the page's name, a name for assistive technology and, only if the
 * wait lasts, the shape of the page (see `WAIT_MS`).
 */
export function LoadingView() {
  const waited = useAfter(WAIT_MS);
  return (
    <div className="rp-state l-page" aria-busy="true">
      <Title>Coaching report</Title>
      <div role="status">
        <VisuallyHidden>Loading your coaching report</VisuallyHidden>
      </div>
      <div
        className="rp-state__skeleton"
        aria-hidden="true"
        data-guarded=""
        data-waiting={waited ? undefined : ''}
      >
        <Skeleton variant="text" width="50%" />
        <Skeleton variant="rect" height={72} />
        <Skeleton variant="text" lines={3} />
        {[1, 2, 3, 4, 5, 6].map((row) => (
          <Skeleton key={row} variant="rect" height={56} />
        ))}
      </div>
    </div>
  );
}

/** The call could not be found or loaded. Says which, and where to go. */
export function UnavailableView({
  notFound,
  message,
  onRetry,
}: {
  notFound: boolean;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rp-state l-page">
      <Title>Report unavailable</Title>
      {notFound ? (
        <MessageBar intent="warning" title="We could not find this call" live={false}>
          It may have been deleted from this device, or the link is not right.
        </MessageBar>
      ) : (
        <MessageBar
          intent="error"
          title="Firefly could not load this report"
          actions={
            <Button appearance="primary" icon="refresh" onClick={onRetry}>
              Try again
            </Button>
          }
        >
          {message} The call itself is not affected.
        </MessageBar>
      )}
      <div className="rp-state__actions">
        <LinkButton to={SCENARIO_LIST} appearance={notFound ? 'primary' : 'secondary'}>
          Choose a scenario
        </LinkButton>
        <LinkButton to="/" appearance="subtle">
          Return home
        </LinkButton>
      </div>
    </div>
  );
}

const STATUS_WORDS: Record<StepStatus, string> = {
  done: 'Done',
  current: 'In progress',
  waiting: 'Waiting',
};

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'done') return <Icon name="check-circle" size={20} className="rp-step__icon" />;
  if (status === 'current') return <Spinner size="small" decorative className="rp-step__icon" />;
  return <Icon name="clock" size={20} className="rp-step__icon" />;
}

/**
 * The call has ended and the server is building the report. The five steps are the ones the
 * server reports, each with an icon and a word. After a long wait it says so, and offers the
 * transcript, which is already saved. The list is not drawn for the first moment (see `WAIT_MS`: a
 * report that is ready at once never shows it); it is in the page, and read, from the first.
 */
export function EvaluatingView({
  session,
  trouble,
  slowAfterMs,
}: {
  session: SessionDTO;
  trouble: boolean;
  slowAfterMs: number;
}) {
  const [slow, setSlow] = useState(false);
  const waited = useAfter(WAIT_MS);
  const announce = useAnnouncer();
  const statuses = stepStatuses(session.evaluationPhase);
  const turns = useMemo(() => evidenceTurns(session), [session]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), slowAfterMs);
    return () => window.clearTimeout(timer);
  }, [slowAfterMs]);

  useEffect(() => {
    const sentence = phaseAnnouncement(session.evaluationPhase);
    if (sentence) announce(sentence);
  }, [session.evaluationPhase, announce]);

  return (
    <div className="rp-state l-page">
      <Title>Building your coaching report</Title>
      <p className="rp-state__lead">Your transcript is saved.</p>
      <ol
        className="rp-steps"
        role="list"
        aria-label="Report progress"
        data-guarded=""
        data-waiting={waited ? undefined : ''}
      >
        {PHASE_STEPS.map((step, index) => {
          const status = statuses[index] ?? 'waiting';
          return (
            <li className="rp-step" data-status={status} key={step.phase}>
              <StepIcon key={status} status={status} />
              <span className="rp-step__title">
                {step.title}
                <VisuallyHidden>, </VisuallyHidden>
              </span>
              <span className="rp-step__status">{STATUS_WORDS[status]}</span>
            </li>
          );
        })}
      </ol>
      {trouble ? (
        <MessageBar intent="warning" live={false}>
          Firefly cannot reach the server to check progress. Your transcript is saved, and this page
          keeps trying.
        </MessageBar>
      ) : null}
      {slow ? (
        <>
          <MessageBar intent="info">
            This is taking longer than usual. Your transcript is saved and you can leave this page.{' '}
            <SectionLink to="transcript">Read your transcript</SectionLink>
          </MessageBar>
          <EvidenceProvider turns={turns}>
            <TranscriptReview
              session={session}
              report={null}
              lead="Your transcript is saved. You can read it before the report is ready."
            />
          </EvidenceProvider>
        </>
      ) : null}
    </div>
  );
}

/**
 * The evaluation failed, or the saved report cannot be read. It says what happened and that the
 * call and its transcript are kept, offers to try again when trying again can help, and shows the
 * transcript, which does not need a report.
 */
export function FailedView({
  state,
  onRetry,
  retrying,
  retryError,
  client,
}: {
  state: Failed;
  onRetry: () => void;
  retrying: boolean;
  retryError: string | null;
  client: ReportClient;
}) {
  const { session, retryable, message, unreadable } = state;
  const turns = useMemo(() => evidenceTurns(session), [session]);
  const what = unreadable
    ? 'The saved coaching report for this call could not be read.'
    : (message ?? 'Something went wrong while the coaching report was being prepared.');
  // The server's own words often say the transcript is safe; saying it twice helps no one.
  const note = [
    /transcript/i.test(what) ? '' : 'Your call and its transcript are saved. Nothing was lost.',
    retryable ? '' : 'Trying again will not fix this.',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className="rp-state rp-state--wide l-page">
      <Title>Coaching report</Title>
      <p className="rp-state__scenario">{session.scenario.title}</p>
      <MessageBar
        intent="error"
        title="The coaching report could not be finished"
        actions={
          retryable ? (
            <Button
              appearance="primary"
              icon="refresh"
              loading={retrying}
              loadingLabel="Retrying the evaluation"
              onClick={onRetry}
            >
              Retry evaluation
            </Button>
          ) : undefined
        }
      >
        <p className="rp-state__para">{what}</p>
        {note ? <p className="rp-state__para">{note}</p> : null}
      </MessageBar>
      {retryError ? (
        <MessageBar intent="error" title="The evaluation did not start again">
          {retryError}
        </MessageBar>
      ) : null}
      <div className="rp-state__actions">
        <LinkButton to={SCENARIO_LIST} icon="phone">
          Try another call
        </LinkButton>
        <DeleteCall sessionId={session.id} client={client} />
      </div>
      <EvidenceProvider turns={turns}>
        <TranscriptReview
          session={session}
          report={null}
          lead="Your transcript is saved. It does not need the report to be read."
        />
      </EvidenceProvider>
    </div>
  );
}
