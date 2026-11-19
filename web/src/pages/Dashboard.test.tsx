import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DemoStatusDTO, ProgressDTO, SessionSummaryDTO } from '#shared/domain/api.ts';
import { DIMENSION_IDS } from '#shared/domain/vocab.ts';
import { Shell } from '../components/Shell.tsx';
import { makeScenario } from '../components/scenario/scenario-fixtures.ts';
import { api } from '../lib/api.ts';
import type * as ApiModule from '../lib/api.ts';
import { resetSoundForTests } from '../lib/sound.ts';
import { resetTourForTests } from '../lib/tour.ts';
import { ThemeProvider } from '../lib/theme.tsx';
import Dashboard from './Dashboard.tsx';

vi.mock('../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return {
    ...actual,
    api: { demo: vi.fn(), scenarios: vi.fn(), listSessions: vi.fn(), progress: vi.fn() },
  };
});
vi.mock('../components/ProviderBadge.tsx', () => ({
  ProviderBadge: () => <span>Demo mode</span>,
}));

const demo = vi.mocked(api.demo);
const scenarios = vi.mocked(api.scenarios);
const listSessions = vi.mocked(api.listSessions);
const progress = vi.mocked(api.progress);

const DEMO: DemoStatusDTO = {
  spotlightScenarioId: 'team-workspace',
  practiceSessions: 0,
  sampleSessions: 0,
  provider: { kind: 'mock', label: 'Demo mode', demo: true },
};

const EMPTY_PROGRESS: ProgressDTO = {
  totalSessions: 0,
  completedSessions: 0,
  dimensionTrends: DIMENSION_IDS.map((dimension) => ({
    dimension,
    points: [],
    average: null,
    latest: null,
    change: 'not-enough-data' as const,
  })),
  strongest: null,
  focus: null,
  focusReason: null,
  repeatedOpportunities: [],
  recentChange: 'not-enough-data',
  note: '',
};

const LIBRARY = [
  makeScenario({
    id: 'gentle-start',
    title: 'A gentle start',
    difficulty: 'starter',
    estimatedMinutes: 7,
  }),
  makeScenario({
    id: 'team-workspace',
    title: 'Team cannot open the workspace',
    difficulty: 'standard',
  }),
];

function session(overrides: Partial<SessionSummaryDTO> = {}): SessionSummaryDTO {
  return {
    id: 's1',
    scenarioId: 'gentle-start',
    scenarioTitle: 'A gentle start',
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
    dimensionScores: {
      'opening-rapport': 4,
      'scoping-discovery': 2,
      'empathy-deescalation': 3,
      clarity: 3,
      'ownership-next-steps': 3,
      closing: 3,
    },
    mentorReviewed: false,
    ...overrides,
  };
}

function renderHome() {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<Dashboard />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

// What the page loads on demand is loaded once up front, so no test waits on a first import.
beforeAll(async () => {
  await Promise.all([
    import('../components/dashboard/NextMission.tsx'),
    import('../components/mastery/MasteryStars.tsx'),
    import('../components/tour/FirstRunTour.tsx'),
  ]);
});

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  resetTourForTests();
  resetSoundForTests();
  demo.mockResolvedValue(DEMO);
  scenarios.mockResolvedValue(LIBRARY);
  listSessions.mockResolvedValue({ sessions: [], total: 0 });
  progress.mockResolvedValue(EMPTY_PROGRESS);
});

