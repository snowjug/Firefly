import {
  useId,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type PointerEvent,
  type MouseEvent,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { cx } from '../cx.ts';
import { prefersReducedMotion } from '../interaction/reduced-motion.ts';
import { IconButton } from './Button.tsx';
import { AnnouncerProvider } from './LiveRegion.tsx';
import './dialog.css';

export type DialogCloseReason = 'escape' | 'close-button' | 'backdrop' | 'native';

export interface DialogProps {
  open: boolean;
  /**
   * Called when the person dismisses the dialog (Escape, the close button, the backdrop). The owner
   * decides what happens: set `open` to false to close it.
   */
  onClose(reason: DialogCloseReason): void;
  /** The accessible name. Always required. */
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Buttons for the footer. Put the main action last. */
  actions?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** On narrow screens: a `sheet` rising from the bottom, or the `fullscreen` dialog for forms. */
  mobile?: 'sheet' | 'fullscreen';
  /**
   * False for a dialog that has to be answered: no close button, and Escape and the backdrop do
   * nothing. Mark the safe action with `data-autofocus`.
   */
  dismissible?: boolean;
  closeLabel?: string;
  className?: string;
}

const FOCUSABLE =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

function openModal(dialog: HTMLDialogElement) {
  if (dialog.open) return;
  // Where the browser has no showModal (very old engines, or a test DOM) it opens non-modally.
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function closeModal(dialog: HTMLDialogElement) {
  if (typeof dialog.close === 'function') {
    if (dialog.open) dialog.close();
  } else dialog.removeAttribute('open');
}

/** The control marked `data-autofocus`, else the first one the browser focused, else the first in the dialog. */
function focusInitial(dialog: HTMLDialogElement) {
  const marked = dialog.querySelector<HTMLElement>('[data-autofocus]');
  if (marked) {
    marked.focus();
    return;
  }
  if (dialog.contains(document.activeElement)) return;
  (dialog.querySelector<HTMLElement>(FOCUSABLE) ?? dialog).focus();
}

function restoreFocus(opener: HTMLElement | null) {
  if (opener?.isConnected) {
    opener.focus({ preventScroll: true });
    return;
  }
  const active = document.activeElement;
  if (!active || active === document.body) {
    document.getElementById('main')?.focus({ preventScroll: true });
  }
}

/** The longest a dialog's exit may take. It is about 150 ms; this is only the bound that keeps its picture from staying. */
const EXIT_LIMIT_MS = 600;

/**
 * Plays the exit of a dialog that has just been closed, on a picture of it. The dialog itself goes at
 * once (focus returns to the opener and the page answers in the same frame, so a key pressed straight
 * after Escape is never lost); what fades out is a copy, drawn where the dialog was, with a copy of
 * its backdrop. The copy is hidden from assistive technology, inert, never takes a press, shows its
 * contents still, and removes itself when its animation ends, or within `EXIT_LIMIT_MS` whatever
 * happens. Nothing is drawn where the browser cannot animate or when motion is reduced.
 */
function showExit(dialog: HTMLDialogElement) {
  if (typeof dialog.getAnimations !== 'function' || prefersReducedMotion()) return;
  const box = dialog.getBoundingClientRect();
  if (box.width === 0 || box.height === 0) return;
  const scrim = document.createElement('div');
  scrim.className = 'ff-dialog-scrim';
  scrim.setAttribute('aria-hidden', 'true');
  const picture = dialog.cloneNode(true) as HTMLDialogElement;
  // A copy repeats nothing the page could look up by id: the title and description that name the dialog.
  for (const node of [picture, ...picture.querySelectorAll('[id]')]) node.removeAttribute('id');
  picture.setAttribute('open', '');
  picture.setAttribute('aria-hidden', 'true');
  picture.setAttribute('inert', '');
  picture.setAttribute('data-picture', '');
  Object.assign(picture.style, {
    position: 'fixed',
    inset: 'auto',
    margin: '0',
    left: `${box.left}px`,
    top: `${box.top}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
  });
  const remove = () => {
    scrim.remove();
    picture.remove();
  };
  picture.addEventListener('animationend', (event) => {
    if (event.target === picture) remove();
  });
  window.setTimeout(remove, EXIT_LIMIT_MS);
  document.body.append(scrim, picture);
}

/**
 * A modal dialog on the native `<dialog>`: `showModal()` makes the rest of the page inert and
 * handles Escape, so nothing here traps focus by hand. Focus goes in on opening (to the control
 * marked `data-autofocus`, else the first one) and returns to what opened it on closing. The page
 * behind does not scroll while it is open. A dialog that is `open` on first render works.
 *
 * It enters with a short fade and rise and leaves with a shorter fade. Closing is never delayed by
 * that: when `open` goes false the dialog is gone in the same frame, and the fade is played by a
 * picture of it (`showExit`), so focus, keys and clicks belong to the page at once. A dialog whose
 * owner unmounts it has no exit.
 *
 * Status messages inside a dialog are announced by `useAnnouncer`: the dialog has its own region,
 * because everything outside a modal dialog is inert and silent.
 */
export function Dialog(props: DialogProps) {
  // `leaving` lasts for the one render in which the dialog is still there to be photographed.
  const [leaving, setLeaving] = useState(false);
  const [wasOpen, setWasOpen] = useState(props.open);
  if (props.open !== wasOpen) {
    setWasOpen(props.open);
    setLeaving(wasOpen);
  }
  if (!props.open && !leaving) return null;
  return <OpenDialog {...props} leaving={!props.open} onLeft={() => setLeaving(false)} />;
}

function OpenDialog({
  onClose,
  title,
  description,
  children,
  actions,
  size = 'md',
  mobile = 'sheet',
  dismissible = true,
  closeLabel = 'Close',
  className,
  leaving,
  onLeft,
}: DialogProps & { leaving: boolean; onLeft(): void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const pressedBackdrop = useRef(false);
  const unmounting = useRef(false);
  const onCloseRef = useRef(onClose);
  const onLeftRef = useRef(onLeft);
  const base = useId();
  const [, refresh] = useReducer((count: number) => count + 1, 0);

  useLayoutEffect(() => {
    onCloseRef.current = onClose;
    onLeftRef.current = onLeft;
  });

  // Open when mounted, and close, and give focus back, when unmounted.
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    unmounting.current = false;
    const active = document.activeElement;
    const opener = active instanceof HTMLElement && active !== document.body ? active : null;
    openModal(dialog);
    focusInitial(dialog);
    return () => {
      unmounting.current = true;
      closeModal(dialog);
      restoreFocus(opener);
    };
  }, []);

  // If the browser closed the element while the owner still wants it open, open it again.
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open && !leaving) {
      openModal(dialog);
      focusInitial(dialog);
    }
  });

  // The owner has closed it: photograph it for its exit, then let it go in the same frame.
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!leaving || !dialog) return;
    showExit(dialog);
    onLeftRef.current();
  }, [leaving]);

  const onCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    // Escape: the owner's state decides, never the browser.
    event.preventDefault();
    if (dismissible) onCloseRef.current('escape');
  };

  const onNativeClose = () => {
    const dialog = ref.current;
    if (!dialog || dialog.open || unmounting.current) return;
    // Closed behind our back (a form method="dialog", or Escape pressed twice in Chromium).
    if (dismissible) onCloseRef.current('native');
    refresh();
  };

  const onPointerDown = (event: PointerEvent<HTMLDialogElement>) => {
    pressedBackdrop.current = event.target === event.currentTarget;
  };
  const onClick = (event: MouseEvent<HTMLDialogElement>) => {
    const startedOnBackdrop = pressedBackdrop.current;
    pressedBackdrop.current = false;
    if (dismissible && startedOnBackdrop && event.target === event.currentTarget) {
      onCloseRef.current('backdrop');
    }
  };

  const titleId = `${base}-title`;
  const descriptionId = description ? `${base}-description` : undefined;
  return (
    // The dialog element is only the backdrop's click target: Escape and the close button are the
    // keyboard routes, and the controls inside it are the real ones.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events
    <dialog
      ref={ref}
      className={cx('ff-dialog', `ff-dialog--${size}`, `ff-dialog--${mobile}`, className)}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={onCancel}
      onClose={onNativeClose}
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      <AnnouncerProvider>
        <div className="ff-dialog__panel">
          <header className="ff-dialog__header">
            <div className="ff-dialog__titles">
              <h2 className="ff-dialog__title" id={titleId}>
                {title}
              </h2>
              {description ? (
                <p className="ff-dialog__description" id={descriptionId}>
                  {description}
                </p>
              ) : null}
            </div>
            {dismissible ? (
              <IconButton
                icon="x"
                label={closeLabel}
                className="ff-dialog__close"
                onClick={() => onCloseRef.current('close-button')}
              />
            ) : null}
          </header>
          {children ? <div className="ff-dialog__body">{children}</div> : null}
          {actions ? <footer className="ff-dialog__actions">{actions}</footer> : null}
        </div>
      </AnnouncerProvider>
    </dialog>
  );
}
