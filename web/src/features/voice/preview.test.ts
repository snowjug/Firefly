import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VOICE_PREVIEW_TEXT, type VoiceId } from '#shared/domain/voices.ts';
import { ApiError } from '../../lib/api.ts';
import { deliveryFor, pickVoiceForChoice } from './playback/voices.ts';
import { createVoicePreview, PREVIEW_TIMEOUT_MS } from './preview.ts';
import type { SpokenAudio } from './speech-client.ts';
import { fakeVoice, installFakes, type FakeEnv } from './testing/fakes.ts';
import { heldBy, NOTHING_HELD } from './testing/held.ts';
import type { VoiceError } from './errors.ts';

// "Test voice": one fixed, neutral sentence in the voice the trainee is thinking of choosing. Server
// audio comes from a stand-in for the endpoint and plays through the fake <audio> element; browser
// speech goes through the fake speech synthesis. Nothing reaches a server or a speaker.

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

const audio = (voiceId: string | null = 'voice-a'): SpokenAudio => ({
  audio: new Blob(['audio']),
  contentType: 'audio/mpeg',
  provider: 'azure-speech',
  voice: 'en-GB-SoniaNeural',
  style: 'none',
  voiceId,
});

const apiFailure = (status: number, code: string, details?: unknown) =>
  new ApiError(status, code, 'The provider said something specific.', status >= 500, details);

function recorder() {
  const log: string[] = [];
  const errors: VoiceError[] = [];
  return {
    log,
    errors,
    handlers: {
      onStart: () => log.push('start'),
      onEnd: () => log.push('end'),
      onFailure: (error: VoiceError) => {
        log.push('failure');
        errors.push(error);
      },
    },
  };
}

type Fetch = NonNullable<Parameters<typeof createVoicePreview>[0]['fetchPreview']>;

/** A request that only ends when it is aborted, like a real one. */
const hang: Fetch = (_voice, _language, signal) =>
  new Promise<SpokenAudio>((_resolve, reject) => {
    signal?.addEventListener('abort', () => reject(new DOMException('stopped', 'AbortError')));
  });

