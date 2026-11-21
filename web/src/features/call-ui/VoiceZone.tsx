import type { ReactNode } from 'react';
import { cx, Icon } from '../../design/index.ts';
import type { CallProblem } from '../call/contract.ts';
import type { CallStatus } from './call-model.ts';
import { ProblemNotice } from './ProblemNotice.tsx';
import { findControlsZone, useRescueFocus } from './use-rescue-focus.ts';
import { VoiceControls, type VoiceControlsProps } from './VoiceControls.tsx';
import { VoiceStatus } from './VoiceStatus.tsx';
import './voice-zone.css';

export interface VoiceZoneProps {
  /** The stage panel on wide screens, or the dock on narrow ones. */
  layout: 'panel' | 'dock';
  status: CallStatus;
  micLevel: number;
  customerLevel: number;
  reducedMotion: boolean;
  /** A spoken call has voice controls; a typed one has only a note and the status line. */
  voice: boolean;
  controls: Omit<VoiceControlsProps, 'layout'>;
  /** A problem that stops the call replaces the controls, with the way out. */
  blocking: CallProblem | null;
  problemActions: {
    onRetry(): void;
    onTypeInstead(): void;
    onEnd(): void;
  };
}

/**
 * The part of the call that talks and listens: the status line with its waveform, and under it the
 * controls (or, when a problem stops the call, the problem and the way out of it). It exists once:
 * in the stage panel on wide screens, in the dock at the bottom on narrow ones.
 */
export function VoiceZone({
  layout,
  status,
  micLevel,
  customerLevel,
  reducedMotion,
  voice,
  controls,
  blocking,
  problemActions,
}: VoiceZoneProps) {
  const dock = layout === 'dock';
  // A problem takes the controls' place, or gives it back: if the keyboard was on a control that is
  // gone, it goes to this area rather than to the top of the page.
  useRescueFocus(blocking?.code ?? null, findControlsZone);
  return (
    <div
      className={cx('cw-zone', `cw-zone--${layout}`)}
      id="cw-controls-zone"
      tabIndex={-1}
      role="group"
      aria-label="Call status and controls"
    >
      <VoiceStatus
        status={status}
        micLevel={micLevel}
        customerLevel={customerLevel}
        reducedMotion={reducedMotion}
        compact={dock}
        hideWave={!voice}
      />
      {blocking ? (
        <ProblemNotice
          problem={blocking}
          variant="panel"
          onRetry={problemActions.onRetry}
          onTypeInstead={problemActions.onTypeInstead}
          onEnd={problemActions.onEnd}
        />
      ) : voice ? (
        <VoiceControls layout={layout} {...controls} />
      ) : (
        <TextNote hint={controls.hint} dock={dock} />
      )}
    </div>
  );
}

function TextNote({ hint, dock }: { hint: string | null; dock: boolean }): ReactNode {
  if (dock) return hint ? <p className="cw-zone__hint">{hint}</p> : null;
  return (
    <div className="cw-zone__note">
      <p className="cw-zone__note-text">
        <Icon name="keyboard" size={18} />
        <span>
          This call is text-only. The microphone is off, nothing is recorded, and the customer is
          shown as captions.
        </span>
      </p>
      {hint ? <p className="cw-zone__hint">{hint}</p> : null}
    </div>
  );
}
