import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfigDTO, DemoStatusDTO } from '#shared/domain/api.ts';
import type * as ApiModule from '../lib/api.ts';
import { ConfigProvider } from '../lib/config.tsx';
import { DEFAULT_PREFERENCES, resetProfileForTests, type Profile } from '../lib/profile.ts';
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

function renderSettings(extra?: ReactNode) {
  return render(
    <ThemeProvider>
      <ConfigProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={['/settings']}>
            <Settings />
            {extra}
          </MemoryRouter>
        </ToastProvider>
      </ConfigProvider>
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

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  resetProfileForTests();
  resetSoundForTests();
  resetTourForTests();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-motion');
  mocks.config.mockResolvedValue(CONFIG);
  mocks.demo.mockResolvedValue(DEMO);
});

describe('Settings page', () => {
  it('has one h1, a profile card and the three tabs, and every control has a name', () => {
    seedProfile();
    renderSettings();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Profile & settings' })).toBeVisible();
    expect(screen.getByText('Manage your profile and preferences.')).toBeVisible();
    expect(
      within(screen.getByRole('tablist', { name: 'Settings sections' }))
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['Preferences', 'Notifications', 'Data & privacy']);

    for (const control of [...screen.getAllByRole('combobox'), ...screen.getAllByRole('switch')]) {
      expect(control).toHaveAccessibleName();
    }
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
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your name to continue.');
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
    expect(screen.getByText('SC')).toBeInTheDocument();
    expect(screen.getByText('Sam Carter')).toBeInTheDocument();
    expect(screen.getByText('Support apprentice')).toBeInTheDocument();
    expect(screen.getByText('Leeds, UK')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Create your profile' })).not.toBeInTheDocument();
  });

  it('edits the profile in a dialog, keeps the preferences, and Cancel changes nothing', async () => {
    const user = userEvent.setup();
    seedProfile({ preferences: { ...DEFAULT_PREFERENCES, defaultDifficulty: 'challenge' } });
    renderSettings();
    expect(screen.getByText('SC')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit profile' }));
    let dialog = screen.getByRole('dialog', { name: 'Edit profile' });
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Sam Carter');
    expect(within(dialog).getByLabelText('Name')).toHaveFocus();
    expect(within(dialog).getByLabelText('Role (optional)')).toHaveValue('Support apprentice');
    expect(dialog).toHaveTextContent('never enter customer information');

    // A name is required: the dialog stays open and nothing is saved.
    await user.clear(within(dialog).getByLabelText('Name'));
    await user.click(within(dialog).getByRole('button', { name: 'Save profile' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter your name to continue.');
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
});

describe('Settings preferences', () => {
  it('saves the practice preferences on the profile at once, with a confirmation', async () => {
    const user = userEvent.setup();
    seedProfile();
    renderSettings();

    const difficulty = screen.getByLabelText('Default difficulty');
    expect(difficulty).toHaveDisplayValue('Starter');
    await user.selectOptions(difficulty, 'challenge');
    expect(stored()?.preferences.defaultDifficulty).toBe('challenge');
    expect(await screen.findByText('Default difficulty is now Challenge.')).toBeInTheDocument();

    const hints = screen.getByLabelText('Show hints');
    expect(
      within(hints)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual([
      'Follow the difficulty (recommended)',
      'Always show hints (Guided practice)',
      'Never (Immersive)',
    ]);
    await user.selectOptions(hints, 'on');
    expect(stored()?.preferences.hints).toBe('on');
    await user.selectOptions(hints, 'off');
    expect(stored()?.preferences.hints).toBe('off');
    expect(stored()?.preferences.defaultDifficulty).toBe('challenge');
  });

  it('turns voice on only after the disclosure, and Cancel leaves it off', async () => {
    const user = userEvent.setup();
    seedProfile();
    renderSettings();

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
    renderSettings();
    const voice = screen.getByRole('switch', { name: 'Enable voice (Beta)' });
    expect(voice).toBeDisabled();
    expect(voice).toHaveAccessibleDescription(/Create your profile first\./);
    expect(screen.getByLabelText('Default difficulty')).toBeDisabled();
    expect(screen.getByLabelText('Show hints')).toBeDisabled();
    // Device settings do not depend on a profile.
    expect(screen.getByLabelText('Theme')).toBeEnabled();
    expect(screen.getByLabelText('Reduce motion')).toBeEnabled();
    expect(screen.getByRole('switch', { name: 'Sound effects' })).toBeEnabled();
  });

  it('applies the theme and motion choices at once and keeps them for next time', async () => {
    const user = userEvent.setup();
    const { unmount } = renderSettings();

    await user.selectOptions(screen.getByLabelText('Theme'), 'dark');
    await user.selectOptions(screen.getByLabelText('Reduce motion'), 'reduce');

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(document.documentElement).toHaveAttribute('data-motion', 'reduce');
    expect(localStorage.getItem('firefly.theme')).toBe('"dark"');
    expect(localStorage.getItem('firefly.motion')).toBe('"reduce"');
    expect(screen.getByText('Using the dark theme.')).toBeInTheDocument();
    expect(screen.getByText('Animation and transitions are reduced.')).toBeInTheDocument();
    expect(await screen.findByText('Theme: Dark.')).toBeInTheDocument();

    unmount();
    renderSettings();
    expect(screen.getByLabelText('Theme')).toHaveDisplayValue('Dark');
    expect(screen.getByLabelText('Reduce motion')).toHaveDisplayValue('On');

    await user.selectOptions(screen.getByLabelText('Theme'), 'system');
    expect(localStorage.getItem('firefly.theme')).toBe('"system"');
    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });

  it('keeps sound off until asked and remembers the choice on this device', async () => {
    const user = userEvent.setup();
    const { unmount } = renderSettings();
    const toggle = screen.getByRole('switch', { name: 'Sound effects' });
    expect(toggle).not.toBeChecked();
    expect(toggle).toHaveAccessibleDescription(/Nothing plays unless you turn this on/);

    await user.click(toggle);
    expect(toggle).toBeChecked();
    expect(localStorage.getItem('firefly.sound')).toBe('true');
    expect(await screen.findByText('Sound effects are on.')).toBeInTheDocument();

    unmount();
    resetSoundForTests();
    renderSettings();
    expect(screen.getByRole('switch', { name: 'Sound effects' })).toBeChecked();
  });

  it('shows the language as English only', () => {
    renderSettings();
    const language = screen.getByLabelText('Language');
    expect(language).toBeDisabled();
    expect(language).toHaveDisplayValue('English (UK)');
    expect(language).toHaveAccessibleDescription('English is the only language for now');
  });

  it('can start the tour at any time', async () => {
    const user = userEvent.setup();
    renderSettings(<TourRequests />);
    expect(screen.getByTestId('tour-requests')).toHaveTextContent('0');
    await user.click(screen.getByRole('button', { name: 'Take the 45-second tour' }));
    expect(screen.getByTestId('tour-requests')).toHaveTextContent('1');
  });
});

describe('Settings tabs', () => {
  it('moves between the tabs with the arrow keys, Home and End', async () => {
    const user = userEvent.setup();
    renderSettings();
    const preferences = screen.getByRole('tab', { name: 'Preferences' });
    const notifications = screen.getByRole('tab', { name: 'Notifications' });
    const data = screen.getByRole('tab', { name: 'Data & privacy' });
    expect(preferences).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Preferences');

    // Only the selected tab is a tab stop.
    expect(notifications).toHaveAttribute('tabindex', '-1');
    preferences.focus();
    await user.keyboard('{ArrowRight}');
    expect(notifications).toHaveFocus();
    expect(notifications).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Notifications');
    expect(screen.getByRole('switch', { name: /coaching report is ready/ })).toBeVisible();

    await user.keyboard('{ArrowRight}');
    expect(data).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Data & privacy');
    await user.keyboard('{ArrowRight}');
    expect(preferences).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(data).toHaveFocus();
    await user.keyboard('{Home}');
    expect(preferences).toHaveFocus();
    await user.keyboard('{End}');
    expect(data).toHaveFocus();
    expect(data).toHaveAttribute('aria-selected', 'true');
    expect(preferences).toHaveAttribute('aria-selected', 'false');
  });
});

describe('Settings notifications', () => {
  it('turns report and badge notices on and off, and says they stay in the app', async () => {
    const user = userEvent.setup();
    seedProfile();
    renderSettings();
    await user.click(screen.getByRole('tab', { name: 'Notifications' }));

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

  it('needs a profile to change them', async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole('tab', { name: 'Notifications' }));
    for (const toggle of screen.getAllByRole('switch')) {
      expect(toggle).toBeDisabled();
      expect(toggle).toHaveAccessibleDescription(/Create your profile first\./);
    }
  });
});

describe('Settings data and privacy', () => {
  const openData = async (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('tab', { name: 'Data & privacy' }));

  it('says what is stored where, shows the counts and where to delete', async () => {
    const user = userEvent.setup();
    renderSettings();
    await openData(user);

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

  it('shows the server settings read-only, including a provider notice', async () => {
    const user = userEvent.setup();
    mocks.config.mockResolvedValue({
      ...CONFIG,
      provider: { ...CONFIG.provider, notice: 'A live provider was requested but is not set up.' },
      features: { devDiagnostics: true, testHooks: false },
    });
    renderSettings();
    await openData(user);

    const server = screen.getByRole('region', { name: 'This Firefly server' });
    expect(await within(server).findByText('0.1.0')).toBeInTheDocument();
    expect(server).toHaveTextContent('Demo mode (built-in rules engine)');
    expect(server).toHaveTextContent('1,500 characters');
    expect(server).toHaveTextContent('Up to 60');
    expect(server).toHaveTextContent('A live provider was requested but is not set up.');
    expect(server).toHaveTextContent('Developer features are switched on');
    expect(within(server).queryByRole('combobox')).not.toBeInTheDocument();
    expect(within(server).queryByRole('switch')).not.toBeInTheDocument();
  });

  it('says so when the server settings cannot be read, and can try again', async () => {
    const user = userEvent.setup();
    mocks.config.mockRejectedValueOnce(new Error('offline'));
    renderSettings();
    await openData(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('could not read the server');
    await user.click(screen.getByRole('button', { name: /Try again/ }));
    expect(await screen.findByText('0.1.0')).toBeInTheDocument();
  });
});
