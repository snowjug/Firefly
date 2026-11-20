import { useSyncExternalStore } from 'react';

// Pointer-driven effects (a lens that follows the pointer, a pip that leans towards it) only make
// sense where there is a precise pointer that can hover. Touch gets taps and visible alternatives.

const QUERY = '(hover: hover) and (pointer: fine)';

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function snapshot(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(QUERY).matches
  );
}

/** True on devices with a hovering, precise pointer (a mouse or a trackpad). */
export function useFinePointer(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

/**
 * Runs `handler` at most once per animation frame with the latest pointer position, so a handler
 * that touches the page cannot be called faster than the screen refreshes. Returns a function that
 * detaches it. The handler should only write transforms and custom properties, never read layout.
 */
export function onPointerFrame(
  target: EventTarget,
  handler: (x: number, y: number) => void,
): () => void {
  let frame = 0;
  let x = 0;
  let y = 0;
  const listener = (event: Event) => {
    const pointer = event as PointerEvent;
    x = pointer.clientX;
    y = pointer.clientY;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      handler(x, y);
    });
  };
  target.addEventListener('pointermove', listener, { passive: true });
  return () => {
    target.removeEventListener('pointermove', listener);
    if (frame) cancelAnimationFrame(frame);
  };
}
