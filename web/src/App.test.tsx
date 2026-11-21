import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from './app/test-kit.tsx';

vi.mock('./pages/Landing.tsx', () => ({ default: () => <h1>Landing page</h1> }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('renders the router inside the providers main.tsx uses, with one polite live region', async () => {
    renderApp('/');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Landing page' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });
});
