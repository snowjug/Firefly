import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProgressDTO } from '#shared/domain/api.ts';
import { DIMENSION_IDS, DIMENSIONS, type DimensionId } from '#shared/domain/vocab.ts';
import { skillsFromProgress } from '../components/atlas/constellation-layout.ts';
import {
  EMPTY_PROGRESS,
  PROGRESS_NOTE,
  PROGRESS_WITH_DATA,
  trend,
} from '../components/progress/progress.fixtures.ts';
import { skyChart } from '../components/progress/sky-geometry.ts';
import { makeEmptyRewards, makeRewards } from '../components/rewards/rewards.fixtures.ts';
import { makeScenario } from '../components/scenario/scenario-fixtures.ts';
import { api } from '../lib/api.ts';
import type * as ApiModule from '../lib/api.ts';
import { readingOrder } from '../lib/spatial/traversal.ts';
import Progress from './Progress.tsx';

vi.mock('../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return {
    ...actual,
    api: { progress: vi.fn(), scenarios: vi.fn(), listSessions: vi.fn(), rewards: vi.fn() },
  };
});

const progress = vi.mocked(api.progress);
const scenarios = vi.mocked(api.scenarios);
const listSessions = vi.mocked(api.listSessions);
const rewards = vi.mocked(api.rewards);

function renderProgress(entry: string | { pathname: string; state?: unknown } = '/progress') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
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

const skyButton = (name: string) => screen.getByRole('button', { name });
const litIn = (container: HTMLElement, id: DimensionId) =>
  container.querySelectorAll(`.pg-cluster[data-skill="${id}"] .pg-star--lit`).length;
const dormantIn = (container: HTMLElement, id: DimensionId) =>
  container.querySelectorAll(`.pg-cluster[data-skill="${id}"] .pg-star--dormant`).length;

/** Pretend the screen is as wide (or as narrow) as the query asks for. */
function matchMediaAs(narrow: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) =>
      ({
        matches: query.includes('max-width: 39.9375rem') ? narrow : !narrow,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  });
}

/** The list of the six skills, shown through the switch (the sky is the default on a wide screen). */
async function showList(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'List' }));
  return screen.getByRole('list', { name: 'The six skills, in report order' });
}

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  scenarios.mockResolvedValue([]);
  listSessions.mockResolvedValue({ sessions: [], total: 0 });
  rewards.mockResolvedValue(makeRewards());
});

afterEach(() => {
  Reflect.deleteProperty(window, 'matchMedia');
});

