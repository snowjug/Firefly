import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../lib/api.ts';
import { estimateSpeechMs } from '../voice/playback/speech-text.ts';
import { speakTurnWithVoice } from '../voice/speech-client.ts';
import {
  advance,
  apiError,
  defaultOptions,
  FakeServer,
  flush,
  Harness,
  networkError,
  SESSION_ID,
} from './testing.ts';

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
// The request that names a voice is the voice layer's own; here it is answered by the fake server.
vi.mock('../voice/speech-client.ts', () => ({ speakTurnWithVoice: vi.fn() }));

const mocked = vi.mocked(api);
const withVoice = vi.mocked(speakTurnWithVoice);
const h = new Harness(mocked);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-02T10:00:30.000Z'));
  vi.clearAllMocks();
  h.setup();
  withVoice.mockImplementation(async (id, turnIndex, language, signal) => ({
    ...(await h.server.speakTurn(id, turnIndex, language, signal)),
    voiceId: null,
  }));
});

afterEach(() => {
  h.teardown();
  vi.useRealTimers();
});

const phase = () => h.snap().phase;
const captureContexts = () => h.env.contexts.filter((context) => context.workletNodes.length > 0);

describe('mute', () => {
  it('stops recording at once, and sends nothing while muted', async () => {
    await h.mount();
    await h.openCall();
    expect(h.env.audio.listeningWorklets()).toHaveLength(1);
    h.env.audio.analyserRms = 0.1;

    h.do(() => h.actions().toggleMute());
    expect(h.snap()).toMatchObject({ muted: true, phase: 'ready-for-next-turn', micLevel: 0 });
    expect(h.snap().announcement?.text).toBe('Your microphone is muted.');
    expect(h.env.audio.listeningWorklets()).toHaveLength(0);
    // The track is switched off but held, so the browser's recording indicator stays on.
    expect(h.env.mic.tracks.every((track) => !track.enabled)).toBe(true);
    expect(h.env.mic.openTracks()).toHaveLength(1);

    // Whatever is said now goes nowhere.
    await h.say();
    await advance(20_000);
    expect(mocked.transcribe).not.toHaveBeenCalled();
    expect(phase()).toBe('ready-for-next-turn');
    h.do(() => h.actions().talk());
    expect(h.snap().hint).toMatch(/You are muted/);

    h.do(() => h.actions().toggleMute());
    expect(h.snap().announcement?.text).toBe('Microphone on.');
    expect(h.env.mic.tracks.every((track) => track.enabled)).toBe(true);
    await advance(400);
    expect(phase()).toBe('listening');
  });

  it('discards a sentence that is still being transcribed', async () => {
    h.server.transcripts.push('hang');
    await h.mount();
    await h.openCall();
    await h.say();
    expect(phase()).toBe('transcribing');
    h.do(() => h.actions().toggleMute());
    expect(phase()).toBe('ready-for-next-turn');
    expect(h.snap().turns).toHaveLength(1);
    expect(h.snap().hint).toMatch(/was not sent/);
    expect(h.server.transcribeSignals[0]?.aborted).toBe(true);
    await advance(30_000);
    expect(mocked.sendMessage).not.toHaveBeenCalled();
  });

  it('does nothing in a typed call', async () => {
    await h.mount();
    await h.begin(false);
    h.do(() => h.actions().toggleMute());
    expect(h.snap().muted).toBe(false);
  });
});

describe('pause', () => {
  it('releases the microphone so the recording indicator goes off, and gets it back on resume', async () => {
    await h.mount();
    await h.openCall();
    expect(h.env.mic.openTracks()).toHaveLength(1);

    h.do(() => h.actions().togglePause());
    expect(h.snap()).toMatchObject({
      paused: true,
      phase: 'ready-for-next-turn',
      microphone: 'granted',
    });
    expect(h.snap().announcement?.text).toBe('The call is paused.');
    expect(h.env.mic.openTracks()).toHaveLength(0);
    expect(captureContexts().every((context) => context.state === 'closed')).toBe(true);
    expect(h.env.audio.listeningWorklets()).toHaveLength(0);
    await advance(30_000);
    expect(phase()).toBe('ready-for-next-turn');
    h.do(() => h.actions().talk());
    expect(h.snap().hint).toMatch(/paused/);

    h.do(() => h.actions().togglePause());
    await flush();
    // The microphone is taken again; the permission is already granted, so nothing asks.
    expect(h.snap()).toMatchObject({
      paused: false,
      microphone: 'granted',
      phase: 'ready-for-next-turn',
    });
    expect(h.env.mic.getUserMedia).toHaveBeenCalledTimes(2);
    expect(h.env.mic.openTracks()).toHaveLength(1);
    await advance(400);
    expect(phase()).toBe('listening');
  });

  it('halts the customer when paused, and speaks the turn again when resumed', async () => {
    await h.mount();
    await h.begin(true);
    const element = h.env.element.latest();
    expect(phase()).toBe('customer-speaking');

    h.do(() => h.actions().togglePause());
    expect(element.paused).toBe(true);
    expect(h.env.urls.live()).toHaveLength(0);
    expect(h.snap().customerLevel).toBe(0);
    // The voice was audible when pausing stopped it, so the reply is marked as cut off: until it is
    // heard again from the start.
    expect(h.snap().turns[0]?.interrupted).toBe(true);

    h.do(() => h.actions().togglePause());
    await flush();
    expect(h.server.spoken).toEqual([1, 1]);
    expect(phase()).toBe('customer-speaking');
    expect(h.snap().turns[0]?.interrupted).toBe(false);
  });

  it('lets a message in flight finish while paused, and speaks the reply when resumed', async () => {
    h.server.sendDelayMs = 2000;
    await h.mount();
    await h.openCall();
    await h.say();
    expect(phase()).toBe('processing');

    h.do(() => h.actions().togglePause());
    expect(h.env.mic.openTracks()).toHaveLength(0);
    await advance(2500);
    expect(phase()).toBe('ready-for-next-turn');
    expect(h.snap().turns.at(-1)).toMatchObject({ role: 'customer', index: 3 });
    expect(h.server.spoken).toEqual([1]);

    h.do(() => h.actions().togglePause());
    await flush();
    expect(h.server.spoken).toEqual([1, 3]);
  });

  it('discards a sentence being transcribed when paused', async () => {
    h.server.transcripts.push('hang');
    await h.mount();
    await h.openCall();
    await h.say();
    h.do(() => h.actions().togglePause());
    expect(h.snap().turns).toHaveLength(1);
    expect(h.snap().hint).toMatch(/paused the call/);
    expect(h.server.transcribeSignals[0]?.aborted).toBe(true);
  });

  it('pauses by itself when the page is hidden, so the microphone is never open out of sight', async () => {
    await h.mount();
    await h.openCall();
    expect(h.env.mic.openTracks()).toHaveLength(1);

    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    try {
      h.do(() => document.dispatchEvent(new Event('visibilitychange')));
      expect(h.snap()).toMatchObject({ paused: true, phase: 'ready-for-next-turn' });
      expect(h.env.mic.openTracks()).toHaveLength(0);
      expect(h.env.audio.listeningWorklets()).toHaveLength(0);

      // Coming back does not open the microphone: that is for the trainee to do with Resume.
      hidden.mockReturnValue(false);
      h.do(() => document.dispatchEvent(new Event('visibilitychange')));
      await advance(30_000);
      expect(h.snap().paused).toBe(true);
      expect(h.env.mic.openTracks()).toHaveLength(0);
    } finally {
      hidden.mockRestore();
    }
  });

  it('leaves a typed call alone when the page is hidden', async () => {
    await h.mount();
    await h.begin(false);
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    try {
      h.do(() => document.dispatchEvent(new Event('visibilitychange')));
      expect(h.snap().paused).toBe(false);
    } finally {
      hidden.mockRestore();
    }
  });
});

