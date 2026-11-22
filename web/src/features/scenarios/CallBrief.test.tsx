import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionDTO } from '#shared/domain/api.ts';
import { wordCount } from '#shared/domain/scenario.ts';
import { VOICE_CHOICES, VOICE_PREVIEW_TEXT } from '#shared/domain/voices.ts';
import { ApiError, api } from '../../lib/api.ts';
import type * as ApiModule from '../../lib/api.ts';
import { MicrophoneError } from '../voice/capture/types.ts';
import { acquireMicrophone, type MicrophoneHandle } from '../voice/capture/microphone.ts';
import type * as MicrophoneModule from '../voice/capture/microphone.ts';
import { detectFeatures, type VoiceFeatures } from '../voice/support.ts';
import type * as SupportModule from '../voice/support.ts';
import { fakeVoice, installFakes, type FakeEnv } from '../voice/testing/fakes.ts';
import { MICROPHONE_NOTICE, PRIVACY_DETAILS_LABEL } from './privacy.ts';
import {
  AZURE_SHARED_SPEECH,
  AZURE_SPEECH,
  DEMO_SPEECH,
  NO_SPEECH,
  OLD_SERVER_SPEECH,
  SAMPLE,
  appConfig,
  scenarioById,
} from './testing/fixtures.ts';
import { mockApi, networkError, renderApp, stubOnline } from './testing/harness.tsx';
import { defaultVoiceFor } from './voice-choice.ts';

vi.mock('../../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return {
    ...actual,
    api: { config: vi.fn(), scenarios: vi.fn(), scenario: vi.fn(), createSession: vi.fn() },
  };
});
vi.mock('../voice/support.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof SupportModule>();
  return { ...actual, detectFeatures: vi.fn() };
});
vi.mock('../voice/capture/microphone.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof MicrophoneModule>();
  return { ...actual, acquireMicrophone: vi.fn() };
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
  window.localStorage.clear();
  mockApi();
  browser();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.mocked(acquireMicrophone).mockReset();
});

const standard = scenarioById(SAMPLE.standard);
const briefPath = (query = '', id: string = SAMPLE.standard) => `/scenarios/${id}/brief${query}`;

/** The value beside a term in the support case. */
const valueOf = async (term: string) => {
  const dt = await screen.findByText(term, { selector: 'dt' });
  return dt.nextElementSibling as HTMLElement;
};

const session = (id: string) => ({ id }) as unknown as SessionDTO;
const startVoice = () => screen.findByRole('button', { name: 'Start voice call' });

