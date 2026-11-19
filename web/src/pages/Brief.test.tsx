import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfigDTO, SessionDTO } from '#shared/domain/api.ts';
import { makeScenario } from '../components/scenario/scenario-fixtures.ts';
import type * as ApiModule from '../lib/api.ts';
import { ApiError, api } from '../lib/api.ts';
import { useAppConfig } from '../lib/config.tsx';
import { ThemeProvider } from '../lib/theme.tsx';
import Brief from './Brief.tsx';

vi.mock('../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, api: { scenario: vi.fn(), createSession: vi.fn() } };
});
vi.mock('../lib/config.tsx', () => ({ useAppConfig: vi.fn() }));

const scenario = makeScenario({ id: 'team-workspace' });
const session = (id: string) => ({ id }) as SessionDTO;

function appConfig(
  provider: Partial<AppConfigDTO['provider']> = {},
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
  };
}

function Probe() {
  const location = useLocation();
  return <p data-testid="url">{`${location.pathname}${location.search}`}</p>;
}

function renderBrief() {
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/scenarios/team-workspace/brief']}>
        <Probe />
        <Routes>
          <Route path="/scenarios/:id/brief" element={<Brief />} />
          <Route path="/scenarios/:id/setup" element={<p>Setup page</p>} />
          <Route path="/calls/:id" element={<p>Call page</p>} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

const saveDraft = (overrides: object, scenarioId = 'team-workspace') =>
  sessionStorage.setItem('firefly.draft', JSON.stringify({ scenarioId, overrides }));
const readDraft = () => JSON.parse(sessionStorage.getItem('firefly.draft') ?? 'null');
const beginButton = () => screen.findByRole('button', { name: /Begin call/ });

beforeEach(() => {
  sessionStorage.clear();
  // Most of these tests are about starting a call, not about the launch moment (which reduced motion skips).
  localStorage.setItem('firefly.motion', JSON.stringify('reduce'));
  vi.mocked(api.scenario).mockResolvedValue(scenario);
  vi.mocked(useAppConfig).mockReturnValue(appConfig());
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Brief', () => {
  it('begins the call with one request id, keeps every choice after a failure and retries with the same id', async () => {
    const user = userEvent.setup();
    saveDraft({ difficulty: 'challenge', impact: 'high' });
    vi.mocked(api.createSession)
      .mockRejectedValueOnce(new ApiError(0, 'network', "Can't reach Firefly right now.", true))
      .mockResolvedValueOnce(session('call-1'));
    renderBrief();

    await user.click(await beginButton());
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Can't reach Firefly right now.");
    expect(alert).toHaveTextContent('Your choices are kept');
    expect(readDraft()).not.toBeNull();

    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('/calls/call-1'));

    const [first, second] = vi.mocked(api.createSession).mock.calls.map(([request]) => request);
    expect(first).toEqual({
      scenarioId: 'team-workspace',
      overrides: { difficulty: 'challenge', impact: 'high' },
      mode: 'immersive',
      clientRequestId: expect.stringMatching(/^[A-Za-z0-9_-]{8,64}$/),
    });
    expect(second?.clientRequestId).toBe(first?.clientRequestId);
    expect(readDraft()).toBeNull();
  });

  it('starts one call when the button is pressed twice and says it is starting', async () => {
    const user = userEvent.setup();
    let finish: (value: SessionDTO) => void = () => undefined;
    vi.mocked(api.createSession).mockReturnValue(
      new Promise<SessionDTO>((resolve) => {
        finish = resolve;
      }),
    );
    renderBrief();

    const button = await beginButton();
    await user.dblClick(button);
    expect(api.createSession).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    expect(
      screen.getByText('Starting your call…', { selector: '[role=status]' }),
    ).toBeInTheDocument();

    await act(async () => finish(session('call-2')));
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('/calls/call-2'));
  });

  it('sends only valid choices from this scenario draft', async () => {
    const user = userEvent.setup();
    saveDraft({ impact: 'high', style: 'shouty', curveballs: ['ask-manager', 'not-real'] });
    vi.mocked(api.createSession).mockResolvedValue(session('call-3'));
    renderBrief();
    await user.click(await beginButton());
    await waitFor(() => expect(api.createSession).toHaveBeenCalled());
    expect(vi.mocked(api.createSession).mock.calls[0]?.[0].overrides).toEqual({
      impact: 'high',
      curveballs: ['ask-manager'],
    });

    cleanup();
    vi.mocked(api.createSession).mockClear();
    saveDraft({ impact: 'high' }, 'some-other-scenario');
    renderBrief();
    await user.click(await beginButton());
    await waitFor(() => expect(api.createSession).toHaveBeenCalled());
    expect(vi.mocked(api.createSession).mock.calls[0]?.[0].overrides).toEqual({});
  });

  it('shows only what a trainee may know, whatever else the response carries', async () => {
    vi.mocked(api.scenario).mockResolvedValue(
      Object.assign(makeScenario({ id: 'team-workspace' }), {
        hiddenFacts: [{ statement: 'SECRET-HIDDEN-FACT' }],
        evaluatorNotes: 'SECRET-EVALUATOR-NOTE',
        successCriteria: ['SECRET-CRITERIA'],
        curveballs: [{ statement: 'SECRET-CURVEBALL', trigger: { earliestTurn: 4 } }],
      }),
    );
    renderBrief();
    await screen.findByRole('heading', { level: 1, name: scenario.title });

    expect(document.body.textContent).not.toMatch(/SECRET|earliest|trigger/i);
    expect(screen.getByText(scenario.summary)).toBeInTheDocument();
    expect(screen.getByText(scenario.brief.situation)).toBeInTheDocument();
    expect(screen.getByText(scenario.brief.goal)).toBeInTheDocument();
    expect(
      screen.getByText('The customer, organisation and product are fictional.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Maya Okafor')).toBeInTheDocument();
    expect(screen.getByText('About 10 minutes')).toBeInTheDocument();
    expect(screen.getByText(/Scoping & Discovery/)).toBeInTheDocument();
  });

  it('marks what was changed from the scenario in words', async () => {
    saveDraft({ startingTemperature: 'angry' });
    renderBrief();
    const settings = await screen.findByRole('region', { name: 'Settings for this call' });
    expect(within(settings).getByText('Angry / escalating')).toBeInTheDocument();
    expect(within(settings).getByText('Changed from default')).toBeInTheDocument();
    expect(within(settings).getByText('Scenario default: Frustrated')).toBeInTheDocument();
  });

  it('defaults the practice mode to the difficulty and remembers a change', async () => {
    const user = userEvent.setup();
    renderBrief();
    expect(await screen.findByRole('radio', { name: 'Immersive' })).toBeChecked();
    expect(screen.getByText('Default for Standard')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Guided practice' }));
    expect(readDraft()).toEqual({ scenarioId: 'team-workspace', overrides: {}, mode: 'guided' });
    cleanup();

    saveDraft({ difficulty: 'starter' });
    renderBrief();
    expect(await screen.findByRole('radio', { name: 'Guided practice' })).toBeChecked();
  });

  it('labels demo mode plainly and shows a notice from the server', async () => {
    vi.mocked(useAppConfig).mockReturnValue(
      appConfig({ notice: 'The live model could not be reached, so demo mode is in use.' }),
    );
    renderBrief();
    await screen.findByRole('heading', { name: 'Before you begin' });
    expect(screen.getByText(/Demo mode/)).toBeInTheDocument();
    expect(screen.getByText(/built-in rules engine, not an AI model/)).toBeInTheDocument();
    expect(
      screen.getByText('The live model could not be reached, so demo mode is in use.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Don't type real customer names/)).toBeInTheDocument();
  });

  it('says what went wrong when the brief cannot be loaded and lets you try again', async () => {
    const user = userEvent.setup();
    vi.mocked(api.scenario)
      .mockRejectedValueOnce(new ApiError(0, 'network', "Can't reach Firefly right now.", true))
      .mockResolvedValueOnce(scenario);
    renderBrief();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Can't reach Firefly right now.");
    await user.click(within(alert).getByRole('button', { name: /Try again/ }));
    expect(await beginButton()).toBeInTheDocument();
  });

  it('offers a way back when the scenario does not exist', async () => {
    vi.mocked(api.scenario).mockRejectedValue(
      new ApiError(404, 'not_found', 'That scenario was not found.', false),
    );
    renderBrief();
    expect(
      await screen.findByRole('heading', { level: 1, name: "We couldn't find that scenario" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Begin call/ })).not.toBeInTheDocument();
  });
});

