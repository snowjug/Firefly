import type { ReactNode } from 'react';
import { cx } from '../cx.ts';
import { Icon, type IconName } from '../icons.tsx';
import { IconButton } from './Button.tsx';
import { VisuallyHidden } from './VisuallyHidden.tsx';
import './message-bar.css';

export type MessageIntent = 'info' | 'success' | 'warning' | 'error';

const ICONS: Record<MessageIntent, IconName> = {
  info: 'info',
  success: 'check-circle',
  warning: 'warning',
  error: 'error',
};

const WORDS: Record<MessageIntent, string> = {
  info: 'Information',
  success: 'Success',
  warning: 'Warning',
  error: 'Error',
};

export interface MessageBarProps {
  intent?: MessageIntent;
  title?: ReactNode;
  children?: ReactNode;
  /** Buttons or links that resolve the message, for example "Try again". */
  actions?: ReactNode;
  /** Adds a dismiss button. */
  onDismiss?: () => void;
  dismissLabel?: string;
  /**
   * Announce the message when it appears: `role="alert"` for an error, `role="status"` for the rest.
   * Set false for a note that is simply part of the page.
   */
  live?: boolean;
  className?: string;
  id?: string;
}

/**
 * A message that stays in the page until it is resolved or dismissed. Say what happened, what was
 * kept, and what to do next; give warnings and errors an action. The intent is written in hidden
 * text as well as shown in colour and icon.
 */
export function MessageBar({
  intent = 'info',
  title,
  children,
  actions,
  onDismiss,
  dismissLabel = 'Dismiss',
  live = true,
  className,
  id,
}: MessageBarProps) {
  const role = live ? (intent === 'error' ? 'alert' : 'status') : undefined;
  return (
    <div
      id={id}
      role={role}
      className={cx(
        'ff-message',
        `ff-message--${intent}`,
        // A message that arrives while someone is looking eases in; a note that is part of the page does not.
        live && 'ff-message--arriving',
        Boolean(actions) && 'ff-message--actions',
        onDismiss && 'ff-message--dismiss',
        className,
      )}
    >
      <Icon name={ICONS[intent]} size={20} className="ff-message__icon" />
      <div className="ff-message__body">
        <VisuallyHidden>{WORDS[intent]}: </VisuallyHidden>
        {title ? <p className="ff-message__title">{title}</p> : null}
        {children ? <div className="ff-message__text">{children}</div> : null}
      </div>
      {actions ? <div className="ff-message__actions">{actions}</div> : null}
      {onDismiss ? (
        <IconButton
          icon="x"
          label={dismissLabel}
          size="small"
          className="ff-message__dismiss"
          onClick={onDismiss}
        />
      ) : null}
    </div>
  );
}
