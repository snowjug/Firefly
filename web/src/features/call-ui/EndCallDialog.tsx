import { useEffect, useRef } from 'react';
import { Button, Dialog, MessageBar, Spinner } from '../../design/index.ts';
import type { CallProblem } from '../call/contract.ts';
import { clock, SHORT_CALL_TURNS, timesWord } from './call-model.ts';
import { ProblemNotice } from './ProblemNotice.tsx';
import './end-dialog.css';

export interface EndCallDialogProps {
  /** The person asked to end the call and has not answered yet. */
  open: boolean;
  /** The call is being closed: the same dialog becomes the "Ending the call" screen. */
  ending: boolean;
  /** Ending was confirmed and has not come back yet. */
  busy: boolean;
  elapsedSeconds: number;
  traineeTurns: number;
  /** A spoken call has a microphone and customer audio to stop; a typed one does not. */
  voice: boolean;
  stateLabel: string | null;
  /** The `end-failed` problem, when ending did not work. */
  problem: CallProblem | null;
  /**
   * A way to leave a call that has nothing to report (no message was ever sent). Offered only when
   * ending failed for that reason; the page decides what leaving means.
   */
  onDiscard?: () => void;
  /** Leaving is under way. */
  discarding?: boolean;
  onContinue(): void;
  onConfirm(): void;
}

/**
 * The question before a call ends, and what the screen looks like while it ends. Continue call is
 * where the keyboard starts, so a stray Enter never ends anything. Ending keeps the dialog open
 * with a loading button, and a failure is explained inside it, with Try again. A call with no
 * message in it cannot have a report, and then the way out is to carry on or to leave without one.
 * Once the call is closing, the dialog stays as the "Ending the call" screen, never blank, with its
 * heading focused.
 */
export function EndCallDialog({
  open,
  ending,
  busy,
  elapsedSeconds,
  traineeTurns,
  voice,
  stateLabel,
  problem,
  onDiscard,
  discarding = false,
  onContinue,
  onConfirm,
}: EndCallDialogProps) {
  const heading = useRef<HTMLSpanElement>(null);

  // The dialog was already open and the call started closing: the heading takes the keyboard.
  useEffect(() => {
    if (ending) heading.current?.focus();
  }, [ending]);

  if (ending) {
    return (
      <Dialog
        open
        onClose={onContinue}
        dismissible={false}
        size="sm"
        className="cw-end"
        title={
          <span className="cw-end__heading" tabIndex={-1} ref={heading} data-autofocus>
            Ending the call
          </span>
        }
        description={
          voice
            ? 'We are stopping the microphone, saving the transcript and preparing your report.'
            : 'We are saving the transcript and preparing your report.'
        }
      >
        <div className="cw-end__progress">
          <Spinner size="large" label="Ending the call" />
        </div>
      </Dialog>
    );
  }

  const short = traineeTurns < SHORT_CALL_TURNS;
  const spoken = voice
    ? { term: 'You have spoken', value: timesWord(traineeTurns) }
    : {
        term: 'You have sent',
        value: `${traineeTurns} ${traineeTurns === 1 ? 'message' : 'messages'}`,
      };
  const failure = problem?.code === 'end-failed' ? problem : null;
  // Ending failed because there was nothing to report: trying again cannot help.
  const nothingToReview = failure !== null && failure.retry === null;

  return (
    <Dialog
      open={open}
      onClose={busy ? () => undefined : onContinue}
      dismissible={!busy && !discarding}
      title="End the call?"
      size="sm"
      className="cw-end"
      actions={
        nothingToReview ? (
          <>
            <Button onClick={onContinue} disabledFocusable={discarding} data-autofocus>
              Continue call
            </Button>
            {onDiscard ? (
              <Button
                appearance="danger"
                loading={discarding}
                loadingLabel="Leaving the call"
                onClick={onDiscard}
              >
                Leave without a report
              </Button>
            ) : null}
          </>
        ) : (
          <>
            <Button onClick={onContinue} disabledFocusable={busy} data-autofocus>
              Continue call
            </Button>
            <Button
              appearance="primary"
              loading={busy}
              loadingLabel="Ending the call"
              onClick={onConfirm}
            >
              End and review
            </Button>
          </>
        )
      }
    >
      <div className="cw-end__body">
        <dl className="cw-end__facts">
          <div className="cw-end__fact">
            <dt>Call length</dt>
            <dd>{clock(elapsedSeconds)}</dd>
          </div>
          <div className="cw-end__fact">
            <dt>{spoken.term}</dt>
            <dd>{spoken.value}</dd>
          </div>
          {stateLabel ? (
            <div className="cw-end__fact">
              <dt>Customer&apos;s state</dt>
              <dd>{stateLabel}</dd>
            </div>
          ) : null}
        </dl>
        {short && !failure ? (
          <MessageBar intent="info" live={false}>
            This call is short, so the report will say its scores rest on limited evidence.
          </MessageBar>
        ) : null}
        {failure ? (
          <ProblemNotice problem={failure} variant="panel" onRetry={onConfirm} />
        ) : (
          <p className="cw-end__next">
            <strong>What happens next: </strong>
            {voice
              ? 'the microphone and any customer audio stop, the transcript is saved and your coaching report is built.'
              : 'the transcript is saved and your coaching report is built.'}
          </p>
        )}
      </div>
    </Dialog>
  );
}
