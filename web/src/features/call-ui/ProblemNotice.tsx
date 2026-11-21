import type { ReactNode } from 'react';
import { Button, cx, MessageBar } from '../../design/index.ts';
import type { CallProblem } from '../call/contract.ts';
import './problems.css';

export interface ProblemNoticeProps {
  problem: CallProblem;
  /** Above the composer (a problem the call can carry on through) or in place of the controls. */
  variant: 'inline' | 'panel';
  /**
   * Announces the notice when it appears. Off by default, because the call's announcer says each
   * problem once; on inside a dialog, where everything outside is silent.
   */
  live?: boolean;
  onRetry?: () => void;
  /** Focuses the composer, for a problem that leaves typing available. */
  onTypeInstead?: () => void;
  /** Clears a problem that has been read. Only offered for problems the call can carry on through. */
  onDismiss?: () => void;
  /** A visible way to hear the customer's reply after the browser blocked it. */
  onPlay?: () => void;
  /** The way out of a call that has reached its limit. */
  onEnd?: () => void;
  /** Anything else that applies in the place the notice is shown, such as starting a typed call. */
  extraActions?: ReactNode;
}

/**
 * A problem, said the way every problem is said: what happened, what was kept, what to do, and the
 * actions that really apply. It never shows raw provider text; the call engine supplies the words.
 * The sentence is announced once by the call's announcer, so the bar itself stays quiet unless it
 * is told to speak (`live`).
 */
export function ProblemNotice({
  problem,
  variant,
  live = false,
  onRetry,
  onTypeInstead,
  onDismiss,
  onPlay,
  onEnd,
  extraActions,
}: ProblemNoticeProps) {
  const blocking = problem.severity === 'blocking';
  const limit = problem.code === 'turn-limit';
  const playBlocked = problem.code === 'playback-blocked';
  const showRetry = problem.retry !== null && onRetry !== undefined && !playBlocked;
  const actions = (
    <>
      {playBlocked && onPlay ? (
        <Button appearance="primary" icon="play" onClick={onPlay}>
          Play customer reply
        </Button>
      ) : null}
      {limit && onEnd ? (
        <Button appearance="danger" icon="phone-end" onClick={onEnd}>
          End call
        </Button>
      ) : null}
      {showRetry ? (
        <Button icon="refresh" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
      {problem.textFallback && onTypeInstead ? (
        <Button icon="keyboard" onClick={onTypeInstead}>
          Continue by typing
        </Button>
      ) : null}
      {extraActions}
    </>
  );
  const hasActions =
    (playBlocked && Boolean(onPlay)) ||
    (limit && Boolean(onEnd)) ||
    showRetry ||
    (problem.textFallback && Boolean(onTypeInstead)) ||
    Boolean(extraActions);
  return (
    <MessageBar
      intent={blocking ? 'error' : 'warning'}
      live={live}
      title={limit ? 'You have reached the limit for this call.' : problem.title}
      actions={hasActions ? actions : undefined}
      onDismiss={!blocking && onDismiss ? onDismiss : undefined}
      className={cx('cw-problem', `cw-problem--${variant}`)}
    >
      <p className="cw-problem__kept">{problem.preserved}</p>
      <p>{limit ? 'End the call to get your report.' : problem.advice}</p>
    </MessageBar>
  );
}
