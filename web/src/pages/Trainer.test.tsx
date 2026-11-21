import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfigDTO, DemoStatusDTO, PublicScenarioDTO } from '#shared/domain/api.ts';
import { spotlightHighlights } from '../components/trainer/trainer-model.ts';
import { ApiError } from '../lib/api.ts';
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

describe('Trainer studio frame', () => {
  it('is the first of two studio tools, with a real link to the other', async () => {
    renderTrainer();

    expect(await screen.findByRole('heading', { level: 1, name: 'Trainer' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Studio' });
    expect(within(nav).getByRole('link', { name: 'Trainer' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const other = within(nav).getByRole('link', { name: 'Calibration' });
    expect(other).toHaveAttribute('href', '/calibration');
    expect(other).not.toHaveAttribute('aria-current');
    expect(screen.getByText(/05 \/ Studio/)).toBeInTheDocument();
    expect(document.title).toBe('Trainer \u00b7 Firefly');
  });

  it('names every part of the page as a section, in reading order', async () => {
    renderTrainer();

    await screen.findByRole('heading', { name: 'Demo spotlight' });
    const names = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(names).toEqual([
      'Provider status',
      'Demo spotlight',
      'Quick start',
      'Demo checklist',
      'Demo data',
      'Where a demo goes next',
    ]);
  });
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
    // Focus starts on Cancel, so Enter never deletes by accident.
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete my practice sessions' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mocks.resetDemo).not.toHaveBeenCalled();
    expect(countFor('Practice sessions')).toHaveTextContent('4');
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
    expect(button).toHaveAccessibleDescription(/Already loaded \(3 sample sessions\)/);
    await user.click(button);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('offers nothing to delete when there is nothing, and says so', async () => {
    mocks.demo.mockResolvedValue(status({ practiceSessions: 0, sampleSessions: 0 }));
    renderTrainer();

    for (const name of [
      'Remove sample sessions',
      'Delete my practice sessions',
      'Reset everything',
    ]) {
      expect(await screen.findByRole('button', { name })).toHaveAttribute('aria-disabled', 'true');
    }
    expect(screen.getByText(/There is nothing to reset\./)).toBeInTheDocument();
    expect(countFor('Sample sessions')).toHaveTextContent('0');
  });

  it('says the counts could not be loaded, offers no action and tries again on request', async () => {
    const user = userEvent.setup();
    mocks.demo
      .mockRejectedValueOnce(new ApiError(0, 'network', 'Cannot reach Firefly.', true))
      .mockResolvedValue(status());
    renderTrainer();

    expect(await screen.findByText('The session counts could not be loaded')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset everything' })).not.toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Try again' })[0] as HTMLElement);

    expect(await screen.findByRole('button', { name: 'Reset everything' })).toBeInTheDocument();
    expect(mocks.demo).toHaveBeenCalledTimes(2);
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

  it('says when the scenarios cannot be listed, and tries again on request', async () => {
    const user = userEvent.setup();
    mocks.scenarios
      .mockRejectedValueOnce(new ApiError(0, 'network', 'Cannot reach Firefly.', true))
      .mockResolvedValue([SPOTLIGHT, STARTER]);
    renderTrainer();

    expect(await screen.findByText('Could not load the scenarios')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Try again' })[0] as HTMLElement);
    expect(await screen.findByRole('combobox', { name: 'Scenario' })).toBeInTheDocument();
  });

  it('writes the settings out in words beside the instrument, and never counts hidden facts', async () => {
    renderTrainer();

    const settings = await screen.findByRole('list', { name: 'Scenario settings' });
    expect(settings).toHaveTextContent('StandardMedium impactFrustratedDemandingFirst contact');
    expect(settings).toHaveTextContent('About 10 min');
    const text = spotlightHighlights(SPOTLIGHT)
      .map((item) => item.text)
      .join(' ');
    expect(text).toContain('Some areas hold details the customer shares only when asked');
    expect(spotlightHighlights(SPOTLIGHT)[1]?.text).not.toMatch(/\d/);
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
    ) as HTMLElement;
    expect(await within(card).findByText('Demo mode (built-in rules engine)')).toBeInTheDocument();
    expect(card).toHaveTextContent('No AI model is called in demo mode');
    expect(card).toHaveTextContent('FIREFLY_PROVIDER=azure-openai but a setting is missing.');
    expect(card).toHaveTextContent('Firefly is running in demo mode instead.');
    expect(within(card).getByText('Demo mode')).toBeInTheDocument();
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
    ) as HTMLElement;
    expect(await within(card).findByText('Azure OpenAI (deployment "chat")')).toBeInTheDocument();
    expect(card).toHaveTextContent('replies come from the configured model');
    expect(card).toHaveTextContent('Live model');
    expect(card).not.toHaveTextContent('No AI model is called');
    expect(card).not.toHaveTextContent('Demo mode');
  });

  it('does not guess when the settings cannot be read, and tries again on request', async () => {
    const user = userEvent.setup();
    mocks.config.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(CONFIG);
    renderTrainer();

    expect(await screen.findByText('The provider is unknown')).toBeInTheDocument();
    expect(
      screen.getByText(/Firefly could not read the server.s settings, so the provider is unknown/),
    ).toBeInTheDocument();
    expect(screen.queryByText('Live model')).not.toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Try again' })[0] as HTMLElement);

    expect(await screen.findByText('Demo mode (built-in rules engine)')).toBeInTheDocument();
  });
});

describe('Trainer demo checklist', () => {
  it('says Done or Not yet in words, and keeps the presenter\u2019s ticks for this tab only', async () => {
    const user = userEvent.setup();
    const first = renderTrainer();

    const step = await screen.findByRole('checkbox', { name: 'Configure the scenario' });
    expect(step).not.toBeChecked();
    expect(step).toHaveAccessibleDescription(/Change the difficulty/);
    expect(screen.getByText('0 of 8 done')).toBeInTheDocument();
    expect(screen.getAllByText('Not yet')).toHaveLength(8);

    await user.click(step);
    await user.click(screen.getByRole('checkbox', { name: 'Meet a curveball' }));
    expect(screen.getByText('2 of 8 done')).toBeInTheDocument();
    expect(screen.getAllByText('Done')).toHaveLength(2);
    expect(JSON.parse(sessionStorage.getItem('firefly.trainer.checklist') ?? '[]')).toEqual([
      'configure',
      'curveball',
    ]);

    // A reload of the tab keeps them; Clear forgets them.
    first.unmount();
    renderTrainer();
    expect(await screen.findByRole('checkbox', { name: 'Meet a curveball' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Clear the ticks' }));
    expect(screen.getByText('0 of 8 done')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Configure the scenario' })).not.toBeChecked();
  });

  it('links each step to the place it needs, and ignores ticks it does not know', async () => {
    sessionStorage.setItem('firefly.trainer.checklist', JSON.stringify(['nonsense', 'run']));
    renderTrainer();

    expect(await screen.findByRole('checkbox', { name: 'Run an unscripted call' })).toBeChecked();
    expect(screen.getByText('1 of 8 done')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Open setup' })).toHaveAttribute(
      'href',
      `/scenarios/${SPOTLIGHT.id}/setup`,
    );
    expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute('href', '/history');
    expect(screen.getAllByRole('link', { name: 'Calibration' }).length).toBeGreaterThan(0);
    expect(screen.getByText(/Unscripted by design/)).toBeInTheDocument();
  });
});
