import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfigDTO, ProgressDTO, SessionDTO } from '#shared/domain/api.ts';
import { makeScenario } from '../components/scenario/scenario-fixtures.ts';
import type * as ApiModule from '../lib/api.ts';
import { ApiError, api } from '../lib/api.ts';
import { useAppConfig } from '../lib/config.tsx';
import { resetProfileForTests, saveProfile, updatePreferences } from '../lib/profile.ts';
import { ThemeProvider } from '../lib/theme.tsx';
import Setup from './Setup.tsx';

vi.mock('../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return {
    ...actual,
    api: { scenarios: vi.fn(), listSessions: vi.fn(), progress: vi.fn(), createSession: vi.fn() },
  };
});
vi.mock('../lib/config.tsx', () => ({ useAppConfig: vi.fn() }));

const lockedOut = makeScenario({
  id: 'locked-out',
  title: 'Locked out after a password reset',
  summary: 'A front-desk coordinator cannot sign in to the staff portal.',
  difficulty: 'starter',
  impact: 'low',
  startingTemperature: 'calm',
  style: 'talkative',
  estimatedMinutes: 8,
});
const workspace = makeScenario({ id: 'team-workspace' });
const checkout = makeScenario({
  id: 'checkout-down',
  title: 'Checkout is down and the clock is running',
  summary: 'An operations lead says nobody can pay.',
  issueType: 'service-outage',
  difficulty: 'challenge',
  impact: 'high',
  startingTemperature: 'angry',
  estimatedMinutes: 12,
});
const licence = makeScenario({
  id: 'licence-seat',
  title: 'A new hire has no premium seat',
  issueType: 'billing-licence',
  difficulty: 'starter',
  estimatedMinutes: 9,
});
const invoice = makeScenario({
  id: 'invoice-shock',
  title: 'A much bigger invoice than expected',
  issueType: 'billing-licence',
  difficulty: 'challenge',
  estimatedMinutes: 14,
});
const library = [lockedOut, workspace, checkout, licence, invoice];

const noProgress: ProgressDTO = {
  totalSessions: 0,
  completedSessions: 0,
  dimensionTrends: [],
  strongest: null,
  focus: null,
  focusReason: null,
  repeatedOpportunities: [],
  recentChange: 'not-enough-data',
  note: '',
};
const session = (id: string) => ({ id }) as SessionDTO;

function appConfig(
  provider: Partial<AppConfigDTO['provider']> = {},
  state: Partial<ReturnType<typeof useAppConfig>> = {},
): ReturnType<typeof useAppConfig> {
  return {
    config: {
      app: { name: 'Firefly', version: 'test' },
      provider: {
        kind: 'mock',
        label: 'Demo mode (built-in rules engine)',
        demo: true,
        notice: null,
        ...provider,
      },
      limits: { maxMessageChars: 1500, maxTraineeTurns: 60 },
      features: { devDiagnostics: false, testHooks: false },
    },
    loading: false,
    error: false,
    reload: vi.fn(),
    ...state,
  };
}

function Probe() {
  const location = useLocation();
  return <p data-testid="url">{`${location.pathname}${location.search}`}</p>;
}

