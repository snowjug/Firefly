import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';

// Two small measurements the spatial views are drawn from. Neither is read while the pointer
// moves: the width is read when the element is first laid out and again when it is resized, and the
// window's height when the window is.

/** The width of an element in px, kept up to date. Zero until it has been measured (and in tests). */
export function useBoxWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const read = () => setWidth(Math.round(element.getBoundingClientRect().width));
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(read);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

/** The height of the window in px, kept up to date. */
export function useViewportHeight(): number {
  const [height, setHeight] = useState(() =>
    typeof window === 'undefined' ? 900 : window.innerHeight,
  );
  useEffect(() => {
    const read = () => setHeight(window.innerHeight);
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, []);
  return height;
}