describe('Progress: nothing completed yet', () => {
  it('explains what appears here and how to get it, and draws an empty sky, never a chart', async () => {
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
    // Six clusters of outlines, and not one star lit: nothing is invented to make it look busy.
    expect(container.querySelectorAll('.pg-plate .pg-star--dormant')).toHaveLength(84);
    expect(container.querySelectorAll('.pg-plate .pg-star--lit')).toHaveLength(0);
    expect(screen.getAllByText('No evidence yet').length).toBeGreaterThanOrEqual(6);
    expect(progress).toHaveBeenCalledWith(false, expect.anything());
    // Nothing else is fetched for a page with nothing to show.
    expect(scenarios).not.toHaveBeenCalled();
    expect(listSessions).not.toHaveBeenCalled();
  });

  it('still says what a skill is, and that having no evidence is not a low score', async () => {
    const user = userEvent.setup();
    progress.mockResolvedValue(EMPTY_PROGRESS);
    renderProgress();
    await screen.findByRole('heading', { name: 'No completed practice calls yet' });
    await user.click(skyButton('Clarity'));
    const reading = screen.getByRole('heading', { level: 2, name: 'Clarity' }).closest('section')!;
    expect(within(reading).getByText(DIMENSIONS.clarity.description)).toBeVisible();
    expect(within(reading).getByText(/That is not a low score/)).toBeVisible();
    expect(within(reading).queryByRole('img')).not.toBeInTheDocument();
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
    // Every score on the five calls, averaged: 3.4 here.
    expect(within(summary).getByText('3.4 of 5')).toBeVisible();
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

describe('Progress: the constellation', () => {
  it('lights one star for each completed call a skill was scored on, and no more', async () => {
    progress.mockResolvedValue(
      withScores({
        'opening-rapport': [2, 3, 4, 4, 4],
        'scoping-discovery': [3],
        'empathy-deescalation': [3, 3],
        clarity: Array.from({ length: 30 }, () => 4),
      }),
    );
    const { container } = renderProgress();
    await screen.findByRole('heading', { name: 'Skill by skill' });
    expect(litIn(container, 'opening-rapport')).toBe(5);
    expect(dormantIn(container, 'opening-rapport')).toBe(9);
    expect(litIn(container, 'scoping-discovery')).toBe(1);
    expect(litIn(container, 'empathy-deescalation')).toBe(2);
    // A long history fills the cluster and stops there.
    expect(litIn(container, 'clarity')).toBe(14);
    expect(dormantIn(container, 'clarity')).toBe(0);
    // A skill with no scored call is all outlines, and says so.
    expect(litIn(container, 'closing')).toBe(0);
    expect(dormantIn(container, 'closing')).toBe(14);
    expect(skyButton('Closing')).toHaveAccessibleDescription(/no evidence yet/i);
    expect(screen.getByText('22 of 84 lit')).toBeInTheDocument();
  });

  it('names every cluster, in report order, with its figures in words', async () => {
    progress.mockResolvedValue(PROGRESS_WITH_DATA);
    renderProgress();
    await screen.findByRole('heading', { name: 'Skill by skill' });
    const sky = screen.getByRole('list', { name: 'The six skills' });
    const names = within(sky)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-labelledby'))
      .map((id) => document.getElementById(id as string)?.textContent);
    expect(names).toEqual(DIMENSION_IDS.map((id) => DIMENSIONS[id].label));
    expect(skyButton('Opening & Rapport')).toHaveAccessibleDescription(
      /5 stars lit of 14, 5 calls scored, light 2 of 4\. Latest 4 · average 3\.4 · rising/,
    );
    expect(skyButton('Scoping & Discovery')).toHaveAccessibleDescription(/Suggested next focus/);
  });

  it('marks the skill suggested for next practice, and the stars the newest call lit', async () => {
    progress.mockResolvedValue(PROGRESS_WITH_DATA);
    const { container } = renderProgress();
    await screen.findByRole('heading', { name: 'Skill by skill' });
    expect(container.querySelectorAll('.pg-rays')).toHaveLength(1);
    expect(
      container.querySelector('.pg-cluster[data-skill="scoping-discovery"] .pg-rays'),
    ).not.toBeNull();
    // Every skill was scored on the newest call, so each has one newest star.
    expect(container.querySelectorAll('.pg-plate .pg-star--recent')).toHaveLength(6);
    expect(container.querySelector('.pg-sky')).not.toHaveAttribute('data-pulse');
  });

  it('pulses the newest stars once only when someone arrives from a report', async () => {
    progress.mockResolvedValue(PROGRESS_WITH_DATA);
    const { container, unmount } = renderProgress('/progress?from=report');
    await screen.findByRole('heading', { name: 'Skill by skill' });
    expect(container.querySelector('.pg-sky')).toHaveAttribute('data-pulse');
    unmount();

    const again = renderProgress({ pathname: '/progress', state: { from: 'report' } });
    await screen.findByRole('heading', { name: 'Skill by skill' });
    expect(again.container.querySelector('.pg-sky')).toHaveAttribute('data-pulse');
  });

  it('opens a skill on selection with its scores, what moved and where it was evidenced', async () => {
    const user = userEvent.setup();
    progress.mockResolvedValue(PROGRESS_WITH_DATA);
    scenarios.mockResolvedValue([
      makeScenario({
        id: 'dig-deeper',
        title: 'Digging for detail',
        coachingFocus: ['scoping-discovery'],
      }),
    ]);
    renderProgress();
    await screen.findByRole('heading', { name: 'Skill by skill' });
    const cluster = skyButton('Scoping & Discovery');
    expect(cluster).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('heading', { name: 'Where to focus next' })).toBeInTheDocument();

    await user.click(cluster);
    expect(cluster).toHaveAttribute('aria-pressed', 'true');
    const reading = screen
      .getByRole('heading', { level: 2, name: 'Scoping & Discovery' })
      .closest('section') as HTMLElement;
    expect(cluster).toHaveAttribute('aria-controls', reading.parentElement?.id);
    expect(
      within(reading).getByRole('img', {
        name: 'Scoping & Discovery scores across 5 calls, oldest to newest: 3, 3, 3, 4, 4.',
      }),
    ).toBeInTheDocument();
    expect(reading).toHaveTextContent('Latest 4 \u00b7 average 3.4 \u00b7 lower lately');
    expect(within(reading).getByText('Latest 4, the same as the call before.')).toBeVisible();
    expect(within(reading).getByText('Suggested focus')).toBeVisible();
    expect(within(reading).getByText('Light 2 of 4 \u00b7 5 calls scored')).toBeVisible();
    expect(
      within(reading).getByText(/Light 3 asks for 3 calls averaging 3\.5 or more/),
    ).toBeVisible();
    expect(within(reading).getByRole('link', { name: 'Open that report' })).toHaveAttribute(
      'href',
      '/sessions/call-5/report',
    );
    expect(
      await within(reading).findByRole('link', { name: /Practise it in .Digging for detail./ }),
    ).toHaveAttribute('href', '/scenarios/dig-deeper/setup');
    // The summary gives way to the reading, and the status says where it went.
    expect(screen.queryByRole('heading', { name: 'Where to focus next' })).not.toBeInTheDocument();
    expect(screen.getByText(/Its reading is in the panel after the sky/)).toBeInTheDocument();
  });

  it('closes the reading with the button or Escape, and keeps focus on the cluster', async () => {
    const user = userEvent.setup();
    progress.mockResolvedValue(PROGRESS_WITH_DATA);
    renderProgress();
    await screen.findByRole('heading', { name: 'Skill by skill' });
    await user.click(skyButton('Clarity'));
    await user.click(screen.getByRole('button', { name: /All six skills/ }));
    expect(screen.getByRole('heading', { name: 'Where to focus next' })).toBeInTheDocument();
    expect(skyButton('Clarity')).toHaveAttribute('aria-pressed', 'false');

    await user.click(skyButton('Clarity'));
    skyButton('Clarity').focus();
    await user.keyboard('{Escape}');
    expect(skyButton('Clarity')).toHaveAttribute('aria-pressed', 'false');
    expect(skyButton('Clarity')).toHaveFocus();
    // Pressing the chosen cluster again puts it away too.
    await user.click(skyButton('Clarity'));
    await user.click(skyButton('Clarity'));
    expect(screen.getByRole('heading', { name: 'Where to focus next' })).toBeInTheDocument();
  });

  it('moves between clusters with the arrow keys by where they lie, and is one tab stop', async () => {
    const user = userEvent.setup();
    progress.mockResolvedValue(PROGRESS_WITH_DATA);
    renderProgress();
    await screen.findByRole('heading', { name: 'Skill by skill' });
    const sky = screen.getByRole('list', { name: 'The six skills' });
    const buttons = within(sky).getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('tabindex'))).toEqual([
      '0',
      '-1',
      '-1',
      '-1',
      '-1',
      '-1',
    ]);

    // The ring runs upper left, upper right, right, lower right, lower left, left.
    buttons[0]!.focus();
    await user.keyboard('{ArrowRight}');
    expect(skyButton('Scoping & Discovery')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(skyButton('Empathy & De-escalation')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(skyButton('Clarity')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(skyButton('Ownership & Next Steps')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(skyButton('Closing')).toHaveFocus();
    // Only the one that has focus is a tab stop.
    expect(
      within(sky)
        .getAllByRole('button')
        .filter((b) => b.getAttribute('tabindex') === '0'),
    ).toEqual([skyButton('Closing')]);

    await user.keyboard('{Home}');
    const reading = readingOrder(skyChart(skillsFromProgress(PROGRESS_WITH_DATA)).clusters);
    const label = (id: string) => DIMENSIONS[id as DimensionId].label;
    expect(skyButton(label(reading[0]!.id))).toHaveFocus();
    await user.keyboard('{End}');
    expect(skyButton(label(reading.at(-1)!.id))).toHaveFocus();
    // Enter opens the reading from the keyboard.
    await user.keyboard('{Enter}');
    expect(document.activeElement).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Progress: the list', () => {
  it('is the way in on a small screen, and the constellation is one press away', async () => {
    const user = userEvent.setup();
    matchMediaAs(true);
    progress.mockResolvedValue(PROGRESS_WITH_DATA);
    const { container } = renderProgress();
    await screen.findByRole('heading', { name: 'Skill by skill' });
    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('list', { name: 'The six skills, in report order' })).toBeVisible();
    expect(container.querySelector('.pg-plate')).toBeNull();
    // The summary and the next focus come first, so they are not buried under six rows.
    const focus = screen.getByRole('heading', { name: 'Where to focus next' });
    const list = screen.getByRole('list', { name: 'The six skills, in report order' });
    expect(focus.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Constellation' }));
    expect(container.querySelector('.pg-plate')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Constellation' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('remembers the choice on this device, over the size of the screen', async () => {
    const user = userEvent.setup();
    progress.mockResolvedValue(PROGRESS_WITH_DATA);
    const first = renderProgress();
    await user.click(await screen.findByRole('button', { name: 'List' }));
    expect(JSON.parse(localStorage.getItem('firefly.progress-view') ?? 'null')).toBe('list');
    first.unmount();

    renderProgress();
    expect(await screen.findByRole('button', { name: 'List' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('has one row per skill, in report order, each with a text summary and a described chart', async () => {
    const user = userEvent.setup();
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
    const list = await showList(user);
    const rows = within(list).getAllByRole('article');
    expect(rows.map((row) => within(row).getByRole('heading', { level: 3 }).textContent)).toEqual(
      DIMENSION_IDS.map((id) => DIMENSIONS[id].label),
    );

    const row = (name: string) =>
      within(list).getByRole('heading', { level: 3, name }).closest('article') as HTMLElement;
    const opening = row('Opening & Rapport');
    expect(
      within(opening).getByRole('img', {
        name: 'Opening & Rapport scores across 5 calls, oldest to newest: 2, 3, 4, 4, 4.',
      }),
    ).toBeInTheDocument();
    expect(opening).toHaveTextContent('Latest 4 \u00b7 average 3.4 \u00b7 steady');
    expect(opening.querySelectorAll('.pg-spark-dot')).toHaveLength(5);

    // Highlights are written out as words, never colour alone.
    expect(within(row('Ownership & Next Steps')).getByText('Strongest so far')).toBeVisible();
    expect(within(row('Scoping & Discovery')).getByText('Suggested focus')).toBeVisible();
    expect(within(list).getAllByText('Strongest so far')).toHaveLength(1);
    expect(within(list).getAllByText('Suggested focus')).toHaveLength(1);
    const closing = row('Closing');
    expect(within(closing).getByText('No evidence yet')).toBeVisible();
    expect(within(closing).queryByRole('img')).not.toBeInTheDocument();
  });

  it('names the direction in words, and only when there are enough calls to name it', async () => {
    const user = userEvent.setup();
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
    const list = await showList(user);
    const row = (name: string) =>
      within(list).getByRole('heading', { level: 3, name }).closest('article') as HTMLElement;
    expect(row('Opening & Rapport')).toHaveTextContent('Latest 5 \u00b7 average 3.5 \u00b7 rising');
    expect(row('Scoping & Discovery')).toHaveTextContent(
      'Latest 1 \u00b7 average 2.5 \u00b7 lower lately',
    );
    expect(row('Empathy & De-escalation')).toHaveTextContent(
      'Latest 3 \u00b7 average 3.0 \u00b7 steady',
    );
    expect(row('Clarity')).toHaveTextContent(
      'Latest 4 \u00b7 average 3.5 \u00b7 a trend shows after 4 calls',
    );
    expect(row('Ownership & Next Steps')).toHaveTextContent(
      'Latest 5 \u00b7 Complete 2+ calls to see a trend',
    );
    expect(row('Closing')).toHaveTextContent('No evidence yet');
  });

  it('keeps a long history legible by drawing only the line and its last point', async () => {
    const user = userEvent.setup();
    const long = Array.from({ length: 30 }, (_, index) => 2 + (index % 3));
    progress.mockResolvedValue(withScores({ clarity: long }, { completedSessions: 30 }));
    renderProgress();
    const list = await showList(user);
    const clarity = within(list)
      .getByRole('heading', { level: 3, name: 'Clarity' })
      .closest('article') as HTMLElement;
    expect(clarity.querySelectorAll('.pg-spark-dot')).toHaveLength(0);
    expect(clarity.querySelectorAll('.pg-spark-last')).toHaveLength(1);
    expect(clarity.querySelector('.pg-spark-line')).not.toBeNull();
  });

  it('offers the same scores as a table, each call linking to its report, and puts it away again', async () => {
    const user = userEvent.setup();
    progress.mockResolvedValue(PROGRESS_WITH_DATA);
    renderProgress();
    const summary = await screen.findByText('Scores as a table');
    const details = summary.closest('details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    await user.click(summary);
    expect(details.open).toBe(true);
    const table = screen.getByRole('table', {
      name: 'Skill scores out of 5 for each completed call',
    });
    expect(within(table).getAllByRole('row')).toHaveLength(6);
    expect(within(table).getAllByRole('link')[0]).toHaveAttribute(
      'href',
      '/sessions/call-1/report',
    );
    await user.click(summary);
    expect(details.open).toBe(false);
  });
});

describe('Progress: where to focus next', () => {
  const discovery = makeScenario({
    id: 'dig-deeper',
    title: 'Digging for detail',
    coachingFocus: ['scoping-discovery'],
  });
  const focusSection = async () =>
    (await screen.findByRole('heading', { name: 'Where to focus next' })).closest(
      'section',
    ) as HTMLElement;

  it('names the skill, says why, and links to a scenario built to practise it', async () => {
    progress.mockResolvedValue(PROGRESS_WITH_DATA);
    scenarios.mockResolvedValue([discovery]);
    renderProgress();
    const card = await focusSection();
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
    const card = await focusSection();
    expect(within(card).queryByRole('link')).not.toBeInTheDocument();
    release([discovery]);
    expect(await within(card).findByRole('link', { name: /Practise it in/ })).toBeVisible();
  });

  it('falls back to the library when no scenario fits or the scenarios cannot be loaded', async () => {
    progress.mockResolvedValue(PROGRESS_WITH_DATA);
    scenarios.mockRejectedValue(new Error('boom'));
    renderProgress();
    const card = await focusSection();
    expect(
      await within(card).findByRole('link', { name: /Find a scenario to practise/ }),
    ).toHaveAttribute('href', '/scenarios');
    expect(within(card).queryByRole('link', { name: 'Browse scenarios' })).not.toBeInTheDocument();
  });

  it('says what it is waiting for when no focus has been suggested yet, and glints nothing', async () => {
    progress.mockResolvedValue({ ...PROGRESS_WITH_DATA, focus: null, focusReason: null });
    const { container } = renderProgress();
    expect(
      await screen.findByText('A focus is suggested after your first completed call.'),
    ).toBeVisible();
    expect(container.querySelectorAll('.pg-rays')).toHaveLength(0);
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
  it('never ranks, compares people, counts streaks or talks about badges and experience points in the skills', async () => {
    progress.mockResolvedValue(PROGRESS_WITH_DATA);
    const { container } = renderProgress();
    await screen.findByRole('heading', { name: 'Skill by skill' });
    const skills = [
      container.querySelector('.pg-hero'),
      screen.getByRole('heading', { name: 'Opportunities that keep coming up' }).closest('section'),
    ];
    for (const part of skills) {
      expect(part?.textContent).not.toMatch(
        /leaderboard|\brank|streak|badge|\bXP\b|experience points|top performer/i,
      );
    }
    expect(screen.getByText(/not an assessment of you/i)).toBeInTheDocument();
  });

  it('keeps recognition honest too: points, never experience, and nothing ranked', async () => {
    progress.mockResolvedValue(PROGRESS_WITH_DATA);
    const { container } = renderProgress();
    await screen.findByRole('heading', { name: 'How points work' });
    expect(container.textContent).not.toMatch(
      /\bXP\b|experience points|leaderboard|top performer|level up/i,
    );
  });
});

describe('Progress: imperfect content', () => {
  it('copes when every skill is dormant even though calls were counted', async () => {
    progress.mockResolvedValue({
      ...PROGRESS_WITH_DATA,
      dimensionTrends: DIMENSION_IDS.map((id) => trend(id, [], 'not-enough-data')),
      focus: null,
      focusReason: null,
      strongest: null,
      repeatedOpportunities: [],
    });
    const { container } = renderProgress();
    await screen.findByRole('heading', { name: 'Skill by skill' });
    expect(container.querySelectorAll('.pg-plate .pg-star--lit')).toHaveLength(0);
    expect(screen.getByText('0 of 84 lit')).toBeInTheDocument();
    expect(screen.getByText('None yet')).toBeVisible();
  });

  it('shows full marks as the brightest light, not as anything more', async () => {
    const user = userEvent.setup();
    progress.mockResolvedValue(
      withScores({ clarity: [5, 5, 5, 5, 5, 5] }, { completedSessions: 6, totalSessions: 6 }),
    );
    renderProgress();
    await screen.findByRole('heading', { name: 'Skill by skill' });
    await user.click(skyButton('Clarity'));
    expect(screen.getByText('Light 4 of 4 \u00b7 6 calls scored')).toBeVisible();
    expect(screen.getByText('This is the brightest light.')).toBeVisible();
  });

  it('keeps a very long skill name and a long focus reason inside the page', async () => {
    progress.mockResolvedValue({
      ...PROGRESS_WITH_DATA,
      focusReason: 'Scoping & Discovery averaged 2.5 across 5 sessions. '.repeat(12),
    });
    const { container } = renderProgress();
    await screen.findByRole('heading', { name: 'Skill by skill' });
    expect(container.querySelector('.pg-focus__reason')?.textContent?.length).toBeGreaterThan(400);
  });

  it('shows the progress without the recognition when the rewards cannot be loaded', async () => {
    progress.mockResolvedValue(PROGRESS_WITH_DATA);
    rewards.mockRejectedValue(new Error('boom'));
    renderProgress();
    await screen.findByRole('heading', { name: 'Skill by skill' });
    const alert = await screen.findByRole('alert');
    expect(
      within(alert).getByRole('heading', { name: 'We could not load your rewards' }),
    ).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Where to focus next' })).toBeVisible();
  });

  it('keeps the first visit calm when nothing has been earned', async () => {
    progress.mockResolvedValue(EMPTY_PROGRESS);
    rewards.mockResolvedValue(makeEmptyRewards());
    renderProgress();
    expect(await screen.findByText('You have not earned any points yet.')).toBeVisible();
  });
});
