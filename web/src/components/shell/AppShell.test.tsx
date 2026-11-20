import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../lib/api.ts';
import type * as ApiModule from '../../lib/api.ts';
import {
  getProfile,
  resetProfileForTests,
  saveProfile,
  updatePreferences,
} from '../../lib/profile.ts';
import { requestTour, resetTourForTests } from '../../lib/tour.ts';
import { resetPaletteForTests } from './Palette.tsx';
import { useShellMode } from './shell-mode.ts';
import {
  badge,
  removeViewTransitionStub,
  renderShell,
  rewardsWith,
  session,
  stubViewTransitions,
} from './shell-test-kit.tsx';

vi.mock('../../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, api: { listSessions: vi.fn(), rewards: vi.fn(), scenarios: vi.fn() } };
});
vi.mock('../ProviderBadge.tsx', () => ({ ProviderBadge: () => <span>Demo mode</span> }));
vi.mock('../world/WorldLayer.tsx', () => ({ WorldLayer: () => <div data-testid="world" /> }));

const listSessions = vi.mocked(api.listSessions);
const rewards = vi.mocked(api.rewards);
const scenarios = vi.mocked(api.scenarios);
let viewTransition: ReturnType<typeof stubViewTransitions>;

beforeAll(() => {
  window.scrollTo = vi.fn();
});

beforeEach(() => {
  vi.resetAllMocks();
  viewTransition = stubViewTransitions();
  localStorage.clear();
  sessionStorage.clear();
  resetProfileForTests();
  resetTourForTests();
  resetPaletteForTests();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-motion');
  document.documentElement.removeAttribute('data-ambient');
  listSessions.mockResolvedValue({ sessions: [], total: 0 });
  rewards.mockResolvedValue(rewardsWith([]));
  scenarios.mockResolvedValue([]);
});

afterEach(() => {
  removeViewTransitionStub();
});

