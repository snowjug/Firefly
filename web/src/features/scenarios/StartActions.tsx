import { Button, LinkButton } from '../../design/primitives/Button.tsx';
import { MessageBar } from '../../design/primitives/MessageBar.tsx';
import type { useSpeechSetup } from './use-speech-setup.ts';
import type { StartInput, useStartCall } from './use-start-call.ts';

export interface StartActionsProps {
  speech: ReturnType<typeof useSpeechSetup>;
  start: ReturnType<typeof useStartCall>;
  /** Starts the call, spoken or typed. */
  onStart(input: StartInput): void;
  /** The workspace with this scenario and these settings, for changing them. */
  editTo: string;
  /** Names the line that says how ready the microphone is; read with the main button. */
  readinessId: string;
}

/**
 * The ways to begin. A spoken call is the main action where the browser can hold one; where it
 * cannot, a typed call is, and it is just as plain. A failure says what happened and what was kept,
 * and the same press, tried again, can never start a second call.
 */
export function StartActions({ speech, start, onStart, editTo, readinessId }: StartActionsProps) {
  const { setup, loading } = speech;
  const canSpeak = setup?.canSpeak === true;
  const waiting = setup === null && loading;
  const { pending, busy, failure } = start;
  return (
    <div className="brf-actions">
      {failure ? (
        <MessageBar
          intent="error"
          title={failure.title}
          actions={
            failure.retryable ? (
              <Button onClick={() => void start.retry()}>Try again</Button>
            ) : (
              <LinkButton to="/scenarios">Choose another scenario</LinkButton>
            )
          }
        >
          {failure.detail}
        </MessageBar>
      ) : null}
      {canSpeak || waiting ? (
        <Button
          className="brf-start"
          appearance="primary"
          size="large"
          icon="microphone"
          fullWidth
          loading={pending === 'voice'}
          loadingLabel="Starting the call"
          disabled={busy && pending !== 'voice'}
          disabledFocusable={waiting}
          aria-describedby={readinessId}
          onClick={() => onStart('voice')}
        >
          Start voice call
        </Button>
      ) : (
        <Button
          className="brf-start"
          appearance="primary"
          size="large"
          icon="keyboard"
          fullWidth
          loading={pending === 'text'}
          loadingLabel="Starting the call"
          disabled={busy && pending !== 'text'}
          aria-describedby={readinessId}
          onClick={() => onStart('text')}
        >
          Start text call
        </Button>
      )}
      <LinkButton
        to={editTo}
        fullWidth
        aria-disabled={busy || undefined}
        tabIndex={busy ? -1 : undefined}
        onClick={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        Edit scenario
      </LinkButton>
      {canSpeak || waiting ? (
        <Button
          appearance="subtle"
          fullWidth
          loading={pending === 'text'}
          loadingLabel="Starting the call"
          disabled={busy && pending !== 'text'}
          disabledFocusable={waiting}
          onClick={() => onStart('text')}
        >
          Start a text-only call
        </Button>
      ) : null}
    </div>
  );
}
