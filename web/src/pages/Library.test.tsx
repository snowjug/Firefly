import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Outlet, RouterProvider, createMemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProgressDTO, PublicScenarioDTO, SessionSummaryDTO } from '#shared/domain/api.ts';
import {
  CATALOGUE,
  fullCall,
  runningCall,
  sampleCall,
  syntheticCatalogue,
} from '../components/atlas/atlas.fixtures.ts';
import { forgetScenarioLibrary } from '../components/scenario/useScenarioLibrary.ts';
import type * as ApiModule from '../lib/api.ts';
import { ApiError, api } from '../lib/api.ts';
import { resetProfileForTests } from '../lib/profile.ts';
import { ThemeProvider } from '../lib/theme.tsx';
import Library from './Library.tsx';

vi.mock('../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, api: { scenarios: vi.fn(), listSessions: vi.fn(), progress: vi.fn() } };
});

const LOCKED_OUT = 'locked-out-after-password-reset';
const ESCALATED = 'escalated-integration-failures';
const titleOf = (id: string) => CATALOGUE.find((s) => s.id === id)?.title ?? id;

const noProgress: ProgressDTO = {
  totalSessions: 0,
  completedSessions: 0,
  dimensionTrends: [],
  strongest: null,
  focus: null,
  focusReason: null,
  repeatedOpportunities: [],
  recentChange: 'not-enough-data',
  note: '',
};

function Layout() {
  const location = useLocation();
  return (
    <>
      <p data-testid="url">{`${location.pathname}${location.search}`}</p>
      <Outlet />
    </>
  );
}

// The page reads the router's navigation and view transition state, so it needs a data router.
function renderLibrary(entry = '/scenarios', loaderMs = 0) {
  const router = createMemoryRouter(
    [
      {
        element: <Layout />,
        children: [
          { path: '/scenarios', element: <Library /> },
          {
            path: '/scenarios/:id/setup',
            loader: () => new Promise((resolve) => setTimeout(() => resolve(null), loaderMs)),
            element: <p>Setup page</p>,
          },
        ],
      },
    ],
    { initialEntries: [entry] },
  );
  render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  );
  return router;
}

function setCatalogue(
  scenarios: readonly PublicScenarioDTO[],
  sessions: readonly SessionSummaryDTO[] = [],
) {
  vi.mocked(api.scenarios).mockResolvedValue([...scenarios]);
  vi.mocked(api.listSessions).mockResolvedValue({
    sessions: [...sessions],
    total: sessions.length,
  });
}

/** The window is narrow, or it is not (jsdom has no media queries of its own). */
function stubWidth(narrow: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: narrow && query.includes('max-width: 39.99rem'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
  }));
}

