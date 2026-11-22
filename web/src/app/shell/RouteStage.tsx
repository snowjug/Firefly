import { createContext, useContext, useState, type ReactNode } from 'react';
import { Outlet, useLocation, useMatches } from 'react-router';

/** What a route's `handle` may say about how its page arrives. */
export interface RouteHandle {
  /** The page sequences its own entrance (the landing page), so the shell adds none. */
  ownEntrance?: boolean;
}

const Navigated = createContext(false);

/**
 * Remembers whether the app has moved off the page it loaded with. The first page is simply there:
 * only a page that arrives by navigation enters. It stays true for good, so going back to the first
 * address later is a navigation like any other.
 */
export function NavigationState({ children }: { children: ReactNode }) {
  const { key } = useLocation();
  const [first] = useState(key);
  const [navigated, setNavigated] = useState(false);
  if (!navigated && key !== first) setNavigated(true);
  return <Navigated value={navigated}>{children}</Navigated>;
}

/**
 * Where a layout puts its page. Each new address is drawn into a fresh element that rises a little
 * and fades in (`ff-route-in`, in shell.css); the page it replaces goes at once, so there is never
 * a second page on screen and nothing waits. The first page, a page that sequences its own entrance,
 * a page that arrives inside a view transition (which already crossfades it) and a change to the
 * query or fragment of the same address get none, and under reduced motion the stylesheet draws no
 * animation at all.
 */
export function RouteStage() {
  const { pathname } = useLocation();
  return <Page key={pathname} />;
}

/** True while the browser is running a view transition. A browser without the pseudo-class says no. */
function inViewTransition(): boolean {
  try {
    return document.documentElement.matches(':active-view-transition');
  } catch {
    return false;
  }
}

function Page() {
  const navigated = useContext(Navigated);
  const ownEntrance = useMatches().some(
    (match) => (match.handle as RouteHandle | undefined)?.ownEntrance === true,
  );
  // Decided once, when this page is drawn. A page already on screen must never start to enter
  // because the app has navigated since (a change of query or fragment is a navigation too), and one
  // that is told to stand down must not start when the view transition ends.
  const [enters] = useState(() => navigated && !ownEntrance && !inViewTransition());
  return (
    <div className="ff-route" data-enter={enters ? '' : undefined}>
      <Outlet />
    </div>
  );
}
