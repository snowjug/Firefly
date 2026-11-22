import { useState, type RefObject } from 'react';
import { useAttachedRef } from './use-attached-ref.ts';

export interface InViewOptions {
  /** How much of the element must show, 0 to 1. */
  threshold?: number;
  /** Grows or shrinks the viewport the element is measured against, as a CSS margin does. */
  rootMargin?: string;
}

const noObserver = () => typeof IntersectionObserver === 'undefined';
const nothing = () => undefined;

/**
 * True once the element has been seen, and then true for good: use it to activate something as it
 * scrolls into view. Attach the returned ref. By default any part of the element counts as seen
 * (`threshold` 0, no margin): that works for an element taller than the window, which a ratio never
 * would, and for one at the very end of the page. To wait until it is a little way up the window,
 * pass `rootMargin: '0px 0px -10% 0px'`, but not for something short at the end of the page, which can
 * never get that far. Without IntersectionObserver (jsdom, old browsers) it is true at once, so
 * nothing stays hidden.
 */
export function useInViewOnce<T extends Element>({
  threshold = 0,
  rootMargin = '0px',
}: InViewOptions = {}): [RefObject<T | null>, boolean] {
  const [seen, setSeen] = useState(noObserver);
  const ref = useAttachedRef<T>(
    (element) => {
      if (seen || noObserver()) return nothing;
      const observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          setSeen(true);
          observer.disconnect();
        },
        { threshold, rootMargin },
      );
      observer.observe(element);
      return () => observer.disconnect();
    },
    [threshold, rootMargin, seen],
  );
  return [ref, seen];
}

/**
 * True while any part of the element is in the window: use it to pause anything that loops while it
 * cannot be seen. Attach the returned ref. It is false until the browser has reported (about a frame
 * after mount), so a loop never starts for something that was never on screen. Without
 * IntersectionObserver it is true.
 */
export function useOnScreen<T extends Element>({
  threshold = 0,
  rootMargin = '0px',
}: InViewOptions = {}): [RefObject<T | null>, boolean] {
  const [onScreen, setOnScreen] = useState(noObserver);
  const ref = useAttachedRef<T>(
    (element) => {
      if (noObserver()) return nothing;
      const observer = new IntersectionObserver(
        (entries) => {
          const latest = entries[entries.length - 1];
          if (latest) setOnScreen(latest.isIntersecting);
        },
        { threshold, rootMargin },
      );
      observer.observe(element);
      return () => observer.disconnect();
    },
    [threshold, rootMargin],
  );
  return [ref, onScreen];
}
