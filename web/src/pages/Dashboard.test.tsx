import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionSummaryDTO } from '#shared/domain/api.ts';
import { makeRewards } from '../components/rewards/rewards.fixtures.ts';
import { EMPTY_PROGRESS, trend } from '../components/progress/progress.fixtures.ts';
import { makeSummary } from '../components/report/report.fixtures.ts';
import { makeScenario } from '../components/scenario/scenario-fixtures.ts';
import { api } from '../lib/api.ts';
import type * as ApiModule from '../lib/api.ts';
import { resetProfileForTests, saveProfile } from '../lib/profile.ts';
import { resetTourForTests, useTourRequests } from '../lib/tour.ts';
import Dashboard from './Dashboard.tsx';

vi.mock('../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return {
    ...actual,
    api: { scenarios: vi.fn(), listSessions: vi.fn(), progress: vi.fn(), rewards: vi.fn() },
  };
});

const scenarios = vi.mocked(api.scenarios);
const listSessions = vi.mocked(api.listSessions);
const progress = vi.mocked(api.progress);
const rewards = vi.mocked(api.rewards);

const LIBRARY = [
  makeScenario({
    id: 'gentle-start',
    title: 'A gentle start',
    difficulty: 'starter',
    impact: 'low',
    issueType: 'sign-in-access',
    estimatedMinutes: 7,
  }),
  makeScenario({
    id: 'team-workspace',
    title: 'Team cannot open the workspace',
    difficulty: 'standard',
    impact: 'medium',
    issueType: 'service-outage',
  }),
  makeScenario({
    id: 'slow-dashboard',
    title: 'Dashboard is slow',
    difficulty: 'standard',
    impact: 'medium',
    issueType: 'slow-performance',
  }),
  makeScenario({
    id: 'big-invoice',
    title: 'A bigger invoice than expected',
    difficulty: 'challenge',
    impact: 'high',
    issueType: 'billing-licence',
  }),
  makeScenario({
    id: 'missing-orders',
    title: 'Orders missing from a report',
    difficulty: 'challenge',
    impact: 'high',
    issueType: 'data-missing',
  }),
];

let counter = 0;
/** A finished full call unless told otherwise; each one ends a minute after the last. */
function call(overrides: Partial<SessionSummaryDTO> = {}): SessionSummaryDTO {
  counter += 1;
  const minute = String(counter).padStart(2, '0');
  return makeSummary({
    id: `call-${counter}`,
    scenarioId: 'gentle-start',
    scenarioTitle: 'A gentle start',
    startedAt: `2026-11-10T10:${minute}:00.000Z`,
    endedAt: `2026-11-10T10:${minute}:30.000Z`,
    overallScore: 3.2,
    durationSeconds: 300,
    ...overrides,
  });
}
const open = (overrides: Partial<SessionSummaryDTO> = {}) =>
  call({
    status: 'active',
    completion: null,
    endedAt: null,
    overallScore: null,
    durationSeconds: null,
    ...overrides,
  });

function TourRequests() {
  return <output data-testid="tour-requests">{useTourRequests()}</output>;
}

function renderHome() {
  return render(
    <MemoryRouter>
      <main id="main" tabIndex={-1}>
        <Dashboard />
      </main>
      <TourRequests />
    </MemoryRouter>,
  );
}

const stat = (label: string) => screen.getByText(label).closest('.stat') as HTMLElement;
const findStat = async (label: string) =>
  (await screen.findByText(label)).closest('.stat') as HTMLElement;

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  resetProfileForTests();
  resetTourForTests();
  // Most tests are not about the tour, which is only offered until it has been seen.
  localStorage.setItem('firefly.tour', JSON.stringify('done'));
  scenarios.mockResolvedValue(LIBRARY);
  listSessions.mockResolvedValue({ sessions: [], total: 0 });
  progress.mockResolvedValue(EMPTY_PROGRESS);
  rewards.mockResolvedValue(makeRewards());
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Dashboard: the greeting', () => {
  it('greets a returning person by first name at the right time of day', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 19, 9, 30));
    saveProfile({ name: 'Priya Raman' });
    renderHome();
    expect(screen.getByRole('heading', { level: 1, name: 'Good morning, Priya' })).toBeVisible();
    expect(screen.getByText('Ready to practise a customer call?')).toBeVisible();
    expect(await screen.findByRole('heading', { name: 'Recommended scenarios' })).toBeVisible();
  });

  it('welcomes someone who has not made a profile, with no name to invent', async () => {
    renderHome();
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome to Firefly' })).toBeVisible();
    await screen.findByRole('heading', { name: 'Recommended scenarios' });
  });
});