describe('Dashboard', () => {
  it('welcomes a first visit with the headline, a gentle first mission and the tour invitation', async () => {
    renderHome();
    expect(
      screen.getByRole('heading', { level: 1, name: /Practice difficult customer conversations/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Start a simulation/ })).toHaveAttribute(
      'href',
      '/scenarios',
    );
    expect(await screen.findByRole('link', { name: 'Try the demo scenario' })).toHaveAttribute(
      'href',
      '/scenarios/team-workspace/setup',
    );
    const mission = await screen.findByRole('region', { name: 'A gentle start' });
    expect(within(mission).getByText('Your first mission')).toBeInTheDocument();
    expect(within(mission).getByRole('link', { name: /Set up this call/ })).toHaveAttribute(
      'href',
      '/scenarios/gentle-start/setup',
    );
    expect(screen.getByText(/Six skills orbit the core/)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /New here\? Take the 45-second tour/ }),
    ).toBeVisible();
    expect(screen.getByText(/No practice yet/)).toBeInTheDocument();
  });

  it('recommends the next mission from real practice, with the evidence, and offers to resume an open call', async () => {
    listSessions.mockResolvedValue({
      sessions: [
        session({
          id: 'open',
          status: 'active',
          completion: null,
          endedAt: null,
          overallScore: null,
          dimensionScores: null,
        }),
        session(),
      ],
      total: 2,
    });
    progress.mockResolvedValue({
      ...EMPTY_PROGRESS,
      totalSessions: 2,
      completedSessions: 1,
      focus: 'scoping-discovery',
      focusReason: 'Scoping & Discovery averaged 2.0 across 1 session.',
      dimensionTrends: EMPTY_PROGRESS.dimensionTrends.map((t) =>
        t.dimension === 'scoping-discovery' ? { ...t, average: 2, latest: 2 } : t,
      ),
    });
    localStorage.setItem('firefly.tour', JSON.stringify('done'));
    renderHome();

    expect(await screen.findByRole('link', { name: /Resume call/ })).toHaveAttribute(
      'href',
      '/calls/open',
    );
    const mission = await screen.findByRole('region', { name: 'Team cannot open the workspace' });
    expect(within(mission).getByText('Recommended next mission')).toBeInTheDocument();
    expect(mission).toHaveTextContent(
      /Scoping & Discovery is your lowest skill so far \(average 2\.0 of 5\)/,
    );
    expect(screen.queryByText(/New here\?/)).not.toBeInTheDocument();
    expect(await screen.findByText(/6 of 6 skills lit so far/)).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: /Skill constellations/ })).toBeInTheDocument();
  });

  it('remembers "No thanks" and stops inviting', async () => {
    const user = userEvent.setup();
    renderHome();
    await user.click(await screen.findByRole('button', { name: 'No thanks' }));
    expect(screen.queryByText(/New here\?/)).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('firefly.tour') ?? 'null')).toBe('skipped');
    // The button that had focus is gone, so focus is on the page, not lost.
    expect(document.getElementById('main')).toHaveFocus();
  });

  it('opens the tour on request and walks through working examples', async () => {
    const user = userEvent.setup();
    renderHome();
    await user.click(await screen.findByRole('button', { name: 'Start the tour' }));
    const tour = await screen.findByRole('dialog', { name: 'A short tour of Firefly' });
    expect(within(tour).getByText('Step 1 of 5')).toBeInTheDocument();

    // 1. Missions: pick one and read what it means.
    await user.click(within(tour).getByRole('radio', { name: 'Challenge' }));
    expect(
      within(tour).getByText(/High pressure and sure it is not their fault/),
    ).toBeInTheDocument();
    await user.click(within(tour).getByRole('button', { name: /Next/ }));

    // 2. Hidden facts: only the good question lights a signal, and it never says what was found.
    expect(within(tour).getByText('Step 2 of 5')).toBeInTheDocument();
    await user.click(within(tour).getByRole('button', { name: 'Have you tried restarting it?' }));
    expect(within(tour).queryByRole('status')).not.toBeInTheDocument();
    await user.click(
      within(tour).getByRole('button', { name: 'When did it start, and did anything change?' }),
    );
    expect(within(tour).getByRole('status')).toHaveTextContent('Signal found');
    await user.click(within(tour).getByRole('button', { name: /Next/ }));

    // 3. The customer reacts.
    await user.click(within(tour).getByRole('button', { name: 'That is not how it works.' }));
    expect(within(tour).getByText(/The customer gets more tense/)).toBeInTheDocument();
    await user.click(within(tour).getByRole('button', { name: /Next/ }));

    // 4 and 5.
    expect(within(tour).getByText(/not a performance rating/)).toBeInTheDocument();
    await user.click(within(tour).getByRole('button', { name: /Next/ }));
    expect(within(tour).getByRole('link', { name: /Choose a mission/ })).toHaveAttribute(
      'href',
      '/scenarios',
    );
    await user.click(within(tour).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('firefly.tour') ?? 'null')).toBe('done');
    // The invitation that opened the tour has gone, so focus lands on the page.
    await waitFor(() => expect(document.getElementById('main')).toHaveFocus());
  });

  it('lets someone skip at any step, which is remembered', async () => {
    const user = userEvent.setup();
    renderHome();
    await user.click(await screen.findByRole('button', { name: 'Start the tour' }));
    const tour = await screen.findByRole('dialog', { name: 'A short tour of Firefly' });
    await user.click(within(tour).getByRole('button', { name: 'Skip tour' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('firefly.tour') ?? 'null')).toBe('skipped');
    await waitFor(() => expect(document.getElementById('main')).toHaveFocus());
  });

  it('keeps sound off unless the person turns it on in the tour', async () => {
    const user = userEvent.setup();
    renderHome();
    await user.click(await screen.findByRole('button', { name: 'Start the tour' }));
    const tour = await screen.findByRole('dialog', { name: 'A short tour of Firefly' });
    for (let i = 0; i < 4; i += 1) {
      await user.click(within(tour).getByRole('button', { name: /Next/ }));
    }
    const toggle = within(tour).getByRole('checkbox', { name: /Sound effects/ });
    expect(toggle).not.toBeChecked();
    expect(localStorage.getItem('firefly.sound')).toBeNull();
    await user.click(toggle);
    expect(toggle).toBeChecked();
    expect(JSON.parse(localStorage.getItem('firefly.sound') ?? 'null')).toBe(true);
  });
});
