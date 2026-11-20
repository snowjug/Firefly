import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppErrorBoundary, PageError, RouteError } from './AppErrorBoundary.tsx';

const SECRET = 'TypeError: secret detail at Widget (/src/Widget.tsx:12)';

function Boom(): never {
  throw new Error(SECRET);
}

let errors: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  // React logs every error it catches; the tests throw on purpose.
  errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => errors.mockRestore());

function expectCalmScreen() {
  expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
  expect(screen.getByRole('heading', { level: 1, name: 'Something went wrong' })).toBeVisible();
  expect(screen.getByText(/Your saved practice calls are safe/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Reload' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Go to the start' })).toHaveAttribute('href', '/');
  // Nothing of the error reaches the person.
  expect(document.body).not.toHaveTextContent('secret detail');
  expect(document.body).not.toHaveTextContent(/TypeError|Widget\.tsx|at \w+ \(/);
}

describe('AppErrorBoundary', () => {
  it('shows its children while nothing is wrong', () => {
    render(
      <AppErrorBoundary>
        <p>All well</p>
      </AppErrorBoundary>,
    );
    expect(screen.getByText('All well')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says what happened and what to do when a page fails, and never shows the error', () => {
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    );
    expectCalmScreen();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
  });

  it('reloads the page when asked to', async () => {
    const reload = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { reload } });
    try {
      render(
        <AppErrorBoundary>
          <Boom />
        </AppErrorBoundary>,
      );
      await userEvent.click(screen.getByRole('button', { name: 'Reload' }));
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original });
    }
  });
});

describe('the error screen in the router', () => {
  it('replaces a failed route with the same calm screen, not the router’s own error page', () => {
    const router = createMemoryRouter([{ path: '/', Component: Boom, ErrorBoundary: RouteError }]);
    render(<RouterProvider router={router} />);
    expectCalmScreen();
    expect(screen.queryByText(/Unexpected Application Error/)).not.toBeInTheDocument();
  });

  it('can sit inside the frame, which already holds the main landmark', () => {
    function Frame() {
      return (
        <main id="main">
          <Outlet />
        </main>
      );
    }
    const router = createMemoryRouter([
      {
        path: '/',
        Component: Frame,
        children: [{ index: true, Component: Boom, ErrorBoundary: PageError }],
      },
    ]);
    render(<RouterProvider router={router} />);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expectCalmScreen();
    expect(document.querySelector('.eb__brand')).toBeNull();
  });
});
