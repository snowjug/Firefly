import { useSyncExternalStore } from 'react';

function subscribe(notify: () => void): () => void {
  let frame = 0;
  const onScroll = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      notify();
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  return () => {
    window.removeEventListener('scroll', onScroll);
    if (frame) cancelAnimationFrame(frame);
  };
}

const unscrolled = () => false;

/**
 * True once the window has scrolled more than `thresholdPx` (default 8). The page is re-read at most
 * once per animation frame and React only re-renders when the answer flips, never on every scroll.
 * It is false on the server; on the client even the first render reads the real position, so a page
 * restored part-way down has no flash of the unscrolled state.
 */
export function useScrolled(thresholdPx = 8): boolean {
  return useSyncExternalStore(subscribe, () => window.scrollY > thresholdPx, unscrolled);
}
