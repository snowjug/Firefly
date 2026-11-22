import { useEffect, useRef } from 'react';
import type { ClosingCheckDTO } from '#shared/domain/api.ts';
import {
  Avatar,
  Button,
  Dialog,
  MessageBar,
  ProgressBar,
  VisuallyHidden,
} from '../../design/index.ts';
import type { CallProblem } from '../call/contract.ts';
import { clock, isEndFailure, SHORT_CALL_TURNS } from './call-model.ts';
import { ClosingCheck } from './ClosingCheck.tsx';
import { Recovery } from './Recovery.tsx';
import './dialogs.css';

export interface EndCallDialogProps {
  /** The person asked to end the call and has not answered yet. */
  open: boolean;
  /** The call is being closed: the same dialog becomes the call-ended moment and its progress. */
  ending: boolean;
  /** What the progress says now: "Ending call", "Preparing your review" or "Call complete". */
  progressLabel: string;
  /** Ending was confirmed and has not come back yet. */
  busy: boolean;
  /** The customer's name, for the initials on the call-ended moment. */
  customerName: string;
  elapsedSeconds: number;
  traineeTurns: number;
  stateLabel: string | null;
  /** The trainee's last message was never saved, so the review will not have it. */
  unsaved: boolean;
  /** The problem an attempt to end the call left (ending failed, or the browser was offline), if any. */
  problem: CallProblem | null;
  /**
   * A way to leave a call that has nothing to report (no message was ever sent). Offered only when
   * ending failed for that reason; the page decides what leaving means.
   */
  onDiscard?: () => void;
  /** Leaving is under way. */
  discarding?: boolean;
  /**
   * Guided practice: the question is "Ready to close?" and a neutral closing check sits with the
   * usual actions. Assessment practice keeps "End the call?" with no check.
   */
  guided?: boolean;
  /** Asks the server for the closing check. Left out, a guided call has the new title and no check. */
  loadClosingCheck?: (signal: AbortSignal) => Promise<ClosingCheckDTO>;
  onContinue(): void;
  onConfirm(): void;
}

/**
 * The question before a call ends, and what the screen looks like while it ends. The accurate length
 * and state are on the dialog, "Continue call" is where the keyboard starts so a stray Enter ends
 * nothing, and ending keeps the dialog open with a loading button. Once the call is closing the same
 * dialog becomes the call-ended moment: the customer's initials with the ring that surrounded them
 * collapsing and fading, "Call ended", how long the call was, and "Preparing your review" with
 * progress that has no percentage because none is known. It is still the dialog named "Ending and
 * preparing your review", with that heading focused (for assistive technology: what is seen is the
 * moment). A failure is explained inside it, with Retry. A call with no message in it has no report:
 * the way out is to carry on or to leave without one. In guided practice the dialog is "Ready to
 * close?" and shows what the call has covered; that look never waits for anything, never disables a
 * button and never blocks ending.
 */
export function EndCallDialog({
  open,
  ending,
  progressLabel,
  busy,
  customerName,
  elapsedSeconds,
  traineeTurns,
  stateLabel,
  unsaved,
  problem,
  onDiscard,
  discarding = false,
  guided = false,
  loadClosingCheck,
  onContinue,
  onConfirm,
}: EndCallDialogProps) {
  const heading = useRef<HTMLSpanElement>(null);
  const keepGoing = useRef<HTMLButtonElement>(null);
  const wasEnding = useRef(ending);

  // The dialog was already open and the call started closing: the heading takes the keyboard.
  useEffect(() => {
    if (ending) heading.current?.focus();
  }, [ending]);

  // Ending did not work and the question is back: the heading that held the keyboard is gone, so it
  // goes to the first button rather than being left on the page behind the dialog.
  useEffect(() => {
    if (wasEnding.current && !ending && open) keepGoing.current?.focus();
    wasEnding.current = ending;
  }, [ending, open]);

  if (ending) {
    return (
      <Dialog
        open
        onClose={onContinue}
        dismissible={false}
        size="sm"
        className="cw-end cw-end--ended"
        title={
          // The dialog's name and what takes the keyboard, said as it always was; the moment itself is
          // what is seen, so the heading is only for assistive technology.
          <span className="cw-end__heading" tabIndex={-1} ref={heading} data-autofocus>
            Ending and preparing your review
          </span>
        }
      >
        <div className="cw-ended">
          <span className="cw-ended__ring">
            <Avatar name={customerName} size="lg" />
          </span>
          <p className="cw-ended__title">Call ended</p>
          <p className="cw-ended__time">
            <VisuallyHidden>Call length </VisuallyHidden>
            {clock(elapsedSeconds)}
          </p>
          <div className="cw-ended__progress">
            <ProgressBar label={progressLabel} showLabel />
          </div>
        </div>
      </Dialog>
    );
  }

  const short = traineeTurns < SHORT_CALL_TURNS;
  const failure = isEndFailure(problem) ? problem : null;
  // Ending failed because there was nothing to report: retrying cannot help.
  const nothingToReview = failure !== null && failure.retry === null;

  return (
    <Dialog
      open={open}
      onClose={busy ? () => undefined : onContinue}
      dismissible={!busy && !discarding}
      title={guided ? 'Ready to close?' : 'End the call?'}
      size="sm"
      className="cw-end"
      actions={
        nothingToReview ? (
          <>
            <Button
              ref={keepGoing}
              onClick={onContinue}
              disabledFocusable={discarding}
              data-autofocus
            >
              Continue call
            </Button>
            {onDiscard ? (
              <Button
                appearance="danger"
                loading={discarding}
                loadingLabel="Leaving the call."
                onClick={onDiscard}
              >
                Leave without a report
              </Button>
            ) : null}
          </>
        ) : (
          <>
            <Button ref={keepGoing} onClick={onContinue} disabledFocusable={busy} data-autofocus>
              Continue call
            </Button>
            <Button
              appearance="primary"
              loading={busy}
              loadingLabel="Ending the call."
              onClick={onConfirm}
            >
              End and review
            </Button>
          </>
        )
      }
    >
      <div className="cw-end__body">
        {guided && !nothingToReview ? <ClosingCheck load={loadClosingCheck} /> : null}
        <dl className="cw-end__facts">
          <div className="cw-end__fact">
            <dt>Call length</dt>
            <dd className="cw-end__clock">{clock(elapsedSeconds)}</dd>
          </div>
          <div className="cw-end__fact">
            <dt>Your messages</dt>
            <dd>{traineeTurns}</dd>
          </div>
          {stateLabel ? (
            <div className="cw-end__fact">
              <dt>Customer state</dt>
              <dd>{stateLabel}</dd>
            </div>
          ) : null}
        </dl>
        {unsaved ? (
          <MessageBar intent="warning" live={false}>
            Your last message was not sent, so it will not be in the review.
          </MessageBar>
        ) : null}
        {short && !failure ? (
          <MessageBar intent="info" live={false}>
            A short call: the review will say it rests on limited evidence.
          </MessageBar>
        ) : null}
        {failure ? (
          <Recovery
            problem={failure}
            live
            busy={false}
            options={
              failure.retry === null ? [] : [{ action: 'retry', label: 'Retry', icon: 'refresh' }]
            }
            onAction={onConfirm}
          />
        ) : null}
      </div>
    </Dialog>
  );
}
