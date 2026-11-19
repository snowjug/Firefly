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
import type { SessionSummaryDTO } from '#shared/domain/api.ts';
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
  impact: 'low',
  startingTemperature: 'calm',
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
  summary: 'A finance manager is shocked by this month’s invoice.',
  tags: ['billing', 'invoice'],
  issueType: 'billing-licence',
  difficulty: 'challenge',
  impact: 'high',
  startingTemperature: 'angry',
  estimatedMinutes: 14,
});

function makeSession(overrides: Partial<SessionSummaryDTO> = {}): SessionSummaryDTO {
  return {
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
    ...overrides,
  };
}

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
      {/* What the search box in the top bar does. */}
      <button type="button" onClick={() => void navigate('/scenarios?q=invoice')}>
        Top bar search
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
      </Routes>
    </MemoryRouter>,
  );
}

const titles = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
const url = () => screen.getByTestId('url');
const search = () => screen.getByRole('searchbox', { name: 'Search scenarios' });
const count = () => screen.getByRole('status');

beforeEach(() => {
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

describe('Library: the catalogue', () => {
  it('lists every scenario as a card, the suggestion first, then the spotlight', async () => {
    renderLibrary();
    await screen.findByRole('heading', { level: 2, name: starter.title });
    expect(screen.getByRole('heading', { level: 1, name: 'Scenarios' })).toBeInTheDocument();
    expect(screen.getByText(/Every customer here is fictional/)).toBeInTheDocument();
    // With no history, the gentlest scenario is the suggestion.
    expect(titles()).toEqual([starter.title, spotlight.title, challenge.title]);
    expect(count()).toHaveTextContent('3 scenarios');
    expect(count()).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('Demo spotlight')).toBeInTheDocument();
  });

  it('shows what a card needs to choose by: icon, title, summary, chips, minutes and one Start link', async () => {
    renderLibrary();
    const card = await screen.findByRole('article', { name: challenge.title });
    expect(within(card).getByText('Billing or licence question')).toBeInTheDocument();
    expect(within(card).getByText(challenge.summary)).toBeInTheDocument();
    const chips = within(card).getByRole('list', { name: 'Scenario settings' });
    expect(within(chips).getByText('Challenge')).toBeInTheDocument();
    expect(within(chips).getByText('High impact')).toBeInTheDocument();
    expect(within(chips).getByText('Starts angry / escalating')).toBeInTheDocument();
    expect(within(card).getByText('About 14 minutes')).toBeInTheDocument();
    const links = within(card).getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName(`Start ${challenge.title}`);
    expect(links[0]).toHaveAttribute('href', '/scenarios/invoice-shock/setup');
    expect(screen.getAllByRole('link')).toHaveLength(3);
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
    expect(count()).toHaveTextContent('1 scenario');
    cleanup();

    vi.mocked(api.scenarios).mockResolvedValueOnce([]);
    renderLibrary();
    expect(await screen.findByText('No scenarios are available yet')).toBeInTheDocument();
  });
});

describe('Library: search', () => {
  it('is filled in from the address, and narrows the list', async () => {
    renderLibrary('/scenarios?q=invoice');
    await screen.findByText(challenge.title);
    expect(search()).toHaveValue('invoice');
    expect(titles()).toEqual([challenge.title]);
    expect(count()).toHaveTextContent('Showing 1 of 3 scenarios');
  });

  it('follows the address when the search in the top bar is used while the library is open', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText(starter.title);
    expect(search()).toHaveValue('');

    await user.click(screen.getByRole('button', { name: 'Top bar search' }));
    expect(search()).toHaveValue('invoice');
    expect(titles()).toEqual([challenge.title]);
  });

  it('searches as you type and writes the address after a pause, without adding history entries', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText(starter.title);

    await user.type(search(), 'invoice');
    expect(titles()).toEqual([challenge.title]);
    expect(count()).toHaveTextContent('Showing 1 of 3 scenarios');
    await waitFor(() => expect(url()).toHaveTextContent('/scenarios?q=invoice'));
    expect(screen.getByTestId('navigation')).toHaveTextContent('REPLACE');
    expect(search()).toHaveValue('invoice');
  });

  it('does not pull the person back to the library when a link was followed during the pause', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText(starter.title);

    await user.type(search(), 'invoice');
    // A link has just been followed: the browser has moved on, but the old page is still showing
    // (the next page's code is still loading).
    window.history.replaceState(null, '', '/scenarios/invoice-shock/setup');
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(url()).toHaveTextContent(/^\/scenarios$/);
  });
});

