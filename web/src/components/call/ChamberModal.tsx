import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon.tsx';
import '../../styles/chamber-kit.css';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ChamberModalProps {
  open: boolean;
  onClose(): void;
  title: string;
  description?: string;
  children: ReactNode;
  /**
   * `dialog` is a glass modal in the middle of the room; `inspector` is a glass sheet that comes in
   * from the side on a wide screen and up from the bottom on a narrow one.
   */
  variant?: 'dialog' | 'inspector';
  /** Set false for confirmations that must be answered explicitly. */
  dismissible?: boolean;
}

/**
 * A labelled modal on glass: it traps focus, closes on Escape (when dismissible), makes the rest of
 * the app inert, locks background scrolling and gives focus back to what opened it. The first
 * control marked `data-autofocus` (or else the first one) takes focus when it opens.
 */
export function ChamberModal({
  open,
  onClose,
  title,
  description,
  children,
  variant = 'dialog',
  dismissible = true,
}: ChamberModalProps) {
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
      // If what opened it has gone, land on the page content rather than nowhere.
      if (opener?.isConnected) opener.focus?.();
      else document.getElementById('main')?.focus({ preventScroll: true });
    };
  }, [open, dismissible]);

  if (!open) return null;
  return createPortal(
    <div
      role="presentation"
      className="ch-scrim"
      data-variant={variant}
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
        className={`ch-modal glass ${variant === 'dialog' ? 'glass--modal' : 'glass--inspector'}`}
        data-variant={variant}
      >
        <div className="ch-modal__head">
          <h2 id={titleId} className="ch-modal__title">
            {title}
          </h2>
          {dismissible ? (
            <button type="button" className="ch-modal__close" onClick={onClose} aria-label="Close">
              <Icon name="x" size={18} />
            </button>
          ) : null}
        </div>
        <div className="ch-modal__scroll">
          {description ? (
            <p id={descId} className="ch-modal__lead">
              {description}
            </p>
          ) : null}
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
