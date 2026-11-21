import { useEffect, useState } from 'react';
import { Button, Disclosure, MessageBar, type Announce } from '../../design/index.ts';
import type { CallProblem, CallSnapshot, CallStage } from '../call/contract.ts';
import { adviceIsLong, type RecoveryAction, type RecoveryOption } from './call-model.ts';
import './recovery.css';

// What a failure looks like on screen. One card says what happened and what was kept, and offers
// the ways forward (Retry, Use text, Replay, Continue without audio, End safely). The message that
// failed stays in the transcript, the actions are only here (so there is never a second Retry), a
// Retry shows that it is working, and when it works the card says so for a few seconds.

/** The stages in which a retry is still working. Anything else, with no problem, means it worked. */
const WORKING: readonly CallStage[] = [
  'retrying',
  'processing',
  'transcribing',
  'endpointing',
  'mic-permission',
  'ending',
  'evaluating',
];

/** How long "Message sent." stays after a retry worked. */
export const CONFIRMATION_MS = 4000;

/**
 * What a retry that worked did, in a sentence. A transcription retry either sent the recording that
 * was kept (the words are now a message) or opened the microphone again to be spoken to.
 */
function confirmation(from: CallProblem, stage: CallStage): string {
  if (from.code === 'offline') return 'Back online.';
  switch (from.retry) {
    case 'send':
      return 'Message sent.';
    case 'microphone':
      return 'Microphone ready.';
    case 'transcribe':
      return stage === 'listening' ? 'Listening again.' : 'Your words were sent.';
    case 'speak':
      return 'Playing the reply.';
    default:
      return 'Done.';
  }
}

export interface RecoveryFeedback {
  /** The problem being retried, still shown with its message while the retry works. */
  retrying: CallProblem | null;
  /** What to say once the retry worked, for a few seconds. */
  confirmed: string | null;
  /** Call when the trainee presses Retry (or Replay) on a problem, before asking the engine to retry. */
  begin(problem: CallProblem): void;
  /** Closes the confirmation. */
  dismiss(): void;
  /** The browser is back, and a step that failed has not yet been sent again. */
  reconnecting: boolean;
}

/**
 * Follows a retry from the press to the outcome. The engine clears a problem the moment its retry
 * starts, so the card is kept here, showing progress, until the retry either fails (a new problem
 * takes its place) or works (a confirmation, said aloud once, then gone).
 */
export function useRecoveryFeedback(
  snapshot: Pick<CallSnapshot, 'problem' | 'stage'>,
  announce: Announce,
): RecoveryFeedback {
  // The problem being retried, and the sentence said once the retry worked. It is chosen once, so
  // the confirmation never changes under the trainee as the call moves on.
  const [retry, setRetry] = useState<{ from: CallProblem; said: string | null } | null>(null);
  const { problem, stage } = snapshot;
  const from = retry?.from ?? null;
  // A new problem after a retry means the retry failed: the problem's own card says so.
  if (retry && problem && problem !== retry.from) setRetry(null);

  const working =
    from !== null && retry?.said === null && problem === null && WORKING.includes(stage);
  const done = retry !== null && retry.said === null && problem === null && !working;
  if (retry && done) setRetry({ from: retry.from, said: confirmation(retry.from, stage) });
  const text = retry?.said ?? null;

  useEffect(() => {
    if (!text) return;
    announce(text);
    const timer = window.setTimeout(() => setRetry(null), CONFIRMATION_MS);
    return () => window.clearTimeout(timer);
  }, [from, text, announce]);

  return {
    retrying: working ? from : null,
    confirmed: text,
    begin: (started) => setRetry({ from: started, said: null }),
    dismiss: () => setRetry(null),
    reconnecting: stage === 'offline' || (working && from.code === 'offline'),
  };
}

export interface RecoveryProps {
  problem: CallProblem;
  options: readonly RecoveryOption[];
  /** A retry is under way: Retry shows progress and the other actions wait. */
  busy: boolean;
  /**
   * Announce the card when it appears, as an alert for an error. For a card inside a dialog, where
   * nothing outside is read, and for a problem that stops the trainee being heard (the microphone):
   * the call's polite announcer stays silent for that one, so this is the only time it is said.
   */
  live?: boolean;
  onAction(action: RecoveryAction): void;
}

/**
 * A problem: its title, what was kept, and what can be done. The first action is the one most likely
 * to be wanted. Long advice (how to allow a blocked microphone) sits behind "How to fix" instead of
 * filling the card.
 */
export function Recovery({ problem, options, busy, live = false, onAction }: RecoveryProps) {
  const long = adviceIsLong(problem.advice);
  return (
    <MessageBar
      intent={problem.severity === 'blocking' ? 'error' : 'warning'}
      live={live}
      title={problem.title}
      className="cw-recovery"
      actions={
        options.length > 0 ? (
          <>
            {options.map((option, index) => {
              const working = busy && (option.action === 'retry' || option.action === 'replay');
              return (
                <Button
                  key={option.action}
                  appearance={index === 0 ? 'primary' : 'secondary'}
                  icon={option.icon}
                  data-cw-action={option.action}
                  loading={working}
                  loadingLabel={option.action === 'replay' ? 'Replaying.' : 'Retrying.'}
                  disabledFocusable={busy && !working}
                  onClick={() => onAction(option.action)}
                >
                  {option.label}
                </Button>
              );
            })}
          </>
        ) : undefined
      }
    >
      <p className="cw-recovery__text">
        {problem.preserved}
        {long ? null : ` ${problem.advice}`}
      </p>
      {long ? (
        <Disclosure appearance="inline" summary="How to fix">
          {problem.advice}
        </Disclosure>
      ) : null}
    </MessageBar>
  );
}

/** A short confirmation that a retry worked. It is said aloud once by the hook, so the bar is quiet. */
export function RecoveryConfirmed({ text, onDismiss }: { text: string; onDismiss(): void }) {
  return <MessageBar intent="success" live={false} title={text} onDismiss={onDismiss} />;
}
