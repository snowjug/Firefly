import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfigDTO, DemoStatusDTO } from '#shared/domain/api.ts';
import { IGNITION_KEY, markIgnitionSeen } from '../components/entry/ignition.ts';
import type * as ApiModule from '../lib/api.ts';
import { ConfigProvider } from '../lib/config.tsx';
import { AmbientProvider } from '../lib/motion/ambient.tsx';
import {
  DEFAULT_PREFERENCES,
  getProfile,
  resetProfileForTests,
  type Profile,
} from '../lib/profile.ts';
import { resetSoundForTests } from '../lib/sound.ts';
import { ThemeProvider } from '../lib/theme.tsx';
import { ToastProvider } from '../lib/toast.tsx';
import { resetTourForTests, useTourRequests } from '../lib/tour.ts';
import Settings from './Settings.tsx';

const mocks = vi.hoisted(() => ({ config: vi.fn(), demo: vi.fn() }));
vi.mock('../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, api: mocks };
});

const CONFIG: AppConfigDTO = {
  app: { name: 'Firefly', version: '0.1.0' },
  provider: { kind: 'mock', label: 'Demo mode (built-in rules engine)', demo: true, notice: null },
  limits: { maxMessageChars: 1500, maxTraineeTurns: 60 },
  features: { devDiagnostics: false, testHooks: false },
};
const DEMO: DemoStatusDTO = {
  spotlightScenarioId: null,
  practiceSessions: 12,
  sampleSessions: 3,
  provider: { kind: 'mock', label: CONFIG.provider.label, demo: true },
};

function TourRequests() {
  return <output data-testid="tour-requests">{useTourRequests()}</output>;
}

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname}</p>;
}

function renderSettings(extra?: ReactNode, entry = '/settings') {
  return render(
    <ThemeProvider>
      <AmbientProvider>
        <ConfigProvider>
          <ToastProvider>
            <MemoryRouter initialEntries={[entry]}>
              <Routes>
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<Where />} />
              </Routes>
              {extra}
            </MemoryRouter>
          </ToastProvider>
        </ConfigProvider>
      </AmbientProvider>
    </ThemeProvider>,
  );
}

const seedProfile = (overrides: Partial<Profile> = {}) => {
  const profile: Profile = {
    name: 'Sam Carter',
    role: 'Support apprentice',
    location: 'Leeds, UK',
    createdAt: '2026-11-01T09:00:00.000Z',
    preferences: DEFAULT_PREFERENCES,
    ...overrides,
  };
  localStorage.setItem('firefly.profile', JSON.stringify(profile));
  resetProfileForTests();
};
const stored = (): Profile | null =>
  JSON.parse(localStorage.getItem('firefly.profile') ?? 'null') as Profile | null;

/** The radio with this name inside the group with this name. */
const choice = (group: string, name: string) =>
  within(screen.getByRole('group', { name: group })).getByRole('radio', { name });

const tab = (name: string) => screen.getByRole('tab', { name });
const open = async (user: ReturnType<typeof userEvent.setup>, name: string) =>
  user.click(tab(name));

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  resetProfileForTests();
  resetSoundForTests();
  resetTourForTests();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-motion');
  document.documentElement.removeAttribute('data-ambient');
  mocks.config.mockResolvedValue(CONFIG);
  mocks.demo.mockResolvedValue(DEMO);
});