describe('the dock', () => {
  it('marks the current destination and links every one of them', () => {
    renderShell('/home');
    const dock = screen.getByRole('navigation', { name: 'Main' });
    expect(within(dock).getAllByRole('listitem')).toHaveLength(6);
    expect(
      within(dock)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/home', '/scenarios', '/history', '/progress', '/trainer', '/settings']);
    expect(within(dock).getByRole('link', { name: 'Home' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(dock).getByRole('link', { name: 'Missions' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('keeps Missions lit on the report of a call', () => {
    renderShell('/sessions/s1/report');
    expect(
      within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', {
        name: 'Missions',
      }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('lights nothing on a page that belongs to no destination', () => {
    renderShell('/help');
    expect(
      within(screen.getByRole('navigation', { name: 'Main' })).queryByRole('link', {
        current: 'page',
      }),
    ).not.toBeInTheDocument();
  });

  it('carries the persistent-layer name so a route change does not redraw it', () => {
    renderShell('/home');
    expect(screen.getByRole('navigation', { name: 'Main' })).toHaveAttribute(
      'data-vt-persist',
      'dock',
    );
  });

  it('moves to the destination that was chosen and puts focus on the page', async () => {
    const user = userEvent.setup();
    renderShell('/home');
    await user.click(
      within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', {
        name: 'Settings',
      }),
    );
    expect(await screen.findByRole('heading', { name: 'Settings page' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', {
        name: 'Settings',
      }),
    ).toHaveAttribute('aria-current', 'page');
    await waitFor(() => expect(screen.getByRole('main')).toHaveFocus());
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });
});

describe('the frame', () => {
  it('gives a live call the whole screen: no dock, no utilities, no colophon and no banner', () => {
    const { container } = renderShell('/calls/c1');
    expect(screen.getByRole('heading', { name: 'Call page' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Tools' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Search and commands' })).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    const root = container.querySelector('.shell');
    expect(root).toHaveAttribute('data-call', 'true');
    expect(root).toHaveAttribute('data-shell', 'call');
    // Not hidden, gone: the only thing a keyboard can reach in the frame is the skip link.
    expect(
      [...container.querySelectorAll('a[href], button, input, select, textarea')].map((el) =>
        el.textContent?.trim(),
      ),
    ).toEqual(['Skip to main content']);
  });

  it('keeps the wordmark during a call as a signature that is not a link', () => {
    const { container } = renderShell('/calls/c1');
    expect(screen.queryByRole('link', { name: 'Firefly, home' })).not.toBeInTheDocument();
    expect(container.querySelector('.wordmark--still')).toBeInTheDocument();
  });

  it('shows the dock, the utilities and the training-aid colophon on other pages', () => {
    const { container } = renderShell('/home');
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Tools' })).toBeInTheDocument();
    const colophon = screen.getByRole('contentinfo');
    expect(colophon).toHaveTextContent(
      'Firefly is a training aid. Scenarios are fictional; never enter real customer information. Scores are for practice, not performance reviews.',
    );
    expect(within(colophon).getByRole('link', { name: 'Responsible AI' })).toHaveAttribute(
      'href',
      '/help',
    );
    expect(within(colophon).getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/settings',
    );
    expect(container.querySelector('.shell')).toHaveAttribute('data-shell', 'app');
    expect(container.querySelector('.shell')).not.toHaveAttribute('data-call');
    // There is no sidebar and no top bar.
    expect(screen.queryByRole('search')).not.toBeInTheDocument();
    expect(container.querySelector('aside')).not.toBeInTheDocument();
  });

  it('has the skip link first in the tab order, and it leads to the page', async () => {
    const user = userEvent.setup();
    renderShell('/home');
    await user.tab();
    const skip = screen.getByRole('link', { name: 'Skip to main content' });
    expect(skip).toHaveFocus();
    expect(skip).toHaveAttribute('href', '#main');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
  });

  it('leaves focus alone on load, even when effects run twice (development)', async () => {
    const user = userEvent.setup();
    renderShell('/home', [], { strict: true });
    expect(document.body).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveFocus();
  });

  it('tells pages which mode the frame is in', () => {
    function Probe() {
      return <p>{`mode:${useShellMode()}`}</p>;
    }
    renderShell('/probe', [{ path: 'probe', element: <Probe /> }]);
    expect(screen.getByText('mode:app')).toBeInTheDocument();
  });

  it('links the wordmark home, to the front door only from the front door', async () => {
    const user = userEvent.setup();
    const { router, unmount } = renderShell('/home');
    expect(screen.getByRole('link', { name: 'Firefly, home' })).toHaveAttribute('href', '/home');
    await act(() => router.navigate('/'));
    expect(await screen.findByRole('heading', { name: 'Landing page' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Firefly, home' })).toHaveAttribute('href', '/');
    // The front door has the display controls and nothing to navigate with.
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause ambient motion' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Switch to (light|dark) theme/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Search and commands' })).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
    await user.keyboard('{Control>}k{/Control}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    unmount();
  });

  it('puts the field behind the page, on both frames', async () => {
    const { router } = renderShell('/home');
    expect(screen.getByTestId('world')).toBeInTheDocument();
    await act(() => router.navigate('/sign-in'));
    expect(await screen.findByRole('heading', { name: 'Sign in page' })).toBeInTheDocument();
    expect(screen.getByTestId('world')).toBeInTheDocument();
  });

  it('opens the tour when it is asked for, and not before', async () => {
    await import('../tour/FirstRunTour.tsx');
    renderShell('/home');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    act(() => requestTour());
    expect(
      await screen.findByRole('dialog', { name: 'A short tour of Firefly' }),
    ).toBeInTheDocument();
  }, 20_000);
});

describe('navigation animation', () => {
  it('moves between destinations with a view transition', async () => {
    const user = userEvent.setup();
    renderShell('/home');
    await user.click(
      within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', {
        name: 'History',
      }),
    );
    expect(await screen.findByRole('heading', { name: 'History page' })).toBeInTheDocument();
    expect(viewTransition).toHaveBeenCalledTimes(1);
  });

  it('moves without one when motion is reduced', async () => {
    localStorage.setItem('firefly.motion', JSON.stringify('reduce'));
    const user = userEvent.setup();
    renderShell('/home');
    await user.click(
      within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', {
        name: 'History',
      }),
    );
    expect(await screen.findByRole('heading', { name: 'History page' })).toBeInTheDocument();
    expect(viewTransition).not.toHaveBeenCalled();
  });

  it('moves with a view transition when a page is chosen from the palette', async () => {
    const user = userEvent.setup();
    renderShell('/home');
    await user.keyboard('{Control>}k{/Control}');
    await user.type(await screen.findByRole('combobox'), 'history{Enter}');
    expect(await screen.findByRole('heading', { name: 'History page' })).toBeInTheDocument();
    expect(viewTransition).toHaveBeenCalledTimes(1);
  });
});

describe('search and commands', () => {
  it('opens with Ctrl+K from anywhere, and from the button that shows the shortcut', async () => {
    const user = userEvent.setup();
    renderShell('/home');
    await user.keyboard('{Control>}k{/Control}');
    expect(await screen.findByRole('dialog', { name: 'Search and commands' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.keyboard('{Meta>}k{/Meta}');
    expect(await screen.findByRole('dialog', { name: 'Search and commands' })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    const button = screen.getByRole('button', { name: 'Search and commands' });
    expect(button).toHaveTextContent('Ctrl K');
    expect(button).toHaveAttribute('aria-keyshortcuts', 'Control+K Meta+K');
    await user.click(button);
    expect(await screen.findByRole('dialog', { name: 'Search and commands' })).toBeInTheDocument();
  });

  it('closes again on a second Ctrl+K, and gives focus back to where it was', async () => {
    const user = userEvent.setup();
    renderShell('/home');
    const button = screen.getByRole('button', { name: 'Search and commands' });
    button.focus();
    await user.keyboard('{Control>}k{/Control}');
    expect(await screen.findByRole('dialog', { name: 'Search and commands' })).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveFocus();
    await user.keyboard('{Control>}k{/Control}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it('does not take the key from a field where someone is typing, unless the field allows it', async () => {
    const user = userEvent.setup();
    renderShell('/typing');
    await user.click(screen.getByRole('textbox', { name: 'Reply' }));
    await user.keyboard('{Control>}k{/Control}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('searchbox', { name: 'Search here' }));
    await user.keyboard('{Control>}k{/Control}');
    expect(await screen.findByRole('dialog', { name: 'Search and commands' })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    // A checkbox is not a place to type.
    await user.click(screen.getByRole('checkbox', { name: 'Agree' }));
    await user.keyboard('{Control>}k{/Control}');
    expect(await screen.findByRole('dialog', { name: 'Search and commands' })).toBeInTheDocument();
  });

  it('opens the library with the words that were searched for', async () => {
    const user = userEvent.setup();
    renderShell('/home');
    await user.keyboard('{Control>}k{/Control}');
    await user.type(await screen.findByRole('combobox'), 'sign in{Enter}');
    expect(await screen.findByTestId('where')).toHaveTextContent('/scenarios?q=sign%20in');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('main')).toHaveFocus());
  });

  it('is not a way to reach the field behind a dialog that is already open', async () => {
    const user = userEvent.setup();
    renderShell('/modal');
    expect(screen.getByRole('dialog', { name: 'Another dialog' })).toBeInTheDocument();
    await user.keyboard('{Control>}k{/Control}');
    expect(screen.queryByRole('dialog', { name: 'Search and commands' })).not.toBeInTheDocument();
  });
});

describe('theme and ambient motion', () => {
  it('switches the theme and says which one it will switch to next', async () => {
    const user = userEvent.setup();
    localStorage.setItem('firefly.theme', JSON.stringify('dark'));
    renderShell('/home');
    await user.click(screen.getByRole('button', { name: 'Switch to light theme' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(JSON.parse(localStorage.getItem('firefly.theme') ?? 'null')).toBe('light');
    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('pauses ambient motion, announces it and remembers it', async () => {
    const user = userEvent.setup();
    renderShell('/home');
    const toggle = screen.getByRole('button', { name: 'Pause ambient motion' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    const status = within(screen.getByRole('group', { name: 'Tools' })).getByRole('status');
    expect(status).toBeEmptyDOMElement();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(status).toHaveTextContent('Ambient motion paused.');
    expect(document.documentElement).toHaveAttribute('data-ambient', 'paused');
    expect(JSON.parse(localStorage.getItem('firefly.ambient') ?? 'null')).toBe('paused');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(status).toHaveTextContent('Ambient motion resumed.');
    expect(document.documentElement).not.toHaveAttribute('data-ambient');
  });

  it('starts paused when it was paused last time', () => {
    localStorage.setItem('firefly.ambient', JSON.stringify('paused'));
    renderShell('/home');
    expect(screen.getByRole('button', { name: 'Pause ambient motion' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('explains, rather than silently refusing, when reduced motion has already paused it', async () => {
    const user = userEvent.setup();
    localStorage.setItem('firefly.motion', JSON.stringify('reduce'));
    renderShell('/home');
    const toggle = screen.getByRole('button', { name: 'Pause ambient motion' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveAttribute('aria-disabled', 'true');
    expect(toggle).toHaveAccessibleDescription(/already off because reduced motion is on/);
    await user.click(toggle);
    expect(
      within(screen.getByRole('group', { name: 'Tools' })).getByRole('status'),
    ).toHaveTextContent('already off because reduced motion is on');
    // What was chosen is untouched.
    expect(localStorage.getItem('firefly.ambient')).toBeNull();
  });
});

describe('notifications', () => {
  const OLD = '2026-01-01T00:00:00.000Z';

  it('stays quiet when there is nothing new', async () => {
    const user = userEvent.setup();
    renderShell('/home');
    await user.click(await screen.findByRole('button', { name: 'Notifications' }));
    expect(await screen.findByText(/Nothing new/)).toBeInTheDocument();
  });

  it('flags a finished call whose report is ready, and clears the flag once it was looked at', async () => {
    localStorage.setItem('firefly.notifications.seen', JSON.stringify(OLD));
    listSessions.mockResolvedValue({
      sessions: [
        session({ id: 'new', endedAt: '2026-02-01T10:00:00.000Z' }),
        session({ id: 'sample', isSample: true, endedAt: '2026-02-02T10:00:00.000Z' }),
        session({ id: 'running', status: 'active', endedAt: null }),
      ],
      total: 3,
    });
    const user = userEvent.setup();
    renderShell('/home');
    const bell = await screen.findByRole('button', { name: 'Notifications, 1 new' });
    await user.click(bell);
    const panel = await screen.findByRole('region', { name: 'Notifications' });
    const link = within(panel).getByRole('link', { name: /Your coaching report is ready/ });
    expect(link).toHaveAttribute('href', '/sessions/new/report');
    expect(link).toHaveTextContent('Team cannot open the workspace');
    expect(link).toHaveTextContent('New');
    expect(within(panel).getAllByRole('link', { name: /report/ })).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('firefly.notifications.seen') ?? 'null')).toBe(
      '2026-02-01T10:00:00.000Z',
    );
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'Notifications' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notifications' })).toHaveFocus();
  });

  it('tells you about a badge you earned, and only about earned ones', async () => {
    localStorage.setItem('firefly.notifications.seen', JSON.stringify(OLD));
    rewards.mockResolvedValue(
      rewardsWith([
        badge({ earned: true, earnedAt: '2026-02-03T10:00:00.000Z' }),
        badge({ id: 'de-escalator', title: 'De-escalator' }),
      ]),
    );
    const user = userEvent.setup();
    renderShell('/home');
    await user.click(await screen.findByRole('button', { name: 'Notifications, 1 new' }));
    const panel = await screen.findByRole('region', { name: 'Notifications' });
    const link = within(panel).getByRole('link', { name: /You earned the Scope Detective badge/ });
    expect(link).toHaveAttribute('href', '/rewards');
    expect(within(panel).queryByText(/De-escalator/)).not.toBeInTheDocument();
    expect(rewards).toHaveBeenCalledWith(new Date().getTimezoneOffset(), expect.anything());
  });

  it('respects the preferences to not be told about reports or badges', async () => {
    localStorage.setItem('firefly.notifications.seen', JSON.stringify(OLD));
    saveProfile({ name: 'Priya' });
    updatePreferences({ notifyReports: false, notifyBadges: false });
    listSessions.mockResolvedValue({ sessions: [session()], total: 1 });
    rewards.mockResolvedValue(
      rewardsWith([badge({ earned: true, earnedAt: '2026-02-03T10:00:00.000Z' })]),
    );
    renderShell('/home');
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    await waitFor(() => expect(listSessions).toHaveBeenCalled());
    await waitFor(() => expect(rewards).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /new$/ })).not.toBeInTheDocument();
  });

  it('stays quiet, rather than breaking the page, when the notices cannot be loaded', async () => {
    listSessions.mockRejectedValue(new Error('offline'));
    rewards.mockRejectedValue(new Error('offline'));
    const user = userEvent.setup();
    renderShell('/home');
    expect(screen.getByRole('heading', { name: 'Home page' })).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Notifications' }));
    expect(await screen.findByText(/Nothing new/)).toBeInTheDocument();
  });
});

describe('account menu', () => {
  it('invites someone without a profile to create one', async () => {
    const user = userEvent.setup();
    renderShell('/home');
    await user.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(await screen.findByRole('link', { name: /Create your profile/ })).toHaveAttribute(
      'href',
      '/sign-in',
    );
  });

  it('shows who is using this device and signs out of it without touching saved calls', async () => {
    saveProfile({ name: 'Priya Raman', role: 'Apprentice' });
    const user = userEvent.setup();
    renderShell('/home');
    await user.click(screen.getByRole('button', { name: 'PR, account menu for Priya Raman' }));
    const panel = await screen.findByRole('region', { name: 'Account' });
    expect(panel).toHaveTextContent('Priya Raman');
    expect(panel).toHaveTextContent('Apprentice');
    await user.click(within(panel).getByRole('button', { name: /Sign out of this device/ }));
    expect(await screen.findByRole('heading', { name: 'Landing page' })).toBeInTheDocument();
    expect(getProfile()).toBeNull();
  });
});

describe('popovers', () => {
  it('close on Escape and give focus back to their button', async () => {
    const user = userEvent.setup();
    renderShell('/home');
    const account = screen.getByRole('button', { name: 'Account menu' });
    await user.click(account);
    expect(account).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    expect(account).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region', { name: 'Account' })).not.toBeInTheDocument();
    expect(account).toHaveFocus();
  });

  it('close on a press outside, and when another one opens', async () => {
    const user = userEvent.setup();
    renderShell('/home');
    await user.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(screen.getByRole('region', { name: 'Account' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(screen.queryByRole('region', { name: 'Account' })).not.toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Notifications' })).toBeInTheDocument();
    await user.click(screen.getByRole('heading', { name: 'Home page' }));
    expect(screen.queryByRole('region', { name: 'Notifications' })).not.toBeInTheDocument();
  });

  it('close when keyboard focus leaves them', async () => {
    const user = userEvent.setup();
    renderShell('/home');
    await user.click(screen.getByRole('button', { name: 'Account menu' }));
    await user.tab();
    await user.tab();
    await user.tab();
    expect(screen.queryByRole('region', { name: 'Account' })).not.toBeInTheDocument();
  });

  it('close when the page changes', async () => {
    const user = userEvent.setup();
    const { router } = renderShell('/home');
    await user.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(screen.getByRole('region', { name: 'Account' })).toBeInTheDocument();
    await act(() => router.navigate('/settings'));
    expect(screen.queryByRole('region', { name: 'Account' })).not.toBeInTheDocument();
  });
});

describe('connection', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows the offline line under the wordmark, and not during a call', () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    const { unmount } = renderShell('/home');
    expect(screen.getByText(/You appear to be offline/)).toBeInTheDocument();
    unmount();

    renderShell('/calls/c1');
    expect(screen.queryByText(/You appear to be offline/)).not.toBeInTheDocument();
  });

  it('shows it on the front door too', () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    renderShell('/');
    expect(screen.getByText(/You appear to be offline/)).toBeInTheDocument();
  });
});
