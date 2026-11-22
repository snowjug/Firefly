import { useLayoutEffect, type RefObject } from 'react';

// One indicator element that slides to whichever item is current: the underline under the current
// navigation link, and the line under the chosen product in the landing page's call preview. The
// hook measures; the stylesheet draws and moves it with transform only. It writes four custom
// properties and a flag on the container:
//
//   --ind-x   where the item's text starts, in px from the container's left edge
//   --ind-w   how wide that text is, as a bare number of px (for scaleX)
//   --ind-by  the item's bottom edge, in px from the container's top edge
//   --ind-cy  the item's vertical centre, in px from the container's top edge
//   --ind-o   1 while there is a current item to point at, 0 when there is none
//   data-placed  set a frame after the first placement, so the first one never animates
//
// The container must be the item's offset parent (give it `position: relative`), and the item must
// not be nested inside another positioned element.

export interface IndicatorBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface IndicatorFrame {
  x: number;
  w: number;
  by: number;
  cy: number;
}

// Half a pixel is as fine as a screen can show.
const round = (value: number) => Math.round(value * 2) / 2;

/**
 * The indicator's frame for an item's box: it spans the item's text, so the item's own horizontal
 * padding is taken off both ends.
 */
export function indicatorFrame(
  box: IndicatorBox,
  padding: { left: number; right: number },
): IndicatorFrame {
  return {
    x: round(box.left + padding.left),
    w: Math.max(0, round(box.width - padding.left - padding.right)),
    by: round(box.top + box.height),
    cy: round(box.top + box.height / 2),
  };
}

function place(container: HTMLElement, selector: string): void {
  const item = container.querySelector<HTMLElement>(selector);
  // An item that is not displayed (a closed menu) has no offset parent: nothing to point at.
  if (!item || item.offsetParent === null) {
    container.style.setProperty('--ind-o', '0');
    return;
  }
  const { paddingLeft, paddingRight } = getComputedStyle(item);
  const frame = indicatorFrame(
    {
      left: item.offsetLeft,
      top: item.offsetTop,
      width: item.offsetWidth,
      height: item.offsetHeight,
    },
    { left: parseFloat(paddingLeft) || 0, right: parseFloat(paddingRight) || 0 },
  );
  // Coming back after having been hidden, it fades in where it belongs; it does not slide in from
  // wherever it was last. Removing the flag drops the transform transition for this one change.
  if (container.style.getPropertyValue('--ind-o') !== '1') delete container.dataset.placed;
  container.style.setProperty('--ind-x', `${frame.x}px`);
  container.style.setProperty('--ind-w', String(frame.w));
  container.style.setProperty('--ind-by', `${frame.by}px`);
  container.style.setProperty('--ind-cy', `${frame.cy}px`);
  container.style.setProperty('--ind-o', '1');
}

/**
 * Keeps the indicator under the item `active` selects inside `container`. `key` changes when the
 * current item may have changed (the route, or the selected value); the position is also measured
 * again when the container or the item changes size (a resize, a menu opening, a font arriving) and
 * once the page's fonts are ready. Nothing is measured where there is no layout (jsdom), and there
 * the indicator stays hidden.
 */
export function useSlidingIndicator(
  container: RefObject<HTMLElement | null>,
  active: string,
  key: string,
): void {
  useLayoutEffect(() => {
    const element = container.current;
    if (!element) return;
    let frame = 0;
    let live = true;
    const run = () => {
      if (!live) return;
      place(element, active);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        element.dataset.placed = '';
      });
    };
    run();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(run);
    observer?.observe(element);
    const item = element.querySelector(active);
    if (item) observer?.observe(item);
    void document.fonts?.ready.then(run);
    return () => {
      live = false;
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [container, active, key]);
}