describe('interrupting the customer', () => {
  it('stops the voice at once and gives the turn to the trainee, leaving the transcript alone', async () => {
    await h.mount();
    await h.begin(true);
    const before = h.snap().turns.map((turn) => turn.text);
    expect(phase()).toBe('customer-speaking');

    h.do(() => h.actions().interrupt());
    expect(phase()).toBe('ready-for-next-turn');
    expect(h.env.element.latest().paused).toBe(true);
    expect(h.env.urls.live()).toHaveLength(0);
    expect(h.snap().customerLevel).toBe(0);
    expect(h.snap().turns.map((turn) => turn.text)).toEqual(before);
    expect(h.snap().turns[0]?.interrupted).toBe(true);
    // Hands-free: the microphone opens for the trainee.
    await advance(400);
    expect(phase()).toBe('listening');
  });

  it('does not listen for the trainee while the customer speaks: the microphone stays closed', async () => {
    await h.mount();
    await h.begin(true);
    expect(phase()).toBe('customer-speaking');
    await h.say({ leadMs: 0, speechMs: 600, trailMs: 1500 });
    expect(h.env.audio.listeningWorklets()).toHaveLength(0);
    expect(mocked.transcribe).not.toHaveBeenCalled();
    expect(phase()).toBe('customer-speaking');
  });

  it('is refused by Talk: the voice plays on and the microphone stays closed, until the voice is stopped', async () => {
    await h.mount();
    await h.begin(true);
    h.do(() => h.actions().talk());
    expect(phase()).toBe('customer-speaking');
    expect(h.snap().stage).toBe('customer-speaking');
    expect(h.env.element.latest().paused).toBe(false);
    expect(h.env.audio.listeningWorklets()).toHaveLength(0);
    expect(h.snap().turns[0]?.interrupted).toBe(false);
    expect(h.snap().hint).toBe('Wait for the customer, or stop their audio.');

    // Stopping the customer's audio first lets the trainee talk, and the two never overlap: the
    // microphone opens once the customer's voice has been quiet for the settle.
    h.do(() => h.actions().interrupt());
    h.do(() => h.actions().talk());
    expect(phase()).toBe('listening');
    expect(h.env.element.latest().paused).toBe(true);
    expect(h.env.audio.listeningWorklets()).toHaveLength(0);
    expect(h.snap().micOpen).toBe(false);
    await advance(400);
    expect(h.env.audio.listeningWorklets()).toHaveLength(1);
    expect(h.snap().micOpen).toBe(true);
    expect(h.snap().turns[0]?.interrupted).toBe(true);
  });

  it('does nothing when the customer is not speaking', async () => {
    await h.mount();
    await h.openCall();
    h.do(() => h.actions().interrupt());
    expect(phase()).toBe('listening');
  });
});

describe('replay', () => {
  it('speaks the latest customer turn again, and clears the interrupted mark once it has been heard', async () => {
    await h.mount();
    await h.begin(true);
    h.do(() => h.actions().interrupt());
    expect(h.snap().turns[0]?.interrupted).toBe(true);

    h.do(() => h.actions().replay());
    await flush();
    expect(phase()).toBe('customer-speaking');
    expect(h.server.spoken).toEqual([1, 1]);
    await h.customerFinishes();
    expect(h.snap().turns[0]?.interrupted).toBe(false);
    expect(phase()).toBe('ready-for-next-turn');
  });

  it('works in a typed call, and says so when this browser has nothing to speak with', async () => {
    await h.mount();
    await h.begin(false);
    h.do(() => h.actions().replay());
    await flush();
    expect(h.server.spoken).toEqual([1]);
    expect(phase()).toBe('customer-speaking');
    await h.customerFinishes();
    expect(phase()).toBe('ready-for-next-turn');
    // A typed call never opens the microphone, even after the customer has spoken.
    await advance(5000);
    expect(h.env.mic.getUserMedia).not.toHaveBeenCalled();
  });
});

