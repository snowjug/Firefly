import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProgressDTO } from '#shared/domain/api.ts';
import { DIMENSION_IDS, type DimensionId } from '#shared/domain/vocab.ts';
import {
  EMPTY_PROGRESS,
  PROGRESS_NOTE,
  PROGRESS_WITH_DATA,
  trend,
} from '../components/progress/progress.fixtures.ts';
import { makeScenario } from '../components/scenario/scenario-fixtures.ts';
import { api } from '../lib/api.ts';
import type * as ApiModule from '../lib/api.ts';
import Progress from './Progress.tsx';

vi.mock('../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, api: { progress: vi.fn(), scenarios: vi.fn(), listSessions: vi.fn() } };
});

const progress = vi.mocked(api.progress);
const scenarios = vi.mocked(api.scenarios);
const listSessions = vi.mocked(api.listSessions);

function renderProgress() {
  return render(
    <MemoryRouter>
      <Progress />
    </MemoryRouter>,
  );
}

/** Progress where each skill has the scores given (a skill left out has none). */
function withScores(
  scores: Partial<Record<DimensionId, number[]>>,
  overrides: Partial<ProgressDTO> = {},
): ProgressDTO {
  return {
    ...PROGRESS_WITH_DATA,
    dimensionTrends: DIMENSION_IDS.map((id) => {
      const list = scores[id] ?? [];
      return trend(id, list, list.length >= 4 ? 'steady' : 'not-enough-data');
    }),
    ...overrides,
  };
}

const skillCard = (name: string) =>
  screen.getByRole('heading', { level: 3, name }).closest('article') as HTMLElement;

beforeEach(() => {
  vi.resetAllMocks();
  scenarios.mockResolvedValue([]);
  listSessions.mockResolvedValue({ sessions: [], total: 0 });
});

describe('Progress: nothing completed yet', () => {
  it('explains what appears here and how to get it, and never draws a chart', async () => {
    progress.mockResolvedValue(EMPTY_PROGRESS);
    const { container } = renderProgress();
    expect(
      await screen.findByRole('heading', { name: 'No completed practice calls yet' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'My progress' })).toBeVisible();
    expect(screen.getByRole('link', { name: /Start practice/ })).toHaveAttribute(
      'href',
      '/practice',
    );
    expect(screen.getByRole('link', { name: 'Open the Trainer page' })).toHaveAttribute(
      'href',
      '/trainer',
    );
    expect(screen.getByText(/sample sessions from the Trainer page/i)).toBeInTheDocument();
    expect(container.querySelector('svg.pg-spark')).toBeNull();
    expect(progress).toHaveBeenCalledWith(false, expect.anything());
    // Nothing else is fetched for a page with nothing to show.
    expect(scenarios).not.toHaveBeenCalled();
    expect(listSessions).not.toHaveBeenCalled();
  });

  it('shows a skeleton while loading, and can be retried when it fails', async () => {
    const user = userEvent.setup();
    progress.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(PROGRESS_WITH_DATA);
    renderProgress();
    const alert = await screen.findByRole('alert');
    expect(
      within(alert).getByRole('heading', { name: 'We couldn\u2019t load your progress' }),
    ).toBeVisible();
    await user.click(within(alert).getByRole('button', { name: /Try again/ }));
    expect(await screen.findByRole('heading', { name: 'Skill by skill' })).toBeVisible();
  });

  it('keeps the header and the switch in place while loading', () => {
    progress.mockReturnValue(new Promise(() => undefined));
    renderProgress();
    expect(screen.getByRole('heading', { level: 1, name: 'My progress' })).toBeVisible();
    expect(screen.getByRole('switch', { name: 'Include sample sessions' })).toBeVisible();
    expect(screen.getByRole('status', { name: 'Loading your progress' })).toBeInTheDocument();
  });
});

