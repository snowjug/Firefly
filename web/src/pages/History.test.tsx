import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeSummary } from '../components/report/report.fixtures.ts';
import { ApiError, api } from '../lib/api.ts';
import type * as ApiModule from '../lib/api.ts';
import History from './History.tsx';

vi.mock('../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, api: { listSessions: vi.fn(), scenarios: vi.fn(), deleteSession: vi.fn() } };
});

const listSessions = vi.mocked(api.listSessions);
const scenarios = vi.mocked(api.scenarios);
const deleteSession = vi.mocked(api.deleteSession);

const completed = makeSummary({ id: 'a', scenarioTitle: 'Locked out after a password reset' });
const challenge = makeSummary({
  id: 'b',
  scenarioId: 'checkout-outage',
  scenarioTitle: 'Checkout is down',
  difficulty: 'challenge',
  startingTemperature: 'angry',
  overallScore: 1.5,
  completion: 'ended-early',
  startedAt: '2026-11-11T09:00:00.000Z',
});
const sample = makeSummary({
  id: 'c',
  scenarioTitle: 'Team cannot open the workspace',
  scenarioId: 'workspace',
  isSample: true,
  mentorReviewed: true,
  startedAt: '2026-11-10T09:00:00.000Z',
});
const running = makeSummary({
  id: 'd',
  scenarioTitle: 'A call in progress',
  status: 'active',
  completion: null,
  overallScore: null,
  dimensionScores: null,
  endedAt: null,
  durationSeconds: null,
  traineeTurns: 2,
});

function renderHistory() {
  return render(
    <MemoryRouter>
      <History />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  scenarios.mockResolvedValue([]);
  listSessions.mockResolvedValue({ sessions: [completed, challenge, sample], total: 3 });
});

