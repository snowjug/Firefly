import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type SpokenTurn } from '../../lib/api.ts';
import { acquireMicrophone } from './capture/microphone.ts';
import { createRecognitionCapture } from './capture/recognition.ts';
import { createServerCapture } from './capture/server-capture.ts';
import { MicrophoneError, type CaptureHandlers } from './capture/types.ts';
import { createBrowserPlayback } from './playback/browser-playback.ts';
import { createServerPlayback, type SpeakTurn } from './playback/server-playback.ts';
import type { PlaybackHandlers, PlayRequest } from './playback/types.ts';
import { createVoicePreview } from './preview.ts';
import { installFakes, type FakeEnv } from './testing/fakes.ts';
import { heldBy, NOTHING_HELD, pairs } from './testing/held.ts';
import { sine } from './testing/signals.ts';
import { createTranscriber, type Transcribe } from './transcriber.ts';

// Everything a spoken call acquires must be let go on every way it can end: it finished, it failed,
// it was abandoned, the screen was left, the call was ended. Each test here first checks that the
// path really did acquire something (an acquire/release pair with nothing acquired proves nothing),
// then ends the path and checks that nothing is held: no microphone track (the browser's recording
// indicator would stay on), no audio context, no capture worklet, no blob URL, no audio element
// playing, no listener, no audio connection, no recognition session, no speech, no timer. They run on
// the fakes in ./testing, which prove the call's own logic, not a browser's.

let env: FakeEnv;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  env.uninstall();
  vi.useRealTimers();
});

const settle = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
  await vi.advanceTimersByTimeAsync(0);
};

const spoken = (): SpokenTurn => ({
  audio: new Blob(['audio']),
  contentType: 'audio/mpeg',
  provider: 'mock',
  voice: 'mock-voice',
  style: 'none',
});

const request = (turnIndex = 2): PlayRequest => ({
  sessionId: 'session-12345678',
  turnIndex,
  text: 'Thanks for calling. How can I help?',
  language: 'en-GB',
  mood: 'calm',
  voiceSeed: 'Alex Morgan',
});

function playbackLog() {
  const log: string[] = [];
  const handlers: PlaybackHandlers = {
    onStart: () => log.push('start'),
    onDuration: () => undefined,
    onEnd: () => log.push('end'),
    onBlocked: () => log.push('blocked'),
    onFailure: (kind) => log.push(`failure:${kind}`),
    onLevel: () => undefined,
    onDetails: () => undefined,
  };
  return { log, handlers };
}

function captureLog() {
  const log: string[] = [];
  const audio: Blob[] = [];
  const handlers: CaptureHandlers = {
    onListening: () => log.push('listening'),
    onSpeechStart: () => log.push('start'),
    onSpeechEnd: ({ reason }) => log.push(`end:${reason}`),
    onSpeechDropped: () => log.push('dropped'),
    onInterim: () => undefined,
    onAudio: (blob) => {
      log.push('audio');
      audio.push(blob);
    },
    onText: (text) => log.push(`text:${text}`),
    onNothing: () => log.push('nothing'),
    onFailure: (failure) => log.push(`failure:${failure.kind}:${failure.reason}`),
  };
  return { log, audio, handlers };
}

const recognised: Transcribe = async () => ({
  status: 'recognised',
  text: 'My order has not arrived',
  durationMs: 1500,
});

/** A request that only ends when it is aborted, the way a real one does. */
const hang = (signal?: AbortSignal): Promise<never> =>
  new Promise<never>((_resolve, reject) => {
    signal?.addEventListener('abort', () => reject(new DOMException('stopped', 'AbortError')));
  });

