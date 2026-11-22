import { memo, useState, type AnimationEvent, type CSSProperties } from 'react';
import { Avatar, cx, type AvatarSize } from '../../design/index.ts';
import type { PresenceMode } from './call-model.ts';
import './presence.css';

/** The level is drawn in this many steps: a finer value would only restyle the ring for nothing. */
const LEVEL_STEPS = 20;

export interface PresenceProps {
  name: string;
  /** What the ring is doing (see `describePresence`). */
  mode: PresenceMode;
  /**
   * 0 to 1: the trainee's voice while they are heard, the customer's while it plays. A level of 0, or
   * none at all, is fine: the ring then rests at its own size and never depends on a measurement.
   */
  level?: number;
  /**
   * The level was measured (the microphone's always is). Where it is only shaped from the words, the
   * ring keeps to the avatar's own fixed pulse and is never drawn as if it were a measurement.
   */
  measured?: boolean;
  /** The customer's voice is playing: the avatar's own ring. */
  speaking?: boolean;
  size?: AvatarSize;
  reducedMotion: boolean;
  className?: string;
}

/**
 * The customer as a presence: the avatar, and a ring around it that says what the call is doing,
 * without a word (the status line is the words, so all of this is hidden from assistive technology).
 * While the call connects the ring turns slowly; when it is live the ring settles, one soft ripple
 * goes out and the avatar eases to full size, once. After that it breathes while the microphone
 * waits, follows the trainee's voice while they are heard, follows the customer's while it plays,
 * turns quietly while something is worked out, and is still and dimmed while the call is held.
 * Under reduced motion every one of these is a still form and the level is not followed.
 */
export const Presence = memo(function Presence({
  name,
  mode,
  level = 0,
  measured = true,
  speaking = false,
  size = 'xl',
  reducedMotion,
  className,
}: PresenceProps) {
  // The moment of arriving is played once, when the ring that turned while connecting stops. A call
  // that was already live when the screen opened never connects, and reduced motion never ripples.
  const [arrival, setArrival] = useState<'waiting' | 'arriving' | 'done'>(
    mode === 'connecting' ? 'waiting' : 'done',
  );
  if (arrival === 'waiting' && mode !== 'connecting') {
    setArrival(reducedMotion ? 'done' : 'arriving');
  }

  const follows = !reducedMotion && (mode === 'hearing' || (mode === 'speaking' && measured));
  const shown = follows
    ? Math.round(Math.min(1, Math.max(0, level)) * LEVEL_STEPS) / LEVEL_STEPS
    : 0;
  const settle = (event: AnimationEvent) => {
    if (event.animationName === 'cw-ripple') setArrival('done');
  };

  return (
    <span
      className={cx('cw-presence', `cw-presence--${size}`, className)}
      data-presence={mode}
      data-measured={measured ? 'true' : 'false'}
      data-arrival={arrival === 'arriving' ? 'true' : undefined}
      style={{ '--cw-level': shown } as CSSProperties}
      aria-hidden="true"
    >
      <span className="cw-presence__halo" />
      <span className="cw-presence__arc" />
      {arrival === 'arriving' ? (
        <span className="cw-presence__ripple" onAnimationEnd={settle} />
      ) : null}
      <Avatar
        name={name}
        size={size}
        speaking={speaking}
        voice="customer"
        className="cw-presence__avatar"
      />
    </span>
  );
});
