import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LEDGER_PAGE } from '../components/rewards/rewards-model.ts';
import {
  CONFIDENT,
  makeEmptyRewards,
  makeEntry,
  makeRewards,
} from '../components/rewards/rewards.fixtures.ts';
import { api } from '../lib/api.ts';
import type * as ApiModule from '../lib/api.ts';
import { loadDraft } from '../lib/draft.ts';
import { formatDate } from '../lib/format.ts';
import Rewards from './Rewards.tsx';

vi.mock('../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, api: { rewards: vi.fn() } };
});

const rewards = vi.mocked(api.rewards);

function renderRewards() {
  return render(
    <MemoryRouter>
      <Rewards />
    </MemoryRouter>,
  );
}

/** The page once its numbers have arrived. */
async function loaded() {
  const view = renderRewards();
  await screen.findByRole('heading', { name: 'How points work' });
  return view;
}

const panel = () => screen.getByRole('tabpanel');

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  rewards.mockResolvedValue(makeRewards());
});

describe('Rewards: the page', () => {
  it('says in plain words that rewards are points and encouragement, and asks in the learner\u2019s time zone', async () => {
    await loaded();
    expect(screen.getByRole('heading', { level: 1, name: 'Rewards' })).toBeVisible();
    expect(
      screen.getByText(
        'Points and badges for practising. They are encouragement, not a score or a ranking.',
      ),
    ).toBeVisible();
    expect(rewards).toHaveBeenCalledWith(new Date().getTimezoneOffset(), expect.anything());
  });

  it('keeps a skeleton in place while the numbers arrive', () => {
    rewards.mockReturnValue(new Promise(() => undefined));
    renderRewards();
    expect(screen.getByRole('heading', { level: 1, name: 'Rewards' })).toBeVisible();
    expect(screen.getByRole('status', { name: 'Loading your rewards' })).toBeInTheDocument();
  });

  it('shows the note from the server exactly as written', async () => {
    await loaded();
    expect(screen.getByText(makeRewards().note)).toBeVisible();
  });

  it('shows text from the server as plain text, never as markup', async () => {
    rewards.mockResolvedValue(
      makeRewards({
        ledger: [
          makeEntry(1, {
            title: '<b>Bold title</b>',
            reason: '<img src=x onerror=alert(1)>',
            evidence: { turnIndex: 2, quote: '<script>alert(2)</script>' },
          }),
        ],
      }),
    );
    const { container } = await loaded();
    expect(screen.getByText('<b>Bold title</b>')).toBeVisible();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeVisible();
    expect(container.querySelector('img, script, b')).toBeNull();
  });

  it('never uses experience-point, leaderboard or hype words', async () => {
    const { container } = await loaded();
    expect(container.textContent).not.toMatch(
      /\bXP\b|experience points|leaderboard|top performer|level up/i,
    );
  });

  it('can be retried when the rewards cannot be loaded', async () => {
    const user = userEvent.setup();
    rewards.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(makeRewards());
    renderRewards();
    const alert = await screen.findByRole('alert');
    expect(
      within(alert).getByRole('heading', { name: 'We could not load your rewards' }),
    ).toBeVisible();
    await user.click(within(alert).getByRole('button', { name: /Try again/ }));
    expect(await screen.findByRole('heading', { name: 'How points work' })).toBeVisible();
  });
});

describe('Rewards: level, badges, challenges and streak', () => {
  it('shows the level with points, and how far there is to go in points and in kinds of call', async () => {
    await loaded();
    const level = screen.getByText('Level 3 of 4').closest('.rw-level') as HTMLElement;
    expect(within(level).getByText('Practitioner')).toBeVisible();
    expect(within(level).getByText('555 points')).toBeVisible();
    const bar = within(level).getByRole('progressbar', { name: 'Progress to Confident Handler' });
    expect(bar).toHaveAttribute('aria-valuenow', '19');
    expect(within(level).getByText('245 points and 1 more kind of call to go')).toBeVisible();
    expect(within(level).getByText('4 of 7 kinds of call practised')).toBeVisible();
  });

  it('says so at the top level instead of showing a bar', async () => {
    rewards.mockResolvedValue(makeRewards({ level: CONFIDENT, nextLevel: null, points: 1200 }));
    await loaded();
    expect(screen.getByText('You have reached the top level')).toBeVisible();
    expect(screen.queryByRole('progressbar', { name: /Progress to/ })).not.toBeInTheDocument();
  });

  it('counts badges and active challenges and gives the streak without pressure', async () => {
    await loaded();
    const stat = (label: string) => screen.getByText(label).closest('.rw-stat') as HTMLElement;
    expect(within(stat('Badges earned')).getByText('2 of 6')).toBeVisible();
    expect(within(stat('Active challenges')).getByText('2')).toBeVisible();
    const streak = stat('Current streak');
    expect(within(streak).getByText('2 days')).toBeVisible();
    expect(within(streak).getByText('Best: 3 days')).toBeVisible();
    expect(within(streak).getByText('A missed day never costs you anything.')).toBeVisible();
  });
});

