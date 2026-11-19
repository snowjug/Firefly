import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BadgeDTO, RewardsDTO, SessionDTO } from '#shared/domain/api.ts';
import { makeSummary } from '../components/report/report.fixtures.ts';
import { ApiError, api } from '../lib/api.ts';
import type * as ApiModule from '../lib/api.ts';
import { formatDate } from '../lib/format.ts';
import History from './History.tsx';

vi.mock('../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return {
    ...actual,
    api: {
      listSessions: vi.fn(),
      scenarios: vi.fn(),
      deleteSession: vi.fn(),
      evaluate: vi.fn(),
      rewards: vi.fn(),
    },
  };
});

const listSessions = vi.mocked(api.listSessions);
const scenarios = vi.mocked(api.scenarios);
const deleteSession = vi.mocked(api.deleteSession);
const evaluate = vi.mocked(api.evaluate);
const rewards = vi.mocked(api.rewards);

const completed = makeSummary({ id: 'a', scenarioTitle: 'Locked out after a password reset' });
const challenge = makeSummary({
  id: 'b',
  scenarioId: 'checkout-outage',
  scenarioTitle: 'Checkout is down',
  difficulty: 'challenge',
  impact: 'high',
  startingTemperature: 'angry',
  overallScore: 1.5,
  completion: 'ended-early',
  startedAt: '2026-11-11T09:00:00.000Z',
});
const sample = makeSummary({
  id: 'c',
  scenarioTitle: 'Team cannot open the workspace',
  scenarioId: 'workspace',
  impact: 'low',
  isSample: true,
  mentorReviewed: true,
  startedAt: '2026-11-10T09:00:00.000Z',
});
const running = makeSummary({
  id: 'd',
  scenarioId: 'running-call',
  scenarioTitle: 'A call in progress',
  status: 'active',
  completion: null,
  overallScore: null,
  dimensionScores: null,
  endedAt: null,
  durationSeconds: null,
  traineeTurns: 2,
});
const failed = makeSummary({
  id: 'e',
  scenarioId: 'report-failed',
  scenarioTitle: 'The report did not build',
  status: 'evaluation_failed',
  completion: null,
  overallScore: null,
  dimensionScores: null,
});

const badge = (overrides: Partial<BadgeDTO>): BadgeDTO => ({
  id: 'first-practice',
  title: 'First Practice',
  criteria: 'Complete your first full scenario.',
  earned: false,
  earnedAt: null,
  earnedInSessionId: null,
  progress: { current: 0, target: 1, unit: 'calls' },
  ...overrides,
});

function renderHistory() {
  return render(
    <MemoryRouter>
      <History />
    </MemoryRouter>,
  );
}

const rowOf = (title: string) =>
  screen.getByText(title, { selector: '.hs-title' }).closest('tr') as HTMLElement;

beforeEach(() => {
  vi.resetAllMocks();
  scenarios.mockResolvedValue([]);
  rewards.mockResolvedValue({ badges: [] } as unknown as RewardsDTO);
  listSessions.mockResolvedValue({ sessions: [completed, challenge, sample], total: 3 });
});

