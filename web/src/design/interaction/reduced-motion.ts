const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * True when the person has asked for less motion. For script that decides, at the moment it is about
 * to move something, whether to: a stylesheet uses the media query itself. Read it when needed, not
 * at module load, because the setting can change while the page is open.
 */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(QUERY).matches
    : false;
}
