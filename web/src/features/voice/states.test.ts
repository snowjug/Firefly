import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpokenTurn } from '../../lib/api.ts';
import { acquireMicrophone } from './capture/microphone.ts';
import { createServerCapture } from './capture/server-capture.ts';
import { MicrophoneError } from './capture/types.ts';
import { captureError, microphoneError, playbackError, voiceError } from './errors.ts';
import { createServerPlayback } from './playback/server-playback.ts';
import {
  INITIAL_VOICE_STATUS,
  nextVoiceStatus,
  VOICE_STATE_TEXT,
  VOICE_STATES,
  type VoiceSignal,
  type VoiceState,
  type VoiceStatus,
} from './states.ts';
import { installFakes, type FakeEnv } from './testing/fakes.ts';
import { silence, sine } from './testing/signals.ts';
import { createTranscriber } from './transcriber.ts';

// The state vocabulary is data and a pure function. These tests prove two things: the function does
// what the call needs (every exchange, the pause and mute controls, the typed call, errors and the
// end), and each of the first ten states can really be reached from an event the capture, the
// transcriber or the playback produces, which is what the call machine will listen to.
// The events come from the fakes in ./testing: nothing here is a real microphone, a real browser or a
// real speech service.

function tracker(start: VoiceStatus = INITIAL_VOICE_STATUS) {
  let status = start;
  const reached: VoiceState[] = [status.state];
  return {
    send(signal: VoiceSignal): VoiceStatus {
      status = nextVoiceStatus(status, signal);
      if (reached.at(-1) !== status.state) reached.push(status.state);
      return status;
    },
    get status() {
      return status;
    },
    reached,
  };
}

/** The state after each signal in turn. */
const walk = (signals: VoiceSignal[], start?: VoiceStatus): VoiceState[] => {
  const run = tracker(start);
  return signals.map((signal) => run.send(signal).state);
};

const asking: VoiceSignal[] = [{ type: 'begin', voice: true }, { type: 'microphone-granted' }];

describe('what each state says', () => {
  it('has words for every state, and only the states that are announced have an announcement', () => {
    expect(Object.keys(VOICE_STATE_TEXT).sort()).toEqual([...VOICE_STATES].sort());
    for (const state of VOICE_STATES) {
      const { label, announcement, politeness } = VOICE_STATE_TEXT[state];
      expect(label.length).toBeGreaterThan(2);
      expect(label.length).toBeLessThanOrEqual(30);
      expect(announcement === null).toBe(politeness === 'off');
      if (announcement !== null) expect(announcement).toMatch(/^[A-Z].*[.]$/);
    }
    expect(new Set(VOICE_STATES.map((state) => VOICE_STATE_TEXT[state].label)).size).toBe(
      VOICE_STATES.length,
    );
  });

  it('never announces speech being detected: it flips many times a call and would talk over the trainee', () => {
    expect(VOICE_STATE_TEXT['speech-detected']).toMatchObject({
      announcement: null,
      politeness: 'off',
    });
    expect(VOICE_STATE_TEXT['microphone-not-requested'].announcement).toBeNull();
  });

  it('interrupts a screen reader only for the microphone being blocked', () => {
    const assertive = VOICE_STATES.filter(
      (state) => VOICE_STATE_TEXT[state].politeness === 'assertive',
    );
    expect(assertive).toEqual(['permission-denied']);
  });

  it('does not promise the customer will stop when the trainee speaks', () => {
    for (const state of VOICE_STATES) {
      const { label, announcement } = VOICE_STATE_TEXT[state];
      expect(`${label} ${announcement ?? ''}`).not.toMatch(/barge|interrupt|talk over/i);
    }
    expect(VOICE_STATE_TEXT['customer-speaking'].announcement).toMatch(/stop the customer audio/i);
  });
});

