import { lazy, Suspense, type ComponentType } from 'react';
import { createRoutesFromElements, matchRoutes, Route, Routes } from 'react-router';
import { NotFound, LoadingCards, Page } from './components/Page.tsx';
import { Shell } from './components/Shell.tsx';

/** Set on every page's route, so the page for an address can be fetched before it is rendered. */
interface PageHandle {
  load: () => Promise<unknown>;
}

// Every page is its own chunk, loaded on demand, so the first screen stays small.
function lazyPage(load: () => Promise<{ default: ComponentType }>) {
  const handle: PageHandle = { load };
  return { Component: lazy(load), handle };
}

const dashboard = lazyPage(() => import('./pages/Dashboard.tsx'));
const library = lazyPage(() => import('./pages/Library.tsx'));
const setup = lazyPage(() => import('./pages/Setup.tsx'));
const brief = lazyPage(() => import('./pages/Brief.tsx'));
const call = lazyPage(() => import('./pages/Call.tsx'));
const report = lazyPage(() => import('./pages/Report.tsx'));
const transcript = lazyPage(() => import('./pages/Transcript.tsx'));
const history = lazyPage(() => import('./pages/History.tsx'));
const progress = lazyPage(() => import('./pages/Progress.tsx'));
const calibration = lazyPage(() => import('./pages/Calibration.tsx'));
const trainer = lazyPage(() => import('./pages/Trainer.tsx'));
const about = lazyPage(() => import('./pages/About.tsx'));
const settings = lazyPage(() => import('./pages/Settings.tsx'));

function Loading() {
  return (
    <Page title="Loading">
      <LoadingCards count={3} />
    </Page>
  );
}

const routes = (
  <Route element={<Shell />}>
    <Route index element={<dashboard.Component />} handle={dashboard.handle} />
    <Route path="scenarios" element={<library.Component />} handle={library.handle} />
    <Route path="scenarios/:id/setup" element={<setup.Component />} handle={setup.handle} />
    <Route path="scenarios/:id/brief" element={<brief.Component />} handle={brief.handle} />
    <Route path="calls/:id" element={<call.Component />} handle={call.handle} />
    <Route path="sessions/:id/report" element={<report.Component />} handle={report.handle} />
    <Route
      path="sessions/:id/transcript"
      element={<transcript.Component />}
      handle={transcript.handle}
    />
    <Route path="history" element={<history.Component />} handle={history.handle} />
    <Route path="progress" element={<progress.Component />} handle={progress.handle} />
    <Route path="calibration" element={<calibration.Component />} handle={calibration.handle} />
    <Route path="trainer" element={<trainer.Component />} handle={trainer.handle} />
    <Route path="about" element={<about.Component />} handle={about.handle} />
    <Route path="settings" element={<settings.Component />} handle={settings.handle} />
    <Route path="*" element={<NotFound />} />
  </Route>
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
