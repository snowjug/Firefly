import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfigDTO, DemoStatusDTO } from '#shared/domain/api.ts';
import type * as ApiModule from '../lib/api.ts';
import { ConfigProvider } from '../lib/config.tsx';
import { ThemeProvider } from '../lib/theme.tsx';
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

function renderSettings() {
  return render(
    <ThemeProvider>
      <ConfigProvider>
        <MemoryRouter initialEntries={['/settings']}>
          <Settings />
        </MemoryRouter>
      </ConfigProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-motion');
  mocks.config.mockResolvedValue(CONFIG);
  mocks.demo.mockResolvedValue(DEMO);
});

describe('Settings appearance', () => {
  it('applies the theme and motion choices at once and keeps them for next time', async () => {
    const user = userEvent.setup();
    const { unmount } = renderSettings();

    await user.click(screen.getByRole('radio', { name: 'Dark' }));
    await user.click(screen.getByRole('radio', { name: 'On' }));

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(document.documentElement).toHaveAttribute('data-motion', 'reduce');
    expect(localStorage.getItem('firefly.theme')).toBe('"dark"');
    expect(localStorage.getItem('firefly.motion')).toBe('"reduce"');
    expect(screen.getByText('Using the dark theme.')).toBeInTheDocument();
    expect(screen.getByText('Animation and transitions are reduced.')).toBeInTheDocument();

    unmount();
    renderSettings();
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'On' })).toBeChecked();

    await user.click(
      within(screen.getByRole('group', { name: 'Theme' })).getByRole('radio', { name: 'System' }),
    );
    expect(localStorage.getItem('firefly.theme')).toBe('"system"');
    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });
});

describe('Settings data and system', () => {
  it('shows the stored session counts and where to delete them', async () => {
    renderSettings();

    const data = (await screen.findByRole('heading', { name: 'Your data' })).closest(
      'section',
    ) as HTMLElement;
    expect(await within(data).findByText('12')).toBeInTheDocument();
    expect(
      within(data).getByText('Practice sessions', { selector: 'dt' }).nextElementSibling,
    ).toHaveTextContent('12');
    expect(within(data).getByRole('link', { name: /Trainer page/ })).toHaveAttribute(
      'href',
      '/trainer',
    );
    expect(data).toHaveTextContent('not in this browser');
  });

  it('shows the server settings read-only, including a provider notice', async () => {
    mocks.config.mockResolvedValue({
      ...CONFIG,
      provider: { ...CONFIG.provider, notice: 'A live provider was requested but is not set up.' },
      features: { devDiagnostics: true, testHooks: false },
    });
    renderSettings();

    const system = (await screen.findByRole('heading', { name: 'System' })).closest(
      'section',
    ) as HTMLElement;
    expect(await within(system).findByText('0.1.0')).toBeInTheDocument();
    expect(system).toHaveTextContent('Demo mode (built-in rules engine)');
    expect(system).toHaveTextContent('1,500 characters');
    expect(system).toHaveTextContent('Up to 60');
    expect(system).toHaveTextContent('A live provider was requested but is not set up.');
    expect(system).toHaveTextContent('Developer features are switched on');
    expect(within(system).queryByRole('radio')).not.toBeInTheDocument();
  });
});
