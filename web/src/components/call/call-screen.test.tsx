import { act, render, screen, waitFor, within } from '@testing-library/react';
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
import { ApiError } from '../../lib/api.ts';
import { ConfigProvider } from '../../lib/config.tsx';
import { ThemeProvider } from '../../lib/theme.tsx';
import { ToastProvider } from '../../lib/toast.tsx';
import { markVoiceSession, usedVoice } from '../../lib/voice-sessions.ts';
import { resetProfileForTests } from '../../lib/profile.ts';
import Call from '../../pages/Call.tsx';
import { fakeVoice, immersive, makeReply, makeSession, stubScreen } from './call-test-kit.ts';

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** The server's answer to a message: the customer says `text` and the trainee's own words come back. */
function answer(text: string, over: Partial<SessionDTO['state']> = {}) {
  return async (_id: string, request: SendMessageRequest): Promise<SendMessageResponse> => {
    const response = makeReply(text, over);
    return { ...response, traineeTurn: { ...response.traineeTurn, text: request.text } };
  };
}

function renderCall(id = 'session-1') {
  return render(
    <ThemeProvider>
      <ConfigProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={[`/calls/${id}`]}>
            <Routes>
              <Route path="/calls/:id" element={<Call />} />
              <Route path="/sessions/:id/report" element={<p>Report page</p>} />
              <Route path="/sessions/:id/transcript" element={<p>Transcript page</p>} />
              <Route path="/home" element={<p>Home page</p>} />
              <Route path="/scenarios" element={<p>Scenario library</p>} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </ConfigProvider>
    </ThemeProvider>,
  );
}

const box = () => screen.getByLabelText('Your reply to the customer');
const conversation = () => screen.getByRole('region', { name: 'Conversation' });
const messages = () => within(conversation()).getAllByRole('listitem');
const ready = () => screen.findByRole('region', { name: 'Conversation' });

type User = ReturnType<typeof userEvent.setup>;

/** Puts words in the box in one go (typing each letter re-renders the whole screen), then optionally presses Enter. */
async function say(user: User, text: string, send = true) {
  await user.click(box());
  await user.paste(text);
  if (send) await user.keyboard('{Enter}');
}

async function open(session: SessionDTO = makeSession()) {
  api.getSession.mockResolvedValue(session);
  renderCall(session.id);
  await ready();
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

describe('opening the call', () => {
  it('shows the live header: a title, who is calling, a running clock and a clear way to end', async () => {
    await open();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Locked out after a password reset' }),
    ).toBeVisible();
    expect(screen.getByText('Call in progress')).toBeVisible();
    expect(screen.getByText(/Call with Maya Okafor/)).toBeVisible();
    expect(screen.getByRole('timer', { name: 'Call length' })).toHaveTextContent(/^\d+:\d{2}$/);
    expect(screen.getByRole('timer')).toHaveAttribute('aria-live', 'off');
    expect(screen.getByRole('button', { name: 'End call' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Call details' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sound effects' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(await screen.findByText('Demo mode')).toBeVisible();
    expect(document.title).toBe('Call: Locked out after a password reset · Firefly');
    // The way home keeps the call open, and the dashboard is /home.
    expect(screen.getByRole('link', { name: /Firefly home/ })).toHaveAttribute('href', '/home');
  });

  it('puts the customer on a stage that follows their mood and repeats what they said last', async () => {
    await open();
    const stage = screen.getByRole('region', { name: 'Maya Okafor, the customer' });
    expect(within(stage).getByText('High impact')).toBeVisible();
    expect(stage.querySelector('svg.ill-customer')).toHaveAttribute('data-mood', 'frustrated');
    expect(stage.querySelector('.cstage-bubble')).toHaveTextContent(
      'Hi, I cannot sign in to the staff portal.',
    );
    // The chat list is the accessible source of the message; the bubble is a decorative copy.
    expect(
      within(conversation()).getByText('Hi, I cannot sign in to the staff portal.'),
    ).toBeVisible();
    expect(messages()).toHaveLength(1);
  });

  it('shows a compact strip instead of the stage on a narrow screen, with the details as a sheet', async () => {
    stubScreen({ wide: false });
    const user = userEvent.setup();
    await open();
    expect(document.querySelector('.cstage')).toBeNull();
    expect(document.querySelector('.cstrip')).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Call details' }));
    expect(screen.getByRole('dialog', { name: 'Call details' })).toHaveClass('sheet');
  });

  it('says plainly when the call cannot be found, and offers a way on', async () => {
    api.getSession.mockRejectedValue(
      new ApiError(404, 'not_found', 'That session was not found.', false),
    );
    renderCall();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'We cannot find that call' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Choose a scenario' })).toHaveAttribute(
      'href',
      '/scenarios',
    );
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/home');
  });

  it('says what went wrong when the call cannot be opened, and tries again on request', async () => {
    const user = userEvent.setup();
    api.getSession.mockRejectedValueOnce(
      new ApiError(503, 'internal', 'The server is not answering.', true),
    );
    renderCall();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'We could not open this call' }),
    ).toBeVisible();
    api.getSession.mockResolvedValue(makeSession());
    await user.click(screen.getByRole('button', { name: /try again/i }));
    await ready();
  });

  it('shows a loading state while the call opens', () => {
    api.getSession.mockReturnValue(new Promise(() => undefined));
    renderCall();
    expect(screen.getByRole('status', { name: 'Opening your call' })).toBeInTheDocument();
  });

  it('hands over to the report when the call has already been scored', async () => {
    api.getSession.mockResolvedValue(makeSession({ status: 'completed' }));
    renderCall();
    expect(await screen.findByText('Report page')).toBeVisible();
  });
});