function renderSetup(entry = '/scenarios/team-workspace/setup') {
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Probe />
        <Routes>
          <Route path="/practice" element={<Setup />} />
          <Route path="/scenarios/:id/setup" element={<Setup />} />
          <Route path="/scenarios" element={<p>Library page</p>} />
          <Route path="/calls/:id" element={<p>Call page</p>} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

const readDraft = () => JSON.parse(sessionStorage.getItem('firefly.draft') ?? 'null');
const saveDraft = (draft: object) => sessionStorage.setItem('firefly.draft', JSON.stringify(draft));
const quickStart = () => screen.findByRole('group', { name: 'Quick start' });
const startButton = () => screen.findByRole('button', { name: /Start call simulation/ });
const sent = (call = 0) => vi.mocked(api.createSession).mock.calls[call]?.[0];

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  resetProfileForTests();
  // Most of these tests are about the form, not the launch moment (which reduced motion skips).
  localStorage.setItem('firefly.motion', JSON.stringify('reduce'));
  vi.mocked(api.scenarios).mockResolvedValue(library);
  vi.mocked(api.listSessions).mockResolvedValue({ sessions: [], total: 0 });
  vi.mocked(api.progress).mockResolvedValue(noProgress);
  vi.mocked(api.createSession).mockResolvedValue(session('call-1'));
  vi.mocked(useAppConfig).mockReturnValue(appConfig());
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Setup: the page', () => {
  it('is one page with one heading, the setup on the left and the scenario preview beside it', async () => {
    renderSetup();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Configure your scenario' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Set the customer parameters to create your practice call.'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    for (const name of ['Quick start', 'Custom configuration', 'Practice mode']) {
      expect(await screen.findByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
    const preview = screen.getByRole('complementary', { name: workspace.title });
    expect(within(preview).getByText('Scenario preview')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start call simulation/ })).toBeInTheDocument();
  });

  it('shows only what a trainee may know in the preview, whatever else the response carries', async () => {
    vi.mocked(api.scenarios).mockResolvedValue([
      Object.assign(makeScenario({ id: 'team-workspace' }), {
        hiddenFacts: [{ statement: 'SECRET-HIDDEN-FACT' }],
        evaluatorNotes: 'SECRET-EVALUATOR-NOTE',
        successCriteria: ['SECRET-CRITERIA'],
        curveballs: [{ statement: 'SECRET-CURVEBALL', trigger: { earliestTurn: 4 } }],
      }),
    ]);
    renderSetup();
    const preview = await screen.findByRole('complementary', { name: workspace.title });

    expect(document.body.textContent).not.toMatch(/SECRET|earliest|trigger/i);
    expect(within(preview).getByText('Maya Okafor')).toBeInTheDocument();
    expect(within(preview).getByText(/IT administrator, Northwind Foods/)).toBeInTheDocument();
    expect(within(preview).getByText(workspace.brief.situation)).toBeInTheDocument();
    expect(within(preview).getByText(workspace.brief.goal)).toBeInTheDocument();
    expect(within(preview).getByText('Scoping & Discovery')).toBeInTheDocument();
    expect(within(preview).getByText('Empathy & De-escalation')).toBeInTheDocument();
    expect(
      within(preview).getByText('The customer, organisation and product are fictional.'),
    ).toBeInTheDocument();
    expect(within(preview).getByText('About 10 minutes')).toBeInTheDocument();
  });

  it('keeps the honest reminders: fictional customer, end any time, practice feedback, how replies are made', async () => {
    vi.mocked(useAppConfig).mockReturnValue(
      appConfig({ notice: 'The live model could not be reached, so demo mode is in use.' }),
    );
    renderSetup();
    const preview = await screen.findByRole('complementary', { name: workspace.title });
    expect(within(preview).getByText(/Never type real customer names/)).toBeInTheDocument();
    expect(within(preview).getByText('You can end the call at any time.')).toBeInTheDocument();
    expect(within(preview).getByText(/practice, not a performance assessment/)).toBeInTheDocument();
    expect(within(preview).getByText(/Demo mode/)).toBeInTheDocument();
    expect(within(preview).getByText(/built-in rules engine, not an AI model/)).toBeInTheDocument();
    expect(
      within(preview).getByText('The live model could not be reached, so demo mode is in use.'),
    ).toBeInTheDocument();
  });

  it('says so, in words, when the server cannot be reached', async () => {
    vi.mocked(useAppConfig).mockReturnValue(appConfig({}, { config: null, error: true }));
    renderSetup();
    const preview = await screen.findByRole('complementary', { name: workspace.title });
    expect(within(preview).getByText(/Server offline/)).toBeInTheDocument();
    expect(
      within(preview).getByText(/could not confirm how replies are produced/),
    ).toBeInTheDocument();
  });

  it('says what went wrong when the scenarios cannot be loaded and lets you try again', async () => {
    const user = userEvent.setup();
    vi.mocked(api.scenarios)
      .mockRejectedValueOnce(new ApiError(0, 'network', "Can't reach Firefly right now.", true))
      .mockResolvedValueOnce(library);
    renderSetup();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Can't reach Firefly right now.");
    await user.click(within(alert).getByRole('button', { name: /Try again/ }));
    expect(await quickStart()).toBeInTheDocument();
  });

  it('offers a way back when the scenario does not exist', async () => {
    renderSetup('/scenarios/no-such-scenario/setup');
    expect(
      await screen.findByRole('heading', { level: 1, name: "We couldn't find that scenario" }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse scenarios' })).toHaveAttribute(
      'href',
      '/scenarios',
    );
    expect(screen.queryByRole('button', { name: /Start call simulation/ })).not.toBeInTheDocument();
  });

  it('copes with a library that is empty', async () => {
    vi.mocked(api.scenarios).mockResolvedValue([]);
    renderSetup('/practice');
    expect(await screen.findByText('No scenarios are available yet')).toBeInTheDocument();
  });
});

