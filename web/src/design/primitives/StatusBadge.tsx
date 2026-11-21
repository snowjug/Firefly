import { cx } from '../cx.ts';
import type { IconName } from '../icons.tsx';
import { Badge, type BadgeTone } from './Badge.tsx';
import './status-badge.css';

export interface StatusBadgeProps {
  /** The state in one or two words: "Listening", "Customer speaking". A new word fades in place. */
  label: string;
  tone?: BadgeTone;
  /** An icon in place of the dot. The dot is the default, so the state reads without colour. */
  icon?: IconName;
  /**
   * Something is live (listening, speaking): the dot gets a ring, and a soft pulse while motion is
   * allowed. The ring stays under reduced motion, so the state never depends on movement.
   */
  live?: boolean;
  size?: 'small' | 'medium';
  /** Announce a change of state politely (`role="status"`). Leave it off where the state is also announced elsewhere. */
  announce?: boolean;
  className?: string;
}

/**
 * A Badge for a state that changes while you watch: Ready, Listening, Transcribing, Paused. The
 * word is always there (colour never carries the state alone), a change of word fades in place
 * with a short rise, and nothing around it moves.
 */
export function StatusBadge({
  label,
  tone = 'neutral',
  icon,
  live = false,
  size = 'medium',
  announce = false,
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cx('ff-status', live && 'ff-status--live', className)}
      role={announce ? 'status' : undefined}
    >
      <Badge tone={tone} size={size} icon={icon ?? null}>
        {icon ? null : <span className="ff-status__dot" aria-hidden="true" />}
        <span key={label} className="ff-status__label">
          {label}
        </span>
      </Badge>
    </span>
  );
}