describe('talking to the customer', () => {
  it('sends with Enter, shows the reply, announces it once and keeps the box ready', async () => {
    const user = userEvent.setup();
    api.sendMessage.mockImplementation(answer('Last night, about eight.'));
    await open();
    await say(user, 'When did it stop working?');
    expect(await within(conversation()).findByText('Last night, about eight.')).toBeVisible();
    expect(api.sendMessage).toHaveBeenCalledTimes(1);
    expect(api.sendMessage).toHaveBeenCalledWith('session-1', {
      text: 'When did it stop working?',
      clientMessageId: expect.stringMatching(/^[\w-]{20,}$/),
    });
    expect(messages()).toHaveLength(3);
    expect(box()).toHaveValue('');
    expect(box()).toHaveFocus();
    const announcements = screen
      .getAllByRole('status')
      .filter((el) => /replied:/.test(el.textContent ?? ''));
    expect(announcements).toHaveLength(1);
    expect(announcements[0]).toHaveTextContent('Maya Okafor replied: Last night, about eight.');
    // The stage repeats the newest reply for sighted people only.
    expect(document.querySelector('.cstage-bubble')).toHaveTextContent('Last night, about eight.');
  });

  it('adds a line with Shift+Enter instead of sending', async () => {
    const user = userEvent.setup();
    await open();
    await user.type(box(), 'One{Shift>}{Enter}{/Shift}Two');
    expect(box()).toHaveValue('One\nTwo');
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it('shows who is typing while the customer replies, and sends nothing twice meanwhile', async () => {
    const user = userEvent.setup();
    const pending = deferred<SendMessageResponse>();
    api.sendMessage.mockReturnValueOnce(pending.promise);
    await open();
    await say(user, 'Hello Maya');
    expect(await screen.findByText('Maya Okafor is typing…')).toBeInTheDocument();
    expect(document.querySelector('svg.ill-customer')).toHaveAttribute('data-speaking', 'true');
    // Typing ahead is fine, but nothing is sent until the customer has answered.
    await say(user, 'Another thing');
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    expect(api.sendMessage).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'End call' })).toBeEnabled();

    await act(async () => pending.resolve(makeReply('Hello.')));
    expect(await within(conversation()).findByText('Hello.')).toBeVisible();
    expect(screen.queryByText('Maya Okafor is typing…')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(api.sendMessage).toHaveBeenCalledTimes(2);
  });

  it('keeps a message the customer could not answer, and retries it with the same id', async () => {
    const user = userEvent.setup();
    api.sendMessage.mockRejectedValueOnce(
      new ApiError(502, 'provider_unavailable', 'The simulated customer is unavailable.', true, {
        traineeTurn: makeReply('').traineeTurn,
      }),
    );
    await open();
    await say(user, 'Can you describe the error?');
    const alert = await within(conversation()).findByRole('alert');
    expect(alert).toHaveTextContent('Saved.');
    expect(alert).toHaveTextContent('The simulated customer is unavailable.');

    api.sendMessage.mockImplementationOnce(answer('It says access denied.'));
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await within(conversation()).findByText('It says access denied.')).toBeVisible();
    expect(within(conversation()).queryByRole('alert')).not.toBeInTheDocument();
    expect(api.sendMessage).toHaveBeenCalledTimes(2);
    const [first, second] = api.sendMessage.mock.calls.map((call) => call[1] as SendMessageRequest);
    expect(second?.clientMessageId).toBe(first?.clientMessageId);
    // The message is in the conversation once, not twice.
    expect(within(conversation()).getAllByText('Can you describe the error?')).toHaveLength(1);
  });

  it('offers to resume a message that was saved but never answered, with its original id', async () => {
    const user = userEvent.setup();
    const base = makeSession();
    api.sendMessage.mockImplementation(answer('Sorry, I drifted off.'));
    await open(
      makeSession({
        turns: [
          ...base.turns,
          {
            index: 2,
            role: 'trainee',
            text: 'Are you there?',
            createdAt: '2025-01-01T10:00:05.000Z',
            source: 'trainee',
          },
        ],
        awaitingReply: { clientMessageId: 'abc12345-original', turnIndex: 2 },
      }),
    );
    const alert = within(conversation()).getByRole('alert');
    expect(alert).toHaveTextContent('has not replied yet');
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await within(conversation()).findByText('Sorry, I drifted off.')).toBeVisible();
    expect(api.sendMessage).toHaveBeenCalledWith('session-1', {
      text: 'Are you there?',
      clientMessageId: 'abc12345-original',
    });
  });

  it('uses the message length from the settings and says how far over it is', async () => {
    const user = userEvent.setup();
    api.config.mockResolvedValue({ ...CONFIG, limits: { ...CONFIG.limits, maxMessageChars: 30 } });
    await open();
    await say(user, 'This message is rather longer than allowed', false);
    expect(await screen.findByText('12 characters over the 30 limit')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    await user.keyboard('{Enter}');
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it('warns before sending something that looks like personal data', async () => {
    const user = userEvent.setup();
    await open();
    await say(user, 'You can reach me on jane.doe@example.com', false);
    expect(screen.getByText(/This looks like it contains an email address/)).toBeVisible();
  });

  it('tells the person when details were removed from what they sent', async () => {
    const user = userEvent.setup();
    api.sendMessage.mockImplementation(async (id: string, request: SendMessageRequest) => ({
      ...(await answer('Thanks.')(id, request)),
      redactions: ['email'],
    }));
    await open();
    await say(user, 'Mail jo@example.com');
    expect(await screen.findByText('Details removed')).toBeVisible();
  });

  it('blocks the box at the message limit and says what to do', async () => {
    const user = userEvent.setup();
    api.sendMessage.mockRejectedValueOnce(
      new ApiError(409, 'turn_limit_reached', 'No more messages.', false),
    );
    await open();
    await say(user, 'One more');
    expect(await screen.findByText(/reached its message limit/)).toBeVisible();
    expect(box()).toBeDisabled();
    expect(within(conversation()).queryByText('One more')).not.toBeInTheDocument();
  });

  it('shows the customer going quiet in guided practice', async () => {
    const user = userEvent.setup();
    api.sendMessage.mockImplementation(answer('Hm.', { silent: true }));
    await open();
    await say(user, 'Any ideas?');
    expect(await screen.findByText('Maya Okafor has gone quiet.')).toBeVisible();
  });

  it('shows no sign of it in immersive practice', async () => {
    const user = userEvent.setup();
    api.sendMessage.mockImplementation(answer('Hm.', { silent: true }));
    await open(immersive(makeSession()));
    await say(user, 'Any ideas?');
    expect(await within(conversation()).findByText('Hm.')).toBeVisible();
    expect(screen.queryByText(/gone quiet/)).not.toBeInTheDocument();
  });
});

describe('guided and immersive practice', () => {
  it('guided practice shows the mood, the facts uncovered and ideas for what to say', async () => {
    await open();
    expect(screen.getByText('Customer mood')).toBeVisible();
    expect(screen.getByText(/uncovered so far/)).toHaveTextContent('2 facts uncovered so far');
    const ideas = screen.getByRole('group', { name: 'Ideas for what to say' });
    expect(
      within(ideas)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Acknowledge the impact', 'Ask when it started', 'Clarify the error message']);
  });

  it('an idea goes into the box for the person to change and is never sent', async () => {
    const user = userEvent.setup();
    await open();
    await say(user, 'Hello Maya.', false);
    await user.click(screen.getByRole('button', { name: 'Ask when it started' }));
    expect(box()).toHaveValue(
      'Hello Maya. When did you first notice this, and was it working before? ',
    );
    expect(box()).toHaveFocus();
    expect(api.sendMessage).not.toHaveBeenCalled();
    // A used idea makes way for another.
    expect(screen.queryByRole('button', { name: 'Ask when it started' })).not.toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: /Ask what|Check who|Confirm what|Agree the/ }).length,
    ).toBeGreaterThan(0);
  });

  it('immersive practice shows no mood label, meter, count or ideas, and a calm face whatever the mood', async () => {
    await open(immersive(makeSession()));
    expect(screen.queryByText('Customer mood')).not.toBeInTheDocument();
    expect(screen.queryByText(/uncovered so far/)).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Ideas for what to say' })).not.toBeInTheDocument();
    expect(screen.queryByText('Frustrated')).not.toBeInTheDocument();
    expect(screen.getByText('Immersive')).toBeVisible();
    expect(document.querySelector('svg.ill-customer')).toHaveAttribute('data-mood', 'calm');
  });

  it('follows the customer\u2019s mood on the stage as it changes', async () => {
    const user = userEvent.setup();
    api.sendMessage.mockImplementation(
      answer('This is unacceptable.', { band: { id: 'angry', label: 'Angry' } }),
    );
    await open();
    await say(user, 'Please wait');
    expect(
      await screen.findByText(/Maya Okafor's mood shifted from Frustrated to Angry/),
    ).toBeVisible();
    const stage = screen.getByRole('region', { name: 'Maya Okafor, the customer' });
    expect(stage.querySelector('svg.ill-customer')).toHaveAttribute('data-mood', 'angry');
    expect(within(stage).getByText('Customer mood')).toBeVisible();
  });
});

