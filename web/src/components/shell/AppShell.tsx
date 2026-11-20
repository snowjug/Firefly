import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useMatch } from 'react-router';
import { useOnDemand } from '../../lib/onDemand.ts';
import { useTourRequests } from '../../lib/tour.ts';
import { OfflineBanner } from '../OfflineBanner.tsx';
import { ProviderBadge } from '../ProviderBadge.tsx';
import { WorldLayer } from '../world/WorldLayer.tsx';
import { CommandDock } from './CommandDock.tsx';
import { Colophon } from './Colophon.tsx';
import { usePaletteShortcut } from './palette-shortcut.ts';
import { RouteProgress } from './RouteProgress.tsx';
import { ShellModeContext, type ShellMode } from './shell-mode.ts';
import { UtilityCluster } from './UtilityCluster.tsx';
import { Wordmark } from './Wordmark.tsx';
import '../../styles/shell.css';

// The tour (and the examples inside it) and the palette are only needed if someone asks for them,
// so neither is part of the first download.
const loadTour = () => import('../tour/FirstRunTour.tsx');
const loadPalette = () => import('./Palette.tsx');

/** True once the page has moved off the top, when the masthead needs a soft backing. */
function useScrolledAway(): boolean {
  const [away, setAway] = useState(() => window.scrollY > 8);
  useEffect(() => {
    const update = () => setAway(window.scrollY > 8);
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  return away;
}

/**
 * The signed-in frame. There is no sidebar and no top bar: a persistent field behind everything, the
 * wordmark and a small utility cluster in the corners, the page, a quiet colophon at its foot and
 * the command dock along the bottom edge. A live call steps the frame out of the way: no dock, no
 * utilities, no colophon and no connection banner (the call explains a failed send where it
 * happens), leaving the call the whole screen.
 */
export function AppShell() {
  const location = useLocation();
  const onCall = Boolean(useMatch('/calls/:id'));
  const mode: ShellMode = onCall ? 'call' : 'app';
  const mainRef = useRef<HTMLElement>(null);
  const settledPath = useRef(location.pathname);
  const scrolledAway = useScrolledAway();

  // The tour opens only when someone asks for it (from the home page or Settings), never by itself.
  const tourRequests = useTourRequests();
  const [seenRequests, setSeenRequests] = useState(tourRequests);
  const [tourOpen, setTourOpen] = useState(false);
  // Once asked for, the tour stays mounted (closed) so reopening it is instant.
  const [tourAsked, setTourAsked] = useState(false);
  const tourCode = useOnDemand(loadTour, tourAsked);
  const FirstRunTour = tourCode.module?.FirstRunTour;
  if (seenRequests !== tourRequests) {
    setSeenRequests(tourRequests);
    setTourOpen(true);
    setTourAsked(true);
  }
  // If the tour's code cannot be loaded, forget the request so that asking again tries again.
  if (tourCode.failed && tourAsked) {
    setTourAsked(false);
    setTourOpen(false);
  }

  // Search and commands: Ctrl or Cmd+K anywhere, or the button in the utility cluster. The code
  // arrives on first use (and is fetched quietly once the page is idle, so first use is instant).
  const [paletteOpen, setPaletteOpen] = useState(false);
  const paletteCode = useOnDemand(loadPalette, paletteOpen);
  const PaletteDialog = paletteCode.module?.Palette;
  if (paletteCode.failed && paletteOpen) setPaletteOpen(false);
  usePaletteShortcut(() => setPaletteOpen((open) => !open));
  useEffect(() => {
    const warm = () => void loadPalette().catch(() => undefined);
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(warm, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(warm, 2500);
    return () => window.clearTimeout(id);
  }, []);

  // Move focus to the page content when the route changes so keyboard and screen-reader users start
  // at the top. Compared by address (not "is this the first run") so that React's double run of
  // effects in development cannot move focus on load.
  useEffect(() => {
    if (settledPath.current === location.pathname) return;
    settledPath.current = location.pathname;
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const Masthead = onCall ? 'div' : 'header';
  return (
    <ShellModeContext.Provider value={mode}>
      <div className="shell" data-shell={mode} data-call={onCall ? 'true' : undefined}>
        <a className="skip-link" href="#main">
          Skip to main content
        </a>
        <WorldLayer />
        <RouteProgress />

        <Masthead className="masthead" data-scrolled={scrolledAway ? 'true' : undefined}>
          <div className="masthead__brand">
            <Wordmark mode={mode} />
            {onCall ? null : (
              <span className="masthead__provider">
                <ProviderBadge compact />
              </span>
            )}
          </div>
          {onCall ? null : <UtilityCluster onOpenPalette={() => setPaletteOpen(true)} />}
        </Masthead>

        <div className="shell__stage">
          {/* The call fills the screen and already explains a failed send where it happens. */}
          {onCall ? null : <OfflineBanner />}
          <main id="main" tabIndex={-1} ref={mainRef} className="shell__main">
            <Outlet />
          </main>
          {onCall ? null : <Colophon />}
        </div>

        {/* Last in the order because it is last on the screen: focus follows the page. The skip link
            and the palette (Ctrl+K) are the quick ways past or around it. */}
        {onCall ? null : <CommandDock />}
        {PaletteDialog && paletteOpen ? (
          <PaletteDialog onClose={() => setPaletteOpen(false)} />
        ) : null}
        {FirstRunTour ? <FirstRunTour open={tourOpen} onClose={() => setTourOpen(false)} /> : null}
      </div>
    </ShellModeContext.Provider>
  );
}
