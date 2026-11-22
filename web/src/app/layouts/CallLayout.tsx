import { RouteStage } from '../shell/RouteStage.tsx';
import { SkipLink } from '../shell/Shell.tsx';
import '../shell/shell.css';

/**
 * The call page: no header, because it draws its own command bar. It keeps the skip link and the
 * `main` landmark; the announcer's live region is rendered once at the root, above the router.
 */
export function CallLayout() {
  return (
    <>
      <SkipLink />
      <main id="main" tabIndex={-1} className="ff-main">
        <RouteStage />
      </main>
    </>
  );
}
