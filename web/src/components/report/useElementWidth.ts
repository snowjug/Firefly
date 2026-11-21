import { useLayoutEffect, useRef, useState } from 'react';

/** The width of an element in whole pixels, kept up to date as it is resized. */
export function useElementWidth<T extends HTMLElement>(initial: number) {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(initial);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const next = Math.round(el.getBoundingClientRect().width);
      if (next > 0) setWidth(next);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}
