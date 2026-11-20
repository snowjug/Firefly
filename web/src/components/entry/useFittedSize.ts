import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

/**
 * The width an element has, rounded, kept between `min` and `max`, so a drawn instrument can be
 * made at the size it will be shown at (its fine print stays legible and its lines stay as thin as
 * they were meant to be). Before anything has been measured it is `max`, and where there is no
 * ResizeObserver (a test) it stays there.
 */
export function useFittedSize<T extends HTMLElement>(
  min: number,
  max: number,
): [RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState(max);

  // Before paint, so the first frame is already the right size.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const fit = (width: number) => {
      if (width <= 0) return;
      setSize(Math.round(Math.min(max, Math.max(min, width))));
    };
    fit(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => fit(entry?.contentRect.width ?? 0));
    observer.observe(element);
    return () => observer.disconnect();
  }, [min, max]);

  return [ref, size];
}
