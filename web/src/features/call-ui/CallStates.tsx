import { Button, Icon, LinkButton, Skeleton, Spinner, Surface } from '../../design/index.ts';
import type { CallProblem } from '../call/contract.ts';
import './call-states.css';

/** What the page says when Firefly's settings or the call itself could not be fetched. */
export const COULD_NOT_OPEN: CallProblem = {
  code: 'session-unavailable',
  title: 'This call could not be opened.',
  preserved: 'Nothing in the call was changed.',
  advice: 'Check your connection and choose Try again, or go back and start the call again.',
  retry: 'load',
  textFallback: false,
  severity: 'blocking',
};

/** A call that is still loading: the shape of the workspace, so nothing jumps when it arrives. */
export function CallSkeleton() {
  return (
    <div className="cw-skel" role="status" aria-busy="true">
      <h1 className="visually-hidden">Loading the call</h1>
      <div className="cw-skel__bar" aria-hidden="true">
        <Skeleton variant="circle" className="cw-skel__mark" />
        <Skeleton className="cw-skel__title" />
        <Skeleton className="cw-skel__end" variant="rect" />
      </div>
      <div className="cw-skel__body" aria-hidden="true">
        <div className="cw-skel__panel cw-skel__stage">
          <div className="cw-skel__person">
            <Skeleton variant="circle" className="cw-skel__avatar" />
            <div className="cw-skel__lines">
              <Skeleton className="cw-skel__w60" />
              <Skeleton className="cw-skel__w80" />
            </div>
          </div>
          <Skeleton variant="rect" className="cw-skel__card" />
          <Skeleton variant="rect" className="cw-skel__card" />
        </div>
        <div className="cw-skel__panel cw-skel__transcript">
          <Skeleton className="cw-skel__w30" />
          <Skeleton className="cw-skel__w80" />
          <Skeleton className="cw-skel__w60" />
          <Skeleton className="cw-skel__w80" />
          <Skeleton className="cw-skel__w40" />
        </div>
        <div className="cw-skel__panel cw-skel__context">
          <Skeleton className="cw-skel__w60" />
          <Skeleton className="cw-skel__w80" />
          <Skeleton className="cw-skel__w80" />
          <Skeleton className="cw-skel__w40" />
        </div>
      </div>
    </div>
  );
}

export interface CallLoadErrorProps {
  problem: CallProblem;
  onRetry(): void;
}

/** The call could not be loaded at all: what happened, that nothing was changed, and the ways on. */
export function CallLoadError({ problem, onRetry }: CallLoadErrorProps) {
  return (
    <div className="cw-page">
      <Surface appearance="outlined" padding="xl" className="cw-page__card">
        <span className="cw-page__icon" aria-hidden="true">
          <Icon name="warning" size={28} />
        </span>
        <div className="cw-page__text l-stack l-gap-2" role="alert">
          <h1 className="t-title2">{problem.title}</h1>
          <p className="t-reading t-muted">{problem.preserved}</p>
          <p className="t-reading t-muted">{problem.advice}</p>
        </div>
        <div className="l-cluster l-gap-3">
          {problem.retry ? (
            <Button appearance="primary" icon="refresh" onClick={onRetry}>
              Try again
            </Button>
          ) : null}
          <LinkButton to="/scenarios" appearance="outline">
            Back to scenarios
          </LinkButton>
        </div>
      </Surface>
    </div>
  );
}

/** There is no such call: it may have been removed, or the address is wrong. */
export function CallUnavailable() {
  return (
    <div className="cw-page">
      <Surface appearance="outlined" padding="xl" className="cw-page__card">
        <span className="cw-page__icon" aria-hidden="true">
          <Icon name="info" size={28} />
        </span>
        <div className="cw-page__text l-stack l-gap-2">
          <h1 className="t-title2">Call unavailable</h1>
          <p className="t-reading t-muted">
            This call could not be found. It may have been removed, or the address may be wrong.
          </p>
          <p className="t-reading t-muted">
            Calls and reports that Firefly has already saved are not affected.
          </p>
        </div>
        <div className="l-cluster l-gap-3">
          <LinkButton to="/scenarios" appearance="primary">
            Back to scenarios
          </LinkButton>
        </div>
      </Surface>
    </div>
  );
}

/** The call is over: shown for the moment before the report opens, so the page is never empty. */
export function OpeningReport() {
  return (
    <div className="cw-page">
      <Surface appearance="outlined" padding="xl" className="cw-page__card">
        <div className="cw-page__text l-stack l-gap-3" role="status">
          <h1 className="t-title2">Opening your report</h1>
          <p className="t-reading t-muted">This call has ended. Your report is on its way.</p>
          <Spinner size="medium" label="Opening your report" />
        </div>
      </Surface>
    </div>
  );
}
