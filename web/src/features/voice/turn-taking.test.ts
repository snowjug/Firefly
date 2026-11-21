import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpokenTurn } from '../../lib/api.ts';
import { acquireMicrophone } from './capture/microphone.ts';
import { createServerCapture } from './capture/server-capture.ts';
import { CAPTURE_TUNING } from './capture/tuning.ts';
import type { Capture, CaptureHandlers, CaptureSession } from './capture/types.ts';
import { createServerPlayback } from './playback/server-playback.ts';
import type { Playback, PlaybackHandlers, PlayRequest } from './playback/types.ts';
import { installFakes, type FakeEnv } from './testing/fakes.ts';
import { createTurnGate, gatePlayback, guardCapture } from './turn-taking.ts';

// Controlled turn-taking: the customer speaks, the trainee can stop the customer at any time, and
// the microphone opens only after the customer's voice has ended, with a short settle in between.
// The gate is the part that holds even when a caller forgets: a guarded capture refuses to listen
// while it is not the trainee's turn. See barge-in.test.ts for why the customer is never stopped by
// the sound of the trainee.

let env: FakeEnv | null = null;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  env?.uninstall();
  env = null;
  vi.useRealTimers();
});

/** A clock the test moves by hand. */
function clock(start = 1_000) {
  let now = start;
  return { now: () => now, advance: (ms: number) => void (now += ms) };
}

describe('the turn gate', () => {
  it("is the trainee's turn until the customer is asked to speak", () => {
    const gate = createTurnGate({ now: clock().now });
    expect(gate.canListen()).toBe(true);
    expect(gate.owner()).toBe('trainee');
    expect(gate.waitMs()).toBe(0);
  });

  it("is the customer's turn from the moment their voice is asked for, even before any sound", () => {
    const gate = createTurnGate({ now: clock().now });
    gate.customerStarted();
    expect(gate.canListen()).toBe(false);
    expect(gate.owner()).toBe('customer');
    expect(gate.waitMs()).toBe(Number.POSITIVE_INFINITY);
  });

  it("hands the turn back only after the settle that follows the customer's voice", () => {
    const time = clock();
    const gate = createTurnGate({ now: time.now });
    gate.customerStarted();
    time.advance(5000);
    gate.customerStopped();
    expect(gate.canListen()).toBe(false);
    expect(gate.owner()).toBe('customer');
    expect(gate.waitMs()).toBe(CAPTURE_TUNING.settleAfterPlaybackMs);
    time.advance(CAPTURE_TUNING.settleAfterPlaybackMs - 1);
    expect(gate.canListen()).toBe(false);
    expect(gate.waitMs()).toBe(1);
    time.advance(1);
    expect(gate.canListen()).toBe(true);
    expect(gate.owner()).toBe('trainee');
  });

  it('can be given another settle', () => {
    const time = clock();
    const gate = createTurnGate({ now: time.now, settleMs: 1000 });
    gate.customerStarted();
    gate.customerStopped();
    time.advance(999);
    expect(gate.canListen()).toBe(false);
    time.advance(1);
    expect(gate.canListen()).toBe(true);
  });

  it('does not start a settle when the customer was never speaking', () => {
    const gate = createTurnGate({ now: clock().now });
    gate.customerStopped();
    expect(gate.canListen()).toBe(true);
  });

  it('keeps a reply that follows another from handing over the turn in between', () => {
    const time = clock();
    const gate = createTurnGate({ now: time.now });
    gate.customerStarted();
    gate.customerStopped();
    time.advance(100);
    gate.customerStarted();
    time.advance(CAPTURE_TUNING.settleAfterPlaybackMs * 3);
    expect(gate.canListen()).toBe(false);
  });
});

function fakeCapture() {
  const sessions: CaptureSession[] = [];
  const capture: Capture = {
    engine: 'server-speech',
    prepare: vi.fn(),
    listen: vi.fn((): CaptureSession => {
      const session = { finish: vi.fn(), cancel: vi.fn() };
      sessions.push(session);
      return session;
    }),
    dispose: vi.fn(),
  };
  return { capture, sessions };
}

const noHandlers = (extra: Partial<CaptureHandlers> = {}): CaptureHandlers => ({
  onSpeechStart: () => undefined,
  onSpeechEnd: () => undefined,
  onSpeechDropped: () => undefined,
  onInterim: () => undefined,
  onAudio: () => undefined,
  onText: () => undefined,
  onNothing: () => undefined,
  onFailure: () => undefined,
  ...extra,
});

