import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon.tsx';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DialogProps {
  open: boolean;
  onClose(): void;
  title: string;
  description?: string;
  children: ReactNode;
  /** 'sheet' slides up from the bottom (used for mobile panels). */
  variant?: 'dialog' | 'sheet';
  /** Set false for confirmations that must be answered explicitly. */
  dismissible?: boolean;
}

/**
 * Accessible modal: labelled, traps focus, closes on Escape (when dismissible), restores focus to the
 * element that opened it, makes the rest of the app inert and locks background scrolling.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  variant = 'dialog',
  dismissible = true,
}: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const root = document.getElementById('root');
    root?.setAttribute('inert', '');
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const node = ref.current;
    const first =
      node?.querySelector<HTMLElement>('[data-autofocus]') ??
      node?.querySelector<HTMLElement>(FOCUSABLE) ??
      node;
    first?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissible) {
        event.stopPropagation();
        onCloseRef.current();
      } else if (event.key === 'Tab' && node) {
        const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
          (el) => el.offsetParent !== null,
        );
        if (items.length === 0) {
          event.preventDefault();
          return;
        }
        const firstEl = items[0] as HTMLElement;
        const lastEl = items[items.length - 1] as HTMLElement;
        if (event.shiftKey && document.activeElement === firstEl) {
          event.preventDefault();
          lastEl.focus();
        } else if (!event.shiftKey && document.activeElement === lastEl) {
          event.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      root?.removeAttribute('inert');
      document.body.style.overflow = overflow;
      // If what opened the dialog has gone (the prompt that started the tour, say), land on the page
      // content rather than nowhere.
      if (opener?.isConnected) opener.focus?.();
      else document.getElementById('main')?.focus({ preventScroll: true });
    };
  }, [open, dismissible]);

  if (!open) return null;
  return createPortal(
    <div
      role="presentation"
      className={`scrim${variant === 'sheet' ? ' scrim-bottom' : ''}`}
      onMouseDown={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`glass glass-strong ${variant === 'sheet' ? 'sheet' : 'dialog'}`}
      >
        <div
          className="row between"
          style={{ alignItems: 'flex-start', marginBottom: 'var(--sp-3)' }}
        >
          <h2 id={titleId} className="t-section">
            {title}
          </h2>
          {dismissible ? (
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              onClick={onClose}
              aria-label="Close"
            >
              <Icon name="x" />
            </button>
          ) : null}
        </div>
        {description ? (
          <p id={descId} className="t-small t-muted" style={{ marginBottom: 'var(--sp-4)' }}>
            {description}
          </p>
        ) : null}
        {children}
      </div>
    </div>,
    document.body,
  );
}
