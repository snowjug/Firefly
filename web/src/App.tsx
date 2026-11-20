import type { ComponentType } from 'react';
import {
  createBrowserRouter,
  createMemoryRouter,
  matchRoutes,
  Navigate,
  RouterProvider,
  useParams,
  type RouteObject,
} from 'react-router';
import { NotFound, LoadingCards, Page } from './components/Page.tsx';
import { AppShell } from './components/shell/AppShell.tsx';
import { PublicShell } from './components/shell/PublicShell.tsx';

/** Set on every page's route, so the page for an address can be fetched before it is rendered. */
interface PageHandle {
  load: () => Promise<unknown>;
}

// Every page is its own chunk, loaded on demand, so the first screen stays small. The router (not
// React.lazy) loads a page's code: it waits for the code before it commits a navigation, which is
// what lets a view transition start with the next page already in hand instead of flashing a
// placeholder in the middle of the move.
function lazyPage(
  load: () => Promise<{ default: ComponentType }>,
): Pick<RouteObject, 'lazy' | 'handle'> {
  const handle: PageHandle = { load };
  return { lazy: async () => ({ Component: (await load()).default }), handle };
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

export const appRoutes: RouteObject[] = [
  {
    // Shown only while the first page's code is still arriving.
    HydrateFallback: Loading,
    children: [
      {
        Component: PublicShell,
        children: [
          { index: true, ...landing },
          { path: 'sign-in', ...signIn },
        ],
      },
      {
        Component: AppShell,
        children: [
          { path: 'home', ...dashboard },
          { path: 'practice', ...setup },
          { path: 'scenarios', ...library },
          { path: 'scenarios/:id/setup', ...setup },
          { path: 'scenarios/:id/brief', Component: BriefRedirect },
          { path: 'calls/:id', ...call },
          { path: 'sessions/:id/report', ...report },
          { path: 'sessions/:id/transcript', ...transcript },
          { path: 'history', ...history },
          { path: 'rewards', ...rewards },
          { path: 'progress', ...progress },
          { path: 'calibration', ...calibration },
          { path: 'trainer', ...trainer },
          { path: 'help', ...help },
          { path: 'about', element: <Navigate to="/help" replace /> },
          { path: 'settings', ...settings },
          { path: '*', Component: NotFound },
        ],
      },
    ],
  },
];

/** The page that renders an address, or null if there is none (the not-found page is not lazy). */
export function pageFor(pathname: string): PageHandle | null {
  const matches = matchRoutes(appRoutes, pathname);
  const handle = matches?.at(-1)?.route.handle as Partial<PageHandle> | undefined;
  return handle?.load ? (handle as PageHandle) : null;
}

/**
 * Fetches the page for an address ahead of the first render, so the first paint is the real page
 * and not a placeholder. A page that cannot be fetched is left for the router to report.
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

/**
 * A data router is what makes `<Link viewTransition>` and `navigate(..., { viewTransition: true })`
 * actually start a view transition: React Router's declarative `<Routes>` accepts the option and
 * ignores it. Pass entries to get an in-memory router (tests), or none for the browser's history.
 */
export type AppRouter = ReturnType<typeof createBrowserRouter>;
export function createAppRouter(entries?: string[]): AppRouter {
  return entries
    ? createMemoryRouter(appRoutes, { initialEntries: entries })
    : createBrowserRouter(appRoutes);
}

export function App({ router }: { router: AppRouter }) {
  return <RouterProvider router={router} />;
}
