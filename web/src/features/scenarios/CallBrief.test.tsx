import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicScenarioDTO, SessionDTO } from '#shared/domain/api.ts';
import { CURVEBALL_LABELS } from '#shared/domain/vocab.ts';
import { getScenarioLibrary } from '#server/scenarios/index.ts';
import { ApiError, api } from '../../lib/api.ts';
import type * as ApiModule from '../../lib/api.ts';
import { detectFeatures, type VoiceFeatures } from '../voice/support.ts';
import type * as SupportModule from '../voice/support.ts';
import {
  AZURE_SPEECH,
  DEMO_SPEECH,
  NO_SPEECH,
  SAMPLE,
  appConfig,
  scenarioById,
} from './testing/fixtures.ts';
import { mockApi, networkError, renderApp, stubOnline } from './testing/harness.tsx';

vi.mock('../../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return {
    ...actual,
    api: {
      config: vi.fn(),
      scenarios: vi.fn(),
      scenario: vi.fn(),
      createSession: vi.fn(),
      listSessions: vi.fn(),
    },
  };
});

vi.mock('../voice/support.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof SupportModule>();
  return { ...actual, detectFeatures: vi.fn() };
});

const FULL_BROWSER: VoiceFeatures = {
  secureContext: true,
  microphone: true,
  audioContext: true,
  worklet: true,
  recognition: true,
  synthesis: true,
  audioElement: true,
};

function browser(overrides: Partial<VoiceFeatures> = {}) {
  vi.mocked(detectFeatures).mockReturnValue({ ...FULL_BROWSER, ...overrides });
}

