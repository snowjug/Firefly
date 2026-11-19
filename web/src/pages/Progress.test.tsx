import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { deriveAchievements } from '#shared/domain/achievements.ts';
import type { DimensionTrendDTO, ProgressDTO, SessionSummaryDTO } from '#shared/domain/api.ts';
import { DIMENSION_IDS, type DimensionId } from '#shared/domain/vocab.ts';
import { makeReport, makeSession, makeSummary } from '../components/report/report.fixtures.ts';
import { makeScenario } from '../components/scenario/scenario-fixtures.ts';
import { api } from '../lib/api.ts';
import type * as ApiModule from '../lib/api.ts';
import Progress from './Progress.tsx';

vi.mock('../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return {
    ...actual,
    api: { progress: vi.fn(), scenarios: vi.fn(), listSessions: vi.fn(), getSession: vi.fn() },
  };
});

const progress = vi.mocked(api.progress);
const scenarios = vi.mocked(api.scenarios);
const listSessions = vi.mocked(api.listSessions);
const getSession = vi.mocked(api.getSession);

const NOTE = 'Based only on your completed practice sessions. Scores are coaching feedback.';

function trend(
  dimension: DimensionId,
  scores: number[],
  change: DimensionTrendDTO['change'],
): DimensionTrendDTO {
  return {
    dimension,
    points: scores.map((score, i) => ({
      sessionId: `s${i}`,
      at: new Date(Date.UTC(2026, 10, 1 + i)).toISOString(),
      score,
    })),
    average: scores.length
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : null,
    latest: scores.length ? (scores[scores.length - 1] as number) : null,
    change,
  };
}

const EMPTY: ProgressDTO = {
  totalSessions: 0,
  completedSessions: 0,
  dimensionTrends: DIMENSION_IDS.map((d) => trend(d, [], 'not-enough-data')),
  strongest: null,
  focus: null,
  focusReason: null,
  repeatedOpportunities: [],
  recentChange: 'not-enough-data',
  note: NOTE,
};

const WITH_DATA: ProgressDTO = {
  totalSessions: 6,
  completedSessions: 5,
  dimensionTrends: DIMENSION_IDS.map((d, i) =>
    trend(
      d,
      [2 + (i % 2), 3, 3 + (i % 3 === 0 ? 1 : 0), 4, 4],
      i === 0 ? 'up' : i === 1 ? 'down' : 'steady',
    ),
  ),
  strongest: 'closing',
  focus: 'scoping-discovery',
  focusReason: 'Scoping & Discovery averaged 2.5 across 5 sessions.',
  repeatedOpportunities: [
    { dimension: 'empathy-deescalation', sessions: 3, message: 'server message' },
  ],
  recentChange: 'improving',
  note: NOTE,
};

function renderProgress() {
  return render(
    <MemoryRouter>
      <Progress />
    </MemoryRouter>,
  );
}

// The journey views load on demand. Load them once up front so no test waits on the first import.
beforeAll(async () => {
  await import('../components/progress/ProgressBody.tsx');
});

beforeEach(() => {
  vi.resetAllMocks();
  scenarios.mockResolvedValue([]);
  listSessions.mockResolvedValue({ sessions: [], total: 0 });
  getSession.mockRejectedValue(new Error('No saved session in this test.'));
});