async function serverSession(options: { speak?: SpeakTurn; transcribe?: Transcribe } = {}) {
  env = installFakes();
  const microphone = await acquireMicrophone({ worklet: true });
  const capture = createServerCapture({ microphone });
  const playback = createServerPlayback({ speakTurn: options.speak ?? (async () => spoken()) });
  const transcriber = createTranscriber({ transcribe: options.transcribe ?? recognised });
  playback.prime();
  await settle();
  return {
    microphone,
    capture,
    playback,
    transcriber,
    /** What the call does when it ends or the screen is left: everything that was started is let go. */
    end() {
      capture.dispose();
      playback.dispose();
      transcriber.dispose();
      microphone.release();
    },
  };
}

describe('the microphone request', () => {
  it('holds nothing when it is refused, and says so', async () => {
    env = installFakes();
    env.mic.mode = 'deny';
    await expect(acquireMicrophone({ worklet: true })).rejects.toBeInstanceOf(MicrophoneError);
    expect(pairs(env).microphoneTracks).toEqual([0, 0]);
    // The audio context made for the gesture was closed again.
    expect(pairs(env).audioContexts).toEqual([1, 1]);
    expect(heldBy(env)).toEqual(NOTHING_HELD);
  });

  it('stops a microphone the browser grants after the request was abandoned', async () => {
    env = installFakes();
    env.mic.mode = 'hang';
    const controller = new AbortController();
    const outcome = acquireMicrophone({ worklet: true, signal: controller.signal }).then(
      () => 'granted',
      (error: unknown) => (error as MicrophoneError).reason,
    );
    controller.abort();
    // The permission prompt cannot be withdrawn, so the grant still arrives, and is let go at once.
    env.mic.settle('grant');
    expect(await outcome).toBe('busy');
    expect(pairs(env).microphoneTracks).toEqual([1, 1]);
    expect(pairs(env).audioContexts[0]).toBeGreaterThan(0);
    expect(heldBy(env)).toEqual(NOTHING_HELD);
  });

  it('lets go of everything when released, however often release is called', async () => {
    env = installFakes();
    const microphone = await acquireMicrophone({ worklet: true });
    expect(heldBy(env)).toMatchObject({ tracks: 1, contexts: 1 });
    microphone.release();
    microphone.release();
    expect(pairs(env)).toEqual({
      microphoneTracks: [1, 1],
      audioContexts: [1, 1],
      objectUrls: [0, 0],
    });
    expect(heldBy(env)).toEqual(NOTHING_HELD);
  });

  it('releases the microphone on pause and takes it again on resume: two pairs, none left over', async () => {
    env = installFakes();
    const first = await acquireMicrophone({ worklet: true });
    first.release();
    const second = await acquireMicrophone({ worklet: true });
    expect(pairs(env).microphoneTracks).toEqual([2, 1]);
    second.release();
    expect(pairs(env).microphoneTracks).toEqual([2, 2]);
    expect(pairs(env).audioContexts).toEqual([2, 2]);
    expect(heldBy(env)).toEqual(NOTHING_HELD);
  });
});