describe('History page', () => {
  it('opens with its title, the filters and a table with the six columns', async () => {
    renderHistory();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'My practice history' })).toBeVisible();
    expect(screen.getByText('Track your progress over time.')).toBeVisible();

    const table = await screen.findByRole('table', { name: 'Practice calls, newest first' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Compare', 'Date', 'Scenario', 'Impact', 'Score', 'Badges', 'Actions']);

    expect(screen.getByLabelText('Scenario')).toHaveDisplayValue('All scenarios');
    expect(screen.getByLabelText('Difficulty')).toBeVisible();
    expect(screen.getByLabelText('Status')).toBeVisible();
    expect(screen.getByRole('switch', { name: 'Show sample calls' })).toBeChecked();
    expect(screen.getByText('Showing 3 of 3 calls.')).toBeInTheDocument();
  });

  it('shows each call in words: date, impact, score, labels and the actions that fit it', async () => {
    listSessions.mockResolvedValue({
      sessions: [running, completed, challenge, sample, failed],
      total: 5,
    });
    renderHistory();
    await screen.findByText('Showing 5 of 5 calls.');

    const done = rowOf('Locked out after a password reset');
    expect(within(done).getByText(formatDate(completed.startedAt))).toBeInTheDocument();
    expect(within(done).getByText('Medium')).toBeInTheDocument();
    expect(within(done).getByText('Starter')).toBeInTheDocument();
    expect(within(done).getByText('Starts frustrated')).toBeInTheDocument();
    expect(within(done).getByText(/^3\.5/)).toHaveTextContent('3.5 out of 5');
    expect(within(done).getByText('\u2014')).toBeInTheDocument();
    expect(within(done).getByRole('link', { name: /^View report/ })).toHaveAttribute(
      'href',
      '/sessions/a/report',
    );
    expect(within(done).getByRole('link', { name: /^Transcript/ })).toHaveAttribute(
      'href',
      '/sessions/a/transcript',
    );
    expect(within(done).getByRole('link', { name: /^Practise again/ })).toHaveAttribute(
      'href',
      '/scenarios/locked-out-after-password-reset/setup',
    );
    expect(within(done).queryByText('Sample')).not.toBeInTheDocument();
    expect(within(done).queryByText('Ended early')).not.toBeInTheDocument();

    const early = rowOf('Checkout is down');
    expect(within(early).getByText('High')).toBeInTheDocument();
    expect(within(early).getByText('Ended early')).toBeInTheDocument();
    expect(within(early).getByText(/^1\.5/)).toBeInTheDocument();

    const demo = rowOf('Team cannot open the workspace');
    expect(within(demo).getByText('Sample')).toBeInTheDocument();
    expect(within(demo).getByText('Mentor reviewed')).toBeInTheDocument();
    expect(within(demo).getByText(/not your own practice/i)).toBeInTheDocument();

    const live = rowOf('A call in progress');
    expect(within(live).getByText('In progress')).toBeInTheDocument();
    expect(within(live).getByRole('link', { name: /^Resume call/ })).toHaveAttribute(
      'href',
      '/calls/d',
    );
    expect(within(live).queryByRole('link', { name: /^Transcript/ })).not.toBeInTheDocument();
    expect(within(live).queryByRole('link', { name: /^View report/ })).not.toBeInTheDocument();
    expect(live).toHaveTextContent('No score yet');

    const broken = rowOf('The report did not build');
    expect(within(broken).getByText('Needs attention')).toBeInTheDocument();
    expect(within(broken).getByRole('button', { name: /^Retry report/ })).toBeInTheDocument();
  });

  it('puts the badges a call earned in its row, and shows a dash for the rest', async () => {
    rewards.mockResolvedValue({
      badges: [
        badge({ earned: true, earnedInSessionId: 'a', title: 'First Practice' }),
        badge({ id: 'de-escalator', earned: true, earnedInSessionId: 'a', title: 'De-escalator' }),
        badge({ id: 'scope-detective', title: 'Scope Detective' }),
      ],
    } as unknown as RewardsDTO);
    renderHistory();
    await screen.findByText('Showing 3 of 3 calls.');

    const done = rowOf('Locked out after a password reset');
    await waitFor(() => expect(within(done).getByText('First Practice')).toBeInTheDocument());
    expect(within(done).getByText('De-escalator')).toBeInTheDocument();
    expect(within(done).queryByText('No badges earned in this call')).not.toBeInTheDocument();
    expect(
      within(rowOf('Checkout is down')).getByText('No badges earned in this call'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Scope Detective')).not.toBeInTheDocument();
  });

  it('still shows every call when badges cannot be loaded', async () => {
    rewards.mockRejectedValue(new ApiError(500, 'internal', 'Something went wrong.', true));
    renderHistory();
    await screen.findByText('Showing 3 of 3 calls.');
    await waitFor(() => expect(rewards).toHaveBeenCalled());

    for (const title of [
      'Locked out after a password reset',
      'Checkout is down',
      'Team cannot open the workspace',
    ]) {
      const row = rowOf(title);
      expect(within(row).getByText('No badges earned in this call')).toBeInTheDocument();
      expect(within(row).getByRole('link', { name: /^View report/ })).toBeInTheDocument();
    }
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('captions every value so the table can stack into cards on narrow screens', async () => {
    renderHistory();
    const table = await screen.findByRole('table');
    // The stylesheet turns each row into a card and prints these captions above the values.
    const labels = within(rowOf('Locked out after a password reset'))
      .getAllByRole('cell')
      .map((cell) => cell.getAttribute('data-label'))
      .filter(Boolean);
    expect(labels).toEqual(['Date', 'Impact', 'Score', 'Badges']);
    // The headings stay in the document for assistive technology even when they are hidden.
    expect(within(table).getAllByRole('columnheader')).toHaveLength(7);
    expect(within(table).getAllByRole('row')).toHaveLength(4);
  });

  it('asks the server again when a filter changes and keeps the list while it loads', async () => {
    const user = userEvent.setup();
    renderHistory();
    await screen.findByText('Showing 3 of 3 calls.');
    expect(listSessions).toHaveBeenLastCalledWith(
      expect.objectContaining({ includeSamples: true, limit: 12, offset: 0 }),
      expect.anything(),
    );

    let release: (value: { sessions: (typeof challenge)[]; total: number }) => void = () =>
      undefined;
    listSessions.mockReturnValueOnce(new Promise((resolve) => (release = resolve)));
    await user.selectOptions(screen.getByLabelText('Difficulty'), 'challenge');
    // The previous list stays visible while the new one loads.
    expect(
      screen.getByText('Locked out after a password reset', { selector: '.hs-title' }),
    ).toBeInTheDocument();
    release({ sessions: [challenge], total: 1 });
    expect(await screen.findByText('Showing 1 of 1 call.')).toBeInTheDocument();
    expect(listSessions).toHaveBeenLastCalledWith(
      expect.objectContaining({ difficulty: 'challenge' }),
      expect.anything(),
    );
    expect(
      screen.queryByText('Locked out after a password reset', { selector: '.hs-title' }),
    ).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Status'), 'attention');
    await waitFor(() =>
      expect(listSessions).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'evaluation_failed', difficulty: 'challenge' }),
        expect.anything(),
      ),
    );
  });

  it('filters by scenario, using every scenario the calls and the library know', async () => {
    const user = userEvent.setup();
    scenarios.mockResolvedValue([
      { id: 'billing', title: 'Billing question' },
    ] as unknown as Awaited<ReturnType<typeof api.scenarios>>);
    renderHistory();
    await screen.findByText('Showing 3 of 3 calls.');
    const select = screen.getByLabelText('Scenario');
    await waitFor(() =>
      expect(
        within(select)
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual([
        'All scenarios',
        'Billing question',
        'Checkout is down',
        'Locked out after a password reset',
        'Team cannot open the workspace',
      ]),
    );
    await user.selectOptions(select, 'checkout-outage');
    await waitFor(() =>
      expect(listSessions).toHaveBeenLastCalledWith(
        expect.objectContaining({ scenarioId: 'checkout-outage' }),
        expect.anything(),
      ),
    );
  });

  it('can hide sample calls', async () => {
    const user = userEvent.setup();
    renderHistory();
    await screen.findByText('Showing 3 of 3 calls.');
    await user.click(screen.getByRole('switch', { name: 'Show sample calls' }));
    await waitFor(() =>
      expect(listSessions).toHaveBeenLastCalledWith(
        expect.objectContaining({ includeSamples: false }),
        expect.anything(),
      ),
    );
  });

  it('explains an empty history, and an empty filter result differently', async () => {
    const user = userEvent.setup();
    listSessions.mockResolvedValue({ sessions: [], total: 0 });
    renderHistory();
    expect(
      await screen.findByRole('heading', { name: 'No practice calls yet' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Trainer page' })).toHaveAttribute('href', '/trainer');
    expect(screen.getByRole('link', { name: /start practising/i })).toHaveAttribute(
      'href',
      '/practice',
    );
    expect(screen.getByRole('link', { name: /browse scenarios/i })).toHaveAttribute(
      'href',
      '/scenarios',
    );
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Difficulty'), 'challenge');
    expect(
      await screen.findByRole('heading', { name: 'No calls match these filters' }),
    ).toBeInTheDocument();
    listSessions.mockResolvedValue({ sessions: [completed], total: 1 });
    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0] as HTMLElement);
    expect(await screen.findByText('Showing 1 of 1 call.')).toBeInTheDocument();
    expect(screen.getByLabelText('Difficulty')).toHaveValue('');
  });

  it('says so, and offers another try, when the history cannot be loaded', async () => {
    const user = userEvent.setup();
    listSessions.mockRejectedValueOnce(new ApiError(0, 'network', 'Can’t reach Firefly.', true));
    renderHistory();
    expect(await screen.findByRole('alert')).toHaveTextContent('Can’t reach Firefly.');
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Showing 3 of 3 calls.')).toBeInTheDocument();
  });

  it('loads more calls with limit and offset, and moves focus to the first new one', async () => {
    const user = userEvent.setup();
    listSessions.mockResolvedValueOnce({ sessions: [completed, challenge], total: 3 });
    listSessions.mockResolvedValueOnce({ sessions: [sample], total: 3 });
    renderHistory();
    await screen.findByText('Showing 2 of 3 calls.');
    await user.click(screen.getByRole('button', { name: 'Show more' }));
    expect(await screen.findByText('Showing 3 of 3 calls.')).toBeInTheDocument();
    expect(listSessions).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: 2, limit: 12 }),
    );
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
    // Keyboard and screen-reader users are not left behind at the button that went away.
    expect(
      within(rowOf('Team cannot open the workspace')).getByRole('link', { name: /^View report/ }),
    ).toHaveFocus();
  });

  describe('deleting', () => {
    const open = async (user: ReturnType<typeof userEvent.setup>, title: string) => {
      await screen.findByText('Showing 3 of 3 calls.');
      await user.click(screen.getByRole('button', { name: new RegExp(`^Delete ${title}`) }));
      return screen.getByRole('dialog', { name: 'Delete this call?' });
    };

    it('gives every row a delete button with a name that says which call it is', async () => {
      renderHistory();
      await screen.findByText('Showing 3 of 3 calls.');
      const button = screen.getByRole('button', { name: /^Delete Checkout is down, / });
      expect(button).toHaveAttribute('title', 'Delete');
    });

    it('says what is deleted, and Cancel changes nothing', async () => {
      const user = userEvent.setup();
      renderHistory();
      const dialog = await open(user, 'Checkout is down');
      expect(dialog).toHaveTextContent(
        'permanently deletes the transcript and the coaching report',
      );
      expect(dialog).toHaveTextContent('can’t be undone');
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect(deleteSession).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText('Checkout is down', { selector: '.hs-title' })).toBeInTheDocument();
    });

    it('removes the row, announces it and moves focus to the next call', async () => {
      const user = userEvent.setup();
      deleteSession.mockResolvedValue({ deleted: true });
      renderHistory();
      const dialog = await open(user, 'Checkout is down');
      await user.click(within(dialog).getByRole('button', { name: 'Delete call' }));

      expect(deleteSession).toHaveBeenCalledWith('b');
      expect(
        await screen.findByText(/Deleted “Checkout is down”\. Showing 2 of 2 calls\./),
      ).toBeInTheDocument();
      expect(
        screen.queryByText('Checkout is down', { selector: '.hs-title' }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(
        within(rowOf('Team cannot open the workspace')).getByRole('link', {
          name: /^View report/,
        }),
      ).toHaveFocus();
    });

    it('keeps the row and shows the problem when deleting fails', async () => {
      const user = userEvent.setup();
      deleteSession.mockRejectedValue(
        new ApiError(409, 'conflict', 'That call is busy. Try again in a moment.', true),
      );
      renderHistory();
      const dialog = await open(user, 'Checkout is down');
      await user.click(within(dialog).getByRole('button', { name: 'Delete call' }));
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('That call is busy.');
      expect(screen.getByText('Checkout is down', { selector: '.hs-title' })).toBeInTheDocument();
    });
  });

  describe('retrying a report', () => {
    beforeEach(() => {
      listSessions.mockResolvedValue({ sessions: [failed, completed], total: 2 });
    });

    it('builds the report again and turns the row into a finished call', async () => {
      const user = userEvent.setup();
      evaluate.mockResolvedValue({
        ...failed,
        status: 'completed',
        completion: 'completed',
        overallScore: 3.2,
      } as SessionDTO);
      renderHistory();
      await screen.findByText('Showing 2 of 2 calls.');
      await user.click(screen.getByRole('button', { name: /^Retry report/ }));

      expect(evaluate).toHaveBeenCalledWith('e');
      expect(
        await screen.findByText(/The report for “The report did not build” is ready\./),
      ).toBeInTheDocument();
      const row = rowOf('The report did not build');
      expect(within(row).getByRole('link', { name: /^View report/ })).toHaveAttribute(
        'href',
        '/sessions/e/report',
      );
      expect(within(row).getByText(/^3\.2/)).toBeInTheDocument();
      expect(within(row).queryByText('Needs attention')).not.toBeInTheDocument();
    });

    it('says so when the report still cannot be built, and keeps the retry', async () => {
      const user = userEvent.setup();
      evaluate.mockResolvedValue({ ...failed } as SessionDTO);
      renderHistory();
      await screen.findByText('Showing 2 of 2 calls.');
      await user.click(screen.getByRole('button', { name: /^Retry report/ }));
      expect(await screen.findByRole('alert')).toHaveTextContent('still could not be built');
      expect(screen.getByRole('button', { name: /^Retry report/ })).toBeInTheDocument();
    });

    it('shows the server’s message when the retry itself fails', async () => {
      const user = userEvent.setup();
      evaluate.mockRejectedValue(new ApiError(503, 'unavailable', 'The coach is busy.', true));
      renderHistory();
      await screen.findByText('Showing 2 of 2 calls.');
      await user.click(screen.getByRole('button', { name: /^Retry report/ }));
      expect(await screen.findByRole('alert')).toHaveTextContent('The coach is busy.');
    });
  });

  it('compares two completed calls in text and cautions about differences', async () => {
    const user = userEvent.setup();
    renderHistory();
    await screen.findByText('Showing 3 of 3 calls.');
    expect(screen.getByText('Tick two finished calls to compare their scores.')).toBeVisible();
    await user.click(
      screen.getByRole('checkbox', { name: /^Compare Locked out after a password reset/ }),
    );
    expect(
      screen.getByText('One call selected. Choose one more to compare them.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /^Compare Checkout is down/ }));
    // Only two at a time.
    expect(screen.getByRole('checkbox', { name: /^Compare Team cannot open/ })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Compare' }));
    const dialog = screen.getByRole('dialog', { name: 'Compare two calls' });
    expect(dialog).toHaveTextContent('different scenarios');
    expect(dialog).toHaveTextContent('different difficulty levels');
    const table = within(dialog).getByRole('table');
    // The earlier call is the Challenge one (1.5); the later one scored 3.5, so overall is +2 higher.
    expect(within(table).getByRole('row', { name: /^Overall/ })).toHaveTextContent('+2 higher');
    expect(within(table).getByRole('row', { name: /^Opening/ })).toHaveTextContent('same');
  });

  it('only offers to compare calls that finished with scores', async () => {
    listSessions.mockResolvedValue({ sessions: [running, failed, completed], total: 3 });
    renderHistory();
    await screen.findByText('Showing 3 of 3 calls.');
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    expect(
      screen.getByRole('checkbox', { name: /^Compare Locked out after a password reset/ }),
    ).toBeInTheDocument();
  });
});
