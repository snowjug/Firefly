import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../lib/api.ts';
import type * as ApiModule from '../../lib/api.ts';
import { loadDraft } from '../../lib/draft.ts';
import { formatDate } from '../../lib/format.ts';
import { useApi } from '../../lib/hooks.ts';
import * as sound from '../../lib/sound.ts';
import { ThemeProvider } from '../../lib/theme.tsx';
import { Recognition } from './Recognition.tsx';
import { LEDGER_PAGE } from './rewards-model.ts';
import {
  BADGES,
  CONFIDENT,
  makeBadge,
  makeChallenge,
  makeEmptyRewards,
  makeEntry,
  makeRewards,
} from './rewards.fixtures.ts';

vi.mock('../../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, api: { rewards: vi.fn() } };
});

const rewards = vi.mocked(api.rewards);

// The page asks for its numbers and hands them to the section; this stands in for the page.
function Harness() {
  const state = useApi((signal) => api.rewards(new Date().getTimezoneOffset(), signal), []);
  return <Recognition rewards={state} />;
}

function renderRecognition() {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <Harness />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

/** The section once its numbers have arrived. */
async function loaded() {
  const view = renderRecognition();
  await screen.findByRole('heading', { name: 'How points work' });
  return view;
}

const panel = () => screen.getByRole('tabpanel');
const badge = (title: string) =>
  within(panel()).getByRole('heading', { name: title }).closest('li') as HTMLElement;

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  rewards.mockResolvedValue(makeRewards());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Recognition: the section', () => {
  it('says in plain words that rewards are points and encouragement, and asks in the learner\u2019s time zone', async () => {
    await loaded();
    expect(screen.getByRole('heading', { level: 2, name: 'Recognition' })).toBeVisible();
    expect(
      screen.getByText(
        'Points and badges for practising. They are encouragement, not a score or a ranking.',
      ),
    ).toBeVisible();
    expect(rewards).toHaveBeenCalledWith(new Date().getTimezoneOffset(), expect.anything());
  });

  it('is the section the address #recognition names', async () => {
    const { container } = await loaded();
    const section = container.querySelector('#recognition');
    expect(section?.tagName).toBe('SECTION');
    expect(section).toHaveAccessibleName('Recognition');
  });

  it('keeps a skeleton in place while the numbers arrive', () => {
    rewards.mockReturnValue(new Promise(() => undefined));
    renderRecognition();
    expect(screen.getByRole('heading', { level: 2, name: 'Recognition' })).toBeVisible();
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

  it('says plainly that nothing is ranked or compared, and that points are never taken away', async () => {
    await loaded();
    const section = screen
      .getByRole('heading', { name: 'How points work' })
      .closest('section') as HTMLElement;
    expect(
      within(section).getByText(/Nothing here is ranked or compared with anyone/),
    ).toBeVisible();
    expect(within(section).getByText(/never takes points away/)).toBeVisible();
  });

  it('can be retried when the rewards cannot be loaded', async () => {
    const user = userEvent.setup();
    rewards.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(makeRewards());
    renderRecognition();
    const alert = await screen.findByRole('alert');
    expect(
      within(alert).getByRole('heading', { name: 'We could not load your rewards' }),
    ).toBeVisible();
    await user.click(within(alert).getByRole('button', { name: /Try again/ }));
    expect(await screen.findByRole('heading', { name: 'How points work' })).toBeVisible();
  });
});

describe('Recognition: level, badges, challenges and streak', () => {
  it('shows the level with points, and how far there is to go in points and in kinds of call', async () => {
    await loaded();
    const level = screen.getByText('Level 3 of 4').closest('.rw-level') as HTMLElement;
    expect(within(level).getByText('Practitioner')).toBeVisible();
    expect(within(level).getByText('555')).toBeVisible();
    expect(within(level).getByText('points')).toBeVisible();
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
    const row = (label: string) =>
      screen.getByText(label).closest('.ff-ledger__row') as HTMLElement;
    expect(within(row('Badges earned')).getByText('2 of 6')).toBeVisible();
    expect(within(row('Active challenges')).getByText('2')).toBeVisible();
    const streak = row('Current streak');
    expect(within(streak).getByText('2 days')).toBeVisible();
    expect(within(streak).getByText(/Best: 3 days/)).toBeVisible();
    expect(within(streak).getByText(/A missed day never costs you anything\./)).toBeVisible();
  });

  it('says a single point is one point, and a practised day only when it was today', async () => {
    rewards.mockResolvedValue(
      makeRewards({
        points: 1,
        streak: { current: 1, best: 1, activeDays: 1, practisedToday: true },
      }),
    );
    await loaded();
    const level = screen.getByText('Level 3 of 4').closest('.rw-level') as HTMLElement;
    expect(within(level).getByText('point')).toBeVisible();
    expect(screen.getByText(/Best: 1 day\. You practised today\./)).toBeVisible();
  });
});

describe('Recognition: tabs', () => {
  it('counts what is in each tab and starts on all badges', async () => {
    await loaded();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'All badges 6',
      'In progress 2',
      'Challenges 3',
    ]);
    expect(screen.getByRole('tab', { name: /All badges/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(within(panel()).getAllByRole('heading', { level: 4 })).toHaveLength(6);
  });

  it('moves between tabs with the arrow keys, Home and End, and shows the right items in each', async () => {
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
        .getAllByRole('heading', { level: 4 })
        .map((heading) => heading.textContent),
    ).toEqual(['Scope Detective', 'Scenario Explorer']);

    await user.keyboard('{ArrowRight}');
    const challenges = screen.getByRole('tab', { name: /Challenges/ });
    expect(challenges).toHaveFocus();
    expect(within(panel()).getAllByRole('heading', { level: 4 })).toHaveLength(3);

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

describe('Recognition: badges', () => {
  it('writes earned, in progress or locked in words, with the date and the exact progress', async () => {
    await loaded();
    const first = badge('First Practice');
    expect(first).toHaveAttribute('data-earned', 'true');
    expect(first).toHaveAttribute('data-state', 'earned');
    expect(
      within(first).getByText(`Earned ${formatDate('2026-11-12T10:00:00.000Z')}`),
    ).toBeVisible();
    expect(within(first).getByText('1 of 1 scenario')).toBeVisible();
    expect(
      within(first).getByRole('link', { name: 'See the call that earned it' }),
    ).toHaveAttribute('href', '/sessions/call-1/report');

    const scope = badge('Scope Detective');
    expect(scope).toHaveAttribute('data-earned', 'false');
    expect(scope).toHaveAttribute('data-state', 'progress');
    expect(within(scope).getByText('In progress')).toBeVisible();
    expect(
      within(scope).getByText('Find every hidden fact in three different scenarios.'),
    ).toBeVisible();
    expect(within(scope).getByText('2 of 3 scenarios')).toBeVisible();
    const bar = within(scope).getByRole('progressbar', { name: 'Scope Detective: progress' });
    expect(bar).toHaveAttribute('aria-valuenow', '2');
    expect(bar).toHaveAttribute('aria-valuemax', '3');

    expect(within(badge('De-escalator')).getByText('Locked')).toBeVisible();
    expect(within(panel()).getAllByText('Locked')).toHaveLength(2);
    expect(within(panel()).getAllByText('In progress')).toHaveLength(2);
    expect(within(panel()).getAllByText(/^Earned /)).toHaveLength(2);
    expect(within(badge('Scenario Explorer')).getByText('3 of 4 kinds of call')).toBeVisible();
  });

  it('draws each state differently and never by colour: a lit heart, a partial ring, a dashed outline', async () => {
    await loaded();
    const mark = (title: string) => badge(title).querySelector('.rw-mark') as SVGElement;
    expect(mark('First Practice').querySelector('.rw-mark__heart')).not.toBeNull();
    expect(mark('Scope Detective').querySelector('.rw-mark__heart')).toBeNull();
    // Two of three scenarios: two thirds of the ring is drawn.
    expect(mark('Scope Detective').querySelector('.rw-mark__ring')).toHaveAttribute(
      'stroke-dasharray',
      '67 33',
    );
    expect(mark('First Practice').querySelector('.rw-mark__ring')).toHaveAttribute(
      'stroke-dasharray',
      '100 0',
    );
    expect(mark('De-escalator').querySelector('.rw-mark__ring')).toHaveAttribute(
      'stroke-dasharray',
      '0 100',
    );
    expect(mark('De-escalator')).toHaveAttribute('data-state', 'locked');
    // The marks are decoration: the words carry the meaning.
    for (const svg of panel().querySelectorAll('.rw-mark')) {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('explains what to do when nothing has been started yet', async () => {
    const user = userEvent.setup();
    rewards.mockResolvedValue(makeEmptyRewards());
    await loaded();
    await user.click(screen.getByRole('tab', { name: /In progress/ }));
    expect(within(panel()).getByText(/Nothing is in progress yet/)).toBeVisible();
  });

  it('gives a badge this app has not heard of the plainest figure and still shows everything', async () => {
    rewards.mockResolvedValue(
      makeRewards({
        badges: [
          ...BADGES,
          makeBadge({
            id: 'brand-new-badge' as never,
            title: 'Brand New',
            criteria: 'Do something new.',
          }),
        ],
      }),
    );
    await loaded();
    expect(within(badge('Brand New')).getByText('Locked')).toBeVisible();
    expect(within(badge('Brand New')).getByText('0 of 1 scenario')).toBeVisible();
  });

  it('keeps a very long title and criteria inside the item', async () => {
    const long = 'A very long badge title '.repeat(12).trim();
    rewards.mockResolvedValue(
      makeRewards({ badges: [makeBadge({ title: long, criteria: `${long}. ${long}.` })] }),
    );
    await loaded();
    expect(within(panel()).getByRole('heading', { name: long })).toBeVisible();
  });
});

describe('Recognition: challenges', () => {
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
    expect(within(family).getByText('20 points')).toBeVisible();
    expect(within(family).getByText('Reward')).toBeVisible();
    expect(within(family).getByText('Status')).toBeVisible();
    expect(within(family).getByText('Active')).toBeVisible();
    expect(within(family).getByText('3 of 7 kinds of call')).toBeVisible();
    expect(within(family).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3');

    const done = card('Practise on another day');
    expect(within(done).getByText('Completed')).toBeVisible();
    expect(within(done).getByText('Toward Consistency Streak')).toBeVisible();
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

  it('says so when there are none', async () => {
    const user = userEvent.setup();
    rewards.mockResolvedValue(makeRewards({ challenges: [] }));
    await loaded();
    await user.click(screen.getByRole('tab', { name: /Challenges/ }));
    expect(within(panel()).getByText(/There are no challenges right now/)).toBeVisible();
  });

  it('copes with a very long title', async () => {
    const user = userEvent.setup();
    const long = 'Practise something with a remarkably long title '.repeat(6).trim();
    rewards.mockResolvedValue(makeRewards({ challenges: [makeChallenge({ title: long })] }));
    await loaded();
    await user.click(screen.getByRole('tab', { name: /Challenges/ }));
    expect(within(panel()).getByRole('heading', { name: long })).toBeVisible();
  });
});

describe('Recognition: how points work', () => {
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
    expect(items.map((item) => item.querySelector('.rw-levels__name')?.textContent)).toEqual([
      'Foundation',
      'Builder',
      'PractitionerYou are here',
      'Confident Handler',
    ]);
    expect(items[2]).toHaveAttribute('aria-current', 'step');
    expect(items.filter((item) => item.hasAttribute('aria-current'))).toHaveLength(1);
    expect(
      within(items[3] as HTMLElement).getByText('800 points and 6 kinds of call'),
    ).toBeVisible();
    expect(within(items[0] as HTMLElement).getByText('Where everyone starts')).toBeVisible();
  });
});

describe('Recognition: points history', () => {
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

  it('says there is nothing yet, rather than showing an empty list', async () => {
    rewards.mockResolvedValue(makeEmptyRewards());
    await loaded();
    expect(screen.getByText(/Nothing here yet/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
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

describe('Recognition: a first visit', () => {
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
    const level = screen.getByText('Level 1 of 4').closest('.rw-level') as HTMLElement;
    expect(within(level).getByText('0')).toBeVisible();
    expect(within(level).getByText('points')).toBeVisible();
    expect(screen.getByText(/Nothing here yet/)).toBeVisible();
    expect(within(panel()).getAllByText('Locked')).toHaveLength(6);
  });

  it('does not show the first-points hint once there are points', async () => {
    await loaded();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });
});

describe('Recognition: the moment a badge is earned', () => {
  // The newest call (call-1) earned First Practice, so it is the one that is new.
  const status = () =>
    screen.getAllByRole('status').find((node) => node.classList.contains('sr-only')) as HTMLElement;

  it('lights the badge once, says so in words, and never replays', async () => {
    const play = vi.spyOn(sound, 'play').mockImplementation(() => undefined);
    const first = await loaded();
    expect(await screen.findByText('New badge: First Practice.')).toBeInTheDocument();
    expect(badge('First Practice')).toHaveAttribute('data-moment');
    expect(badge('Ownership Builder')).not.toHaveAttribute('data-moment');
    expect(play).toHaveBeenCalledWith('earned');
    expect(JSON.parse(localStorage.getItem('firefly.badges.seen') ?? '[]')).toEqual(
      expect.arrayContaining(['first-practice', 'ownership-builder']),
    );
    first.unmount();

    renderRecognition();
    await screen.findByRole('heading', { name: 'How points work' });
    expect(screen.queryByText(/New badge/)).not.toBeInTheDocument();
    expect(badge('First Practice')).not.toHaveAttribute('data-moment');
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('ends on its own after a moment, and what was announced stays announced', async () => {
    vi.spyOn(sound, 'play').mockImplementation(() => undefined);
    await loaded();
    await waitFor(() => expect(badge('First Practice')).toHaveAttribute('data-moment'));
    await waitFor(() => expect(badge('First Practice')).not.toHaveAttribute('data-moment'), {
      timeout: 3000,
    });
    expect(status()).toHaveTextContent('New badge: First Practice.');
  });

  it('ends at the first key press, so it never holds anyone up', async () => {
    vi.spyOn(sound, 'play').mockImplementation(() => undefined);
    const user = userEvent.setup();
    await loaded();
    await waitFor(() => expect(badge('First Practice')).toHaveAttribute('data-moment'));
    await user.keyboard('{Shift}');
    await waitFor(() => expect(badge('First Practice')).not.toHaveAttribute('data-moment'));
  });

  it('skips the animation under reduced motion, and still says what was earned', async () => {
    localStorage.setItem('firefly.motion', JSON.stringify('reduce'));
    vi.spyOn(sound, 'play').mockImplementation(() => undefined);
    await loaded();
    expect(await screen.findByText('New badge: First Practice.')).toBeInTheDocument();
    expect(badge('First Practice')).not.toHaveAttribute('data-moment');
    expect(badge('First Practice')).toHaveAttribute('data-state', 'earned');
  });

  it('stays quiet when the badges were earned in an earlier call, or have already been shown', async () => {
    vi.spyOn(sound, 'play').mockImplementation(() => undefined);
    rewards.mockResolvedValue(makeRewards({ ledger: [makeEntry(9, { sessionId: 'call-9' })] }));
    await loaded();
    expect(screen.queryByText(/New badge/)).not.toBeInTheDocument();
    expect(panel().querySelector('[data-moment]')).toBeNull();
  });

  it('waits until the badges are on screen before it starts', async () => {
    vi.spyOn(sound, 'play').mockImplementation(() => undefined);
    let notify: ((entries: { isIntersecting: boolean }[]) => void) | undefined;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
          notify = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    try {
      await loaded();
      expect(screen.queryByText(/New badge/)).not.toBeInTheDocument();
      act(() => notify?.([{ isIntersecting: true }]));
      expect(await screen.findByText('New badge: First Practice.')).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
