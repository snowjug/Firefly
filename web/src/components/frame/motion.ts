// Small motion helpers for the primitives. Everything here is decorative: when motion is not wanted
// (the system asks for less, or the user chose "Reduce motion" in Settings) the state simply
// changes, instantly, and the text and the pip's position say everything.

/** False when the system or the user asked for reduced motion. */
export function motionAllowed(): boolean {
  if (typeof document === 'undefined') return false;
  if (document.documentElement.getAttribute('data-motion') === 'reduce') return false;
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** A duration token in milliseconds (`--dur-component`), with a fallback when it is not set. */
export function durationToken(name: string, fallback: number): number {
  if (typeof document === 'undefined') return fallback;
  const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Moves an amber pip from where it was to where it is now. A pip is the `::after` of the chosen
 * option or tab; when the choice changes, the new pip starts over the old one and settles with the
 * spring, so the eye sees where it came from. `from` and `to` are the elements that carry the pips;
 * both pips sit at their element's bottom centre, so the distance is the distance between those
 * points. Does nothing when there is nowhere to move from, when the browser cannot animate a
 * pseudo-element, or when motion is not wanted.
 */
export function slidePip(from: HTMLElement | null | undefined, to: HTMLElement | null | undefined) {
  if (!from || !to || from === to || !from.isConnected || !to.isConnected) return;
  if (typeof to.animate !== 'function' || !motionAllowed()) return;
  const before = from.getBoundingClientRect();
  const after = to.getBoundingClientRect();
  const dx = before.left + before.width / 2 - (after.left + after.width / 2);
  const dy = before.bottom - after.bottom;
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
  const easing =
    getComputedStyle(document.documentElement).getPropertyValue('--ease-spatial-spring').trim() ||
    'cubic-bezier(0.22, 1, 0.36, 1)';
  try {
    to.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(1)` },
        { transform: 'translate(0, 0) scale(1)' },
      ],
      { duration: durationToken('--dur-component', 260), easing, pseudoElement: '::after' },
    );
  } catch {
    // A browser that cannot animate this (or does not know the easing): the pip just appears.
  }
}
