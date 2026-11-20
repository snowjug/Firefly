import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BadgeDTO, RewardsDTO, SessionDTO, SessionSummaryDTO } from '#shared/domain/api.ts';
import { makeSummary } from '../components/report/report.fixtures.ts';
import { ApiError, api } from '../lib/api.ts';
import type * as ApiModule from '../lib/api.ts';
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

const local = (month: number, day: number, hour = 12) =>
  new Date(2026, month - 1, day, hour).toISOString();

const completed = makeSummary({
  id: 'a',
  scenarioTitle: 'Locked out after a password reset',
  startedAt: local(11, 12),
});
const challenge = makeSummary({
  id: 'b',
  scenarioId: 'checkout-outage',
  scenarioTitle: 'Checkout is down',
  difficulty: 'challenge',
  impact: 'high',
  startingTemperature: 'angry',
  overallScore: 1.5,
  completion: 'ended-early',
  startedAt: local(11, 11),
});
const sample = makeSummary({
  id: 'c',
  scenarioTitle: 'Team cannot open the workspace',
  scenarioId: 'workspace',
  impact: 'low',
  isSample: true,
  mentorReviewed: true,
  startedAt: local(10, 28),
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
  startedAt: local(11, 13),
});
const failed = makeSummary({
  id: 'e',
  scenarioId: 'report-failed',
  scenarioTitle: 'The report did not build',
  status: 'evaluation_failed',
  completion: null,
  overallScore: null,
  dimensionScores: null,
  startedAt: local(11, 10),
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

/** Answers the list endpoint the way the server does: filters, then a page of the rest. */
function serve(sessions: readonly SessionSummaryDTO[]) {
  listSessions.mockImplementation(async (params = {}) => {
    let list = [...sessions];
    if (params.status) list = list.filter((s) => s.status === params.status);
    if (params.difficulty) list = list.filter((s) => s.difficulty === params.difficulty);
    if (params.scenarioId) list = list.filter((s) => s.scenarioId === params.scenarioId);
    if (params.includeSamples === false) list = list.filter((s) => !s.isSample);
    const offset = params.offset ?? 0;
    return { sessions: list.slice(offset, offset + (params.limit ?? 50)), total: list.length };
  });
}
/** The requests that asked for a page of calls (the others only ask for a count). */
const pageRequests = () =>
  listSessions.mock.calls.map(([params]) => params ?? {}).filter((params) => params.limit === 12);

function renderHistory() {
  return render(
    <MemoryRouter>
      <History />
    </MemoryRouter>,
  );
}

const rowOf = (title: string) =>
  screen.getByRole('heading', { level: 4, name: title }).closest('li') as HTMLElement;
const openRefine = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByText('Refine'));
};
const shown = (text: string) => screen.findByText(text);

beforeEach(() => {
  vi.resetAllMocks();
  scenarios.mockResolvedValue([]);
  rewards.mockResolvedValue({ badges: [] } as unknown as RewardsDTO);
  serve([completed, challenge, sample]);
});

