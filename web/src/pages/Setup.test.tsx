import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Outlet, RouterProvider, createMemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfigDTO, ProgressDTO, SessionDTO } from '#shared/domain/api.ts';
import { forgetScenarioLibrary } from '../components/scenario/useScenarioLibrary.ts';
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

function Layout() {
  const location = useLocation();
  return (
    <>
      <p data-testid="url">{`${location.pathname}${location.search}`}</p>
      <Outlet />
    </>
  );
}

// The page reads the router's view transition state, so it needs a data router.
function renderSetup(entry = '/scenarios/team-workspace/setup', state?: unknown) {
  const router = createMemoryRouter(
    [
      {
        element: <Layout />,
        children: [
          { path: '/practice', element: <Setup /> },
          { path: '/scenarios/:id/setup', element: <Setup /> },
          { path: '/scenarios', element: <p>Library page</p> },
          { path: '/calls/:id', element: <p>Call page</p> },
        ],
      },
    ],
    { initialEntries: [state === undefined ? entry : { pathname: entry, state }] },
  );
  render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  );
  return router;
}

const readDraft = () => JSON.parse(sessionStorage.getItem('firefly.draft') ?? 'null');
const saveDraft = (draft: object) => sessionStorage.setItem('firefly.draft', JSON.stringify(draft));
const difficulty = () => screen.findByRole('group', { name: 'Difficulty' });
const enterButton = () => screen.findByRole('button', { name: /Enter the call/ });
const sent = (call = 0) => vi.mocked(api.createSession).mock.calls[call]?.[0];
const announced = () =>
  screen
    .getAllByRole('status')
    .map((node) => node.textContent)
    .join(' | ');
const radio = (name: string) => screen.getByRole('radio', { name });

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  resetProfileForTests();
  forgetScenarioLibrary();
  // Moving on is not animated here (there is no view transition in the test browser).
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

