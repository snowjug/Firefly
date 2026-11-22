import { useId, type ReactNode, type RefObject } from 'react';
import { Icon } from '../../design/icons.tsx';
import { Badge } from '../../design/primitives/Badge.tsx';
import { Button } from '../../design/primitives/Button.tsx';
import { Select } from '../../design/primitives/TextInput.tsx';
import type { MicCheck, Readiness } from './mic-readiness.ts';
import type { SpeechSetup } from './speech-setup.ts';
import { previewFailureText, type useVoicePreview } from './use-voice-preview.ts';
import { isVoiceId, type VoiceId, type VoiceOption } from './voice-choice.ts';

const READ_ON_SCREEN =
  "This browser cannot speak the customer's replies, so you read them on screen.";
const SERVICE_CHOOSES = "The speech service chooses the customer's voice.";

/** A compact waveform: five bars that move while a sample plays, and rest otherwise. */
function Wave({ active }: { active: boolean }) {
  return (
    <span className="brf-wave" data-active={active || undefined} aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}

export interface VoiceSetupProps {
  /** The voices on offer: none where the speech service chooses the voice itself. */
  choices: readonly VoiceOption[];
  voice: VoiceId | undefined;
  onVoice(voice: VoiceId): void;
  /** How speech works here, or null while that is not known yet. */
  setup: SpeechSetup | null;
  /** The speech service is the scripted demo one. */
  demo: boolean;
  /** Something true about these voices that the trainee should know (see `useBrowserVoiceNote`), or null. */
  voiceNote: string | null;
  preview: ReturnType<typeof useVoicePreview>;
}

/**
 * The customer's voice: which synthetic voice, and a button that plays one short sample of it, the
 * way the call will speak it. Where nothing can speak the customer, or the speech service picks the
 * voice itself, there is no voice to choose and it says so instead.
 */
export function VoiceSetup({
  choices,
  voice,
  onVoice,
  setup,
  demo,
  voiceNote,
  preview,
}: VoiceSetupProps) {
  const selectId = useId();
  const noteId = useId();
  const statusId = useId();
  const playing = preview.state === 'playing';
  const status = !preview.support.available
    ? preview.support.reason
    : preview.state === 'failed' && preview.error
      ? previewFailureText(preview.error)
      : null;

  if (setup?.playback === 'none' || (setup && choices.length === 0)) {
    return (
      <p className="brf-voice-note">
        <Icon name={setup.playback === 'none' ? 'caption' : 'info'} size={18} />
        {setup.playback === 'none' ? READ_ON_SCREEN : SERVICE_CHOOSES}
      </p>
    );
  }
  return (
    <div className="brf-field">
      <label className="brf-label" htmlFor={selectId}>
        Customer voice
      </label>
      <div className="brf-voice">
        <Select
          id={selectId}
          value={voice}
          aria-describedby={voiceNote ? noteId : undefined}
          onChange={(event) => {
            if (isVoiceId(event.target.value)) onVoice(event.target.value);
          }}
        >
          {choices.map((choice) => (
            <option key={choice.id} value={choice.id}>
              {choice.label}
            </option>
          ))}
        </Select>
        <span className="brf-voice__test">
          <Button
            appearance="outline"
            icon={playing ? 'stop' : 'play'}
            disabledFocusable={!preview.support.available}
            aria-describedby={status ? statusId : undefined}
            onClick={() => {
              if (playing) preview.stop();
              else if (voice) preview.play(voice);
            }}
          >
            {playing ? 'Stop' : 'Test voice'}
          </Button>
          <Wave active={playing} />
        </span>
      </div>
      {status ? (
        <p className="brf-note" id={statusId} role="status">
          {status}
        </p>
      ) : null}
      {voiceNote ? (
        <p className="brf-note" id={noteId}>
          {voiceNote}
        </p>
      ) : null}
      {demo ? (
        <p className="brf-note">
          <Badge tone="warning" icon="info" size="small">
            Demo speech
          </Badge>{' '}
          The customer does not speak: a short soft sound plays and the reply appears as text.
        </p>
      ) : null}
    </div>
  );
}

export interface MicRowProps {
  readiness: Readiness;
  /** The state of the check, for the button's words. */
  status: MicCheck['status'];
  onBegin(): void;
  onStop(): void;
  /** The element whose `--level` the check writes the microphone level to. */
  meterRef: RefObject<HTMLSpanElement | null>;
  /** A spoken call can be held, so there is a microphone to check. */
  canSpeak: boolean;
  statusId: string;
}

/**
 * The microphone: what is known about it in one line, and a button that tries it for a few seconds,
 * showing the level while it listens. The microphone opens only when the button is pressed.
 */
export function MicRow({
  readiness,
  status,
  onBegin,
  onStop,
  meterRef,
  canSpeak,
  statusId,
}: MicRowProps) {
  const busy = status === 'requesting' || status === 'listening';
  const label: ReactNode = busy ? 'Stop' : status === 'idle' ? 'Check microphone' : 'Check again';
  return (
    <div className="brf-ready" data-tone={readiness.tone}>
      <p className="brf-ready__status" id={statusId} role="status">
        {/* A new line of readiness fades in where the old one was: the icon and the words change
            together, and the row keeps its height, so nothing below it moves. */}
        <span className="brf-ready__message" key={readiness.text}>
          <Icon name={readiness.icon} size={18} />
          <span>{readiness.text}</span>
        </span>
      </p>
      {canSpeak ? (
        <div className="brf-ready__check">
          <Button
            size="small"
            appearance="outline"
            icon={busy ? 'stop' : 'microphone'}
            onClick={busy ? onStop : onBegin}
          >
            {label}
          </Button>
          <span
            className="brf-meter"
            ref={meterRef}
            data-active={busy || undefined}
            aria-hidden="true"
          >
            <span className="brf-meter__bar" />
          </span>
        </div>
      ) : null}
    </div>
  );
}
