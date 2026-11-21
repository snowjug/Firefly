import { memo } from 'react';
import { cx, Icon } from '../../design/index.ts';
import type { CallStatus } from './call-model.ts';
import { Waveform } from './Waveform.tsx';
import './voice-status.css';

export interface VoiceStatusProps {
  status: CallStatus;
  micLevel: number;
  customerLevel: number;
  reducedMotion: boolean;
  /** The dock on narrow screens: one line of status and a thin strip. */
  compact?: boolean;
  /** Where the strip is on a text-only call, which has no voice to draw. */
  hideWave?: boolean;
}

/**
 * The voice-status strip: what is happening now, as a large line of text with its own icon, and
 * the waveform for it. The four stages of a turn (the trainee speaking, their speech being turned
 * into text, the customer thinking, the customer speaking) each have their own words, icon, colour
 * and waveform, so none of them is told apart by colour alone. The text is not a live region: the
 * call's announcer says each change once.
 */
export const VoiceStatus = memo(function VoiceStatus({
  status,
  micLevel,
  customerLevel,
  reducedMotion,
  compact = false,
  hideWave = false,
}: VoiceStatusProps) {
  const level =
    status.wave === 'trainee' ? micLevel : status.wave === 'customer' ? customerLevel : 0;
  return (
    <div
      className={cx(
        'cw-voice',
        `cw-voice--${status.who}`,
        `cw-voice--${status.stage}`,
        compact && 'cw-voice--compact',
      )}
      data-stage={status.stage}
    >
      <div className="cw-voice__line">
        <span className="cw-voice__icon" aria-hidden="true">
          <Icon name={status.icon} size={compact ? 18 : 20} />
        </span>
        <div className="cw-voice__text">
          <p className="cw-voice__label">{status.label}</p>
          {compact ? null : <p className="cw-voice__detail">{status.detail}</p>}
        </div>
      </div>
      {hideWave ? null : (
        <Waveform
          mode={status.wave}
          level={level}
          reducedMotion={reducedMotion}
          size={compact ? 'thin' : 'regular'}
        />
      )}
    </div>
  );
});