describe('when speech cannot be turned into text', () => {
  it('shows a problem the call can carry on from, and Retry sends the same recording again, once', async () => {
    h.server.transcripts.push(apiError(502, 'speech_failed', true));
    await h.mount();
    await h.openCall();
    await h.say();
    expect(phase()).toBe('ready-for-next-turn');
    expect(h.snap().problem).toMatchObject({
      code: 'transcription-failed',
      retry: 'transcribe',
      severity: 'degraded',
      textFallback: true,
      announce: 'polite',
    });
    expect(h.snap().problem?.preserved).toMatch(/transcript are safe/);
    // The utterance was never sent, and is not in the transcript.
    expect(h.snap().turns).toHaveLength(1);
    expect(mocked.sendMessage).not.toHaveBeenCalled();
    // The microphone does not reopen by itself and fail again.
    await advance(10_000);
    expect(phase()).toBe('ready-for-next-turn');

    // Retry does not ask the trainee to speak again: the recording that was kept goes again.
    h.do(() => h.actions().retry());
    expect(phase()).toBe('transcribing');
    expect(h.snap().problem).toBeNull();
    await flush();
    expect(mocked.transcribe).toHaveBeenCalledTimes(2);
    expect(mocked.transcribe.mock.calls[1]?.[0]).toBe(mocked.transcribe.mock.calls[0]?.[0]);
    expect(mocked.sendMessage).toHaveBeenCalledTimes(1);
    // One message, under one id, however many times it was turned into text.
    expect(h.snap().turns.filter((turn) => turn.role === 'trainee')).toHaveLength(1);
    expect(h.server.sent).toHaveLength(1);
    expect(h.server.sent[0]?.text).toBe('Spoken message 2');
  });

  it('shares one request for one Retry pressed twice, and lets go of the recording once it worked', async () => {
    h.server.transcripts.push(apiError(502, 'speech_failed', true));
    await h.mount();
    await h.openCall();
    await h.say();
    h.do(() => {
      h.actions().retry();
      h.actions().retry();
    });
    await flush();
    expect(mocked.transcribe).toHaveBeenCalledTimes(2);
    expect(mocked.sendMessage).toHaveBeenCalledTimes(1);
    // Once it worked the recording is let go: with the problem gone, Retry has nothing to send.
    h.do(() => h.actions().retry());
    expect(mocked.transcribe).toHaveBeenCalledTimes(2);
  });

  it('asks the trainee to say it again when typing instead, or talking, lets go of the recording', async () => {
    h.server.transcripts.push(apiError(502, 'speech_failed', true));
    await h.mount();
    await h.openCall();
    await h.say();
    expect(h.snap().problem?.code).toBe('transcription-failed');
    // Talking clears the problem and drops the old recording: a new pass, a new utterance.
    h.do(() => h.actions().talk());
    expect(phase()).toBe('listening');
    expect(h.snap().problem).toBeNull();
    await advance(400);
    await h.say();
    expect(mocked.transcribe).toHaveBeenCalledTimes(2);
    expect(mocked.transcribe.mock.calls[1]?.[0]).not.toBe(mocked.transcribe.mock.calls[0]?.[0]);
    expect(h.server.sent).toHaveLength(1);
  });

  it('lets the trainee type instead, which clears the problem', async () => {
    h.server.transcripts.push(apiError(503, 'speech_unavailable', true));
    await h.mount();
    await h.openCall();
    await h.say();
    expect(h.snap().problem?.code).toBe('speech-service-unavailable');
    let accepted = false;
    h.do(() => {
      void h
        .actions()
        .sendText('Typed after all')
        .then((ok) => (accepted = ok));
    });
    await flush();
    expect(accepted).toBe(true);
    expect(h.snap().problem).toBeNull();
  });

  it('shows being offline, and the call goes on from there', async () => {
    h.server.transcripts.push(networkError());
    await h.mount();
    await h.openCall();
    await h.say();
    expect(h.snap().problem).toMatchObject({ code: 'offline', retry: 'transcribe' });
  });

  it('shows a rate limit with how long to wait', async () => {
    h.server.transcripts.push(apiError(429, 'rate_limited', true, { retryAfterSeconds: 5 }));
    await h.mount();
    await h.openCall();
    await h.say();
    expect(h.snap().problem).toMatchObject({ code: 'rate-limited', retry: 'transcribe' });
    expect(h.snap().problem?.advice).toMatch(/Wait 5 seconds/);
  });

  it('gives up after 19 seconds, aborts the request, keeps the recording for Retry and ignores a late answer', async () => {
    let answerLate: (value: {
      status: 'recognised';
      text: string;
      durationMs: number;
    }) => void = () => undefined;
    mocked.transcribe.mockImplementationOnce(
      () => new Promise((resolve) => (answerLate = resolve)),
    );
    await h.mount();
    await h.openCall();
    await h.say();
    expect(phase()).toBe('transcribing');
    // The transcriber's own deadline is a second before the machine's, so the recording is kept.
    await advance(18_900);
    expect(phase()).toBe('transcribing');
    await advance(200);
    expect(phase()).toBe('ready-for-next-turn');
    expect(h.snap().problem).toMatchObject({ code: 'transcription-failed' });
    expect(h.snap().problem?.title).toMatch(/took too long/);
    expect(h.snap().turns).toHaveLength(1);

    await flush();
    answerLate({ status: 'recognised', text: 'Too late', durationMs: 900 });
    await flush();
    expect(mocked.sendMessage).not.toHaveBeenCalled();
    expect(h.snap().turns).toHaveLength(1);

    // Retry sends the recording again, and this time it is answered.
    h.do(() => h.actions().retry());
    await flush();
    expect(mocked.transcribe).toHaveBeenCalledTimes(2);
    expect(mocked.sendMessage).toHaveBeenCalledTimes(1);
  });
});