describe('the server speech path', () => {
  it('success: one whole exchange is held only while it is under way, and nothing after the call ends', async () => {
    const session = await serverSession();
    const heard = captureLog();
    session.capture.listen(heard.handlers);
    await settle();
    // Listening: the microphone is open and the worklet is reading it.
    expect(heldBy(env)).toMatchObject({ tracks: 1, worklets: 1 });
    env.audio.speakSentence({ speechMs: 1000 });
    expect(heard.log).toEqual(['listening', 'start', 'end:silence', 'audio']);
    // The pass is over: the worklet stopped reading, the microphone stays ready for the next turn.
    expect(heldBy(env)).toMatchObject({ tracks: 1, worklets: 0 });

    const outcome = await session.transcriber.run('message-1', heard.audio[0] as Blob, 'en-GB');
    expect(outcome.kind).toBe('transcript');
    expect(session.transcriber.holds('message-1')).toBe(false);

    const said = playbackLog();
    session.playback.play(request(), said.handlers);
    await settle();
    expect(said.log).toEqual(['start']);
    expect(heldBy(env)).toMatchObject({ urls: 1, playing: 1 });
    env.element.latest().finish();
    expect(said.log).toEqual(['start', 'end']);
    expect(heldBy(env)).toMatchObject({ urls: 0, playing: 0 });

    session.end();
    await settle();
    expect(pairs(env).microphoneTracks).toEqual([1, 1]);
    expect(pairs(env).objectUrls[0]).toBeGreaterThan(0);
    expect(pairs(env).objectUrls[0]).toBe(pairs(env).objectUrls[1]);
    expect(pairs(env).audioContexts[0]).toBeGreaterThan(1);
    expect(heldBy(env)).toEqual(NOTHING_HELD);
  });

  it('error: a failed transcription and a failed voice leave nothing behind', async () => {
    const session = await serverSession({
      transcribe: async () => {
        throw new ApiError(503, 'speech_unavailable', 'Off.', false);
      },
      speak: async () => {
        throw new ApiError(502, 'speech_failed', 'Failed.', true);
      },
    });
    // Priming made one silent clip for the browser's autoplay rules and revoked it again.
    const primed = pairs(env).objectUrls;
    const heard = captureLog();
    session.capture.listen(heard.handlers);
    env.audio.speakSentence({ speechMs: 1000 });
    const outcome = await session.transcriber.run('message-1', heard.audio[0] as Blob, 'en-GB');
    expect(outcome.kind).toBe('failed');
    // A failure that cannot be retried lets go of the recording at once.
    expect(session.transcriber.holds('message-1')).toBe(false);

    const said = playbackLog();
    session.playback.play(request(), said.handlers);
    await settle();
    expect(said.log).toEqual(['failure:generation']);
    expect(pairs(env).objectUrls).toEqual(primed);
    expect(heldBy(env)).toMatchObject({ playing: 0, urls: 0, worklets: 0 });

    session.end();
    expect(heldBy(env)).toEqual(NOTHING_HELD);
    expect(pairs(env).microphoneTracks).toEqual([1, 1]);
  });

  it('error: a recording kept for a retry is let go when the trainee types instead, and when the call ends', async () => {
    const session = await serverSession({
      transcribe: async () => {
        throw new ApiError(502, 'speech_failed', 'Failed.', true);
      },
    });
    const heard = captureLog();
    session.capture.listen(heard.handlers);
    env.audio.speakSentence({ speechMs: 1000 });
    const first = await session.transcriber.run('message-1', heard.audio[0] as Blob, 'en-GB');
    expect(first.kind).toBe('failed');
    expect(session.transcriber.holds('message-1')).toBe(true);
    session.transcriber.discard('message-1');
    expect(session.transcriber.holds('message-1')).toBe(false);

    const second = await session.transcriber.run('message-2', heard.audio[0] as Blob, 'en-GB');
    expect(second.kind).toBe('failed');
    expect(session.transcriber.holds('message-2')).toBe(true);
    session.end();
    expect(session.transcriber.holds('message-2')).toBe(false);
    expect(heldBy(env)).toEqual(NOTHING_HELD);
  });

  it('abort: cancelling a pass mid-sentence stops reading the microphone, and the next pass works', async () => {
    const session = await serverSession();
    const first = captureLog();
    const pass = session.capture.listen(first.handlers);
    env.audio.feed(sine(500, 16000, 0.3));
    expect(heldBy(env).worklets).toBe(1);
    pass.cancel();
    expect(heldBy(env).worklets).toBe(0);
    env.audio.speakSentence();
    expect(first.log).toEqual(['start']);

    const next = captureLog();
    session.capture.listen(next.handlers);
    env.audio.speakSentence({ speechMs: 1000 });
    expect(next.log).toContain('audio');

    session.end();
    expect(heldBy(env)).toEqual(NOTHING_HELD);
  });

  it('abort: "Stop customer audio" ends the customer at once and lets go of the audio', async () => {
    const session = await serverSession();
    const said = playbackLog();
    const job = session.playback.play(request(), said.handlers);
    await settle();
    expect(heldBy(env)).toMatchObject({ urls: 1, playing: 1 });
    expect(job.stop().interrupted).toBe(true);
    expect(heldBy(env)).toMatchObject({ urls: 0, playing: 0 });
    env.element.latest().finish();
    expect(said.log).toEqual(['start']);
    session.end();
    expect(heldBy(env)).toEqual(NOTHING_HELD);
  });

  describe('unmount: leaving the screen at any moment', () => {
    it('while listening', async () => {
      const session = await serverSession();
      const heard = captureLog();
      session.capture.listen(heard.handlers);
      await settle();
      env.audio.feed(sine(500, 16000, 0.3));
      session.end();
      env.audio.speakSentence();
      expect(heard.log).toEqual(['listening', 'start']);
      expect(heldBy(env)).toEqual(NOTHING_HELD);
      expect(pairs(env).microphoneTracks).toEqual([1, 1]);
    });

    it('while the recording is being turned into words', async () => {
      let signal: AbortSignal | undefined;
      const session = await serverSession({
        transcribe: (_audio, _language, given) => {
          signal = given;
          return hang(given);
        },
      });
      const heard = captureLog();
      session.capture.listen(heard.handlers);
      env.audio.speakSentence({ speechMs: 1000 });
      const pending = session.transcriber.run('message-1', heard.audio[0] as Blob, 'en-GB');
      await settle();
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      session.end();
      expect(await pending).toEqual({ kind: 'cancelled', id: 'message-1' });
      expect(signal?.aborted).toBe(true);
      expect(heldBy(env)).toEqual(NOTHING_HELD);
    });

    it("while the customer's voice is still being made, however late the answer comes", async () => {
      let signal: AbortSignal | undefined;
      let answer: (turn: SpokenTurn) => void = () => undefined;
      const session = await serverSession({
        speak: (_id, _turn, _language, given) => {
          signal = given;
          return new Promise<SpokenTurn>((resolve) => (answer = resolve));
        },
      });
      const primed = pairs(env).objectUrls;
      const said = playbackLog();
      session.playback.play(request(), said.handlers);
      await settle();
      session.end();
      expect(signal?.aborted).toBe(true);
      answer(spoken());
      await settle();
      expect(said.log).toEqual([]);
      // The late audio was never given a URL or an element to play in.
      expect(pairs(env).objectUrls).toEqual(primed);
      expect(heldBy(env)).toEqual(NOTHING_HELD);
    });

    it("while the customer's voice is playing", async () => {
      const session = await serverSession();
      const said = playbackLog();
      session.playback.play(request(), said.handlers);
      await settle();
      expect(heldBy(env)).toMatchObject({ playing: 1, urls: 1 });
      session.end();
      env.element.latest().finish();
      expect(said.log).toEqual(['start']);
      expect(heldBy(env)).toEqual(NOTHING_HELD);
    });
  });

  it('end call: many exchanges hold no more than one, and nothing at the end', async () => {
    const session = await serverSession();
    const baseline = { listeners: 0, edges: 0 };
    for (let round = 0; round < 25; round++) {
      const heard = captureLog();
      session.capture.listen(heard.handlers);
      env.audio.speakSentence({ speechMs: 800 });
      expect(heard.log).toContain('audio');
      session.playback.play(request(2 + round), playbackLog().handlers);
      await settle();
      env.element.latest().finish();
      if (round === 0) {
        const held = heldBy(env);
        baseline.listeners = held.listeners;
        baseline.edges = held.edges;
      }
      expect(heldBy(env)).toMatchObject({
        tracks: 1,
        worklets: 0,
        urls: 0,
        playing: 0,
        listeners: baseline.listeners,
        edges: baseline.edges,
      });
    }
    expect(env.element.maxConcurrent).toBeLessThanOrEqual(1);
    expect(env.contexts).toHaveLength(2);
    session.end();
    expect(heldBy(env)).toEqual(NOTHING_HELD);
  });
});

