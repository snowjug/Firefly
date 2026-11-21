import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionSummaryDTO } from '#shared/domain/api.ts';
import { EMPTY_PROGRESS, trend } from '../components/progress/progress.fixtures.ts';
import { makeSummary } from '../components/report/report.fixtures.ts';
import { makeRewards } from '../components/rewards/rewards.fixtures.ts';
import { makeScenario } from '../components/scenario/scenario-fixtures.ts';
import { useWorldPose } from '../components/world/useWorldPose.ts';
import { ApiError, api } from '../lib/api.ts';
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
vi.mock('../components/world/useWorldPose.ts', () => ({ useWorldPose: vi.fn() }));

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
    persona: { name: 'Daniel Osei', role: 'Project lead', organisation: 'Proseware' },
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
];

const call = (() => {
  let counter = 0;
  return (overrides: Partial<SessionSummaryDTO> = {}): SessionSummaryDTO => {
    counter += 1;
    // A finished full call unless told otherwise; each one ends a minute after the last.
    const started = new Date(Date.UTC(2026, 10, 10, 10, counter));
    return makeSummary({
      id: `call-${counter}`,
      scenarioId: 'gentle-start',
      scenarioTitle: 'A gentle start',
      startedAt: started.toISOString(),
      endedAt: new Date(started.getTime() + 30_000).toISOString(),
      overallScore: 3.2,
      durationSeconds: 300,
      ...overrides,
    });
  };
})();
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

const section = (name: string) => screen.findByRole('region', { name });
/** The row of the practice ledger with this label. */
const ledgerRow = (label: string) =>
  screen.getByText(label, { selector: 'dt' }).closest('.ff-ledger__row') as HTMLElement;

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
    expect(screen.getByRole('heading', { level: 1, name: 'Good morning, Priya.' })).toBeVisible();
    expect(screen.getByText('Ready to practise a customer call?')).toBeVisible();
    expect(screen.getByText(/^Home\s·/)).toBeVisible();
    await section('A gentle start');
  });

  it('welcomes someone who has not made a profile, with no name to invent', async () => {
    renderHome();
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome to Firefly.' })).toBeVisible();
    await section('A gentle start');
  });

  it('asks the field for a calm presence, and nothing louder', () => {
    renderHome();
    expect(vi.mocked(useWorldPose)).toHaveBeenCalledWith({ intensity: 0.65 });
  });
});

describe('Dashboard: the next mission', () => {
  it('shows the recommended mission large, with who is calling, its settings and why', async () => {
    renderHome();
    const hero = await section('A gentle start');
    expect(within(hero).getByText('Recommended')).toBeVisible();
    expect(within(hero).getByText('Maya Okafor, IT administrator, Northwind Foods')).toBeVisible();
    expect(
      within(hero).getByText(
        'Low impact \u00b7 Starter \u00b7 Starts frustrated \u00b7 First contact \u00b7 7 min',
      ),
    ).toBeVisible();
    expect(
      within(hero).getByText('A gentle place to start: a Starter call of about 7 minutes.'),
    ).toBeVisible();
    expect(within(hero).getByRole('link', { name: /Calibrate this mission/ })).toHaveAttribute(
      'href',
      '/scenarios/gentle-start/setup',
    );
    expect(within(hero).getByRole('link', { name: 'See all missions' })).toHaveAttribute(
      'href',
      '/scenarios',
    );
  });

  it('draws the mission as an instrument with the glint, hidden from assistive technology', async () => {
    const { container } = renderHome();
    await section('A gentle start');
    const glyph = container.querySelector('.home-hero__figure svg.sig-glyph');
    expect(glyph).toHaveAttribute('aria-hidden', 'true');
    expect(glyph).toHaveAttribute('data-recommended');
    // No cartoon figure and no picture of any kind: the page is words and one instrument.
    expect(container.querySelector('.ill-agent, img')).toBeNull();
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
    expect(
      await screen.findByText(
        /Scoping & Discovery is your lowest skill so far \(average 2\.0 of 5\)/,
      ),
    ).toBeVisible();
    expect(screen.getByText('Recommended')).toBeVisible();
  });

  it('still names the recommendation when the map does not know its kind of issue', async () => {
    scenarios.mockResolvedValue([
      makeScenario({
        id: 'new-kind',
        title: 'A kind of call the map has not heard of',
        issueType: 'something-new' as never,
        difficulty: 'starter',
      }),
    ]);
    renderHome();
    const hero = await section('A kind of call the map has not heard of');
    expect(within(hero).getByRole('link', { name: /Calibrate this mission/ })).toHaveAttribute(
      'href',
      '/scenarios/new-kind/setup',
    );
    expect(screen.queryByRole('heading', { name: 'No scenarios are available' })).toBeNull();
  });

  it('explains an empty library instead of showing nothing', async () => {
    scenarios.mockResolvedValue([]);
    renderHome();
    expect(
      await screen.findByRole('heading', { name: 'No scenarios are available' }),
    ).toBeVisible();
  });

  it('puts a call that is still open before anything else, and keeps the suggestion quieter', async () => {
    listSessions.mockResolvedValue({
      sessions: [
        call(),
        open({
          id: 'open-call',
          scenarioId: 'team-workspace',
          scenarioTitle: 'Team cannot open the workspace',
        }),
      ],
      total: 2,
    });
    renderHome();
    const hero = await section('Team cannot open the workspace');
    expect(screen.getByText('A call is waiting where you left it.')).toBeVisible();
    expect(within(hero).getByText('You have a call in progress')).toBeVisible();
    expect(hero).toHaveTextContent(/Started .+\. Everything you have sent is saved\./);
    expect(within(hero).getByText('Daniel Osei, Project lead, Proseware')).toBeVisible();
    expect(within(hero).getByRole('link', { name: /Return to your call/ })).toHaveAttribute(
      'href',
      '/calls/open-call',
    );
    expect(within(hero).getByRole('link', { name: 'Start a new practice' })).toHaveAttribute(
      'href',
      '/practice',
    );
    expect(screen.queryByRole('link', { name: /Calibrate this mission/ })).not.toBeInTheDocument();
    // The recommendation is still one press away, in a line of its own.
    const also = await section('Also suggested');
    expect(within(also).getByRole('link')).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/scenarios\/[\w-]+\/setup$/),
    );
  });

  it('still offers the open call when the library cannot be loaded', async () => {
    scenarios.mockRejectedValue(new Error('down'));
    listSessions.mockResolvedValue({
      sessions: [open({ id: 'open-call', scenarioTitle: 'Still open' })],
      total: 1,
    });
    renderHome();
    const hero = await section('Still open');
    expect(within(hero).getByRole('link', { name: /Return to your call/ })).toHaveAttribute(
      'href',
      '/calls/open-call',
    );
    // Nobody is named when the library is not there to ask.
    expect(hero.querySelector('.home-hero__persona')).toBeNull();
  });
});