beforeEach(() => {
  mockApi();
  browser();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const standard = scenarioById(SAMPLE.standard);
const briefPath = (query = '') => `/scenarios/${SAMPLE.standard}/brief${query}`;

/** The value beside a term in the support case. */
const valueOf = async (term: string) => {
  const dt = await screen.findByText(term, { selector: 'dt' });
  return dt.nextElementSibling as HTMLElement;
};

const session = (id: string) => ({ id }) as unknown as SessionDTO;

describe('the support case', () => {
  it('shows the case for the scenario and the settings in the address', async () => {
    renderApp(
      briefPath('?difficulty=starter&impact=high&stage=follow-up&temperature=angry&hints=off'),
    );
    const customer = await valueOf('Customer');
    expect(screen.getByRole('heading', { level: 1, name: 'Call brief' })).toBeVisible();
    expect(screen.getByText(standard.title)).toBeVisible();

    expect(customer).toHaveTextContent('Daniel Osei');
    expect(customer).toHaveTextContent('Project lead, Proseware Consulting');
    expect(customer).toHaveTextContent('Fictional customer');
    expect(await valueOf('Issue summary')).toHaveTextContent(standard.summary);

    const situation = await valueOf('Situation');
    expect(situation).toHaveTextContent(standard.brief.situation);
    expect(situation).toHaveTextContent(standard.stageBriefs['follow-up']);

    const impact = await valueOf('Business impact');
    expect(impact).toHaveTextContent('High');
    expect(impact).toHaveTextContent('Production outage or broad impact.');
    expect(await valueOf('Call stage')).toHaveTextContent('Follow-up on an open case');
    expect(await valueOf("Customer's starting state")).toHaveTextContent('Angry / escalating');
    expect(await valueOf("Customer's starting state")).toHaveTextContent(
      'Upset, quick to escalate, needs to feel heard.',
    );
    expect(await valueOf('Your objective')).toHaveTextContent(standard.brief.goal);
    for (const rule of standard.brief.groundRules) {
      expect(await valueOf('Ground rules')).toHaveTextContent(rule);
    }
    expect(await valueOf('Difficulty')).toHaveTextContent('Starter');
    expect(await valueOf('Difficulty')).toHaveTextContent('Clearer clues');
    expect(await valueOf('Expected duration')).toHaveTextContent('About 10 minutes');
    expect(await valueOf('Live hints')).toHaveTextContent('Off');
    expect(await valueOf('Complications')).toHaveTextContent('No complications are set.');
  });

  it('says only that there may be an unexpected turn, never which', async () => {
    renderApp(briefPath('?difficulty=challenge&curveballs=ask-manager,deadline'));
    expect(await valueOf('Complications')).toHaveTextContent(
      'This call may include an unexpected turn.',
    );
    const text = document.body.textContent ?? '';
    for (const { label, description } of Object.values(CURVEBALL_LABELS)) {
      expect(text).not.toContain(label);
      expect(text).not.toContain(description);
    }
  });

  it('shows areas worth exploring only when live hints are on', async () => {
    renderApp(briefPath('?hints=on'));
    const areas = await valueOf('Areas worth exploring');
    for (const area of standard.expectedDiscoveryAreas) expect(areas).toHaveTextContent(area);
    cleanup();

    renderApp(briefPath());
    await valueOf('Live hints');
    expect(screen.queryByText('Areas worth exploring', { selector: 'dt' })).not.toBeInTheDocument();
  });

  it('never shows what the customer keeps back, the evaluation, or what the unexpected turn says', async () => {
    const definition = getScenarioLibrary().find((s) => s.id === SAMPLE.challenge);
    if (!definition) throw new Error('missing scenario');
    renderApp(
      `/scenarios/${SAMPLE.challenge}/brief?difficulty=challenge&hints=on&curveballs=ask-manager,deadline`,
    );
    await valueOf('Live hints');
    const page = document.body.textContent ?? '';

    const secrets = [
      ...definition.hiddenFacts.flatMap((fact) => [
        fact.statement,
        fact.partialStatement,
        fact.revealWhen,
        fact.betterQuestion,
        fact.missedConsequence,
        fact.hint,
      ]),
      ...definition.curveballs.flatMap((c) => [c.statement, c.followUp, c.expectedResponse]),
      definition.evaluatorNotes,
      definition.expectedOutcome,
      definition.customerObjective,
      ...definition.successCriteria,
      ...definition.poorApproaches,
      ...definition.goodBehaviours,
    ].filter((text): text is string => typeof text === 'string' && text.length > 20);
    expect(secrets.length).toBeGreaterThan(10);
    for (const secret of secrets) expect(page).not.toContain(secret);
    expect(page).not.toMatch(/score|rubric|criteria|trigger/i);
  });

  it('links back to the scenario with the settings, in the page and in the actions', async () => {
    renderApp(briefPath('?difficulty=challenge&hints=on'));
    await valueOf('Live hints');
    const links = screen.getAllByRole('link', { name: 'Edit scenario' });
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const link of links) {
      expect(link).toHaveAttribute(
        'href',
        `/scenarios?scenario=${SAMPLE.standard}&difficulty=challenge&hints=on`,
      );
    }
  });

  it('ignores settings it cannot use, and says so', async () => {
    renderApp(briefPath('?difficulty=extreme&hints=maybe&impact=low'));
    const note = await screen.findByText(/Some settings in this link could not be used/);
    expect(note).toHaveTextContent('Difficulty, Live hints');
    expect(await valueOf('Difficulty')).toHaveTextContent('Standard');
    expect(await valueOf('Business impact')).toHaveTextContent('Low');
  });

  it('shows the situation when the server sends no stage notes', async () => {
    const { stageBriefs: _omitted, ...stale } = standard;
    vi.mocked(api.scenario).mockResolvedValue(stale as unknown as PublicScenarioDTO);
    renderApp(briefPath('?stage=follow-up'));
    const situation = await valueOf('Situation');
    expect(situation).toHaveTextContent(standard.brief.situation);
    expect(situation).not.toHaveTextContent(standard.stageBriefs['follow-up']);
    expect(await valueOf('Call stage')).toHaveTextContent('Follow-up on an open case');
  });

  it('shows placeholders while the scenario loads', async () => {
    vi.mocked(api.scenario).mockReturnValue(new Promise(() => undefined));
    renderApp(briefPath());
    expect(await screen.findByRole('heading', { level: 1, name: 'Call brief' })).toBeVisible();
    expect(screen.queryByText('Customer', { selector: 'dt' })).not.toBeInTheDocument();
  });

  it('is a designed "Scenario unavailable" state for an unknown scenario', async () => {
    renderApp('/scenarios/not-a-scenario/brief');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Scenario unavailable' }),
    ).toBeVisible();
    expect(screen.getByText(/Nothing was started/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Choose a scenario' })).toHaveAttribute(
      'href',
      '/scenarios',
    );
    expect(screen.queryByRole('button', { name: /Start/ })).not.toBeInTheDocument();
  });

  it('says what happened when the scenario cannot be loaded, and tries again', async () => {
    const user = userEvent.setup();
    vi.mocked(api.scenario).mockRejectedValueOnce(networkError());
    renderApp(briefPath());
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The scenario could not be loaded');
    expect(alert).toHaveTextContent('Nothing was started');
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await valueOf('Customer')).toBeInTheDocument();
  });

  it('says so when the browser is offline', async () => {
    stubOnline(false);
    vi.mocked(api.scenario).mockRejectedValueOnce(networkError());
    renderApp(briefPath());
    expect(await screen.findByRole('alert')).toHaveTextContent('You are offline');
  });
});