describe('Dashboard: four real numbers', () => {
  it('counts full calls, averages their scores, adds up time and never counts sample calls', async () => {
    listSessions.mockResolvedValue({
      sessions: [
        call({ overallScore: 4, durationSeconds: 600 }),
        call({ overallScore: 3, durationSeconds: 300 }),
        call({ completion: 'ended-early', overallScore: 2, durationSeconds: 120 }),
        call({ isSample: true, overallScore: 5, durationSeconds: 7200 }),
        open(),
      ],
      total: 5,
    });
    renderHome();
    await screen.findByText('Badges earned');
    expect(within(stat('Scenarios completed')).getByText('2')).toBeVisible();
    expect(within(stat('Average score')).getByText('3.5 of 5')).toBeVisible();
    expect(within(stat('Badges earned')).getByText('2 of 6')).toBeVisible();
    // 600 + 300 + 120 seconds: the call that ended early still took time, the sample took none.
    expect(within(stat('Practice time')).getByText('17 min')).toBeVisible();
  });

  it('shows zeros and a dash, not made-up numbers, before the first call', async () => {
    rewards.mockResolvedValue(
      makeRewards({
        badges: makeRewards().badges.map((badge) => ({ ...badge, earned: false })),
      }),
    );
    renderHome();
    await screen.findByText('Badges earned');
    expect(within(stat('Scenarios completed')).getByText('0')).toBeVisible();
    expect(within(stat('Average score')).getByText('\u2014')).toBeVisible();
    expect(within(stat('Badges earned')).getByText('0 of 6')).toBeVisible();
    expect(within(stat('Practice time')).getByText('0 min')).toBeVisible();
  });

  it('says plainly when the badge count could not be loaded, and keeps the other numbers', async () => {
    rewards.mockRejectedValue(new Error('boom'));
    listSessions.mockResolvedValue({ sessions: [call()], total: 1 });
    renderHome();
    expect(
      await within(await findStat('Badges earned')).findByText('Not available right now'),
    ).toBeVisible();
    expect(within(stat('Scenarios completed')).getByText('1')).toBeVisible();
  });

  it('says when the totals only cover the latest calls', async () => {
    listSessions.mockResolvedValue({ sessions: [call(), call()], total: 250 });
    renderHome();
    expect(await screen.findByText('These totals use your latest 2 calls.')).toBeVisible();
  });
});

