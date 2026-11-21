import { useEffect, useMemo, useState } from 'react';
import type { SessionDTO } from '#shared/domain/api.ts';
import {
  Breadcrumb,
  Button,
  Icon,
  LinkButton,
  MessageBar,
  Skeleton,
  Spinner,
  TextLink,
  VisuallyHidden,
  useAnnouncer,
} from '../../design/index.ts';
import { DeleteCall } from './Actions.tsx';
import { TranscriptReview } from './Transcript.tsx';
import { PHASE_STEPS, phaseAnnouncement, stepStatuses, type StepStatus } from './evaluation.ts';
import { EvidenceProvider, SectionLink } from './evidence.tsx';
import type { ReportClient, ReportViewState } from './useReportSession.ts';
import './states.css';

type Failed = Extract<ReportViewState, { kind: 'failed' }>;

function Title({ children }: { children: string }) {
  return (
    <h1 id="report-title" className="t-title2" tabIndex={-1}>
      {children}
    </h1>
  );
}

/** While the call is being fetched: the shape of the page, and a name for assistive technology. */
export function LoadingView() {
  return (
    <div className="rp-state l-page l-page--read" aria-busy="true">
      <Title>Coaching report</Title>
      <div role="status">
        <VisuallyHidden>Loading your coaching report</VisuallyHidden>
      </div>
      <div className="rp-state__skeleton" aria-hidden="true">
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="rect" height={96} />
        <Skeleton variant="text" lines={4} />
        <Skeleton variant="rect" height={180} />
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
    <div className="rp-state l-page l-page--read">
      <Title>Report unavailable</Title>
      {notFound ? (
        <MessageBar intent="warning" title="We could not find this call" live={false}>
          It may have been deleted from this device, or the link may not be right. Nothing else was
          changed.
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
        <LinkButton to="/scenarios" appearance={notFound ? 'primary' : 'secondary'}>
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
 * transcript, which is already saved.
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
  const announce = useAnnouncer();
  const statuses = stepStatuses(session.evaluationPhase);
  const turnIndexes = useMemo(() => session.turns.map((turn) => turn.index), [session.turns]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), slowAfterMs);
    return () => window.clearTimeout(timer);
  }, [slowAfterMs]);

  useEffect(() => {
    const sentence = phaseAnnouncement(session.evaluationPhase);
    if (sentence) announce(sentence);
  }, [session.evaluationPhase, announce]);

  return (
    <div className="rp-state l-page l-page--read">
      <Breadcrumb items={[{ label: 'Scenarios', to: '/scenarios' }, { label: 'Report' }]} />
      <Title>Building your coaching report</Title>
      <p className="rp-state__lead t-reading">
        Your transcript is saved. Firefly is reading it and preparing coaching that points to what
        was actually said. Scores are for coaching practice, not employee-performance assessment.
      </p>
      <ol className="rp-steps" role="list" aria-label="Report progress">
        {PHASE_STEPS.map((step, index) => {
          const status = statuses[index] ?? 'waiting';
          return (
            <li className="rp-step" data-status={status} key={step.phase}>
              <StepIcon status={status} />
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
          Firefly cannot reach the server to check progress. Your transcript is saved, and the page
          keeps trying.
        </MessageBar>
      ) : null}
      {slow ? (
        <>
          <MessageBar intent="info">
            This is taking longer than usual. Your transcript is saved and you can leave this page.{' '}
            <SectionLink to="transcript">Read your transcript</SectionLink>
          </MessageBar>
          <EvidenceProvider turnIndexes={turnIndexes}>
            <TranscriptReview
              session={session}
              report={null}
              lead="Your transcript is saved. You can read it now, before the report is ready."
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
  const turnIndexes = useMemo(() => session.turns.map((turn) => turn.index), [session.turns]);
  const what = unreadable
    ? 'The saved coaching report for this call could not be read.'
    : (message ?? 'Something went wrong while the coaching report was being prepared.');
  return (
    <div className="rp-state rp-state--wide l-page">
      <Breadcrumb items={[{ label: 'Scenarios', to: '/scenarios' }, { label: 'Report' }]} />
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
        <p className="rp-state__para">Your call and its transcript are saved. Nothing was lost.</p>
        <p className="rp-state__para">
          {retryable
            ? 'You can try the evaluation again, or read the transcript below and review it with a mentor.'
            : 'Trying again will not fix this. You can still read the transcript below, practise another scenario or delete this call.'}
        </p>
      </MessageBar>
      {retryError ? (
        <MessageBar intent="error" title="The evaluation did not start again">
          {retryError}
        </MessageBar>
      ) : null}
      <div className="rp-state__actions">
        <LinkButton to="/scenarios" icon="list">
          Try another scenario
        </LinkButton>
        <LinkButton to="/" icon="home">
          Return home
        </LinkButton>
        <DeleteCall sessionId={session.id} client={client} />
      </div>
      <p className="rp-state__note t-meta">
        <TextLink to="/responsible-ai">How Firefly uses AI and speech</TextLink>
      </p>
      <EvidenceProvider turnIndexes={turnIndexes}>
        <TranscriptReview
          session={session}
          report={null}
          lead="Your transcript is saved. It does not need the report to be read."
        />
      </EvidenceProvider>
    </div>
  );
}
