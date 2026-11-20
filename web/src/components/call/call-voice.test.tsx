import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AppConfigDTO,
  SendMessageRequest,
  SendMessageResponse,
  SessionDTO,
} from '#shared/domain/api.ts';
import type * as ApiModule from '../../lib/api.ts';
import { ConfigProvider } from '../../lib/config.tsx';
import {
  getProfile,
  resetProfileForTests,
  saveProfile,
  updatePreferences,
} from '../../lib/profile.ts';
import { ThemeProvider } from '../../lib/theme.tsx';
import { ToastProvider } from '../../lib/toast.tsx';
import { usedVoice } from '../../lib/voice-sessions.ts';
import Call from '../../pages/Call.tsx';
import { fakeVoice, makeReply, makeSession, stubScreen, voiceSupport } from './call-test-kit.ts';

const api = vi.hoisted(() => ({
  config: vi.fn(),
  getSession: vi.fn(),
  sendMessage: vi.fn(),
  endSession: vi.fn(),
  deleteSession: vi.fn(),
  evaluate: vi.fn(),
}));
vi.mock('../../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, api };
});
vi.mock('../../lib/voice/index.ts', async () => {
  const kit = await import('./call-test-kit.ts');
  return { useVoiceCall: kit.fakeVoice.useFake, getVoiceSupport: () => kit.voiceSupport };
});

const CONFIG: AppConfigDTO = {
  app: { name: 'Firefly', version: '0.1.0' },
  provider: { kind: 'mock', label: 'Demo mode (built-in rules engine)', demo: true, notice: null },
  limits: { maxMessageChars: 1500, maxTraineeTurns: 60 },
  features: { devDiagnostics: false, testHooks: false },
};

const OPENING = 'Hi, I cannot sign in to the staff portal.';

function answer(text: string) {
  return async (_id: string, request: SendMessageRequest): Promise<SendMessageResponse> => {
    const response = makeReply(text);
    return { ...response, traineeTurn: { ...response.traineeTurn, text: request.text } };
  };
}

async function open(session: SessionDTO = makeSession()) {
  api.getSession.mockResolvedValue(session);
  render(
    <ThemeProvider>
      <ConfigProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={[`/calls/${session.id}`]}>
            <Routes>
              <Route path="/calls/:id" element={<Call />} />
              <Route path="/sign-in" element={<p>Sign in page</p>} />
              <Route path="/home" element={<p>Home page</p>} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </ConfigProvider>
    </ThemeProvider>,
  );
  await screen.findByRole('region', { name: 'Conversation' });
}

const box = () => screen.getByLabelText('Your reply to the customer');
const conversation = () => screen.getByRole('region', { name: 'Conversation' });
const callButton = () => screen.getByRole('button', { name: 'Voice call' });
const hasVoice = () => screen.queryByRole('button', { name: 'Voice call' }) !== null;

/** The engine reports something new, as it would while a call goes on. */
const engine = (state: Parameters<typeof fakeVoice.set>[0]) => act(() => fakeVoice.set(state));

/** A person who has a profile with voice switched on in Settings. */
function withVoice(on = true) {
  saveProfile({ name: 'Sam Rivera' });
  if (on) updatePreferences({ voice: true });
}

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  resetProfileForTests();
  fakeVoice.reset();
  stubScreen({ wide: true });
  Element.prototype.scrollTo = () => undefined;
  api.config.mockResolvedValue(CONFIG);
});
afterEach(() => vi.unstubAllGlobals());