describe('the support case', () => {
  it('is exactly six rows, in this order, and a heading', async () => {
    renderApp(briefPath());
    const terms = await screen.findAllByRole('term');
    expect(terms.map((term) => term.textContent)).toEqual([
      'Customer',
      'Product',
      'Issue',
      'Impact',
      'Call stage',
      'Objective',
    ]);
    expect(screen.getByRole('heading', { level: 1, name: 'Case brief' })).toBeVisible();
    expect(screen.getByText(standard.title)).toBeVisible();
  });

  it('shows the customer, the product, the issue, the impact, the stage and the objective', async () => {
    renderApp(briefPath());
    const customer = await valueOf('Customer');
    expect(customer).toHaveTextContent('Priya Nair');
    expect(customer).toHaveTextContent('Customer onboarding lead, Contoso Retail');
    expect(customer).toHaveTextContent('Synthetic customer');
    expect(await valueOf('Product')).toHaveTextContent('Microsoft Teams \u00b7 Meetings');
    const issue = await valueOf('Issue');
    expect(issue).toHaveTextContent(standard.publicBrief.issue);
    expect(issue).toHaveTextContent('Data missing');
    const impact = await valueOf('Impact');
    expect(impact).toHaveTextContent('Medium');
    expect(impact).toHaveTextContent(standard.publicBrief.impact.medium);
    expect(await valueOf('Call stage')).toHaveTextContent('First contact');
    expect(await valueOf('Objective')).toHaveTextContent(standard.publicBrief.objective);
  });

  it('heads the page with the same product tile as the scenario\u2019s details, the product and the title', async () => {
    renderApp(briefPath());
    await valueOf('Customer');
    const head = document.querySelector('.brf-head') as HTMLElement;
    expect(head.querySelector('.brf-tile')).toHaveClass('ff-accent', 'ff-accent--purple');
    expect(head.querySelector('.brf-tile')).toHaveAttribute('aria-hidden', 'true');
    expect(head).toHaveTextContent('Microsoft Teams \u00b7 Meetings');
    expect(within(head).getByRole('heading', { level: 1, name: 'Case brief' })).toBeVisible();
    expect(head).toHaveTextContent(standard.title);
    expect(within(head).getByText('Synthetic scenario')).toBeVisible();
    // The note that the scenario is made up stands next to the title, not at the far end of the row.
    expect(within(head).getByText('Synthetic scenario').closest('.brf-titlerow')).toContainElement(
      within(head).getByRole('heading', { level: 1 }),
    );
  });

  it('names the practice mode and says what it means on screen, by the preset or the choice made', async () => {
    const mode = async (query: string) => {
      const { unmount } = renderApp(briefPath(query));
      await valueOf('Customer');
      const text = document.querySelector('.brf-mode')?.textContent;
      unmount();
      return text;
    };
    // Standard is Assessment practice by default; Starter is Guided; either can be chosen on purpose.
    expect(await mode('')).toBe('Assessment practice. No tips on screen.');
    expect(await mode('?difficulty=starter')).toBe(
      'Guided practice. Short tips appear during the call.',
    );
    expect(await mode('?difficulty=challenge&hints=on')).toBe(
      'Guided practice. Short tips appear during the call.',
    );
    expect(await mode('?difficulty=starter&hints=off')).toBe(
      'Assessment practice. No tips on screen.',
    );
  });

  it('never says "live hints" anywhere', async () => {
    renderApp(briefPath('?hints=on'));
    await valueOf('Customer');
    expect(document.body.textContent ?? '').not.toMatch(/live hints/i);
  });

  it('says the impact for the level that was chosen, in the words written for that level', async () => {
    const { unmount } = renderApp(briefPath('?impact=high'));
    const high = await valueOf('Impact');
    expect(high).toHaveTextContent('High');
    expect(high).toHaveTextContent(standard.publicBrief.impact.high);
    expect(high).not.toHaveTextContent(standard.publicBrief.impact.medium);
    unmount();

    renderApp(briefPath('?impact=low'));
    expect(await valueOf('Impact')).toHaveTextContent(standard.publicBrief.impact.low);
  });

  it('names the call stage chosen, and the case number once there is a case', async () => {
    const { unmount } = renderApp(briefPath('?stage=follow-up'));
    const stage = await valueOf('Call stage');
    expect(stage).toHaveTextContent('Follow-up on an open case');
    expect(stage).toHaveTextContent(`Case ${standard.caseReference}`);
    unmount();

    renderApp(briefPath());
    expect(await valueOf('Call stage')).not.toHaveTextContent('SIM-');
  });

  it('offers known context, previous contact and environment only when there is some, closed to begin with', async () => {
    const user = userEvent.setup();
    const exchange = scenarioById(SAMPLE.withContext);
    renderApp(briefPath('', SAMPLE.withContext));
    await valueOf('Customer');
    const known = screen.getByRole('button', { name: 'Known context' });
    expect(known).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Environment' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Previous contact' })).not.toBeInTheDocument();
    expect(screen.queryByText(exchange.publicBrief.knownContext as string)).not.toBeVisible();
    await user.click(known);
    expect(known).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(exchange.publicBrief.knownContext as string)).toBeVisible();
  });

  it('adds previous contact when the call is not a first contact, and leaves it out on a first one', async () => {
    const calls = scenarioById(SAMPLE.withHistory);
    const { unmount } = renderApp(briefPath('', SAMPLE.withHistory));
    await valueOf('Customer');
    expect(screen.getByRole('button', { name: 'Previous contact' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Environment' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Known context' })).not.toBeInTheDocument();
    expect(screen.getByText(calls.publicBrief.previousContact as string)).not.toBeVisible();
    unmount();

    renderApp(briefPath('?stage=first-contact', SAMPLE.withHistory));
    await valueOf('Customer');
    expect(screen.queryByRole('button', { name: 'Previous contact' })).not.toBeInTheDocument();
  });

  it('is only the six rows when the scenario has no more to say', async () => {
    renderApp(briefPath('', SAMPLE.bare));
    await valueOf('Customer');
    for (const name of ['Known context', 'Previous contact', 'Environment']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it('has no large paragraph: each row is short, and so is everything else on the page', async () => {
    renderApp(briefPath('', SAMPLE.withHistory));
    await valueOf('Customer');
    for (const term of await screen.findAllByRole('term')) {
      expect(wordCount(term.nextElementSibling?.textContent ?? '')).toBeLessThanOrEqual(30);
    }
    for (const paragraph of document.querySelectorAll('p')) {
      if (paragraph.closest('[hidden]')) continue;
      expect(wordCount(paragraph.textContent ?? '')).toBeLessThanOrEqual(30);
    }
  });

  it('never shows more than the public brief: no summary, no discovery areas, no stage notes', async () => {
    renderApp(briefPath('?stage=escalated'));
    await valueOf('Customer');
    const page = document.body.textContent ?? '';
    expect(page).not.toContain(standard.summary);
    for (const area of standard.expectedDiscoveryAreas) expect(page).not.toContain(area);
    expect(page).not.toContain(standard.stageBriefs.escalated);
    expect(page).not.toMatch(/score|rubric|criteria|trigger|hidden/i);
  });

  it('links back to the scenario with the settings, from "Edit scenario"', async () => {
    renderApp(briefPath('?difficulty=challenge&hints=on&voice=voice-d'));
    await valueOf('Customer');
    const to = `/scenarios?scenario=${SAMPLE.standard}&difficulty=challenge&hints=on&voice=voice-d`;
    const edit = screen.getAllByRole('link', { name: 'Edit scenario' });
    expect(edit.length).toBeGreaterThanOrEqual(1);
    for (const link of edit) expect(link).toHaveAttribute('href', to);
  });

  it('ignores settings it cannot use, and says so', async () => {
    renderApp(briefPath('?difficulty=extreme&hints=maybe&impact=low&voice=voice-z'));
    const note = await screen.findByText(/Some settings in this link could not be used/);
    expect(note).toHaveTextContent('Difficulty, Practice mode, Voice');
    expect(await valueOf('Impact')).toHaveTextContent('Low');
  });

  it('shows placeholders while the scenario loads, and no row yet', async () => {
    vi.mocked(api.scenario).mockReturnValue(new Promise(() => undefined));
    renderApp(briefPath());
    expect(await screen.findByRole('heading', { level: 1, name: 'Case brief' })).toBeVisible();
    expect(screen.queryByRole('term')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Start/ })).not.toBeInTheDocument();
  });

  it('is a designed "Scenario unavailable" state for an unknown scenario, and for a retired one', async () => {
    for (const id of ['not-a-scenario', 'locked-out-after-password-reset']) {
      const { unmount } = renderApp(`/scenarios/${id}/brief`);
      expect(
        await screen.findByRole('heading', { level: 1, name: 'Scenario unavailable' }),
      ).toBeVisible();
      expect(screen.getByText(/Nothing was started/)).toBeVisible();
      expect(screen.getByRole('link', { name: 'Choose a scenario' })).toHaveAttribute(
        'href',
        '/scenarios',
      );
      expect(screen.queryByRole('button', { name: /Start/ })).not.toBeInTheDocument();
      unmount();
    }
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

describe('the customer voice', () => {
  let env: FakeEnv | null = null;
  afterEach(() => {
    env?.uninstall();
    env = null;
  });

  it('is the scenario\u2019s own to begin with, from four neutral choices, and a choice goes in the address', async () => {
    const user = userEvent.setup();
    const app = renderApp(briefPath());
    const select = await screen.findByRole('combobox', { name: 'Customer voice' });
    const own = defaultVoiceFor(SAMPLE.standard);
    expect(select).toHaveValue(own);
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Voice A - Warm', 'Voice B - Direct', 'Voice C - Measured', 'Voice D - Concise']);
    const other = own === 'voice-a' ? 'voice-b' : 'voice-a';
    await user.selectOptions(select, other);
    expect(select).toHaveValue(other);
    await waitFor(() => expect(app.query().get('voice')).toBe(other));
    expect(screen.getByRole('link', { name: 'Edit scenario' }).getAttribute('href')).toContain(
      `voice=${other}`,
    );
    await user.selectOptions(select, own);
    await waitFor(() => expect(app.query().get('voice')).toBeNull());
  });

  it('plays one short sample with "Test voice" in the chosen voice, shows a waveform while it plays, and can stop it', async () => {
    const user = userEvent.setup();
    env = installFakes({
      synthesis: [1, 2, 3, 4].map((n) => fakeVoice(`English voice ${n}`, 'en-GB')),
    });
    mockApi({ config: appConfig({ speech: NO_SPEECH }) });
    browser({ audioElement: false });
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['en-GB']);
    renderApp(briefPath());
    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Customer voice' }),
      'voice-c',
    );
    const test = await screen.findByRole('button', { name: 'Test voice' });
    await waitFor(() => expect(test).not.toHaveAttribute('aria-disabled'));
    await user.click(test);

    expect(await screen.findByRole('button', { name: 'Stop' })).toBeVisible();
    await waitFor(() => expect(env?.speech.spoken).toHaveLength(1));
    expect(env?.speech.latest().text).toBe(VOICE_PREVIEW_TEXT);
    expect((env?.speech.latest().voice as SpeechSynthesisVoice).name).toBe('English voice 3');
    expect(document.querySelector('.brf-wave')).toHaveAttribute('data-active');
    act(() => {
      env?.speech.finishLatest();
    });
    expect(await screen.findByRole('button', { name: 'Test voice' })).toBeVisible();
    expect(document.querySelector('.brf-wave')).not.toHaveAttribute('data-active');

    await user.click(screen.getByRole('button', { name: 'Test voice' }));
    await waitFor(() => expect(env?.speech.spoken).toHaveLength(2));
    await user.click(await screen.findByRole('button', { name: 'Stop' }));
    expect(await screen.findByRole('button', { name: 'Test voice' })).toBeVisible();
  });

  it('plays the sample from the speech service when that is what will speak the customer, in the chosen voice and the call\u2019s language', async () => {
    const user = userEvent.setup();
    env = installFakes();
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(new Blob(['sound'], { type: 'audio/wav' }), {
          status: 200,
          headers: { 'content-type': 'audio/wav' },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['en-IE']);
    mockApi({ config: appConfig({ speech: AZURE_SPEECH }) });
    renderApp(briefPath());
    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Customer voice' }),
      'voice-d',
    );
    const test = await screen.findByRole('button', { name: 'Test voice' });
    await waitFor(() => expect(test).not.toHaveAttribute('aria-disabled'));
    await user.click(test);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/speech/preview?lang=en-IE&voice=voice-d');
    expect(env.speech.spoken).toHaveLength(0);
    expect(await screen.findByRole('button', { name: 'Stop' })).toBeVisible();
    act(() => {
      env?.element.latest().finish();
    });
    expect(await screen.findByRole('button', { name: 'Test voice' })).toBeVisible();
  });

  it('says why a sample could not be played, and that the choice is kept', async () => {
    const user = userEvent.setup();
    env = installFakes();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    mockApi({ config: appConfig({ speech: AZURE_SPEECH }) });
    renderApp(briefPath());
    const test = await screen.findByRole('button', { name: 'Test voice' });
    await waitFor(() => expect(test).not.toHaveAttribute('aria-disabled'));
    await user.click(test);

    const note = await screen.findByText(/Your choice is kept\./);
    expect(note.closest('[role="status"]')).not.toBeNull();
    expect(test).toHaveAccessibleDescription(note.textContent ?? '');
    expect(screen.getByRole('combobox', { name: 'Customer voice' })).toBeEnabled();
    expect(await screen.findByRole('button', { name: 'Test voice' })).toBeVisible();
  });

  it('is only the voices the speech service lists', async () => {
    mockApi({
      config: appConfig({
        speech: { ...AZURE_SPEECH, voices: (AZURE_SPEECH.voices ?? []).slice(0, 2) },
      }),
    });
    renderApp(briefPath());
    const select = await screen.findByRole('combobox', { name: 'Customer voice' });
    await waitFor(() => expect(within(select).getAllByRole('option')).toHaveLength(2));
    // The scenario's own voice is used when it is on offer, and the first on offer when it is not.
    const own = defaultVoiceFor(SAMPLE.standard);
    expect(select).toHaveValue(['voice-a', 'voice-b'].includes(own) ? own : 'voice-a');
  });

  it('is no choice where the speech service is from before voices could be chosen: it says so, and no voice is named', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createSession).mockResolvedValue(session('call-0001'));
    mockApi({ config: appConfig({ speech: OLD_SERVER_SPEECH }) });
    const app = renderApp(briefPath());
    expect(
      await screen.findByText("The speech service chooses the customer's voice."),
    ).toBeVisible();
    expect(screen.queryByRole('combobox', { name: 'Customer voice' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Test voice' })).not.toBeInTheDocument();
    await user.click(await startVoice());
    await waitFor(() => expect(app.where()).toBe('/calls/call-0001?input=voice'));
  });

  it('says so when the browser has one English voice, so the four choices differ only in pace', async () => {
    env = installFakes({ synthesis: [fakeVoice('English voice', 'en-GB')] });
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['en-GB']);
    mockApi({ config: appConfig({ speech: NO_SPEECH }) });
    renderApp(briefPath());
    const note = await screen.findByText(
      'This browser has one English voice, so the four choices differ only in pace.',
    );
    expect(
      await screen.findByRole('combobox', { name: 'Customer voice' }),
    ).toHaveAccessibleDescription(note.textContent ?? '');
  });

  it('says nothing about the browser\u2019s voices when every choice has a voice of its own', async () => {
    env = installFakes({
      synthesis: [1, 2, 3, 4].map((n) => fakeVoice(`English voice ${n}`, 'en-GB')),
    });
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['en-GB']);
    renderApp(briefPath());
    await startVoice();
    expect(screen.queryByText(/This browser has/)).not.toBeInTheDocument();
  });

  it('says so when the speech service has fewer voices of its own than there are choices', async () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['en-GB']);
    mockApi({ config: appConfig({ speech: AZURE_SHARED_SPEECH }) });
    renderApp(briefPath());
    expect(
      await screen.findByText(
        'Some of these voices share one synthetic voice and differ only in pace.',
      ),
    ).toBeVisible();
  });

  it('says nothing about sharing when every choice has a voice of its own, or for the demo service', async () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['en-GB']);
    mockApi({ config: appConfig({ speech: AZURE_SPEECH }) });
    const first = renderApp(briefPath());
    await screen.findByRole('combobox', { name: 'Customer voice' });
    expect(screen.queryByText(/share one synthetic voice/)).not.toBeInTheDocument();
    first.unmount();

    mockApi({ config: appConfig({ speech: DEMO_SPEECH }) });
    renderApp(briefPath());
    await screen.findByText('Demo speech');
    expect(screen.queryByText(/share one synthetic voice/)).not.toBeInTheDocument();
  });

  it('offers the four voices of the shared contract and nothing about people', async () => {
    renderApp(briefPath());
    const select = await screen.findByRole('combobox', { name: 'Customer voice' });
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(VOICE_CHOICES.map((voice) => voice.label));
  });

  it('is labelled as demo speech where the speech service is the scripted one', async () => {
    mockApi({ config: appConfig({ speech: DEMO_SPEECH }) });
    renderApp(briefPath());
    const badge = await screen.findByText('Demo speech');
    expect(badge).toBeVisible();
    expect(badge.closest('p')).toHaveTextContent(
      'The customer does not speak: a short soft sound plays and the reply appears as text.',
    );
  });

  it('has no voice to choose where the browser cannot speak, and says the replies are read on screen', async () => {
    browser({ synthesis: false, audioElement: false });
    renderApp(briefPath());
    await startVoice();
    expect(
      screen.getByText(
        "This browser cannot speak the customer's replies, so you read them on screen.",
      ),
    ).toBeVisible();
    expect(screen.queryByRole('combobox', { name: 'Customer voice' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Test voice' })).not.toBeInTheDocument();
  });

  it('keeps "Test voice" out of reach, but in the tab order, until it is known how the customer will speak', async () => {
    vi.mocked(api.config).mockReturnValue(new Promise(() => undefined));
    renderApp(briefPath());
    const test = await screen.findByRole('button', { name: 'Test voice' });
    expect(test).toHaveAttribute('aria-disabled', 'true');
    expect(test).toHaveAccessibleDescription('Checking what this browser can play.');
    expect(test).not.toBeDisabled();
  });
});

describe('the microphone', () => {
  const handle = (level = 0.8) => {
    const release = vi.fn();
    const value: MicrophoneHandle = {
      sampleRate: 16000,
      worklet: null,
      setListening: vi.fn(),
      setEnabled: vi.fn(),
      readLevel: vi.fn(() => level),
      onEnded: vi.fn(() => () => undefined),
      release,
    };
    return { value, release };
  };
  const permission = (state: PermissionState) =>
    Object.defineProperty(window.navigator, 'permissions', {
      configurable: true,
      value: {
        query: vi.fn().mockResolvedValue({
          state,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }),
      },
    });
  afterEach(() => {
    Reflect.deleteProperty(window.navigator, 'permissions');
  });

  it('is never opened by the page on its own', async () => {
    renderApp(briefPath());
    await startVoice();
    expect(acquireMicrophone).not.toHaveBeenCalled();
  });

  it('says the browser will ask, and tells the Start button so', async () => {
    renderApp(briefPath());
    const start = await startVoice();
    expect(await screen.findByText('The browser will ask to use your microphone.')).toBeVisible();
    expect(start).toHaveAccessibleDescription('The browser will ask to use your microphone.');
  });

  it.each([
    ['granted', 'Microphone allowed.'],
    ['denied', 'Microphone blocked in the browser. You can type the call.'],
  ] as const)('reads the browser\u2019s permission: %s', async (state, text) => {
    permission(state);
    renderApp(briefPath());
    expect(await screen.findByText(text)).toBeVisible();
    expect(await startVoice()).toHaveAccessibleDescription(text);
  });

  it('checks the microphone for a moment when asked, shows the level, and lets go of it', async () => {
    const user = userEvent.setup();
    const { value, release } = handle();
    vi.mocked(acquireMicrophone).mockResolvedValue(value);
    renderApp(briefPath());
    await user.click(await screen.findByRole('button', { name: 'Check microphone' }));

    expect(acquireMicrophone).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Listening. Say a few words.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeVisible();
    expect(await screen.findByText('Microphone works.', {}, { timeout: 3000 })).toBeVisible();
    expect(release).toHaveBeenCalledTimes(1);
    expect(value.setListening).toHaveBeenCalledWith(true);
    expect(screen.getByRole('button', { name: 'Check again' })).toBeVisible();
    expect(await startVoice()).toHaveAccessibleDescription('Microphone works.');
  });

  it('can be stopped while it listens, and says nothing about the microphone after', async () => {
    const user = userEvent.setup();
    const { value, release } = handle(0);
    vi.mocked(acquireMicrophone).mockResolvedValue(value);
    renderApp(briefPath());
    await user.click(await screen.findByRole('button', { name: 'Check microphone' }));
    await screen.findByText('Listening. Say a few words.');
    await user.click(screen.getByRole('button', { name: 'Stop' }));
    expect(release).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: 'Check microphone' })).toBeVisible();
    expect(screen.getByText('The browser will ask to use your microphone.')).toBeVisible();
  });

  it('says when nothing was heard, and lets go of the microphone', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
    const { value, release } = handle(0);
    vi.mocked(acquireMicrophone).mockResolvedValue(value);
    renderApp(briefPath());
    await act(() => vi.advanceTimersByTimeAsync(10));
    fireEvent.click(screen.getByRole('button', { name: 'Check microphone' }));
    await act(() => vi.advanceTimersByTimeAsync(8100));
    expect(screen.getByText('No sound heard. Check your microphone.')).toBeVisible();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['denied', 'Microphone blocked in the browser. You can type the call.'],
    ['missing', 'No microphone found. You can type the call.'],
    ['busy', 'The microphone is in use by another app.'],
    ['unsupported', 'This browser cannot use a microphone here.'],
  ] as const)(
    'says what is wrong, and that a typed call is still possible: %s',
    async (reason, text) => {
      const user = userEvent.setup();
      vi.mocked(acquireMicrophone).mockRejectedValue(new MicrophoneError(reason));
      renderApp(briefPath());
      await user.click(await screen.findByRole('button', { name: 'Check microphone' }));
      expect(await screen.findByText(text)).toBeVisible();
      expect(screen.getByRole('button', { name: 'Start a text-only call' })).toBeEnabled();
      expect(acquireMicrophone).toHaveBeenCalledTimes(1);
    },
  );

  it('lets go of a microphone that arrives after the check was stopped', async () => {
    const user = userEvent.setup();
    const { value, release } = handle();
    let arrive: (microphone: MicrophoneHandle) => void = () => undefined;
    vi.mocked(acquireMicrophone).mockReturnValue(new Promise((resolve) => (arrive = resolve)));
    renderApp(briefPath());
    await user.click(await screen.findByRole('button', { name: 'Check microphone' }));
    expect(await screen.findByText('Waiting for permission')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Stop' }));
    await act(async () => arrive(value));
    expect(release).toHaveBeenCalledTimes(1);
    expect(value.setListening).not.toHaveBeenCalledWith(true);
  });

  it('lets go of the microphone when the page is left while it listens', async () => {
    const user = userEvent.setup();
    const { value, release } = handle(0);
    vi.mocked(acquireMicrophone).mockResolvedValue(value);
    const { unmount } = renderApp(briefPath());
    await user.click(await screen.findByRole('button', { name: 'Check microphone' }));
    await screen.findByText('Listening. Say a few words.');
    unmount();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('offers no check where a spoken call is not possible', async () => {
    browser({ recognition: false, microphone: false, audioContext: false, worklet: false });
    renderApp(briefPath());
    expect(
      await screen.findByText('Voice is not available here. You can type the call.'),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: /Check microphone/ })).not.toBeInTheDocument();
  });

  it('puts a new line about the microphone in a new element, so its icon and words fade in together where the old one was', async () => {
    const user = userEvent.setup();
    const { value } = handle(0);
    vi.mocked(acquireMicrophone).mockResolvedValue(value);
    renderApp(briefPath());
    const idle = (await screen.findByText('The browser will ask to use your microphone.')).closest(
      '.brf-ready__message',
    );
    expect(idle).not.toBeNull();
    expect(idle?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    await user.click(await screen.findByRole('button', { name: 'Check microphone' }));
    const listening = (await screen.findByText('Listening. Say a few words.')).closest(
      '.brf-ready__message',
    );
    expect(listening).not.toBeNull();
    expect(listening).not.toBe(idle);
    // It is still one live line, read once: the status the Start button is described by.
    expect(
      screen.getAllByRole('status').filter((line) => line.id === 'brf-readiness'),
    ).toHaveLength(1);
    expect(await startVoice()).toHaveAccessibleDescription('Listening. Say a few words.');
  });

  it('keeps room for two lines of it, so a longer one never pushes the buttons below', () => {
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'brief.css'),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, '');
    const status = css.match(/\.brf-ready__status\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(status).toMatch(/min-block-size:\s*calc\(var\(--lh-compact\) \* 2\)/);
    // A new line fades in by opacity alone, which moves nothing, and has no animation on paper.
    expect(css).toMatch(/\.brf-ready__message\s*\{[^}]*animation:\s*ff-fade var\(--dur-normal\)/);
    expect(css).toMatch(/@media print\s*\{[^}]*\.brf-ready__message/);
  });
});