describe('Dashboard: the invitation to practise', () => {
  it('invites a new practice session when no call is open', async () => {
    renderHome();
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Start a new practice session' }),
    ).toBeVisible();
    expect(
      screen.getByText('Choose a scenario, configure the customer, and begin your simulation.'),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: /Start practice/ })).toHaveAttribute(
      'href',
      '/practice',
    );
    expect(screen.queryByRole('link', { name: /Resume call/ })).not.toBeInTheDocument();
  });

  it('offers to pick up a call that is still open before anything else', async () => {
    listSessions.mockResolvedValue({
      sessions: [
        call(),
        open({ id: 'open-call', scenarioTitle: 'Team cannot open the workspace' }),
      ],
      total: 2,
    });
    renderHome();
    expect(
      await screen.findByRole('heading', { level: 2, name: 'You have a call in progress' }),
    ).toBeVisible();
    expect(screen.getByText(/Team cannot open the workspace, started/)).toBeVisible();
    expect(screen.getByRole('link', { name: /Resume call/ })).toHaveAttribute(
      'href',
      '/calls/open-call',
    );
    expect(screen.getByRole('link', { name: 'Start a new practice' })).toHaveAttribute(
      'href',
      '/practice',
    );
  });

  it('draws the illustration only where there is room, and hides it from assistive technology', async () => {
    vi.stubGlobal(
      'matchMedia',
      (query: string) =>
        ({
          matches: true,
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList,
    );
    const { container } = renderHome();
    await screen.findByRole('heading', { name: 'Start a new practice session' });
    // The figure arrives a moment after the page, so it is waited for.
    await waitFor(() =>
      expect(container.querySelector('.dash-banner-art svg.ill-agent')).not.toBeNull(),
    );
    expect(container.querySelector('.dash-banner-art svg.ill-agent')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });
});

describe('Dashboard: recommended scenarios', () => {
  it('starts with a gentle first scenario and says why, then adds variety', async () => {
    renderHome();
    const first = (await screen.findByRole('link', { name: 'A gentle start' })).closest(
      'article',
    ) as HTMLElement;
    expect(within(first).getByText('Recommended')).toBeVisible();
    expect(within(first).getByText('Low impact \u00b7 Starter')).toBeVisible();
    expect(
      within(first).getByText('A gentle place to start: a Starter call of about 7 minutes.'),
    ).toBeVisible();
    expect(within(first).getByRole('link', { name: 'A gentle start' })).toHaveAttribute(
      'href',
      '/scenarios/gentle-start/setup',
    );

    // Four different scenarios, each linking to its own setup page; only the first is "Recommended".
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(4);
    const hrefs = cards.map((card) => within(card).getByRole('link').getAttribute('href'));
    expect(new Set(hrefs).size).toBe(4);
    expect(hrefs.every((href) => /^\/scenarios\/[\w-]+\/setup$/.test(href ?? ''))).toBe(true);
    expect(screen.getAllByText('Recommended')).toHaveLength(1);
  });

  it('gives the evidence behind a recommendation made from real practice', async () => {
    listSessions.mockResolvedValue({
      sessions: [call({ scenarioId: 'gentle-start', overallScore: 3.2 })],
      total: 1,
    });
    progress.mockResolvedValue({
      ...EMPTY_PROGRESS,
      totalSessions: 1,
      completedSessions: 1,
      focus: 'scoping-discovery',
      focusReason: 'Scoping & Discovery averaged 2.0 across 1 session.',
      dimensionTrends: EMPTY_PROGRESS.dimensionTrends.map((t) =>
        t.dimension === 'scoping-discovery'
          ? trend('scoping-discovery', [2], 'not-enough-data')
          : t,
      ),
    });
    renderHome();
    const card = (await screen.findAllByRole('article'))[0] as HTMLElement;
    expect(within(card).getByText('Recommended')).toBeVisible();
    expect(card).toHaveTextContent(
      /Scoping & Discovery is your lowest skill so far \(average 2\.0 of 5\)/,
    );
  });

  it('links View all to the library', async () => {
    renderHome();
    await screen.findAllByRole('article');
    const links = screen.getAllByRole('link', { name: /View all/ });
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/scenarios', '/history']);
  });

  it('explains an empty library instead of showing nothing', async () => {
    scenarios.mockResolvedValue([]);
    renderHome();
    expect(
      await screen.findByRole('heading', { name: 'No scenarios are available' }),
    ).toBeVisible();
  });
});

describe('Dashboard: recent practice', () => {
  it('lists the last three finished calls with a score and a link to each report', async () => {
    listSessions.mockResolvedValue({
      sessions: [
        call({ id: 'a', scenarioTitle: 'Oldest call', overallScore: 2.4 }),
        call({ id: 'b', scenarioTitle: 'Second call', overallScore: 3.0 }),
        call({ id: 'sample', scenarioTitle: 'A sample call', isSample: true }),
        call({
          id: 'c',
          scenarioTitle: 'Third call',
          completion: 'ended-early',
          overallScore: null,
        }),
        call({ id: 'd', scenarioTitle: 'Newest call', overallScore: 4.6 }),
        open({ scenarioTitle: 'Still open' }),
      ],
      total: 6,
    });
    renderHome();
    const section = (await screen.findByRole('heading', { name: 'Recent practice' })).closest(
      'section',
    ) as HTMLElement;
    await within(section).findAllByRole('listitem');
    const items = within(section).getAllByRole('listitem');
    expect(items.map((item) => item.querySelector('.dash-recent-title')?.textContent)).toEqual([
      'Newest call',
      'Third call',
      'Second call',
    ]);
    expect(within(items[0] as HTMLElement).getByText('4.6')).toBeVisible();
    expect(within(items[1] as HTMLElement).getByText('Ended early')).toBeVisible();
    expect(within(items[2] as HTMLElement).getByText('3.0')).toBeVisible();
    expect(
      within(items[0] as HTMLElement).getByRole('link', { name: 'View report: Newest call' }),
    ).toHaveAttribute('href', '/sessions/d/report');
    expect(
      within(section).queryByText(/sample call|Still open|Oldest call/i),
    ).not.toBeInTheDocument();
    expect(within(section).getByRole('link', { name: /View all/ })).toHaveAttribute(
      'href',
      '/history',
    );
  });

  it('is calm for a new learner and points at the way in', async () => {
    renderHome();
    expect(await screen.findByText('No finished calls yet')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Start practising' })).toHaveAttribute(
      'href',
      '/practice',
    );
  });

  it('can be retried when the calls cannot be loaded', async () => {
    const user = userEvent.setup();
    listSessions.mockRejectedValueOnce(new Error('boom')).mockResolvedValue({
      sessions: [call({ scenarioTitle: 'Back again' })],
      total: 1,
    });
    renderHome();
    const section = (await screen.findByRole('heading', { name: 'Recent practice' })).closest(
      'section',
    ) as HTMLElement;
    const alert = await within(section).findByRole('alert');
    await user.click(within(alert).getByRole('button', { name: /Try again/ }));
    expect(await within(section).findByText('Back again')).toBeVisible();
  });
});

describe('Dashboard: your next skill', () => {
  it('names one skill from your own scores and links to the progress page', async () => {
    progress.mockResolvedValue({
      ...EMPTY_PROGRESS,
      completedSessions: 2,
      focus: 'clarity',
      focusReason: 'Clarity averaged 2.5 across 2 sessions.',
    });
    renderHome();
    const card = (
      await screen.findByRole('heading', { name: 'Your next skill to practise' })
    ).closest('section') as HTMLElement;
    expect(await within(card).findByText('Clarity averaged 2.5 across 2 sessions.')).toBeVisible();
    expect(within(card).getByRole('link', { name: /See my progress/ })).toHaveAttribute(
      'href',
      '/progress',
    );
  });

  it('says what it is waiting for when there is no score yet', async () => {
    renderHome();
    expect(
      await screen.findByText(/Finish a practice call and Firefly will suggest one skill/),
    ).toBeVisible();
  });
});

describe('Dashboard: the optional tour', () => {
  beforeEach(() => {
    localStorage.removeItem('firefly.tour');
    resetTourForTests();
  });

  it('offers the tour to someone who has not seen it, and never opens it by itself', async () => {
    const user = userEvent.setup();
    renderHome();
    expect(
      await screen.findByRole('heading', { name: /New here\? Take the 45-second tour/ }),
    ).toBeVisible();
    expect(screen.getByTestId('tour-requests')).toHaveTextContent('0');
    await user.click(screen.getByRole('button', { name: 'Start the tour' }));
    expect(screen.getByTestId('tour-requests')).toHaveTextContent('1');
  });

  it('remembers "No thanks", stops inviting and keeps keyboard focus on the page', async () => {
    const user = userEvent.setup();
    renderHome();
    await user.click(await screen.findByRole('button', { name: 'No thanks' }));
    expect(screen.queryByText(/New here\?/)).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('firefly.tour') ?? 'null')).toBe('skipped');
    expect(document.getElementById('main')).toHaveFocus();
  });

  it('leaves the tour out once it has been seen', async () => {
    localStorage.setItem('firefly.tour', JSON.stringify('done'));
    resetTourForTests();
    renderHome();
    await screen.findByRole('heading', { name: 'Recommended scenarios' });
    expect(screen.queryByText(/New here\?/)).not.toBeInTheDocument();
  });
});

