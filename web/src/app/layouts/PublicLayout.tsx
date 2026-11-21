import { Outlet } from 'react-router';
import { Footer } from '../shell/Footer.tsx';
import { PublicHeader } from '../shell/PublicHeader.tsx';
import { OfflineNotice, SkipLink } from '../shell/Shell.tsx';
import '../shell/shell.css';

/** The public pages: header, main, footer. */
export function PublicLayout() {
  return (
    <>
      <SkipLink />
      <PublicHeader />
      <OfflineNotice />
      <main id="main" tabIndex={-1} className="ff-main">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