describe('Progress: sample sessions', () => {
  it('leaves them out until the switch is turned on, and says when they are included', async () => {
    const user = userEvent.setup();
    progress.mockResolvedValueOnce(EMPTY_PROGRESS).mockResolvedValue(PROGRESS_WITH_DATA);
    renderProgress();
    await screen.findByRole('heading', { name: 'No completed practice calls yet' });

    const toggle = screen.getByRole('switch', { name: 'Include sample sessions' });
    expect(toggle).not.toBeChecked();
    expect(screen.queryByText('Sample sessions are included.')).not.toBeInTheDocument();

    await user.click(toggle);
    await waitFor(() => expect(progress).toHaveBeenLastCalledWith(true, expect.anything()));
    expect(await screen.findByText('Sample sessions are included.')).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(/do not describe your own practice/i);

    await user.click(toggle);
    await waitFor(() => expect(progress).toHaveBeenLastCalledWith(false, expect.anything()));
    await waitFor(() =>
      expect(screen.queryByText('Sample sessions are included.')).not.toBeInTheDocument(),
    );
  });

  it('dims the page and marks it busy while the other numbers load', async () => {
    const user = userEvent.setup();
    let release: (value: ProgressDTO) => void = () => undefined;
    progress.mockResolvedValueOnce(PROGRESS_WITH_DATA).mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    const { container } = renderProgress();
    await screen.findByRole('heading', { name: 'Skill by skill' });
    expect(container.querySelector('.pg-content')).toHaveAttribute('aria-busy', 'false');

    await user.click(screen.getByRole('switch', { name: 'Include sample sessions' }));
    await waitFor(() =>
      expect(container.querySelector('.pg-content')).toHaveAttribute('aria-busy', 'true'),
    );
    release(PROGRESS_WITH_DATA);
    await waitFor(() =>
      expect(container.querySelector('.pg-content')).toHaveAttribute('aria-busy', 'false'),
    );
  });

  it('never lets sample calls steer which scenario is suggested', async () => {
    const user = userEvent.setup();
    progress.mockResolvedValue(PROGRESS_WITH_DATA);
    renderProgress();
    await screen.findByRole('heading', { name: 'Skill by skill' });
    await user.click(screen.getByRole('switch', { name: 'Include sample sessions' }));
    await screen.findByText('Sample sessions are included.');
    expect(listSessions).toHaveBeenCalledWith(
      expect.objectContaining({ includeSamples: false }),
      expect.anything(),
    );
    expect(listSessions).not.toHaveBeenCalledWith(
      expect.objectContaining({ includeSamples: true }),
      expect.anything(),
    );
  });
});

describe('Progress: at a glance', () => {
  it('shows how many calls count, which way recent calls are heading and the strongest skill', async () => {
    progress.mockResolvedValue(PROGRESS_WITH_DATA);
    renderProgress();
    await screen.findByRole('heading', { name: 'Skill by skill' });
    const summary = screen
      .getByRole('heading', { name: 'Summary' })
      .closest('section') as HTMLElement;
    expect(within(summary).getByText('5')).toBeVisible();
    expect(
      within(summary).getByText('6 sessions started in all. Only completed calls are scored.'),
    ).toBeVisible();
    expect(within(summary).getByText('Improving')).toBeVisible();
    expect(
      within(summary).getByText(/Your most recent calls scored a little higher overall/),
    ).toBeVisible();
    expect(within(summary).getByText('Closing')).toBeVisible();
    expect(
      within(summary).getByText(/Summarising agreements, confirming the next contact/),
    ).toBeVisible();
    expect(screen.getByText(PROGRESS_NOTE)).toBeVisible();
  });

  it('is calm and honest when there is not enough to say yet', async () => {
    progress.mockResolvedValue({
      ...withScores({ clarity: [3] }),
      totalSessions: 1,
      completedSessions: 1,
      strongest: null,
      focus: 'clarity',
      focusReason: 'Clarity averaged 3 across 1 session.',
      recentChange: 'not-enough-data',
    });
    renderProgress();
    await screen.findByRole('heading', { name: 'Skill by skill' });
    const summary = screen
      .getByRole('heading', { name: 'Summary' })
      .closest('section') as HTMLElement;
    expect(within(summary).getByText('Each one has a coaching report.')).toBeVisible();
    expect(within(summary).getByText('Not enough data yet')).toBeVisible();
    expect(within(summary).getByText('Not clear yet')).toBeVisible();
    expect(
      within(summary).getByText('This appears once you have two completed calls to compare.'),
    ).toBeVisible();
  });

  it('puts a dip in calm words, not alarm ones', async () => {
    progress.mockResolvedValue({ ...PROGRESS_WITH_DATA, recentChange: 'declining' });
    renderProgress();
    expect(await screen.findByText('A little lower')).toBeVisible();
    expect(screen.getByText(/That can happen when you try a harder scenario/)).toBeVisible();
  });
});

