import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { vi, type Mock } from 'vitest';
import type { SessionDTO } from '#shared/domain/api.ts';
import { AnnouncerProvider } from '../../design/index.ts';
import { SCENARIO_INDEX } from './fixtures.ts';
import type { ReportClient } from './useReportSession.ts';

// Helpers for the report's component tests: a router with the places the report links to, a
// scripted client, and stand-ins for the browser features jsdom does not have.

export interface FakeClient extends ReportClient {
  getSession: Mock<ReportClient['getSession']>;
  evaluate: Mock<ReportClient['evaluate']>;
  deleteSession: Mock<ReportClient['deleteSession']>;
  scenarios: Mock<NonNullable<ReportClient['scenarios']>>;
}

/** A client that answers with `sessions` one after another (the last one repeats). */
export function scriptedClient(...sessions: SessionDTO[]): FakeClient {
  let next = 0;
  return {
    getSession: vi.fn(() =>
      Promise.resolve(sessions[Math.min(next++, sessions.length - 1)] as SessionDTO),
    ),
    evaluate: vi.fn(() => Promise.reject(new Error('evaluate was not expected'))),
    deleteSession: vi.fn(() => Promise.resolve({ deleted: true })),
    scenarios: vi.fn(() => Promise.resolve(SCENARIO_INDEX)),
  };
}

/** A client that never answers unless told how. */
export function clientWith(parts: Partial<ReportClient>): FakeClient {
  return {
    getSession: vi.fn(() => new Promise<SessionDTO>(() => undefined)),
    evaluate: vi.fn(() => new Promise<SessionDTO>(() => undefined)),
    deleteSession: vi.fn(() => Promise.resolve({ deleted: true })),
    scenarios: vi.fn(() => Promise.resolve(SCENARIO_INDEX)),
    ...(parts as Partial<FakeClient>),
  };
}

/** Renders `element` at the report's route, with stand-in pages for everything it links to. */
export function renderAtReport(element: ReactElement) {
  const router = createMemoryRouter(
    [
      { path: '/sessions/:id/report', element },
      { path: '/calls/:id', element: <p>Call page</p> },
      { path: '/scenarios', element: <p>Scenarios page</p> },
      { path: '/scenarios/:id/brief', element: <p>Brief page</p> },
      { path: '/responsible-ai', element: <p>Responsible AI page</p> },
      { path: '/', element: <p>Home page</p> },
    ],
    { initialEntries: ['/sessions/s1/report'] },
  );
  const view = render(
    <AnnouncerProvider>
      <RouterProvider router={router} />
    </AnnouncerProvider>,
  );
  return { router, ...view };
}

/** jsdom has no media queries: answer the ones a test cares about. */
export function stubMatchMedia(matching: (query: string) => boolean) {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: matching(query),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

/** jsdom cannot scroll: record the calls instead. */
export function stubScroll() {
  const original = Element.prototype.scrollIntoView;
  const scroll = vi.fn();
  Element.prototype.scrollIntoView = scroll;
  return {
    scroll,
    restore: () => {
      Element.prototype.scrollIntoView = original;
    },
  };
}

/** Narrows a value a test relies on, failing clearly if a fixture ever changes shape. */
export function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`Expected ${what} in the fixture`);
  return value;
}

export class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  observed = new Set<Element>();
  private readonly callback: IntersectionObserverCallback;
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    FakeIntersectionObserver.instances.push(this);
  }
  observe(element: Element) {
    this.observed.add(element);
  }
  unobserve(element: Element) {
    this.observed.delete(element);
  }
  disconnect() {
    this.observed.clear();
  }
  takeRecords() {
    return [];
  }
  /** Tells the page that the element with this id has entered or left the part of the window it watches. */
  report(id: string, isIntersecting: boolean) {
    const target = [...this.observed].find((element) => element.id === id);
    if (!target) throw new Error(`Nothing observed with the id ${id}`);
    this.callback([{ target, isIntersecting } as IntersectionObserverEntry], this as never);
  }
}

export function stubIntersectionObserver() {
  const original = window.IntersectionObserver;
  FakeIntersectionObserver.instances = [];
  window.IntersectionObserver = FakeIntersectionObserver as never;
  return {
    observer: () => FakeIntersectionObserver.instances.at(-1) as FakeIntersectionObserver,
    restore: () => {
      window.IntersectionObserver = original;
    },
  };
}
