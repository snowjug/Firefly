import { Button, cx, ToggleButton } from '../../design/index.ts';
import type { CallActions } from '../call/contract.ts';
import type { ControlsView } from './call-model.ts';
import './controls.css';

export interface ControlsProps {
  /** `panel` sits in the stage column on wide screens; `dock` is the bar at the bottom of narrow ones. */
  layout: 'panel' | 'dock';
  view: ControlsView;
  /** The id of the status label, so a control that cannot be used is described by the state. */
  statusId: string;
  /** Soft guidance such as "You are muted.", shown quietly under the controls. */
  hint: string | null;
  actions: Pick<
    CallActions,
    | 'talk'
    | 'stopTalking'
    | 'interrupt'
    | 'toggleMute'
    | 'togglePause'
    | 'replay'
    | 'useText'
    | 'begin'
  >;
  onSettings(): void;
}

/**
 * The call controls. Microphone is the one large control: Talk on the trainee's turn and Done
 * speaking while the microphone is open. In a typed call the typed reply is the main thing, so the
 * way back, Return to voice, is a quiet button. Mute, Stop customer audio and
 * Text sit under it; Pause, Replay and settings are quieter. A control that cannot be used right
 * now is disabled but keeps its place and its focus, and the status label says why. Barge-in is not
 * supported: the microphone never opens while the customer's voice plays, so the trainee stops the
 * audio first, or waits for it to end.
 */
export function Controls({ layout, view, statusId, hint, actions, onSettings }: ControlsProps) {
  const { talk, mute, stopAudio, text, pause, replay } = view;
  const press = () => {
    if (talk.disabled) return;
    if (talk.kind === 'done') actions.stopTalking();
    else if (talk.kind === 'voice') void actions.begin({ voice: true });
    else actions.talk();
  };
  return (
    <div
      className={cx('cw-ctl', `cw-ctl--${layout}`)}
      role="group"
      aria-label="Call controls"
      id="cw-controls"
      tabIndex={-1}
    >
      <Button
        // Returning to voice from a typed call is a choice, not the main thing on the screen: the
        // typed reply is, so it is the quiet kind of button, and it is not the larger one.
        appearance={talk.kind === 'voice' ? 'outline' : 'primary'}
        size={talk.kind === 'voice' ? 'medium' : 'large'}
        icon={talk.icon}
        className="cw-talk"
        data-kind={talk.kind}
        data-cw-talk=""
        disabledFocusable={talk.disabled}
        // Starting the microphone is shown on the control, and said by the status once it is open.
        loading={talk.busy}
        loadingLabel=""
        aria-describedby={statusId}
        onClick={press}
      >
        {talk.label}
      </Button>
      {stopAudio.visible ? (
        <Button
          icon="speaker-off"
          disabledFocusable={stopAudio.disabled}
          onClick={() => actions.interrupt()}
        >
          Stop customer audio
        </Button>
      ) : null}
      {mute.visible ? (
        <ToggleButton
          pressed={mute.pressed}
          onPressedChange={() => actions.toggleMute()}
          icon={mute.pressed ? 'microphone-off' : 'microphone'}
          disabledFocusable={mute.disabled}
        >
          Mute
        </ToggleButton>
      ) : null}
      {text.visible ? (
        <Button icon="keyboard" disabledFocusable={text.disabled} onClick={() => actions.useText()}>
          Text
        </Button>
      ) : null}
      <div className="cw-ctl__more">
        {pause.visible ? (
          <Button
            appearance="subtle"
            size="small"
            icon={pause.resume ? 'play' : 'pause'}
            disabledFocusable={pause.disabled}
            onClick={() => actions.togglePause()}
          >
            {pause.resume ? 'Resume' : 'Pause'}
          </Button>
        ) : null}
        {replay.visible ? (
          <Button
            appearance="subtle"
            size="small"
            icon="refresh"
            disabledFocusable={replay.disabled}
            onClick={() => actions.replay()}
          >
            Replay
          </Button>
        ) : null}
        <Button
          appearance="subtle"
          size="small"
          icon="sliders"
          aria-haspopup="dialog"
          onClick={onSettings}
        >
          Settings
        </Button>
      </div>
      {hint ? <p className="cw-ctl__hint">{hint}</p> : null}
    </div>
  );
}