describe('nextVoiceStatus', () => {
  it('walks one whole spoken exchange and the end of the call', () => {
    expect(
      walk([
        ...asking,
        { type: 'listening' },
        { type: 'speech-start' },
        { type: 'speech-end' },
        { type: 'transcript' },
        { type: 'reply-requested' },
        { type: 'customer-start' },
        { type: 'customer-end' },
        { type: 'listening' },
        { type: 'end-requested' },
        { type: 'evaluation-started' },
        { type: 'completed' },
      ]),
    ).toEqual([
      'requesting-permission',
      'microphone-ready',
      'listening',
      'speech-detected',
      'processing-speech',
      'transcript-available',
      'generating-customer-reply',
      'customer-speaking',
      'microphone-ready',
      'listening',
      'ending-call',
      'evaluating',
      'completed',
    ]);
  });

  it('goes back to listening when a burst was too short or too quiet to be speech', () => {
    expect(
      walk([
        ...asking,
        { type: 'listening' },
        { type: 'speech-start' },
        { type: 'speech-dropped' },
      ]).slice(-3),
    ).toEqual(['listening', 'speech-detected', 'listening']);
  });

  describe('the typed call', () => {
    it('starts typed, takes replies typed, and rests in typing between them', () => {
      expect(
        walk([
          { type: 'begin', voice: false },
          { type: 'reply-requested' },
          { type: 'customer-start' },
          { type: 'customer-end' },
        ]),
      ).toEqual([
        'text-fallback',
        'generating-customer-reply',
        'customer-speaking',
        'text-fallback',
      ]);
    });

    it('rests in typing after a reply once the trainee chose to type, even in a spoken call', () => {
      const run = tracker();
      for (const signal of asking) run.send(signal);
      run.send({ type: 'use-text' });
      expect(run.status).toMatchObject({ state: 'text-fallback', typed: true });
      for (const signal of [
        { type: 'reply-requested' },
        { type: 'customer-start' },
        { type: 'customer-end' },
      ] as VoiceSignal[]) {
        run.send(signal);
      }
      expect(run.status.state).toBe('text-fallback');
    });

    it('goes back to the microphone only when the trainee asks for it', () => {
      const run = tracker();
      run.send({ type: 'begin', voice: false });
      expect(run.send({ type: 'listening' }).state).toBe('text-fallback');
      expect(run.send({ type: 'begin', voice: true })).toMatchObject({
        state: 'requesting-permission',
        typed: false,
      });
      expect(run.send({ type: 'microphone-granted' }).state).toBe('microphone-ready');
    });
  });

  describe('the microphone failing', () => {
    const failed = (reason: 'denied' | 'missing' | 'busy' | 'unsupported') =>
      walk([
        { type: 'begin', voice: true },
        { type: 'microphone-failed', reason },
      ]).at(-1);

    it('says blocked when blocked, and offers another go for anything else that can be tried again', () => {
      expect(failed('denied')).toBe('permission-denied');
      expect(failed('missing')).toBe('retry-required');
      expect(failed('busy')).toBe('retry-required');
    });

    it('is a typed call when the browser cannot record at all, with nothing to retry', () => {
      const run = tracker();
      run.send({ type: 'begin', voice: true });
      expect(run.send({ type: 'microphone-failed', reason: 'unsupported' })).toMatchObject({
        state: 'text-fallback',
        typed: true,
      });
    });

    it('can try again from a refusal, and a lost microphone mid-call is the same failure', () => {
      expect(
        walk([
          { type: 'begin', voice: true },
          { type: 'microphone-failed', reason: 'denied' },
          { type: 'begin', voice: true },
          { type: 'microphone-granted' },
          { type: 'listening' },
          { type: 'microphone-failed', reason: 'missing' },
          { type: 'begin', voice: true },
        ]),
      ).toEqual([
        'requesting-permission',
        'permission-denied',
        'requesting-permission',
        'microphone-ready',
        'listening',
        'retry-required',
        'requesting-permission',
      ]);
    });
  });

  describe('errors', () => {
    const after = (signal: VoiceSignal) => {
      const run = tracker();
      for (const step of [
        ...asking,
        { type: 'listening' },
        { type: 'speech-start' },
      ] as VoiceSignal[]) {
        run.send(step);
      }
      return run.send(signal);
    };

    it('is a try again for anything that offers Retry or Replay', () => {
      for (const error of [
        voiceError('no-speech'),
        voiceError('transcription-failed'),
        voiceError('offline'),
        playbackError('blocked'),
        playbackError('playback'),
        playbackError('generation'),
        captureError({ kind: 'service', reason: 'network' }),
      ]) {
        expect(after({ type: 'error', error }).state).toBe('retry-required');
      }
    });

    it('is typing for anything that offers only typing, and the call carries on typed', () => {
      for (const error of [
        microphoneError('unsupported'),
        voiceError('speech-unavailable'),
        captureError({ kind: 'service', reason: 'language' }),
      ]) {
        expect(after({ type: 'error', error })).toMatchObject({
          state: 'text-fallback',
          typed: true,
        });
      }
    });

    it('lets the trainee carry on without audio when the customer voice failed', () => {
      const run = tracker();
      for (const step of [
        ...asking,
        { type: 'reply-requested' },
        { type: 'error', error: voiceError('voice-failed') },
      ] as VoiceSignal[]) {
        run.send(step);
      }
      expect(run.status.state).toBe('retry-required');
      expect(run.send({ type: 'continue-without-audio' }).state).toBe('microphone-ready');
      // Not a way out of any other state.
      const idle = tracker();
      expect(idle.send({ type: 'continue-without-audio' })).toBe(idle.status);
    });

    it('is not a retry when the customer voice is simply not available on this server', () => {
      const run = tracker();
      for (const step of [
        ...asking,
        { type: 'reply-requested' },
        { type: 'error', error: voiceError('speech-unavailable', { stage: 'voice' }) },
      ] as VoiceSignal[]) {
        run.send(step);
      }
      expect(run.status.state).toBe('microphone-ready');
    });

    it('treats nothing heard as something to try again, from wherever the pass was', () => {
      expect(walk([...asking, { type: 'listening' }, { type: 'nothing-heard' }]).at(-1)).toBe(
        'retry-required',
      );
      expect(
        walk([
          ...asking,
          { type: 'listening' },
          { type: 'speech-start' },
          { type: 'nothing-heard' },
        ]).at(-1),
      ).toBe('retry-required');
      // And the trainee can speak again from there, or type.
      expect(
        walk([
          ...asking,
          { type: 'listening' },
          { type: 'nothing-heard' },
          { type: 'listening' },
        ]).at(-1),
      ).toBe('listening');
    });
  });

  describe('pause and mute', () => {
    it('return to where the call was resting, and remember typing', () => {
      expect(
        walk([
          ...asking,
          { type: 'listening' },
          { type: 'pause' },
          { type: 'resume' },
          { type: 'listening' },
          { type: 'mute' },
          { type: 'unmute' },
        ]).slice(2),
      ).toEqual([
        'listening',
        'paused',
        'microphone-ready',
        'listening',
        'muted',
        'microphone-ready',
      ]);

      const typed = tracker();
      typed.send({ type: 'begin', voice: false });
      expect(typed.send({ type: 'pause' }).state).toBe('text-fallback');
    });

    it('cannot pause before the call has begun or after it is ending', () => {
      const run = tracker();
      expect(run.send({ type: 'pause' })).toBe(run.status);
      for (const signal of asking) run.send(signal);
      run.send({ type: 'end-requested' });
      const ending = run.status;
      expect(run.send({ type: 'pause' })).toBe(ending);
      expect(run.send({ type: 'mute' })).toBe(ending);
    });
  });

  describe('signals that make no sense where the call is', () => {
    it('change nothing, and give back the very same status', () => {
      const run = tracker();
      const initial = run.status;
      for (const signal of [
        { type: 'listening' },
        { type: 'speech-start' },
        { type: 'speech-end' },
        { type: 'transcript' },
        { type: 'customer-start' },
        { type: 'customer-end' },
        { type: 'resume' },
        { type: 'unmute' },
        { type: 'microphone-granted' },
        { type: 'evaluation-started' },
      ] as VoiceSignal[]) {
        expect(run.send(signal)).toBe(initial);
      }
    });

    it('do not move a paused call', () => {
      const run = tracker();
      for (const step of [...asking, { type: 'pause' }] as VoiceSignal[]) run.send(step);
      const paused = run.status;
      for (const signal of [
        { type: 'speech-start' },
        { type: 'transcript' },
        { type: 'customer-start' },
      ] as VoiceSignal[]) {
        expect(run.send(signal)).toBe(paused);
      }
    });
  });

  describe('ending', () => {
    it('can happen from anywhere, and nothing but its own steps changes it afterwards', () => {
      for (const state of VOICE_STATES.slice(0, 15)) {
        const ended = nextVoiceStatus(
          { state, typed: false, resumeTo: null },
          { type: 'end-requested' },
        );
        expect(ended.state).toBe('ending-call');
        expect(nextVoiceStatus(ended, { type: 'listening' })).toBe(ended);
        expect(nextVoiceStatus(ended, { type: 'reply-requested' })).toBe(ended);
        expect(nextVoiceStatus(ended, { type: 'begin', voice: true })).toBe(ended);
      }
    });

    it('is evaluating only after ending, and completes from anywhere, for good', () => {
      const start = tracker();
      expect(start.send({ type: 'evaluation-started' })).toBe(start.status);
      for (const signal of asking) start.send(signal);
      expect(start.send({ type: 'completed' }).state).toBe('completed');
      const done = start.status;
      expect(start.send({ type: 'end-requested' })).toBe(done);
      expect(start.send({ type: 'listening' })).toBe(done);
    });
  });
});

