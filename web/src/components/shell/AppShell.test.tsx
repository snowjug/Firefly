import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BadgeDTO, RewardsDTO, SessionSummaryDTO } from '#shared/domain/api.ts';
import { api } from '../../lib/api.ts';
import type * as ApiModule from '../../lib/api.ts';
import {
  getProfile,
  resetProfileForTests,
  saveProfile,
  updatePreferences,
} from '../../lib/profile.ts';
import { ThemeProvider } from '../../lib/theme.tsx';
import { AppShell } from './AppShell.tsx';

vi.mock('../../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, api: { listSessions: vi.fn(), rewards: vi.fn() } };
});
vi.mock('../ProviderBadge.tsx', () => ({ ProviderBadge: () => <span>Demo mode</span> }));

const listSessions = vi.mocked(api.listSessions);
const rewards = vi.mocked(api.rewards);

function badge(overrides: Partial<BadgeDTO> = {}): BadgeDTO {
  return {
    id: 'scope-detective',
    title: 'Scope Detective',
    criteria: 'Uncover hidden facts in three different calls.',
    earned: false,
    earnedAt: null,
    earnedInSessionId: null,
    progress: { current: 1, target: 3, unit: 'calls' },
    ...overrides,
  };
}

function rewardsWith(badges: BadgeDTO[]): RewardsDTO {
  return { badges } as RewardsDTO;
}

function session(overrides: Partial<SessionSummaryDTO> = {}): SessionSummaryDTO {
  return {
    id: 's1',
    scenarioId: 'team-workspace',
    scenarioTitle: 'Team cannot open the workspace',
    issueType: 'sign-in-access',
    difficulty: 'starter',
    startingTemperature: 'calm',
    impact: 'low',
    style: 'talkative',
    mode: 'guided',
    providerKind: 'mock',
    providerLabel: 'Demo mode',
    isSample: false,
    status: 'completed',
    startedAt: '2026-03-01T09:00:00.000Z',
    endedAt: '2026-03-01T09:10:00.000Z',
    durationSeconds: 600,
    traineeTurns: 6,
    completion: 'completed',
    overallScore: 3.2,
    dimensionScores: null,
    mentorReviewed: false,
    ...overrides,
  };
}

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
}

function renderShell(path = '/home') {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="home" element={<h1>Home page</h1>} />
            <Route path="calls/:id" element={<h1>Call page</h1>} />
            <Route path="sessions/:id/report" element={<h1>Report page</h1>} />
            <Route path="scenarios" element={<Where />} />
            <Route path="settings" element={<h1>Settings page</h1>} />
          </Route>
          <Route path="/" element={<h1>Landing page</h1>} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

beforeAll(() => {
  window.scrollTo = vi.fn();
});

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  resetProfileForTests();
  listSessions.mockResolvedValue({ sessions: [], total: 0 });
  rewards.mockResolvedValue(rewardsWith([]));
});

