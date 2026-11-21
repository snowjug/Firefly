import type { ReactNode } from 'react';
import { cx } from '../cx.ts';
import { Icon, type IconName } from '../icons.tsx';
import './badge.css';

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'ai';

/** How the simulated customer feels. Always shown with a label and its own icon shape. */
export type CustomerState =
  'calm' | 'concerned' | 'frustrated' | 'angry' | 'escalating' | 'recovering';

export type BadgeTone = StatusTone | CustomerState;

export const CUSTOMER_STATES: readonly CustomerState[] = [
  'calm',
  'concerned',
  'frustrated',
  'angry',
  'escalating',
  'recovering',
];

export const CUSTOMER_STATE_LABELS: Record<CustomerState, string> = {
  calm: 'Calm',
  concerned: 'Concerned',
  frustrated: 'Frustrated',
  angry: 'Angry',
  escalating: 'Escalating',
  recovering: 'Recovering',
};

export const CUSTOMER_STATE_ICONS: Record<CustomerState, IconName> = {
  calm: 'state-calm',
  concerned: 'state-concerned',
  frustrated: 'state-frustrated',
  angry: 'state-angry',
  escalating: 'state-escalating',
  recovering: 'state-recovering',
};

const STATUS_ICONS: Record<StatusTone, IconName | null> = {
  neutral: null,
  info: 'info',
  success: 'check-circle',
  warning: 'warning',
  danger: 'error',
  ai: 'sparkle',
};

function defaultIcon(tone: BadgeTone): IconName | null {
  return tone in CUSTOMER_STATE_ICONS
    ? CUSTOMER_STATE_ICONS[tone as CustomerState]
    : STATUS_ICONS[tone as StatusTone];
}

export interface BadgeProps {
  tone?: BadgeTone;
  /** `tint` is a soft fill with a border; `outline` is a border only. */
  appearance?: 'tint' | 'outline';
  size?: 'small' | 'medium';
  /** The icon that goes with the tone by default. Pass `null` for none, or another icon. */
  icon?: IconName | null;
  children: ReactNode;
  className?: string;
}

/**
 * A status label: a tinted pill with an icon and words. Colour never carries the meaning alone,
 * so the text is always there. Use it for status and state; use Tag for a chosen value.
 */
export function Badge({
  tone = 'neutral',
  appearance = 'tint',
  size = 'medium',
  icon,
  children,
  className,
}: BadgeProps) {
  const name = icon === undefined ? defaultIcon(tone) : icon;
  return (
    <span
      className={cx(
        'ff-badge',
        `ff-badge--${tone}`,
        `ff-badge--${appearance}`,
        `ff-badge--${size}`,
        className,
      )}
    >
      {name ? <Icon name={name} size={size === 'small' ? 14 : 16} /> : null}
      <span className="ff-badge__text">{children}</span>
    </span>
  );
}

export interface StateBadgeProps {
  state: CustomerState;
  /** Replaces the standard word, for example "Frustrated, easing". */
  label?: string;
  size?: 'small' | 'medium';
  className?: string;
}

/** The customer's state as a Badge: its colour, its icon shape and its word. */
export function StateBadge({ state, label, size, className }: StateBadgeProps) {
  return (
    <Badge tone={state} size={size} className={className}>
      {label ?? CUSTOMER_STATE_LABELS[state]}
    </Badge>
  );
}

export interface TagProps {
  children: ReactNode;
  icon?: IconName;
  /** Adds a remove button. */
  onRemove?: () => void;
  /** Names the remove button, for example "Remove filter: Billing". */
  removeLabel?: string;
  size?: 'small' | 'medium';
  className?: string;
}

/** A chosen value or a label on something, such as a filter or a scenario tag. */
export function Tag({
  children,
  icon,
  onRemove,
  removeLabel = 'Remove',
  size = 'medium',
  className,
}: TagProps) {
  return (
    <span className={cx('ff-tag', `ff-tag--${size}`, onRemove && 'ff-tag--removable', className)}>
      {icon ? <Icon name={icon} size={size === 'small' ? 14 : 16} /> : null}
      <span className="ff-tag__text">{children}</span>
      {onRemove ? (
        <button
          type="button"
          className="ff-tag__remove"
          aria-label={removeLabel}
          onClick={onRemove}
        >
          <Icon name="x" size={12} />
        </button>
      ) : null}
    </span>
  );
}