describe('Dashboard: what the practice adds up to', () => {
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
    const region = await section('Your practice so far');
    expect(await within(region).findByText('2 of 6')).toBeVisible();
    expect(within(ledgerRow('Scenarios completed')).getByText('2')).toBeVisible();
    expect(within(ledgerRow('Average score')).getByText('3.5 of 5')).toBeVisible();
    expect(within(ledgerRow('Badges earned')).getByText('555 points')).toBeVisible();
    // 600 + 300 + 120 seconds: the call that ended early still took time, the sample took none.
    expect(within(ledgerRow('Practice time')).getByText('17 min')).toBeVisible();
  });

  it('puts no numbers where there is nothing to count, only one sentence', async () => {
    renderHome();
    expect(
      await screen.findByText(/^No finished calls yet\. Finish one and this page/),
    ).toBeVisible();
    expect(screen.queryByText('Scenarios completed')).not.toBeInTheDocument();
    expect(screen.queryByText('Average score')).not.toBeInTheDocument();
    expect(screen.queryByText('0 min')).not.toBeInTheDocument();
    // Nothing but the sentence and the way on: no empty ledger, no empty "last call".
    expect(screen.queryByRole('region', { name: 'Your last call' })).not.toBeInTheDocument();
  });

  it('says why there is no average yet, without a made-up score', async () => {
    listSessions.mockResolvedValue({
      sessions: [call({ overallScore: null, durationSeconds: 90 })],
      total: 1,
    });
    renderHome();
    await section('Your practice so far');
    expect(within(ledgerRow('Average score')).getByText('\u2014')).toBeVisible();
    expect(
      within(ledgerRow('Average score')).getByText('Appears after your first finished call.'),
    ).toBeVisible();
  });

  it('says plainly when the badge count could not be loaded, and keeps the other rows', async () => {
    rewards.mockRejectedValue(new Error('boom'));
    listSessions.mockResolvedValue({ sessions: [call()], total: 1 });
    renderHome();
    await section('Your practice so far');
    expect(await screen.findByText('Not available right now')).toBeVisible();
    expect(within(ledgerRow('Badges earned')).getByText('\u2014')).toBeVisible();
    expect(within(ledgerRow('Scenarios completed')).getByText('1')).toBeVisible();
  });

  it('says when the totals only cover the latest calls', async () => {
    listSessions.mockResolvedValue({ sessions: [call(), call()], total: 250 });
    renderHome();
    expect(await screen.findByText('These totals use your latest 2 calls.')).toBeVisible();
  });
});

