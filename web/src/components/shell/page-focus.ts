import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router';

/**
 * Moves focus to the page's `main` when the address changes, so keyboard and screen-reader users
 * start at the top of the new page instead of on a body that nothing was announced for.
 *
 * Compared by address, not by "is this the first run", so that React's second run of effects in
 * development cannot move focus on load. A shell that has just mounted because a link was followed
 * (the front door to the app, say) counts as a change; one that mounts because the document has just
 * loaded, or because someone pressed Back, does not.
 */
export function usePageFocus(find: () => HTMLElement | null): void {
  const { pathname } = useLocation();
  const type = useNavigationType();
  const shown = useRef<string | null>(null);
  // `find` is a new function on every render; the early return below makes that harmless.
  useEffect(() => {
    const before = shown.current;
    shown.current = pathname;
    if (before === pathname) return;
    if (before === null && type === 'POP') return;
    find()?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [pathname, type, find]);
}
