import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../lib/api.ts';
import type { FakeEnv } from '../voice/testing/fakes.ts';
import {
  advance,
  apiError,
  FakeServer,
  flush,
  Harness,
  NO_SERVER_SPEECH,
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

const mocked = vi.mocked(api);
const h = new Harness(mocked);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-02T10:00:30.000Z'));
  vi.clearAllMocks();
  // A call that already has messages, so that it can be ended and reviewed.
  h.setup({ traineeTurns: 2 });
});

afterEach(() => {
  h.teardown();
  vi.useRealTimers();
});

const phase = () => h.snap().phase;

/** Nothing the call opened is still open. */
function expectNothingOpen(env: FakeEnv): void {
  expect(env.mic.openTracks()).toHaveLength(0);
  expect(env.audio.openContexts()).toHaveLength(0);
  expect(env.audio.listeningWorklets()).toHaveLength(0);
  expect(env.edgeCount()).toBe(0);
  expect(env.listenerCount()).toBe(0);
  expect(env.urls.live()).toHaveLength(0);
  expect(env.elements.every((element) => element.paused)).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
}

describe('endCall', () => {
  it('stops capture, closes the call on the server, and resolves with the session to open the report for', async () => {
    await h.mount();
    await h.openCall();
    expect(h.env.audio.listeningWorklets()).toHaveLength(1);

    let outcome: { sessionId: string } | null = null;
    await act(async () => {
      outcome = await h.actions().endCall();
    });
    expect(outcome).toEqual({ sessionId: SESSION_ID });
    expect(phase()).toBe('completed');
    expect(h.snap().session?.status).toBe('completing');
    expect(h.snap().announcement?.text).toBe('The call is complete.');
    expect(h.server.endCalls).toBe(1);
    // Everything the call opened is closed: the call is over, nothing waits for the screen to leave.
    expectNothingOpen(h.env);
    // The elapsed time stops where the call stopped.
    const stopped = h.snap().elapsedSeconds;
    await advance(10_000);
    expect(h.snap().elapsedSeconds).toBe(stopped);
  });

  it('is idempotent: asking again, while it runs or after it has finished, returns the same promise', async () => {
    await h.mount();
    await h.openCall();
    let first!: Promise<{ sessionId: string } | null>;
    let second!: Promise<{ sessionId: string } | null>;
    h.do(() => {
      first = h.actions().endCall();
      second = h.actions().endCall();
    });
    expect(second).toBe(first);
    await flush();
    expect(await first).toEqual({ sessionId: SESSION_ID });
    expect(h.actions().endCall()).toBe(first);
    expect(h.server.endCalls).toBe(1);
  });

  const phases: Array<[string, () => Promise<void>]> = [
    [
      'before the call began',
      async () => {
        await h.mount();
      },
    ],
    [
      'while the permission prompt is open',
      async () => {
        await h.mount();
        h.env.mic.mode = 'hang';
        h.do(() => void h.actions().begin({ voice: true }));
        await flush();
        expect(phase()).toBe('requesting-microphone');
      },
    ],
    [
      'while the opening line plays',
      async () => {
        h.setup();
        h.server.allowEmptyEnd = true;
        await h.mount();
        await h.begin(true);
        expect(phase()).toBe('customer-speaking');
      },
    ],
    [
      'while listening',
      async () => {
        await h.mount();
        await h.openCall();
        expect(phase()).toBe('listening');
      },
    ],
    [
      'while the trainee is speaking',
      async () => {
        await h.mount();
        await h.openCall();
        await act(async () => {
          h.env.audio.feed(new Float32Array(16000).fill(0.2));
        });
        expect(h.snap().speechDetected).toBe(true);
      },
    ],
    [
      'while speech is being transcribed',
      async () => {
        h.server.transcripts.push('hang');
        await h.mount();
        await h.openCall();
        await h.say();
        expect(phase()).toBe('transcribing');
      },
    ],
    [
      'while the reply is being produced',
      async () => {
        h.server.sendDelayMs = 3000;
        await h.mount();
        await h.openCall();
        await h.say();
        expect(phase()).toBe('processing');
      },
    ],
    [
      'while the customer replies aloud',
      async () => {
        await h.mount();
        await h.openCall();
        await h.say();
        expect(phase()).toBe('customer-speaking');
      },
    ],
    [
      'while paused',
      async () => {
        await h.mount();
        await h.openCall();
        h.do(() => h.actions().togglePause());
      },
    ],
    [
      'while muted',
      async () => {
        await h.mount();
        await h.openCall();
        h.do(() => h.actions().toggleMute());
      },
    ],
    [
      'in a typed call',
      async () => {
        await h.mount();
        await h.begin(false);
      },
    ],
  ];

  it.each(phases)('is safe %s, and leaves nothing open', async (_label, arrange) => {
    await arrange();
    let outcome: { sessionId: string } | null = null;
    await act(async () => {
      const ending = h.actions().endCall();
      // A message that is being produced is given a moment to finish.
      await vi.advanceTimersByTimeAsync(5000);
      outcome = await ending;
    });
    await flush();
    expect(outcome).toEqual({ sessionId: SESSION_ID });
    expect(phase()).toBe('completed');
    expect(h.server.endCalls).toBe(1);
    // The microphone is released at once, and a late permission answer opens nothing.
    await act(async () => {
      h.env.mic.settle('grant');
    });
    await flush();
    expectNothingOpen(h.env);
  });

  it('aborts speech that is being transcribed, never sends it, and keeps the stored turns', async () => {
    h.server.transcripts.push('hang');
    await h.mount();
    await h.openCall();
    await h.say();
    const stored = h.server.turns.length;
    await h.endCall();
    expect(h.server.transcribeSignals[0]?.aborted).toBe(true);
    expect(mocked.sendMessage).not.toHaveBeenCalled();
    expect(h.server.turns).toHaveLength(stored);
    // The utterance that was never sent is not left in the transcript.
    expect(h.snap().turns.map((turn) => turn.index)).toEqual([1, 2, 3, 4, 5]);
  });

  it('stops the customer\u2019s voice at once', async () => {
    h.setup();
    h.server.allowEmptyEnd = true;
    await h.mount();
    await h.begin(true);
    const element = h.env.element.latest();
    expect(element.paused).toBe(false);
    await h.endCall();
    expect(element.paused).toBe(true);
    expect(h.env.urls.live()).toHaveLength(0);
  });

  it('waits for a message already in flight to finish, then ends, and does not speak the reply', async () => {
    h.server.sendDelayMs = 3000;
    await h.mount();
    await h.begin(false);
    h.do(() => void h.actions().sendText('One last thing'));
    await advance(100);
    expect(phase()).toBe('processing');

    let outcome: { sessionId: string } | null = null;
    h.do(() => {
      void h
        .actions()
        .endCall()
        .then((value) => (outcome = value));
    });
    expect(phase()).toBe('ending');
    await advance(2000);
    expect(h.server.endCalls).toBe(0);
    await advance(1500);
    await flush();
    expect(outcome).toEqual({ sessionId: SESSION_ID });
    // The reply arrived before the call was closed, and is in the transcript.
    expect(h.snap().turns.at(-2)).toMatchObject({
      role: 'trainee',
      text: 'One last thing',
      status: 'sent',
    });
    expect(h.snap().turns.at(-1)).toMatchObject({ role: 'customer' });
    expect(h.server.spoken).toEqual([]);
    expect(mocked.endSession.mock.invocationCallOrder[0]).toBeGreaterThan(
      mocked.sendMessage.mock.invocationCallOrder[0] ?? Infinity,
    );
  });

  it('gives up waiting after 8 seconds, aborts the message, and ends the call anyway', async () => {
    h.server.sendSteps.push(() => 'hang');
    await h.mount();
    await h.begin(false);
    h.do(() => void h.actions().sendText('Stuck'));
    await advance(100);
    let outcome: { sessionId: string } | null = null;
    h.do(() => {
      void h
        .actions()
        .endCall()
        .then((value) => (outcome = value));
    });
    await advance(7800);
    expect(h.server.endCalls).toBe(0);
    await advance(400);
    await flush();
    expect(h.server.sendSignals[0]?.aborted).toBe(true);
    expect(h.server.endCalls).toBe(1);
    expect(outcome).toEqual({ sessionId: SESSION_ID });
    // The message stays in the transcript as failed: stored turns are never lost, and this one may be.
    expect(h.snap().turns.at(-1)).toMatchObject({
      role: 'trainee',
      status: 'failed',
      text: 'Stuck',
    });
  });

  it('retries a conflict (a message still being handled) a few times with growing waits', async () => {
    h.server.endSteps.push(apiError(409, 'conflict', true), apiError(409, 'conflict', true));
    await h.mount();
    await h.begin(false);
    let outcome: { sessionId: string } | null = null;
    h.do(() => {
      void h
        .actions()
        .endCall()
        .then((value) => (outcome = value));
    });
    await advance(100);
    expect(h.server.endCalls).toBe(1);
    await advance(400);
    expect(h.server.endCalls).toBe(2);
    await advance(800);
    await flush();
    expect(h.server.endCalls).toBe(3);
    expect(outcome).toEqual({ sessionId: SESSION_ID });
    expect(phase()).toBe('completed');
  });

  it('reports a failure with Try again, keeps the call as it was, and can be asked again', async () => {
    h.server.endSteps.push(apiError(500, 'internal', true));
    await h.mount();
    await h.openCall();
    const before = h.snap().turns;
    const outcome = await h.endCall();
    expect(outcome).toBeNull();
    expect(phase()).toBe('ready-for-next-turn');
    expect(h.snap().problem).toMatchObject({
      code: 'end-failed',
      retry: 'end',
      severity: 'degraded',
      textFallback: true,
    });
    expect(h.snap().turns).toEqual(before);
    // The microphone was let go of when ending began, so the spoken call carries on paused.
    expect(h.snap().paused).toBe(true);
    expect(h.env.mic.openTracks()).toHaveLength(0);

    h.do(() => h.actions().retry());
    await flush();
    expect(phase()).toBe('completed');
    expect(h.server.endCalls).toBe(2);
    expectNothingOpen(h.env);
  });

  it('says so when ending fails because the trainee is offline', async () => {
    h.server.endSteps.push(networkError());
    await h.mount();
    await h.begin(false);
    expect(await h.endCall()).toBeNull();
    expect(h.snap().problem).toMatchObject({ code: 'offline', retry: 'end' });
    expect(h.snap().problem?.preserved).toMatch(/still open/);
  });

  it('says there is nothing to review when no message was ever sent, and the call can go on', async () => {
    h.setup();
    await h.mount();
    await h.begin(false);
    expect(await h.endCall()).toBeNull();
    expect(h.snap().problem).toMatchObject({ code: 'end-failed', retry: null });
    expect(h.snap().problem?.title).toBe('There is nothing to review yet.');
    expect(phase()).toBe('ready-for-next-turn');
    let accepted = false;
    h.do(
      () =>
        void h
          .actions()
          .sendText('Hello')
          .then((ok) => (accepted = ok)),
    );
    await flush();
    expect(accepted).toBe(true);
  });

  it('records nothing and plays nothing once the call has ended', async () => {
    await h.mount();
    await h.openCall();
    await h.endCall();
    const requests = h.env.mic.getUserMedia.mock.calls.length;
    await h.say();
    h.do(() => h.actions().talk());
    h.do(() => h.actions().replay());
    h.do(() => h.actions().togglePause());
    await h.begin(true);
    await advance(30_000);
    expect(mocked.transcribe).not.toHaveBeenCalled();
    expect(h.env.mic.getUserMedia.mock.calls.length).toBe(requests);
    let accepted = true;
    h.do(
      () =>
        void h
          .actions()
          .sendText('late')
          .then((ok) => (accepted = ok)),
    );
    await flush();
    expect(accepted).toBe(false);
    expect(phase()).toBe('completed');
    expectNothingOpen(h.env);
  });
});