describe('Setup: quick start', () => {
  it('is a radio group with a legend, starting on the scenario as written', async () => {
    renderSetup();
    const group = await quickStart();
    expect(
      within(group)
        .getAllByRole('radio')
        .map((radio) => radio.getAttribute('value')),
    ).toEqual(['starter', 'standard', 'challenge']);
    expect(within(group).getByRole('radio', { name: 'Standard' })).toBeChecked();
    // The full summary of the chosen one is its help text.
    expect(within(group).getByText(/Moderate ambiguity, several hidden facts/)).toBeInTheDocument();
  });

  it('sets the difficulty override, marks the page customised and is what gets sent', async () => {
    const user = userEvent.setup();
    renderSetup();
    const group = await quickStart();
    expect(screen.queryByText('Customised')).not.toBeInTheDocument();

    await user.click(within(group).getByRole('radio', { name: 'Challenge' }));
    expect(within(group).getByRole('radio', { name: 'Challenge' })).toBeChecked();
    expect(screen.getByText('Customised')).toBeInTheDocument();
    expect(screen.getByText('Changed from the scenario: difficulty.')).toBeInTheDocument();
    // The preview says its description is of the scenario as written, not of the changes.
    expect(screen.getByText(/This describes the scenario as written/)).toBeInTheDocument();
    // Where the scenario was written to start is still said once it is not chosen.
    expect(within(group).getByText('Scenario default')).toBeInTheDocument();
    expect(readDraft()).toEqual({
      scenarioId: 'team-workspace',
      overrides: { difficulty: 'challenge' },
    });

    await user.click(await startButton());
    await waitFor(() => expect(api.createSession).toHaveBeenCalled());
    expect(sent()).toEqual({
      scenarioId: 'team-workspace',
      overrides: { difficulty: 'challenge' },
      mode: 'immersive',
      clientRequestId: expect.stringMatching(/^[A-Za-z0-9_-]{8,64}$/),
    });
  });
});