describe('Brief: the call launch', () => {
  beforeEach(() => localStorage.setItem('firefly.motion', JSON.stringify('full')));

  it('shows the launch moment while the call is created, then opens the call', async () => {
    const user = userEvent.setup();
    let finish: (value: SessionDTO) => void = () => undefined;
    vi.mocked(api.createSession).mockReturnValue(
      new Promise<SessionDTO>((resolve) => {
        finish = resolve;
      }),
    );
    renderBrief();
    await user.click(await beginButton());

    const dialog = await screen.findByRole('dialog', { name: 'Starting your call' });
    expect(dialog).toHaveTextContent('Scenario locked');
    // Nothing says "line open" until the call really exists, and the page has not moved on.
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(dialog).not.toHaveTextContent('Line open');
    expect(screen.getByTestId('url')).toHaveTextContent('/scenarios/team-workspace/brief');

    await act(async () => finish(session('call-7')));
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('/calls/call-7'), {
      timeout: 3000,
    });
    expect(api.createSession).toHaveBeenCalledTimes(1);
  });

  it('can be skipped from the keyboard', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createSession).mockResolvedValue(session('call-8'));
    renderBrief();
    await user.click(await beginButton());
    await screen.findByRole('dialog', { name: 'Starting your call' });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('/calls/call-8'), {
      timeout: 1500,
    });
  });

  it('goes away and keeps every choice when the call cannot be started', async () => {
    const user = userEvent.setup();
    saveDraft({ impact: 'high' });
    vi.mocked(api.createSession).mockRejectedValue(
      new ApiError(0, 'network', "Can't reach Firefly right now.", true),
    );
    renderBrief();
    await user.click(await beginButton());
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Can't reach Firefly right now.");
    expect(screen.queryByRole('dialog', { name: 'Starting your call' })).not.toBeInTheDocument();
    expect(readDraft()).not.toBeNull();
    expect(screen.getByTestId('url')).toHaveTextContent('/scenarios/team-workspace/brief');
  });

  it('is never shown when reduced motion is asked for', async () => {
    localStorage.setItem('firefly.motion', JSON.stringify('reduce'));
    const user = userEvent.setup();
    vi.mocked(api.createSession).mockResolvedValue(session('call-9'));
    renderBrief();
    await user.click(await beginButton());
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('/calls/call-9'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
