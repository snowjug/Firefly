import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useNavigationType,
} from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeScenario } from '../components/scenario/scenario-fixtures.ts';
import type * as ApiModule from '../lib/api.ts';
import { ApiError, api } from '../lib/api.ts';
import Library from './Library.tsx';

vi.mock('../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, api: { scenarios: vi.fn(), listSessions: vi.fn(), progress: vi.fn() } };
});

const starter = makeScenario({
  id: 'locked-out',
  title: 'Locked out after a password reset',
  summary: 'A front-desk coordinator cannot sign in to the staff portal.',
  tags: ['sign-in', 'password'],
  difficulty: 'starter',
  estimatedMinutes: 8,
});
const spotlight = makeScenario({
  id: 'team-workspace',
  title: 'Team cannot open the shared workspace',
  spotlight: true,
});
const challenge = makeScenario({
  id: 'invoice-shock',
  title: 'A much bigger invoice than expected',
  tags: ['billing', 'invoice'],
  issueType: 'billing-licence',
  difficulty: 'challenge',
  impact: 'high',
  estimatedMinutes: 14,
});

function Harness() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <div>
      <p data-testid="url">{`${location.pathname}${location.search}`}</p>
      <p data-testid="navigation">{useNavigationType()}</p>
      <button type="button" onClick={() => void navigate(-1)}>
        Browser back
      </button>
    </div>
  );
}