describe('Progress page', () => {
  it('explains what appears here when there is no completed practice, and never draws a chart', async () => {
    progress.mockResolvedValue(EMPTY);
    const { container } = renderProgress();
    expect(
      await screen.findByRole('heading', { name: 'No completed practice calls yet' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start a simulation/i })).toHaveAttribute(
      'href',
      '/scenarios',
    );
    expect(screen.getByText(/sample sessions from the trainer page/i)).toBeInTheDocument();
    expect(container.querySelector('svg.pg-spark')).toBeNull();
    expect(progress).toHaveBeenCalledWith(false, expect.anything());
  });

  it('leaves sample sessions out until the switch is turned on, and says when they are included', async () => {
    const user = userEvent.setup();
    progress.mockResolvedValueOnce(EMPTY).mockResolvedValue(WITH_DATA);
    renderProgress();
    await screen.findByRole('heading', { name: 'No completed practice calls yet' });

    const toggle = screen.getByRole('switch', { name: 'Include sample sessions' });
    expect(toggle).not.toBeChecked();
    expect(screen.queryByText(/sample sessions are included/i)).not.toBeInTheDocument();

    await user.click(toggle);
    await waitFor(() => expect(progress).toHaveBeenLastCalledWith(true, expect.anything()));
    expect(await screen.findByText(/sample sessions are included/i)).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(/do not describe your own practice/i);

    await user.click(toggle);
    await waitFor(() => expect(progress).toHaveBeenLastCalledWith(false, expect.anything()));
  });

  it('shows totals, a calm recent change with the API note, the strongest skill and the suggested focus', async () => {
    progress.mockResolvedValue(WITH_DATA);
    renderProgress();
    expect(await screen.findByText('Improving')).toBeInTheDocument();
    expect(screen.getByText(NOTE)).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText(/6 sessions started in all/i)).toBeInTheDocument();
    expect(
      screen.getByText('Scoping & Discovery averaged 2.5 across 5 sessions.'),
    ).toBeInTheDocument();
    const trends = screen.getAllByRole('article');
    expect(trends).toHaveLength(6);
    const closing = screen
      .getByRole('heading', { level: 3, name: 'Closing' })
      .closest('article') as HTMLElement;
    expect(within(closing).getByText('Strongest so far')).toBeInTheDocument();
    const discovery = screen
      .getByRole('heading', { level: 3, name: 'Scoping & Discovery' })
      .closest('article') as HTMLElement;
    expect(within(discovery).getByText('Suggested focus')).toBeInTheDocument();
  });

  it('gives every trend line a text alternative with all of its scores', async () => {
    progress.mockResolvedValue(WITH_DATA);
    renderProgress();
    await screen.findByText('Improving');
    const first = WITH_DATA.dimensionTrends[0] as DimensionTrendDTO;
    expect(
      screen.getByRole('img', {
        name: `Opening & Rapport scores across 5 calls, oldest to newest: ${first.points.map((p) => p.score).join(', ')}.`,
      }),
    ).toBeInTheDocument();
    const card = screen
      .getByRole('heading', { level: 3, name: 'Opening & Rapport' })
      .closest('article') as HTMLElement;
    expect(within(card).getByText('Trending up')).toBeInTheDocument();
    expect(within(card).getByText('4 of 5')).toBeInTheDocument();
  });

  it('offers the scores as a table', async () => {
    const user = userEvent.setup();
    progress.mockResolvedValue(WITH_DATA);
    renderProgress();
    await user.click(await screen.findByRole('button', { name: 'Show scores as a table' }));
    const table = screen.getByRole('table', {
      name: 'Skill scores out of 5 for each completed call',
    });
    expect(within(table).getAllByRole('row')).toHaveLength(6);
  });

  it('lists repeated opportunities and never ranks, compares people or counts streaks', async () => {
    progress.mockResolvedValue(WITH_DATA);
    const { container } = renderProgress();
    expect(
      await screen.findByText(/came up as an improvement area in 3 of 5 completed calls/i),
    ).toBeInTheDocument();
    expect(container.textContent).not.toMatch(
      /leaderboard|\brank|streak|badge|\bXP\b|experience points|top performer/i,
    );
    expect(screen.getByText(/not an assessment of you/i)).toBeInTheDocument();
  });

  it('offers a retry when progress cannot be loaded', async () => {
    const user = userEvent.setup();
    progress.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(WITH_DATA);
    renderProgress();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Improving')).toBeInTheDocument();
  });
});

let created = 0;
/** A completed practice call for the journey views. Later calls always finish later. */
function call(overrides: Partial<SessionSummaryDTO> = {}): SessionSummaryDTO {
  created += 1;
  const minute = String(created).padStart(2, '0');
  return makeSummary({
    id: `call-${created}`,
    scenarioId: `scenario-${created}`,
    scenarioTitle: `Scenario ${created}`,
    startedAt: `2026-11-10T10:${minute}:00.000Z`,
    endedAt: `2026-11-10T10:${minute}:30.000Z`,
    overallScore: 3.5,
    dimensionScores: { clarity: 3, closing: 4 },
    ...overrides,
  });
}

