import { useLayoutEffect, type RefObject } from 'react';

/** Space kept free at the bottom of the screen for the bar that starts the call. */
const RESERVED_BOTTOM = 112;
const TOP_GAP = 16;

/**
 * Keeps a tall side panel in reach without a scroll area of its own. A panel that fits the screen
 * simply stays in view. One that is taller scrolls with the page until its bottom is in view and
 * then stays there, so all of it can be read by scrolling the page. The offset goes into the custom
 * property `--stp-aside-top`, which the stylesheet uses as the sticky `top`.
 */
export function useStickyAside(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const room = window.innerHeight - RESERVED_BOTTOM;
      element.style.setProperty(
        '--stp-aside-top',
        `${Math.min(TOP_GAP, room - element.offsetHeight)}px`,
      );
    };
    update();
    window.addEventListener('resize', update);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(element);
    return () => {
      window.removeEventListener('resize', update);
      observer?.disconnect();
    };
  }, [ref]);
}
