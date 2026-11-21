import { Outlet } from 'react-router';
import { OfflineBanner } from '../OfflineBanner.tsx';
import { WorldLayer } from '../world/WorldLayer.tsx';
import { usePageFocus } from './page-focus.ts';
import { RouteProgress } from './RouteProgress.tsx';
import { ShellModeContext } from './shell-mode.ts';
import { UtilityCluster } from './UtilityCluster.tsx';
import { Wordmark } from './Wordmark.tsx';
import '../../styles/shell.css';

/**
 * The frame for the front door (landing, sign-in): the field, the wordmark and the display controls
 * (theme, ambient motion), and nothing to navigate with. Each page provides its own
 * `<main id="main">` so the skip link has somewhere to land, and focus goes there when the page
 * changes.
 */
export function PublicShell() {
  usePageFocus(() => document.getElementById('main'));
  return (
    <ShellModeContext.Provider value="public">
      <div className="shell" data-shell="public">
        <a className="skip-link" href="#main">
          Skip to main content
        </a>
        <WorldLayer />
        <RouteProgress />
        <header className="masthead">
          <div className="masthead__brand">
            <Wordmark mode="public" />
          </div>
          <UtilityCluster variant="display" />
        </header>
        <div className="shell__stage">
          <OfflineBanner />
          <Outlet />
        </div>
      </div>
    </ShellModeContext.Provider>
  );
}
