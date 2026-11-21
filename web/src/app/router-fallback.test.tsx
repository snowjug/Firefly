import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from './test-kit.tsx';

// The first page's code is held back until the test lets it go, to see what is shown meanwhile.
const gate = vi.hoisted(() => {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { wait, release };
});

vi.mock('../pages/Landing.tsx', async () => {
  await gate.wait;
  return { default: () => <h1>Landing page</h1> };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the first page', () => {
  it('shows a labelled spinner until its code has arrived, then the page', async () => {
    renderApp('/');
    expect(screen.getByRole('progressbar', { name: 'Loading Firefly' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    gate.release();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Landing page' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('progressbar', { name: 'Loading Firefly' })).not.toBeInTheDocument();
  });
});