describe('AppShell navigation', () => {
  it('marks the current destination and links every one of them', () => {
    renderShell('/home');
    const main = screen.getByRole('navigation', { name: 'Main' });
    expect(within(main).getByRole('link', { name: 'Home' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(main).getByRole('link', { name: 'Practice' })).not.toHaveAttribute(
      'aria-current',
    );
    expect(
      within(main)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/home', '/practice', '/scenarios', '/progress', '/rewards', '/history']);
    expect(
      within(screen.getByRole('navigation', { name: 'For mentors' }))
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/calibration', '/trainer']);
    expect(
      within(screen.getByRole('navigation', { name: 'Account and help' }))
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/settings', '/help']);
  });

  it('keeps Practice lit on the report of a call', () => {
    renderShell('/sessions/s1/report');
    expect(
      within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', {
        name: 'Practice',
      }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('gives a live call the whole screen: no top bar, no footer and an icon-only sidebar', () => {
    const { container } = renderShell('/calls/c1');
    expect(screen.getByRole('heading', { name: 'Call page' })).toBeInTheDocument();
    expect(screen.queryByRole('search')).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
    expect(container.querySelector('.app')).toHaveAttribute('data-compact', 'true');
    // The icons keep their names, so the rail is still usable with a screen reader.
    expect(
      within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', {
        name: 'Home',
      }),
    ).toBeInTheDocument();
  });

  it('shows the top bar and the training-aid footer on other pages', () => {
    const { container } = renderShell('/home');
    expect(screen.getByRole('search')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Firefly is a training aid');
    expect(container.querySelector('.app')).not.toHaveAttribute('data-compact');
  });

  it('opens the library with the words that were searched for', async () => {
    const user = userEvent.setup();
    renderShell('/home');
    await user.type(
      screen.getByRole('searchbox', { name: 'Search all scenarios' }),
      'sign in{Enter}',
    );
    expect(await screen.findByTestId('where')).toHaveTextContent('/scenarios?q=sign%20in');
  });

  it('opens a menu drawer on small screens and closes it after choosing a destination', async () => {
    const user = userEvent.setup();
    renderShell('/home');
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const drawer = await screen.findByRole('dialog', { name: 'Menu' });
    await user.click(within(drawer).getByRole('link', { name: 'Settings' }));
    expect(await screen.findByRole('heading', { name: 'Settings page' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument();
  });
});

describe('notifications', () => {
  const OLD = '2026-01-01T00:00:00.000Z';

  it('stays quiet when there is nothing new', async () => {
    const user = userEvent.setup();
    renderShell('/home');
    await user.click(await screen.findByRole('button', { name: 'Notifications' }));
    expect(await screen.findByText(/Nothing new/)).toBeInTheDocument();
  });

  it('flags a finished call whose report is ready, and clears the flag once it was looked at', async () => {
    localStorage.setItem('firefly.notifications.seen', JSON.stringify(OLD));
    listSessions.mockResolvedValue({
      sessions: [
        session({ id: 'new', endedAt: '2026-02-01T10:00:00.000Z' }),
        session({ id: 'sample', isSample: true, endedAt: '2026-02-02T10:00:00.000Z' }),
        session({ id: 'running', status: 'active', endedAt: null }),
      ],
      total: 3,
    });
    const user = userEvent.setup();
    renderShell('/home');
    const bell = await screen.findByRole('button', { name: 'Notifications, 1 new' });
    await user.click(bell);
    const panel = await screen.findByRole('region', { name: 'Notifications' });
    const link = within(panel).getByRole('link', { name: /Your coaching report is ready/ });
    expect(link).toHaveAttribute('href', '/sessions/new/report');
    expect(link).toHaveTextContent('Team cannot open the workspace');
    expect(link).toHaveTextContent('New');
    expect(within(panel).getAllByRole('link', { name: /report/ })).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('firefly.notifications.seen') ?? 'null')).toBe(
      '2026-02-01T10:00:00.000Z',
    );
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'Notifications' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notifications' })).toHaveFocus();
  });

  it('tells you about a badge you earned, and only about earned ones', async () => {
    localStorage.setItem('firefly.notifications.seen', JSON.stringify(OLD));
    rewards.mockResolvedValue(
      rewardsWith([
        badge({ earned: true, earnedAt: '2026-02-03T10:00:00.000Z' }),
        badge({ id: 'de-escalator', title: 'De-escalator' }),
      ]),
    );
    const user = userEvent.setup();
    renderShell('/home');
    await user.click(await screen.findByRole('button', { name: 'Notifications, 1 new' }));
    const panel = await screen.findByRole('region', { name: 'Notifications' });
    const link = within(panel).getByRole('link', { name: /You earned the Scope Detective badge/ });
    expect(link).toHaveAttribute('href', '/rewards');
    expect(within(panel).queryByText(/De-escalator/)).not.toBeInTheDocument();
    expect(rewards).toHaveBeenCalledWith(new Date().getTimezoneOffset(), expect.anything());
  });

  it('respects the preferences to not be told about reports or badges', async () => {
    localStorage.setItem('firefly.notifications.seen', JSON.stringify(OLD));
    saveProfile({ name: 'Priya' });
    updatePreferences({ notifyReports: false, notifyBadges: false });
    listSessions.mockResolvedValue({ sessions: [session()], total: 1 });
    rewards.mockResolvedValue(
      rewardsWith([badge({ earned: true, earnedAt: '2026-02-03T10:00:00.000Z' })]),
    );
    renderShell('/home');
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    await waitFor(() => expect(listSessions).toHaveBeenCalled());
    await waitFor(() => expect(rewards).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /new$/ })).not.toBeInTheDocument();
  });

  it('stays quiet, rather than breaking the page, when the notices cannot be loaded', async () => {
    listSessions.mockRejectedValue(new Error('offline'));
    rewards.mockRejectedValue(new Error('offline'));
    const user = userEvent.setup();
    renderShell('/home');
    expect(screen.getByRole('heading', { name: 'Home page' })).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Notifications' }));
    expect(await screen.findByText(/Nothing new/)).toBeInTheDocument();
  });
});

describe('account menu', () => {
  it('invites someone without a profile to create one', async () => {
    const user = userEvent.setup();
    renderShell('/home');
    await user.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(await screen.findByRole('link', { name: /Create your profile/ })).toHaveAttribute(
      'href',
      '/sign-in',
    );
  });

  it('shows who is using this device and signs out of it without touching saved calls', async () => {
    saveProfile({ name: 'Priya Raman', role: 'Apprentice' });
    const user = userEvent.setup();
    renderShell('/home');
    await user.click(screen.getByRole('button', { name: 'PR, account menu for Priya Raman' }));
    const panel = await screen.findByRole('region', { name: 'Account' });
    expect(panel).toHaveTextContent('Priya Raman');
    expect(panel).toHaveTextContent('Apprentice');
    await user.click(within(panel).getByRole('button', { name: /Sign out of this device/ }));
    expect(await screen.findByRole('heading', { name: 'Landing page' })).toBeInTheDocument();
    expect(getProfile()).toBeNull();
  });
});