describe('Dashboard: the last call', () => {
  it('shows the latest finished call, with its score and a link to its report', async () => {
    listSessions.mockResolvedValue({
      sessions: [
        call({ id: 'a', scenarioTitle: 'Oldest call', overallScore: 2.4 }),
        call({ id: 'sample', scenarioTitle: 'A sample call', isSample: true }),
        call({ id: 'd', scenarioTitle: 'Newest call', overallScore: 4.6 }),
        open({ scenarioTitle: 'Still open' }),
      ],
      total: 4,
    });
    renderHome();
    const last = await section('Your last call');
    expect(within(last).getByText('Newest call')).toBeVisible();
    expect(within(last).getByText('4.6')).toBeVisible();
    expect(within(last).getByText('Completed')).toBeVisible();
    expect(within(last).getByRole('link', { name: 'View report: Newest call' })).toHaveAttribute(
      'href',
      '/sessions/d/report',
    );
    expect(
      within(last).queryByText(/Oldest call|A sample call|Still open/),
    ).not.toBeInTheDocument();
    expect(within(last).getByRole('link', { name: 'View all calls' })).toHaveAttribute(
      'href',
      '/history',
    );
  });

  it('says so, and has no score, when the latest call ended early', async () => {
    listSessions.mockResolvedValue({
      sessions: [call({ id: 'early', completion: 'ended-early', overallScore: null })],
      total: 1,
    });
    renderHome();
    const last = await section('Your last call');
    expect(within(last).getByText('Ended early')).toBeVisible();
    expect(within(last).getByText('No score')).toBeInTheDocument();
  });

  it('is calm when calls were started but none has finished, and points at the way in', async () => {
    listSessions.mockResolvedValue({
      sessions: [call({ status: 'evaluation_failed', completion: null, overallScore: null })],
      total: 1,
    });
    renderHome();
    const last = await section('Your last call');
    expect(within(last).getByText('No finished calls yet')).toBeVisible();
    expect(within(last).getByRole('link', { name: 'Start practising' })).toHaveAttribute(
      'href',
      '/practice',
    );
  });

  it('can be retried when the calls cannot be loaded', async () => {
    const user = userEvent.setup();
    listSessions.mockRejectedValueOnce(new ApiError(0, 'network', 'Can’t reach Firefly.', true));
    listSessions.mockResolvedValue({
      sessions: [call({ scenarioTitle: 'Back again' })],
      total: 1,
    });
    renderHome();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('We could not load your calls');
    expect(alert).toHaveTextContent('Can’t reach Firefly.');
    await user.click(within(alert).getByRole('button', { name: /Try again/ }));
    expect(await screen.findByText('Back again')).toBeVisible();
  });
});