describe('the preview through the server', () => {
  it('makes one request for the chosen voice and plays it', async () => {
    env = installFakes();
    const fetchPreview = vi.fn<Fetch>(async (voice) => audio(voice));
    const preview = createVoicePreview({ engine: 'server-speech', fetchPreview });
    const { log, handlers } = recorder();
    preview.play('voice-b', 'en-GB', handlers);
    await settle();
    expect(fetchPreview).toHaveBeenCalledTimes(1);
    expect(fetchPreview).toHaveBeenCalledWith('voice-b', 'en-GB', expect.any(AbortSignal));
    expect(log).toEqual(['start']);
    expect(env.element.latest().src).toMatch(/^blob:/);
    env.element.latest().finish();
    expect(log).toEqual(['start', 'end']);
    expect(heldBy(env).urls).toBe(0);
  });

  it('is primed inside the click, before the audio has even arrived, and never blocks', async () => {
    env = installFakes();
    const preview = createVoicePreview({ engine: 'server-speech', fetchPreview: hang });
    const job = preview.play('voice-a', 'en-GB', recorder().handlers);
    // Synchronously: a job in hand, and the audio element already unlocked by a silent clip.
    expect(typeof job.stop).toBe('function');
    expect(env.elements).toHaveLength(1);
    expect(env.element.latest().plays).toHaveLength(1);
    job.stop();
    preview.dispose();
  });

  it('stops the earlier preview when another starts, and only one request goes on', async () => {
    env = installFakes();
    const signals: AbortSignal[] = [];
    const fetchPreview = vi.fn<Fetch>((voice, language, signal) => {
      if (signal) signals.push(signal);
      return hang(voice, language, signal);
    });
    const preview = createVoicePreview({ engine: 'server-speech', fetchPreview });
    const first = recorder();
    const second = recorder();
    preview.play('voice-a', 'en-GB', first.handlers);
    await settle();
    preview.play('voice-b', 'en-GB', second.handlers);
    await settle();
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
    expect(first.log).toEqual([]);
    preview.dispose();
    expect(signals[1]?.aborted).toBe(true);
  });

  it('stops playing audio when the next preview starts', async () => {
    env = installFakes();
    const preview = createVoicePreview({
      engine: 'server-speech',
      fetchPreview: async (voice) => audio(voice),
    });
    preview.play('voice-a', 'en-GB', recorder().handlers);
    await settle();
    const next = recorder();
    preview.play('voice-c', 'en-GB', next.handlers);
    await settle();
    expect(env.element.maxConcurrent).toBeLessThanOrEqual(1);
    expect(heldBy(env)).toMatchObject({ playing: 1, urls: 1 });
    expect(next.log).toEqual(['start']);
    preview.dispose();
  });

  it('uses the real endpoint when no stand-in is given: one POST for the voice and language', async () => {
    env = installFakes();
    const fetchMock = vi.fn(
      async () =>
        new Response(new Blob(['audio']), {
          status: 200,
          headers: { 'content-type': 'audio/mpeg' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const preview = createVoicePreview({ engine: 'server-speech' });
    preview.play('voice-d', 'en-IN', recorder().handlers);
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/speech/preview?lang=en-IN&voice=voice-d');
    // No words go to the server: the sentence is fixed there.
    expect(init).toMatchObject({ method: 'POST', body: '{}' });
    preview.dispose();
  });

  describe('when it cannot play', () => {
    const cases: Array<[string, unknown, string]> = [
      ['the network is down', new ApiError(0, 'network', 'Cannot reach.', true), 'offline'],
      [
        'too many requests',
        apiFailure(429, 'rate_limited', { retryAfterSeconds: 2 }),
        'rate-limited',
      ],
      ['speech is off', apiFailure(503, 'speech_unavailable'), 'speech-unavailable'],
      ['the service fails', apiFailure(502, 'speech_failed'), 'preview-unavailable'],
      ['something unexpected throws', new Error('boom'), 'preview-unavailable'],
    ];

    it.each(cases)('says so once, in plain words, when %s', async (_name, failure, code) => {
      env = installFakes();
      const preview = createVoicePreview({
        engine: 'server-speech',
        fetchPreview: async () => {
          throw failure;
        },
      });
      const { log, errors, handlers } = recorder();
      preview.play('voice-a', 'en-GB', handlers);
      await settle();
      expect(log).toEqual(['failure']);
      expect(errors[0]).toMatchObject({ code, textFallback: true });
      expect(errors[0]?.recovery.length).toBeGreaterThan(0);
      expect(errors[0]?.recovery).toContain(
        code === 'speech-unavailable' ? 'continue-without-audio' : 'retry',
      );
      expect(heldBy(env).urls).toBe(0);
      preview.dispose();
    });

    it('carries the wait the server asked for', async () => {
      env = installFakes();
      const preview = createVoicePreview({
        engine: 'server-speech',
        fetchPreview: async () => {
          throw apiFailure(429, 'rate_limited', { retryAfterSeconds: 2 });
        },
      });
      const { errors, handlers } = recorder();
      preview.play('voice-a', 'en-GB', handlers);
      await settle();
      expect(errors[0]?.retryAfterSeconds).toBe(2);
    });

    it('gives up after the time limit, aborts the request, and says it could not play', async () => {
      env = installFakes();
      let signal: AbortSignal | undefined;
      const preview = createVoicePreview({
        engine: 'server-speech',
        fetchPreview: (voice, language, given) => {
          signal = given;
          return hang(voice, language, given);
        },
      });
      const { log, errors, handlers } = recorder();
      preview.play('voice-a', 'en-GB', handlers);
      await vi.advanceTimersByTimeAsync(PREVIEW_TIMEOUT_MS - 1);
      expect(log).toEqual([]);
      await vi.advanceTimersByTimeAsync(2);
      expect(signal?.aborted).toBe(true);
      expect(log).toEqual(['failure']);
      expect(errors[0]?.code).toBe('preview-unavailable');
      expect(vi.getTimerCount()).toBe(0);
    });

    it('says the browser wants a tap when it refuses to play sound', async () => {
      env = installFakes();
      env.element.policy = 'block';
      const preview = createVoicePreview({
        engine: 'server-speech',
        fetchPreview: async () => audio(),
      });
      const { errors, handlers } = recorder();
      preview.play('voice-a', 'en-GB', handlers);
      await settle();
      expect(errors[0]).toMatchObject({ code: 'playback-blocked', retryAction: 'replay-voice' });
      preview.dispose();
    });

    it('says it could not play when the audio itself is broken', async () => {
      env = installFakes();
      const preview = createVoicePreview({
        engine: 'server-speech',
        fetchPreview: async () => audio(),
      });
      const { log, errors, handlers } = recorder();
      preview.play('voice-a', 'en-GB', handlers);
      await settle();
      env.element.latest().breakDown();
      expect(log).toEqual(['start', 'failure']);
      expect(errors[0]?.code).toBe('preview-unavailable');
      expect(heldBy(env).urls).toBe(0);
      preview.dispose();
    });
  });
});

describe("the preview through the browser's own voices", () => {
  const FOUR = [
    fakeVoice('Voice One (United Kingdom)', 'en-GB', true),
    fakeVoice('Voice Two (United Kingdom)', 'en-GB', true),
    fakeVoice('Voice Three (United Kingdom)', 'en-GB', true),
    fakeVoice('Voice Four (United Kingdom)', 'en-GB', true),
  ];

  it('speaks the fixed sentence in the voice that stands for the choice, with no request at all', async () => {
    env = installFakes({ synthesis: FOUR });
    const fetchPreview = vi.fn<Fetch>(async () => audio());
    const preview = createVoicePreview({ engine: 'browser-synthesis', fetchPreview });
    const { log, handlers } = recorder();
    preview.play('voice-c', 'en-GB', handlers);
    await vi.advanceTimersByTimeAsync(0);
    const utterance = env.speech.latest();
    expect(utterance.text).toBe(VOICE_PREVIEW_TEXT);
    expect(utterance.voice).toBe(pickVoiceForChoice(FOUR, 'voice-c', 'en-GB'));
    const delivery = deliveryFor('calm', 'voice-c', 'voice-c');
    expect(utterance.rate).toBe(delivery.rate);
    env.speech.startLatest();
    env.speech.finishLatest();
    expect(log).toEqual(['start', 'end']);
    expect(fetchPreview).not.toHaveBeenCalled();
    preview.dispose();
    expect(heldBy(env)).toEqual(NOTHING_HELD);
  });

  it('is unlocked inside the click, and a second press replaces the first', async () => {
    env = installFakes({ synthesis: FOUR });
    const preview = createVoicePreview({ engine: 'browser-synthesis' });
    preview.play('voice-a', 'en-GB', recorder().handlers);
    expect(env.speech.primes).toBe(1);
    await vi.advanceTimersByTimeAsync(0);
    env.speech.startLatest();
    const second = recorder();
    preview.play('voice-b', 'en-GB', second.handlers);
    await vi.advanceTimersByTimeAsync(100);
    expect(env.speech.cancels).toBeGreaterThan(0);
    expect(env.speech.latest().text).toBe(VOICE_PREVIEW_TEXT);
    preview.dispose();
    expect(heldBy(env)).toEqual(NOTHING_HELD);
  });
});

describe('the preview where nothing can speak', () => {
  it('says so after the click returns, never throws, and has nothing to stop or release', async () => {
    env = installFakes();
    const preview = createVoicePreview({ engine: 'none' });
    const { log, errors, handlers } = recorder();
    const job = preview.play('voice-a', 'en-GB', handlers);
    expect(log).toEqual([]);
    await settle();
    expect(log).toEqual(['failure']);
    expect(errors[0]).toMatchObject({ code: 'preview-unavailable', textFallback: true });
    expect(job.stop()).toEqual({ interrupted: false, playedMs: 0 });
    expect(() => preview.dispose()).not.toThrow();
    expect(heldBy(env)).toEqual(NOTHING_HELD);
  });
});

describe('disposing', () => {
  it('stops a preview in the middle and leaves nothing behind, even when called twice', async () => {
    env = installFakes();
    const preview = createVoicePreview({
      engine: 'server-speech',
      fetchPreview: async () => audio(),
    });
    const { log, handlers } = recorder();
    preview.play('voice-a', 'en-GB', handlers);
    await settle();
    expect(heldBy(env)).toMatchObject({ playing: 1, urls: 1 });
    preview.dispose();
    preview.dispose();
    env.element.latest().finish();
    expect(log).toEqual(['start']);
    expect(heldBy(env)).toEqual(NOTHING_HELD);
  });
});

// Regression, seen in a real Edge browser. The preview primes the playback and asks for the audio in
// the same click. The silent clip that unlocks the audio element is 100 ms long and ends by itself
// (so does the fake's), and the server takes longer than that to answer. The clip's end used to
// finish the preview: the button went back to idle while the request was still out, a failure that
// arrived afterwards was swallowed (no message), and a good answer played with nothing on the screen.
describe('the unlock clip and the preview', () => {
  const ANSWER_MS = 441;

  /** The endpoint's answer, a while after the click: a good one, or a failure thrown by `outcome`. */
  const answersAfter =
    (ms: number, outcome: (voice: VoiceId) => SpokenAudio): Fetch =>
    (voice, _language, signal) =>
      new Promise<SpokenAudio>((resolve, reject) => {
        const timer = setTimeout(() => {
          try {
            resolve(outcome(voice));
          } catch (error) {
            reject(error);
          }
        }, ms);
        signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('stopped', 'AbortError'));
        });
      });

  const failures: Array<[string, unknown, string]> = [
    [
      'the service says it is not available',
      apiFailure(503, 'speech_unavailable'),
      'speech-unavailable',
    ],
    ['the service fails', apiFailure(502, 'speech_failed'), 'preview-unavailable'],
    [
      'the browser is sending too many requests',
      apiFailure(429, 'rate_limited', { retryAfterSeconds: 2 }),
      'rate-limited',
    ],
    ['the network is down', new ApiError(0, 'network', 'Cannot reach.', true), 'offline'],
  ];

  it.each(failures)(
    'shows a failure that arrives after the clip has ended, with what to do next, when %s',
    async (_name, failure, code) => {
      env = installFakes();
      const preview = createVoicePreview({
        engine: 'server-speech',
        fetchPreview: answersAfter(ANSWER_MS, () => {
          throw failure;
        }),
      });
      const { log, errors, handlers } = recorder();
      preview.play('voice-a', 'en-GB', handlers);
      // The clip is long over, the answer is not: nothing is reported yet (the screen still says "playing").
      await vi.advanceTimersByTimeAsync(ANSWER_MS - 1);
      expect(log).toEqual([]);
      await vi.advanceTimersByTimeAsync(2);
      expect(log).toEqual(['failure']);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({ code, stage: 'voice', textFallback: true });
      expect(errors[0]?.message).toMatch(/^[A-Z].*[.]$/);
      expect(errors[0]?.recovery.length).toBeGreaterThan(0);
      preview.dispose();
      expect(heldBy(env)).toEqual(NOTHING_HELD);
    },
  );

  it('plays a good answer that arrives after the clip has ended, reports that it started, and ends with its own audio', async () => {
    env = installFakes();
    const preview = createVoicePreview({
      engine: 'server-speech',
      fetchPreview: answersAfter(ANSWER_MS, (voice) => audio(voice)),
    });
    const { log, handlers } = recorder();
    preview.play('voice-b', 'en-GB', handlers);
    await vi.advanceTimersByTimeAsync(ANSWER_MS - 1);
    expect(log).toEqual([]);
    await vi.advanceTimersByTimeAsync(2);
    expect(log).toEqual(['start']);
    expect(heldBy(env)).toMatchObject({ playing: 1, urls: 1 });
    // Nothing but its own audio ends it.
    await vi.advanceTimersByTimeAsync(5000);
    expect(log).toEqual(['start']);
    env.element.latest().finish();
    expect(log).toEqual(['start', 'end']);
    expect(heldBy(env).urls).toBe(0);
    preview.dispose();
    expect(heldBy(env)).toEqual(NOTHING_HELD);
  });

  it('keeps going when pressed again while the clip is still playing: the first is dropped, the second answers', async () => {
    env = installFakes();
    const preview = createVoicePreview({
      engine: 'server-speech',
      fetchPreview: answersAfter(ANSWER_MS, (voice) => audio(voice)),
    });
    const first = recorder();
    const second = recorder();
    preview.play('voice-a', 'en-GB', first.handlers);
    await vi.advanceTimersByTimeAsync(50);
    preview.play('voice-b', 'en-GB', second.handlers);
    await vi.advanceTimersByTimeAsync(ANSWER_MS - 1);
    expect(second.log).toEqual([]);
    await vi.advanceTimersByTimeAsync(2);
    expect(second.log).toEqual(['start']);
    expect(first.log).toEqual([]);
    env.element.latest().finish();
    expect(second.log).toEqual(['start', 'end']);
    preview.dispose();
    expect(heldBy(env)).toEqual(NOTHING_HELD);
  });

  it('can be tried again after a failure: the second try is not cut short either', async () => {
    env = installFakes();
    let tries = 0;
    const preview = createVoicePreview({
      engine: 'server-speech',
      fetchPreview: answersAfter(ANSWER_MS, (voice) => {
        if (++tries === 1) throw apiFailure(502, 'speech_failed');
        return audio(voice);
      }),
    });
    const first = recorder();
    preview.play('voice-a', 'en-GB', first.handlers);
    await vi.advanceTimersByTimeAsync(ANSWER_MS + 1);
    expect(first.log).toEqual(['failure']);

    const again = recorder();
    preview.play('voice-a', 'en-GB', again.handlers);
    await vi.advanceTimersByTimeAsync(ANSWER_MS - 1);
    expect(again.log).toEqual([]);
    await vi.advanceTimersByTimeAsync(2);
    expect(again.log).toEqual(['start']);
    preview.dispose();
    expect(heldBy(env)).toEqual(NOTHING_HELD);
  });
});