describe('Setup: custom configuration', () => {
  it('starts every field on the scenario as written, with what each choice means', async () => {
    renderSetup();
    await quickStart();
    expect(screen.getByLabelText('Issue type')).toHaveValue('sign-in-access');
    expect(screen.getByRole('radio', { name: 'Medium' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Frustrated' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Intermediate' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Terse' })).toBeChecked();
    expect(screen.getByLabelText('Call stage')).toHaveValue('first-contact');
    // The chosen option's own description is the help text.
    expect(
      screen.getByText('Several users or one team blocked. The customer expects regular updates.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Short answers. Shares only what is asked.')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Business impact' })).toHaveAccessibleDescription(
      /Several users or one team blocked/,
    );
  });

  it('offers only the issue types that have a scenario, labelled in words', async () => {
    renderSetup();
    await quickStart();
    const options = within(screen.getByLabelText('Issue type'))
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(options).toEqual([
      'Sign-in or access problem',
      'Service outage',
      'Billing or licence question',
    ]);
  });

  it('sends only what differs from the scenario, and marks and resets what was changed', async () => {
    const user = userEvent.setup();
    renderSetup();
    await quickStart();

    await user.click(screen.getByRole('radio', { name: 'High' }));
    // The customer's expression in the preview follows the starting temperature.
    const portrait = () => document.querySelector('.stp-avatar svg');
    expect(portrait()).toHaveAttribute('data-mood', 'frustrated');
    await user.click(screen.getByRole('radio', { name: 'Angry / escalating' }));
    expect(portrait()).toHaveAttribute('data-mood', 'angry');
    await user.click(screen.getByRole('radio', { name: 'Expert' }));
    await user.click(screen.getByRole('radio', { name: 'Non-native English speaker' }));
    await user.selectOptions(screen.getByLabelText('Call stage'), 'escalated');

    expect(screen.getByText('Customised')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Changed from the scenario: business impact, customer temperature, technical proficiency, communication style, call stage.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Scenario default: Medium.')).toBeInTheDocument();
    expect(readDraft().overrides).toEqual({
      impact: 'high',
      startingTemperature: 'angry',
      proficiency: 'expert',
      style: 'non-native',
      callStage: 'escalated',
    });

    await user.click(await startButton());
    await waitFor(() => expect(api.createSession).toHaveBeenCalled());
    expect(sent()?.overrides).toEqual({
      impact: 'high',
      startingTemperature: 'angry',
      proficiency: 'expert',
      style: 'non-native',
      callStage: 'escalated',
    });
    expect(JSON.stringify(sent())).not.toMatch(/hidden/i);
  });

  it('can put everything back to the scenario as written', async () => {
    const user = userEvent.setup();
    saveDraft({
      scenarioId: 'team-workspace',
      overrides: { impact: 'high', callStage: 'escalated', curveballs: [] },
    });
    renderSetup();
    await quickStart();
    expect(screen.getByRole('radio', { name: 'High' })).toBeChecked(); // restored from the draft
    expect(screen.getByRole('switch', { name: 'Curveballs' })).not.toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Reset to scenario defaults' }));
    expect(screen.getByRole('radio', { name: 'Medium' })).toBeChecked();
    expect(screen.getByLabelText('Call stage')).toHaveValue('first-contact');
    expect(screen.getByRole('switch', { name: 'Curveballs' })).toBeChecked();
    expect(screen.queryByText('Customised')).not.toBeInTheDocument();
    expect(readDraft().overrides).toEqual({});
    expect(
      screen.getByText('Reset to the scenario defaults.', { selector: '[role=status]' }),
    ).toBeInTheDocument();
  });

  it('shows hidden facts as always on, and read-only', async () => {
    const user = userEvent.setup();
    renderSetup();
    await quickStart();
    const hidden = screen.getByRole('switch', { name: 'Hidden facts' });
    expect(hidden).toBeChecked();
    expect(hidden).toBeDisabled();
    expect(hidden).toHaveAccessibleDescription(
      'Always on. Every scenario has details the customer only shares when you ask about them.',
    );
    await user.click(hidden);
    expect(hidden).toBeChecked();
  });
});

describe('Setup: choosing the scenario', () => {
  it('lists the scenarios of the issue type when there are several, and starts from the one chosen', async () => {
    const user = userEvent.setup();
    renderSetup();
    await quickStart();
    const scenario = screen.getByLabelText('Scenario');
    expect(
      within(scenario)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual([lockedOut.title, workspace.title]);
    expect(screen.getByText(workspace.summary)).toBeInTheDocument();

    await user.selectOptions(scenario, 'locked-out');
    const preview = screen.getByRole('complementary', { name: lockedOut.title });
    expect(within(preview).getByText(/About 8 minutes/)).toBeInTheDocument();
    expect(
      screen.getByText('Scenario changed to Locked out after a password reset.', {
        selector: '[role=status]',
      }),
    ).toBeInTheDocument();
    expect(readDraft().scenarioId).toBe('locked-out');
    // Chosen on purpose, but the difficulty is the trainee's own: it stays Standard.
    expect(screen.getByRole('radio', { name: 'Standard' })).toBeChecked();
  });

  it('shows no scenario list for an issue type that has only one, and describes it under the issue', async () => {
    const user = userEvent.setup();
    renderSetup();
    await quickStart();
    await user.selectOptions(screen.getByLabelText('Issue type'), 'service-outage');
    expect(screen.queryByLabelText('Scenario')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Issue type')).toHaveAccessibleDescription(checkout.summary);
    expect(screen.getByRole('complementary', { name: checkout.title })).toBeInTheDocument();
  });

  it('picks the scenario of the new issue type that matches the chosen difficulty, else the gentlest', async () => {
    const user = userEvent.setup();
    renderSetup();
    const group = await quickStart();

    // No Standard scenario for billing: the gentlest is picked and Standard stays chosen.
    await user.selectOptions(screen.getByLabelText('Issue type'), 'billing-licence');
    expect(screen.getByLabelText('Scenario')).toHaveValue('licence-seat');
    expect(within(group).getByRole('radio', { name: 'Standard' })).toBeChecked();
    expect(screen.getByText('Changed from the scenario: difficulty.')).toBeInTheDocument();

    // Back to an issue with none for the difficulty chosen: again the gentlest.
    await user.click(within(group).getByRole('radio', { name: 'Challenge' }));
    await user.selectOptions(screen.getByLabelText('Issue type'), 'sign-in-access');
    expect(screen.getByLabelText('Scenario')).toHaveValue('locked-out');
    // An issue that has one written for Challenge gets exactly that.
    await user.selectOptions(screen.getByLabelText('Issue type'), 'billing-licence');
    expect(screen.getByLabelText('Scenario')).toHaveValue('invoice-shock');
    // Written for Challenge, so nothing is changed from it.
    expect(screen.queryByText('Customised')).not.toBeInTheDocument();
    expect(readDraft()).toEqual({ scenarioId: 'invoice-shock', overrides: {} });
  });

  it('keeps what the trainee changed when the scenario changes, and takes the new one for the rest', async () => {
    const user = userEvent.setup();
    renderSetup();
    await quickStart();
    await user.click(screen.getByRole('radio', { name: 'Low' }));
    await user.selectOptions(screen.getByLabelText('Issue type'), 'service-outage');

    expect(screen.getByRole('radio', { name: 'Low' })).toBeChecked(); // changed by the trainee
    expect(screen.getByRole('radio', { name: 'Angry / escalating' })).toBeChecked(); // the outage's own
    expect(
      screen.getByText(
        'Scenario changed to Checkout is down and the clock is running. Your changes were kept.',
        { selector: '[role=status]' },
      ),
    ).toBeInTheDocument();
  });
});

describe('Setup: curveballs', () => {
  it('is a real switch: off means none, and the choice is what gets sent', async () => {
    const user = userEvent.setup();
    renderSetup();
    await quickStart();
    const curveballs = screen.getByRole('switch', { name: 'Curveballs' });
    expect(curveballs).toBeChecked();
    expect(curveballs).toHaveAccessibleDescription(
      'One curveball may come up. You will not be told when.',
    );

    await user.click(curveballs);
    expect(curveballs).not.toBeChecked();
    expect(screen.getByText('No curveballs on this call.')).toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: /Choose which curveballs/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Changed from the scenario: curveballs.')).toBeInTheDocument();

    await user.click(await startButton());
    await waitFor(() => expect(api.createSession).toHaveBeenCalled());
    expect(sent()?.overrides).toEqual({ curveballs: [] });
  });

  it('lets the trainee choose which can happen, never more than the difficulty allows', async () => {
    const user = userEvent.setup();
    renderSetup();
    await quickStart();
    const list = screen.getByRole('group', { name: /Choose which curveballs can happen/ });
    expect(within(list).getAllByRole('checkbox')).toHaveLength(4);
    expect(within(list).getByText(/Optional\. Tick up to one curveball/)).toBeInTheDocument();

    await user.click(within(list).getByRole('checkbox', { name: 'Imposes a deadline' }));
    expect(
      within(list).getByText(/1 of 1 chosen\. Standard allows up to one curveball/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/One curveball chosen\. You will not be told when it may come up\./),
    ).toBeInTheDocument();

    // A second is refused, and the reason is on the page and tied to the option.
    const second = within(list).getByRole('checkbox', { name: 'Goes quiet' });
    expect(second).toHaveAttribute('aria-disabled', 'true');
    await user.click(second);
    expect(second).not.toBeChecked();

    await user.click(await startButton());
    await waitFor(() => expect(api.createSession).toHaveBeenCalled());
    expect(sent()?.overrides).toEqual({ curveballs: ['deadline'] });
  });

  it('is off for Starter until one is chosen, and switching it on ticks the first on offer', async () => {
    const user = userEvent.setup();
    renderSetup('/scenarios/locked-out/setup');
    await quickStart();
    const curveballs = screen.getByRole('switch', { name: 'Curveballs' });
    expect(curveballs).not.toBeChecked();
    expect(screen.getByText('No curveballs on this call.')).toBeInTheDocument();

    await user.click(curveballs);
    expect(curveballs).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Asks for a manager' })).toBeChecked();
    // Unticking the last one puts it back to off, and focus goes to the switch, not nowhere.
    await user.click(screen.getByRole('checkbox', { name: 'Asks for a manager' }));
    expect(curveballs).not.toBeChecked();
    expect(curveballs).toHaveFocus();
  });

  it('re-checks chosen curveballs against the difficulty and says what was removed', async () => {
    const user = userEvent.setup();
    renderSetup();
    const group = await quickStart();
    await user.click(within(group).getByRole('radio', { name: 'Challenge' }));
    await user.click(screen.getByRole('checkbox', { name: 'Asks for a manager' }));
    await user.click(screen.getByRole('checkbox', { name: 'Imposes a deadline' }));
    expect(screen.getByText(/2 of 2 chosen/)).toBeInTheDocument();

    await user.click(within(group).getByRole('radio', { name: 'Starter' }));
    expect(screen.getAllByRole('checkbox', { checked: true })).toHaveLength(1);
    expect(screen.getByRole('checkbox', { name: 'Asks for a manager' })).toBeChecked();
    expect(
      screen.getByText(/Starter allows up to one curveball, so "Imposes a deadline" was removed/),
    ).toBeInTheDocument();
    expect(readDraft().overrides).toEqual({ difficulty: 'starter', curveballs: ['ask-manager'] });
  });
});

describe('Setup: practice mode', () => {
  it('is Guided or Immersive, following the difficulty until the trainee chooses', async () => {
    const user = userEvent.setup();
    renderSetup();
    const group = await screen.findByRole('group', { name: 'Practice mode' });
    expect(within(group).getByRole('radio', { name: 'Immersive' })).toBeChecked();
    expect(within(group).getByText('Default for Standard')).toBeInTheDocument();

    await user.click(
      within(screen.getByRole('group', { name: 'Quick start' })).getByRole('radio', {
        name: 'Starter',
      }),
    );
    expect(within(group).getByRole('radio', { name: 'Guided practice' })).toBeChecked();

    await user.click(within(group).getByRole('radio', { name: 'Immersive' }));
    expect(readDraft()).toMatchObject({ mode: 'immersive' });
    await user.click(
      within(screen.getByRole('group', { name: 'Quick start' })).getByRole('radio', {
        name: 'Challenge',
      }),
    );
    expect(within(group).getByRole('radio', { name: 'Immersive' })).toBeChecked();

    await user.click(within(group).getByRole('radio', { name: 'Guided practice' }));
    await user.click(await startButton());
    await waitFor(() => expect(api.createSession).toHaveBeenCalled());
    expect(sent()?.mode).toBe('guided');
  });

  it('starts from the hints setting of the profile when it is on or off', async () => {
    saveProfile({ name: 'Priya Raman' });
    updatePreferences({ hints: 'on' });
    renderSetup();
    const group = await screen.findByRole('group', { name: 'Practice mode' });
    expect(within(group).getByRole('radio', { name: 'Guided practice' })).toBeChecked();
    expect(within(group).getByText('From your settings')).toBeInTheDocument();
  });
});

describe('Setup: where it opens', () => {
  it('restores the draft for this scenario, ignoring anything invalid, and ignores one for another scenario', async () => {
    saveDraft({
      scenarioId: 'team-workspace',
      overrides: { startingTemperature: 'angry', style: 'not-a-style' },
      mode: 'guided',
    });
    renderSetup();
    await quickStart();
    expect(screen.getByRole('radio', { name: 'Angry / escalating' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Terse' })).toBeChecked(); // the invalid style fell back
    expect(screen.getByRole('radio', { name: 'Guided practice' })).toBeChecked();
    expect(screen.getByText('Customised')).toBeInTheDocument();
    cleanup();

    saveDraft({ scenarioId: 'another-scenario', overrides: { impact: 'high' } });
    renderSetup();
    await quickStart();
    expect(screen.getByRole('radio', { name: 'Medium' })).toBeChecked();
    expect(screen.queryByText('Customised')).not.toBeInTheDocument();
  });

  it('does not save a draft just by being opened', async () => {
    renderSetup();
    await quickStart();
    expect(readDraft()).toBeNull();
  });

  it('opens the practice page on the draft that was saved, whichever scenario it is for', async () => {
    saveDraft({ scenarioId: 'checkout-down', overrides: { impact: 'low' } });
    renderSetup('/practice');
    await quickStart();
    expect(screen.getByRole('complementary', { name: checkout.title })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Low' })).toBeChecked();
  });

  it('opens the practice page on the usual difficulty from the profile, and says why the scenario was suggested', async () => {
    saveProfile({ name: 'Priya Raman' });
    updatePreferences({ defaultDifficulty: 'challenge' });
    renderSetup('/practice');
    const group = await quickStart();
    expect(within(group).getByRole('radio', { name: 'Challenge' })).toBeChecked();
    // Of the two Challenge scenarios, the shorter one is the gentler first suggestion.
    expect(screen.getByRole('complementary', { name: checkout.title })).toBeInTheDocument();
    expect(screen.getByText(/Suggested for you\./)).toBeInTheDocument();
    expect(
      screen.getByText(/A gentle place to start: a Challenge call of about 12 minutes/),
    ).toBeInTheDocument();
    expect(screen.queryByText('Customised')).not.toBeInTheDocument();
  });

  it('works without a profile: it starts on Starter, with the shortest Starter scenario', async () => {
    renderSetup('/practice');
    const group = await quickStart();
    expect(within(group).getByRole('radio', { name: 'Starter' })).toBeChecked();
    expect(screen.getByRole('complementary', { name: lockedOut.title })).toBeInTheDocument();
  });

  it('still opens when the practice history cannot be read', async () => {
    vi.mocked(api.listSessions).mockRejectedValue(new ApiError(0, 'network', 'Offline.', true));
    vi.mocked(api.progress).mockRejectedValue(new ApiError(0, 'network', 'Offline.', true));
    renderSetup('/practice');
    await quickStart();
    expect(screen.getByRole('complementary')).toBeInTheDocument();
  });

  it('does not read the practice history when a scenario was chosen', async () => {
    renderSetup('/scenarios/team-workspace/setup');
    await quickStart();
    expect(api.listSessions).not.toHaveBeenCalled();
  });
});

describe('Setup: starting the call', () => {
  it('starts with one request id, keeps every choice after a failure and retries with the same id', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createSession)
      .mockRejectedValueOnce(new ApiError(0, 'network', "Can't reach Firefly right now.", true))
      .mockResolvedValueOnce(session('call-1'));
    renderSetup();
    await quickStart();
    await user.click(screen.getByRole('radio', { name: 'High' }));

    await user.click(await startButton());
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Can't reach Firefly right now.");
    expect(alert).toHaveTextContent('Your choices are kept');
    expect(readDraft()).not.toBeNull();
    expect(screen.getByRole('radio', { name: 'High' })).toBeChecked();
    await waitFor(() => expect(within(alert).getByRole('button', { name: 'Retry' })).toHaveFocus());

    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('/calls/call-1'));
    expect(sent(1)?.clientRequestId).toBe(sent(0)?.clientRequestId);
    expect(readDraft()).toBeNull();
  });

  it('uses a new request id once the setup has changed, so an earlier call is never answered', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createSession)
      .mockRejectedValueOnce(
        new ApiError(0, 'timeout', 'Starting the call is taking too long.', true),
      )
      .mockResolvedValueOnce(session('call-2'));
    renderSetup();
    await quickStart();
    await user.click(await startButton());
    await screen.findByRole('alert');

    await user.click(screen.getByRole('radio', { name: 'Low' }));
    await user.click(screen.getByRole('button', { name: /Start call simulation/ }));
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('/calls/call-2'));
    expect(sent(1)?.clientRequestId).not.toBe(sent(0)?.clientRequestId);
    expect(sent(1)?.overrides).toEqual({ impact: 'low' });
  });

  it('starts one call when the button is pressed twice, says it is starting and locks the form', async () => {
    const user = userEvent.setup();
    let finish: (value: SessionDTO) => void = () => undefined;
    vi.mocked(api.createSession).mockReturnValue(
      new Promise<SessionDTO>((resolve) => {
        finish = resolve;
      }),
    );
    renderSetup();
    await quickStart();

    const button = await startButton();
    await user.dblClick(button);
    expect(api.createSession).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Starting call/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(
      screen.getByText('Starting your call…', { selector: '[role=status]' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'High' })).toBeDisabled();

    await act(async () => finish(session('call-3')));
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('/calls/call-3'));
    expect(api.createSession).toHaveBeenCalledTimes(1);
  });

  it('explains a problem with the provider and offers a retry, because it is worth trying again', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createSession).mockRejectedValueOnce(
      new ApiError(
        502,
        'provider_unavailable',
        'The customer could not be reached. Try again in a moment.',
        true,
      ),
    );
    renderSetup();
    await quickStart();
    await user.click(await startButton());
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("We couldn't start your call.");
    expect(alert).toHaveTextContent('The customer could not be reached. Try again in a moment.');
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.getByTestId('url')).toHaveTextContent('/scenarios/team-workspace/setup');
  });

  it('puts focus on the explanation when there is nothing to retry', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createSession).mockRejectedValue(
      new ApiError(409, 'conflict', 'That scenario is not available.', false),
    );
    renderSetup();
    await quickStart();
    await user.click(await startButton());
    const alert = await screen.findByRole('alert');
    expect(within(alert).queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    await waitFor(() => expect(alert).toHaveFocus());
  });
});