describe('Progress: the six skills', () => {
  it('has one card per skill, in report order, each with a text summary and a described chart', async () => {
    progress.mockResolvedValue(
      withScores(
        {
          'opening-rapport': [2, 3, 4, 4, 4],
          'scoping-discovery': [3, 3, 3, 2, 2],
          'empathy-deescalation': [3, 3],
          clarity: [4],
          'ownership-next-steps': [4, 4, 5, 5],
          closing: [],
        },
        { strongest: 'ownership-next-steps', focus: 'scoping-discovery' },
      ),
    );
    renderProgress();
    await screen.findByRole('heading', { name: 'Skill by skill' });
    const cards = screen.getAllByRole('article');
    expect(
      cards.map((card) => within(card).getByRole('heading', { level: 3 }).textContent),
    ).toEqual([
      'Opening & Rapport',
      'Scoping & Discovery',
      'Empathy & De-escalation',
      'Clarity',
      'Ownership & Next Steps',
      'Closing',
    ]);

    const opening = skillCard('Opening & Rapport');
    expect(
      within(opening).getByRole('img', {
        name: 'Opening & Rapport scores across 5 calls, oldest to newest: 2, 3, 4, 4, 4.',
      }),
    ).toBeInTheDocument();
    expect(opening).toHaveTextContent('Latest 4 \u00b7 average 3.4 \u00b7 steady');
    expect(opening.querySelectorAll('.pg-spark-dot')).toHaveLength(5);

    // Highlights are written out as words, with an icon, never colour alone.
    expect(within(skillCard('Ownership & Next Steps')).getByText('Strongest so far')).toBeVisible();
    expect(within(skillCard('Scoping & Discovery')).getByText('Suggested focus')).toBeVisible();
    expect(screen.getAllByText('Strongest so far')).toHaveLength(2); // the tile and the card
    expect(screen.getAllByText('Suggested focus')).toHaveLength(1);
  });

  it('names the direction in words, and only when there are enough calls to name it', async () => {
    progress.mockResolvedValue({
      ...PROGRESS_WITH_DATA,
      dimensionTrends: [
        trend('opening-rapport', [2, 3, 4, 5], 'up'),
        trend('scoping-discovery', [4, 3, 2, 1], 'down'),
        trend('empathy-deescalation', [3, 3, 3, 3], 'steady'),
        trend('clarity', [3, 4], 'not-enough-data'),
        trend('ownership-next-steps', [5], 'not-enough-data'),
        trend('closing', [], 'not-enough-data'),
      ],
    });
    renderProgress();
    await screen.findByRole('heading', { name: 'Skill by skill' });
    expect(skillCard('Opening & Rapport')).toHaveTextContent(
      'Latest 5 \u00b7 average 3.5 \u00b7 rising',
    );
    expect(skillCard('Scoping & Discovery')).toHaveTextContent(
      'Latest 1 \u00b7 average 2.5 \u00b7 lower lately',
    );
    expect(skillCard('Empathy & De-escalation')).toHaveTextContent(
      'Latest 3 \u00b7 average 3.0 \u00b7 steady',
    );
    expect(skillCard('Clarity')).toHaveTextContent(
      'Latest 4 \u00b7 average 3.5 \u00b7 a trend shows after 4 calls',
    );
    expect(skillCard('Ownership & Next Steps')).toHaveTextContent(
      'Latest 5 \u00b7 Complete 2+ calls to see a trend',
    );
    const closing = skillCard('Closing');
    expect(closing).toHaveTextContent('Not scored yet');
    expect(within(closing).queryByRole('img')).not.toBeInTheDocument();
  });

  it('keeps a long history legible by drawing only the line and its last point', async () => {
    const long = Array.from({ length: 30 }, (_, index) => 2 + (index % 3));
    progress.mockResolvedValue(withScores({ clarity: long }, { completedSessions: 30 }));
    renderProgress();
    await screen.findByRole('heading', { name: 'Skill by skill' });
    const clarity = skillCard('Clarity');
    expect(clarity.querySelectorAll('.pg-spark-dot')).toHaveLength(0);
    expect(clarity.querySelectorAll('.pg-spark-last')).toHaveLength(1);
    expect(clarity.querySelector('.pg-spark-line')).not.toBeNull();
  });

  it('offers the same scores as a table and puts it away again', async () => {
    const user = userEvent.setup();
    progress.mockResolvedValue(PROGRESS_WITH_DATA);
    renderProgress();
    const show = await screen.findByRole('button', { name: 'Show scores as a table' });
    expect(show).toHaveAttribute('aria-expanded', 'false');
    await user.click(show);
    const table = screen.getByRole('table', {
      name: 'Skill scores out of 5 for each completed call',
    });
    expect(within(table).getAllByRole('row')).toHaveLength(6);
    expect(screen.getByRole('button', { name: 'Hide scores table' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Hide scores table' }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('Progress: where to focus next', () => {
  const discovery = makeScenario({
    id: 'dig-deeper',
    title: 'Digging for detail',
    coachingFocus: ['scoping-discovery'],
  });

  it('names the skill, says why, and links to a scenario built to practise it', async () => {
    progress.mockResolvedValue(PROGRESS_WITH_DATA);
    scenarios.mockResolvedValue([discovery]);
    renderProgress();
    const card = (await screen.findByRole('heading', { name: 'Where to focus next' })).closest(
      'section',
    ) as HTMLElement;
    expect(within(card).getByText('Scoping & Discovery')).toBeVisible();
    expect(
      within(card).getByText('Scoping & Discovery averaged 2.5 across 5 sessions.'),
    ).toBeVisible();
    expect(
      within(card).getByText(/Asking focused questions to understand the problem/),
    ).toBeVisible();
    expect(
      await within(card).findByRole('link', { name: /Practise it in .Digging for detail./ }),
    ).toHaveAttribute('href', '/scenarios/dig-deeper/setup');
    expect(within(card).getByRole('link', { name: 'Browse scenarios' })).toHaveAttribute(
      'href',
      '/scenarios',
    );
  });

  it('holds the buttons back until the scenarios have arrived, so nothing shifts under the pointer', async () => {
    progress.mockResolvedValue(PROGRESS_WITH_DATA);
    let release: (list: ReturnType<typeof makeScenario>[]) => void = () => undefined;
    scenarios.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    renderProgress();
    const card = (await screen.findByRole('heading', { name: 'Where to focus next' })).closest(
      'section',
    ) as HTMLElement;
    expect(within(card).queryByRole('link')).not.toBeInTheDocument();
    release([discovery]);
    expect(await within(card).findByRole('link', { name: /Practise it in/ })).toBeVisible();
  });

  it('falls back to the library when no scenario fits or the scenarios cannot be loaded', async () => {
    progress.mockResolvedValue(PROGRESS_WITH_DATA);
    scenarios.mockRejectedValue(new Error('boom'));
    renderProgress();
    const card = (await screen.findByRole('heading', { name: 'Where to focus next' })).closest(
      'section',
    ) as HTMLElement;
    expect(
      await within(card).findByRole('link', { name: /Find a scenario to practise/ }),
    ).toHaveAttribute('href', '/scenarios');
    expect(within(card).queryByRole('link', { name: 'Browse scenarios' })).not.toBeInTheDocument();
  });

  it('says what it is waiting for when no focus has been suggested yet', async () => {
    progress.mockResolvedValue({ ...PROGRESS_WITH_DATA, focus: null, focusReason: null });
    renderProgress();
    expect(
      await screen.findByText('A focus is suggested after your first completed call.'),
    ).toBeVisible();
  });
});

describe('Progress: opportunities that keep coming up', () => {
  it('lists each skill with how often it came up and a scenario to practise it', async () => {
    progress.mockResolvedValue(PROGRESS_WITH_DATA);
    scenarios.mockResolvedValue([
      makeScenario({
        id: 'calm-down',
        title: 'Calming a tense call',
        coachingFocus: ['empathy-deescalation'],
      }),
    ]);
    renderProgress();
    const section = (
      await screen.findByRole('heading', { name: 'Opportunities that keep coming up' })
    ).closest('section') as HTMLElement;
    expect(within(section).getByText('Empathy & De-escalation')).toBeVisible();
    expect(
      within(section).getByText('Came up as an improvement area in 3 of 5 completed calls.'),
    ).toBeVisible();
    expect(
      await within(section).findByRole('link', { name: /Practise it in .Calming a tense call./ }),
    ).toHaveAttribute('href', '/scenarios/calm-down/setup');
  });

  it('says so when nothing has come up more than once', async () => {
    progress.mockResolvedValue({ ...PROGRESS_WITH_DATA, repeatedOpportunities: [] });
    renderProgress();
    expect(
      await screen.findByText(
        'No skill has come up as an improvement area in more than one call yet.',
      ),
    ).toBeVisible();
  });
});

describe('Progress: wording', () => {
  it('never ranks, compares people, counts streaks or talks about badges and experience points', async () => {
    progress.mockResolvedValue(PROGRESS_WITH_DATA);
    const { container } = renderProgress();
    await screen.findByRole('heading', { name: 'Skill by skill' });
    expect(container.textContent).not.toMatch(
      /leaderboard|\brank|streak|badge|\bXP\b|experience points|top performer/i,
    );
    expect(screen.getByText(/not an assessment of you/i)).toBeInTheDocument();
  });
});
