import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DimensionTrendDTO, ProgressDTO } from '#shared/domain/api.ts';
import { DIMENSION_IDS, type DimensionId } from '#shared/domain/vocab.ts';
import { api } from '../lib/api.ts';
import type * as ApiModule from '../lib/api.ts';
import Progress from './Progress.tsx';

vi.mock('../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, api: { progress: vi.fn() } };
});

const progress = vi.mocked(api.progress);

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

beforeEach(() => {
  vi.resetAllMocks();
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

  it('lists repeated opportunities and never ranks, scores people or awards anything', async () => {
    progress.mockResolvedValue(WITH_DATA);
    const { container } = renderProgress();
    expect(
      await screen.findByText(/came up as an improvement area in 3 of 5 completed calls/i),
    ).toBeInTheDocument();
    expect(container.textContent).not.toMatch(
      /leaderboard|rank|streak|badge|points|top performer/i,
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
