import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnnouncerProvider } from '../../design/index.ts';
import { api } from '../../lib/api.ts';
import { installFakes, type FakeEnv, type FakeOptions } from '../voice/testing/fakes.ts';
import {
  advance,
  apiError,
  connect,
  defaultOptions,
  FakeServer,
  flush,
  networkError,
  SESSION_ID,
} from '../call/testing.ts';
import { useCall } from '../call/useCall.ts';
import { VOICE_STATE_TEXT } from '../voice/states.ts';
import { CallWorkspace } from './CallWorkspace.tsx';
import { clearViewport, DEMO, mockViewport, WIDTH } from './test-utils.tsx';
import { installDialogShim } from '../../design/dialog-shim.ts';

// The call screen on the real call engine, with a fake server and a fake browser: what a trainee
// sees and can press from the first button to the report, including every way the call can fail.
// The engine's own rules are tested with it; these tests are about what that looks like and does on
// the screen, and that a failure never makes the same turn twice.

vi.mock('../../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    api: {
      getSession: vi.fn(),
      sendMessage: vi.fn(),
      endSession: vi.fn(),
      transcribe: vi.fn(),
      speakTurn: vi.fn(),
    },
  };
});

const mocked = vi.mocked(api);
const OPTIONS = defaultOptions();
// The status line speaks the voice layer's vocabulary, so these follow it, apart from the trainee's own
// turn: the screen says "Your turn" for a typed call (not "Typing", which reads as the customer typing)
// and "Listening to you" for a spoken one.
const LABEL = {
  typing: 'Your turn',
  tryAgain: VOICE_STATE_TEXT['retry-required'].label,
  replying: VOICE_STATE_TEXT['generating-customer-reply'].label,
  processing: VOICE_STATE_TEXT['processing-speech'].label,
  speaking: VOICE_STATE_TEXT['customer-speaking'].label,
  listening: 'Listening to you',
  ready: VOICE_STATE_TEXT['microphone-ready'].label,
};
let env: FakeEnv;

function Live({ onEnded }: { onEnded: (sessionId: string) => void }) {
  const call = useCall(SESSION_ID, OPTIONS);
  return (
    <AnnouncerProvider>
      <MemoryRouter>
        <main id="main">
          <CallWorkspace
            snapshot={call.snapshot}
            actions={call.actions}
            provider={DEMO}
            onEnded={onEnded}
          />
        </main>
      </MemoryRouter>
    </AnnouncerProvider>
  );
}

async function mountScreen(options: { server?: FakeServer; fakes?: FakeOptions } = {}) {
  const server = options.server ?? new FakeServer();
  connect(mocked, server);
  env = installFakes({
    recognition: false,
    synthesis: false,
    secureContext: true,
    ...options.fakes,
  });
  const onEnded = vi.fn();
  render(<Live onEnded={onEnded} />);
  await flush();
  return { server, onEnded };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-02T10:00:30.000Z'));
  vi.clearAllMocks();
  installDialogShim();
  mockViewport(WIDTH.wide);
});

afterEach(() => {
  cleanup();
  env?.uninstall();
  clearViewport();
  vi.useRealTimers();
});

const press = async (name: string | RegExp) => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
  await flush();
};
/** Presses a button of the problem card, when the same words are also on the call controls. */
const pressInCard = async (name: string) => {
  await act(async () => {
    fireEvent.click(within(card() as HTMLElement).getByRole('button', { name }));
  });
  await flush();
};
const typeAndSend = async (text: string) => {
  const box = screen.getByRole('textbox', { name: 'Your reply' });
  fireEvent.change(box, { target: { value: text } });
  await act(async () => {
    fireEvent.keyDown(box, { key: 'Enter' });
  });
  await flush();
};
const customerRegion = () => screen.getByRole('region', { name: 'Customer' });
const status = () => customerRegion().querySelector('.cw-status__label')?.textContent;
const transcript = () => screen.getByRole('log', { name: 'Call transcript' });
const controls = () => screen.getByRole('group', { name: 'Call controls' });
const card = () => document.querySelector<HTMLElement>('.cw-recovery');
const confirmation = () => document.querySelector<HTMLElement>('.ff-message--success');
const occurrences = (text: string) => within(transcript()).queryAllByText(text).length;
const bar = () => document.querySelector('header') as HTMLElement;

