import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pageFor, preloadPage } from './App.tsx';

const ADDRESSES = [
  '/',
  '/sign-in',
  '/home',
  '/practice',
  '/scenarios',
  '/calls/call-1',
  '/sessions/session-1/report',
  '/sessions/session-1/transcript',
  '/history',
  '/rewards',
  '/progress',
  '/calibration',
  '/trainer',
  '/help',
  '/settings',
];

describe('pageFor', () => {
  it('finds a page for every address the app serves, each its own, whatever the id', () => {
    const pages = ADDRESSES.map((address) => pageFor(address));
    expect(pages.every((page) => page !== null)).toBe(true);
    // The setup page serves two addresses (the generic one and one for a chosen scenario).
    expect(new Set(pages).size).toBe(ADDRESSES.length);
    expect(pageFor('/scenarios/another-one/setup')).toBe(
      pageFor('/scenarios/team-workspace/setup'),
    );
    expect(pageFor('/scenarios/team-workspace/setup')).toBe(pageFor('/practice'));
  });

  it('finds nothing to fetch for an address that is not a page or only redirects', () => {
    expect(pageFor('/nowhere')).toBeNull();
    expect(pageFor('/scenarios/team-workspace')).toBeNull();
    expect(pageFor('/about')).toBeNull();
    expect(pageFor('/scenarios/team-workspace/brief')).toBeNull();
  });
});

describe('preloadPage', () => {
  it('fetches the page and settles, and settles at once when there is nothing to fetch', async () => {
    await expect(preloadPage('/help')).resolves.toBeUndefined();
    await expect(preloadPage('/nowhere')).resolves.toBeUndefined();
  });
});

describe('route transitions', () => {
  afterEach(() => {
    Reflect.deleteProperty(document, 'startViewTransition');
  });

  // React Router's declarative <Routes> accepts the viewTransition option and silently ignores it
  // (measured in a real browser: zero calls), so the app is built on a data router. This pins that.
  it('starts a view transition for a link that asks for one', async () => {
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
    const router = createMemoryRouter([
      {
        path: '/',
        element: (
          <Link to="/next" viewTransition>
            Go
          </Link>
        ),
      },
      { path: '/next', element: <p>Arrived</p> },
    ]);
    render(<RouterProvider router={router} />);
    await userEvent.setup().click(screen.getByRole('link', { name: 'Go' }));
    expect(await screen.findByText('Arrived')).toBeInTheDocument();
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('navigates normally when the browser cannot do view transitions', async () => {
    const router = createMemoryRouter([
      {
        path: '/',
        element: (
          <Link to="/next" viewTransition>
            Go
          </Link>
        ),
      },
      { path: '/next', element: <p>Arrived</p> },
    ]);
    render(<RouterProvider router={router} />);
    await userEvent.setup().click(screen.getByRole('link', { name: 'Go' }));
    expect(await screen.findByText('Arrived')).toBeInTheDocument();
  });
});
