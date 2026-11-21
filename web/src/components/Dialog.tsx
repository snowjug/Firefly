import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { durationToken, motionAllowed } from './frame/motion.ts';
import { Icon } from './Icon.tsx';
import '../styles/dialog.css';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Variant = 'dialog' | 'sheet' | 'drawer';

interface DialogProps {
  open: boolean;
  onClose(): void;
  title: string;
  /** A small mono line above the title, such as the name of the place the dialog belongs to. */
  eyebrow?: string;
  description?: string;
  children: ReactNode;
  /** 'sheet' slides up from the bottom and 'drawer' in from the left (used for mobile panels). */
  variant?: Variant;
  /** Set false for confirmations that must be answered explicitly. */
  dismissible?: boolean;
}

/** A cloned scrim fades out where the real one was, so unmounting stays immediate and testable. */
function animateOut(node: HTMLElement, variant: Variant) {
  if (typeof node.animate !== 'function' || !motionAllowed()) return;
  const clone = node.cloneNode(true) as HTMLElement;
  clone.setAttribute('aria-hidden', 'true');
  clone.setAttribute('inert', '');
  clone.classList.add('is-leaving');
  document.body.appendChild(clone);
  const timing: KeyframeAnimationOptions = {
    duration: durationToken('--dur-micro', 160),
    easing: 'cubic-bezier(0, 0, 0.2, 1)',
    fill: 'forwards',
  };
  const gone = () => clone.remove();
  const tint = clone.animate([{ opacity: 1 }, { opacity: 0 }], {
    ...timing,
    pseudoElement: '::before',
  });
  tint.finished.then(gone, gone);
  const to =
    variant === 'sheet'
      ? 'translateY(24px)'
      : variant === 'drawer'
        ? 'translateX(-24px)'
        : 'translateY(8px) scale(0.99)';
  clone.firstElementChild?.animate(
    [
      { opacity: 1, transform: 'none' },
      { opacity: 0, transform: to },
    ],
    timing,
  );
}

/**
 * Accessible modal: labelled, traps focus, closes on Escape (when dismissible), restores focus to the
 * element that opened it, makes the rest of the app inert and locks background scrolling. It is a
 * glass surface over a scrim: a header with a hairline (an optional mono eyebrow and the serif
 * title), a scrolling body, and a close button unless it must be answered. The drawer is a glass
 * inspector on the left edge, the sheet a glass panel rising from the bottom. It fades in on the
 * component and route durations, fades out on the micro duration, and is instant under reduced
 * motion.
 */
export function Dialog({
  open,
  onClose,
  title,
  eyebrow,
  description,
  children,
  variant = 'dialog',
  dismissible = true,
}: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const lastScrim = useRef<HTMLDivElement | null>(null);
  const wasOpen = useRef(false);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useLayoutEffect(() => {
    if (!open && wasOpen.current && lastScrim.current) animateOut(lastScrim.current, variant);
    wasOpen.current = open;
  }, [open, variant]);

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
  const scrimClass =
    variant === 'sheet'
      ? 'scrim scrim-bottom'
      : variant === 'drawer'
        ? 'scrim scrim-start'
        : 'scrim';
  const panelClass =
    variant === 'sheet'
      ? 'ff-dialog sheet glass glass--modal'
      : variant === 'drawer'
        ? 'ff-dialog drawer glass glass--inspector'
        : 'ff-dialog dialog glass glass--modal';
  return createPortal(
    <div
      ref={(node) => {
        if (node) lastScrim.current = node;
      }}
      role="presentation"
      className={scrimClass}
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
        className={panelClass}
      >
        <header className="ff-dialog__head">
          <div className="ff-dialog__titles">
            {eyebrow ? <p className="ff-dialog__eyebrow type-label">{eyebrow}</p> : null}
            <h2 id={titleId} className="ff-dialog__title">
              {title}
            </h2>
            {description ? (
              <p id={descId} className="ff-dialog__desc">
                {description}
              </p>
            ) : null}
          </div>
          {dismissible ? (
            <button type="button" className="ff-dialog__close" onClick={onClose} aria-label="Close">
              <Icon name="x" />
            </button>
          ) : null}
        </header>
        <div className="ff-dialog__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
