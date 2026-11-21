import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfigDTO } from '#shared/domain/api.ts';
import { AnnouncerProvider } from '../design/index.ts';
import { FIXTURES, type FixtureName } from '../features/call-ui/call-fixtures.ts';
import {
  clearViewport,
  fakeActions,
  mockViewport,
  WIDTH,
  type FakeActions,
} from '../features/call-ui/test-utils.tsx';
import type { CallSnapshot } from '../features/call/contract.ts';
import { describeProblem } from '../features/call/problems.ts';
import { useCall } from '../features/call/useCall.ts';
import type * as ApiModule from '../lib/api.ts';
import { api } from '../lib/api.ts';
import { useAppConfig } from '../lib/config.tsx';
import Call from './Call.tsx';

vi.mock('../features/call/useCall.ts', () => ({ useCall: vi.fn() }));
vi.mock('../lib/config.tsx', () => ({ useAppConfig: vi.fn() }));
vi.mock('../lib/api.ts', async (importOriginal) => {
  const original = await importOriginal<typeof ApiModule>();
  return {
    ...original,
    api: { ...original.api, deleteSession: vi.fn(async () => ({ deleted: true })) },
  };
});

const CONFIG: AppConfigDTO = {
  app: { name: 'Firefly', version: 'test' },
  provider: {
    kind: 'mock',
    label: 'Demo mode (built-in rules engine)',
    demo: true,
    notice: null,
  },
  speech: {
    provider: 'azure-speech',
    label: 'Azure AI Speech',
    demo: false,
    transcribe: true,
    synthesize: true,
    expressiveStyles: true,
    notice: null,
    limits: { maxAudioBytes: 1_000_000, maxAudioSeconds: 30, sampleRate: 16000 },
  },
  limits: { maxMessageChars: 1500, maxTraineeTurns: 30 },
  features: { devDiagnostics: false, testHooks: false },
};

const mockedUseCall = vi.mocked(useCall);
const mockedConfig = vi.mocked(useAppConfig);
const reload = vi.fn();

function engine(source: FixtureName | CallSnapshot, actions: FakeActions = fakeActions()) {
  const snapshot = typeof source === 'string' ? FIXTURES[source].snapshot : source;
  mockedUseCall.mockReturnValue({ snapshot, actions });
  return actions;
}

function renderPage(path = '/calls/ses_fixture_maya') {
  mockViewport(WIDTH.wide);
  const router = createMemoryRouter(
    [
      { path: '/calls/:id', Component: Call },
      { path: '/sessions/:id/report', Component: () => <p>The report page</p> },
      { path: '/scenarios', Component: () => <p>The scenarios page</p> },
    ],
    { initialEntries: [path] },
  );
  const view = render(
    <AnnouncerProvider>
      <RouterProvider router={router} />
    </AnnouncerProvider>,
  );
  return { ...view, router };
}

beforeEach(() => {
  mockedConfig.mockReturnValue({ config: CONFIG, loading: false, error: false, reload });
  vi.mocked(api.deleteSession).mockClear();
  reload.mockClear();
});

afterEach(() => {
  cleanup();
  clearViewport();
  mockedUseCall.mockReset();
  document.title = '';
});

describe('the call page', () => {
  it('runs the engine for the session in the address, with what the server offers', () => {
    engine('ready-for-next-turn');
    renderPage('/calls/ses_abc');
    expect(mockedUseCall).toHaveBeenCalled();
    const [sessionId, options] = mockedUseCall.mock.calls[0]!;
    expect(sessionId).toBe('ses_abc');
    expect(options.serverSpeech).toBe(CONFIG.speech);
    expect(options.maxTraineeTurns).toBe(30);
  });

  it('shows the workspace with the server’s provider label and message limit', () => {
    engine('ready-for-next-turn');
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Call with Maya Okafor' }),
    ).toBeInTheDocument();
    expect(within(screen.getAllByRole('banner')[0]!).getByText('Demo mode')).toBeInTheDocument();
    expect(document.title).toBe('Call with Maya Okafor · Firefly');
  });

  it('waits for the server’s settings with a skeleton, and does not start the engine', () => {
    mockedConfig.mockReturnValue({ config: null, loading: true, error: false, reload });
    const { container } = renderPage();
    expect(container.querySelector('[aria-busy="true"]')).toHaveTextContent('Loading the call');
    expect(mockedUseCall).not.toHaveBeenCalled();
  });

  it('explains it when the settings cannot be fetched, and offers Try again', async () => {
    mockedConfig.mockReturnValue({ config: null, loading: false, error: true, reload });
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'This call could not be opened.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Nothing in the call was changed.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(mockedUseCall).not.toHaveBeenCalled();
  });

  it('shows a designed error page when the call could not be loaded, with Try again and a way back', async () => {
    const actions = engine('load-error');
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'This call could not be opened.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to scenarios' })).toHaveAttribute(
      'href',
      '/scenarios',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(actions.retry).toHaveBeenCalledTimes(1);
  });
});

