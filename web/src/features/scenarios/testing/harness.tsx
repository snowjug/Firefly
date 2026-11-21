import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { RouterProvider, createMemoryRouter, useLocation } from 'react-router';
import { vi } from 'vitest';
import { AnnouncerProvider } from '../../../design/index.ts';
import { ApiError, api } from '../../../lib/api.ts';
import { ConfigProvider } from '../../../lib/config.tsx';
import { CallBrief } from '../CallBrief.tsx';
import { ScenarioWorkspace } from '../ScenarioWorkspace.tsx';
import { appConfig, publicScenarios } from './fixtures.ts';

// Shared setup for the component tests. The test file mocks `lib/api.ts` (so `api` here is the
// mock), and this file gives each test the same fixture scenarios, a router with stand-ins for the
// pages the screens link to, and a way to pretend the window is wide or narrow.

/** Pretends the window is wide (the list and the details side by side) or narrow (list, then details). */
export function stubViewport(wide: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('min-width: 64em') ? wide : false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }));
}

export function stubOnline(online: boolean): void {
  vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(online);
}

export function notFound(): ApiError {
  return new ApiError(404, 'not_found', 'That scenario could not be found.', false);
}

export function networkError(): ApiError {
  return new ApiError(0, 'network', "Can't reach Firefly right now.", true);
}

export interface ApiSetup {
  config?: ReturnType<typeof appConfig>;
}

/** The API as it normally answers: the fixture scenarios and a demo-mode server. */
export function mockApi(setup: ApiSetup = {}): void {
  const scenarios = publicScenarios();
  vi.mocked(api.scenarios).mockResolvedValue(scenarios);
  vi.mocked(api.scenario).mockImplementation(async (id: string) => {
    const found = scenarios.find((scenario) => scenario.id === id);
    if (!found) throw notFound();
    return found;
  });
  vi.mocked(api.config).mockResolvedValue(setup.config ?? appConfig());
}

/** A page the screens link to: it says where it is, so a test can see where a link led. */
function Stand({ name }: { name: string }): ReactNode {
  const location = useLocation();
  return (
    <main>
      <h1>{name}</h1>
      <p data-testid="where">{`${location.pathname}${location.search}`}</p>
    </main>
  );
}

export interface RenderOptions {
  /** Makes the router slow to commit a navigation (in milliseconds), as it is for a few frames in a browser. */
  slowNavigation?: number;
}

export function renderApp(path: string, options: RenderOptions = {}) {
  const router = createMemoryRouter(
    [
      { path: '/scenarios', element: <ScenarioWorkspace /> },
      { path: '/scenarios/:id/brief', element: <CallBrief /> },
      { path: '/calls/:id', element: <Stand name="Call page" /> },
      { path: '/sessions/:id/report', element: <Stand name="Report page" /> },
      { path: '/responsible-ai', element: <Stand name="Responsible AI page" /> },
    ],
    { initialEntries: [path] },
  );
  if (options.slowNavigation) {
    const delay = options.slowNavigation;
    const navigate = router.navigate.bind(router) as (...args: unknown[]) => Promise<void>;
    router.navigate = ((...args: unknown[]) =>
      new Promise<void>((resolve) => {
        setTimeout(() => resolve(navigate(...args)), delay);
      })) as unknown as typeof router.navigate;
  }
  const view = render(
    <ConfigProvider>
      <AnnouncerProvider>
        <RouterProvider router={router} />
      </AnnouncerProvider>
    </ConfigProvider>,
  );
  const where = () => `${router.state.location.pathname}${router.state.location.search}`;
  const query = () => new URLSearchParams(router.state.location.search);
  return { ...view, router, where, query };
}