const heading = () => screen.findByRole('heading', { level: 1, name: /The mission field/ });
const panel = () => within(screen.getByRole('tabpanel'));
const search = () => screen.getByRole('searchbox', { name: 'Find a signal' });
const statusLine = () =>
  screen
    .getAllByRole('status')
    .map((node) => node.textContent ?? '')
    .find((text) => /missions?/.test(text));

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  resetProfileForTests();
  forgetScenarioLibrary();
  // Moving on is not animated here (there is no view transition in the test browser).
  localStorage.setItem('firefly.motion', JSON.stringify('reduce'));
  setCatalogue(CATALOGUE);
  vi.mocked(api.progress).mockResolvedValue(noProgress);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('Missions: the field', () => {
  it('lists every mission once, grouped by family, each a link to its calibration', async () => {
    renderLibrary('/scenarios?view=list');
    await heading();
    const links = panel().getAllByRole('link');
    expect(links).toHaveLength(13);
    expect(links.map((link) => link.getAttribute('href'))).toEqual(
      expect.arrayContaining(CATALOGUE.map((s) => `/scenarios/${s.id}/setup`)),
    );
    expect(panel().getAllByRole('heading', { level: 2 }).length).toBeGreaterThanOrEqual(7);
    expect(
      panel().getByRole('heading', { level: 2, name: /Access and Identity/ }),
    ).toBeInTheDocument();
  });

  it('says what to choose by, in the row and in words: persona, minutes, standing and difficulty', async () => {
    renderLibrary('/scenarios?view=list');
    await heading();
    const row = panel().getByRole('link', { name: titleOf(LOCKED_OUT) });
    // The link is the title, stretched over the row; the persona is in the same row beside it.
    expect(row.closest('li')).toHaveTextContent('Maya Okafor');
    expect(row).toHaveAccessibleDescription(/Starter, low impact, customer starts calm/);
    expect(row).toHaveAccessibleDescription(/about 8 minutes\. Not tried yet\./);
  });

  it('suggests one mission, says why, and marks it in the field', async () => {
    renderLibrary('/scenarios?view=list');
    await heading();
    const suggested = document.querySelector('[data-recommended="true"]');
    expect(suggested).not.toBeNull();
    const title = within(suggested as HTMLElement)
      .getByRole('link')
      .getAttribute('href');
    const intro = screen.getAllByText('Suggested next')[0];
    expect(intro).toBeInTheDocument();
    expect(
      screen.getAllByRole('link').filter((link) => link.getAttribute('href') === title).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('says what went wrong and lets you try again', async () => {
    const user = userEvent.setup();
    vi.mocked(api.scenarios)
      .mockRejectedValueOnce(new ApiError(0, 'network', "Can't reach Firefly right now.", true))
      .mockResolvedValueOnce([...CATALOGUE]);
    renderLibrary();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Can't reach Firefly right now.");
    await user.click(within(alert).getByRole('button', { name: /Try again/ }));
    expect(await heading()).toBeInTheDocument();
  });

  it('copes with one mission and with none', async () => {
    const first = CATALOGUE[0] as PublicScenarioDTO;
    setCatalogue([first]);
    renderLibrary();
    expect(await heading()).toBeInTheDocument();
    // One mission needs no search or lens.
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Missions' })).toBeInTheDocument();
    cleanup();

    forgetScenarioLibrary();
    setCatalogue([]);
    renderLibrary();
    expect(await screen.findByText('No missions are available yet')).toBeInTheDocument();
  });

  it('copes with forty missions: every one is reachable in the list, and every star in the chart', async () => {
    const forty = syntheticCatalogue(40, 11);
    setCatalogue(forty);
    renderLibrary('/scenarios?view=list');
    await heading();
    expect(panel().getAllByRole('link')).toHaveLength(40);
    cleanup();

    forgetScenarioLibrary();
    setCatalogue(forty);
    renderLibrary('/scenarios?view=chart');
    await heading();
    expect(
      within(screen.getByRole('list', { name: 'Missions' })).getAllByRole('link'),
    ).toHaveLength(40);
  });

  it('copes with a very long title', async () => {
    const long = 'Customer who writes very long subject lines '.repeat(6).trim();
    setCatalogue([
      { ...(CATALOGUE[0] as PublicScenarioDTO), title: long },
      ...CATALOGUE.slice(1, 4),
    ]);
    renderLibrary('/scenarios?view=list');
    await heading();
    expect(panel().getByRole('link', { name: long })).toBeInTheDocument();
  });
});

describe('Missions: the chart and the list', () => {
  it('opens on the chart where there is room, and on the list on a narrow window', async () => {
    renderLibrary();
    await heading();
    expect(screen.getByRole('tab', { name: 'Chart', selected: true })).toBeInTheDocument();
    cleanup();

    stubWidth(true);
    forgetScenarioLibrary();
    renderLibrary();
    await heading();
    expect(screen.getByRole('tab', { name: 'List', selected: true })).toBeInTheDocument();
  });

  it('switches between them and keeps the choice in the address', async () => {
    const user = userEvent.setup();
    const router = renderLibrary();
    await heading();
    await user.click(screen.getByRole('tab', { name: 'List' }));
    await waitFor(() => expect(router.state.location.search).toContain('view=list'));
    expect(panel().getAllByRole('link')).toHaveLength(13);
    await user.click(screen.getByRole('tab', { name: 'Chart' }));
    await waitFor(() => expect(router.state.location.search).toContain('view=chart'));
    expect(screen.getByRole('list', { name: 'Missions' })).toBeInTheDocument();
  });

  it('makes every star a link with its words, and one tab stop that the arrow keys move', async () => {
    const user = userEvent.setup();
    renderLibrary('/scenarios?view=chart');
    await heading();
    const stars = within(screen.getByRole('list', { name: 'Missions' })).getAllByRole('link');
    expect(stars).toHaveLength(13);
    const first = stars.find((star) => star.getAttribute('href')?.includes(LOCKED_OUT));
    expect(first).toHaveAccessibleDescription(/Not tried yet\./);
    const stops = stars.filter((star) => star.tabIndex === 0);
    expect(stops).toHaveLength(1);

    (stops[0] as HTMLElement).focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).not.toBe(stops[0]);
    expect(stars).toContain(document.activeElement);
    expect(stars.filter((star) => star.tabIndex === 0)).toHaveLength(1);
  });
});

describe('Missions: search', () => {
  it('is filled in from the address, and narrows the missions', async () => {
    renderLibrary('/scenarios?q=password&view=list');
    await heading();
    expect(search()).toHaveValue('password');
    expect(statusLine()).toMatch(/Showing \d+ of 13 missions/);
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });

  it('follows the address when the search in the top bar is used while the field is open', async () => {
    const router = renderLibrary('/scenarios?view=list');
    await heading();
    expect(search()).toHaveValue('');
    await act(async () => {
      await router.navigate('/scenarios?q=slow&view=list');
    });
    expect(search()).toHaveValue('slow');
    expect(statusLine()).toMatch(/Showing \d+ of 13 missions/);
  });

  it('searches as you type and writes the address after a pause, without adding history entries', async () => {
    const user = userEvent.setup();
    const router = renderLibrary('/scenarios?view=list');
    await heading();
    await user.type(search(), 'slow');
    expect(search()).toHaveValue('slow');
    await waitFor(() => expect(router.state.location.search).toContain('q=slow'), {
      timeout: 2000,
    });
    expect(router.state.historyAction).toBe('REPLACE');
    expect(router.state.historyAction === 'REPLACE' && router.state.location.pathname).toBe(
      '/scenarios',
    );
  });

  it('does not pull the person back to the missions when a link was followed during the pause', async () => {
    const user = userEvent.setup();
    const router = renderLibrary('/scenarios?view=list', 700);
    await heading();
    await user.type(search(), 'abc');
    await act(async () => {
      void router.navigate(`/scenarios/${LOCKED_OUT}/setup`);
    });
    await screen.findByText('Setup page', undefined, { timeout: 3000 });
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(router.state.location.pathname).toBe(`/scenarios/${LOCKED_OUT}/setup`);
    expect(router.state.location.search).toBe('');
  });

  it('offers a way out of an empty result, and puts focus back on the search', async () => {
    const user = userEvent.setup();
    const router = renderLibrary('/scenarios?q=zzzz&view=list');
    await heading();
    expect((await screen.findAllByText('No missions match')).length).toBeGreaterThanOrEqual(1);
    await user.click(screen.getByRole('button', { name: 'Clear all filters' }));
    await waitFor(() => expect(router.state.location.search).not.toContain('q='));
    expect(search()).toHaveValue('');
    expect(search()).toHaveFocus();
    expect(panel().getAllByRole('link')).toHaveLength(13);
  });
});

describe('Missions: the lens', () => {
  const lens = () => screen.getByRole('button', { name: /^Lens/ });

  it('keeps its choices behind one button that says how many are set', async () => {
    const user = userEvent.setup();
    renderLibrary('/scenarios?difficulty=challenge&status=new&view=list');
    await heading();
    expect(lens()).toHaveTextContent('2 set');
    expect(lens()).toHaveAttribute('aria-expanded', 'false');
    await user.click(lens());
    expect(lens()).toHaveAttribute('aria-expanded', 'true');
    for (const legend of ['Difficulty', 'Status']) {
      expect(screen.getByRole('group', { name: legend })).toBeInTheDocument();
    }
  });

  it('lights only what matches, says how many options would show, and keeps the lens in the address', async () => {
    const user = userEvent.setup();
    const router = renderLibrary('/scenarios?view=chart');
    await heading();
    await user.click(lens());
    const challenge = CATALOGUE.filter((s) => s.difficulty === 'challenge').length;
    const option = within(screen.getByRole('group', { name: 'Difficulty' })).getByRole('radio', {
      name: `Challenge (${challenge})`,
    });
    await user.click(option);
    await waitFor(() => expect(router.state.location.search).toContain('difficulty=challenge'));
    expect(statusLine()).toBe(`Showing ${challenge} of 13 missions`);
    // Nothing is taken off the plate: the others are only hushed and cannot be reached.
    const stars = within(screen.getByRole('list', { name: 'Missions' })).getAllByRole('link');
    expect(stars).toHaveLength(13);
    expect(document.querySelectorAll('li[data-lit="true"]')).toHaveLength(challenge);
    expect(document.querySelectorAll('li[data-lit="false"][inert]')).toHaveLength(13 - challenge);
  });

  it('narrows the list to what matches', async () => {
    renderLibrary('/scenarios?difficulty=challenge&view=list');
    await heading();
    const challenge = CATALOGUE.filter((s) => s.difficulty === 'challenge').length;
    expect(panel().getAllByRole('link')).toHaveLength(challenge);
    expect(statusLine()).toBe(`Showing ${challenge} of 13 missions`);
  });

  it('starts from a filtered address and follows the browser Back button', async () => {
    const router = renderLibrary('/scenarios?view=list');
    await heading();
    await act(async () => {
      await router.navigate('/scenarios?difficulty=challenge&view=list');
    });
    expect(statusLine()).toMatch(/Showing \d+ of 13 missions/);
    await act(async () => {
      await router.navigate(-1);
    });
    await waitFor(() => expect(statusLine()).toBe('13 missions'));
  });

  it('clears the search and every filter together', async () => {
    const user = userEvent.setup();
    const router = renderLibrary('/scenarios?q=pass&difficulty=starter&view=list');
    await heading();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(router.state.location.search).toBe('?view=list'));
    expect(search()).toHaveValue('');
    expect(statusLine()).toBe('13 missions');
  });
});

describe('Missions: practice', () => {
  it('says where the trainee stands with each mission: not tried yet, started, completed with the best score', async () => {
    setCatalogue(CATALOGUE, [fullCall(LOCKED_OUT, 4), runningCall(ESCALATED)]);
    renderLibrary('/scenarios?view=list');
    await heading();
    expect(panel().getByRole('link', { name: titleOf(LOCKED_OUT) })).toHaveAccessibleDescription(
      /Completed, best score 4 of 5\./,
    );
    expect(panel().getByRole('link', { name: titleOf(ESCALATED) })).toHaveAccessibleDescription(
      /Started, not completed yet\./,
    );
    const other = CATALOGUE.find((s) => s.id !== LOCKED_OUT && s.id !== ESCALATED);
    expect(panel().getByRole('link', { name: other?.title })).toHaveAccessibleDescription(
      /Not tried yet\./,
    );
  });

  it('never counts sample calls as practice', async () => {
    setCatalogue(CATALOGUE, [sampleCall(LOCKED_OUT, 5)]);
    renderLibrary('/scenarios?view=list');
    await heading();
    expect(panel().getByRole('link', { name: titleOf(LOCKED_OUT) })).toHaveAccessibleDescription(
      /Not tried yet\./,
    );
  });

  it('shows every mission as completed once every mission is', async () => {
    setCatalogue(
      CATALOGUE,
      CATALOGUE.map((s) => fullCall(s.id, 5)),
    );
    renderLibrary('/scenarios?view=list');
    await heading();
    for (const link of panel().getAllByRole('link')) {
      expect(link).toHaveAccessibleDescription(/Completed, best score 5 of 5\./);
    }
  });

  it('does not claim "not tried yet" or suggest anything when the history could not be read', async () => {
    vi.mocked(api.listSessions).mockRejectedValue(new ApiError(0, 'network', 'Offline.', true));
    renderLibrary('/scenarios?view=list');
    await heading();
    expect(screen.getByText(/practice history could not be read/)).toBeInTheDocument();
    expect(screen.queryByText('Suggested next')).not.toBeInTheDocument();
    for (const link of panel().getAllByRole('link')) {
      expect(link).not.toHaveAccessibleDescription(/Not tried yet\./);
    }
  });
});
