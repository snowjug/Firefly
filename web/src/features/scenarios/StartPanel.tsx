import { useId } from 'react';
import { Button, Divider, LinkButton, MessageBar, Surface } from '../../design/index.ts';
import { SpeechExplainer } from './SpeechExplainer.tsx';
import type { useSpeechSetup } from './use-speech-setup.ts';
import type { useStartCall } from './use-start-call.ts';
import './start-panel.css';

export interface StartPanelProps {
  speech: ReturnType<typeof useSpeechSetup>;
  start: ReturnType<typeof useStartCall>;
  /** The workspace with this scenario and these settings, for changing them. */
  editTo: string;
}

/**
 * "Before you start": what the microphone and speech will do, then the ways to begin. A spoken
 * call is the main action where the browser can hold one; where it cannot, a typed call is, and
 * the explainer above says why.
 */
export function StartPanel({ speech, start, editTo }: StartPanelProps) {
  const titleId = useId();
  const { setup, config, loading, error, reload } = speech;
  const canSpeak = setup?.canSpeak === true;
  const { pending, busy, failure } = start;
  const waiting = setup === null && loading;

  return (
    <Surface as="aside" appearance="elevated" padding="lg" aria-labelledby={titleId}>
      <div className="brf-start">
        <h2 className="brf-start__title" id={titleId}>
          Before you start
        </h2>
        <SpeechExplainer
          setup={setup}
          provider={config?.provider ?? null}
          loading={loading}
          failed={Boolean(error) && setup === null}
          onRetry={reload}
        />
        <Divider />
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
        <div className="brf-actions">
          {canSpeak || waiting ? (
            <Button
              appearance="primary"
              size="large"
              icon="microphone"
              fullWidth
              loading={pending === 'voice'}
              loadingLabel="Starting the call"
              disabled={busy && pending !== 'voice'}
              disabledFocusable={waiting}
              onClick={() => void start.start('voice')}
            >
              Start voice call
            </Button>
          ) : (
            <Button
              appearance="primary"
              size="large"
              icon="keyboard"
              fullWidth
              loading={pending === 'text'}
              loadingLabel="Starting the call"
              disabled={busy && pending !== 'text'}
              onClick={() => void start.start('text')}
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
              onClick={() => void start.start('text')}
            >
              Start a text-only call
            </Button>
          ) : null}
        </div>
      </div>
    </Surface>
  );
}
