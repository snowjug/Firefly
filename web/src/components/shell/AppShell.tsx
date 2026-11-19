import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useMatch } from 'react-router';
import { useOnDemand } from '../../lib/onDemand.ts';
import { useTheme } from '../../lib/theme.tsx';
import { useTourRequests } from '../../lib/tour.ts';
import { Dialog } from '../Dialog.tsx';
import { Icon } from '../Icon.tsx';
import { OfflineBanner } from '../OfflineBanner.tsx';
import { ProviderBadge } from '../ProviderBadge.tsx';
import { BrandMark } from './BrandMark.tsx';
import { NotificationsMenu } from './NotificationsMenu.tsx';
import { ProfileMenu } from './ProfileMenu.tsx';
import { SidebarBrand, SidebarNav } from './SidebarNav.tsx';
import { TopbarSearch } from './TopbarSearch.tsx';

// The tour (and the examples inside it) is only needed if someone asks for it, so it is not part of
// the first download.
const loadTour = () => import('../tour/FirstRunTour.tsx');

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const next = resolvedTheme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className="btn btn-ghost btn-icon"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
    >
      <Icon name={resolvedTheme === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
}

/**
 * The signed-in frame: a navy sidebar on wide screens (a drawer on small ones), a top bar with
 * search, notices and the account menu, and the page. A live call hides the top bar and the footer
 * and shrinks the sidebar to icons, so the conversation gets the room.
 */
export function AppShell() {
  const location = useLocation();
  const onCall = Boolean(useMatch('/calls/:id'));
  const mainRef = useRef<HTMLElement>(null);
  const first = useRef(true);
  const [menuOpen, setMenuOpen] = useState(false);

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

  // Move focus to the page content when the route changes so keyboard and screen-reader users start at the top.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="app" data-compact={onCall ? 'true' : undefined}>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>

      <aside className="sidebar" aria-label="Firefly">
        <SidebarBrand />
        <SidebarNav />
      </aside>

      <div className="app-main">
        {onCall ? null : (
          <header className="topbar">
            <button
              type="button"
              className="btn btn-ghost btn-icon menu-button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
            >
              <Icon name="menu" />
            </button>
            <Link to="/home" className="brand topbar-brand" aria-label="Firefly home">
              <BrandMark size={30} />
              <span>Firefly</span>
            </Link>
            <TopbarSearch />
            <div className="topbar-end">
              <span className="hide-sm">
                <ProviderBadge compact />
              </span>
              <ThemeToggle />
              <NotificationsMenu />
              <ProfileMenu />
            </div>
          </header>
        )}

        <main id="main" tabIndex={-1} ref={mainRef} style={{ display: 'contents' }}>
          {/* The call fills the screen and already explains a failed send where it happens. */}
          {onCall ? null : <OfflineBanner />}
          <Outlet />
        </main>

        {onCall ? null : (
          <footer className="footer">
            <div className="footer-inner">
              <span>
                Firefly is a training aid. Scenarios are fictional; never enter real customer
                information. Scores are for practice, not performance reviews.
              </span>
              <span className="cluster" style={{ ['--cluster-gap' as string]: 'var(--sp-4)' }}>
                <Link to="/help">Responsible AI</Link>
                <Link to="/settings">Settings</Link>
              </span>
            </div>
          </footer>
        )}
      </div>

      {FirstRunTour ? <FirstRunTour open={tourOpen} onClose={() => setTourOpen(false)} /> : null}

      <Dialog open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu" variant="drawer">
        <SidebarBrand onNavigate={() => setMenuOpen(false)} />
        <SidebarNav onNavigate={() => setMenuOpen(false)} />
        <div style={{ marginTop: 'var(--sp-4)' }}>
          <ProviderBadge />
        </div>
      </Dialog>
    </div>
  );
}