describe('Progress page: the mastery journey', () => {
  it('lights each constellation from completed calls and names the one to light next', async () => {
    progress.mockResolvedValue(WITH_DATA);
    listSessions.mockResolvedValue({ sessions: [call(), call()], total: 2 });
    renderProgress();

    const hero = await screen.findByRole('region', { name: 'Two of six skills are lit.' });
    expect(within(hero).getByText(/The brightest is/)).toHaveTextContent(
      'The brightest is Guide (Clarity), Glowing.',
    );
    expect(within(hero).getByRole('img', { name: /Guide, Clarity: Glowing/ })).toBeInTheDocument();
    const next = within(hero).getByText('Next to light up').closest('div') as HTMLElement;
    expect(within(next).getByText('Investigator')).toBeInTheDocument();
    expect(within(next).getByText(/Dormant now\. To reach Kindling/)).toBeInTheDocument();
    expect(within(next).getByText('a completed call that scores this skill')).toBeInTheDocument();
  });

  it('explains how skills light up in words', async () => {
    const user = userEvent.setup();
    progress.mockResolvedValue(WITH_DATA);
    listSessions.mockResolvedValue({ sessions: [call()], total: 1 });
    renderProgress();
    await user.click(await screen.findByText('How skills light up'));
    const legend = screen.getByText('How skills light up').closest('details') as HTMLElement;
    for (const tier of ['Dormant', 'Kindling', 'Glowing', 'Radiant', 'Beacon']) {
      expect(within(legend).getByText(tier, { selector: 'strong' })).toBeInTheDocument();
    }
    expect(
      within(legend).getByText(/Time spent, message counts and other people do not change it/),
    ).toBeInTheDocument();
  });

  it('counts sample calls only while the switch is on, and says so', async () => {
    const user = userEvent.setup();
    const own = call({ dimensionScores: { clarity: 3 } });
    const sample = call({ isSample: true, dimensionScores: { closing: 4 } });
    progress.mockResolvedValue(WITH_DATA);
    listSessions.mockImplementation(async (params) => ({
      sessions: params?.includeSamples === false ? [own] : [own, sample],
      total: 2,
    }));
    renderProgress();

    expect(await screen.findByRole('region', { name: 'One of six skills is lit.' })).toBeVisible();
    expect(screen.getByText('Your practice, as light')).toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: 'Include sample sessions' }));
    expect(await screen.findByRole('region', { name: 'Two of six skills are lit.' })).toBeVisible();
    expect(screen.getByText('Sample practice, as light')).toBeInTheDocument();
    expect(listSessions).toHaveBeenLastCalledWith(
      expect.objectContaining({ includeSamples: true }),
      expect.anything(),
    );
  });

  it('draws the completed calls as a path, newest first, each opening its report', async () => {
    const older = call({ id: 'older', scenarioTitle: 'Older call', overallScore: 2.5 });
    const open = call({ status: 'active', completion: null, endedAt: null, overallScore: null });
    const early = call({ completion: 'ended-early' });
    const newer = call({
      id: 'newer',
      scenarioTitle: 'Newer call',
      overallScore: 4.5,
      difficulty: 'challenge',
    });
    progress.mockResolvedValue(WITH_DATA);
    listSessions.mockResolvedValue({ sessions: [older, open, early, newer], total: 4 });
    renderProgress();

    const path = await screen.findByRole('list', { name: 'Completed calls, newest first' });
    const items = within(path).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Newer call');
    expect(items[0]).toHaveTextContent('Challenge');
    expect(within(items[0] as HTMLElement).getByLabelText('Overall 4.5 out of 5')).toBeVisible();
    expect(within(items[0] as HTMLElement).getByRole('link')).toHaveAttribute(
      'href',
      '/sessions/newer/report',
    );
    expect(items[1]).toHaveTextContent('Older call');
  });

  it('shows the latest twelve calls and points to History for the rest', async () => {
    progress.mockResolvedValue(WITH_DATA);
    const many = Array.from({ length: 14 }, () => call());
    listSessions.mockResolvedValue({ sessions: many, total: 14 });
    renderProgress();
    const path = await screen.findByRole('list', { name: 'Completed calls, newest first' });
    expect(within(path).getAllByRole('listitem')).toHaveLength(12);
    expect(screen.getByText(/Showing the latest 12 of 14 completed calls/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute('href', '/history');
  });

  it('reads milestones from saved reports and never awards one a report does not show', async () => {
    progress.mockResolvedValue(WITH_DATA);
    listSessions.mockResolvedValue({
      sessions: [call({ id: 'readable' }), call({ id: 'unreadable' })],
      total: 2,
    });
    getSession.mockImplementation(async (id) => {
      if (id === 'readable') return makeSession({ id: 'readable' });
      throw new Error('offline');
    });
    const earnedIds = deriveAchievements(makeReport(), { proficiency: 'novice' }).map((a) => a.id);
    expect(earnedIds).toContain('complete-the-loop');

    renderProgress();
    const section = await screen.findByRole('region', { name: 'Milestones' });
    expect(
      await within(section).findByText(`${earnedIds.length} of 6 earned so far`),
    ).toBeInTheDocument();

    const loop = within(section)
      .getByRole('heading', { level: 3, name: 'Complete the Loop' })
      .closest('li') as HTMLElement;
    expect(loop).toHaveAttribute('data-earned', 'true');
    expect(within(loop).getByText(/Earned in 1 call/)).toBeInTheDocument();
    expect(
      within(loop).getByRole('link', { name: 'Locked out after a password reset' }),
    ).toHaveAttribute('href', '/sessions/readable/report');
    expect(within(loop).getByText(/Evidence quote for closing\./)).toBeInTheDocument();

    const signal = within(section)
      .getByRole('heading', { level: 3, name: 'Found the Signal' })
      .closest('li') as HTMLElement;
    expect(signal).toHaveAttribute('data-earned', 'false');
    expect(within(signal).getByText('Not earned yet.')).toBeInTheDocument();
    expect(
      within(section).getByText(/1 report could not be read just now, so it was left out/),
    ).toBeInTheDocument();
    expect(getSession).toHaveBeenCalledTimes(2);
  });

  it('suggests the next mission from your own practice, and not from sample calls', async () => {
    const user = userEvent.setup();
    scenarios.mockResolvedValue([
      makeScenario({ id: 'gentle-start', title: 'A gentle start', difficulty: 'starter' }),
      makeScenario({ id: 'team-workspace', title: 'Team cannot open the workspace' }),
    ]);
    progress.mockResolvedValue(WITH_DATA);
    listSessions.mockResolvedValue({
      sessions: [call({ scenarioId: 'gentle-start', difficulty: 'starter' })],
      total: 1,
    });
    renderProgress();

    expect(await screen.findByRole('link', { name: /Set up this call/ })).toHaveAttribute(
      'href',
      '/scenarios/team-workspace/setup',
    );
    await user.click(screen.getByRole('switch', { name: 'Include sample sessions' }));
    await screen.findByText(/sample sessions are included/i);
    expect(screen.queryByRole('link', { name: /Set up this call/ })).not.toBeInTheDocument();
  });

  it('points each repeated opportunity at a scenario built to practise it', async () => {
    scenarios.mockResolvedValue([
      makeScenario({
        id: 'calm-down',
        title: 'Calming a tense call',
        difficulty: 'starter',
        coachingFocus: ['empathy-deescalation'],
      }),
    ]);
    progress.mockResolvedValue(WITH_DATA);
    listSessions.mockResolvedValue({ sessions: [call()], total: 1 });
    renderProgress();
    const practise = await screen.findByRole('link', { name: /Practise it in/ });
    expect(practise).toHaveTextContent('Calming a tense call');
    expect(practise).toHaveAttribute('href', '/scenarios/calm-down/setup');
  });

  it('does not rebuild the opportunities when the calls finish loading', async () => {
    progress.mockResolvedValue(WITH_DATA);
    let release: (answer: Awaited<ReturnType<typeof api.listSessions>>) => void = () => undefined;
    listSessions.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    renderProgress();
    const before = await screen.findByText(
      /came up as an improvement area in 3 of 5 completed calls/i,
    );

    release({ sessions: [call()], total: 1 });
    await screen.findByRole('region', { name: /skills? (is|are) lit/ });
    // A rebuilt section would leave the old element detached from the page.
    expect(before).toBeInTheDocument();
  });

  it('keeps the rest of the page when the calls cannot be loaded, and can retry', async () => {
    const user = userEvent.setup();
    progress.mockResolvedValue(WITH_DATA);
    listSessions
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue({ sessions: [call()], total: 1 });
    renderProgress();
    expect(
      await screen.findByText(/couldn.t load your calls to draw your constellations/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Skill by skill' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('region', { name: /skills? (is|are) lit/ })).toBeVisible();
  });
});
