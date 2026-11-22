import type { ComponentType } from 'react';
import { createBrowserRouter, createMemoryRouter, type RouteObject } from 'react-router';
import { Spinner } from '../design/primitives/Spinner.tsx';
import { AppLayout } from './layouts/AppLayout.tsx';
import { CallLayout } from './layouts/CallLayout.tsx';
import { PublicLayout } from './layouts/PublicLayout.tsx';
import { RootLayout } from './layouts/RootLayout.tsx';
import { PageError, RootError } from './shell/RouteError.tsx';
import type { RouteHandle } from './shell/RouteStage.tsx';

// Every page is its own chunk, fetched when the route is first visited. The router waits for the
// code before it commits the navigation, so the old page stays until the new one is ready.
function lazyPage(load: () => Promise<{ default: ComponentType }>): Pick<RouteObject, 'lazy'> {
  return { lazy: async () => ({ Component: (await load()).default }) };
}

// The landing page sequences its own entrance, so the shell's page entrance leaves it alone.
const OWN_ENTRANCE: RouteHandle = { ownEntrance: true };

/** Shown only while the first page's code is on its way. */
function AppFallback() {
  return (
    <main id="main" tabIndex={-1} className="ff-main ff-main--centred">
      <Spinner size="large" label="Loading Firefly" showLabel labelPosition="below" />
    </main>
  );
}

export const appRoutes: RouteObject[] = [
  {
    id: 'root',
    Component: RootLayout,
    HydrateFallback: AppFallback,
    // The router would otherwise print the error and its stack for whoever is looking.
    ErrorBoundary: RootError,
    children: [
      {
        id: 'public',
        Component: PublicLayout,
        children: [
          {
            // A page that fails is replaced by the error view inside the layout, so the header
            // and footer stay where they are.
            ErrorBoundary: PageError,
            children: [
              {
                index: true,
                handle: OWN_ENTRANCE,
                ...lazyPage(() => import('../pages/Landing.tsx')),
              },
              {
                path: 'responsible-ai',
                ...lazyPage(() => import('../pages/ResponsibleAi.tsx')),
              },
              { path: 'about', ...lazyPage(() => import('../pages/About.tsx')) },
              { path: '*', ...lazyPage(() => import('../pages/NotFound.tsx')) },
            ],
          },
        ],
      },
      {
        id: 'app',
        Component: AppLayout,
        children: [
          {
            ErrorBoundary: PageError,
            children: [
              { path: 'scenarios', ...lazyPage(() => import('../pages/Scenarios.tsx')) },
              { path: 'scenarios/:id/brief', ...lazyPage(() => import('../pages/Brief.tsx')) },
              { path: 'sessions/:id/report', ...lazyPage(() => import('../pages/Report.tsx')) },
            ],
          },
        ],
      },
      {
        id: 'call',
        Component: CallLayout,
        children: [
          {
            ErrorBoundary: PageError,
            children: [{ path: 'calls/:id', ...lazyPage(() => import('../pages/Call.tsx')) }],
          },
        ],
      },
    ],
  },
];

export type AppRouter = ReturnType<typeof createBrowserRouter>;

/**
 * A data router, which is what makes route `lazy`, `ErrorBoundary` and `ScrollRestoration` work.
 * Pass entries for an in-memory router (tests); pass none for the browser's history.
 */
export function createAppRouter(entries?: string[]): AppRouter {
  return entries
    ? createMemoryRouter(appRoutes, { initialEntries: entries })
    : createBrowserRouter(appRoutes);
}