describe('a typed call', () => {
  it('starts without ever asking for the microphone, and holds a conversation', async () => {
    await mountScreen();
    await press('Start text call');
    expect(env.mic.getUserMedia).not.toHaveBeenCalled();
    expect(status()).toBe(LABEL.typing);
    expect(screen.getByRole('textbox', { name: 'Your reply' })).toHaveFocus();
    expect(
      within(controls())
        .getAllByRole('button')
        .map((item) => item.textContent),
    ).toEqual(['Return to voice', 'Settings']);

    await typeAndSend('Hello, this is Microsoft support.');
    expect(occurrences('Hello, this is Microsoft support.')).toBe(1);
    expect(within(transcript()).getAllByText(/./, { selector: '.cw-turn__text' })).toHaveLength(3);
    expect(screen.getByRole('textbox', { name: 'Your reply' })).toHaveValue('');
    expect(card()).toBeNull();
  });
});

describe('a message that cannot be sent', () => {
  it('is kept, and sent once by Retry, however many times Retry is pressed', async () => {
    const server = new FakeServer();
    server.sendSteps.push(() => apiError(502, 'provider_unavailable', true));
    await mountScreen({ server });
    await press('Start text call');
    await typeAndSend('Hello');

    // What happened, what was kept, one Retry, the message in the transcript, and the box waiting.
    expect(card()).toHaveTextContent('The customer could not reply.');
    expect(card()).toHaveTextContent('Your message was saved.');
    expect(screen.getAllByRole('button', { name: 'Retry' })).toHaveLength(1);
    expect(occurrences('Hello')).toBe(1);
    expect(within(transcript()).getByText('Not sent')).toBeInTheDocument();
    expect(status()).toBe(LABEL.tryAgain);
    expect(screen.getByRole('button', { name: 'Send' })).toHaveAccessibleDescription(
      'Retry your last message first.',
    );

    const retry = screen.getByRole('button', { name: 'Retry' });
    await act(async () => {
      fireEvent.click(retry);
      fireEvent.click(retry);
      fireEvent.click(retry);
    });
    await flush();

    const ids = server.sent.map((request) => request.clientMessageId);
    expect(ids).toHaveLength(2);
    expect(ids[1]).toBe(ids[0]);
    expect(occurrences('Hello')).toBe(1);
    expect(within(transcript()).queryByText('Not sent')).toBeNull();
    expect(within(transcript()).getAllByText(/./, { selector: '.cw-turn__text' })).toHaveLength(3);
    expect(card()).toBeNull();
    expect(confirmation()).toHaveTextContent('Message sent.');
    expect(status()).toBe(LABEL.typing);
    expect(screen.getByRole('button', { name: 'Send' })).not.toHaveAttribute('aria-disabled');

    await advance(4000);
    expect(confirmation()).toBeNull();
  });

  it('shows the retry working, in the card, before it says it worked', async () => {
    const server = new FakeServer();
    server.sendSteps.push(() => apiError(502, 'provider_unavailable', true));
    server.sendDelayMs = 3000;
    await mountScreen({ server });
    await press('Start text call');
    await act(async () => {
      fireEvent.change(screen.getByRole('textbox', { name: 'Your reply' }), {
        target: { value: 'Hello' },
      });
    });
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Your reply' }), { key: 'Enter' });
    });
    await advance(3100);
    expect(card()).toHaveTextContent('The customer could not reply.');

    await press('Retry');
    expect(status()).toBe('Retrying');
    expect(card()).toHaveTextContent('The customer could not reply.');
    expect(within(card() as HTMLElement).getByRole('button', { name: 'Retry' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(within(transcript()).getByText('Sending')).toBeInTheDocument();
    expect(confirmation()).toBeNull();

    await advance(3100);
    expect(card()).toBeNull();
    expect(confirmation()).toHaveTextContent('Message sent.');
    expect(occurrences('Hello')).toBe(1);
  });

  it('keeps a message through losing the network, and sends it by itself, once, when it is back', async () => {
    const server = new FakeServer();
    server.sendSteps.push(() => networkError());
    await mountScreen({ server });
    await press('Start text call');
    await typeAndSend('Hello');
    expect(card()).toHaveTextContent('You appear to be offline.');
    expect(occurrences('Hello')).toBe(1);
    expect(within(bar()).getByText('Reconnecting')).toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(new Event('online'));
      window.dispatchEvent(new Event('online'));
    });
    await flush();
    const ids = server.sent.map((request) => request.clientMessageId);
    expect(ids).toHaveLength(2);
    expect(ids[1]).toBe(ids[0]);
    expect(card()).toBeNull();
    expect(occurrences('Hello')).toBe(1);
    expect(within(bar()).getByText('Live')).toBeInTheDocument();
  });

  it('can be left safely: the dialog says the message is saved, and nothing is lost by ending', async () => {
    const server = new FakeServer();
    server.sendSteps.push(() => apiError(502, 'provider_unavailable', true));
    const { onEnded } = await mountScreen({ server });
    await press('Start text call');
    await typeAndSend('Hello');
    await press('End safely');
    expect(screen.getByRole('dialog', { name: 'End the call?' })).toBeInTheDocument();
    await press('End and review');
    expect(server.endCalls).toBe(1);
    expect(onEnded).toHaveBeenCalledExactlyOnceWith(SESSION_ID);
  });
});