describe('Settings page', () => {
  it('has one h1, the four tabs, and every control has a name', async () => {
    const user = userEvent.setup();
    seedProfile();
    renderSettings();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    expect(document.title).toBe('Settings · Firefly');
    expect(
      within(screen.getByRole('tablist', { name: 'Settings sections' }))
        .getAllByRole('tab')
        .map((item) => item.textContent),
    ).toEqual(['Profile', 'Preferences', 'Notifications', 'Data & privacy']);

    for (const name of ['Profile', 'Preferences', 'Notifications', 'Data & privacy']) {
      await open(user, name);
      for (const control of [
        ...screen.queryAllByRole('radio'),
        ...screen.queryAllByRole('switch'),
        ...screen.queryAllByRole('button'),
        ...screen.queryAllByRole('textbox'),
      ]) {
        expect(control).toHaveAccessibleName();
      }
    }
  });

  it('opens the tab a link points at, and says it is selected', async () => {
    seedProfile();
    renderSettings(undefined, '/settings#notifications');
    expect(tab('Notifications')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Notifications');
    expect(screen.getByRole('switch', { name: /coaching report is ready/ })).toBeVisible();
  });

  it('starts on the profile, and ignores a hash it does not know', () => {
    renderSettings(undefined, '/settings#nonsense');
    expect(tab('Profile')).toHaveAttribute('aria-selected', 'true');
  });
});

describe('Settings profile', () => {
  it('asks for a name before it creates a profile, then shows who you are', async () => {
    const user = userEvent.setup();
    renderSettings();
    expect(screen.getByRole('heading', { name: 'Create your profile' })).toBeVisible();
    expect(
      screen.getByText(
        'This stays in this browser. Use your first name; never enter customer information.',
      ),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Create profile' }));
    expect(screen.getByText('Enter your name to continue.')).toBeVisible();
    expect(screen.getByLabelText('Name')).toHaveFocus();
    expect(screen.getByLabelText('Name')).toBeInvalid();
    expect(stored()).toBeNull();

    await user.type(screen.getByLabelText('Name'), 'Sam Carter');
    await user.type(screen.getByLabelText('Role (optional)'), 'Support apprentice');
    await user.type(screen.getByLabelText('Location (optional)'), 'Leeds, UK');
    await user.click(screen.getByRole('button', { name: 'Create profile' }));

    expect(stored()).toMatchObject({
      name: 'Sam Carter',
      role: 'Support apprentice',
      location: 'Leeds, UK',
      preferences: DEFAULT_PREFERENCES,
    });
    expect(await screen.findByText('Profile created.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Sam Carter' })).toBeVisible();
    expect(screen.getByText('Support apprentice')).toBeInTheDocument();
    expect(screen.getByText('Leeds, UK')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Create your profile' })).not.toBeInTheDocument();
    // The form that was pressed has gone, so focus lands on the panel and not nowhere.
    await waitFor(() => expect(document.body).not.toHaveFocus());
  });

  it('edits the profile in a dialog, keeps the preferences, and Cancel changes nothing', async () => {
    const user = userEvent.setup();
    seedProfile({ preferences: { ...DEFAULT_PREFERENCES, defaultDifficulty: 'challenge' } });
    renderSettings();
    expect(screen.getByRole('heading', { level: 2, name: 'Sam Carter' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Edit profile' }));
    let dialog = screen.getByRole('dialog', { name: 'Edit profile' });
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Sam Carter');
    expect(within(dialog).getByLabelText('Name')).toHaveFocus();
    expect(within(dialog).getByLabelText('Role (optional)')).toHaveValue('Support apprentice');
    expect(dialog).toHaveTextContent('never enter customer information');

    // A name is required: the dialog stays open and nothing is saved.
    await user.clear(within(dialog).getByLabelText('Name'));
    await user.click(within(dialog).getByRole('button', { name: 'Save profile' }));
    expect(within(dialog).getByText('Enter your name to continue.')).toBeVisible();
    expect(stored()?.name).toBe('Sam Carter');

    await user.type(within(dialog).getByLabelText('Name'), 'Sam Rivers');
    await user.clear(within(dialog).getByLabelText('Location (optional)'));
    await user.click(within(dialog).getByRole('button', { name: 'Save profile' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(stored()).toMatchObject({
      name: 'Sam Rivers',
      role: 'Support apprentice',
      location: '',
    });
    expect(stored()?.preferences.defaultDifficulty).toBe('challenge');
    expect(await screen.findByText('Profile saved.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit profile' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Edit profile' }));
    dialog = screen.getByRole('dialog', { name: 'Edit profile' });
    await user.clear(within(dialog).getByLabelText('Name'));
    await user.type(within(dialog).getByLabelText('Name'), 'Someone else');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(stored()?.name).toBe('Sam Rivers');
  });

  it('signs out of this device and says saved practice is kept', async () => {
    const user = userEvent.setup();
    seedProfile();
    renderSettings();
    expect(screen.getByText(/saved practice calls are kept/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sign out of this device' }));
    expect(stored()).toBeNull();
    expect(screen.getByRole('heading', { name: 'Create your profile' })).toBeVisible();
    expect(await screen.findByText('Signed out of this device.')).toBeInTheDocument();
    expect(screen.getByText('Your saved practice calls are kept.')).toBeInTheDocument();
  });

  it('shows a very long name, role and place without losing any of it', () => {
    const name = `${'Wolfeschlegelsteinhausenbergerdorff '.repeat(2)}Jr`;
    seedProfile({ name, role: 'R'.repeat(80), location: 'L'.repeat(80) });
    renderSettings();
    // The profile keeps at most 60 characters of a name; whatever it kept is all on the page.
    const kept = getProfile()?.name ?? '';
    expect(kept.length).toBeGreaterThan(40);
    expect(screen.getByRole('heading', { level: 2, name: kept })).toBeVisible();
    expect(screen.getByText('R'.repeat(80))).toBeVisible();
    expect(screen.getByText('L'.repeat(80))).toBeVisible();
  });
});

describe('Settings preferences', () => {
  it('saves the practice preferences on the profile at once, with a confirmation', async () => {
    const user = userEvent.setup();
    seedProfile();
    renderSettings(undefined, '/settings#preferences');

    expect(choice('Default difficulty', 'Starter')).toBeChecked();
    await user.click(choice('Default difficulty', 'Challenge'));
    expect(stored()?.preferences.defaultDifficulty).toBe('challenge');
    expect(await screen.findByText('Default difficulty is now Challenge.')).toBeInTheDocument();
    // What the chosen option means is read with it.
    expect(choice('Default difficulty', 'Challenge')).toHaveAccessibleDescription(
      /A more demanding call/,
    );

    expect(
      within(screen.getByRole('group', { name: 'Show hints' }))
        .getAllByRole('radio')
        .map((radio) => radio.closest('label')?.textContent),
    ).toEqual(['Follow the difficulty', 'Always', 'Never']);
    expect(choice('Show hints', 'Follow the difficulty')).toBeChecked();
    expect(choice('Show hints', 'Follow the difficulty')).toHaveAccessibleDescription(
      /Recommended/,
    );
    await user.click(choice('Show hints', 'Always'));
    expect(stored()?.preferences.hints).toBe('on');
    expect(choice('Show hints', 'Always')).toHaveAccessibleDescription(/Calls start guided/);
    await user.click(choice('Show hints', 'Never'));
    expect(stored()?.preferences.hints).toBe('off');
    expect(stored()?.preferences.defaultDifficulty).toBe('challenge');
    expect(await screen.findByText('Hints: Never.')).toBeInTheDocument();
  });

  it('turns voice on only after the disclosure, and Cancel leaves it off', async () => {
    const user = userEvent.setup();
    seedProfile();
    renderSettings(undefined, '/settings#preferences');

    const voice = screen.getByRole('switch', { name: 'Enable voice (Beta)' });
    expect(voice).not.toBeChecked();
    expect(voice).toHaveAccessibleDescription(/Speak instead of typing and hear the customer/);
    expect(voice).toHaveAccessibleDescription(/Works best in Chrome or Edge/);
    expect(screen.getByRole('link', { name: /How voice works/ })).toHaveAttribute(
      'href',
      '/help#voice',
    );

    await user.click(voice);
    let dialog = screen.getByRole('dialog', { name: 'Turn on voice (Beta)?' });
    expect(stored()?.preferences.voice).toBe(false);
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(voice).not.toBeChecked();
    expect(stored()?.preferences.voice).toBe(false);
    await waitFor(() => expect(voice).toHaveFocus());

    await user.click(voice);
    dialog = screen.getByRole('dialog', { name: 'Turn on voice (Beta)?' });
    await user.click(within(dialog).getByRole('button', { name: 'Turn on voice' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(stored()?.preferences.voice).toBe(true);
    expect(voice).toBeChecked();
    expect(await screen.findByText('Voice (Beta) is on.')).toBeInTheDocument();

    // Turning it off needs no question.
    await user.click(voice);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(stored()?.preferences.voice).toBe(false);
    expect(voice).not.toBeChecked();
    expect(await screen.findByText('Voice is off.')).toBeInTheDocument();
  });

  it('needs a profile before the practice preferences can be saved', () => {
    renderSettings(undefined, '/settings#preferences');
    const voice = screen.getByRole('switch', { name: 'Enable voice (Beta)' });
    expect(voice).toBeDisabled();
    expect(voice).toHaveAccessibleDescription(/Create your profile first\./);
    expect(screen.getByRole('group', { name: 'Default difficulty' })).toBeDisabled();
    expect(screen.getByRole('group', { name: 'Show hints' })).toBeDisabled();
    expect(screen.getByRole('group', { name: 'Default difficulty' })).toHaveAccessibleDescription(
      /Create your profile first\./,
    );
    // Device settings do not depend on a profile.
    expect(screen.getByRole('group', { name: 'Theme' })).toBeEnabled();
    expect(screen.getByRole('group', { name: 'Reduce motion' })).toBeEnabled();
    expect(screen.getByRole('switch', { name: 'Ambient motion' })).toBeEnabled();
    expect(screen.getByRole('switch', { name: 'Sound effects' })).toBeEnabled();
  });

  it('applies the theme and motion choices at once and keeps them for next time', async () => {
    const user = userEvent.setup();
    const { unmount } = renderSettings(undefined, '/settings#preferences');

    await user.click(choice('Theme', 'Dark'));
    await user.click(choice('Reduce motion', 'On'));

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(document.documentElement).toHaveAttribute('data-motion', 'reduce');
    expect(localStorage.getItem('firefly.theme')).toBe('"dark"');
    expect(localStorage.getItem('firefly.motion')).toBe('"reduce"');
    expect(choice('Theme', 'Dark')).toHaveAccessibleDescription('Using the dark theme.');
    expect(choice('Reduce motion', 'On')).toHaveAccessibleDescription(
      'Animation and transitions are reduced.',
    );
    expect(await screen.findByText('Theme: Dark.')).toBeInTheDocument();
    expect(await screen.findByText('Reduce motion: On.')).toBeInTheDocument();

    unmount();
    renderSettings(undefined, '/settings#preferences');
    expect(choice('Theme', 'Dark')).toBeChecked();
    expect(choice('Reduce motion', 'On')).toBeChecked();

    await user.click(choice('Theme', 'System'));
    expect(localStorage.getItem('firefly.theme')).toBe('"system"');
    expect(document.documentElement).not.toHaveAttribute('data-theme');
    await user.click(choice('Reduce motion', 'Off'));
    expect(localStorage.getItem('firefly.motion')).toBe('"full"');
    expect(document.documentElement).not.toHaveAttribute('data-motion');
  });

  it('says what following the device means for the theme and for motion', () => {
    renderSettings(undefined, '/settings#preferences');
    expect(choice('Theme', 'System')).toBeChecked();
    expect(choice('Theme', 'System')).toHaveAccessibleDescription(
      /^Following your device: using the (light|dark) theme\.$/,
    );
    expect(choice('Reduce motion', 'Follow my device')).toHaveAccessibleDescription(
      'Your device does not ask for reduced motion, so Firefly uses its standard animation.',
    );
  });

  it('keeps sound off until asked and remembers the choice on this device', async () => {
    const user = userEvent.setup();
    const { unmount } = renderSettings(undefined, '/settings#preferences');
    const toggle = screen.getByRole('switch', { name: 'Sound effects' });
    expect(toggle).not.toBeChecked();
    expect(toggle).toHaveAccessibleDescription(/Nothing plays unless you turn this on/);

    await user.click(toggle);
    expect(toggle).toBeChecked();
    expect(localStorage.getItem('firefly.sound')).toBe('true');
    expect(await screen.findByText('Sound effects are on.')).toBeInTheDocument();

    unmount();
    resetSoundForTests();
    renderSettings(undefined, '/settings#preferences');
    expect(screen.getByRole('switch', { name: 'Sound effects' })).toBeChecked();
  });

  it('shows the language as English only', () => {
    renderSettings(undefined, '/settings#preferences');
    const language = screen.getByText('Language').closest('div') as HTMLElement;
    expect(within(language).getByText('English (UK)')).toBeInTheDocument();
    expect(within(language).getByText('English is the only language for now')).toBeInTheDocument();
    // Nothing to operate: it is a fact, not a control.
    expect(within(language).queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('can start the tour at any time', async () => {
    const user = userEvent.setup();
    renderSettings(<TourRequests />, '/settings#preferences');
    expect(screen.getByTestId('tour-requests')).toHaveTextContent('0');
    await user.click(screen.getByRole('button', { name: 'Take the 45-second tour' }));
    expect(screen.getByTestId('tour-requests')).toHaveTextContent('1');
  });

  it('replays the introduction by forgetting it and going to the front page', async () => {
    const user = userEvent.setup();
    markIgnitionSeen();
    renderSettings(undefined, '/settings#preferences');
    const replay = screen.getByRole('button', { name: 'Replay the introduction' });
    expect(replay).toHaveAccessibleDescription(/lights its instrument once/);

    await user.click(replay);
    expect(localStorage.getItem(IGNITION_KEY)).toBeNull();
    expect(await screen.findByTestId('where')).toHaveTextContent('/');
  });

  it('says that motion is reduced when replaying the introduction would not animate', () => {
    localStorage.setItem('firefly.motion', JSON.stringify('reduce'));
    renderSettings(undefined, '/settings#preferences');
    expect(
      screen.getByRole('button', { name: 'Replay the introduction' }),
    ).toHaveAccessibleDescription(/appear without the animation/);
  });
});

describe('Settings ambient motion', () => {
  it('shows the state of the ambient pause and sets it, the same control as the one in the corner', async () => {
    const user = userEvent.setup();
    const { unmount } = renderSettings(undefined, '/settings#preferences');
    const ambient = screen.getByRole('switch', { name: 'Ambient motion' });
    expect(ambient).toBeChecked();
    expect(ambient).toBeEnabled();
    expect(ambient).toHaveAccessibleDescription(/same control as the pause button/);
    expect(document.documentElement).not.toHaveAttribute('data-ambient');

    await user.click(ambient);
    expect(ambient).not.toBeChecked();
    expect(localStorage.getItem('firefly.ambient')).toBe('"paused"');
    expect(document.documentElement).toHaveAttribute('data-ambient', 'paused');
    expect(await screen.findByText('Ambient motion is paused.')).toBeInTheDocument();

    // What the corner button stored is what this shows, after a reload.
    unmount();
    renderSettings(undefined, '/settings#preferences');
    expect(screen.getByRole('switch', { name: 'Ambient motion' })).not.toBeChecked();

    await user.click(screen.getByRole('switch', { name: 'Ambient motion' }));
    expect(screen.getByRole('switch', { name: 'Ambient motion' })).toBeChecked();
    expect(localStorage.getItem('firefly.ambient')).toBe('"on"');
    expect(document.documentElement).not.toHaveAttribute('data-ambient');
  });

  it('cannot be turned on while reduced motion forces the pause, and says why', async () => {
    const user = userEvent.setup();
    localStorage.setItem('firefly.motion', JSON.stringify('reduce'));
    renderSettings(undefined, '/settings#preferences');
    const ambient = screen.getByRole('switch', { name: 'Ambient motion' });
    expect(ambient).not.toBeChecked();
    expect(ambient).toBeDisabled();
    expect(ambient).toHaveAccessibleDescription(
      /Reduced motion is on, so ambient motion is paused/,
    );
    expect(document.documentElement).toHaveAttribute('data-ambient', 'paused');

    // Setting motion back to full gives the control back, with what was chosen before.
    await user.click(choice('Reduce motion', 'Off'));
    expect(ambient).toBeEnabled();
    expect(ambient).toBeChecked();
    expect(localStorage.getItem('firefly.ambient')).toBeNull();
  });
});

describe('Settings tabs', () => {
  it('moves between the tabs with the arrow keys, Home and End', async () => {
    const user = userEvent.setup();
    renderSettings();
    const profile = tab('Profile');
    const preferences = tab('Preferences');
    const notifications = tab('Notifications');
    const data = tab('Data & privacy');
    expect(profile).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Profile');

    // Only the selected tab is a tab stop.
    expect(preferences).toHaveAttribute('tabindex', '-1');
    profile.focus();
    await user.keyboard('{ArrowRight}');
    expect(preferences).toHaveFocus();
    expect(preferences).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Preferences');

    await user.keyboard('{ArrowRight}');
    expect(notifications).toHaveFocus();
    expect(screen.getByRole('switch', { name: /coaching report is ready/ })).toBeVisible();

    await user.keyboard('{ArrowRight}');
    expect(data).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Data & privacy');
    await user.keyboard('{ArrowRight}');
    expect(profile).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(data).toHaveFocus();
    await user.keyboard('{Home}');
    expect(profile).toHaveFocus();
    await user.keyboard('{End}');
    expect(data).toHaveFocus();
    expect(data).toHaveAttribute('aria-selected', 'true');
    expect(profile).toHaveAttribute('aria-selected', 'false');
  });
});

describe('Settings notifications', () => {
  it('turns report and badge notices on and off, and says they stay in the app', async () => {
    const user = userEvent.setup();
    seedProfile();
    renderSettings(undefined, '/settings#notifications');

    const reports = screen.getByRole('switch', { name: 'Tell me when a coaching report is ready' });
    const badges = screen.getByRole('switch', { name: 'Tell me when I earn a badge' });
    expect(reports).toBeChecked();
    expect(badges).toBeChecked();
    expect(
      screen.getByText(
        'Notices appear in the bell menu in this app only. Nothing is emailed or pushed.',
      ),
    ).toBeVisible();

    await user.click(reports);
    expect(stored()?.preferences).toMatchObject({ notifyReports: false, notifyBadges: true });
    expect(reports).not.toBeChecked();
    await user.click(badges);
    expect(stored()?.preferences).toMatchObject({ notifyReports: false, notifyBadges: false });
    expect(await screen.findByText('Badge notices are off.')).toBeInTheDocument();
    await user.click(reports);
    expect(stored()?.preferences.notifyReports).toBe(true);
  });

  it('needs a profile to change them', () => {
    renderSettings(undefined, '/settings#notifications');
    for (const toggle of screen.getAllByRole('switch')) {
      expect(toggle).toBeDisabled();
      expect(toggle).toHaveAccessibleDescription(/Create your profile first\./);
    }
  });
});

describe('Settings data and privacy', () => {
  it('says what is stored where, shows the counts and where to delete', async () => {
    renderSettings(undefined, '/settings#data');

    const panel = screen.getByRole('tabpanel', { name: 'Data & privacy' });
    expect(within(panel).getByText('In this browser')).toBeInTheDocument();
    expect(within(panel).getByText('On the Firefly server')).toBeInTheDocument();
    expect(panel).toHaveTextContent('not stored in this browser');
    expect(panel).toHaveTextContent('Firefly never records, keeps or uploads audio');
    expect(await within(panel).findByText('12')).toBeInTheDocument();
    expect(
      within(panel).getByText('Practice calls', { selector: 'dt' }).nextElementSibling,
    ).toHaveTextContent('12');
    expect(
      within(panel).getByText('Sample calls', { selector: 'dt' }).nextElementSibling,
    ).toHaveTextContent('3');
    expect(within(panel).getByRole('link', { name: /Trainer page/ })).toHaveAttribute(
      'href',
      '/trainer',
    );
    expect(within(panel).getByRole('link', { name: 'Open history' })).toHaveAttribute(
      'href',
      '/history',
    );
    expect(
      within(panel).getByRole('link', { name: /responsible AI and data safety/ }),
    ).toHaveAttribute('href', '/help#responsible-ai');
    expect(within(panel).getByRole('link', { name: /How voice works/ })).toHaveAttribute(
      'href',
      '/help#voice',
    );
  });

  it('says so, without a number, while the counts load or when they cannot', async () => {
    mocks.demo.mockRejectedValue(new Error('offline'));
    renderSettings(undefined, '/settings#data');
    const panel = screen.getByRole('tabpanel', { name: 'Data & privacy' });
    expect(
      within(panel).getByText('Practice calls', { selector: 'dt' }).nextElementSibling,
    ).toHaveTextContent('Loading');
    await waitFor(() =>
      expect(
        within(panel).getByText('Practice calls', { selector: 'dt' }).nextElementSibling,
      ).toHaveTextContent('Unavailable'),
    );
  });

  it('shows the server settings read-only, including a provider notice', async () => {
    mocks.config.mockResolvedValue({
      ...CONFIG,
      provider: { ...CONFIG.provider, notice: 'A live provider was requested but is not set up.' },
      features: { devDiagnostics: true, testHooks: false },
    });
    renderSettings(undefined, '/settings#data');

    const server = screen.getByRole('region', { name: 'This Firefly server' });
    expect(await within(server).findByText('0.1.0')).toBeInTheDocument();
    expect(server).toHaveTextContent('Demo mode (built-in rules engine)');
    expect(server).toHaveTextContent('1,500 characters');
    expect(server).toHaveTextContent('Up to 60');
    expect(server).toHaveTextContent('A live provider was requested but is not set up.');
    expect(server).toHaveTextContent('Developer features are switched on');
    expect(within(server).queryByRole('combobox')).not.toBeInTheDocument();
    expect(within(server).queryByRole('switch')).not.toBeInTheDocument();
    expect(within(server).queryByRole('radio')).not.toBeInTheDocument();
  });

  it('says so when the server settings cannot be read, and can try again', async () => {
    const user = userEvent.setup();
    mocks.config.mockRejectedValueOnce(new Error('offline'));
    renderSettings(undefined, '/settings#data');

    expect(await screen.findByRole('alert')).toHaveTextContent('could not read the server');
    await user.click(screen.getByRole('button', { name: /Try again/ }));
    expect(await screen.findByText('0.1.0')).toBeInTheDocument();
  });
});

describe('Settings where the browser keeps nothing', () => {
  it('still works for the visit when storage refuses to save, rather than breaking', async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    renderSettings(undefined, '/settings#preferences');
    await user.click(choice('Theme', 'Dark'));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    await user.click(screen.getByRole('switch', { name: 'Sound effects' }));
    expect(screen.getByRole('switch', { name: 'Sound effects' })).toBeChecked();
    vi.restoreAllMocks();
  });
});