describe('leaving the screen', () => {
  const scenes: Array<[string, () => Promise<void>]> = [
    [
      'before the session has loaded',
      async () => {
        await h.mount({ load: false });
      },
    ],
    [
      'while listening',
      async () => {
        await h.mount();
        await h.openCall();
      },
    ],
    [
      'while the trainee is speaking',
      async () => {
        await h.mount();
        await h.openCall();
        await act(async () => {
          h.env.audio.feed(new Float32Array(16000).fill(0.2));
        });
      },
    ],
    [
      'while the permission prompt is open',
      async () => {
        await h.mount();
        h.env.mic.mode = 'hang';
        h.do(() => void h.actions().begin({ voice: true }));
        await flush();
      },
    ],
    [
      'while speech is being transcribed',
      async () => {
        h.server.transcripts.push('hang');
        await h.mount();
        await h.openCall();
        await h.say();
      },
    ],
    [
      'while a message is being sent',
      async () => {
        h.server.sendDelayMs = 20_000;
        await h.mount();
        await h.openCall();
        await h.say();
      },
    ],
    [
      'while the customer is speaking',
      async () => {
        h.setup();
        await h.mount();
        await h.begin(true);
      },
    ],
    [
      'while a voice is being made',
      async () => {
        h.setup();
        h.server.speakSteps.push('hang');
        await h.mount();
        await h.begin(true);
      },
    ],
    [
      'while waiting for Play',
      async () => {
        h.setup();
        await h.mount();
        h.env.element.policy = 'block';
        await h.begin(true);
      },
    ],
    [
      'while paused',
      async () => {
        await h.mount();
        await h.openCall();
        h.do(() => h.actions().togglePause());
      },
    ],
  ];

  it.each(scenes)(
    'releases everything %s: tracks, contexts, nodes, listeners, blob URLs, requests and timers',
    async (_label, arrange) => {
      await arrange();
      const env = h.env;
      h.call.unmount();
      // A request that is still in flight is abandoned the moment the screen is left.
      for (const signal of h.server.openSignals) expect(signal.aborted).toBe(true);
      await flush();
      await advance(60_000);
      expectNothingOpen(env);
      expect(h.server.openSignals.size).toBe(0);
      // Nothing was sent after the screen was left.
      expect(h.server.endCalls).toBe(0);
    },
  );

  it('cancels the browser\u2019s speech and recognition too', async () => {
    h.setup();
    await h.mount({
      fakes: { recognition: true, synthesis: true },
      call: { serverSpeech: NO_SERVER_SPEECH },
    });
    await h.begin(true);
    expect(h.env.speech.spoken).toHaveLength(1);
    h.env.speech.startLatest();
    const cancels = h.env.speech.cancels;
    h.call.unmount();
    expect(h.env.speech.cancels).toBeGreaterThan(cancels);
    expect(vi.getTimerCount()).toBe(0);
    expect(h.env.mic.openTracks()).toHaveLength(0);

    await h.mount({
      fakes: { recognition: true, synthesis: true },
      call: { serverSpeech: NO_SERVER_SPEECH },
    });
    await h.begin(true);
    act(() => h.env.speech.finishLatest());
    await advance(400);
    const recognition = h.env.recognition.latest();
    expect(recognition.running).toBe(true);
    h.call.unmount();
    expect(recognition.aborts).toBe(1);
    expect(recognition.onresult).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('releases a call that is replaced by another, and starts the new one clean', async () => {
    await h.mount();
    await h.openCall();
    expect(h.env.mic.openTracks()).toHaveLength(1);
    h.do(() => h.call.rerender({ sessionId: 'another-session-1' }));
    await flush();
    expect(h.env.mic.openTracks()).toHaveLength(0);
    expect(h.env.audio.listeningWorklets()).toHaveLength(0);
    expect(phase()).toBe('idle');
    expect(mocked.getSession.mock.calls.at(-1)?.[0]).toBe('another-session-1');
    expect(h.snap().turns).toHaveLength(5);
    await h.begin(true);
    expect(h.env.mic.openTracks()).toHaveLength(1);
  });
});

describe('under React StrictMode', () => {
  it('starts nothing twice: one session load in the end, no early microphone, a clean release', async () => {
    await h.mount({ strict: true });
    expect(h.snap().loading).toBe(false);
    expect(h.env.mic.getUserMedia).not.toHaveBeenCalled();
    expect(h.env.contexts).toHaveLength(0);
    await h.openCall();
    expect(h.env.mic.getUserMedia).toHaveBeenCalledTimes(1);
    expect(h.env.mic.openTracks()).toHaveLength(1);
    expect(phase()).toBe('listening');
    await h.say();
    expect(mocked.sendMessage).toHaveBeenCalledTimes(1);
    const env = h.env;
    h.call.unmount();
    await flush();
    expectNothingOpen(env);
  });
});

describe('a long call', () => {
  it('leaves nothing behind after 100 exchanges: no open tracks, no live blob URLs, a constant number of listeners and nodes', async () => {
    h.setup({ traineeTurns: 0 });
    h.server.maxTurns = 1000;
    await h.mount({ call: { maxTraineeTurns: 1000 } });
    await h.openCall();
    await h.exchange(); // the first exchange sets the baseline: everything a call needs is open

    const env = h.env;
    const baseline = {
      listeners: env.listenerCount(),
      edges: env.edgeCount(),
      contexts: env.contexts.length,
      elements: env.elements.length,
      tracks: env.mic.tracks.length,
    };
    expect(baseline.tracks).toBe(1);
    expect(env.mic.openTracks()).toHaveLength(1);

    for (let i = 0; i < 100; i++) {
      await h.exchange();
      expect(env.mic.openTracks()).toHaveLength(1);
      expect(env.urls.live().length).toBeLessThanOrEqual(1);
    }

    expect(mocked.sendMessage).toHaveBeenCalledTimes(101);
    expect(mocked.transcribe).toHaveBeenCalledTimes(101);
    expect(h.snap().turns.filter((turn) => turn.role === 'trainee')).toHaveLength(101);
    expect(h.snap().turnsRemaining).toBe(1000 - 101);
    // The same stream, contexts, elements, listeners and nodes throughout: nothing grows.
    expect(env.mic.getUserMedia).toHaveBeenCalledTimes(1);
    expect(env.mic.tracks).toHaveLength(baseline.tracks);
    expect(env.contexts).toHaveLength(baseline.contexts);
    expect(env.elements).toHaveLength(baseline.elements);
    expect(env.listenerCount()).toBe(baseline.listeners);
    expect(env.edgeCount()).toBe(baseline.edges);
    expect(env.element.maxConcurrent).toBeLessThanOrEqual(1);
    // Every URL made for a reply was revoked.
    expect(env.urls.created).toBeGreaterThan(100);
    expect(env.urls.created - env.urls.revoked).toBeLessThanOrEqual(1);

    await h.endCall();
    expect(phase()).toBe('completed');
    expectNothingOpen(env);
  }, 120_000);
});

describe('the customer\u2019s state', () => {
  it('keeps the mood trace with one point per customer turn, and shows the customer\u2019s state after each reply', async () => {
    h.setup();
    await h.mount();
    await h.begin(false);
    h.server.mood = 'frustrated';
    for (const text of ['One', 'Two']) {
      h.do(() => void h.actions().sendText(text));
      await flush();
    }
    expect(h.snap().stateHistory).toEqual([
      { turnIndex: 1, band: 'calm', label: 'Calm' },
      { turnIndex: 3, band: 'frustrated', label: 'Frustrated' },
      { turnIndex: 5, band: 'frustrated', label: 'Frustrated' },
    ]);
    expect(h.snap().customerState?.band.id).toBe('frustrated');
    expect(h.snap().turnsRemaining).toBe(58);
    // The server's mood is what is shown: the engine invents nothing.
    expect(new FakeServer().session().state.band.id).toBe('calm');
  });
});