describe('a guarded capture', () => {
  it("is the capture it wraps when it is the trainee's turn", () => {
    const { capture, sessions } = fakeCapture();
    const guarded = guardCapture(capture, createTurnGate({ now: clock().now }));
    expect(guarded.engine).toBe('server-speech');
    const handlers = noHandlers();
    expect(guarded.listen(handlers)).toBe(sessions[0]);
    expect(capture.listen).toHaveBeenCalledWith(handlers);
    guarded.prepare();
    guarded.dispose();
    expect(capture.prepare).toHaveBeenCalledTimes(1);
    expect(capture.dispose).toHaveBeenCalledTimes(1);
  });

  it('never opens the microphone while the customer speaks: it says so and does nothing', async () => {
    const { capture } = fakeCapture();
    const gate = createTurnGate({ now: clock().now });
    const guarded = guardCapture(capture, gate);
    gate.customerStarted();
    const blocked = vi.fn();
    const session = guarded.listen(noHandlers({ onBlocked: blocked }));
    expect(capture.listen).not.toHaveBeenCalled();
    // Told after the call returns, not before, so the caller has the session in hand.
    expect(blocked).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(blocked).toHaveBeenCalledTimes(1);
    expect(blocked).toHaveBeenCalledWith('customer-speaking');
    expect(() => {
      session.finish();
      session.cancel();
    }).not.toThrow();
  });

  it('also refuses during the settle after the customer stops, and allows it once that has passed', async () => {
    const time = clock();
    const { capture } = fakeCapture();
    const gate = createTurnGate({ now: time.now });
    const guarded = guardCapture(capture, gate);
    gate.customerStarted();
    gate.customerStopped();
    const blocked = vi.fn();
    guarded.listen(noHandlers({ onBlocked: blocked }));
    await Promise.resolve();
    expect(blocked).toHaveBeenCalledTimes(1);
    expect(capture.listen).not.toHaveBeenCalled();
    time.advance(CAPTURE_TUNING.settleAfterPlaybackMs);
    guarded.listen(noHandlers({ onBlocked: blocked }));
    expect(capture.listen).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(blocked).toHaveBeenCalledTimes(1);
  });

  it('is fine with a caller that predates the blocked report', async () => {
    const { capture } = fakeCapture();
    const gate = createTurnGate({ now: clock().now });
    gate.customerStarted();
    guardCapture(capture, gate).listen(noHandlers());
    await Promise.resolve();
    expect(capture.listen).not.toHaveBeenCalled();
  });
});

function fakePlayback() {
  const captured: { handlers: PlaybackHandlers | null } = { handlers: null };
  const stop = vi.fn(() => ({ interrupted: true, playedMs: 900 }));
  const playback: Playback = {
    engine: 'server-speech',
    prime: vi.fn(),
    play: vi.fn((_request: PlayRequest, handlers: PlaybackHandlers) => {
      captured.handlers = handlers;
      return { stop };
    }),
    dispose: vi.fn(),
  };
  return { playback, captured, stop };
}

const request: PlayRequest = {
  sessionId: 'session-12345678',
  turnIndex: 2,
  text: 'Hello there.',
  language: 'en-GB',
  mood: 'calm',
  voiceSeed: 'Alex Morgan',
};

function reports() {
  const log: string[] = [];
  const handlers: PlaybackHandlers = {
    onStart: () => log.push('start'),
    onDuration: () => log.push('duration'),
    onEnd: () => log.push('end'),
    onBlocked: () => log.push('blocked'),
    onFailure: (kind) => log.push(`failure:${kind}`),
    onLevel: () => log.push('level'),
    onDetails: () => log.push('details'),
  };
  return { log, handlers };
}

describe('a gated playback', () => {
  it('claims the turn for the customer as soon as the voice is asked for, before it has started', () => {
    const { playback } = fakePlayback();
    const gate = createTurnGate({ now: clock().now });
    gatePlayback(playback, gate).play(request, reports().handlers);
    expect(gate.owner()).toBe('customer');
  });

  it('hands the turn back, after the settle, when the voice ends', () => {
    const time = clock();
    const { playback, captured } = fakePlayback();
    const gate = createTurnGate({ now: time.now });
    const { log, handlers } = reports();
    gatePlayback(playback, gate).play(request, handlers);
    captured.handlers?.onStart({ estimateMs: 1000 });
    expect(gate.canListen()).toBe(false);
    captured.handlers?.onEnd();
    expect(log).toEqual(['start', 'end']);
    expect(gate.canListen()).toBe(false);
    time.advance(CAPTURE_TUNING.settleAfterPlaybackMs);
    expect(gate.canListen()).toBe(true);
  });

  it('hands the turn back when the voice could not be made, could not play, or was blocked', () => {
    for (const outcome of ['generation', 'playback', 'blocked'] as const) {
      const { playback, captured } = fakePlayback();
      const time = clock();
      const gate = createTurnGate({ now: time.now });
      const { log, handlers } = reports();
      gatePlayback(playback, gate).play(request, handlers);
      expect(gate.canListen()).toBe(false);
      if (outcome === 'blocked') captured.handlers?.onBlocked();
      else captured.handlers?.onFailure(outcome);
      expect(log).toEqual([outcome === 'blocked' ? 'blocked' : `failure:${outcome}`]);
      time.advance(CAPTURE_TUNING.settleAfterPlaybackMs);
      expect(gate.canListen()).toBe(true);
    }
  });

  it('hands the turn back on "Stop response", and returns what stopping said', () => {
    const time = clock();
    const { playback, stop } = fakePlayback();
    const gate = createTurnGate({ now: time.now });
    const job = gatePlayback(playback, gate).play(request, reports().handlers);
    expect(job.stop()).toEqual({ interrupted: true, playedMs: 900 });
    expect(stop).toHaveBeenCalledTimes(1);
    time.advance(CAPTURE_TUNING.settleAfterPlaybackMs);
    expect(gate.canListen()).toBe(true);
  });

  it('hands the turn back when disposed, and passes everything else through', () => {
    const { playback } = fakePlayback();
    const gate = createTurnGate({ now: clock().now, settleMs: 0 });
    const gated = gatePlayback(playback, gate);
    expect(gated.engine).toBe('server-speech');
    gated.prime();
    expect(playback.prime).toHaveBeenCalledTimes(1);
    gated.play(request, reports().handlers);
    gated.dispose();
    expect(playback.dispose).toHaveBeenCalledTimes(1);
    expect(gate.canListen()).toBe(true);
  });

  it('forwards the reports it does not need to watch', () => {
    const { playback, captured } = fakePlayback();
    const { log, handlers } = reports();
    gatePlayback(playback, createTurnGate({ now: clock().now })).play(request, handlers);
    captured.handlers?.onDetails({ voice: 'v', style: 'none', local: null, lang: null });
    captured.handlers?.onDuration(1200);
    captured.handlers?.onLevel(0.4);
    expect(log).toEqual(['details', 'duration', 'level']);
  });
});