describe('Dashboard: your next skill', () => {
  beforeEach(() => {
    listSessions.mockResolvedValue({ sessions: [call()], total: 1 });
  });

  it('names one skill from your own scores and links to the progress page', async () => {
    progress.mockResolvedValue({
      ...EMPTY_PROGRESS,
      completedSessions: 2,
      focus: 'clarity',
      focusReason: 'Clarity averaged 2.5 across 2 sessions.',
    });
    renderHome();
    const skill = await section('Your next skill to practise');
    expect(await within(skill).findByText('Clarity averaged 2.5 across 2 sessions.')).toBeVisible();
    expect(within(skill).getByText('Clarity')).toBeVisible();
    expect(within(skill).getByRole('link', { name: /See my progress/ })).toHaveAttribute(
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

  it('can be retried on its own when the progress cannot be loaded', async () => {
    const user = userEvent.setup();
    progress.mockRejectedValueOnce(new Error('boom'));
    progress.mockResolvedValue({ ...EMPTY_PROGRESS, focus: 'closing', focusReason: 'Closing.' });
    renderHome();
    const skill = await section('Your next skill to practise');
    expect(
      await within(skill).findByText('We could not load your progress just now.'),
    ).toBeVisible();
    await user.click(within(skill).getByRole('button', { name: /Try again/ }));
    expect(await within(skill).findByText('Closing')).toBeVisible();
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
    // Offered at the top, so it is not listed a second time with the other ways on.
    expect(screen.queryByRole('button', { name: 'Take the tour' })).not.toBeInTheDocument();
  });

  it('remembers "No thanks", stops inviting and keeps keyboard focus on the page', async () => {
    const user = userEvent.setup();
    renderHome();
    await user.click(await screen.findByRole('button', { name: 'No thanks' }));
    expect(screen.queryByText(/New here\?/)).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('firefly.tour') ?? 'null')).toBe('skipped');
    expect(document.getElementById('main')).toHaveFocus();
  });

  it('leaves the offer out once the tour has been seen, and keeps a way back to it', async () => {
    const user = userEvent.setup();
    localStorage.setItem('firefly.tour', JSON.stringify('done'));
    resetTourForTests();
    renderHome();
    await section('A gentle start');
    expect(screen.queryByText(/New here\?/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Take the tour' }));
    expect(screen.getByTestId('tour-requests')).toHaveTextContent('1');
  });
});

describe('Dashboard: the ways on', () => {
  it('lists the missions, the history and the progress, each with where it goes', async () => {
    renderHome();
    // The page settles first: the links are remounted when the calls arrive.
    await section('A gentle start');
    const nav = screen.getByRole('navigation', { name: 'Quick links' });
    const hrefs = within(nav)
      .getAllByRole('link')
      .map((link) => [link.textContent, link.getAttribute('href')]);
    expect(hrefs).toEqual([
      ['Missions', '/scenarios'],
      ['History', '/history'],
      ['Progress', '/progress'],
    ]);
    expect(within(nav).getByText('Every call you have practised, newest first.')).toBeVisible();
  });
});

describe('Dashboard: loading and errors', () => {
  it('keeps the page in place with quiet placeholders while the numbers arrive', () => {
    const never = new Promise<never>(() => undefined);
    scenarios.mockReturnValue(never);
    listSessions.mockReturnValue(never);
    progress.mockReturnValue(never);
    rewards.mockReturnValue(never);
    renderHome();
    expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
    expect(screen.getByRole('status', { name: 'Loading your next mission' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading your practice' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading recent practice' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Quick links' })).toBeVisible();
  });

  it('explains that the scenarios could not be loaded and retries them', async () => {
    const user = userEvent.setup();
    scenarios.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(LIBRARY);
    renderHome();
    expect(
      await screen.findByRole('heading', { name: 'We could not load your next mission' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Try again/ }));
    expect(await section('A gentle start')).toBeVisible();
  });

  it('still offers to start practising when nothing at all can be loaded, offline included', async () => {
    const offline = new ApiError(0, 'network', 'Can’t reach Firefly right now.', true);
    scenarios.mockRejectedValue(offline);
    listSessions.mockRejectedValue(offline);
    renderHome();
    expect(
      await screen.findByRole('heading', { name: 'We could not load your home page' }),
    ).toBeVisible();
    expect(screen.getByText('Can’t reach Firefly right now.')).toBeVisible();
    expect(screen.getByRole('link', { name: /Start practice/ })).toHaveAttribute(
      'href',
      '/practice',
    );
    expect(screen.getByRole('navigation', { name: 'Quick links' })).toBeVisible();
  });
});

describe('Dashboard: imperfect content', () => {
  it('lets a very long mission title, persona and open call wrap and show every word', async () => {
    const title = 'A very long recommended mission title '.repeat(6).trim();
    scenarios.mockResolvedValue([
      makeScenario({
        id: 'long',
        title,
        difficulty: 'starter',
        persona: {
          name: 'Maximilian Featherstonehaugh-Smythe',
          role: 'Senior principal customer-facing operations and escalations coordinator',
          organisation: 'The International Association of Extremely Long Organisation Names',
        },
      }),
    ]);
    renderHome();
    const hero = await section(title);
    expect(within(hero).getByRole('heading', { level: 2 })).toHaveTextContent(title);
    expect(
      within(hero).getByText(/Maximilian Featherstonehaugh-Smythe, Senior principal/),
    ).toBeVisible();
  });

  it('copes with exactly one call', async () => {
    listSessions.mockResolvedValue({ sessions: [call({ scenarioTitle: 'Only call' })], total: 1 });
    renderHome();
    const last = await section('Your last call');
    expect(within(last).getByText('Only call')).toBeVisible();
    expect(within(ledgerRow('Scenarios completed')).getByText('1')).toBeVisible();
  });

  it('copes with a hundred calls and a total far above them', async () => {
    const many = Array.from({ length: 100 }, () => call());
    listSessions.mockResolvedValue({ sessions: many, total: 4000 });
    renderHome();
    expect(await screen.findByText('These totals use your latest 100 calls.')).toBeVisible();
    expect(within(ledgerRow('Scenarios completed')).getByText('100')).toBeVisible();
  });

  it('greets by the first name only, and ignores a profile that is only spaces', async () => {
    saveProfile({ name: 'Ana Maria de la Cruz' });
    const { unmount } = renderHome();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/, Ana\.$/);
    unmount();
    localStorage.clear();
    resetProfileForTests();
    saveProfile({ name: '   ' });
    renderHome();
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome to Firefly.' })).toBeVisible();
  });
});

describe('Dashboard: wording', () => {
  it('never uses hype, ranking or experience-point words, or an exclamation mark', async () => {
    listSessions.mockResolvedValue({ sessions: [call(), call()], total: 2 });
    const { container } = renderHome();
    await section('Your last call');
    expect(container.textContent).not.toMatch(
      /\bXP\b|experience points|leaderboard|top performer|level up|streak/i,
    );
    expect(container.textContent).not.toContain('!');
  });
});