describe('History page', () => {
  it('shows each session in words, with its score, actions and sample labelling', async () => {
    listSessions.mockResolvedValue({ sessions: [running, completed, challenge, sample], total: 4 });
    renderHistory();
    expect(await screen.findByText('Showing 4 of 4 sessions.')).toBeInTheDocument();

    const row = (title: string) =>
      screen.getByRole('heading', { level: 3, name: title }).closest('article') as HTMLElement;

    const done = row('Locked out after a password reset');
    expect(within(done).getByText('Completed')).toBeInTheDocument();
    expect(within(done).getByText('Starts frustrated')).toBeInTheDocument();
    expect(done).toHaveTextContent('3.5 of 5');
    expect(done).toHaveTextContent(
      'Skill scores: Opening 4, Discovery 3, Empathy 4, Clarity 3, Ownership 4, Closing 3.',
    );
    expect(within(done).getByRole('link', { name: /open report/i })).toHaveAttribute(
      'href',
      '/sessions/a/report',
    );
    expect(within(done).getByRole('link', { name: 'Transcript' })).toHaveAttribute(
      'href',
      '/sessions/a/transcript',
    );
    expect(within(done).getByRole('link', { name: 'Practise again' })).toHaveAttribute(
      'href',
      '/scenarios/locked-out-after-password-reset/setup',
    );
    expect(within(done).queryByText('Sample')).not.toBeInTheDocument();

    expect(within(row('Checkout is down')).getByText('Ended early')).toBeInTheDocument();

    const demo = row('Team cannot open the workspace');
    expect(within(demo).getByText('Sample')).toBeInTheDocument();
    expect(within(demo).getByText('Mentor reviewed')).toBeInTheDocument();
    expect(within(demo).getByText(/not your own practice/i)).toBeInTheDocument();

    const live = row('A call in progress');
    expect(within(live).getByText('In progress')).toBeInTheDocument();
    expect(within(live).getByRole('link', { name: /resume/i })).toHaveAttribute('href', '/calls/d');
    expect(within(live).queryByRole('link', { name: 'Transcript' })).not.toBeInTheDocument();
    expect(live).toHaveTextContent('No score yet');
  });

  it('asks the server again when a filter changes and keeps the list while it loads', async () => {
    const user = userEvent.setup();
    renderHistory();
    await screen.findByText('Showing 3 of 3 sessions.');
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
      screen.getByRole('heading', { level: 3, name: 'Locked out after a password reset' }),
    ).toBeInTheDocument();
    release({ sessions: [challenge], total: 1 });
    expect(await screen.findByText('Showing 1 of 1 session.')).toBeInTheDocument();
    expect(listSessions).toHaveBeenLastCalledWith(
      expect.objectContaining({ difficulty: 'challenge' }),
      expect.anything(),
    );
    expect(
      screen.queryByRole('heading', { level: 3, name: 'Locked out after a password reset' }),
    ).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Status'), 'attention');
    await waitFor(() =>
      expect(listSessions).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'evaluation_failed', difficulty: 'challenge' }),
        expect.anything(),
      ),
    );
  });

  it('can hide sample sessions', async () => {
    const user = userEvent.setup();
    renderHistory();
    await screen.findByText('Showing 3 of 3 sessions.');
    await user.click(screen.getByRole('switch', { name: 'Show sample sessions' }));
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
      await screen.findByRole('heading', { name: 'No practice sessions yet' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/sample sessions can be loaded from the trainer page/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /browse scenarios/i })).toHaveAttribute(
      'href',
      '/scenarios',
    );

    await user.selectOptions(screen.getByLabelText('Difficulty'), 'challenge');
    expect(
      await screen.findByRole('heading', { name: 'No sessions match these filters' }),
    ).toBeInTheDocument();
    listSessions.mockResolvedValue({ sessions: [completed], total: 1 });
    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0] as HTMLElement);
    expect(await screen.findByText('Showing 1 of 1 session.')).toBeInTheDocument();
    expect(screen.getByLabelText('Difficulty')).toHaveValue('');
  });

  it('loads more sessions with limit and offset', async () => {
    const user = userEvent.setup();
    listSessions.mockResolvedValueOnce({ sessions: [completed, challenge], total: 3 });
    listSessions.mockResolvedValueOnce({ sessions: [sample], total: 3 });
    renderHistory();
    await screen.findByText('Showing 2 of 3 sessions.');
    await user.click(screen.getByRole('button', { name: 'Show more' }));
    expect(await screen.findByText('Showing 3 of 3 sessions.')).toBeInTheDocument();
    expect(listSessions).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: 2, limit: 12 }),
    );
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
    // Focus lands on the first new session so keyboard and screen-reader users are not left behind.
    expect(
      screen.getByRole('heading', { level: 3, name: 'Team cannot open the workspace' }),
    ).toHaveFocus();
  });

  describe('deleting', () => {
    const open = async (user: ReturnType<typeof userEvent.setup>, title: string) => {
      await screen.findByText('Showing 3 of 3 sessions.');
      await user.click(screen.getByRole('button', { name: new RegExp(`^Delete ${title}`) }));
      return screen.getByRole('dialog', { name: 'Delete this session?' });
    };

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
      expect(
        screen.getByRole('heading', { level: 3, name: 'Checkout is down' }),
      ).toBeInTheDocument();
    });

    it('removes the row, announces it and moves focus to the next session', async () => {
      const user = userEvent.setup();
      deleteSession.mockResolvedValue({ deleted: true });
      renderHistory();
      const dialog = await open(user, 'Checkout is down');
      await user.click(within(dialog).getByRole('button', { name: 'Delete session' }));

      expect(deleteSession).toHaveBeenCalledWith('b');
      expect(
        await screen.findByText(/Deleted “Checkout is down”\. Showing 2 of 2 sessions\./),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { level: 3, name: 'Checkout is down' }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(
        screen.getByRole('heading', { level: 3, name: 'Team cannot open the workspace' }),
      ).toHaveFocus();
    });

    it('keeps the row and shows the problem when deleting fails', async () => {
      const user = userEvent.setup();
      deleteSession.mockRejectedValue(
        new ApiError(409, 'conflict', 'That session is busy. Try again in a moment.', true),
      );
      renderHistory();
      const dialog = await open(user, 'Checkout is down');
      await user.click(within(dialog).getByRole('button', { name: 'Delete session' }));
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('That session is busy.');
      expect(
        screen.getByRole('heading', { level: 3, name: 'Checkout is down' }),
      ).toBeInTheDocument();
    });
  });

  it('compares two completed sessions in text and cautions about differences', async () => {
    const user = userEvent.setup();
    renderHistory();
    await screen.findByText('Showing 3 of 3 sessions.');
    await user.click(
      screen.getByRole('checkbox', { name: /^Compare Locked out after a password reset/ }),
    );
    expect(
      screen.getByText('One session selected. Choose one more to compare them.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /^Compare Checkout is down/ }));
    // Only two at a time.
    expect(screen.getByRole('checkbox', { name: /^Compare Team cannot open/ })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Compare' }));
    const dialog = screen.getByRole('dialog', { name: 'Compare two sessions' });
    expect(dialog).toHaveTextContent('different scenarios');
    expect(dialog).toHaveTextContent('different difficulty levels');
    const table = within(dialog).getByRole('table');
    // The earlier call is the Challenge one (1.5); the later one scored 3.5, so overall is +2 higher.
    expect(within(table).getByRole('row', { name: /^Overall/ })).toHaveTextContent('+2 higher');
    expect(within(table).getByRole('row', { name: /^Opening/ })).toHaveTextContent('same');
  });
});
