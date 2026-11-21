// Small DOM helpers for moving around the report: scrolling, focus and the print events.

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

/**
 * Brings an element into view. A short element is centred, with its neighbours around it; a tall one
 * starts at the top, clear of the sticky header (the page sets the scroll margin).
 */
export function scrollToElement(element: HTMLElement): void {
  const tall = element.getBoundingClientRect().height > window.innerHeight * 0.6;
  element.scrollIntoView?.({ block: tall ? 'start' : 'center', inline: 'nearest' });
}

/**
 * Moves to a section named by its id: opens it if it is a closed disclosure, scrolls to it and puts
 * keyboard and screen-reader focus on its heading (or its summary), so the next thing read is the
 * section itself. A heading is not a control, so it gets no focus ring, as in the rest of the app.
 */
export function jumpToSection(id: string): void {
  const section = document.getElementById(id);
  if (!section) return;
  if (section instanceof HTMLDetailsElement && !section.open) section.open = true;
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
export function originOf(element: HTMLElement): string | null {
  return element.closest<HTMLElement>('[data-rp-origin]')?.dataset.rpOrigin ?? null;
}