describe('details and notes', () => {
  it('opens the briefing, keeps private notes in this tab and gives focus back', async () => {
    const user = userEvent.setup();
    await open();
    const opener = screen.getByRole('button', { name: 'Call details' });
    await user.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Call details' });
    expect(within(dialog).getByText('A customer cannot sign in.')).toBeVisible();
    expect(within(dialog).getByText('Find out what is happening.')).toBeVisible();
    expect(within(dialog).getByText('When it started')).toBeVisible();
    await user.click(within(dialog).getByLabelText('Private notes'));
    await user.paste('Ask about the phone');
    expect(sessionStorage.getItem('firefly.notes.session-1')).toBe('"Ask about the phone"');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('keeps the sound switch honest', async () => {
    const user = userEvent.setup();
    await open();
    const toggle = screen.getByRole('button', { name: 'Sound effects' });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('ending the call', () => {
  it('asks first, then ends the call and hands over to the report', async () => {
    const user = userEvent.setup();
    const base = makeSession();
    await open(
      makeSession({
        traineeTurns: 2,
        turns: [
          ...base.turns,
          {
            index: 2,
            role: 'trainee',
            text: 'Hello',
            createdAt: '2025-01-01T10:00:05.000Z',
            source: 'trainee',
          },
          {
            index: 3,
            role: 'customer',
            text: 'Hi',
            createdAt: '2025-01-01T10:00:06.000Z',
            source: 'live',
          },
          {
            index: 4,
            role: 'trainee',
            text: 'Tell me more',
            createdAt: '2025-01-01T10:00:07.000Z',
            source: 'trainee',
          },
          {
            index: 5,
            role: 'customer',
            text: 'Well',
            createdAt: '2025-01-01T10:00:08.000Z',
            source: 'live',
          },
        ],
      }),
    );
    const end = screen.getByRole('button', { name: 'End call' });
    await user.click(end);
    const dialog = screen.getByRole('dialog', { name: 'End this call?' });
    expect(within(dialog).getByText(/limited evidence/)).toBeVisible();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(end).toHaveFocus();

    api.endSession.mockResolvedValue(makeSession({ status: 'completed' }));
    await user.click(end);
    await user.click(screen.getByRole('button', { name: 'End call and get feedback' }));
    expect(api.endSession).toHaveBeenCalledWith('session-1');
    expect(await screen.findByText('Report page')).toBeVisible();
  });

  it('says so when the call could not be ended, and keeps it open', async () => {
    const user = userEvent.setup();
    const base = makeSession();
    api.endSession.mockRejectedValue(
      new ApiError(500, 'internal', 'Could not end the call.', true),
    );
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
    await user.click(screen.getByRole('button', { name: 'End call' }));
    await user.click(screen.getByRole('button', { name: 'End call and get feedback' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not end the call.');
    expect(screen.getByRole('dialog', { name: 'End this call?' })).toBeVisible();
  });

  it('lets a call with no messages be discarded, back to the home page', async () => {
    const user = userEvent.setup();
    api.deleteSession.mockResolvedValue(undefined);
    markVoiceSession('session-1');
    await open();
    await user.click(screen.getByRole('button', { name: 'End call' }));
    const dialog = screen.getByRole('dialog', { name: 'Nothing to review yet' });
    expect(
      within(dialog).queryByRole('button', { name: 'End call and get feedback' }),
    ).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Discard call' }));
    expect(api.deleteSession).toHaveBeenCalledWith('session-1');
    expect(await screen.findByText('Home page')).toBeVisible();
    expect(usedVoice('session-1')).toBe(false);
  });
});

describe('the wrap-up while the report is built', () => {
  const completing = (phase: SessionDTO['evaluationPhase'], over: Partial<SessionDTO> = {}) =>
    makeSession({ status: 'completing', evaluationPhase: phase, traineeTurns: 3, ...over });

  it('lists what has really been done, what is under way and what is next', async () => {
    api.getSession.mockResolvedValue(completing('scoring'));
    renderCall();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Wrapping up your call' }),
    ).toHaveFocus();
    const steps = screen.getByRole('list', { name: 'Progress' });
    const states = within(steps)
      .getAllByRole('listitem')
      .map((item) => [
        item.textContent?.replace(/,\s*(done|in progress|waiting)$/, ''),
        item.getAttribute('data-state'),
      ]);
    expect(states).toEqual([
      ['Transcript saved', 'done'],
      ['Reviewing what you uncovered', 'done'],
      [
        'Finding evidence and scoring' +
          'Matching what you said to the six coaching areas, turn by turn.',
        'current',
      ],
      ['Building your coaching report', 'todo'],
      ['Report ready', 'todo'],
    ]);
    expect(
      screen
        .getAllByRole('status')
        .some((el) => el.textContent === 'Finding evidence and scoring.'),
    ).toBe(true);
    expect(screen.getByText(/Scores are for practice, not performance assessment/)).toBeVisible();
    // Honest about a short call before the report says it in detail, and about what may follow.
    expect(
      screen.getByText(
        /This was a short call \(3 replies\), so the report will rest on limited evidence\./,
      ),
    ).toBeVisible();
    expect(screen.getByText(/it will be marked as ended early/)).toBeVisible();
  });

  it('says nothing about a short call when there were plenty of replies', async () => {
    api.getSession.mockResolvedValue(completing('scoring', { traineeTurns: 8 }));
    renderCall();
    await screen.findByRole('heading', { level: 1, name: 'Wrapping up your call' });
    expect(screen.queryByText(/short call/)).not.toBeInTheDocument();
  });

  it('says so in its own words when the call was ended early', async () => {
    api.getSession.mockResolvedValue(
      completing('transcript_locked', { completion: 'ended-early' }),
    );
    renderCall();
    expect(await screen.findByText(/You ended this call early/)).toBeVisible();
  });

  it('follows the server until the report exists, then opens it', async () => {
    api.getSession
      .mockResolvedValueOnce(completing('scoring'))
      .mockResolvedValueOnce(completing('building_report'))
      .mockResolvedValue(makeSession({ status: 'completed' }));
    renderCall();
    await screen.findByRole('heading', { level: 1, name: 'Wrapping up your call' });
    expect(await screen.findByText('Report page', undefined, { timeout: 5000 })).toBeVisible();
  }, 10_000);

  it('explains a failure, keeps the transcript safe and tries again on request', async () => {
    const user = userEvent.setup();
    api.getSession.mockResolvedValue(
      makeSession({
        status: 'evaluation_failed',
        evaluationError: { message: 'The coaching service did not answer.', retryable: true },
      }),
    );
    renderCall();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'We could not finish your report' }),
    ).toHaveFocus();
    expect(screen.getByText('The coaching service did not answer.')).toBeVisible();
    expect(screen.getByText(/Your transcript is saved/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/home');
    expect(screen.getByRole('link', { name: 'View transcript' })).toHaveAttribute(
      'href',
      '/sessions/session-1/transcript',
    );

    api.evaluate.mockRejectedValueOnce(
      new ApiError(502, 'evaluation_failed', 'Still not working.', true),
    );
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Still not working.');

    api.evaluate.mockResolvedValueOnce(completing('transcript_locked'));
    api.getSession.mockResolvedValue(completing('transcript_locked'));
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 1, name: 'Wrapping up your call' }),
      ).toBeVisible(),
    );
  });

  it('offers no retry when the failure cannot be retried', async () => {
    api.getSession.mockResolvedValue(
      makeSession({
        status: 'evaluation_failed',
        evaluationError: { message: 'This call cannot be scored.', retryable: false },
      }),
    );
    renderCall();
    await screen.findByText('This call cannot be scored.');
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });
});