describe('the privacy notice', () => {
  it('says, before the first call, what the microphone is for, in one sentence', async () => {
    renderApp(briefPath());
    const notice = await screen.findByRole('region', { name: 'Privacy notice' });
    expect(MICROPHONE_NOTICE).toBe(
      'Firefly uses your microphone to transcribe this simulated call. Do not share real customer information.',
    );
    expect(within(notice).getByText(MICROPHONE_NOTICE)).toBeVisible();
    expect(wordCount(MICROPHONE_NOTICE)).toBeLessThanOrEqual(24);
  });

  it('sits under the case rows, apart from the voice card, so the two columns are about as tall', async () => {
    renderApp(briefPath());
    const notice = await screen.findByRole('region', { name: 'Privacy notice' });
    const caseFile = screen.getByRole('region', { name: 'Support case' });
    expect(screen.getByRole('complementary', { name: 'Voice call' })).not.toContainElement(notice);
    expect(notice.parentElement).toBe(caseFile.parentElement);
    expect(
      caseFile.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('keeps the details behind a button, and tells the truth about this setup', async () => {
    const user = userEvent.setup();
    mockApi({ config: appConfig({ speech: AZURE_SPEECH }) });
    renderApp(briefPath());
    const notice = await screen.findByRole('region', { name: 'Privacy notice' });
    const details = within(notice).getByRole('button', { name: PRIVACY_DETAILS_LABEL });
    expect(details).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Synthetic scenarios only')).not.toBeVisible();
    await user.click(details);
    // The eight things the product promises to say, in the voice feature's words.
    for (const heading of [
      'Synthetic scenarios only',
      'Starts only after you allow it',
      'You can always see when it is recording',
      'Stop at any time',
      'You can type instead',
      'Your recording is discarded',
      'The transcript is saved with the call',
    ]) {
      expect(screen.getByText(heading)).toBeVisible();
    }
    // What is said about where the audio goes is what this setup really does: the speech service.
    await waitFor(() =>
      expect(screen.getByText('Who handles your audio: Azure AI Speech')).toBeVisible(),
    );
    expect(screen.getByText(/sent through this Firefly server to Azure AI Speech/)).toBeVisible();
    expect(
      screen.getByText(/Demo mode: the customer is played by Firefly's built-in rules engine/),
    ).toBeVisible();
  });

  it('is gone once read, leaving a closed row for the details, and stays gone on the next visit', async () => {
    const user = userEvent.setup();
    const { unmount } = renderApp(briefPath());
    await user.click(await screen.findByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('region', { name: 'Privacy notice' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: PRIVACY_DETAILS_LABEL })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    unmount();

    renderApp(briefPath());
    await startVoice();
    expect(screen.queryByRole('region', { name: 'Privacy notice' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: PRIVACY_DETAILS_LABEL })).toBeVisible();
  });

  it('moves focus to the closed row when it is read, so focus is not lost with the button', async () => {
    const user = userEvent.setup();
    renderApp(briefPath());
    await user.click(await screen.findByRole('button', { name: 'Got it' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: PRIVACY_DETAILS_LABEL })).toHaveFocus(),
    );
  });

  it('leaves focus where it is when starting a spoken call is what counts as having read it', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createSession).mockReturnValue(new Promise(() => undefined));
    renderApp(briefPath());
    await user.click(await startVoice());
    await waitFor(() => expect(window.localStorage.getItem('firefly.voice-notice-seen')).toBe('1'));
    expect(screen.getByRole('button', { name: PRIVACY_DETAILS_LABEL })).not.toHaveFocus();
  });

  it('is not shown for a call that can only be typed, since no microphone will be used: only the closed row', async () => {
    browser({
      recognition: false,
      microphone: false,
      audioContext: false,
      worklet: false,
      synthesis: false,
    });
    renderApp(briefPath());
    await screen.findByRole('button', { name: 'Start text call' });
    expect(screen.queryByRole('region', { name: 'Privacy notice' })).not.toBeInTheDocument();
    expect(screen.queryByText(MICROPHONE_NOTICE)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: PRIVACY_DETAILS_LABEL })).toBeVisible();
  });

  it('waits for the speech settings before saying anything about the microphone', async () => {
    vi.mocked(api.config).mockReturnValue(new Promise(() => undefined));
    renderApp(briefPath());
    await startVoice();
    expect(screen.queryByRole('region', { name: 'Privacy notice' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: PRIVACY_DETAILS_LABEL })).not.toBeInTheDocument();
  });

  it('counts a spoken call as having read it, and a typed one as not', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createSession).mockResolvedValue(session('call-0001'));
    const { unmount } = renderApp(briefPath());
    await user.click(await screen.findByRole('button', { name: 'Start a text-only call' }));
    await waitFor(() => expect(api.createSession).toHaveBeenCalled());
    expect(window.localStorage.getItem('firefly.voice-notice-seen')).toBeNull();
    unmount();

    const again = renderApp(briefPath());
    await user.click(await startVoice());
    await waitFor(() => expect(again.where()).toContain('/calls/'));
    expect(window.localStorage.getItem('firefly.voice-notice-seen')).toBe('1');
  });

  it('still shows when the browser will not remember anything', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const user = userEvent.setup();
    renderApp(briefPath());
    await user.click(await screen.findByRole('button', { name: 'Got it' }));
    expect(screen.getByRole('button', { name: PRIVACY_DETAILS_LABEL })).toBeVisible();
  });
});

