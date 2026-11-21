import { render } from '@testing-library/react';
import { StrictMode } from 'react';
import { createMemoryRouter, RouterProvider, useLocation, type RouteObject } from 'react-router';
import { vi } from 'vitest';
import type { BadgeDTO, RewardsDTO, SessionSummaryDTO } from '#shared/domain/api.ts';
import { AmbientProvider } from '../../lib/motion/ambient.tsx';
import { ThemeProvider } from '../../lib/theme.tsx';
import { AppShell } from './AppShell.tsx';
import { PublicShell } from './PublicShell.tsx';

// Shared by the shell's tests: the frame inside a real (in-memory) data router, the way the app
// mounts it, with a few pages to move between.

export function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
}

/** jsdom has no view transitions. This gives it one that runs the update at once, and a spy on it. */
export function stubViewTransitions() {
  const start = vi.fn((update: () => void) => {
    update();
    return {
      finished: Promise.resolve(),
      ready: Promise.resolve(),
      updateCallbackDone: Promise.resolve(),
      skipTransition: () => undefined,
    };
  });
  Object.defineProperty(document, 'startViewTransition', { configurable: true, value: start });
  return start;
}

export function removeViewTransitionStub() {
  Reflect.deleteProperty(document, 'startViewTransition');
}

export const pages: RouteObject[] = [
  { path: 'home', element: <h1>Home page</h1> },
  { path: 'calls/:id', element: <h1>Call page</h1> },
  { path: 'sessions/:id/report', element: <h1>Report page</h1> },
  { path: 'scenarios', element: <Where /> },
  { path: 'scenarios/:id/setup', element: <Where /> },
  { path: 'settings', element: <h1>Settings page</h1> },
  { path: 'help', element: <h1>Help page</h1> },
  { path: 'history', element: <h1>History page</h1> },
  {
    path: 'modal',
    element: <div role="dialog" aria-modal="true" aria-label="Another dialog" />,
  },
  {
    path: 'typing',
    element: (
      <>
        <label>
          Reply
          <textarea />
        </label>
        <label>
          Search here
          <input type="search" data-allow-palette="" />
        </label>
        <label>
          Agree
          <input type="checkbox" />
        </label>
      </>
    ),
  },
];

export function renderShell(
  path = '/home',
  extra: RouteObject[] = [],
  { strict = false }: { strict?: boolean } = {},
) {
  const router = createMemoryRouter(
    [
      { element: <AppShell />, children: [...pages, ...extra] },
      {
        element: <PublicShell />,
        children: [
          {
            path: '/',
            element: (
              <main id="main">
                <h1>Landing page</h1>
              </main>
            ),
          },
          {
            path: 'sign-in',
            element: (
              <main id="main">
                <h1>Sign in page</h1>
              </main>
            ),
          },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  const app = (
    <ThemeProvider>
      <AmbientProvider>
        <RouterProvider router={router} />
      </AmbientProvider>
    </ThemeProvider>
  );
  const view = render(strict ? <StrictMode>{app}</StrictMode> : app);
  return { router, ...view };
}

export function badge(overrides: Partial<BadgeDTO> = {}): BadgeDTO {
  return {
    id: 'scope-detective',
    title: 'Scope Detective',
    criteria: 'Uncover hidden facts in three different calls.',
    earned: false,
    earnedAt: null,
    earnedInSessionId: null,
    progress: { current: 1, target: 3, unit: 'calls' },
    ...overrides,
  };
}

export function rewardsWith(badges: BadgeDTO[]): RewardsDTO {
  return { badges } as RewardsDTO;
}

export function session(overrides: Partial<SessionSummaryDTO> = {}): SessionSummaryDTO {
  return {
    id: 's1',
    scenarioId: 'team-workspace',
    scenarioTitle: 'Team cannot open the workspace',
    issueType: 'sign-in-access',
    difficulty: 'starter',
    startingTemperature: 'calm',
    impact: 'low',
    style: 'talkative',
    mode: 'guided',
    providerKind: 'mock',
    providerLabel: 'Demo mode',
    isSample: false,
    status: 'completed',
    startedAt: '2026-03-01T09:00:00.000Z',
    endedAt: '2026-03-01T09:10:00.000Z',
    durationSeconds: 600,
    traineeTurns: 6,
    completion: 'completed',
    overallScore: 3.2,
    dimensionScores: null,
    mentorReviewed: false,
    ...overrides,
  };
}
