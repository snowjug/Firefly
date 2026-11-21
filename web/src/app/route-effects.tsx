import { useEffect, useRef } from 'react';
import { ScrollRestoration, useLocation } from 'react-router';

const FOCUSABLE = 'a[href], button, input, select, textarea, summary, [tabindex]';

function focusMain() {
  document.getElementById('main')?.focus({ preventScroll: true });
}

/** Moves focus to the element a link's #fragment names, so the next thing read is its heading. */
function focusHashTarget(hash: string): boolean {
  let id: string;
  try {
    id = decodeURIComponent(hash.slice(1));
  } catch {
    return false;
  }
  const target = id ? document.getElementById(id) : null;
  if (!target) return false;
  if (!target.matches(FOCUSABLE)) target.setAttribute('tabindex', '-1');
  target.setAttribute('data-route-target', '');
  target.focus({ preventScroll: true });
  return true;
}

/**
 * After a client-side navigation, puts keyboard and screen-reader focus where the reader asked to
 * be: on the section a #fragment link names, or else, for a new address, on the page's `main`, so a
 * screen reader starts at the top. It leaves the first load alone (the browser starts at the top of
 * the document), and a change to the query string alone (a filter must not steal focus).
 *
 * Locations are compared by key, not by "is this the first run", so React's second run of effects in
 * development cannot move focus on load.
 */
export function useRouteFocus() {
  const location = useLocation();
  const previous = useRef(location);
  useEffect(() => {
    const before = previous.current;
    previous.current = location;
    if (before.key === location.key) return;
    const newPage = before.pathname !== location.pathname;
    const wantsSection =
      location.hash !== '' &&
      (newPage || before.hash !== location.hash || before.search === location.search);
    if (wantsSection && focusHashTarget(location.hash)) return;
    if (newPage) focusMain();
  }, [location]);
}

/**
 * Scroll and focus after every navigation: to the top of a new page, to the section a #fragment
 * names, and back to where you were on Back and Forward (React Router's ScrollRestoration); then
 * focus as above.
 */
export function RouteEffects() {
  useRouteFocus();
  return <ScrollRestoration />;
}
