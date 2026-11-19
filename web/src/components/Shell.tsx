import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useMatch } from 'react-router';
import { ProviderBadge } from './ProviderBadge.tsx';
import { Dialog } from './Dialog.tsx';
import { Icon } from './Icon.tsx';
import { useTheme } from '../lib/theme.tsx';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/scenarios', label: 'Scenarios' },
  { to: '/history', label: 'History' },
  { to: '/progress', label: 'Progress' },
  { to: '/calibration', label: 'Calibration' },
  { to: '/trainer', label: 'Trainer' },
  { to: '/about', label: 'About' },
] as const;

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

export function Shell() {
  const location = useLocation();
  const onCall = useMatch('/calls/:id');
  const mainRef = useRef<HTMLElement>(null);
  const first = useRef(true);
  const [menuOpen, setMenuOpen] = useState(false);

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
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      {onCall ? null : (
        <header className="nav glass glass-strong">
          <div className="nav-inner">
            <Link to="/" className="brand" aria-label="Firefly home">
              <span className="brand-mark" aria-hidden="true" />
              Firefly
            </Link>
            <nav className="nav-links" aria-label="Main">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={'end' in item ? item.end : false}
                  className="nav-link"
                  viewTransition
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="nav-end">
              <span className="hide-sm">
                <ProviderBadge compact />
              </span>
              <ThemeToggle />
              <button
                type="button"
                className="btn btn-ghost btn-icon menu-button"
                onClick={() => setMenuOpen(true)}
                aria-label="Open menu"
              >
                <Icon name="menu" />
              </button>
            </div>
          </div>
        </header>
      )}

      <main id="main" tabIndex={-1} ref={mainRef} style={{ display: 'contents' }}>
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
              <Link to="/about">Responsible AI</Link>
              <Link to="/settings">Settings</Link>
            </span>
          </div>
        </footer>
      )}

      <Dialog open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu" variant="sheet">
        <nav aria-label="Main" className="menu-list">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : false}
              className="nav-link"
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
          <NavLink to="/settings" className="nav-link" onClick={() => setMenuOpen(false)}>
            Settings
          </NavLink>
        </nav>
        <div style={{ marginTop: 'var(--sp-4)' }}>
          <ProviderBadge />
        </div>
      </Dialog>
    </div>
  );
}
