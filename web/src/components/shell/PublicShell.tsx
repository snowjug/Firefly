import { Outlet } from 'react-router';
import { OfflineBanner } from '../OfflineBanner.tsx';

/**
 * The frame for the landing and sign-in pages: no sidebar. Each page draws its own header and
 * provides its own `<main id="main">` so the skip link has somewhere to land.
 */
export function PublicShell() {
  return (
    <div className="public">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <OfflineBanner />
      <Outlet />
    </div>
  );
}