describe('the microphone and privacy explainer', () => {
  const explainer = async () => {
    await valueOf('Customer');
    return screen.getByRole('complementary', { name: 'Before you start' });
  };

  it('always says to speak or type, when the microphone opens and that it can be muted', async () => {
    renderApp(briefPath());
    const panel = await explainer();
    expect(within(panel).getByText('Speak, or type.')).toBeVisible();
    expect(panel).toHaveTextContent(
      'When you start a voice call, your browser asks to use your microphone. Firefly opens it only during the call and you can mute or stop it at any time.',
    );
    expect(
      within(panel).getByRole('link', { name: 'How Firefly uses AI and speech' }),
    ).toHaveAttribute('href', '/responsible-ai');
  });

  it('says speech goes through Firefly to the speech provider, when the server can transcribe', async () => {
    mockApi({ config: appConfig({ speech: AZURE_SPEECH }) });
    renderApp(briefPath());
    const panel = await explainer();
    await waitFor(() =>
      expect(panel).toHaveTextContent(
        'Your speech is sent through Firefly to Azure AI Speech and turned into text. Firefly does not store the audio.',
      ),
    );
    expect(panel).toHaveTextContent(
      "The customer's voice is synthetic, generated by Azure AI Speech.",
    );
    expect(screen.getByRole('button', { name: 'Start voice call' })).toBeVisible();
  });

  it("says the browser's speech recognition does it, when the server cannot", async () => {
    renderApp(briefPath());
    const panel = await explainer();
    await waitFor(() =>
      expect(panel).toHaveTextContent(
        "Your browser's speech recognition turns your speech into text. In Chrome and Edge the browser's own speech service may process your audio. Firefly receives text only and does not store audio.",
      ),
    );
    expect(panel).toHaveTextContent("The customer's voice is synthetic, spoken by your browser.");
    expect(screen.getByRole('button', { name: 'Start voice call' })).toBeVisible();
  });

  it('says voice is not available, and leads with a text call, when nothing can listen', async () => {
    browser({
      recognition: false,
      microphone: false,
      audioContext: false,
      worklet: false,
      synthesis: false,
    });
    renderApp(briefPath());
    const panel = await explainer();
    await waitFor(() =>
      expect(panel).toHaveTextContent(
        'Voice input is not available in this browser. You can type the whole call.',
      ),
    );
    expect(panel).toHaveTextContent("This browser cannot speak the customer's replies");
    expect(screen.queryByRole('button', { name: 'Start voice call' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Start a text-only call' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start text call' })).toBeVisible();
  });

  it('says why when the page is not secure', async () => {
    browser({ secureContext: false });
    renderApp(briefPath());
    const panel = await explainer();
    await waitFor(() => expect(panel).toHaveTextContent('not on a secure (https) connection'));
    expect(screen.getByRole('button', { name: 'Start text call' })).toBeVisible();
  });

  it('is honest that demo speech does not understand audio', async () => {
    mockApi({ config: appConfig({ speech: DEMO_SPEECH }) });
    renderApp(briefPath());
    const panel = await explainer();
    await waitFor(() => expect(panel).toHaveTextContent('Demo speech (scripted)'));
    expect(panel).toHaveTextContent('does not understand audio');
    expect(panel).toHaveTextContent('Firefly does not store the audio.');
    expect(panel).toHaveTextContent('plays a short soft sound');
  });

  it('says whether the customer is the built-in rules engine or a live model', async () => {
    renderApp(briefPath());
    const demo = await explainer();
    await waitFor(() =>
      expect(demo).toHaveTextContent(
        "Demo mode: the customer is played by Firefly's built-in rules engine.",
      ),
    );
    cleanup();

    mockApi({
      config: appConfig({
        provider: {
          kind: 'azure-openai',
          label: 'Azure OpenAI (gpt-4.1)',
          demo: false,
          notice: null,
        },
      }),
    });
    renderApp(briefPath());
    const live = await explainer();
    await waitFor(() => expect(live).toHaveTextContent('Live model: Azure OpenAI (gpt-4.1).'));
    expect(live).not.toHaveTextContent('Demo mode');
  });

  it('shows what the server says is wrong with speech', async () => {
    mockApi({
      config: appConfig({
        speech: { ...NO_SPEECH, notice: 'Azure speech is not fully configured.' },
      }),
    });
    renderApp(briefPath());
    const panel = await explainer();
    await waitFor(() => expect(panel).toHaveTextContent('Azure speech is not fully configured.'));
  });

  it("offers only a text call, and a retry, when the server's settings cannot be loaded", async () => {
    const user = userEvent.setup();
    vi.mocked(api.config).mockRejectedValueOnce(networkError());
    renderApp(briefPath());
    const panel = await explainer();
    expect(await within(panel).findByText('Speech settings could not be loaded')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Start voice call' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start text call' })).toBeVisible();

    await user.click(within(panel).getByRole('button', { name: 'Try again' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Start voice call' })).toBeVisible(),
    );
  });
});