describe('a call that is over', () => {
  it('opens the report, replacing this page, when the session is not active', async () => {
    const base = FIXTURES['ready-for-next-turn'].snapshot;
    engine({ ...base, session: { ...base.session!, status: 'completed' } });
    const { router } = renderPage('/calls/ses_done');
    await waitFor(() => expect(router.state.location.pathname).toBe('/sessions/ses_done/report'));
    expect(router.state.historyAction).toBe('REPLACE');
    expect(await screen.findByText('The report page')).toBeInTheDocument();
  });

  it('opens the report for a call that is being evaluated or failed to evaluate', async () => {
    const base = FIXTURES['ready-for-next-turn'].snapshot;
    for (const status of ['completing', 'evaluation_failed'] as const) {
      engine({ ...base, session: { ...base.session!, status } });
      const { router, unmount } = renderPage('/calls/ses_wait');
      await waitFor(() => expect(router.state.location.pathname).toBe('/sessions/ses_wait/report'));
      unmount();
      clearViewport();
    }
  });

  it('opens the report as soon as the engine says the call is completed', async () => {
    const base = FIXTURES['ready-for-next-turn'].snapshot;
    engine({ ...base, phase: 'completed' });
    const { router } = renderPage('/calls/ses_x');
    await waitFor(() => expect(router.state.location.pathname).toBe('/sessions/ses_x/report'));
  });

  it('opens the report when the server says the call has already ended, as it can in another tab', async () => {
    const base = FIXTURES['ready-for-next-turn'].snapshot;
    engine({ ...base, problem: describeProblem('session-ended') });
    const { router } = renderPage('/calls/ses_elsewhere');
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/sessions/ses_elsewhere/report'),
    );
  });
});

describe('starting and ending from the page', () => {
  it('starts a spoken call only from a press', async () => {
    const actions = engine('preflight-voice');
    renderPage();
    expect(actions.begin).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Allow microphone and start' }));
    expect(actions.begin).toHaveBeenCalledWith({ voice: true });
  });

  it('leads with the typed call when the address says ?input=text', async () => {
    const actions = engine('preflight-voice');
    renderPage('/calls/ses_fixture_maya?input=text');
    const buttons = screen.getAllByRole('button').map((button) => button.textContent);
    expect(buttons.slice(0, 2)).toEqual(['Start text-only call', 'Allow microphone and start']);
    await userEvent.click(screen.getByRole('button', { name: 'Start text-only call' }));
    expect(actions.begin).toHaveBeenCalledWith({ voice: false });
  });

  it('links back to the brief for the scenario', () => {
    engine('preflight-voice');
    renderPage();
    expect(screen.getByRole('link', { name: 'Back to brief' })).toHaveAttribute(
      'href',
      expect.stringContaining('/scenarios/locked-out-after-password-reset/brief'),
    );
  });

  it('opens the report after End and review', async () => {
    const actions = engine('ready-for-next-turn');
    actions.endCall.mockResolvedValue({ sessionId: 'ses_finished' });
    const { router } = renderPage();
    await userEvent.click(
      within(screen.getAllByRole('banner')[0]!).getByRole('button', { name: 'End call' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'End and review' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/sessions/ses_finished/report'),
    );
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('stays on the call when ending did not work', async () => {
    const actions = engine('ready-for-next-turn');
    actions.endCall.mockResolvedValue(null);
    const { router } = renderPage();
    await userEvent.click(
      within(screen.getAllByRole('banner')[0]!).getByRole('button', { name: 'End call' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'End and review' }));
    await waitFor(() => expect(actions.endCall).toHaveBeenCalled());
    expect(router.state.location.pathname).toBe('/calls/ses_fixture_maya');
  });

  it('leaves an empty call without a report: it closes the call and goes back to the scenarios', async () => {
    engine('end-nothing-to-review');
    const { router } = renderPage();
    await userEvent.click(
      within(screen.getAllByRole('banner')[0]!).getByRole('button', { name: 'End call' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Leave without a report' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/scenarios'));
    expect(api.deleteSession).toHaveBeenCalledWith('ses_fixture_maya');
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('still leaves when the empty call cannot be closed', async () => {
    vi.mocked(api.deleteSession).mockRejectedValueOnce(new Error('offline'));
    engine('end-nothing-to-review');
    const { router } = renderPage();
    await userEvent.click(
      within(screen.getAllByRole('banner')[0]!).getByRole('button', { name: 'End call' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Leave without a report' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/scenarios'));
  });
});