describe('History page', () => {
  it('opens with its title, the status filters with counts, and the calls as a trail', async () => {
    renderHistory();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'My practice history' })).toBeVisible();
    expect(screen.getByText(/^Every call you practise, newest first\./)).toBeVisible();

    const list = await screen.findByRole('list', { name: 'Practice calls, newest first' });
    expect(within(list).getAllByRole('heading', { level: 4 })).toHaveLength(3);
    expect(screen.getByText('Showing 3 of 3 calls.')).toBeInTheDocument();

    const tabs = within(screen.getByRole('tablist', { name: 'Show calls by status' }));
    await waitFor(() =>
      expect(tabs.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
        'All statuses 3',
        'Completed 3',
        'In progress 0',
        'Needs attention 0',
      ]),
    );
    expect(tabs.getByRole('tab', { selected: true })).toHaveTextContent('All statuses');
    // The quieter filters are one press away.
    expect(screen.getByText('Refine')).toBeVisible();
  });

  it('shows each call in words: when, how it ended, how demanding, the score and what fits it', async () => {
    serve([running, completed, challenge, sample, failed]);
    renderHistory();
    await shown('Showing 5 of 5 calls.');

    const done = rowOf('Locked out after a password reset');
    expect(within(done).getByText('Completed')).toBeInTheDocument();
    expect(within(done).getByText(/Starter/)).toBeInTheDocument();
    expect(within(done).getByText(/Medium impact/)).toBeInTheDocument();
    expect(within(done).getByText(/Starts frustrated/)).toBeInTheDocument();
    expect(within(done).getByText(/6 messages/)).toBeInTheDocument();
    expect(within(done).getByText(/9 min/)).toBeInTheDocument();
    expect(within(done).getByText('3.5').closest('p')).toHaveTextContent('3.5 of 5 out of 5');
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

    const early = rowOf('Checkout is down');
    expect(within(early).getByText('Ended early')).toBeInTheDocument();
    expect(within(early).getByText(/Challenge/)).toBeInTheDocument();
    expect(within(early).getByText(/High impact/)).toBeInTheDocument();
    expect(within(early).getByText(/Starts angry/)).toBeInTheDocument();
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

  it('draws each call as an instrument that is solid only when it was taken to a close', async () => {
    serve([completed, challenge]);
    const { container } = renderHistory();
    await shown('Showing 2 of 2 calls.');
    const nodes = [...container.querySelectorAll('.trail__node svg.sig-glyph')];
    expect(nodes).toHaveLength(2);
    // Every node is decoration: the words beside it say the same.
    for (const node of nodes) expect(node).toHaveAttribute('aria-hidden', 'true');
    const [full, early] = nodes;
    expect(full?.querySelector('.sig-heart.is-solid')).not.toBeNull();
    expect(early?.querySelector('.sig-heart.is-solid')).toBeNull();
    expect(early?.querySelector('.sig-heart-half')).not.toBeNull();
  });

  it('says who the customer was when the library knows the scenario, and nothing when it does not', async () => {
    scenarios.mockResolvedValue([
      {
        id: 'locked-out-after-password-reset',
        title: 'Locked out after a password reset',
        callStage: 'follow-up',
        estimatedMinutes: 8,
        persona: { name: 'Maya Okafor', role: 'Front-desk coordinator', organisation: 'Fabrikam' },
      },
    ] as unknown as Awaited<ReturnType<typeof api.scenarios>>);
    renderHistory();
    await shown('Showing 3 of 3 calls.');
    await waitFor(() =>
      expect(
        within(rowOf('Locked out after a password reset')).getByText(/with Maya Okafor/),
      ).toBeInTheDocument(),
    );
    expect(within(rowOf('Checkout is down')).queryByText(/with /)).not.toBeInTheDocument();
  });

  it('puts the badges a call earned in its row, and says nothing for the rest', async () => {
    rewards.mockResolvedValue({
      badges: [
        badge({ earned: true, earnedInSessionId: 'a', title: 'First Practice' }),
        badge({ id: 'de-escalator', earned: true, earnedInSessionId: 'a', title: 'De-escalator' }),
        badge({ id: 'scope-detective', title: 'Scope Detective' }),
      ],
    } as unknown as RewardsDTO);
    renderHistory();
    await shown('Showing 3 of 3 calls.');

    const done = rowOf('Locked out after a password reset');
    await waitFor(() => expect(within(done).getByText('First Practice')).toBeInTheDocument());
    expect(within(done).getByText('De-escalator')).toBeInTheDocument();
    expect(within(rowOf('Checkout is down')).queryByText(/badge/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Scope Detective')).not.toBeInTheDocument();
  });

  it('still shows every call when badges cannot be loaded', async () => {
    rewards.mockRejectedValue(new ApiError(500, 'internal', 'Something went wrong.', true));
    renderHistory();
    await shown('Showing 3 of 3 calls.');
    await waitFor(() => expect(rewards).toHaveBeenCalled());

    for (const title of [
      'Locked out after a password reset',
      'Checkout is down',
      'Team cannot open the workspace',
    ]) {
      expect(within(rowOf(title)).getByRole('link', { name: /^View report/ })).toBeInTheDocument();
    }
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('runs the trail on by month, a heading each, as one list inside one list', async () => {
    serve([running, completed, challenge, failed, sample]);
    renderHistory();
    await shown('Showing 5 of 5 calls.');
    const trail = screen.getByRole('list', { name: 'Practice calls, newest first' });
    const months = within(trail).getAllByRole('heading', { level: 3 });
    expect(months).toHaveLength(2);
    // November holds four calls and October one, newest first within each.
    const lists = within(trail).getAllByRole('list');
    expect(within(lists[0] as HTMLElement).getAllByRole('heading', { level: 4 })).toHaveLength(4);
    expect(
      within(lists[1] as HTMLElement)
        .getAllByRole('heading', { level: 4 })
        .map((heading) => heading.textContent),
    ).toEqual(['Team cannot open the workspace']);
  });

  it('asks the server again when the status changes and keeps the list while it loads', async () => {
    const user = userEvent.setup();
    renderHistory();
    await shown('Showing 3 of 3 calls.');
    expect(pageRequests().at(-1)).toMatchObject({ includeSamples: true, limit: 12, offset: 0 });

    let release: (value: { sessions: SessionSummaryDTO[]; total: number }) => void = () =>
      undefined;
    listSessions.mockImplementationOnce(() => new Promise((resolve) => (release = resolve)));
    await user.click(screen.getByRole('tab', { name: /^Completed/ }));
    // The previous list stays visible while the new one loads.
    expect(screen.getByRole('heading', { level: 4, name: 'Checkout is down' })).toBeInTheDocument();
    release({ sessions: [completed], total: 1 });
    expect(await shown('Showing 1 of 1 call.')).toBeInTheDocument();
    expect(pageRequests().at(-1)).toMatchObject({ status: 'completed' });
    expect(
      screen.queryByRole('heading', { level: 4, name: 'Checkout is down' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Completed/, selected: true })).toBeInTheDocument();
    // The tab and the list it controls are tied together for assistive technology.
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAccessibleName(/^Completed/);
  });

  it('keeps the arrow keys on the status words, like any set of tabs', async () => {
    const user = userEvent.setup();
    renderHistory();
    await shown('Showing 3 of 3 calls.');
    await user.click(screen.getByRole('tab', { name: /^All statuses/ }));
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /^Completed/, selected: true })).toHaveFocus();
    await waitFor(() => expect(pageRequests().at(-1)).toMatchObject({ status: 'completed' }));
  });

  it('refines by difficulty and by scenario, using every scenario the calls and the library know', async () => {
    const user = userEvent.setup();
    scenarios.mockResolvedValue([
      { id: 'billing', title: 'Billing question' },
    ] as unknown as Awaited<ReturnType<typeof api.scenarios>>);
    renderHistory();
    await shown('Showing 3 of 3 calls.');
    await openRefine(user);

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

    await user.click(screen.getByRole('radio', { name: 'Challenge' }));
    await waitFor(() => expect(pageRequests().at(-1)).toMatchObject({ difficulty: 'challenge' }));
    expect(await shown('Showing 1 of 1 call.')).toBeInTheDocument();
    expect(screen.getByText('1 applied')).toBeInTheDocument();

    await user.selectOptions(select, 'checkout-outage');
    await waitFor(() =>
      expect(pageRequests().at(-1)).toMatchObject({
        scenarioId: 'checkout-outage',
        difficulty: 'challenge',
      }),
    );
    expect(screen.getByText('2 applied')).toBeInTheDocument();
  });

  it('can hide sample calls', async () => {
    const user = userEvent.setup();
    renderHistory();
    await shown('Showing 3 of 3 calls.');
    await openRefine(user);
    expect(screen.getByRole('switch', { name: 'Show sample calls' })).toBeChecked();
    await user.click(screen.getByRole('switch', { name: 'Show sample calls' }));
    await waitFor(() => expect(pageRequests().at(-1)).toMatchObject({ includeSamples: false }));
    expect(await shown('Showing 2 of 2 calls.')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { level: 4, name: 'Team cannot open the workspace' }),
    ).not.toBeInTheDocument();
  });

  it('counts what each status would show, and says nothing where there are no calls', async () => {
    serve([completed, challenge, running, failed]);
    const { unmount } = renderHistory();
    await shown('Showing 4 of 4 calls.');
    const tabs = within(screen.getByRole('tablist', { name: 'Show calls by status' }));
    await waitFor(() =>
      expect(tabs.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
        'All statuses 4',
        'Completed 2',
        'In progress 1',
        'Needs attention 1',
      ]),
    );
    unmount();

    serve([]);
    renderHistory();
    await screen.findByRole('heading', { name: 'No practice calls yet' });
    expect(
      screen
        .getAllByRole('tab')
        .map((tab) => tab.textContent)
        .join(),
    ).toBe('All statuses,Completed,In progress,Needs attention');
  });

  it('shows the list without counts when the counts cannot be had', async () => {
    listSessions.mockImplementation(async (params = {}) => {
      if (params.limit === 1) throw new ApiError(500, 'internal', 'No counts today.', true);
      return { sessions: [completed], total: 1 };
    });
    renderHistory();
    await shown('Showing 1 of 1 call.');
    await waitFor(() =>
      expect(listSessions).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 1 }),
        expect.anything(),
      ),
    );
    expect(screen.getByRole('tab', { name: 'All statuses' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('explains an empty history, and an empty filter result differently', async () => {
    const user = userEvent.setup();
    serve([]);
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
    expect(screen.queryByRole('list', { name: /Practice calls/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /^In progress/ }));
    expect(
      await screen.findByRole('heading', { name: 'No calls match these filters' }),
    ).toBeInTheDocument();
    serve([completed]);
    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0] as HTMLElement);
    expect(await shown('Showing 1 of 1 call.')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^All statuses/, selected: true })).toBeInTheDocument();
  });

  it('tells someone who hid the samples where to turn them back on', async () => {
    const user = userEvent.setup();
    serve([]);
    renderHistory();
    await screen.findByRole('heading', { name: 'No practice calls yet' });
    await openRefine(user);
    await user.click(screen.getByRole('switch', { name: 'Show sample calls' }));
    expect(await screen.findByText(/Sample calls are hidden/)).toBeInTheDocument();
  });

  it('says so, and offers another try, when the history cannot be loaded', async () => {
    const user = userEvent.setup();
    listSessions.mockRejectedValueOnce(new ApiError(0, 'network', 'Can’t reach Firefly.', true));
    renderHistory();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('We couldn’t load your history');
    expect(alert).toHaveTextContent('Can’t reach Firefly.');
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await shown('Showing 3 of 3 calls.')).toBeInTheDocument();
  });

  it('loads more calls with limit and offset, and moves focus to the first new one', async () => {
    const user = userEvent.setup();
    serve([completed, challenge, sample]);
    listSessions.mockImplementation(async (params = {}) => {
      const all = [completed, challenge, sample];
      if (params.limit === 1) return { sessions: all.slice(0, 1), total: 3 };
      const offset = params.offset ?? 0;
      return { sessions: all.slice(offset, offset === 0 ? 2 : 3), total: 3 };
    });
    renderHistory();
    await shown('Showing 2 of 3 calls.');
    await user.click(screen.getByRole('button', { name: 'Show more' }));
    expect(await shown('Showing 3 of 3 calls.')).toBeInTheDocument();
    expect(pageRequests().at(-1)).toMatchObject({ offset: 2, limit: 12 });
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
    // Keyboard and screen-reader users are not left behind at the button that went away.
    expect(
      within(rowOf('Team cannot open the workspace')).getByRole('link', { name: /^View report/ }),
    ).toHaveFocus();
  });

  it('draws only one page of a long history at a time', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 200 }, (_, i) =>
      makeSummary({
        id: `m-${i}`,
        scenarioTitle: `Call number ${i}`,
        startedAt: new Date(2026, 10, 1, 12, 0, 0, 0 - i * 1000).toISOString(),
      }),
    );
    serve(many);
    renderHistory();
    await shown('Showing 12 of 200 calls.');
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(12);
    await user.click(screen.getByRole('button', { name: 'Show more' }));
    await shown('Showing 24 of 200 calls.');
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(24);
  });

  it('keeps going when a title is very long, has no break to wrap at, or a date is unreadable', async () => {
    const long = 'A scenario title that goes on and on '.repeat(8).trim();
    const unbroken = 'Supercalifragilistic_'.repeat(8);
    serve([
      makeSummary({ id: 'long', scenarioTitle: long, startedAt: local(11, 12) }),
      makeSummary({ id: 'unbroken', scenarioTitle: unbroken, startedAt: local(11, 11) }),
      makeSummary({ id: 'broken', scenarioTitle: 'Odd date', startedAt: 'not a date' }),
    ]);
    renderHistory();
    await shown('Showing 3 of 3 calls.');
    expect(screen.getByRole('heading', { level: 4, name: long })).toBeVisible();
    expect(screen.getByRole('heading', { level: 4, name: unbroken })).toBeVisible();
    expect(within(rowOf('Odd date')).getAllByText('Date unknown').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { level: 3, name: 'Date unknown' })).toBeVisible();
  });

  describe('deleting', () => {
    const open = async (user: ReturnType<typeof userEvent.setup>, title: string) => {
      await shown('Showing 3 of 3 calls.');
      await user.click(screen.getByRole('button', { name: new RegExp(`^Delete ${title}`) }));
      return screen.getByRole('dialog', { name: 'Delete this call?' });
    };

    it('gives every row a delete button with a name that says which call it is', async () => {
      renderHistory();
      await shown('Showing 3 of 3 calls.');
      expect(screen.getAllByRole('button', { name: /^Delete / })).toHaveLength(3);
      expect(screen.getByRole('button', { name: /^Delete Checkout is down, / })).toHaveTextContent(
        'Delete',
      );
    });

    it('says what is deleted, and Cancel changes nothing', async () => {
      const user = userEvent.setup();
      renderHistory();
      const dialog = await open(user, 'Checkout is down');
      expect(dialog).toHaveTextContent(
        'permanently deletes the transcript and the coaching report',
      );
      expect(dialog).toHaveTextContent('can’t be undone');
      expect(dialog).toHaveTextContent('Checkout is down');
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect(deleteSession).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(
        screen.getByRole('heading', { level: 4, name: 'Checkout is down' }),
      ).toBeInTheDocument();
    });

    it('removes the row, announces it, updates the counts and moves focus to the next call', async () => {
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
        screen.queryByRole('heading', { level: 4, name: 'Checkout is down' }),
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
      expect(
        screen.getByRole('heading', { level: 4, name: 'Checkout is down' }),
      ).toBeInTheDocument();
    });

    it('says so when there is no connection, and keeps the row', async () => {
      const user = userEvent.setup();
      deleteSession.mockRejectedValue(
        new ApiError(0, 'network', 'Can’t reach Firefly right now.', true),
      );
      renderHistory();
      const dialog = await open(user, 'Checkout is down');
      await user.click(within(dialog).getByRole('button', { name: 'Delete call' }));
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('Can’t reach Firefly');
      expect(within(dialog).getByRole('button', { name: 'Delete call' })).toBeEnabled();
    });
  });

  describe('retrying a report', () => {
    beforeEach(() => {
      serve([failed, completed]);
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
      await shown('Showing 2 of 2 calls.');
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
      expect(within(row).getByText('Completed')).toBeInTheDocument();
    });

    it('says so when the report still cannot be built, and keeps the retry', async () => {
      const user = userEvent.setup();
      evaluate.mockResolvedValue({ ...failed } as SessionDTO);
      renderHistory();
      await shown('Showing 2 of 2 calls.');
      await user.click(screen.getByRole('button', { name: /^Retry report/ }));
      expect(await screen.findByRole('alert')).toHaveTextContent('still could not be built');
      expect(screen.getByRole('button', { name: /^Retry report/ })).toBeInTheDocument();
    });

    it('shows the server’s message when the retry itself fails', async () => {
      const user = userEvent.setup();
      evaluate.mockRejectedValue(new ApiError(503, 'unavailable', 'The coach is busy.', true));
      renderHistory();
      await shown('Showing 2 of 2 calls.');
      await user.click(screen.getByRole('button', { name: /^Retry report/ }));
      expect(await screen.findByRole('alert')).toHaveTextContent('The coach is busy.');
    });
  });

  describe('comparing', () => {
    it('compares two completed calls in text and cautions about differences', async () => {
      const user = userEvent.setup();
      renderHistory();
      await shown('Showing 3 of 3 calls.');
      expect(screen.getByText('Tick two finished calls to compare their scores.')).toBeVisible();
      await user.click(
        screen.getByRole('checkbox', { name: /^Compare Locked out after a password reset/ }),
      );
      const bar = screen.getByRole('region', { name: 'Compare calls' });
      expect(
        within(bar).getByText('One call selected. Choose one more to compare them.'),
      ).toBeVisible();
      expect(within(bar).getByRole('button', { name: 'Compare' })).toBeDisabled();
      await user.click(screen.getByRole('checkbox', { name: /^Compare Checkout is down/ }));
      // Only two at a time.
      expect(screen.getByRole('checkbox', { name: /^Compare Team cannot open/ })).toBeDisabled();
      expect(within(bar).getByText('Two calls selected.')).toBeVisible();

      await user.click(within(bar).getByRole('button', { name: 'Compare' }));
      const dialog = screen.getByRole('dialog', { name: 'Compare two calls' });
      expect(dialog).toHaveTextContent('different scenarios');
      expect(dialog).toHaveTextContent('different difficulty levels');
      const table = within(dialog).getByRole('table');
      // The earlier call is the Challenge one (1.5); the later one scored 3.5, so overall is +2 higher.
      expect(within(table).getByRole('row', { name: /^Overall/ })).toHaveTextContent('+2 higher');
      expect(within(table).getByRole('row', { name: /^Opening/ })).toHaveTextContent('same');
      // The footer's Close, not the cross in the corner: both close it.
      await user.click(
        within(dialog).getAllByRole('button', { name: 'Close' }).at(-1) as HTMLElement,
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      // The selection survives, so the pair can be looked at again or cleared.
      await user.click(within(bar).getByRole('button', { name: 'Clear selection' }));
      expect(screen.queryByRole('region', { name: 'Compare calls' })).not.toBeInTheDocument();
      // The bar went with the selection, so focus was handed to the list rather than lost.
      expect(screen.getByRole('heading', { level: 2, name: 'Practice calls' })).toHaveFocus();
    });

    it('only offers to compare calls that finished with scores', async () => {
      serve([running, failed, completed]);
      renderHistory();
      await shown('Showing 3 of 3 calls.');
      expect(screen.getAllByRole('checkbox')).toHaveLength(1);
      expect(
        screen.getByRole('checkbox', { name: /^Compare Locked out after a password reset/ }),
      ).toBeInTheDocument();
    });
  });
});
