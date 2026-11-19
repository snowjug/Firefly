import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfigDTO, DemoStatusDTO, PublicScenarioDTO } from '#shared/domain/api.ts';
import type * as ApiModule from '../lib/api.ts';
import { ConfigProvider } from '../lib/config.tsx';
import { loadDraft } from '../lib/draft.ts';
import { ThemeProvider } from '../lib/theme.tsx';
import { ToastProvider } from '../lib/toast.tsx';
import Trainer from './Trainer.tsx';

const mocks = vi.hoisted(() => ({
  config: vi.fn(),
  demo: vi.fn(),
  scenario: vi.fn(),
  scenarios: vi.fn(),
  loadSamples: vi.fn(),
  resetDemo: vi.fn(),
}));
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

function scenario(overrides: Partial<PublicScenarioDTO>): PublicScenarioDTO {
  return {
    id: 'team-cannot-open-shared-workspace',
    version: 1,
    title: 'Team cannot open the shared project workspace',
    summary: 'A project lead says nobody on his team can open their shared workspace.',
    tags: ['access'],
    estimatedMinutes: 10,
    issueType: 'sign-in-access',
    impact: 'medium',
    startingTemperature: 'frustrated',
    proficiency: 'intermediate',
    style: 'demanding',
    callStage: 'first-contact',
    difficulty: 'standard',
    persona: { name: 'Daniel Osei', role: 'Project lead', organisation: 'Proseware Consulting' },
    brief: { situation: 'A situation.', goal: 'A goal.', groundRules: [] },
    expectedDiscoveryAreas: ['When it last worked and when it stopped', 'Anything that changed'],
    coachingFocus: ['scoping-discovery'],
    curveballOptions: ['ask-manager', 'deadline'],
    spotlight: false,
    synthetic: true,
    ...overrides,
  };
}

const SPOTLIGHT = scenario({ spotlight: true });
const STARTER = scenario({
  id: 'locked-out-after-password-reset',
  title: 'Locked out after a password reset',
  difficulty: 'starter',
  persona: { name: 'Maya Lindqvist', role: 'Receptionist', organisation: 'Northwind Clinic' },
});

function status(overrides: Partial<DemoStatusDTO> = {}): DemoStatusDTO {
  return {
    spotlightScenarioId: SPOTLIGHT.id,
    practiceSessions: 4,
    sampleSessions: 3,
    provider: { kind: 'mock', label: CONFIG.provider.label, demo: true },
    ...overrides,
  };
}

function BriefProbe() {
  const { pathname } = useLocation();
  // Reading the draft while the brief renders proves it was saved before navigating.
  return (
    <p>
      Brief opened at {pathname} with draft {JSON.stringify(loadDraft())}
    </p>
  );
}

function renderTrainer() {
  return render(
    <ThemeProvider>
      <ConfigProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={['/trainer']}>
            <Routes>
              <Route path="/trainer" element={<Trainer />} />
              <Route path="/scenarios/:id/setup" element={<BriefProbe />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </ConfigProvider>
    </ThemeProvider>,
  );
}

const countFor = (label: string) =>
  screen.getByText(label, { selector: 'dt' }).nextElementSibling as HTMLElement;

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  mocks.config.mockResolvedValue(CONFIG);
  mocks.demo.mockResolvedValue(status());
  mocks.scenario.mockResolvedValue(SPOTLIGHT);
  mocks.scenarios.mockResolvedValue([SPOTLIGHT, STARTER]);
});

