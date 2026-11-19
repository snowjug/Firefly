import { lazy, Suspense, type ComponentType } from 'react';
import {
  createRoutesFromElements,
  matchRoutes,
  Navigate,
  Route,
  Routes,
  useParams,
} from 'react-router';
import { NotFound, LoadingCards, Page } from './components/Page.tsx';
import { AppShell } from './components/shell/AppShell.tsx';
import { PublicShell } from './components/shell/PublicShell.tsx';

/** Set on every page's route, so the page for an address can be fetched before it is rendered. */
interface PageHandle {
  load: () => Promise<unknown>;
}

// Every page is its own chunk, loaded on demand, so the first screen stays small.
function lazyPage(load: () => Promise<{ default: ComponentType }>) {
  const handle: PageHandle = { load };
  return { Component: lazy(load), handle };
}

const landing = lazyPage(() => import('./pages/Landing.tsx'));
const signIn = lazyPage(() => import('./pages/SignIn.tsx'));
const dashboard = lazyPage(() => import('./pages/Dashboard.tsx'));
const library = lazyPage(() => import('./pages/Library.tsx'));
const setup = lazyPage(() => import('./pages/Setup.tsx'));
const call = lazyPage(() => import('./pages/Call.tsx'));
const report = lazyPage(() => import('./pages/Report.tsx'));
const transcript = lazyPage(() => import('./pages/Transcript.tsx'));
const history = lazyPage(() => import('./pages/History.tsx'));
const rewards = lazyPage(() => import('./pages/Rewards.tsx'));
const progress = lazyPage(() => import('./pages/Progress.tsx'));
const calibration = lazyPage(() => import('./pages/Calibration.tsx'));
const trainer = lazyPage(() => import('./pages/Trainer.tsx'));
const help = lazyPage(() => import('./pages/About.tsx'));
const settings = lazyPage(() => import('./pages/Settings.tsx'));

function Loading() {
  return (
    <Page title="Loading">
      <LoadingCards count={3} />
    </Page>
  );
}

/** Older links to the pre-call brief land on the page where the call is configured and started. */
function BriefRedirect() {
  const { id = '' } = useParams();
  return <Navigate to={`/scenarios/${encodeURIComponent(id)}/setup`} replace />;
}

const routes = (
  <>
    <Route element={<PublicShell />}>
      <Route index element={<landing.Component />} handle={landing.handle} />
      <Route path="sign-in" element={<signIn.Component />} handle={signIn.handle} />
    </Route>
    <Route element={<AppShell />}>
      <Route path="home" element={<dashboard.Component />} handle={dashboard.handle} />
      <Route path="practice" element={<setup.Component />} handle={setup.handle} />
      <Route path="scenarios" element={<library.Component />} handle={library.handle} />
      <Route path="scenarios/:id/setup" element={<setup.Component />} handle={setup.handle} />
      <Route path="scenarios/:id/brief" element={<BriefRedirect />} />
      <Route path="calls/:id" element={<call.Component />} handle={call.handle} />
      <Route path="sessions/:id/report" element={<report.Component />} handle={report.handle} />
      <Route
        path="sessions/:id/transcript"
        element={<transcript.Component />}
        handle={transcript.handle}
      />
      <Route path="history" element={<history.Component />} handle={history.handle} />
      <Route path="rewards" element={<rewards.Component />} handle={rewards.handle} />
      <Route path="progress" element={<progress.Component />} handle={progress.handle} />
      <Route path="calibration" element={<calibration.Component />} handle={calibration.handle} />
      <Route path="trainer" element={<trainer.Component />} handle={trainer.handle} />
      <Route path="help" element={<help.Component />} handle={help.handle} />
      <Route path="about" element={<Navigate to="/help" replace />} />
      <Route path="settings" element={<settings.Component />} handle={settings.handle} />
      <Route path="*" element={<NotFound />} />
    </Route>
  </>
);
const routeTable = createRoutesFromElements(routes);

/** The page that renders an address, or null if there is none (the not-found page is not lazy). */
export function pageFor(pathname: string): PageHandle | null {
  const matches = matchRoutes(routeTable, pathname);
  const handle = matches?.at(-1)?.route.handle as Partial<PageHandle> | undefined;
  return handle?.load ? (handle as PageHandle) : null;
}

/**
 * Fetches the page for an address ahead of the first render. React holds back the real page for
 * 300 ms after it has shown a loading placeholder, so a first render that has to wait for its page
 * is slower than one that does not. A page that cannot be fetched is left for the render to report.
 */
export function preloadPage(pathname: string): Promise<void> {
  const page = pageFor(pathname);
  return page
    ? page.load().then(
        () => undefined,
        () => undefined,
      )
    : Promise.resolve();
}

export function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>{routes}</Routes>
    </Suspense>
  );
}
