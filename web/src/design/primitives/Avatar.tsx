import { cx } from '../cx.ts';
import './avatar.css';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/** Up to two capital letters: the first letters of the first and last words of a name. */
export function initials(name: string): string {
  const words = name
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0] as string;
  const last = words.length > 1 ? (words[words.length - 1] as string) : '';
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export interface AvatarProps {
  /** The person's name: used for the initials and, with `label`, as the accessible name. */
  name: string;
  /** 24, 32, 40 (default), 56 and 72 px. */
  size?: AvatarSize;
  tone?: 'neutral' | 'brand' | 'ai';
  /** Draws a ring while this person is speaking. The ring is still under reduced motion. */
  speaking?: boolean;
  /** Whose voice the ring is drawn for: the trainee's (brand blue) or the customer's (teal). */
  voice?: 'trainee' | 'customer';
  /** Give it an accessible name when the name is not written beside it. Otherwise it is decorative. */
  label?: string;
  className?: string;
}

/** A person's initials in a circle. Fictional customers never get a photograph. */
export function Avatar({
  name,
  size = 'md',
  tone = 'neutral',
  speaking = false,
  voice = 'trainee',
  label,
  className,
}: AvatarProps) {
  return (
    <span
      className={cx(
        'ff-avatar',
        `ff-avatar--${size}`,
        `ff-avatar--${tone}`,
        speaking && 'ff-avatar--speaking',
        speaking && voice === 'customer' && 'ff-avatar--customer',
        className,
      )}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <span className="ff-avatar__initials" aria-hidden="true">
        {initials(name)}
      </span>
    </span>
  );
}
