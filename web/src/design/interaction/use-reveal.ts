import { useLayoutEffect, useState, type RefObject } from 'react';
import { useInViewOnce, type InViewOptions } from './use-in-view.ts';

/**
 * What to spread on the element that reveals itself. `data-reveal` marks it; `data-revealed` appears
 * once it has been seen: empty when it was scrolled to (it then rises into place), and `now` when it
 * was already in view as it arrived (it is simply there, with no hidden start and no movement).
 */
export interface RevealProps {
  'data-reveal': '';
  'data-revealed'?: '' | 'now';
}

/**
 * Makes an element rise into place the first time it scrolls into view (the `[data-reveal]` rules
 * in `layout.css`). Attach the ref and spread the props:
 *
 *   const [ref, reveal] = useReveal<HTMLElement>();
 *   <section ref={ref} {...reveal}>...</section>
 *
 * Only what is below the fold waits. An element whose top is already inside the window when it
 * arrives (the top of a page, which the page's own entrance already covers) is marked seen before
 * the first paint, so it is never hidden and never waits for the observer. To stagger siblings, give
 * each a `--reveal-i` custom property (0, 1, 2 ...). Without IntersectionObserver the element counts
 * as seen at once, so nothing stays hidden. Put it on a block of its own: while it rises, the
 * element's own `transform` and `opacity` are overridden by the animation.
 */
export function useReveal<T extends Element>(
  options?: InViewOptions,
): [RefObject<T | null>, RevealProps] {
  const [ref, seen] = useInViewOnce<T>(options);
  const [arrivedInView, setArrivedInView] = useState(false);
  // A margin or a threshold asks for the element to be further in before it counts, so the shortcut
  // is not taken then.
  const eager = (options?.rootMargin ?? '0px') === '0px' && (options?.threshold ?? 0) === 0;
  useLayoutEffect(() => {
    const box = eager ? ref.current?.getBoundingClientRect() : undefined;
    // An element with no box (not displayed, or no layout at all) has nothing to show yet.
    if (box && (box.width > 0 || box.height > 0) && box.top < window.innerHeight) {
      setArrivedInView(true);
    }
  }, [ref, eager]);
  if (arrivedInView) return [ref, { 'data-reveal': '', 'data-revealed': 'now' }];
  return [ref, seen ? { 'data-reveal': '', 'data-revealed': '' } : { 'data-reveal': '' }];
}