describe('the first ten states come from events the voice layer really produces', () => {
  let env: FakeEnv;
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    env.uninstall();
    vi.useRealTimers();
  });

  const flush = async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
    await vi.advanceTimersByTimeAsync(0);
  };

  it('reaches each of them from a refused microphone, then a real capture, transcription and playback', async () => {
    env = installFakes();
    const run = tracker();

    // The browser's prompt is open.
    env.mic.mode = 'hang';
    run.send({ type: 'begin', voice: true });
    const asked = acquireMicrophone({ worklet: true });
    expect(env.mic.getUserMedia).toHaveBeenCalledTimes(1);
    expect(run.status.state).toBe('requesting-permission');

    // It is refused.
    env.mic.settle('deny');
    await asked.then(
      () => undefined,
      (error: unknown) => {
        expect(error).toBeInstanceOf(MicrophoneError);
        run.send({ type: 'microphone-failed', reason: (error as MicrophoneError).reason });
      },
    );
    expect(run.status.state).toBe('permission-denied');

    // The trainee allows it and tries again.
    env.mic.mode = 'hang';
    run.send({ type: 'begin', voice: true });
    const again = acquireMicrophone({ worklet: true });
    env.mic.settle('grant');
    const microphone = await again;
    run.send({ type: 'microphone-granted' });
    expect(run.status.state).toBe('microphone-ready');

    // Listening, hearing speech, the speech ending.
    let recording: Blob | null = null;
    createServerCapture({ microphone }).listen({
      onListening: () => run.send({ type: 'listening' }),
      onSpeechStart: () => run.send({ type: 'speech-start' }),
      onSpeechDropped: () => run.send({ type: 'speech-dropped' }),
      onSpeechEnd: () => run.send({ type: 'speech-end' }),
      onInterim: () => undefined,
      onAudio: (blob) => {
        recording = blob;
      },
      onText: () => undefined,
      onNothing: () => run.send({ type: 'nothing-heard' }),
      onFailure: (failure) => run.send({ type: 'error', error: captureError(failure) }),
    });
    await flush();
    expect(run.status.state).toBe('listening');
    env.audio.feed(sine(600, 16000, 0.3));
    expect(run.status.state).toBe('speech-detected');
    env.audio.feed(silence(2000, 16000));
    expect(run.status.state).toBe('processing-speech');
    expect(recording).toBeInstanceOf(Blob);

    // The words come back.
    const transcriber = createTranscriber({
      transcribe: async () => ({
        status: 'recognised',
        text: 'My order has not arrived',
        durationMs: 1800,
      }),
    });
    const outcome = await transcriber.run('message-1', recording as unknown as Blob, 'en-GB');
    expect(outcome.kind).toBe('transcript');
    run.send({ type: 'transcript' });
    expect(run.status.state).toBe('transcript-available');

    // The message is sent and the customer's reply is being made, then spoken.
    run.send({ type: 'reply-requested' });
    expect(run.status.state).toBe('generating-customer-reply');
    const spoken: SpokenTurn = {
      audio: new Blob(['audio']),
      contentType: 'audio/mpeg',
      provider: 'mock',
      voice: 'mock-voice',
      style: 'none',
    };
    const playback = createServerPlayback({ speakTurn: async () => spoken });
    playback.play(
      {
        sessionId: 'session-12345678',
        turnIndex: 2,
        text: 'Thanks for calling.',
        language: 'en-GB',
        mood: 'calm',
        voiceSeed: 'x',
      },
      {
        onStart: () => run.send({ type: 'customer-start' }),
        onDuration: () => undefined,
        onEnd: () => run.send({ type: 'customer-end' }),
        onBlocked: () => run.send({ type: 'error', error: playbackError('blocked') }),
        onFailure: (kind) => run.send({ type: 'error', error: playbackError(kind) }),
        onLevel: () => undefined,
        onDetails: () => undefined,
      },
    );
    await flush();
    expect(run.status.state).toBe('customer-speaking');
    env.element.latest().finish();
    expect(run.status.state).toBe('microphone-ready');

    // Every one of the first ten, in the order a call meets them.
    expect(run.reached).toEqual([
      'microphone-not-requested',
      'requesting-permission',
      'permission-denied',
      'requesting-permission',
      'microphone-ready',
      'listening',
      'speech-detected',
      'processing-speech',
      'transcript-available',
      'generating-customer-reply',
      'customer-speaking',
      'microphone-ready',
    ]);
    for (const state of VOICE_STATES.slice(0, 10)) expect(run.reached).toContain(state);

    playback.dispose();
    microphone.release();
    transcriber.dispose();
  });

  it('reaches "try again" from a pass that heard nothing, and "typing" from a browser that cannot record', async () => {
    env = installFakes();
    const run = tracker();
    run.send({ type: 'begin', voice: true });
    const microphone = await acquireMicrophone({ worklet: true });
    run.send({ type: 'microphone-granted' });
    const pass = createServerCapture({ microphone }).listen({
      onListening: () => run.send({ type: 'listening' }),
      onSpeechStart: () => run.send({ type: 'speech-start' }),
      onSpeechDropped: () => run.send({ type: 'speech-dropped' }),
      onSpeechEnd: () => run.send({ type: 'speech-end' }),
      onInterim: () => undefined,
      onAudio: () => undefined,
      onText: () => undefined,
      onNothing: () => run.send({ type: 'nothing-heard' }),
      onFailure: (failure) => run.send({ type: 'error', error: captureError(failure) }),
    });
    await flush();
    pass.finish();
    expect(run.status.state).toBe('retry-required');
    microphone.release();

    // A browser whose microphone call is unsupported: nothing to retry, the call is typed.
    env.mic.mode = 'unsupported';
    const typed = tracker();
    typed.send({ type: 'begin', voice: true });
    await acquireMicrophone({ worklet: true }).catch((error: unknown) => {
      typed.send({ type: 'microphone-failed', reason: (error as MicrophoneError).reason });
    });
    expect(typed.status).toMatchObject({ state: 'text-fallback', typed: true });
  });
});
