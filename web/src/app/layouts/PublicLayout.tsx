import { Footer } from '../shell/Footer.tsx';
import { PublicHeader } from '../shell/PublicHeader.tsx';
import { RouteStage } from '../shell/RouteStage.tsx';
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
        <RouteStage />
      </main>
      <Footer />
    </>
  );
}
