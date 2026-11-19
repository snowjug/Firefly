import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Open/close state for a small popover anchored to a button: it closes on Escape (returning focus to
 * the button), on a click outside, and when keyboard focus leaves it.
 */
export function usePopover(): {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  wrapRef: RefObject<HTMLDivElement | null>;
  onBlur: (event: React.FocusEvent) => void;
} {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      wrapRef.current?.querySelector<HTMLElement>('[aria-haspopup]')?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return {
    open,
    setOpen,
    toggle: () => setOpen(!open),
    wrapRef,
    onBlur: (event) => {
      const next = event.relatedTarget as Node | null;
      if (next && !wrapRef.current?.contains(next)) setOpen(false);
    },
  };
}