describe('Library: filters', () => {
  it('narrows by issue type, difficulty and impact, each with its own label, and keeps them in the address', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText(starter.title);

    await user.selectOptions(screen.getByLabelText('Issue type'), 'sign-in-access');
    expect(titles()).toEqual([starter.title, spotlight.title]);
    expect(count()).toHaveTextContent('Showing 2 of 3 scenarios');
    expect(url()).toHaveTextContent('/scenarios?issue=sign-in-access');

    await user.selectOptions(screen.getByLabelText('Difficulty'), 'starter');
    expect(titles()).toEqual([starter.title]);
    expect(url()).toHaveTextContent('issue=sign-in-access&difficulty=starter');

    await user.selectOptions(screen.getByLabelText('Issue type'), '');
    await user.selectOptions(screen.getByLabelText('Difficulty'), '');
    await user.selectOptions(screen.getByLabelText('Business impact'), 'high');
    expect(titles()).toEqual([challenge.title]);
    expect(url()).toHaveTextContent('/scenarios?impact=high');
  });

  it('counts what each option would show, and leaves out options no scenario has', async () => {
    renderLibrary();
    await screen.findByText(starter.title);
    const issue = screen.getByLabelText('Issue type');
    expect(
      within(issue)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual([
      'All issue types',
      'Sign-in or access problem (2)',
      'Billing or licence question (1)',
    ]);
  });

  it('clears the search and every filter together and puts focus back on the search', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText(starter.title);
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Business impact'), 'high');
    await user.type(search(), 'invoice');
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(titles()).toHaveLength(3);
    expect(search()).toHaveValue('');
    expect(screen.getByLabelText('Business impact')).toHaveValue('');
    expect(search()).toHaveFocus();
    await waitFor(() => expect(url()).toHaveTextContent(/^\/scenarios$/));
  });

  it('starts from a filtered address and follows the browser Back button', async () => {
    const user = userEvent.setup();
    renderLibrary('/scenarios?q=invoice');
    await screen.findByText(challenge.title);

    await user.selectOptions(screen.getByLabelText('Difficulty'), 'starter');
    expect(screen.getByText('No scenarios match', { selector: 'h2' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Browser back' }));
    expect(url()).toHaveTextContent('/scenarios?q=invoice');
    expect(screen.getByLabelText('Difficulty')).toHaveValue('');
    expect(titles()).toEqual([challenge.title]);
  });

  it('offers a way out of an empty result', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText(starter.title);
    await user.type(search(), 'zzzz');
    expect(count()).toHaveTextContent('No scenarios match');
    await user.click(screen.getByRole('button', { name: 'Clear all filters' }));
    expect(titles()).toHaveLength(3);
  });

  it('keeps the selects behind a Filters button that says how many are set', async () => {
    const user = userEvent.setup();
    renderLibrary('/scenarios?impact=high&difficulty=challenge');
    await screen.findByText(challenge.title);
    const toggle = screen.getByRole('button', { name: /Filters/ });
    expect(toggle).toHaveTextContent('2 set');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByLabelText('Difficulty').closest('.lib-facets');
    expect(toggle).toHaveAttribute('aria-controls', panel?.id);
  });
});

describe('Library: practice', () => {
  it('says how often each scenario has been practised, and that one is in progress or not tried yet', async () => {
    vi.mocked(api.listSessions).mockResolvedValue({
      sessions: [
        makeSession({ id: 'a', overallScore: 3.8, endedAt: '2026-03-01T09:10:00.000Z' }),
        makeSession({ id: 'b', overallScore: 4.2, endedAt: '2026-03-02T09:10:00.000Z' }),
        makeSession({
          id: 'c',
          scenarioId: spotlight.id,
          scenarioTitle: spotlight.title,
          difficulty: 'standard',
          status: 'active',
          completion: null,
          endedAt: null,
          overallScore: null,
        }),
      ],
      total: 3,
    });
    renderLibrary();
    const practised = await screen.findByRole('article', { name: starter.title });
    expect(
      await within(practised).findByText('Practised 2 times · best 4.2 of 5'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('article', { name: spotlight.title })).getByText('Call in progress'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('article', { name: challenge.title })).getByText('Not tried yet'),
    ).toBeInTheDocument();
  });

  it('says "once" for a single completed call, and never counts sample calls', async () => {
    vi.mocked(api.listSessions).mockResolvedValue({
      sessions: [
        makeSession({ id: 'a', overallScore: null }),
        makeSession({ id: 'z', isSample: true }),
      ],
      total: 2,
    });
    renderLibrary();
    const card = await screen.findByRole('article', { name: starter.title });
    expect(await within(card).findByText('Practised once')).toBeInTheDocument();
  });

  it('suggests the next scenario with the reason, and puts it first', async () => {
    vi.mocked(api.listSessions).mockResolvedValue({
      sessions: [
        makeSession({
          id: 'a',
          scenarioId: spotlight.id,
          scenarioTitle: spotlight.title,
          difficulty: 'standard',
          overallScore: 4.5,
        }),
      ],
      total: 1,
    });
    renderLibrary();
    const card = await screen.findByRole('article', { name: challenge.title });
    expect(await within(card).findByText('Recommended next')).toBeInTheDocument();
    expect(
      within(card).getByText(
        /Your last call averaged 4\.5 of 5\. A Challenge call is the next step\./,
      ),
    ).toBeInTheDocument();
    expect(titles()[0]).toBe(challenge.title);
  });

  it('does not claim "not tried yet" when the history could not be read', async () => {
    vi.mocked(api.listSessions).mockRejectedValue(new ApiError(0, 'network', 'Offline.', true));
    renderLibrary();
    await screen.findByText(starter.title);
    expect(screen.queryByText('Not tried yet')).not.toBeInTheDocument();
    expect(screen.queryByText('Recommended next')).not.toBeInTheDocument();
    expect(titles()).toEqual([spotlight.title, starter.title, challenge.title]);
  });
});
