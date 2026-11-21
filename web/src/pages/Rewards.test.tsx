import { render, screen, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PROGRESS_WITH_DATA } from '../components/progress/progress.fixtures.ts';
import { makeRewards } from '../components/rewards/rewards.fixtures.ts';
import { api } from '../lib/api.ts';
import type * as ApiModule from '../lib/api.ts';
import Progress from './Progress.tsx';
import Rewards from './Rewards.tsx';

vi.mock('../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return {
    ...actual,
    api: { progress: vi.fn(), scenarios: vi.fn(), listSessions: vi.fn(), rewards: vi.fn() },
  };
});

const scrollIntoView = vi.fn();

function renderApp(initial: string[], index = initial.length - 1) {
  const router = createMemoryRouter(
    [
      { path: '/rewards', element: <Rewards /> },
      { path: '/progress', element: <Progress /> },
      { path: '/home', element: <p>Home</p> },
    ],
    { initialEntries: initial, initialIndex: index },
  );
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  scrollIntoView.mockReset();
  Element.prototype.scrollIntoView = scrollIntoView;
  vi.mocked(api.progress).mockResolvedValue(PROGRESS_WITH_DATA);
  vi.mocked(api.scenarios).mockResolvedValue([]);
  vi.mocked(api.listSessions).mockResolvedValue({ sessions: [], total: 0 });
  vi.mocked(api.rewards).mockResolvedValue(makeRewards());
});

afterEach(() => {
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
});

describe('Rewards: an old address', () => {
  it('lands on the recognition part of Progress, and replaces itself so Back does not bounce', async () => {
    const router = renderApp(['/home', '/rewards']);
    expect(await screen.findByRole('heading', { level: 1, name: 'My progress' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/progress');
    expect(router.state.location.hash).toBe('#recognition');

    await router.navigate(-1);
    expect(router.state.location.pathname).toBe('/home');
  });

  it('takes the page to the section once both halves have arrived, and puts focus there', async () => {
    renderApp(['/rewards']);
    const section = await screen.findByRole('region', { name: 'Recognition' });
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
    expect(scrollIntoView.mock.contexts[0]).toBe(section);
    expect(section).toHaveFocus();
    expect(section).toHaveAttribute('id', 'recognition');
  });

  it('waits for the sky as well, so the section does not move after the page has scrolled to it', async () => {
    let release: (value: typeof PROGRESS_WITH_DATA) => void = () => undefined;
    vi.mocked(api.progress).mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    renderApp(['/rewards']);
    await screen.findByRole('heading', { name: 'How points work' });
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(scrollIntoView).not.toHaveBeenCalled();
    release(PROGRESS_WITH_DATA);
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
  });

  it('does not scroll anywhere for a plain visit to Progress', async () => {
    renderApp(['/progress']);
    await screen.findByRole('heading', { name: 'How points work' });
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