function renderLibrary(entry = '/scenarios') {
  // The page compares its own address with the browser's, so the browser starts where the router does.
  window.history.replaceState(null, '', entry);
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Harness />
      <Routes>
        <Route path="/scenarios" element={<Library />} />
        <Route path="/scenarios/:id/setup" element={<p>Setup page</p>} />
        <Route path="/scenarios/:id/brief" element={<p>Brief page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const titles = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
const url = () => screen.getByTestId('url');

beforeEach(() => {
  sessionStorage.clear();
  vi.mocked(api.scenarios).mockResolvedValue([challenge, starter, spotlight]);
  vi.mocked(api.listSessions).mockResolvedValue({ sessions: [], total: 0 });
  vi.mocked(api.progress).mockResolvedValue({
    totalSessions: 0,
    completedSessions: 0,
    dimensionTrends: [],
    strongest: null,
    focus: null,
    focusReason: null,
    repeatedOpportunities: [],
    recentChange: 'not-enough-data',
    note: '',
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('Library', () => {
  it('lists the scenarios, spotlight first, with the fictional-customers note', async () => {
    renderLibrary();
    await screen.findByRole('heading', { level: 2, name: spotlight.title });
    expect(titles()).toEqual([spotlight.title, starter.title, challenge.title]);
    expect(screen.getByRole('status')).toHaveTextContent('3 scenarios');
    expect(screen.getByText(/Every customer here is fictional/)).toBeInTheDocument();
    expect(screen.getByText('Demo spotlight')).toBeInTheDocument();
  });

  it('searches as you type and writes the search to the address without adding history entries', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText(starter.title);

    await user.type(screen.getByRole('searchbox', { name: 'Search scenarios' }), 'invoice');
    expect(titles()).toEqual([challenge.title]);
    expect(screen.getByRole('status')).toHaveTextContent('Showing 1 of 3 scenarios');
    await waitFor(() => expect(url()).toHaveTextContent('/scenarios?q=invoice'));
    expect(screen.getByTestId('navigation')).toHaveTextContent('REPLACE');
  });

  it('does not pull the person back to the library when a link was followed during the search pause', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText(starter.title);

    await user.type(screen.getByRole('searchbox', { name: 'Search scenarios' }), 'invoice');
    // A link has just been followed: the browser has moved on, but the old page is still showing
    // (the next page's chunk is still loading).
    window.history.replaceState(null, '', '/scenarios/invoice-shock/setup');
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(url()).toHaveTextContent(/^\/scenarios$/);
  });

  it('filters by choosing an option, shows it as a removable filter and can clear everything', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText(starter.title);

    await user.selectOptions(screen.getByLabelText('Difficulty'), 'starter');
    expect(titles()).toEqual([starter.title]);
    expect(url()).toHaveTextContent('/scenarios?difficulty=starter');
    const filters = screen.getByRole('list', { name: 'Active filters' });
    expect(within(filters).getByText('Starter')).toBeInTheDocument();

    await user.click(
      within(filters).getByRole('button', { name: 'Remove filter: Difficulty, Starter' }),
    );
    expect(titles()).toHaveLength(3);
    expect(url()).toHaveTextContent(/^\/scenarios$/);

    await user.selectOptions(screen.getByLabelText('Business impact'), 'high');
    await user.type(screen.getByRole('searchbox', { name: 'Search scenarios' }), 'invoice');
    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(titles()).toHaveLength(3);
    expect(screen.getByRole('searchbox', { name: 'Search scenarios' })).toHaveValue('');
    await waitFor(() => expect(url()).toHaveTextContent(/^\/scenarios$/));
  });

  it('starts from a filtered address and follows the browser Back button', async () => {
    const user = userEvent.setup();
    renderLibrary('/scenarios?q=invoice');
    await screen.findByText(challenge.title);
    expect(screen.getByRole('searchbox', { name: 'Search scenarios' })).toHaveValue('invoice');

    await user.selectOptions(screen.getByLabelText('Difficulty'), 'starter');
    expect(screen.getByText(/No scenarios match/, { selector: 'h2' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Browser back' }));
    expect(url()).toHaveTextContent('/scenarios?q=invoice');
    expect(screen.getByLabelText('Difficulty')).toHaveValue('');
    expect(titles()).toEqual([challenge.title]);
  });

  it('sorts on request and offers a way out of an empty result', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText(starter.title);

    await user.selectOptions(screen.getByLabelText('Sort by'), 'shortest');
    expect(titles()).toEqual([starter.title, spotlight.title, challenge.title]);
    expect(url()).toHaveTextContent('sort=shortest');

    await user.type(screen.getByRole('searchbox', { name: 'Search scenarios' }), 'zzzz');
    expect(screen.getByRole('status')).toHaveTextContent('No scenarios match');
    await user.click(screen.getByRole('button', { name: 'Clear all filters' }));
    expect(titles()).toHaveLength(3);
  });

  it('previews the public brief and starts with the defaults', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await user.click(await screen.findByRole('button', { name: `Preview ${starter.title}` }));

    const dialog = screen.getByRole('dialog', { name: starter.title });
    expect(within(dialog).getByText(starter.brief.situation)).toBeInTheDocument();
    expect(within(dialog).getByText(starter.brief.goal)).toBeInTheDocument();
    expect(within(dialog).getByText('When it started')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: /Customise and begin/ })).toHaveAttribute(
      'href',
      '/scenarios/locked-out/setup',
    );

    await user.click(within(dialog).getByRole('button', { name: 'Start with defaults' }));
    expect(await screen.findByText('Brief page')).toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem('firefly.draft') ?? 'null')).toEqual({
      scenarioId: 'locked-out',
      overrides: {},
    });
  });

  it('closes the preview with Escape and gives focus back to the button that opened it', async () => {
    const user = userEvent.setup();
    renderLibrary();
    const opener = await screen.findByRole('button', { name: `Preview ${starter.title}` });
    await user.click(opener);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('says what went wrong and lets you try again', async () => {
    const user = userEvent.setup();
    vi.mocked(api.scenarios)
      .mockRejectedValueOnce(new ApiError(0, 'network', "Can't reach Firefly right now.", true))
      .mockResolvedValueOnce([starter]);
    renderLibrary();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Can't reach Firefly right now.");
    await user.click(within(alert).getByRole('button', { name: /Try again/ }));
    expect(await screen.findByText(starter.title)).toBeInTheDocument();
  });

  it('copes with one scenario and with none', async () => {
    vi.mocked(api.scenarios).mockResolvedValueOnce([starter]);
    renderLibrary();
    await screen.findByText(starter.title);
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1 scenario');
    cleanup();

    vi.mocked(api.scenarios).mockResolvedValueOnce([]);
    renderLibrary();
    expect(await screen.findByText('No scenarios are available yet')).toBeInTheDocument();
  });
});

function stubScreen(wide: boolean) {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: wide && query.includes('min-width'),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

describe('Library views', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('opens on the mission map on a wide screen, with the list one switch away', async () => {
    stubScreen(true);
    const user = userEvent.setup();
    renderLibrary();
    expect(await screen.findByRole('toolbar', { name: 'Missions' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Map' })).toBeChecked();
    // The map shows the first match in its panel and offers the same actions as a card.
    expect(screen.getByRole('link', { name: `Set up call: ${starter.title}` })).toBeInTheDocument();
    expect(screen.queryByLabelText('Sort by')).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'List' }));
    expect(await screen.findByLabelText('Sort by')).toBeInTheDocument();
    expect(screen.queryByRole('toolbar', { name: 'Missions' })).not.toBeInTheDocument();
    expect(titles()).toEqual([spotlight.title, starter.title, challenge.title]);
    expect(url()).toHaveTextContent('/scenarios?view=list');
    expect(JSON.parse(localStorage.getItem('firefly.library.view') ?? 'null')).toBe('list');
  });

  it('remembers the chosen view and lets the address decide', async () => {
    stubScreen(true);
    localStorage.setItem('firefly.library.view', JSON.stringify('list'));
    renderLibrary();
    expect(await screen.findByLabelText('Sort by')).toBeInTheDocument();
    cleanup();

    renderLibrary('/scenarios?view=map');
    expect(await screen.findByRole('toolbar', { name: 'Missions' })).toBeInTheDocument();
  });

  it('keeps the chosen view while searching and filtering', async () => {
    stubScreen(true);
    const user = userEvent.setup();
    renderLibrary('/scenarios?view=list');
    await screen.findByText(starter.title);
    await user.selectOptions(screen.getByLabelText('Difficulty'), 'starter');
    expect(url()).toHaveTextContent('view=list');
    expect(url()).toHaveTextContent('difficulty=starter');
    await user.type(screen.getByRole('searchbox', { name: 'Search scenarios' }), 'locked');
    await waitFor(() => expect(url()).toHaveTextContent('q=locked'));
    expect(url()).toHaveTextContent('view=list');
  });

  it('searching narrows the map to the matches and puts the first one in the panel', async () => {
    stubScreen(true);
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByRole('toolbar', { name: 'Missions' });
    await user.type(screen.getByRole('searchbox', { name: 'Search scenarios' }), 'invoice');
    expect(await screen.findByRole('article', { name: challenge.title })).toBeInTheDocument();
    const dimmed = document.querySelector(`[data-mission="${starter.id}"]`) as HTMLElement;
    expect(dimmed).toHaveAttribute('data-match', 'false');
  });

  it('shows only the list on a phone, with no switch', async () => {
    stubScreen(false);
    renderLibrary();
    await screen.findByText(starter.title);
    expect(screen.queryByRole('radio', { name: 'Map' })).not.toBeInTheDocument();
    expect(screen.queryByRole('toolbar', { name: 'Missions' })).not.toBeInTheDocument();
    expect(titles()).toHaveLength(3);
  });

  it('marks what has been practised and what to do next in the list', async () => {
    vi.mocked(api.listSessions).mockResolvedValue({
      sessions: [
        {
          id: 's1',
          scenarioId: starter.id,
          scenarioTitle: starter.title,
          issueType: 'sign-in-access',
          difficulty: 'starter',
          startingTemperature: 'calm',
          impact: 'low',
          style: 'talkative',
          mode: 'guided',
          providerKind: 'mock',
          providerLabel: 'Demo',
          isSample: false,
          status: 'completed',
          startedAt: '2026-03-01T09:00:00.000Z',
          endedAt: '2026-03-01T09:10:00.000Z',
          durationSeconds: 600,
          traineeTurns: 5,
          completion: 'completed',
          overallScore: 4.2,
          dimensionScores: null,
          mentorReviewed: false,
        },
      ],
      total: 1,
    });
    renderLibrary();
    const card = (await screen.findByRole('article', { name: starter.title })) as HTMLElement;
    expect(await within(card).findByText('Practised, best 4.2')).toBeInTheDocument();
    expect(screen.getAllByText(/Not attempted/).length).toBe(2);
    expect(screen.getByText('Recommended next')).toBeInTheDocument();
  });
});
