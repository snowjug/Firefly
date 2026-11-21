import { useCallback, useEffect, useRef, useState, type FocusEvent, type RefObject } from 'react';
import { useLocation } from 'react-router';

/**
 * Open/close state for a small popover anchored to a button. It closes on Escape (returning focus
 * to the button), on a press outside, when keyboard focus leaves it and when the page changes.
 * Attach `wrapRef` to the element that holds both the button and the popover, `triggerRef` to the
 * button and `onBlur` to the wrapper.
 */
export function usePopover(): {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  wrapRef: RefObject<HTMLDivElement | null>;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onBlur: (event: FocusEvent) => void;
} {
  const { pathname } = useLocation();
  // Remembering where it was opened closes it on any navigation without an effect.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const setOpen = useCallback((next: boolean) => setOpenedAt(next ? pathname : null), [pathname]);
  const toggle = useCallback(
    () => setOpenedAt((current) => (current === pathname ? null : pathname)),
    [pathname],
  );

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpenedAt(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpenedAt(null);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onBlur = useCallback((event: FocusEvent) => {
    const next = event.relatedTarget as Node | null;
    if (next && !wrapRef.current?.contains(next)) setOpenedAt(null);
  }, []);

  return { open, setOpen, toggle, wrapRef, triggerRef, onBlur };
}