describe('Rewards: tabs', () => {
  it('counts what is in each tab and starts on all badges', async () => {
    await loaded();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'All badges6',
      'In progress2',
      'Challenges3',
    ]);
    expect(screen.getByRole('tab', { name: /All badges/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(within(panel()).getAllByRole('heading', { level: 3 })).toHaveLength(6);
  });

  it('moves between tabs with the arrow keys, Home and End, and shows the right cards in each', async () => {
    const user = userEvent.setup();
    await loaded();
    // The selected tab is the one tab stop; the arrow keys do the rest.
    const all = screen.getByRole('tab', { name: /All badges/ });
    all.focus();
    await user.keyboard('{ArrowRight}');
    const progress = screen.getByRole('tab', { name: /In progress/ });
    expect(progress).toHaveFocus();
    expect(progress).toHaveAttribute('aria-selected', 'true');
    expect(panel()).toHaveAttribute('aria-labelledby', progress.id);
    expect(
      within(panel())
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(['Scope Detective', 'Scenario Explorer']);

    await user.keyboard('{ArrowRight}');
    const challenges = screen.getByRole('tab', { name: /Challenges/ });
    expect(challenges).toHaveFocus();
    expect(within(panel()).getAllByRole('heading', { level: 3 })).toHaveLength(3);

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /All badges/ })).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(challenges).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: /All badges/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await user.keyboard('{End}');
    expect(challenges).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps only one tab in the tab order, so Tab moves on to the panel', async () => {
    await loaded();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
  });
});

describe('Rewards: badges', () => {
  it('writes earned or locked in words, with the date and the exact progress', async () => {
    await loaded();
    const card = (title: string) =>
      within(panel()).getByRole('heading', { name: title }).closest('li') as HTMLElement;

    const first = card('First Practice');
    expect(first).toHaveAttribute('data-earned', 'true');
    expect(
      within(first).getByText(`Earned ${formatDate('2026-11-12T10:00:00.000Z')}`),
    ).toBeVisible();
    expect(within(first).getByText('1 of 1 scenario')).toBeVisible();
    expect(
      within(first).getByRole('link', { name: 'See the call that earned it' }),
    ).toHaveAttribute('href', '/sessions/call-1/report');

    const scope = card('Scope Detective');
    expect(scope).toHaveAttribute('data-earned', 'false');
    expect(within(scope).getByText('Locked')).toBeVisible();
    expect(
      within(scope).getByText('Find every hidden fact in three different scenarios.'),
    ).toBeVisible();
    expect(within(scope).getByText('2 of 3 scenarios')).toBeVisible();
    const bar = within(scope).getByRole('progressbar', { name: 'Scope Detective: progress' });
    expect(bar).toHaveAttribute('aria-valuenow', '2');
    expect(bar).toHaveAttribute('aria-valuemax', '3');

    expect(within(panel()).getAllByText('Locked')).toHaveLength(4);
    expect(within(panel()).getAllByText(/^Earned /)).toHaveLength(2);
    expect(within(card('Scenario Explorer')).getByText('3 of 4 kinds of call')).toBeVisible();
  });

  it('explains what to do when nothing has been started yet', async () => {
    const user = userEvent.setup();
    rewards.mockResolvedValue(makeEmptyRewards());
    await loaded();
    await user.click(screen.getByRole('tab', { name: /In progress/ }));
    expect(within(panel()).getByText(/Nothing is in progress yet/)).toBeVisible();
  });
});