describe('Dashboard: loading and errors', () => {
  it('keeps the page in place with skeletons while the numbers arrive', () => {
    const never = new Promise<never>(() => undefined);
    scenarios.mockReturnValue(never);
    listSessions.mockReturnValue(never);
    progress.mockReturnValue(never);
    rewards.mockReturnValue(never);
    const { container } = renderHome();
    expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
    expect(container.querySelectorAll('.dash-stat-skeleton')).toHaveLength(4);
    expect(
      screen.getByRole('status', { name: 'Loading recommended scenarios' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading recent practice' })).toBeInTheDocument();
  });

  it('explains that the scenarios could not be loaded and retries them', async () => {
    const user = userEvent.setup();
    scenarios.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(LIBRARY);
    renderHome();
    expect(
      await screen.findByRole('heading', { name: 'We could not load your recommendations' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Try again/ }));
    expect(await screen.findAllByRole('article')).toHaveLength(4);
  });

  it('still offers to start practising when nothing at all can be loaded', async () => {
    scenarios.mockRejectedValue(new Error('down'));
    listSessions.mockRejectedValue(new Error('down'));
    renderHome();
    expect(
      await screen.findByRole('heading', { name: 'We could not load your home page' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: /Start practice/ })).toHaveAttribute(
      'href',
      '/practice',
    );
  });
});

describe('Dashboard: wording', () => {
  it('never uses hype, ranking or experience-point words', async () => {
    listSessions.mockResolvedValue({ sessions: [call(), call()], total: 2 });
    const { container } = renderHome();
    await screen.findAllByRole('article');
    expect(container.textContent).not.toMatch(
      /\bXP\b|experience points|leaderboard|top performer|level up/i,
    );
  });
});
