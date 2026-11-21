import { Outlet } from 'react-router';
import { SectionProvider } from '../section.tsx';
import { AppHeader } from '../shell/AppHeader.tsx';
import { Footer } from '../shell/Footer.tsx';
import { OfflineNotice, SkipLink } from '../shell/Shell.tsx';
import '../shell/shell.css';

/** The scenario pages and the report: the app header, main and a slim footer. */
export function AppLayout() {
  return (
    <SectionProvider>
      <SkipLink />
      <AppHeader />
      <OfflineNotice />
      <main id="main" tabIndex={-1} className="ff-main">
        <Outlet />
      </main>
      <Footer slim />
    </SectionProvider>
  );
}