describe('Trainer data actions', () => {
  it.each([
    {
      open: 'Remove sample sessions',
      confirm: 'Remove sample sessions',
      scope: 'samples',
      deleted: 3,
      done: 'Removed 3 sample sessions.',
    },
    {
      open: 'Delete my practice sessions',
      confirm: 'Delete practice sessions',
      scope: 'practice',
      deleted: 4,
      done: 'Deleted 4 practice sessions.',
    },
    {
      open: 'Reset everything',
      confirm: 'Delete everything',
      scope: 'all',
      deleted: 7,
      done: 'Reset complete. Deleted 7 sessions.',
    },
  ])('needs a confirmation, then sends the $scope scope', async (row) => {
    const user = userEvent.setup();
    mocks.resetDemo.mockResolvedValue({ deleted: row.deleted });
    renderTrainer();

    await user.click(await screen.findByRole('button', { name: row.open }));
    const dialog = await screen.findByRole('dialog');
    expect(mocks.resetDemo).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: row.confirm }));
    await waitFor(() => expect(mocks.resetDemo).toHaveBeenCalledWith(row.scope));
    expect(mocks.resetDemo).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(row.done)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('spells out what will be deleted, and Cancel or Escape leaves everything alone', async () => {
    const user = userEvent.setup();
    renderTrainer();

    await user.click(await screen.findByRole('button', { name: 'Reset everything' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reset all demo data?' });
    expect(dialog).toHaveTextContent('7 sessions');
    expect(dialog).toHaveTextContent('4 practice sessions and 3 sample sessions');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete my practice sessions' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mocks.resetDemo).not.toHaveBeenCalled();
  });

  it('refreshes the counts after a delete and then offers nothing more to delete', async () => {
    const user = userEvent.setup();
    mocks.demo
      .mockResolvedValueOnce(status())
      .mockResolvedValue(status({ practiceSessions: 0, sampleSessions: 3 }));
    mocks.resetDemo.mockResolvedValue({ deleted: 4 });
    renderTrainer();

    await screen.findByRole('button', { name: 'Delete my practice sessions' });
    expect(countFor('Practice sessions')).toHaveTextContent('4');
    await user.click(screen.getByRole('button', { name: 'Delete my practice sessions' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Delete practice sessions',
      }),
    );

    await waitFor(() => expect(countFor('Practice sessions')).toHaveTextContent('0'));
    expect(mocks.demo).toHaveBeenCalledTimes(2);
    const button = screen.getByRole('button', { name: 'Delete my practice sessions' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await user.click(button);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('never submits twice while a request is running, and shows a failure without closing', async () => {
    const user = userEvent.setup();
    let finish: (value: { deleted: number }) => void = () => {};
    mocks.resetDemo.mockReturnValueOnce(
      new Promise<{ deleted: number }>((resolve) => {
        finish = resolve;
      }),
    );
    renderTrainer();

    await user.click(await screen.findByRole('button', { name: 'Reset everything' }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Delete everything' });
    await user.click(confirm);
    await user.click(within(dialog).getByRole('button', { name: /Deleting/ }));
    expect(mocks.resetDemo).toHaveBeenCalledTimes(1);

    finish({ deleted: 7 });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    mocks.resetDemo.mockRejectedValueOnce(new Error('offline'));
    await user.click(screen.getByRole('button', { name: 'Reset everything' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete everything' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('confirms before loading samples and reports what was created and skipped', async () => {
    const user = userEvent.setup();
    mocks.demo.mockResolvedValue(status({ practiceSessions: 1, sampleSessions: 0 }));
    mocks.loadSamples.mockResolvedValue({ created: 2, skipped: 1 });
    renderTrainer();

    await user.click(await screen.findByRole('button', { name: 'Load sample sessions' }));
    const dialog = await screen.findByRole('dialog', { name: 'Load sample sessions?' });
    expect(dialog).toHaveTextContent('Tags every one as Sample');
    expect(mocks.loadSamples).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Load sample sessions' }));
    expect(
      await screen.findByText(
        'Loaded 2 sample sessions, tagged Sample everywhere. 1 sample session skipped.',
      ),
    ).toBeInTheDocument();
    expect(mocks.loadSamples).toHaveBeenCalledTimes(1);
  });

  it('does not offer to load samples again when they already exist', async () => {
    const user = userEvent.setup();
    renderTrainer();

    const button = await screen.findByRole('button', { name: 'Load sample sessions' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await user.click(button);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Trainer starting a call', () => {
  it('saves the spotlight draft before opening the brief', async () => {
    const user = userEvent.setup();
    renderTrainer();

    expect(await screen.findByRole('link', { name: 'Customise first' })).toHaveAttribute(
      'href',
      `/scenarios/${SPOTLIGHT.id}/setup`,
    );
    await user.click(screen.getByRole('button', { name: /Start the spotlight call/ }));

    expect(
      await screen.findByText(
        `Brief opened at /scenarios/${SPOTLIGHT.id}/setup with draft ${JSON.stringify({ scenarioId: SPOTLIGHT.id, overrides: {} })}`,
      ),
    ).toBeInTheDocument();
  });

  it('starts any scenario at the chosen difficulty from the quick start', async () => {
    const user = userEvent.setup();
    renderTrainer();

    await user.selectOptions(await screen.findByRole('combobox', { name: 'Scenario' }), STARTER.id);
    expect(screen.getByRole('radio', { name: 'Starter' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Challenge' }));
    await user.click(screen.getByRole('button', { name: 'Start at Challenge difficulty' }));

    expect(
      await screen.findByText(
        `Brief opened at /scenarios/${STARTER.id}/setup with draft ${JSON.stringify({ scenarioId: STARTER.id, overrides: { difficulty: 'challenge' } })}`,
      ),
    ).toBeInTheDocument();
  });

  it('points to the library when no scenario is marked as the spotlight', async () => {
    mocks.demo.mockResolvedValue(status({ spotlightScenarioId: null }));
    renderTrainer();

    expect(await screen.findByText('No demo spotlight is set')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse the scenario library' })).toHaveAttribute(
      'href',
      '/scenarios',
    );
    expect(
      screen.queryByRole('button', { name: /Start the spotlight call/ }),
    ).not.toBeInTheDocument();
  });
});

describe('Trainer provider status', () => {
  it('explains demo mode and shows a server notice as it was given', async () => {
    mocks.config.mockResolvedValue({
      ...CONFIG,
      provider: {
        ...CONFIG.provider,
        notice: 'FIREFLY_PROVIDER=azure-openai but a setting is missing.',
      },
    });
    renderTrainer();

    const card = (await screen.findByRole('heading', { name: 'Provider status' })).closest(
      'section',
    );
    expect(card).not.toBeNull();
    expect(
      within(card as HTMLElement).getByText('Demo mode (built-in rules engine)'),
    ).toBeInTheDocument();
    expect(card).toHaveTextContent('No AI model is called in demo mode');
    expect(card).toHaveTextContent('FIREFLY_PROVIDER=azure-openai but a setting is missing.');
  });

  it('says the replies come from the configured model for a live provider', async () => {
    mocks.config.mockResolvedValue({
      ...CONFIG,
      provider: {
        kind: 'azure-openai',
        label: 'Azure OpenAI (deployment "chat")',
        demo: false,
        notice: null,
      },
    });
    renderTrainer();

    const card = (await screen.findByRole('heading', { name: 'Provider status' })).closest(
      'section',
    );
    expect(
      await within(card as HTMLElement).findByText('Azure OpenAI (deployment "chat")'),
    ).toBeInTheDocument();
    expect(card).toHaveTextContent('replies come from the configured model');
    expect(card).not.toHaveTextContent('No AI model is called');
  });
});