describe("the browser's own speech path", () => {
  const browserSession = () => {
    env = installFakes({ recognition: true, synthesis: true });
    const capture = createRecognitionCapture({ language: () => 'en-GB' });
    const playback = createBrowserPlayback();
    return {
      capture,
      playback,
      end() {
        capture.dispose();
        playback.dispose();
      },
    };
  };

  it('success: recognition and the browser voice are both over, and let go, after one exchange', async () => {
    const session = browserSession();
    session.capture.prepare();
    const heard = captureLog();
    session.capture.listen(heard.handlers);
    const recognition = env.recognition.latest();
    expect(heldBy(env).recognitions).toBe(1);
    recognition.open();
    recognition.say('my order has not arrived', true);
    expect(heard.log).toEqual([
      'listening',
      'start',
      'end:silence',
      'text:my order has not arrived',
    ]);
    expect(heldBy(env).recognitions).toBe(0);

    const said = playbackLog();
    session.playback.play(request(), said.handlers);
    await vi.advanceTimersByTimeAsync(0);
    env.speech.startLatest();
    expect(heldBy(env).speaking).toBe(true);
    env.speech.finishLatest();
    expect(said.log).toEqual(['start', 'end']);

    session.end();
    expect(heldBy(env)).toEqual(NOTHING_HELD);
    // Firefly never sees the audio on this path, so there is no microphone for it to hold.
    expect(pairs(env).microphoneTracks).toEqual([0, 0]);
  });

  it('error: a failed recognition pass is released', async () => {
    const session = browserSession();
    const heard = captureLog();
    session.capture.listen(heard.handlers);
    env.recognition.latest().fail('network');
    expect(heard.log).toEqual(['failure:service:network']);
    expect(env.recognition.latest().aborts).toBe(1);
    session.end();
    expect(heldBy(env)).toEqual(NOTHING_HELD);
  });

  it('abort and unmount: a pass cancelled, and the customer stopped mid-word, leave nothing running', async () => {
    const session = browserSession();
    const heard = captureLog();
    const pass = session.capture.listen(heard.handlers);
    env.recognition.latest().open();
    pass.cancel();
    expect(heldBy(env).recognitions).toBe(0);
    // Only what was reported before the cancel; nothing after it.
    expect(heard.log).toEqual(['listening']);

    session.playback.play(request(), playbackLog().handlers);
    await vi.advanceTimersByTimeAsync(0);
    env.speech.startLatest();
    session.end();
    expect(env.speech.cancels).toBeGreaterThan(0);
    expect(heldBy(env)).toEqual(NOTHING_HELD);
  });

  it('unmount while still waiting for the browser to list its voices: no timer outlives the screen', async () => {
    env = installFakes({ synthesis: [] });
    const playback = createBrowserPlayback();
    playback.play(request(), playbackLog().handlers);
    await vi.advanceTimersByTimeAsync(300);
    expect(heldBy(env).timers).toBeGreaterThan(0);
    playback.dispose();
    expect(heldBy(env)).toEqual(NOTHING_HELD);
  });
});

describe('the voice preview', () => {
  it('holds the audio only while it plays, replaces itself on a second press, and lets go when disposed', async () => {
    env = installFakes();
    const preview = createVoicePreview({
      engine: 'server-speech',
      fetchPreview: async (voice) => ({ ...spoken(), voiceId: voice }),
    });
    const first = playbackLog();
    preview.play('voice-a', 'en-GB', { onStart: () => first.log.push('start') });
    await settle();
    expect(heldBy(env)).toMatchObject({ playing: 1, urls: 1 });
    preview.play('voice-b', 'en-GB', { onStart: () => first.log.push('start') });
    await settle();
    expect(env.element.maxConcurrent).toBeLessThanOrEqual(1);
    expect(heldBy(env)).toMatchObject({ playing: 1, urls: 1 });
    preview.dispose();
    expect(pairs(env).objectUrls[0]).toBe(pairs(env).objectUrls[1]);
    expect(heldBy(env)).toEqual(NOTHING_HELD);
  });
});