describe('how speech is set up', () => {
  const details = async () => {
    await userEvent.click(await screen.findByRole('button', { name: PRIVACY_DETAILS_LABEL }));
  };

  it('uses the speech service for listening and speaking when it can, and names it', async () => {
    mockApi({ config: appConfig({ speech: AZURE_SPEECH }) });
    renderApp(briefPath());
    await details();
    await waitFor(() =>
      expect(
        screen.getByText(/Your speech is sent through this Firefly server to Azure AI Speech/),
      ).toBeVisible(),
    );
    expect(screen.getByText(/The customer's lines are sent to Azure AI Speech/)).toBeVisible();
    expect(await startVoice()).toBeEnabled();
  });

  it('falls back to the browser\u2019s recognition, and says Firefly never receives the audio', async () => {
    renderApp(briefPath());
    await details();
    await waitFor(() =>
      expect(screen.getByText('Who handles your audio: Your browser')).toBeVisible(),
    );
    expect(screen.getByText(/Firefly never receives the audio/)).toBeVisible();
    expect(await startVoice()).toBeEnabled();
  });

  it('leads with a typed call when nothing can listen, and does not offer a second one', async () => {
    browser({
      recognition: false,
      microphone: false,
      audioContext: false,
      worklet: false,
      synthesis: false,
    });
    renderApp(briefPath());
    expect(await screen.findByRole('button', { name: 'Start text call' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Start voice call' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Start a text-only call' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Voice is not available here. You can type the call.')).toBeVisible();
    await details();
    await waitFor(() =>
      expect(
        screen.getByText(/No speech service is in use, so you type your replies/),
      ).toBeVisible(),
    );
  });

  it('says why when the page is not secure', async () => {
    browser({ secureContext: false });
    renderApp(briefPath());
    expect(await screen.findByRole('button', { name: 'Start text call' })).toBeVisible();
    expect(
      screen.getByText('Voice needs a secure (https) connection. You can type the call.'),
    ).toBeVisible();
  });

  it('offers only a typed call, and a retry, when the speech settings cannot be loaded', async () => {
    const user = userEvent.setup();
    vi.mocked(api.config).mockRejectedValueOnce(networkError());
    renderApp(briefPath());
    expect(await screen.findByText('Speech settings could not be loaded')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Start voice call' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start text call' })).toBeVisible();
    expect(
      screen.getByText('Speech settings could not be loaded. You can type the call.'),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Start voice call' })).toBeVisible(),
    );
  });

  it('keeps the main button out of reach, but in the tab order, while the settings load', async () => {
    vi.mocked(api.config).mockReturnValue(new Promise(() => undefined));
    renderApp(briefPath());
    const start = await startVoice();
    expect(start).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Checking what this browser can do.')).toBeVisible();
    fireEvent.click(start);
    expect(api.createSession).not.toHaveBeenCalled();
  });
});

describe('starting a call', () => {
  const idPattern = /^[A-Za-z0-9_-]{8,64}$/;

  beforeEach(() => {
    vi.mocked(api.createSession).mockResolvedValue(session('call-0001'));
  });

  it('creates the call once and opens it as a voice call, with the voice and the part of the day', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 21, 14, 20));
    const user = userEvent.setup({ advanceTimers: () => undefined });
    const app = renderApp(briefPath('?difficulty=challenge&hints=on&curveballs=deadline'));
    await user.click(await startVoice());

    await waitFor(() =>
      expect(app.where()).toBe(
        `/calls/call-0001?input=voice&voice=${defaultVoiceFor(SAMPLE.standard)}`,
      ),
    );
    expect(api.createSession).toHaveBeenCalledTimes(1);
    const request = vi.mocked(api.createSession).mock.calls[0]?.[0];
    expect(request).toMatchObject({
      scenarioId: SAMPLE.standard,
      overrides: { difficulty: 'challenge', curveballs: ['deadline'] },
      mode: 'guided',
      timeOfDay: 'afternoon',
    });
    expect(request?.clientRequestId).toMatch(idPattern);
  });

  it('opens the call with the voice the trainee chose', async () => {
    const user = userEvent.setup();
    const app = renderApp(briefPath('?voice=voice-d'));
    expect(await screen.findByRole('combobox', { name: 'Customer voice' })).toHaveValue('voice-d');
    await user.click(await startVoice());
    await waitFor(() => expect(app.where()).toBe('/calls/call-0001?input=voice&voice=voice-d'));
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
    expect(vi.mocked(api.createSession).mock.calls[0]?.[0]).not.toHaveProperty('voice');
  });

  it('keeps the two ways to start together, the typed one right after the main one, and the way back apart', async () => {
    renderApp(briefPath());
    const main = await startVoice();
    const typed = screen.getByRole('button', { name: 'Start a text-only call' });
    const edit = screen.getAllByRole('link', { name: 'Edit scenario' }).at(-1) as HTMLElement;
    const follows = (first: HTMLElement, second: HTMLElement) =>
      Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(typed.parentElement).toBe(main.parentElement);
    expect(edit.parentElement).not.toBe(main.parentElement);
    expect(follows(main, typed)).toBe(true);
    expect(follows(typed, edit)).toBe(true);
  });

  it('opens a text-only call from the quieter action', async () => {
    const user = userEvent.setup();
    const app = renderApp(briefPath());
    await user.click(await screen.findByRole('button', { name: 'Start a text-only call' }));
    await waitFor(() => expect(app.where()).toMatch(/^\/calls\/call-0001\?input=text/));
  });

  it('opens a typed call when voice is not available', async () => {
    browser({ recognition: false, microphone: false });
    const user = userEvent.setup();
    const app = renderApp(briefPath());
    await user.click(await screen.findByRole('button', { name: 'Start text call' }));
    await waitFor(() => expect(app.where()).toMatch(/^\/calls\/call-0001\?input=text/));
  });

  it('never creates two calls from a double click', async () => {
    const user = userEvent.setup();
    const app = renderApp(briefPath());
    await user.dblClick(await startVoice());
    await waitFor(() => expect(app.where()).toContain('/calls/call-0001'));
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
    await waitFor(() => expect(app.where()).toContain('/calls/call-0002'));
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
    await waitFor(() => expect(app.where()).toContain('/calls/call-0001'));
    expect(api.createSession).toHaveBeenCalledTimes(2);
    const [first, second] = vi.mocked(api.createSession).mock.calls.map((call) => call[0]);
    expect(second?.clientRequestId).toBe(first?.clientRequestId);
    expect(second?.timeOfDay).toBe(first?.timeOfDay);
  });

  it('retries a text call as a text call', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createSession).mockRejectedValueOnce(networkError());
    const app = renderApp(briefPath());
    await user.click(await screen.findByRole('button', { name: 'Start a text-only call' }));
    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(app.where()).toMatch(/^\/calls\/call-0001\?input=text/));
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

  it('offers a way out instead of a retry when the scenario has gone since the page opened', async () => {
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