describe('voice is off until it is turned on', () => {
  it('shows no voice controls, no Listen buttons and a quiet way to find out about voice', async () => {
    withVoice(false);
    await open();
    expect(hasVoice()).toBe(false);
    expect(screen.queryByRole('button', { name: 'Talk' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Listen/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Voice (Beta)' })).toBeVisible();
    expect(fakeVoice.options.enabled).toBe(false);
  });

  it('explains what voice does first, and turns it on only when asked to', async () => {
    withVoice(false);
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole('button', { name: 'Voice (Beta)' }));
    const dialog = screen.getByRole('dialog', { name: 'Turn on voice (Beta)?' });
    expect(within(dialog).getByText(/never records, keeps or uploads audio/)).toBeVisible();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(getProfile()?.preferences.voice).toBe(false);
    expect(hasVoice()).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Voice (Beta)' }));
    await user.click(screen.getByRole('button', { name: 'Turn on voice' }));
    expect(getProfile()?.preferences.voice).toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(callButton()).toBeVisible();
    expect(callButton()).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Voice (Beta)' })).not.toBeInTheDocument();
  });

  it('says a profile is needed, instead of asking, when there is none to keep the choice in', async () => {
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole('button', { name: 'Voice (Beta)' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Create your profile' });
    expect(link).toHaveAttribute('href', '/sign-in');
    expect(link.parentElement).toHaveTextContent('Create your profile to use voice.');
    expect(getProfile()).toBeNull();
  });
});

describe('a voice call', () => {
  it('offers the controls with a visible label, and typing keeps working', async () => {
    withVoice();
    const user = userEvent.setup();
    await open();
    expect(screen.getByText('Voice (Beta)')).toBeVisible();
    expect(callButton()).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('switch', { name: 'Hands-free' })).not.toBeChecked();
    expect(screen.queryByRole('button', { name: 'Talk' })).not.toBeInTheDocument();
    await user.click(box());
    await user.paste('Typed, not spoken');
    expect(box()).toHaveValue('Typed, not spoken');
  });

  it('starts from a click, then offers talk, mute and the stop button while the customer speaks', async () => {
    withVoice();
    const user = userEvent.setup();
    await open();
    await user.click(callButton());
    expect(fakeVoice.actions.start).toHaveBeenCalledTimes(1);
    expect(callButton()).toHaveAttribute('aria-pressed', 'true');
    expect(fakeVoice.options).toMatchObject({
      enabled: true,
      speakCustomer: true,
      handsFree: false,
      voiceSeed: 'Maya Okafor',
      mood: 'frustrated',
      busy: false,
    });

    await user.click(screen.getByRole('button', { name: 'Talk' }));
    expect(fakeVoice.actions.talk).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Mute' }));
    expect(fakeVoice.actions.toggleMute).toHaveBeenCalledTimes(1);

    await engine({ status: 'customer-speaking', customerSpeaking: true });
    await user.click(screen.getByRole('button', { name: "Stop Maya Okafor's voice" }));
    expect(fakeVoice.actions.stopSpeaking).toHaveBeenCalled();
    // The presence stirs while the voice plays.
    expect(document.querySelector('[data-sig="presence"]')).toHaveAttribute('data-typing');
  });

  it('says in words what is happening, and shows what is being heard as it is said', async () => {
    withVoice();
    const user = userEvent.setup();
    await open();
    await user.click(callButton());
    const line = () => document.querySelector('.vc-status') as HTMLElement;

    await engine({ status: 'connecting' });
    expect(line()).toHaveTextContent('Connecting…');
    expect(screen.getByRole('button', { name: 'Talk' })).toBeDisabled();

    await engine({
      status: 'listening',
      interim: 'Can you tell me',
      recognitionMode: 'browser-service',
    });
    expect(line()).toHaveTextContent('Listening…');
    expect(line()).toHaveAttribute('role', 'status');
    expect(screen.getByText('“Can you tell me”')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Done talking' })).toBeEnabled();
    expect(screen.getByText(/online speech service is recognising your speech/)).toBeVisible();

    await engine({ status: 'muted', muted: true, interim: '', recognitionMode: 'on-device' });
    expect(line()).toHaveTextContent('Microphone muted.');
    expect(screen.getByRole('button', { name: 'Mute' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Talk' })).toBeDisabled();
    expect(screen.getByText('Your speech is recognised on this device.')).toBeVisible();

    await engine({ status: 'thinking', muted: false });
    expect(line()).toHaveTextContent('Waiting for Maya Okafor…');
    await engine({ status: 'customer-speaking', customerSpeaking: true });
    expect(line()).toHaveTextContent('Maya Okafor is speaking…');
    await engine({
      status: 'idle',
      customerSpeaking: false,
      hint: 'Nothing was heard. Check your microphone, then try again.',
    });
    expect(line()).toHaveTextContent('Press Talk to speak.');
    expect(
      screen.getByText('Nothing was heard. Check your microphone, then try again.'),
    ).toBeVisible();
  });

  it('hangs up when the call button is pressed again', async () => {
    withVoice();
    const user = userEvent.setup();
    await open();
    await user.click(callButton());
    await user.click(callButton());
    expect(fakeVoice.actions.stop).toHaveBeenCalledTimes(1);
    expect(callButton()).toHaveAttribute('aria-pressed', 'false');
    expect(fakeVoice.options.enabled).toBe(false);
  });

  it('switches to hands-free when asked to', async () => {
    withVoice();
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole('switch', { name: 'Hands-free' }));
    expect(fakeVoice.options.handsFree).toBe(true);
  });
});

describe('what spoken words do', () => {
  it('hands-free: a sentence goes out as the message, and the call is marked as having used voice', async () => {
    withVoice();
    const user = userEvent.setup();
    api.sendMessage.mockImplementation(answer('Last night.'));
    await open();
    await user.click(screen.getByRole('switch', { name: 'Hands-free' }));
    await user.click(callButton());
    expect(usedVoice('session-1')).toBe(false);

    let finished: Promise<void> | void = undefined;
    await act(async () => {
      finished = fakeVoice.options.onUtterance('When did it stop working?');
      await finished;
    });
    expect(finished).toBeInstanceOf(Promise);
    expect(api.sendMessage).toHaveBeenCalledWith('session-1', {
      text: 'When did it stop working?',
      clientMessageId: expect.any(String),
    });
    expect(await within(conversation()).findByText('Last night.')).toBeVisible();
    expect(usedVoice('session-1')).toBe(true);
  });

  it('push to talk: a sentence goes into the box to be read and corrected, and is not sent', async () => {
    withVoice();
    const user = userEvent.setup();
    api.sendMessage.mockImplementation(answer('Fine.'));
    await open();
    await user.click(callButton());
    await user.click(box());
    await user.paste('Hello.');
    await act(async () => {
      fakeVoice.options.onUtterance('can you tell me the error');
    });
    expect(box()).toHaveValue('Hello. can you tell me the error');
    expect(box()).toHaveFocus();
    expect(api.sendMessage).not.toHaveBeenCalled();
    expect(usedVoice('session-1')).toBe(true);
    await engine({ status: 'idle' });
    expect(document.querySelector('.vc-status')).toHaveTextContent(
      'Check the words, then press Send.',
    );

    await user.keyboard('{Enter}');
    expect(api.sendMessage).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({ text: 'Hello. can you tell me the error' }),
    );
  });

  it('hands-free: a sentence that cannot be sent goes into the box instead of being lost', async () => {
    withVoice();
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole('switch', { name: 'Hands-free' }));
    await user.click(callButton());
    await act(async () => {
      fakeVoice.options.onUtterance('x'.repeat(1600));
    });
    expect(api.sendMessage).not.toHaveBeenCalled();
    expect(box()).toHaveValue('x'.repeat(1600));
  });

  it('typing or sending takes the turn, so the customer\u2019s voice stops', async () => {
    withVoice();
    const user = userEvent.setup();
    api.sendMessage.mockImplementation(answer('Okay.'));
    await open();
    await user.click(callButton());
    fakeVoice.actions.stopSpeaking.mockClear();
    await user.click(box());
    await user.paste('Sorry to interrupt.');
    expect(fakeVoice.actions.stopSpeaking).toHaveBeenCalled();
    fakeVoice.actions.stopSpeaking.mockClear();
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(fakeVoice.actions.stopSpeaking).toHaveBeenCalled();
  });
});

describe('hearing the customer', () => {
  it('reads the customer who spoke last once the line is open, and each new reply once', async () => {
    withVoice();
    const user = userEvent.setup();
    api.sendMessage.mockImplementation(answer('It started last night.'));
    await open();
    expect(fakeVoice.actions.speakCustomerReply).not.toHaveBeenCalled();
    await user.click(callButton());
    expect(fakeVoice.actions.speakCustomerReply).toHaveBeenCalledTimes(1);
    expect(fakeVoice.actions.speakCustomerReply).toHaveBeenCalledWith(expect.any(String), OPENING);

    await user.click(box());
    await user.paste('When did it start?');
    await user.keyboard('{Enter}');
    await within(conversation()).findByText('It started last night.');
    expect(fakeVoice.actions.speakCustomerReply).toHaveBeenCalledTimes(2);
    expect(fakeVoice.actions.speakCustomerReply).toHaveBeenLastCalledWith(
      expect.any(String),
      'It started last night.',
    );
  });

  it('does not read replies aloud when no voice call is on', async () => {
    withVoice();
    const user = userEvent.setup();
    api.sendMessage.mockImplementation(answer('Quietly.'));
    await open();
    await user.click(box());
    await user.paste('Hello');
    await user.keyboard('{Enter}');
    await within(conversation()).findByText('Quietly.');
    expect(fakeVoice.actions.speakCustomerReply).not.toHaveBeenCalled();
  });

  it('adds a Listen button to each customer message that reads that message aloud', async () => {
    withVoice();
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole('button', { name: /^Listen to Maya Okafor/ }));
    expect(fakeVoice.actions.replay).toHaveBeenCalledWith(OPENING);
  });

  it('does not say a reply twice to a screen reader while the customer is speaking it', async () => {
    withVoice();
    const user = userEvent.setup();
    api.sendMessage.mockImplementation(answer('Spoken reply.'));
    await open();
    await user.click(callButton());
    await user.click(box());
    await user.paste('Hello');
    await user.keyboard('{Enter}');
    await within(conversation()).findByText('Spoken reply.');
    expect(screen.queryByText(/Maya Okafor replied:/)).not.toBeInTheDocument();
  });
});

describe('when voice cannot be used', () => {
  const noMic = {
    ...voiceSupport,
    recognition: false,
    reason: 'Voice input needs Chrome or Edge.',
  };

  it('says in one sentence why, and still lets the person listen to a reply', async () => {
    withVoice();
    await open();
    await engine({ support: noMic });
    expect(hasVoice()).toBe(false);
    const note = screen.getByText(/Voice input needs Chrome or Edge\./);
    expect(note).toHaveTextContent(
      'Voice (Beta): Voice input needs Chrome or Edge. You can still use Listen on a reply to hear it.',
    );
    expect(screen.getByRole('button', { name: /^Listen to Maya Okafor/ })).toBeVisible();
  });

  it('offers nothing to listen with when the browser cannot speak either', async () => {
    withVoice();
    await open();
    await engine({ support: { ...noMic, synthesis: false } });
    expect(screen.getByText(/Voice input needs Chrome or Edge\./)).not.toHaveTextContent('Listen');
    expect(screen.queryByRole('button', { name: /^Listen/ })).not.toBeInTheDocument();
  });

  it('shows what went wrong in plain words with a way to try again, and never blocks typing', async () => {
    withVoice();
    const user = userEvent.setup();
    await open();
    await user.click(callButton());
    await engine({
      status: 'error',
      error: {
        code: 'mic-denied',
        message:
          'Microphone access is blocked. Allow it for this site in your browser settings, then try again.',
      },
    });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Microphone access is blocked.');
    fakeVoice.actions.start.mockClear();
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(fakeVoice.actions.start).toHaveBeenCalledTimes(1);
    await user.click(box());
    await user.paste('Still typing');
    expect(box()).toHaveValue('Still typing');
    expect(box()).toBeEnabled();
  });

  it('can be switched off in the profile while a call is on, which ends the call', async () => {
    withVoice();
    const user = userEvent.setup();
    await open();
    await user.click(callButton());
    act(() => updatePreferences({ voice: false }));
    expect(hasVoice()).toBe(false);
    expect(fakeVoice.options.enabled).toBe(false);
    expect(screen.getByRole('button', { name: 'Voice (Beta)' })).toBeVisible();
  });
});

describe('ending a call that used voice', () => {
  it('hangs up first', async () => {
    withVoice();
    const user = userEvent.setup();
    const base = makeSession();
    api.endSession.mockResolvedValue(makeSession({ status: 'completed' }));
    await open(
      makeSession({
        turns: [
          ...base.turns,
          {
            index: 2,
            role: 'trainee',
            text: 'Hello',
            createdAt: '2025-01-01T10:00:05.000Z',
            source: 'trainee',
          },
        ],
      }),
    );
    await user.click(callButton());
    await user.click(screen.getByRole('button', { name: 'End call' }));
    await user.click(screen.getByRole('button', { name: 'End call and get feedback' }));
    expect(fakeVoice.actions.stop).toHaveBeenCalled();
  });
});
