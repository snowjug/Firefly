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
  return { ...actual, api: { scenarios: vi.fn() } };
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
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
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