describe('starting a call', () => {
  const idPattern = /^[A-Za-z0-9_-]{8,64}$/;

  beforeEach(() => {
    vi.mocked(api.createSession).mockResolvedValue(session('call-0001'));
  });

  const startVoice = async () => screen.findByRole('button', { name: 'Start voice call' });

  it('creates the call once and opens it as a voice call', async () => {
    const user = userEvent.setup();
    const app = renderApp(briefPath('?difficulty=challenge&hints=on&curveballs=deadline'));
    await user.click(await startVoice());

    await waitFor(() => expect(app.where()).toBe('/calls/call-0001?input=voice'));
    expect(api.createSession).toHaveBeenCalledTimes(1);
    const request = vi.mocked(api.createSession).mock.calls[0]?.[0];
    expect(request).toMatchObject({
      scenarioId: SAMPLE.standard,
      overrides: { difficulty: 'challenge', curveballs: ['deadline'] },
      mode: 'guided',
    });
    expect(request?.clientRequestId).toMatch(idPattern);
  });

  it('sends nothing but what changed, and the practice mode', async () => {
    const user = userEvent.setup();
    renderApp(briefPath());
    await user.click(await startVoice());
    await waitFor(() => expect(api.createSession).toHaveBeenCalled());
    expect(vi.mocked(api.createSession).mock.calls[0]?.[0]).toMatchObject({
      scenarioId: SAMPLE.standard,
      overrides: {},
      mode: 'immersive',
    });
  });

  it('opens a text-only call from the quieter action', async () => {
    const user = userEvent.setup();
    const app = renderApp(briefPath());
    await user.click(await screen.findByRole('button', { name: 'Start a text-only call' }));
    await waitFor(() => expect(app.where()).toBe('/calls/call-0001?input=text'));
  });

  it('opens a typed call when voice is not available', async () => {
    browser({ recognition: false, microphone: false });
    const user = userEvent.setup();
    const app = renderApp(briefPath());
    await user.click(await screen.findByRole('button', { name: 'Start text call' }));
    await waitFor(() => expect(app.where()).toBe('/calls/call-0001?input=text'));
  });

  it('never creates two calls from a double click', async () => {
    const user = userEvent.setup();
    const app = renderApp(briefPath());
    await user.dblClick(await startVoice());
    await waitFor(() => expect(app.where()).toBe('/calls/call-0001?input=voice'));
    expect(api.createSession).toHaveBeenCalledTimes(1);
  });

  it('shows the wait, and leaves the other actions alone until it ends', async () => {
    const user = userEvent.setup();
    let finish: (value: SessionDTO) => void = () => undefined;
    vi.mocked(api.createSession).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const app = renderApp(briefPath());
    const button = await startVoice();
    await user.click(button);

    await waitFor(() => expect(button).toHaveAttribute('aria-busy', 'true'));
    expect(screen.getByRole('button', { name: 'Start a text-only call' })).toBeDisabled();
    expect(screen.getAllByRole('link', { name: 'Edit scenario' }).at(-1)).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    await user.click(button);
    expect(api.createSession).toHaveBeenCalledTimes(1);

    finish(session('call-0002'));
    await waitFor(() => expect(app.where()).toBe('/calls/call-0002?input=voice'));
  });

  it('says what happened, that nothing was started, and retries with the same request', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createSession).mockRejectedValueOnce(networkError());
    const app = renderApp(briefPath());
    await user.click(await startVoice());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Firefly could not be reached.');
    expect(alert).toHaveTextContent('Nothing was started.');
    expect(app.where()).toBe(briefPath());

    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(app.where()).toBe('/calls/call-0001?input=voice'));
    expect(api.createSession).toHaveBeenCalledTimes(2);
    const first = vi.mocked(api.createSession).mock.calls[0]?.[0];
    const second = vi.mocked(api.createSession).mock.calls[1]?.[0];
    expect(second?.clientRequestId).toBe(first?.clientRequestId);
  });

  it('retries a text call as a text call', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createSession).mockRejectedValueOnce(networkError());
    const app = renderApp(briefPath());
    await user.click(await screen.findByRole('button', { name: 'Start a text-only call' }));
    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(app.where()).toBe('/calls/call-0001?input=text'));
  });

  it('says so when the browser is offline', async () => {
    stubOnline(false);
    const user = userEvent.setup();
    vi.mocked(api.createSession).mockRejectedValueOnce(networkError());
    renderApp(briefPath());
    await user.click(await startVoice());
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('You are offline.');
    expect(alert).toHaveTextContent('Reconnect, then try again.');
  });

  it('says when calls are being started too fast', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createSession).mockRejectedValueOnce(
      new ApiError(429, 'rate_limited', 'Slow down.', true),
    );
    renderApp(briefPath());
    await user.click(await startVoice());
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Too many calls were started in a short time.');
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeVisible();
  });

  it('offers a way out instead of a retry when retrying cannot help', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createSession).mockRejectedValueOnce(
      new ApiError(404, 'not_found', 'That scenario could not be found.', false),
    );
    renderApp(briefPath());
    await user.click(await startVoice());
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('This scenario is no longer available.');
    expect(within(alert).queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    expect(within(alert).getByRole('link', { name: 'Choose another scenario' })).toHaveAttribute(
      'href',
      '/scenarios',
    );
    expect(screen.getByRole('button', { name: 'Start voice call' })).toBeEnabled();
  });
});