describe('Calibration: the page', () => {
  it('is one page with one heading: the scenario, with the instrument beside the settings', async () => {
    renderSetup();
    expect(
      await screen.findByRole('heading', { level: 1, name: workspace.title }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText('Maya Okafor')).toBeInTheDocument();
    expect(screen.getByText(/IT administrator, Northwind Foods/)).toBeInTheDocument();
    expect(screen.getByText('A fictional customer')).toBeInTheDocument();
    for (const name of ['Calibrate the call', 'About the customer', 'During the call']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
    expect(screen.getByRole('region', { name: 'The scenario core' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enter the call/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to the missions/ })).toHaveAttribute(
      'href',
      '/scenarios',
    );
  });

  it('goes back to the missions as they were opened from, but never to another address', async () => {
    renderSetup('/scenarios/team-workspace/setup', { from: '/scenarios?difficulty=challenge' });
    expect(await screen.findByRole('link', { name: /Back to the missions/ })).toHaveAttribute(
      'href',
      '/scenarios?difficulty=challenge',
    );
    cleanup();
    renderSetup('/scenarios/team-workspace/setup', { from: 'https://example.com/elsewhere' });
    expect(await screen.findByRole('link', { name: /Back to the missions/ })).toHaveAttribute(
      'href',
      '/scenarios',
    );
  });

  it('shows only what a trainee may know in the brief, whatever else the response carries', async () => {
    vi.mocked(api.scenarios).mockResolvedValue([
      Object.assign(makeScenario({ id: 'team-workspace' }), {
        hiddenFacts: [{ statement: 'SECRET-HIDDEN-FACT' }],
        evaluatorNotes: 'SECRET-EVALUATOR-NOTE',
        successCriteria: ['SECRET-CRITERIA'],
        curveballs: [{ statement: 'SECRET-CURVEBALL', trigger: { earliestTurn: 4 } }],
      }),
    ]);
    renderSetup();
    const brief = (await screen.findByText('The pre-call brief')).closest('details');
    expect(brief).not.toBeNull();

    expect(document.body.textContent).not.toMatch(/SECRET|earliest|trigger/i);
    const inside = within(brief as HTMLElement);
    expect(inside.getByText(workspace.brief.situation)).toBeInTheDocument();
    expect(inside.getByText(workspace.brief.goal)).toBeInTheDocument();
    expect(inside.getByText('Scoping & Discovery')).toBeInTheDocument();
    expect(inside.getByText('Empathy & De-escalation')).toBeInTheDocument();
    expect(
      inside.getByText('The customer, organisation and product are fictional.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/About 10 minutes/)).toBeInTheDocument();
  });

  it('keeps the honest reminders: fictional customer, end any time, practice feedback, how replies are made', async () => {
    vi.mocked(useAppConfig).mockReturnValue(
      appConfig({ notice: 'The live model could not be reached, so demo mode is in use.' }),
    );
    renderSetup();
    const reminders = within(await screen.findByRole('region', { name: 'Before you begin' }));
    expect(reminders.getByText(/Never type real customer names/)).toBeInTheDocument();
    expect(reminders.getByText('You can end the call at any time.')).toBeInTheDocument();
    expect(reminders.getByText(/practice, not a performance assessment/)).toBeInTheDocument();
    expect(reminders.getByText(/Demo mode/)).toBeInTheDocument();
    expect(reminders.getByText(/built-in rules engine, not an AI model/)).toBeInTheDocument();
    expect(
      reminders.getByText('The live model could not be reached, so demo mode is in use.'),
    ).toBeInTheDocument();
  });

  it('says so, in words, when the server cannot be reached', async () => {
    vi.mocked(useAppConfig).mockReturnValue(appConfig({}, { config: null, error: true }));
    renderSetup();
    const reminders = within(await screen.findByRole('region', { name: 'Before you begin' }));
    expect(reminders.getByText(/Server offline/)).toBeInTheDocument();
    expect(reminders.getByText(/could not confirm how replies are produced/)).toBeInTheDocument();
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
    expect(await difficulty()).toBeInTheDocument();
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
    expect(screen.queryByRole('button', { name: /Enter the call/ })).not.toBeInTheDocument();
  });

  it('copes with a library that is empty', async () => {
    vi.mocked(api.scenarios).mockResolvedValue([]);
    renderSetup('/practice');
    expect(await screen.findByText('No scenarios are available yet')).toBeInTheDocument();
  });

  it('copes with a very long title and a persona without a hurry to wrap', async () => {
    const long = 'A'.repeat(180);
    vi.mocked(api.scenarios).mockResolvedValue([
      makeScenario({ id: 'team-workspace', title: long }),
    ]);
    renderSetup();
    expect(await screen.findByRole('heading', { level: 1, name: long })).toBeInTheDocument();
    expect(screen.queryByLabelText('Scenario')).not.toBeInTheDocument();
    expect(await enterButton()).toBeInTheDocument();
  });
});

describe('Calibration: difficulty', () => {
  it('is a radio group with a legend, starting on the scenario as written', async () => {
    renderSetup();
    const group = await difficulty();
    expect(
      within(group)
        .getAllByRole('radio')
        .map((node) => node.getAttribute('value')),
    ).toEqual(['starter', 'standard', 'challenge']);
    expect(within(group).getByRole('radio', { name: 'Standard' })).toBeChecked();
    // The sentence under the row is what the chosen word does, and it describes the chosen radio.
    expect(within(group).getByRole('radio', { name: 'Standard' })).toHaveAccessibleDescription(
      /A balanced call: moderate ambiguity/,
    );
  });

  it('sets the difficulty override, marks the page customised and is what gets sent', async () => {
    const user = userEvent.setup();
    renderSetup();
    const group = await difficulty();
    expect(screen.queryByText('Customised')).not.toBeInTheDocument();

    await user.click(within(group).getByRole('radio', { name: 'Challenge' }));
    expect(within(group).getByRole('radio', { name: 'Challenge' })).toBeChecked();
    expect(screen.getByText('Customised')).toBeInTheDocument();
    expect(screen.getByText('Changed from the scenario: difficulty.')).toBeInTheDocument();
    expect(screen.getByText(/This describes the scenario as written/)).toBeInTheDocument();
    // Where the scenario was written to start is still said once it is not chosen.
    expect(within(group).getByRole('radio', { name: 'Challenge' })).toHaveAccessibleDescription(
      /Scenario default: Standard\./,
    );
    expect(readDraft()).toEqual({
      scenarioId: 'team-workspace',
      overrides: { difficulty: 'challenge' },
    });

    await user.click(await enterButton());
    await waitFor(() => expect(api.createSession).toHaveBeenCalled());
    expect(sent()).toEqual({
      scenarioId: 'team-workspace',
      overrides: { difficulty: 'challenge' },
      mode: 'immersive',
      clientRequestId: expect.stringMatching(/^[A-Za-z0-9_-]{8,64}$/),
    });
  });
});

describe('Calibration: every setting', () => {
  it('starts every setting on the scenario as written, with what each choice means', async () => {
    renderSetup();
    await difficulty();
    expect(screen.getByLabelText('Issue type')).toHaveValue('sign-in-access');
    expect(radio('Medium')).toBeChecked();
    expect(radio('Frustrated')).toBeChecked();
    expect(radio('Intermediate')).toBeChecked();
    expect(radio('Terse')).toBeChecked();
    expect(radio('First contact')).toBeChecked();
    // The chosen option's own sentence describes it.
    expect(radio('Medium')).toHaveAccessibleDescription(/Moderate pressure: a team is held up/);
    expect(radio('Terse')).toHaveAccessibleDescription(
      'A sparser conversation: short answers that share only what is asked.',
    );
    for (const legend of [
      'Business impact',
      'Customer temperature',
      'Technical proficiency',
      'Communication style',
      'Call stage',
      'Practice mode',
    ]) {
      expect(screen.getByRole('group', { name: legend })).toBeInTheDocument();
    }
  });

  it('offers only the issue types that have a scenario, labelled in words', async () => {
    renderSetup();
    await difficulty();
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
    await difficulty();

    await user.click(radio('High'));
    await user.click(radio('Angry / escalating'));
    await user.click(radio('Expert'));
    await user.click(radio('Non-native English speaker'));
    await user.click(radio('Escalated case'));

    expect(screen.getByText('Customised')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Changed from the scenario: business impact, customer temperature, technical proficiency, communication style, call stage.',
      ),
    ).toBeInTheDocument();
    expect(radio('High')).toHaveAccessibleDescription(/Scenario default: Medium\./);
    expect(readDraft().overrides).toEqual({
      impact: 'high',
      startingTemperature: 'angry',
      proficiency: 'expert',
      style: 'non-native',
      callStage: 'escalated',
    });

    await user.click(await enterButton());
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

  it('says what a change does to the call, in a polite live region', async () => {
    const user = userEvent.setup();
    renderSetup();
    await difficulty();
    await user.click(radio('Low'));
    expect(announced()).toContain(
      'Lower pressure: few people are affected and there is time to work through it.',
    );
    await user.click(radio('Escalated case'));
    expect(announced()).toContain('A long history: earlier contacts have not resolved it');
    // A difficulty change is one setting, and says what the chosen word does.
    await user.click(await screen.findByRole('radio', { name: 'Challenge' }));
    expect(announced()).toContain('A more demanding call');
  });

  it('turns the instrument as the settings change, in numbers and in words', async () => {
    const user = userEvent.setup();
    renderSetup();
    await difficulty();
    const core = within(screen.getByRole('region', { name: 'The scenario core' }));
    expect(core.getByText('standard, 2 rings')).toBeInTheDocument();
    expect(core.getByText(/frustrated/)).toBeInTheDocument();

    await user.click(radio('Challenge'));
    expect(core.getByText('challenge, 3 rings')).toBeInTheDocument();
    await user.click(radio('Starter'));
    expect(core.getByText('starter, 1 ring')).toBeInTheDocument();
    await user.click(radio('Calm'));
    expect(core.getByText(/calm/)).toBeInTheDocument();
    // What the customer holds back is never counted.
    expect(core.getByText(/still hidden/)).toBeInTheDocument();
    expect(core.queryByText(/\d+ hidden/)).not.toBeInTheDocument();
  });

  it('can put everything back to the scenario as written', async () => {
    const user = userEvent.setup();
    saveDraft({
      scenarioId: 'team-workspace',
      overrides: { impact: 'high', callStage: 'escalated', curveballs: [] },
    });
    renderSetup();
    await difficulty();
    expect(radio('High')).toBeChecked(); // restored from the draft
    expect(screen.getByRole('switch', { name: 'Curveballs' })).not.toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Reset to scenario defaults' }));
    expect(radio('Medium')).toBeChecked();
    expect(radio('First contact')).toBeChecked();
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
    await difficulty();
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

describe('Calibration: choosing the scenario', () => {
  it('lists the scenarios of the issue type when there are several, and starts from the one chosen', async () => {
    const user = userEvent.setup();
    renderSetup();
    await difficulty();
    const scenario = screen.getByLabelText('Scenario');
    expect(
      within(scenario)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual([lockedOut.title, workspace.title]);
    expect(screen.getByText(workspace.summary)).toBeInTheDocument();

    await user.selectOptions(scenario, 'locked-out');
    expect(screen.getByRole('heading', { level: 1, name: lockedOut.title })).toBeInTheDocument();
    expect(screen.getByText(/About 8 minutes/)).toBeInTheDocument();
    expect(
      screen.getByText('Scenario changed to Locked out after a password reset.', {
        selector: '[role=status]',
      }),
    ).toBeInTheDocument();
    expect(readDraft().scenarioId).toBe('locked-out');
    // Chosen on purpose, but the difficulty is the trainee's own: it stays Standard.
    expect(radio('Standard')).toBeChecked();
  });

  it('shows no scenario list for an issue type that has only one, and describes it under the issue', async () => {
    const user = userEvent.setup();
    renderSetup();
    await difficulty();
    await user.selectOptions(screen.getByLabelText('Issue type'), 'service-outage');
    expect(screen.queryByLabelText('Scenario')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Issue type')).toHaveAccessibleDescription(checkout.summary);
    expect(screen.getByRole('heading', { level: 1, name: checkout.title })).toBeInTheDocument();
  });

  it('picks the scenario of the new issue type that matches the chosen difficulty, else the gentlest', async () => {
    const user = userEvent.setup();
    renderSetup();
    const group = await difficulty();

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
    await difficulty();
    await user.click(radio('Low'));
    await user.selectOptions(screen.getByLabelText('Issue type'), 'service-outage');

    expect(radio('Low')).toBeChecked(); // changed by the trainee
    expect(radio('Angry / escalating')).toBeChecked(); // the outage's own
    expect(
      screen.getByText(
        'Scenario changed to Checkout is down and the clock is running. Your changes were kept.',
        { selector: '[role=status]' },
      ),
    ).toBeInTheDocument();
  });
});

describe('Calibration: curveballs', () => {
  it('is a real switch: off means none, and the choice is what gets sent', async () => {
    const user = userEvent.setup();
    renderSetup();
    await difficulty();
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

    await user.click(await enterButton());
    await waitFor(() => expect(api.createSession).toHaveBeenCalled());
    expect(sent()?.overrides).toEqual({ curveballs: [] });
  });

  it('lets the trainee choose which can happen, never more than the difficulty allows', async () => {
    const user = userEvent.setup();
    renderSetup();
    await difficulty();
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

    await user.click(await enterButton());
    await waitFor(() => expect(api.createSession).toHaveBeenCalled());
    expect(sent()?.overrides).toEqual({ curveballs: ['deadline'] });
  });

  it('is off for Starter until one is chosen, and switching it on ticks the first on offer', async () => {
    const user = userEvent.setup();
    renderSetup('/scenarios/locked-out/setup');
    await difficulty();
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
    const group = await difficulty();
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

describe('Calibration: practice mode', () => {
  it('is Guided or Immersive, following the difficulty until the trainee chooses', async () => {
    const user = userEvent.setup();
    renderSetup();
    const group = await screen.findByRole('group', { name: 'Practice mode' });
    expect(within(group).getByRole('radio', { name: 'Immersive' })).toBeChecked();
    expect(within(group).getByRole('radio', { name: 'Immersive' })).toHaveAccessibleDescription(
      /The customer behaves the same either way\. Default for Standard\./,
    );

    await user.click(within(await difficulty()).getByRole('radio', { name: 'Starter' }));
    expect(within(group).getByRole('radio', { name: 'Guided practice' })).toBeChecked();

    await user.click(within(group).getByRole('radio', { name: 'Immersive' }));
    expect(readDraft()).toMatchObject({ mode: 'immersive' });
    await user.click(within(await difficulty()).getByRole('radio', { name: 'Challenge' }));
    expect(within(group).getByRole('radio', { name: 'Immersive' })).toBeChecked();

    await user.click(within(group).getByRole('radio', { name: 'Guided practice' }));
    await user.click(await enterButton());
    await waitFor(() => expect(api.createSession).toHaveBeenCalled());
    expect(sent()?.mode).toBe('guided');
  });

  it('starts from the hints setting of the profile when it is on or off', async () => {
    saveProfile({ name: 'Priya Raman' });
    updatePreferences({ hints: 'on' });
    renderSetup();
    const group = await screen.findByRole('group', { name: 'Practice mode' });
    expect(within(group).getByRole('radio', { name: 'Guided practice' })).toBeChecked();
    expect(
      within(group).getByRole('radio', { name: 'Guided practice' }),
    ).toHaveAccessibleDescription(/From your settings\./);
  });
});

describe('Calibration: where it opens', () => {
  it('restores the draft for this scenario, ignoring anything invalid, and ignores one for another scenario', async () => {
    saveDraft({
      scenarioId: 'team-workspace',
      overrides: { startingTemperature: 'angry', style: 'not-a-style' },
      mode: 'guided',
    });
    renderSetup();
    await difficulty();
    expect(radio('Angry / escalating')).toBeChecked();
    expect(radio('Terse')).toBeChecked(); // the invalid style fell back
    expect(radio('Guided practice')).toBeChecked();
    expect(screen.getByText('Customised')).toBeInTheDocument();
    cleanup();

    saveDraft({ scenarioId: 'another-scenario', overrides: { impact: 'high' } });
    renderSetup();
    await difficulty();
    expect(radio('Medium')).toBeChecked();
    expect(screen.queryByText('Customised')).not.toBeInTheDocument();
  });

  it('does not save a draft just by being opened', async () => {
    renderSetup();
    await difficulty();
    expect(readDraft()).toBeNull();
  });

  it('opens the practice page on the draft that was saved, whichever scenario it is for', async () => {
    saveDraft({ scenarioId: 'checkout-down', overrides: { impact: 'low' } });
    renderSetup('/practice');
    await difficulty();
    expect(screen.getByRole('heading', { level: 1, name: checkout.title })).toBeInTheDocument();
    expect(radio('Low')).toBeChecked();
  });

  it('opens the practice page on the usual difficulty from the profile, and says why the scenario was suggested', async () => {
    saveProfile({ name: 'Priya Raman' });
    updatePreferences({ defaultDifficulty: 'challenge' });
    renderSetup('/practice');
    const group = await difficulty();
    expect(within(group).getByRole('radio', { name: 'Challenge' })).toBeChecked();
    // Of the two Challenge scenarios, the shorter one is the gentler first suggestion.
    expect(screen.getByRole('heading', { level: 1, name: checkout.title })).toBeInTheDocument();
    expect(screen.getByText(/Suggested for you\./)).toBeInTheDocument();
    expect(
      screen.getByText(/A gentle place to start: a Challenge call of about 12 minutes/),
    ).toBeInTheDocument();
    expect(screen.queryByText('Customised')).not.toBeInTheDocument();
  });

  it('works without a profile: it starts on Starter, with the shortest Starter scenario', async () => {
    renderSetup('/practice');
    const group = await difficulty();
    expect(within(group).getByRole('radio', { name: 'Starter' })).toBeChecked();
    expect(screen.getByRole('heading', { level: 1, name: lockedOut.title })).toBeInTheDocument();
  });

  it('still opens when the practice history cannot be read', async () => {
    vi.mocked(api.listSessions).mockRejectedValue(new ApiError(0, 'network', 'Offline.', true));
    vi.mocked(api.progress).mockRejectedValue(new ApiError(0, 'network', 'Offline.', true));
    renderSetup('/practice');
    await difficulty();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('does not read the practice history when a scenario was chosen', async () => {
    renderSetup('/scenarios/team-workspace/setup');
    await difficulty();
    expect(api.listSessions).not.toHaveBeenCalled();
  });
});

describe('Calibration: entering the call', () => {
  it('starts with one request id, keeps every choice after a failure and retries with the same id', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createSession)
      .mockRejectedValueOnce(new ApiError(0, 'network', "Can't reach Firefly right now.", true))
      .mockResolvedValueOnce(session('call-1'));
    renderSetup();
    await difficulty();
    await user.click(radio('High'));

    await user.click(await enterButton());
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Can't reach Firefly right now.");
    expect(alert).toHaveTextContent('Your choices are kept');
    expect(readDraft()).not.toBeNull();
    expect(radio('High')).toBeChecked();
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
    await difficulty();
    await user.click(await enterButton());
    await screen.findByRole('alert');

    await user.click(radio('Low'));
    await user.click(screen.getByRole('button', { name: /Enter the call/ }));
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('/calls/call-2'));
    expect(sent(1)?.clientRequestId).not.toBe(sent(0)?.clientRequestId);
    expect(sent(1)?.overrides).toEqual({ impact: 'low' });
  });

  it('starts one call when the button is pressed twice, says it is opening and locks the settings', async () => {
    const user = userEvent.setup();
    let finish: (value: SessionDTO) => void = () => undefined;
    vi.mocked(api.createSession).mockReturnValue(
      new Promise<SessionDTO>((resolve) => {
        finish = resolve;
      }),
    );
    renderSetup();
    await difficulty();

    await user.dblClick(await enterButton());
    expect(api.createSession).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Opening the call/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(
      screen.getByText('Starting your call…', { selector: '[role=status]' }),
    ).toBeInTheDocument();
    expect(radio('High')).toBeDisabled();

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
    await difficulty();
    await user.click(await enterButton());
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
    await difficulty();
    await user.click(await enterButton());
    const alert = await screen.findByRole('alert');
    expect(within(alert).queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    await waitFor(() => expect(alert).toHaveFocus());
  });
});

describe('Calibration: the opening of the call', () => {
  it('names the customer while the call is really being created, then opens the call with the name', async () => {
    const user = userEvent.setup();
    let finish: (value: SessionDTO) => void = () => undefined;
    vi.mocked(api.createSession).mockReturnValue(
      new Promise<SessionDTO>((resolve) => {
        finish = resolve;
      }),
    );
    const router = renderSetup();
    await difficulty();
    await user.click(await enterButton());

    // No staged steps and nothing to skip: the page says what is true, which is that it is opening.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Maya Okafor' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Opening the call.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Enter the call/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Difficulty' })).not.toBeInTheDocument();
    expect(screen.getByTestId('url')).toHaveTextContent('/scenarios/team-workspace/setup');

    await act(async () => finish(session('call-7')));
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('/calls/call-7'));
    expect(router.state.location.state).toEqual({
      customer: { name: 'Maya Okafor', role: 'IT administrator, Northwind Foods' },
    });
  });

  it('shows nothing extra when the answer is quick', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createSession).mockResolvedValue(session('call-9'));
    renderSetup();
    await difficulty();
    await user.click(await enterButton());
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('/calls/call-9'));
    expect(screen.queryByText('Opening the call.')).not.toBeInTheDocument();
  });

  it('goes away and keeps every choice when the call cannot be started', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createSession).mockImplementation(
      () =>
        new Promise<SessionDTO>((_resolve, reject) => {
          setTimeout(
            () => reject(new ApiError(0, 'network', "Can't reach Firefly right now.", true)),
            600,
          );
        }),
    );
    renderSetup();
    await difficulty();
    await user.click(radio('High'));
    await user.click(await enterButton());
    await screen.findByText('Opening the call.');

    const alert = await screen.findByRole('alert');
    expect(screen.queryByText('Opening the call.')).not.toBeInTheDocument();
    expect(radio('High')).toBeChecked();
    expect(readDraft()).not.toBeNull();
    await waitFor(() => expect(within(alert).getByRole('button', { name: 'Retry' })).toHaveFocus());
  });
});
