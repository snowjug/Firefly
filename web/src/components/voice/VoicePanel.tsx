import type { Ref } from 'react';
import type { VoiceCall } from '../../lib/voice/index.ts';
import { Icon } from '../Icon.tsx';
import { Switch } from '../report/Switch.tsx';
import '../../styles/call-voice.css';

/** What the status line says. An error is shown on its own, so it has no line here. */
export function voiceStatusText(
  voice: Pick<VoiceCall, 'status'>,
  options: { handsFree: boolean; hasDraft: boolean; customer: string },
): string {
  switch (voice.status) {
    case 'connecting':
      return 'Connecting…';
    case 'listening':
      return 'Listening…';
    case 'thinking':
      return options.handsFree || !options.hasDraft
        ? `Waiting for ${options.customer}…`
        : 'Check the words, then press Send.';
    case 'customer-speaking':
      return `${options.customer} is speaking…`;
    case 'muted':
      return 'Microphone muted.';
    case 'idle':
      return options.handsFree
        ? 'Ready. Say something when you like.'
        : options.hasDraft
          ? 'Check the words, then press Send.'
          : 'Press Talk to speak.';
    default:
      return '';
  }
}

const MODE_TEXT: Record<VoiceCall['recognitionMode'], string> = {
  'on-device': 'Your speech is recognised on this device.',
  'browser-service': 'Your browser’s online speech service is recognising your speech.',
  unknown: '',
};

/**
 * The voice controls, inside the message box. Voice is a beta: it never starts by itself, typing
 * always works, and where the browser cannot listen it says so in one sentence.
 */
export function VoicePanel({
  voice,
  calling,
  handsFree,
  onHandsFree,
  onToggleCall,
  customer,
  hasDraft,
  callRef,
}: {
  voice: VoiceCall;
  /** A voice call has been started. */
  calling: boolean;
  handsFree: boolean;
  onHandsFree(on: boolean): void;
  /** Starts the voice call, or hangs up. */
  onToggleCall(): void;
  customer: string;
  /** There are words in the message box, for example ones that were just recognised. */
  hasDraft: boolean;
  callRef?: Ref<HTMLButtonElement>;
}) {
  const { support } = voice;

  if (!support.recognition || !support.secureContext) {
    return (
      <div className="vc vc-unavailable">
        <p className="vc-note">
          <Icon name="mic-off" size={16} />
          <span>
            <strong>Voice (Beta)</strong>
            {': '}
            {support.reason ?? 'Voice input is not available in this browser.'}
            {support.synthesis ? ' You can still use Listen on a reply to hear it.' : ''}
          </span>
        </p>
      </div>
    );
  }

  const listening = voice.status === 'listening';
  const connecting = voice.status === 'connecting';
  const line = calling ? voiceStatusText(voice, { handsFree, hasDraft, customer }) : '';
  const where = calling && !voice.error ? MODE_TEXT[voice.recognitionMode] : '';

  return (
    <div className="vc" data-calling={calling} data-status={voice.status}>
      <div className="vc-row">
        <span className="vc-label">
          <Icon name="mic" size={16} />
          Voice (Beta)
        </span>
        <div className="vc-controls">
          <button
            ref={callRef}
            type="button"
            className="btn btn-sm vc-call"
            aria-pressed={calling}
            onClick={onToggleCall}
            title={calling ? 'End the voice call' : 'Start a voice call'}
          >
            <Icon name="mic" size={16} />
            Voice call
          </button>
          {calling ? (
            <>
              <button
                type="button"
                className="btn btn-sm btn-secondary vc-talk"
                onClick={voice.talk}
                disabled={connecting || voice.muted}
              >
                <Icon name={listening ? 'check' : 'mic'} size={16} />
                {listening ? 'Done talking' : 'Talk'}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-secondary vc-mute"
                aria-pressed={voice.muted}
                onClick={voice.toggleMute}
                disabled={connecting}
              >
                <Icon name={voice.muted ? 'mic-off' : 'mic'} size={16} />
                Mute
              </button>
              {voice.customerSpeaking ? (
                <button
                  type="button"
                  className="btn btn-sm btn-secondary vc-stop"
                  onClick={voice.stopSpeaking}
                  aria-label={`Stop ${customer}'s voice`}
                >
                  <Icon name="volume-off" size={16} />
                  Stop
                </button>
              ) : null}
            </>
          ) : null}
          <Switch checked={handsFree} onChange={onHandsFree} className="vc-switch">
            Hands-free
          </Switch>
        </div>
      </div>
      <p className="vc-status" role="status">
        {line}
      </p>
      {calling && voice.interim ? (
        <p className="vc-interim" aria-hidden="true">
          “{voice.interim}”
        </p>
      ) : null}
      {calling ? (
        <p className="vc-hint" role="status">
          {voice.error ? '' : (voice.hint ?? '')}
        </p>
      ) : null}
      {calling && voice.error ? (
        <div className="vc-error" role="alert">
          <Icon name="alert" size={16} />
          <span className="vc-error-text">{voice.error.message}</span>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => void voice.start()}
          >
            <Icon name="refresh" size={14} />
            Try again
          </button>
        </div>
      ) : null}
      {where ? <p className="vc-where">{where}</p> : null}
    </div>
  );
}