describe('the gate with a real capture and a real playback', () => {
  const spoken: SpokenTurn = {
    audio: new Blob(['audio']),
    contentType: 'audio/mpeg',
    provider: 'mock',
    voice: 'mock-voice',
    style: 'none',
  };
  const settle = async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
    await vi.advanceTimersByTimeAsync(0);
  };

  it("keeps the microphone closed for the whole of the customer's turn and opens it for the trainee after", async () => {
    env = installFakes();
    const gate = createTurnGate();
    const microphone = await acquireMicrophone({ worklet: true });
    const capture = guardCapture(createServerCapture({ microphone }), gate);
    const playback = gatePlayback(createServerPlayback({ speakTurn: async () => spoken }), gate);
    playback.prime();
    await settle();

    // The customer is asked to speak: the reply is still being made, and the microphone is shut.
    const customer = reports();
    playback.play(request, customer.handlers);
    const blocked = vi.fn();
    const refused = capture.listen(noHandlers({ onBlocked: blocked, onListening: vi.fn() }));
    await settle();
    expect(blocked).toHaveBeenCalledWith('customer-speaking');
    expect(env.audio.listeningWorklets()).toHaveLength(0);
    expect(customer.log).toContain('start');
    refused.cancel();

    // While the voice plays, still shut.
    capture.listen(noHandlers({ onBlocked: blocked }));
    await settle();
    expect(blocked).toHaveBeenCalledTimes(2);
    expect(env.audio.listeningWorklets()).toHaveLength(0);

    // The voice ends. Shut through the settle, then open.
    env.element.latest().finish();
    expect(customer.log.at(-1)).toBe('end');
    capture.listen(noHandlers({ onBlocked: blocked }));
    await settle();
    expect(blocked).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(CAPTURE_TUNING.settleAfterPlaybackMs);
    const listening = vi.fn();
    capture.listen(noHandlers({ onBlocked: blocked, onListening: listening }));
    await settle();
    expect(blocked).toHaveBeenCalledTimes(3);
    expect(listening).toHaveBeenCalledTimes(1);
    expect(env.audio.listeningWorklets()).toHaveLength(1);

    capture.dispose();
    playback.dispose();
    microphone.release();
  });

  it('lets the trainee stop the customer, who is then cut off, and the microphone opens after the settle', async () => {
    env = installFakes();
    const gate = createTurnGate();
    const microphone = await acquireMicrophone({ worklet: true });
    const capture = guardCapture(createServerCapture({ microphone }), gate);
    const playback = gatePlayback(createServerPlayback({ speakTurn: async () => spoken }), gate);
    const customer = reports();
    const job = playback.play(request, customer.handlers);
    await settle();
    expect(customer.log).toContain('start');
    await vi.advanceTimersByTimeAsync(1500);

    const stopped = job.stop();
    expect(stopped.interrupted).toBe(true);
    expect(stopped.playedMs).toBeGreaterThanOrEqual(1400);
    expect(env.element.playing()).toHaveLength(0);
    // Nothing more is said about a reply that was stopped.
    expect(customer.log).not.toContain('end');

    const blocked = vi.fn();
    capture.listen(noHandlers({ onBlocked: blocked }));
    await settle();
    expect(blocked).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(CAPTURE_TUNING.settleAfterPlaybackMs);
    const listening = vi.fn();
    capture.listen(noHandlers({ onListening: listening }));
    await settle();
    expect(listening).toHaveBeenCalledTimes(1);

    capture.dispose();
    playback.dispose();
    microphone.release();
  });
});