describe('when a message cannot be sent', () => {
  const typeIn = async (text: string) => {
    let result!: Promise<boolean>;
    h.do(() => {
      result = h.actions().sendText(text);
    });
    await flush();
    return result;
  };

  it('keeps the message as failed, says it was saved, and Retry resends it with the same id', async () => {
    h.server.sendSteps.push(() => apiError(502, 'provider_unavailable', true));
    await h.mount();
    await h.begin(false);
    expect(await typeIn('Hello')).toBe(true);
    expect(h.snap().turns.at(-1)).toMatchObject({
      role: 'trainee',
      status: 'failed',
      text: 'Hello',
      index: null,
    });
    expect(h.snap().problem).toMatchObject({
      code: 'reply-failed',
      retry: 'send',
      severity: 'blocking',
      textFallback: false,
      preserved: 'Your message was saved.',
    });
    // A different message is refused until this one has been answered.
    expect(await typeIn('Something else')).toBe(false);
    expect(h.snap().hint).toMatch(/Retry your last message first/);

    h.do(() => h.actions().retry());
    await flush();
    const ids = h.server.sent.map((request) => request.clientMessageId);
    expect(ids).toHaveLength(2);
    expect(ids[1]).toBe(ids[0]);
    expect(h.snap().problem).toBeNull();
    // One trainee turn, one new customer turn, nothing twice.
    expect(h.snap().turns.map((turn) => [turn.role, turn.status])).toEqual([
      ['customer', 'sent'],
      ['trainee', 'sent'],
      ['customer', 'sent'],
    ]);
    expect(h.snap().turns[1]).toMatchObject({ key: ids[0], index: 2, text: 'Hello' });
  });

  it('shows being offline, keeps the message and sends it when back online', async () => {
    h.server.sendSteps.push(() => networkError());
    await h.mount();
    await h.begin(false);
    expect(await typeIn('Hello')).toBe(true);
    expect(h.snap().problem).toMatchObject({
      code: 'offline',
      retry: 'send',
      severity: 'blocking',
    });
    expect(h.snap().problem?.preserved).toBe('Your message is kept.');
    expect(h.snap().turns.at(-1)?.status).toBe('failed');
    h.do(() => h.actions().retry());
    await flush();
    expect(h.snap().problem).toBeNull();
    expect(h.snap().turns.at(-2)?.status).toBe('sent');
  });

  it('shows a rate limit with the wait', async () => {
    h.server.sendSteps.push(() => apiError(429, 'rate_limited', true, { retryAfterSeconds: 4 }));
    await h.mount();
    await h.begin(false);
    await typeIn('Hello');
    expect(h.snap().problem).toMatchObject({ code: 'rate-limited', retry: 'send' });
    expect(h.snap().problem?.advice).toMatch(/Wait 4 seconds, then choose Retry/);
  });

  it('is not sure whether it was saved after an unexpected failure, and says retrying is safe', async () => {
    h.server.sendSteps.push(() => apiError(500, 'internal', true));
    await h.mount();
    await h.begin(false);
    await typeIn('Hello');
    expect(h.snap().problem).toMatchObject({ code: 'save-failed', retry: 'send' });
    expect(h.snap().problem?.advice).toMatch(/Retry sends it once/);
  });

  it('retries a conflict by itself, with growing waits, and then succeeds', async () => {
    h.server.conflicts = 2;
    await h.mount();
    await h.begin(false);
    let result!: Promise<boolean>;
    h.do(() => {
      result = h.actions().sendText('Hello');
    });
    await advance(100);
    expect(mocked.sendMessage).toHaveBeenCalledTimes(1);
    await advance(400);
    expect(mocked.sendMessage).toHaveBeenCalledTimes(2);
    await advance(800);
    expect(mocked.sendMessage).toHaveBeenCalledTimes(3);
    await flush();
    expect(await result).toBe(true);
    expect(h.snap().problem).toBeNull();
    expect(h.snap().turns.at(-2)?.status).toBe('sent');
    // Every attempt carried the same id.
    expect(new Set(h.server.sent.map((request) => request.clientMessageId)).size).toBe(1);
  });

  it('gives up on a conflict that does not pass, after a bounded number of tries', async () => {
    h.server.conflicts = 99;
    await h.mount();
    await h.begin(false);
    let result!: Promise<boolean>;
    h.do(() => {
      result = h.actions().sendText('Hello');
    });
    await advance(400 + 800 + 1600 + 3200 + 100);
    await flush();
    expect(await result).toBe(true);
    expect(mocked.sendMessage).toHaveBeenCalledTimes(5);
    expect(h.snap().problem).toMatchObject({ code: 'reply-failed', retry: 'send' });
    expect(h.snap().turns.at(-1)?.status).toBe('failed');
  });

  it('stops a call whose server says it has ended, without keeping the message', async () => {
    h.server.sendSteps.push(() => apiError(409, 'session_not_active', false));
    await h.mount();
    await h.begin(false);
    expect(await typeIn('Hello')).toBe(false);
    expect(h.snap().problem).toMatchObject({ code: 'session-ended', retry: null });
    expect(h.snap().turns).toHaveLength(1);
    expect(await typeIn('Again')).toBe(false);
    expect(mocked.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('stops text and voice at the server\u2019s turn limit', async () => {
    h.server.sendSteps.push(() => apiError(409, 'turn_limit_reached', false));
    await h.mount({ call: { maxTraineeTurns: null } });
    await h.begin(true);
    await h.customerFinishes();
    await advance(400);
    expect(phase()).toBe('listening');
    expect(await typeIn('Hello')).toBe(false);
    expect(h.snap().problem).toMatchObject({ code: 'turn-limit', retry: null });
    await advance(30_000);
    expect(phase()).toBe('ready-for-next-turn');
    expect(h.env.audio.listeningWorklets()).toHaveLength(0);
    h.do(() => h.actions().talk());
    expect(phase()).toBe('ready-for-next-turn');
  });

  it('gives up waiting for a reply after 45 seconds, aborts the request, and a retry never duplicates', async () => {
    h.server.sendSteps.push(() => 'hang');
    await h.mount();
    await h.begin(false);
    let result!: Promise<boolean>;
    h.do(() => {
      result = h.actions().sendText('Hello');
    });
    await advance(44_999);
    expect(phase()).toBe('processing');
    await advance(2);
    expect(await result).toBe(true);
    expect(phase()).toBe('ready-for-next-turn');
    expect(h.snap().problem).toMatchObject({ code: 'reply-timeout', retry: 'send' });
    expect(h.snap().turns.at(-1)?.status).toBe('failed');
    expect(h.server.sendSignals[0]?.aborted).toBe(true);

    h.do(() => h.actions().retry());
    await flush();
    expect(h.server.sent.map((request) => request.clientMessageId)).toEqual([
      h.server.sent[0]?.clientMessageId,
      h.server.sent[0]?.clientMessageId,
    ]);
    expect(h.server.turns.filter((turn) => turn.role === 'trainee')).toHaveLength(1);
    expect(h.snap().turns.filter((turn) => turn.role === 'trainee')).toHaveLength(1);
    expect(h.snap().problem).toBeNull();
  });

  it('applies a reply once even when the first request was finished by the server after the client gave up', async () => {
    h.server.finishAbandoned = true;
    h.server.sendDelayMs = 50_000;
    await h.mount();
    await h.begin(false);
    h.do(() => void h.actions().sendText('Hello'));
    await advance(45_100);
    expect(h.snap().problem?.code).toBe('reply-timeout');
    h.server.sendDelayMs = 0;
    h.do(() => h.actions().retry());
    await flush();
    // The server finishes the abandoned request too: both are answered from the same saved turns.
    await advance(10_000);
    expect(h.server.turns.map((turn) => turn.role)).toEqual(['customer', 'trainee', 'customer']);
    expect(h.snap().turns.map((turn) => [turn.role, turn.index])).toEqual([
      ['customer', 1],
      ['trainee', 2],
      ['customer', 3],
    ]);
    expect(h.snap().stateHistory.map((point) => point.turnIndex)).toEqual([1, 3]);
  });
});

describe('the same thing never happens twice', () => {
  it('sends one message for two quick sends, and one resend for two quick presses of Try again', async () => {
    h.server.sendSteps.push(() => apiError(502, 'provider_unavailable', true));
    await h.mount();
    await h.begin(false);
    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    h.do(() => {
      first = h.actions().sendText('Hello');
      second = h.actions().sendText('Hello');
    });
    await flush();
    expect(await first).toBe(true);
    expect(await second).toBe(false);
    expect(mocked.sendMessage).toHaveBeenCalledTimes(1);

    h.do(() => {
      h.actions().retry();
      h.actions().retry();
    });
    await flush();
    expect(mocked.sendMessage).toHaveBeenCalledTimes(2);
    expect(h.snap().turns.filter((turn) => turn.role === 'trainee')).toHaveLength(1);
  });

  it('makes one trainee turn for one utterance, however the audio arrives', async () => {
    await h.mount();
    await h.openCall();
    await h.say();
    // The same sentence arriving again from a stale listener changes nothing.
    await h.say({ leadMs: 0, speechMs: 600, trailMs: 1500 });
    expect(mocked.transcribe).toHaveBeenCalledTimes(1);
    expect(h.snap().turns.filter((turn) => turn.role === 'trainee')).toHaveLength(1);
    expect(h.server.turns.filter((turn) => turn.role === 'trainee')).toHaveLength(1);
  });
});

describe("the customer's voice failing", () => {
  it('never blocks the call: the text is in the transcript, the problem is degraded, and listening goes on', async () => {
    h.server.speakSteps.push(apiError(502, 'speech_failed', true));
    await h.mount();
    await h.begin(true);
    expect(phase()).toBe('ready-for-next-turn');
    expect(h.snap().problem).toMatchObject({
      code: 'voice-generation-failed',
      severity: 'degraded',
      textFallback: true,
      retry: 'speak',
    });
    expect(h.snap().turns[0]?.text).toMatch(/account is locked/);
    expect(h.env.urls.live()).toHaveLength(0);
    await advance(400);
    expect(phase()).toBe('listening');
    expect(h.snap().problem?.code).toBe('voice-generation-failed');

    // Try again speaks it; hearing it clears the problem.
    h.do(() => h.actions().retry());
    await flush();
    expect(h.server.spoken).toEqual([1, 1]);
    expect(h.snap().problem).toBeNull();
    expect(phase()).toBe('customer-speaking');
  });

  it('gives up on a voice that is never made, after 15 seconds', async () => {
    h.server.speakSteps.push('hang');
    await h.mount();
    await h.begin(true);
    expect(phase()).toBe('ready');
    await advance(14_999);
    expect(phase()).toBe('ready');
    await advance(2);
    expect(phase()).toBe('ready-for-next-turn');
    expect(h.snap().problem?.code).toBe('voice-generation-failed');
  });

  it('is blocked, not broken, when the browser will not play: Play uses the audio that was already made', async () => {
    await h.mount();
    h.env.element.policy = 'block';
    await h.begin(true);
    expect(h.snap().problem).toMatchObject({
      code: 'playback-blocked',
      severity: 'degraded',
      retry: 'speak',
      textFallback: true,
    });
    expect(phase()).toBe('ready-for-next-turn');
    // The reply has not been heard, so the microphone does not open yet.
    await advance(10_000);
    expect(phase()).toBe('ready-for-next-turn');
    expect(h.env.audio.listeningWorklets()).toHaveLength(0);
    expect(h.env.urls.live()).toHaveLength(1);

    h.env.element.policy = 'allow';
    h.do(() => h.actions().retry());
    await flush();
    expect(phase()).toBe('customer-speaking');
    expect(h.server.spoken).toEqual([1]);
    expect(h.snap().problem).toBeNull();
    await h.customerFinishes();
    expect(h.env.urls.live()).toHaveLength(0);
    await advance(400);
    expect(phase()).toBe('listening');
  });

  it('lets the trainee dismiss a blocked voice and carry on', async () => {
    await h.mount();
    h.env.element.policy = 'block';
    await h.begin(true);
    h.do(() => h.actions().dismissProblem());
    expect(h.snap().problem).toBeNull();
    await advance(400);
    expect(phase()).toBe('listening');
  });

  it('cuts off a voice that never reports its end, after its length plus five seconds', async () => {
    await h.mount();
    await h.begin(true);
    expect(phase()).toBe('customer-speaking');
    // The length is estimated from the words, as the audio element never says.
    const limit = estimateSpeechMs(h.snap().turns[0]?.text ?? '') + 5000;
    await advance(limit - 200);
    expect(phase()).toBe('customer-speaking');
    await advance(400);
    expect(phase()).toBe('ready-for-next-turn');
    expect(h.snap().problem).toBeNull();
    expect(h.env.element.latest().paused).toBe(true);
    expect(h.env.urls.live()).toHaveLength(0);
    await advance(400);
    expect(phase()).toBe('listening');
  });

  it('reports a voice that breaks down while playing', async () => {
    await h.mount();
    await h.begin(true);
    h.do(() => h.env.element.latest().breakDown());
    expect(h.snap().problem?.code).toBe('playback-failed');
    expect(phase()).toBe('ready-for-next-turn');
  });
});

describe('a call left waiting for a reply', () => {
  it('shows the saved message as failed with Try again, once, and the retry resumes it', async () => {
    h.server.leaveAwaiting('Where is my order', 'client-message-0001', 'voice');
    await h.mount();
    expect(h.snap().turns).toHaveLength(2);
    expect(h.snap().turns[1]).toMatchObject({
      role: 'trainee',
      status: 'failed',
      index: 2,
      key: 'client-message-0001',
      clientMessageId: 'client-message-0001',
      inputMode: 'voice',
      text: 'Where is my order',
    });

    await h.begin(false);
    expect(h.snap().problem).toMatchObject({
      code: 'reply-failed',
      preserved: 'Your message was saved.',
    });
    h.do(() => h.actions().retry());
    await flush();
    expect(h.server.sent).toEqual([
      { text: 'Where is my order', clientMessageId: 'client-message-0001', inputMode: 'voice' },
    ]);
    expect(h.snap().turns.map((turn) => [turn.role, turn.status, turn.index])).toEqual([
      ['customer', 'sent', 1],
      ['trainee', 'sent', 2],
      ['customer', 'sent', 3],
    ]);
    expect(h.snap().problem).toBeNull();
  });

  it('does not open the microphone in a spoken call until the saved message has been answered', async () => {
    h.server.leaveAwaiting('Where is my order', 'client-message-0001');
    await h.mount();
    await h.begin(true);
    expect(h.server.spoken).toEqual([]);
    await advance(10_000);
    expect(phase()).toBe('ready-for-next-turn');
    expect(h.env.audio.listeningWorklets()).toHaveLength(0);
    h.do(() => h.actions().retry());
    await flush();
    expect(h.server.spoken).toEqual([3]);
  });
});

describe('the message limit', () => {
  it('stops text and voice after the last reply, which is still spoken', async () => {
    h.server.maxTurns = 1;
    await h.mount({ call: { maxTraineeTurns: 1 } });
    await h.openCall();
    expect(h.snap().turnsRemaining).toBe(1);
    await h.say();
    expect(h.snap().turnsRemaining).toBe(0);
    expect(h.snap().problem).toMatchObject({ code: 'turn-limit' });
    expect(h.server.spoken).toEqual([1, 3]);
    await h.customerFinishes();
    await advance(30_000);
    expect(phase()).toBe('ready-for-next-turn');
    expect(h.env.audio.listeningWorklets()).toHaveLength(0);
    let accepted = true;
    h.do(
      () =>
        void h
          .actions()
          .sendText('One more')
          .then((ok) => (accepted = ok)),
    );
    await flush();
    expect(accepted).toBe(false);
  });
});

describe('language', () => {
  it('is used for the next transcription and reported in the snapshot', async () => {
    await h.mount();
    await h.openCall();
    h.do(() => h.actions().setLanguage('en-US'));
    expect(h.snap().voiceDetails.language).toBe('en-US');
    await h.say();
    expect(mocked.transcribe.mock.calls[0]?.[1]).toBe('en-US');
  });

  it('ignores a language the app does not offer', async () => {
    await h.mount();
    h.do(() => h.actions().setLanguage('fr-FR' as never));
    expect(h.snap().voiceDetails.language).toBe('en-GB');
  });

  it('is sent to the server with every request for the customer\u2019s voice', async () => {
    await h.mount();
    await h.begin(true);
    expect(mocked.speakTurn).toHaveBeenLastCalledWith(
      SESSION_ID,
      1,
      'en-GB',
      expect.any(AbortSignal),
    );
    h.do(() => h.actions().setLanguage('en-IE'));
    h.do(() => h.actions().replay());
    await flush();
    expect(mocked.speakTurn).toHaveBeenLastCalledWith(
      SESSION_ID,
      1,
      'en-IE',
      expect.any(AbortSignal),
    );
    expect(h.server.spokenLanguages).toEqual(['en-GB', 'en-IE']);
  });
});

describe("the customer's chosen voice", () => {
  it('is named in every request for the customer’s voice, and the plain request is not used', async () => {
    await h.mount({ call: { voice: 'voice-c' } });
    await h.begin(true);
    expect(withVoice).toHaveBeenLastCalledWith(SESSION_ID, 1, 'en-GB', expect.any(AbortSignal), {
      voice: 'voice-c',
    });
    h.do(() => h.actions().replay());
    await flush();
    expect(withVoice).toHaveBeenCalledTimes(2);
    expect(withVoice).toHaveBeenLastCalledWith(SESSION_ID, 1, 'en-GB', expect.any(AbortSignal), {
      voice: 'voice-c',
    });
    expect(mocked.speakTurn).not.toHaveBeenCalled();
    expect(h.server.spoken).toEqual([1, 1]);
  });

  it('is not invented: without one, the request is the plain one it always was', async () => {
    await h.mount();
    await h.begin(true);
    expect(withVoice).not.toHaveBeenCalled();
    expect(mocked.speakTurn).toHaveBeenCalledTimes(1);
  });

  it('can arrive after the call has loaded, and is used from the next request', async () => {
    await h.mount();
    await h.begin(true);
    expect(withVoice).not.toHaveBeenCalled();
    h.do(() => h.call.rerender({ options: defaultOptions({ voice: 'voice-d' }) }));
    h.do(() => h.actions().replay());
    await flush();
    expect(withVoice).toHaveBeenLastCalledWith(SESSION_ID, 1, 'en-GB', expect.any(AbortSignal), {
      voice: 'voice-d',
    });
  });
});

describe('the microphone level', () => {
  it('moves while the trainee speaks, about 15 times a second, and reads 0 when nobody is listening', async () => {
    await h.mount();
    await h.openCall();
    h.env.audio.analyserRms = 0.08;
    const reads = h.env.audio.analyserReads;
    await advance(1000);
    expect(h.env.audio.analyserReads - reads).toBeGreaterThanOrEqual(14);
    expect(h.env.audio.analyserReads - reads).toBeLessThanOrEqual(16);
    expect(h.snap().micLevel).toBeGreaterThan(0.4);

    h.do(() => h.actions().toggleMute());
    expect(h.snap().micLevel).toBe(0);
    const after = h.env.audio.analyserReads;
    await advance(1000);
    expect(h.env.audio.analyserReads).toBe(after);
    expect(h.snap().micLevel).toBe(0);
  });

  it('shapes the customer\u2019s level from the audio while it plays, and reads 0 when it stops', async () => {
    await h.mount();
    await h.begin(true);
    h.env.audio.analyserRms = 0.1;
    await advance(500);
    expect(h.snap().customerLevel).toBeGreaterThan(0.3);
    await h.customerFinishes();
    expect(h.snap().customerLevel).toBe(0);
  });
});

describe('announcements', () => {
  it('say whole sentences about what changed, never the transcript, with an id that always increases', async () => {
    await h.mount();
    const seen: Array<{ id: number; text: string }> = [];
    const note = () => {
      const announcement = h.snap().announcement;
      if (announcement && seen.at(-1)?.id !== announcement.id) seen.push(announcement);
    };
    await h.begin(true);
    note();
    await h.customerFinishes();
    await advance(400);
    note();
    await h.say();
    note();
    await h.customerFinishes();
    await advance(400);
    note();
    h.do(() => h.actions().toggleMute());
    note();
    h.do(() => h.actions().toggleMute());
    note();
    expect(seen.map((entry) => entry.text)).toEqual([
      'The customer is speaking. You can stop the response at any time.',
      'Listening. Speak when you are ready.',
      'The customer is speaking. You can stop the response at any time.',
      'Listening. Speak when you are ready.',
      'Your microphone is muted.',
      'Microphone on.',
    ]);
    const ids = seen.map((entry) => entry.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of seen) {
      expect(entry.text).toMatch(/^[A-Z].*[.]$/);
      for (const turn of h.snap().turns) expect(entry.text).not.toContain(turn.text);
    }
  });
});

describe('a call that is resumed', () => {
  it('keeps its transcript, mood trace and message count, and carries on from the last reply', async () => {
    h.useServer(new FakeServer({ traineeTurns: 2 }));
    await h.mount();
    expect(h.snap().turns).toHaveLength(5);
    await h.begin(true);
    await advance(400);
    expect(phase()).toBe('listening');
    await h.say();
    expect(h.snap().turns).toHaveLength(7);
    expect(h.snap().turns.at(-2)).toMatchObject({ index: 6, role: 'trainee' });
    expect(h.snap().turnsRemaining).toBe(57);
  });
});

describe('text fallback as a mode', () => {
  const typeIn = async (text: string) => {
    let accepted = false;
    h.do(() => {
      void h
        .actions()
        .sendText(text)
        .then((ok) => (accepted = ok));
    });
    await flush();
    return accepted;
  };

  it('lets go of the microphone and the voice, sends typed messages as one message each, and goes back to voice', async () => {
    await h.mount();
    await h.openCall();
    expect(h.env.mic.openTracks()).toHaveLength(1);

    h.do(() => h.actions().useText());
    expect(h.snap()).toMatchObject({ mode: 'text', stage: 'ready', phase: 'ready-for-next-turn' });
    expect(h.snap().announcement?.text).toBe('You are typing your replies.');
    expect(h.env.mic.openTracks()).toHaveLength(0);
    expect(h.env.audio.listeningWorklets()).toHaveLength(0);
    // Hands-free does not reopen a microphone that has been given up.
    await advance(30_000);
    expect(phase()).toBe('ready-for-next-turn');

    expect(await typeIn('Typed from the fallback')).toBe(true);
    expect(h.server.sent.map((request) => [request.text, request.inputMode])).toEqual([
      ['Typed from the fallback', 'text'],
    ]);
    expect(h.snap().turns.filter((turn) => turn.role === 'trainee')).toHaveLength(1);
    // Replies are captions in a typed call: only the opening line was ever spoken.
    expect(h.server.spoken).toEqual([1]);
    expect(h.snap().stage).toBe('ready');

    // Back to voice: the microphone returns, and the call listens again.
    await h.begin(true);
    expect(h.snap()).toMatchObject({ mode: 'voice', microphone: 'granted' });
    expect(h.env.mic.openTracks()).toHaveLength(1);
    await advance(400);
    expect(phase()).toBe('listening');
  });

  it('stops a customer voice that is playing, and keeps what the customer said', async () => {
    await h.mount();
    await h.begin(true);
    expect(phase()).toBe('customer-speaking');
    const before = h.snap().turns.map((turn) => turn.text);
    h.do(() => h.actions().useText());
    expect(h.snap()).toMatchObject({ mode: 'text', phase: 'ready-for-next-turn' });
    expect(h.env.element.latest().paused).toBe(true);
    expect(h.snap().turns.map((turn) => turn.text)).toEqual(before);
    // The voice was audible when the trainee gave it up for typing: the reply was cut off.
    expect(h.snap().turns[0]?.interrupted).toBe(true);
  });

  it('waits out a sentence that is being transcribed, so nothing the trainee said is lost', async () => {
    h.server.transcripts.push('hang');
    await h.mount();
    await h.openCall();
    await h.say();
    expect(phase()).toBe('transcribing');
    h.do(() => h.actions().useText());
    expect(phase()).toBe('transcribing');
    expect(h.snap().mode).toBe('voice');
  });
});

describe('the customer audio', () => {
  it('can be switched off in the middle of a reply, and the next replies are captions', async () => {
    await h.mount();
    await h.begin(true);
    expect(phase()).toBe('customer-speaking');
    h.do(() => h.actions().setAudio(false));
    expect(h.snap()).toMatchObject({ audio: 'off', phase: 'ready-for-next-turn' });
    expect(h.snap().announcement?.text).toBe('Customer audio off.');
    expect(h.env.element.latest().paused).toBe(true);
    expect(h.snap().turns[0]?.interrupted).toBe(true);

    await advance(400);
    expect(phase()).toBe('listening');
    await h.say();
    expect(h.server.spoken).toEqual([1]);
    expect(h.snap().turns.at(-1)).toMatchObject({ role: 'customer', status: 'sent' });
    expect(h.snap().stage).toBe('ready');
    await advance(400);
    expect(h.snap().stage).toBe('listening');

    h.do(() => h.actions().setAudio(true));
    expect(h.snap().audio).toBe('on');
    await h.say();
    expect(h.server.spoken).toEqual([1, 5]);
  });

  it('is none, and cannot be switched on, in a browser that has no voice at all', async () => {
    await h.mount({ fakes: { audioElement: false } });
    await h.begin(true);
    expect(h.snap().audio).toBe('none');
    h.do(() => h.actions().setAudio(true));
    expect(h.snap().audio).toBe('none');
  });
});

describe('coming back online', () => {
  const typeIn = async (text: string) => {
    h.do(() => {
      void h.actions().sendText(text);
    });
    await flush();
  };

  it('sends a message that failed because the network was gone again, by itself, once and never twice', async () => {
    h.server.sendSteps.push(() => networkError());
    await h.mount();
    await h.begin(false);
    await typeIn('Hello');
    expect(h.snap()).toMatchObject({ stage: 'offline', problem: { code: 'offline' } });
    expect(h.snap().turns.at(-1)).toMatchObject({ status: 'failed', text: 'Hello' });

    h.do(() => {
      window.dispatchEvent(new Event('online'));
      window.dispatchEvent(new Event('online'));
    });
    await flush();
    const ids = h.server.sent.map((request) => request.clientMessageId);
    expect(ids).toHaveLength(2);
    expect(ids[1]).toBe(ids[0]);
    expect(h.snap().problem).toBeNull();
    expect(h.snap().turns.map((turn) => [turn.role, turn.status])).toEqual([
      ['customer', 'sent'],
      ['trainee', 'sent'],
      ['customer', 'sent'],
    ]);
  });

  it('leaves everything else for the trainee to retry, and does nothing once the call is gone', async () => {
    h.server.transcripts.push(networkError());
    await h.mount();
    await h.openCall();
    await h.say();
    expect(h.snap().problem).toMatchObject({ code: 'offline', retry: 'transcribe' });
    h.do(() => window.dispatchEvent(new Event('online')));
    await flush();
    expect(h.snap().problem?.code).toBe('offline');
    expect(mocked.sendMessage).not.toHaveBeenCalled();

    h.server.sendSteps.push(() => networkError());
    h.call.unmount();
    window.dispatchEvent(new Event('online'));
    expect(mocked.sendMessage).not.toHaveBeenCalled();
  });
});
