import { act, render } from '@testing-library/react';
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouteProgress } from './RouteProgress.tsx';

const after = (ms: number) => () =>
  new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), ms);
  });

function mount(delayMs?: number) {
  const router = createMemoryRouter([
    {
      path: '/',
      element: (
        <>
          <RouteProgress delayMs={delayMs} />
          <Outlet />
        </>
      ),
      children: [
        { index: true, element: <p>Start</p> },
        { path: 'quick', loader: after(50), element: <p>Quick</p> },
        { path: 'slow', loader: after(700), element: <p>Slow</p> },
      ],
    },
  ]);
  const view = render(<RouterProvider router={router} />);
  const bar = () => view.container.querySelector('.route-progress') as HTMLElement;
  return { router, bar };
}

const advance = (ms: number) => act(async () => vi.advanceTimersByTimeAsync(ms));
const go = (router: ReturnType<typeof mount>['router'], path: string) =>
  act(async () => {
    void router.navigate(path);
  });

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('route progress', () => {
  it('is an idle, hidden hairline while nothing is loading', () => {
    const { bar } = mount();
    expect(bar()).toHaveAttribute('data-state', 'idle');
    expect(bar()).toHaveAttribute('aria-hidden', 'true');
  });

  it('never shows for a navigation that is over before the delay', async () => {
    const { router, bar } = mount();
    await go(router, '/quick');
    await advance(60);
    expect(router.state.location.pathname).toBe('/quick');
    expect(bar()).toHaveAttribute('data-state', 'idle');
    await advance(1000);
    expect(bar()).toHaveAttribute('data-state', 'idle');
  });

  it('shows for a slow one, completes when the page arrives, and goes away', async () => {
    const { router, bar } = mount();
    await go(router, '/slow');
    await advance(100);
    // Still inside the delay: nothing to report yet.
    expect(bar()).toHaveAttribute('data-state', 'idle');
    await advance(150);
    expect(bar()).toHaveAttribute('data-state', 'loading');
    await advance(500);
    expect(router.state.location.pathname).toBe('/slow');
    expect(bar()).toHaveAttribute('data-state', 'done');
    await advance(600);
    expect(bar()).toHaveAttribute('data-state', 'idle');
  });

  it('waits as long as it is told to before it shows', async () => {
    const { router, bar } = mount(500);
    await go(router, '/slow');
    await advance(300);
    expect(bar()).toHaveAttribute('data-state', 'idle');
    await advance(250);
    expect(bar()).toHaveAttribute('data-state', 'loading');
  });
});