describe('a spoken call, stage by stage', () => {
  it('shows each stage of a turn in words, and keeps Talk off while it is not the trainee’s turn', async () => {
    const server = new FakeServer();
    server.sendDelayMs = 2000;
    await mountScreen({ server });
    env.mic.mode = 'hang';
    await press('Start voice call');
    expect(screen.getByRole('button', { name: 'Waiting for permission' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(env.mic.getUserMedia).toHaveBeenCalledTimes(1);

    await act(async () => env.mic.settle('grant'));
    await flush();
    expect(status()).toBe('Customer speaking');
    // Hands-free: nothing to press to talk. The one control in the slot is how the trainee takes the
    // turn from the customer, and it is only there while the customer speaks.
    expect(within(controls()).queryByRole('button', { name: 'Talk' })).toBeNull();
    expect(
      within(controls()).getByRole('button', { name: 'Stop customer audio' }),
    ).not.toHaveAttribute('aria-disabled');
    expect(customerRegion().querySelector('.ff-avatar--speaking')).not.toBeNull();
    expect(transcript().querySelector('[aria-current="true"]')).not.toBeNull();

    await act(async () => env.element.latest().finish());
    await advance(400);
    expect(status()).toBe(LABEL.listening);
    expect(within(controls()).queryByRole('button', { name: 'Done speaking' })).toBeNull();
    expect(within(controls()).queryByRole('button', { name: 'Stop customer audio' })).toBeNull();
    expect(customerRegion().querySelector('.ff-avatar--speaking')).toBeNull();

    env.audio.analyserRms = 0.3;
    await act(async () => env.audio.speakSentence());
    await flush();
    // The words are in the transcript while the customer replies.
    expect(status()).toBe(LABEL.replying);
    expect(within(transcript()).getByText('Spoken message 1')).toBeInTheDocument();
    expect(within(transcript()).getByText('Sending')).toBeInTheDocument();

    await advance(2100);
    expect(status()).toBe('Customer speaking');
    expect(within(transcript()).queryByText('Sending')).toBeNull();
    expect(occurrences('Spoken message 1')).toBe(1);
  });

  it('shows a placeholder, not a percentage, while speech is turned into text', async () => {
    const server = new FakeServer();
    server.transcripts.push('hang');
    await mountScreen({ server });
    await press('Start voice call');
    await act(async () => env.element.latest().finish());
    await advance(400);
    await act(async () => env.audio.speakSentence());
    await flush();
    expect(status()).toBe(LABEL.processing);
    expect(within(transcript()).getByText('Transcribing')).toBeInTheDocument();
    expect(customerRegion().querySelector('[role="progressbar"]')).not.toHaveAttribute(
      'aria-valuenow',
    );
  });

  it('takes the turn when the trainee stops the customer’s audio, and keeps all of the reply on screen', async () => {
    await mountScreen();
    await press('Start voice call');
    expect(status()).toBe('Customer speaking');
    await press('Stop customer audio');
    expect(env.element.latest().paused).toBe(true);
    expect(within(transcript()).getByText('Audio stopped')).toBeInTheDocument();
    expect(within(transcript()).getByText(/My account is locked/)).toBeInTheDocument();
    // The microphone opens by itself once the customer's voice has been quiet, and nothing says
    // Listening before it is open: the status says the microphone is ready, and there is no Talk to
    // press meanwhile.
    expect(status()).toBe(LABEL.ready);
    expect(within(controls()).queryByRole('button', { name: 'Talk' })).toBeNull();
    await advance(400);
    expect(status()).toBe(LABEL.listening);
    expect(within(controls()).queryByRole('button', { name: /^(Talk|Done speaking)$/ })).toBeNull();
  });

  it('pauses and resumes, and says so in words', async () => {
    await mountScreen();
    await press('Start voice call');
    await act(async () => env.element.latest().finish());
    await advance(400);
    await press('Pause');
    expect(status()).toBe('Paused');
    expect(env.mic.openTracks()).toHaveLength(0);
    // A held call has one thing to press, and the keyboard goes to it.
    expect(within(controls()).queryByRole('button', { name: 'Talk' })).toBeNull();
    expect(within(controls()).queryByRole('button', { name: 'Pause' })).toBeNull();
    expect(within(controls()).getByRole('button', { name: 'Resume' })).toBeInTheDocument();
    await press('Resume');
    expect(status()).not.toBe('Paused');
    expect(within(controls()).getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });
});

describe('when the customer’s voice fails', () => {
  it('keeps the reply in the transcript, offers Retry and Continue without audio, and keeps listening', async () => {
    const server = new FakeServer();
    server.speakSteps.push(apiError(502, 'speech_failed', true));
    await mountScreen({ server });
    await press('Start voice call');
    expect(card()).toHaveTextContent("The customer's voice could not be made.");
    expect(card()).toHaveTextContent("The customer's words are in the transcript.");
    expect(within(transcript()).getByText(/My account is locked/)).toBeInTheDocument();
    const labels = [...(card()?.querySelectorAll('[data-cw-action]') ?? [])].map(
      (item) => item.textContent,
    );
    expect(labels).toEqual(['Retry', 'Continue without audio']);
    await advance(400);
    expect(status()).toBe(LABEL.listening);
  });

  it('makes the voice again from Retry, once, and says so', async () => {
    const server = new FakeServer();
    server.speakSteps.push(apiError(502, 'speech_failed', true));
    await mountScreen({ server });
    await press('Start voice call');
    await pressInCard('Retry');
    expect(server.spoken).toEqual([1, 1]);
    expect(card()).toBeNull();
    expect(status()).toBe(LABEL.speaking);
  });

  it('carries on without audio when asked: no Replay, captions, and the call goes on', async () => {
    const server = new FakeServer();
    server.speakSteps.push(apiError(502, 'speech_failed', true));
    await mountScreen({ server });
    await press('Start voice call');
    await press('Continue without audio');
    expect(within(controls()).queryByRole('button', { name: 'Replay' })).toBeNull();
    expect(card()).toBeNull();
    expect(within(transcript()).getByText(/My account is locked/)).toBeInTheDocument();
  });

  it('tells a browser that blocks sound apart from a broken voice, and Replay is a press the browser allows', async () => {
    await mountScreen();
    env.element.policy = 'block';
    await press('Start voice call');
    expect(card()).toHaveTextContent('The browser is waiting for a tap before it will play sound.');
    expect(
      [...(card()?.querySelectorAll('[data-cw-action]') ?? [])].map((item) => item.textContent),
    ).toEqual(['Replay', 'Continue without audio']);
    env.element.policy = 'allow';
    await pressInCard('Replay');
    expect(status()).toBe(LABEL.speaking);
    expect(card()).toBeNull();
  });
});

describe('when the microphone cannot be used', () => {
  it('explains a block before the call, and Use text starts a typed call that works', async () => {
    await mountScreen();
    env.mic.mode = 'deny';
    await press('Start voice call');
    expect(card()).toHaveTextContent('The microphone is blocked, so Firefly cannot hear you.');
    expect(card()).toHaveTextContent('Nothing was recorded.');
    // Said at once and firmly: a blocked microphone is the one failure that interrupts.
    expect(card()?.getAttribute('role')).toBe('alert');
    expect(screen.queryByRole('button', { name: 'Start voice call' })).toBeNull();
    await press('Use text');
    expect(status()).toBe(LABEL.typing);
    expect(screen.getByRole('textbox', { name: 'Your reply' })).toHaveFocus();
    await typeAndSend('Hello');
    expect(occurrences('Hello')).toBe(1);
    expect(env.mic.openTracks()).toHaveLength(0);
  });

  it('lets Retry try again once the browser allows it', async () => {
    await mountScreen();
    env.mic.mode = 'deny';
    await press('Start voice call');
    env.mic.mode = 'grant';
    await press('Retry');
    expect(status()).toBe(LABEL.speaking);
  });
});

describe('when speech cannot be turned into text', () => {
  const cardActions = () =>
    [...(card()?.querySelectorAll('[data-cw-action]') ?? [])].map((item) => item.textContent);
  const speakOnce = async () => {
    await press('Start voice call');
    await act(async () => env.element.latest().finish());
    await advance(400);
    await act(async () => env.audio.speakSentence());
    await flush();
  };

  it('keeps the recording, and Retry sends that same recording once, as one message', async () => {
    const server = new FakeServer();
    server.transcripts.push(apiError(502, 'speech_failed', true));
    await mountScreen({ server });
    await speakOnce();
    expect(card()).toHaveTextContent('Your speech could not be turned into text.');
    expect(card()).toHaveTextContent('Your call and its transcript are safe.');
    expect(cardActions()).toEqual(['Retry', 'Use text']);
    expect(status()).toBe(LABEL.tryAgain);
    expect(within(transcript()).queryByText(/Spoken message/)).toBeNull();

    const retry = within(card() as HTMLElement).getByRole('button', { name: 'Retry' });
    await act(async () => {
      fireEvent.click(retry);
      fireEvent.click(retry);
    });
    await flush();
    expect(server.transcribeCalls).toBe(2);
    expect(mocked.transcribe.mock.calls[1]?.[0]).toBe(mocked.transcribe.mock.calls[0]?.[0]);
    expect(server.sent).toHaveLength(1);
    expect(occurrences('Spoken message 2')).toBe(1);
    expect(card()).toBeNull();
    expect(confirmation()).toHaveTextContent('Your words were sent.');
  });

  it('says a recording that took too long was not turned into text, and keeps it for Retry', async () => {
    const server = new FakeServer();
    server.transcripts.push('hang');
    await mountScreen({ server });
    await speakOnce();
    expect(status()).toBe(LABEL.processing);
    await advance(19_500);
    expect(card()).toHaveTextContent('Turning your speech into text took too long.');
    expect(cardActions()).toEqual(['Retry', 'Use text']);
    await pressInCard('Retry');
    expect(server.transcribeCalls).toBe(2);
    expect(server.sent).toHaveLength(1);
    expect(card()).toBeNull();
  });

  it('lets the trainee type instead, and nothing of the recording is sent', async () => {
    const server = new FakeServer();
    server.transcripts.push(apiError(502, 'speech_failed', true));
    await mountScreen({ server });
    await speakOnce();
    await pressInCard('Use text');
    expect(status()).toBe(LABEL.typing);
    expect(card()).toBeNull();
    await typeAndSend('Hello');
    expect(occurrences('Hello')).toBe(1);
    expect(server.transcribeCalls).toBe(1);
    expect(server.sent).toHaveLength(1);
  });
});

describe('from voice to text and back', () => {
  it('releases the microphone, puts the keyboard in the reply box, and takes it back on Return to voice', async () => {
    await mountScreen();
    await press('Start voice call');
    await act(async () => env.element.latest().finish());
    await advance(400);
    expect(env.mic.openTracks()).toHaveLength(1);

    await press('Text');
    expect(status()).toBe(LABEL.typing);
    expect(env.mic.openTracks()).toHaveLength(0);
    expect(screen.getByRole('textbox', { name: 'Your reply' })).toHaveFocus();
    await typeAndSend('A typed message');
    expect(occurrences('A typed message')).toBe(1);
    await advance(600);

    await press('Return to voice');
    expect(screen.queryByRole('textbox', { name: 'Your reply' })).toBeNull();
    expect(env.mic.openTracks()).toHaveLength(1);
    expect([LABEL.speaking, LABEL.listening, LABEL.ready]).toContain(status());
    // Hands-free has no microphone control to go to: the keyboard stays with the call's controls.
    expect(controls()).toHaveFocus();
  });
});

describe('ending the call', () => {
  it('ends once, shows the progress, and hands over to the report', async () => {
    const { server, onEnded } = await mountScreen();
    await press('Start text call');
    await typeAndSend('Hello');
    await press('End call');
    const question = screen.getByRole('dialog', { name: 'End the call?' });
    expect(within(question).getByText('Your messages').nextElementSibling).toHaveTextContent('1');
    await press('End and review');
    expect(server.endCalls).toBe(1);
    expect(onEnded).toHaveBeenCalledExactlyOnceWith(SESSION_ID);
  });

  it('tells a failure inside the dialog and ends on Retry, with the call still open meanwhile', async () => {
    const server = new FakeServer();
    server.endSteps.push(apiError(500, 'internal', true));
    const { onEnded } = await mountScreen({ server });
    await press('Start text call');
    await typeAndSend('Hello');
    await press('End call');
    await press('End and review');
    const question = screen.getByRole('dialog', { name: 'End the call?' });
    expect(within(question).getByText('We could not end the call.')).toBeInTheDocument();
    expect(onEnded).not.toHaveBeenCalled();
    expect(screen.getAllByText('We could not end the call.')).toHaveLength(1);
    await press('Retry');
    expect(server.endCalls).toBe(2);
    expect(onEnded).toHaveBeenCalledExactlyOnceWith(SESSION_ID);
  });

  it('says there is nothing to review for a call with no message, and carrying on works', async () => {
    const { server, onEnded } = await mountScreen();
    await press('Start text call');
    await press('End call');
    await press('End and review');
    const question = screen.getByRole('dialog', { name: 'End the call?' });
    expect(within(question).getByText('There is nothing to review yet.')).toBeInTheDocument();
    expect(onEnded).not.toHaveBeenCalled();
    await press('Continue call');
    expect(screen.queryByRole('dialog', { name: 'End the call?' })).toBeNull();
    expect(card()).toBeNull();
    await typeAndSend('Hello');
    expect(occurrences('Hello')).toBe(1);
    expect(server.endCalls).toBe(1);
  });
});
