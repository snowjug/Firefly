// Small DOM helpers for moving around the report: scrolling and focus.

/** Anything that can take focus: a control in the page or a point in the chart. */
export type Focusable = HTMLElement | SVGElement;

/** True for an ordinary click, so a link keeps its normal behaviour with a modifier key or middle button. */
export function isPlainClick(event: {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
}): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

/** True when the person has asked their system for less motion. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Brings an element into view. A short element is centred, with its neighbours around it; a tall one
 * starts at the top, clear of the sticky header (the page sets the scroll margin). The scroll is
 * gentle unless the person has asked for less motion.
 */
export function scrollToElement(element: Element): void {
  const tall = element.getBoundingClientRect().height > window.innerHeight * 0.6;
  element.scrollIntoView?.({
    block: tall ? 'start' : 'center',
    inline: 'nearest',
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
  });
}

/**
 * Moves to a section named by its id: opens it if it is a closed disclosure (or holds one marked
 * `data-rp-disclosure`), scrolls to it and puts keyboard and screen-reader focus on its heading (or
 * its summary), so the next thing read is the section itself. A heading is not a control, so it
 * gets no focus ring, as in the rest of the app.
 */
export function jumpToSection(id: string): void {
  const section = document.getElementById(id);
  if (!section) return;
  const disclosure =
    section instanceof HTMLDetailsElement
      ? section
      : section.querySelector<HTMLDetailsElement>('details[data-rp-disclosure]');
  if (disclosure && !disclosure.open) disclosure.open = true;
  section.scrollIntoView?.({ block: 'start', inline: 'nearest' });
  const target =
    section instanceof HTMLDetailsElement
      ? section.querySelector<HTMLElement>('summary')
      : section.querySelector<HTMLElement>('[data-rp-heading]');
  if (!target) return;
  if (target.matches('[data-rp-heading]')) target.setAttribute('data-route-target', '');
  target.focus({ preventScroll: true });
}

/** The label of the part of the report an element sits in (the nearest `data-rp-origin`). */
export function originOf(element: Element): string | null {
  return element.closest<HTMLElement>('[data-rp-origin]')?.dataset.rpOrigin ?? null;
}
