import { useId } from 'react';
import { Button, cx, Icon, ToggleButton } from '../../design/index.ts';
import type { CallActions, CallPhase } from '../call/contract.ts';
import { describeTalkControl } from './call-model.ts';
import './voice-controls.css';

export interface VoiceControlsProps {
  /** `panel` sits in the stage panel on wide screens; `dock` is the bar at the bottom of narrow ones. */
  layout: 'panel' | 'dock';
  phase: CallPhase;
  muted: boolean;
  paused: boolean;
  handsFree: boolean;
  /** There is a customer reply to hear again, and this browser can speak it. */
  canReplay: boolean;
  limitReached: boolean;
  /** Soft guidance such as "Nothing was heard.", shown quietly beside the controls. */
  hint: string | null;
  actions: Pick<
    CallActions,
    'talk' | 'stopTalking' | 'interrupt' | 'toggleMute' | 'togglePause' | 'replay'
  >;
  onTypeInstead(): void;
  onOpenSettings(): void;
}

/**
 * The voice controls of a spoken call. The large round control is the one thing that changes with
 * the stage: Talk while it is the trainee's turn, Stop talking while the microphone is open
 * (it is the stop control, so it reports itself pressed), Interrupt while the customer's voice
 * plays, and disabled with its reason in words while the call is busy. The rest stay put.
 */
export function VoiceControls({
  layout,
  phase,
  muted,
  paused,
  handsFree,
  canReplay,
  limitReached,
  hint,
  actions,
  onTypeInstead,
  onOpenSettings,
}: VoiceControlsProps) {
  const reasonId = useId();
  const talk = describeTalkControl({ phase, muted, paused, limitReached });
  const press = () => {
    if (talk.disabled) return;
    if (talk.kind === 'stop') actions.stopTalking();
    else if (talk.kind === 'interrupt') actions.interrupt();
    else actions.talk();
  };
  const ending = phase === 'ending' || phase === 'completed';
  const replayWaits = !canReplay || phase === 'transcribing' || phase === 'processing' || ending;

  return (
    <div
      className={cx('cw-ctl', `cw-ctl--${layout}`)}
      role="group"
      aria-label="Voice controls"
      id="cw-controls"
      tabIndex={-1}
    >
      <div className="cw-ctl__main">
        <button
          type="button"
          className={cx('cw-talk', `cw-talk--${talk.kind}`, talk.disabled && 'cw-talk--waiting')}
          aria-pressed={talk.pressed}
          aria-disabled={talk.disabled || undefined}
          aria-describedby={talk.reason ? reasonId : undefined}
          onClick={press}
          data-control="talk"
        >
          <span className="cw-talk__disc" aria-hidden="true">
            <Icon name={talk.icon} size={28} />
          </span>
          <span className="cw-talk__label">{talk.label}</span>
        </button>
        <div className="cw-ctl__aside">
          <p className="cw-ctl__mode">
            <Icon name={handsFree ? 'waveform' : 'microphone'} size={16} />
            <span>{handsFree ? 'Hands-free on' : 'Push to talk'}</span>
          </p>
          {talk.reason ? (
            <p className="cw-ctl__reason" id={reasonId}>
              {talk.reason}
            </p>
          ) : null}
        </div>
      </div>

      <div className="cw-ctl__row">
        <ToggleButton
          pressed={muted}
          onPressedChange={() => actions.toggleMute()}
          icon={muted ? 'microphone-off' : 'microphone'}
          disabledFocusable={ending}
          className="cw-ctl__button"
        >
          Mute
        </ToggleButton>
        <Button
          icon={paused ? 'play' : 'pause'}
          disabledFocusable={ending}
          onClick={() => actions.togglePause()}
          className="cw-ctl__button"
        >
          {paused ? 'Resume' : 'Pause'}
        </Button>
        <Button
          icon="refresh"
          disabledFocusable={replayWaits}
          onClick={() => actions.replay()}
          className="cw-ctl__button"
        >
          Replay
        </Button>
        <Button
          icon="keyboard"
          onClick={onTypeInstead}
          className="cw-ctl__button cw-ctl__button--wide"
        >
          Type instead
        </Button>
        <Button
          icon="sliders"
          onClick={onOpenSettings}
          aria-haspopup="dialog"
          className="cw-ctl__button cw-ctl__button--wide"
        >
          Voice settings
        </Button>
      </div>

      {hint ? <p className="cw-ctl__hint">{hint}</p> : null}
    </div>
  );
}