describe('Setup: the launch moment', () => {
  beforeEach(() => localStorage.setItem('firefly.motion', JSON.stringify('full')));

  it('shows the launch while the call is created, then opens the call', async () => {
    const user = userEvent.setup();
    let finish: (value: SessionDTO) => void = () => undefined;
    vi.mocked(api.createSession).mockReturnValue(
      new Promise<SessionDTO>((resolve) => {
        finish = resolve;
      }),
    );
    renderSetup();
    await quickStart();
    await user.click(await startButton());

    const dialog = await screen.findByRole('dialog', { name: 'Starting your call' });
    expect(dialog).toHaveTextContent('Scenario locked');
    // Nothing says "line open" until the call really exists, and the page has not moved on.
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(dialog).not.toHaveTextContent('Line open');
    expect(screen.getByTestId('url')).toHaveTextContent('/scenarios/team-workspace/setup');

    await act(async () => finish(session('call-7')));
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('/calls/call-7'), {
      timeout: 3000,
    });
  });

  it('can be skipped from the keyboard', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createSession).mockResolvedValue(session('call-8'));
    renderSetup();
    await quickStart();
    await user.click(await startButton());
    await screen.findByRole('dialog', { name: 'Starting your call' });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('/calls/call-8'), {
      timeout: 1500,
    });
  });

  it('goes away and keeps every choice when the call cannot be started', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createSession).mockRejectedValue(
      new ApiError(0, 'network', "Can't reach Firefly right now.", true),
    );
    renderSetup();
    await quickStart();
    await user.click(screen.getByRole('radio', { name: 'High' }));
    await user.click(await startButton());
    const alert = await screen.findByRole('alert');
    expect(screen.queryByRole('dialog', { name: 'Starting your call' })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'High' })).toBeChecked();
    expect(readDraft()).not.toBeNull();
    await waitFor(() => expect(within(alert).getByRole('button', { name: 'Retry' })).toHaveFocus());
  });

  it('is never shown when reduced motion is asked for', async () => {
    localStorage.setItem('firefly.motion', JSON.stringify('reduce'));
    const user = userEvent.setup();
    vi.mocked(api.createSession).mockResolvedValue(session('call-9'));
    renderSetup();
    await quickStart();
    await user.click(await startButton());
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('/calls/call-9'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