describe('Rewards: challenges', () => {
  async function openChallenges() {
    const user = userEvent.setup();
    await loaded();
    await user.click(screen.getByRole('tab', { name: /Challenges/ }));
    return user;
  }
  const card = (title: string) =>
    within(panel()).getByRole('heading', { name: title }).closest('li') as HTMLElement;

  it('shows each challenge with its reward, progress and status in words', async () => {
    await openChallenges();
    const family = card('Try a new scenario family');
    expect(
      within(family).getByText('Practise a kind of customer issue you have not tried yet.'),
    ).toBeVisible();
    expect(family).toHaveTextContent('Reward: 20 points');
    expect(family).toHaveTextContent('Status: Active');
    expect(within(family).getByText('3 of 7 kinds of call')).toBeVisible();
    expect(within(family).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3');

    const done = card('Practise on another day');
    expect(done).toHaveTextContent('Status: Completed');
    expect(done).toHaveTextContent('Reward: Toward Consistency Streak');
  });

  it('links Start to the suggested scenario, and only when there is one', async () => {
    await openChallenges();
    expect(
      within(card('Try a new scenario family')).getByRole('link', {
        name: 'Start: Try a new scenario family',
      }),
    ).toHaveAttribute('href', '/scenarios/slow-dashboard/setup');
    expect(within(card('Practise on another day')).queryByRole('link')).not.toBeInTheDocument();
  });

  it('starts a challenge at the difficulty it is measured at, as the setup page expects', async () => {
    const user = await openChallenges();
    await user.click(
      within(card('Lift a skill by a point')).getByRole('link', {
        name: 'Start: Lift a skill by a point',
      }),
    );
    expect(loadDraft()).toEqual({ scenarioId: 'locked-out', overrides: { difficulty: 'starter' } });
    await user.click(
      within(card('Try a new scenario family')).getByRole('link', {
        name: 'Start: Try a new scenario family',
      }),
    );
    expect(loadDraft()).toEqual({ scenarioId: 'slow-dashboard', overrides: {} });
  });
});

describe('Rewards: how points work', () => {
  it('lists every rule with what it pays and the safeguard that keeps it fair', async () => {
    await loaded();
    const section = screen
      .getByRole('heading', { name: 'How points work' })
      .closest('section') as HTMLElement;
    const rules = within(section).getAllByRole('list')[0] as HTMLElement;
    const items = within(rules).getAllByRole('listitem');
    expect(items).toHaveLength(7);
    const first = items[0] as HTMLElement;
    expect(within(first).getByRole('heading', { name: 'Complete a full scenario' })).toBeVisible();
    expect(within(first).getByText('50 points')).toBeInTheDocument();
    expect(within(first).getByText('How you earn it: Complete a full scenario.')).toBeVisible();
    expect(first).toHaveTextContent('Safeguard: The safeguard for Complete a full scenario.');
    expect(within(section).getByText(/Speed and call length earn nothing/)).toBeVisible();
  });

  it('marks the current level among all four', async () => {
    await loaded();
    const levels = screen.getByRole('list', { name: 'Levels' });
    const items = within(levels).getAllByRole('listitem');
    expect(items.map((item) => item.querySelector('.rw-levels-name')?.textContent)).toEqual([
      'Foundation',
      'Builder',
      'PractitionerYou are here',
      'Confident Handler',
    ]);
    expect(items[2]).toHaveAttribute('aria-current', 'step');
    expect(
      within(items[3] as HTMLElement).getByText('800 points and 6 kinds of call'),
    ).toBeVisible();
  });
});

describe('Rewards: points history', () => {
  const many = (count: number) =>
    makeRewards({ ledger: Array.from({ length: count }, (_, index) => makeEntry(index + 1)) });
  const entries = () =>
    within(
      screen.getByRole('heading', { name: 'Points history' }).closest('section') as HTMLElement,
    ).getAllByRole('listitem');

  it('gives each award its points, the reason, the call and the moment it came from', async () => {
    await loaded();
    const [first, second] = entries() as [HTMLElement, HTMLElement];
    expect(within(first).getByText('+10')).toBeInTheDocument();
    expect(within(first).getByText('10 points')).toBeInTheDocument();
    expect(within(first).getByText('Uncovered a hidden fact')).toBeVisible();
    expect(
      within(first).getByText('Your question brought out the time the problem started.'),
    ).toBeVisible();
    expect(within(first).getByRole('link', { name: 'Scenario 1' })).toHaveAttribute(
      'href',
      '/sessions/call-1/report',
    );
    expect(first).toHaveTextContent('When did this start, and did anything change?');
    expect(within(first).getByRole('link', { name: 'Turn 4 in the transcript' })).toHaveAttribute(
      'href',
      '/sessions/call-1/transcript?turn=4',
    );
    expect(second.querySelector('blockquote')).toBeNull();
    expect(within(second).getByText('50 points')).toBeInTheDocument();
  });

  it('shows the newest 20 and adds 20 more on request, moving focus to the first new entry', async () => {
    const user = userEvent.setup();
    rewards.mockResolvedValue(many(45));
    await loaded();
    expect(entries()).toHaveLength(LEDGER_PAGE);
    expect(screen.getByText('Showing 20 of 45 entries')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Show more' }));
    expect(entries()).toHaveLength(40);
    expect(entries()[20]).toHaveFocus();
    expect(screen.getByText('Showing 40 of 45 entries')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Show more' }));
    expect(entries()).toHaveLength(45);
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
    expect(screen.getByText('Showing 45 of 45 entries')).toBeVisible();
  });

  it('says the total counts every entry when the server lists only the newest 200', async () => {
    rewards.mockResolvedValue(many(200));
    await loaded();
    expect(
      screen.getByText('Your newest 200 entries are listed. Your total counts every entry.'),
    ).toBeVisible();
  });
});

describe('Rewards: a first visit', () => {
  it('explains how to earn the first points and where to start', async () => {
    rewards.mockResolvedValue(makeEmptyRewards());
    await loaded();
    const note = screen.getByRole('note');
    expect(within(note).getByText('You have not earned any points yet.')).toBeVisible();
    expect(within(note).getByText(/Finishing a full scenario earns 50 points/)).toBeVisible();
    expect(within(note).getByRole('link', { name: /Start practice/ })).toHaveAttribute(
      'href',
      '/practice',
    );
    expect(within(note).getByRole('link', { name: 'See how points work' })).toHaveAttribute(
      'href',
      '#rw-rules-title',
    );
    expect(screen.getByText('0 points')).toBeVisible();
    expect(screen.getByText(/Nothing here yet/)).toBeVisible();
    expect(within(panel()).getAllByText('Locked')).toHaveLength(6);
  });

  it('does not show the first-points hint once there are points', async () => {
    await loaded();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });
});
