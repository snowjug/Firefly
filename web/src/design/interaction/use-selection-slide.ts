import { useLayoutEffect, useRef, type RefObject } from 'react';
import { prefersReducedMotion } from './reduced-motion.ts';

// A selection that glides from the old choice to the new one, with transform only.
//
// The selected item draws the selection itself (a pseudo-element in its stylesheet), so the ring and
// its rounded corners are exact whenever it is still. When the selection moves, this hook measures
// the item that was selected and the one that is now, writes where the old one was, as seen from the
// new one, on the new item, and marks it `data-sliding`; the stylesheet then plays an animation from
// that place to the ordinary one. What it writes on the new item:
//
//   --slide-dx, --slide-dy   how far the old item's top left corner was from the new one's, in px
//   --slide-sx, --slide-sy   the old item's width and height, as a fraction of the new one's
//   data-sliding             present while it may play; it is taken off and put on again for each move
//
// Nothing is measured on the first selection, under reduced motion, or where nothing is displayed
// (a test DOM): the selection simply appears.

/**
 * Keeps track of the selected item inside `container`: `selector` finds it (null switches the glide
 * off, for a layout where it makes no sense), and `key` changes whenever the selection may have moved.
 */
export function useSelectionSlide(
  container: RefObject<HTMLElement | null>,
  selector: string | null,
  key: string | null,
): void {
  const previous = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const next = selector
      ? (container.current?.querySelector<HTMLElement>(selector) ?? null)
      : null;
    const from = previous.current;
    previous.current = next;
    if (!next || !from || from === next || !from.isConnected || prefersReducedMotion()) return;
    const was = from.getBoundingClientRect();
    const now = next.getBoundingClientRect();
    if (now.width === 0 || now.height === 0) return;
    next.style.setProperty('--slide-dx', `${was.left - now.left}px`);
    next.style.setProperty('--slide-dy', `${was.top - now.top}px`);
    next.style.setProperty('--slide-sx', String(was.width / now.width));
    next.style.setProperty('--slide-sy', String(was.height / now.height));
    // Taking the mark off and putting it back after a reflow lets the same item play again.
    next.removeAttribute('data-sliding');
    void next.offsetWidth;
    next.setAttribute('data-sliding', '');
  }, [container, selector, key]);
}
