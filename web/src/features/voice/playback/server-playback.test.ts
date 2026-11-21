import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpokenTurn } from '../../../lib/api.ts';
import { installFakes, type FakeEnv } from '../testing/fakes.ts';
import { createServerPlayback, GENERATION_TIMEOUT_MS, type SpeakTurn } from './server-playback.ts';
import type { Playback, PlaybackHandlers, PlayRequest, VoiceDetails } from './types.ts';

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

const request = (turnIndex = 2, text = 'Thanks for calling. How can I help?'): PlayRequest => ({
  sessionId: 'session-12345678',
  turnIndex,
  text,
  language: 'en-GB',
  mood: 'calm',
  voiceSeed: 'Alex Morgan',
});

const turn = (extra: Partial<SpokenTurn> = {}): SpokenTurn => ({
  audio: new Blob(['audio']),
  contentType: 'audio/mpeg',
  provider: 'azure-speech',
  voice: 'en-GB-SoniaNeural',
  style: 'none',
  ...extra,
});

function listener() {
  const log: string[] = [];
  const levels: number[] = [];
  const details: VoiceDetails[] = [];
  const durations: number[] = [];
  const starts: number[] = [];
  const handlers: PlaybackHandlers = {
    onStart: ({ estimateMs }) => {
      log.push('start');
      starts.push(estimateMs);
    },
    onDuration: (ms) => {
      log.push('duration');
      durations.push(ms);
    },
    onEnd: () => log.push('end'),
    onBlocked: () => log.push('blocked'),
    onFailure: (kind) => log.push(`failure:${kind}`),
    onLevel: (level) => levels.push(level),
    onDetails: (value) => {
      log.push('details');
      details.push(value);
    },
  };
  return { log, levels, details, durations, starts, handlers };
}

function setup(options: Parameters<typeof installFakes>[0] = {}, speak?: SpeakTurn) {
  env = installFakes(options);
  const speakTurn = vi.fn<SpeakTurn>(speak ?? (async () => turn()));
  const playback: Playback = createServerPlayback({ speakTurn });
  return { playback, speakTurn };
}

describe('server playback', () => {
  it('unlocks one audio element inside the gesture with a silent clip, then lets go of it', async () => {
    const { playback } = setup();
    playback.prime();
    expect(env.elements).toHaveLength(1);
    expect(env.element.latest().plays).toHaveLength(1);
    expect(env.urls.live()).toHaveLength(1);
    await settle();
    expect(env.urls.live()).toHaveLength(0);
    expect(env.element.latest().src).toBe('');
    // A second prime reuses the same element.
    playback.prime();
    expect(env.elements).toHaveLength(1);
  });

  it('fetches the stored turn in the chosen language, plays it, and reports what the provider really used', async () => {
    const { playback, speakTurn } = setup();
    const { log, details, starts, handlers } = listener();
    playback.prime();
    await settle();
    playback.play(request(3), handlers);
    await settle();
    expect(speakTurn).toHaveBeenCalledWith('session-12345678', 3, 'en-GB', expect.any(AbortSignal));
    expect(log).toEqual(['details', 'start']);
    expect(details[0]).toEqual({
      voice: 'en-GB-SoniaNeural',
      style: 'none',
      local: null,
      lang: null,
    });
    // The length is not known yet, so the estimate comes from the words.
    expect(starts[0]).toBeGreaterThan(1000);
    expect(env.element.latest().src).toMatch(/^blob:fake\//);
  });

  it('uses the real length once the browser knows it', async () => {
    const { playback } = setup();
    const { log, durations, starts, handlers } = listener();
    playback.play(request(), handlers);
    env.element.latest().duration = 4.2;
    await settle();
    expect(starts).toEqual([4200]);
    env.element.latest().setDuration(4.5);
    expect(durations).toEqual([4500]);
    expect(log).toContain('duration');
  });

  it('reports the end, revokes the blob URL and releases the element', async () => {
    const { playback } = setup();
    const { log, handlers } = listener();
    playback.play(request(), handlers);
    await settle();
    expect(env.urls.live()).toHaveLength(1);
    env.element.latest().finish();
    expect(log).toEqual(['details', 'start', 'end']);
    expect(env.urls.live()).toHaveLength(0);
    expect(env.element.latest().src).toBe('');
    // A second "ended" changes nothing.
    env.element.latest().finish();
    expect(log.filter((entry) => entry === 'end')).toHaveLength(1);
  });

  it('measures the level through an analyser while the voice plays, and stops measuring at the end', async () => {
    const { playback } = setup();
    const { levels, handlers } = listener();
    playback.prime();
    await settle();
    playback.play(request(), handlers);
    await settle();
    env.audio.analyserRms = 0.1;
    await vi.advanceTimersByTimeAsync(330);
    expect(levels.length).toBeGreaterThanOrEqual(4);
    expect(levels.length).toBeLessThanOrEqual(6);
    expect(Math.max(...levels)).toBeGreaterThan(0.5);
    env.element.latest().finish();
    const count = levels.length;
    await vi.advanceTimersByTimeAsync(500);
    expect(levels).toHaveLength(count);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('shapes the level from the words when the audio context cannot be used', async () => {
    const { playback } = setup({ audioContext: false });
    const { levels, handlers } = listener();
    playback.play(request(2, 'Hello there. I am calling about my order.'), handlers);
    await settle();
    for (let i = 0; i < 12; i++) {
      env.element.latest().currentTime = i * 0.1;
      await vi.advanceTimersByTimeAsync(70);
    }
    expect(levels.length).toBeGreaterThan(5);
    expect(new Set(levels).size).toBeGreaterThan(2);
  });

  it('is blocked, not broken, when the browser refuses to play: the audio is kept for the Play button', async () => {
    const { playback, speakTurn } = setup();
    const first = listener();
    env.element.policy = 'block';
    playback.play(request(4), first.handlers);
    await settle();
    expect(first.log).toEqual(['details', 'blocked']);
    expect(speakTurn).toHaveBeenCalledTimes(1);
    expect(env.urls.live()).toHaveLength(1);

    // The trainee presses Play: the same audio plays, without asking the server again.
    env.element.policy = 'allow';
    const second = listener();
    playback.play(request(4), second.handlers);
    await settle();
    expect(speakTurn).toHaveBeenCalledTimes(1);
    expect(second.log).toEqual(['details', 'start']);
    env.element.latest().finish();
    expect(env.urls.live()).toHaveLength(0);
  });

  it('drops the kept audio when something else is played instead', async () => {
    const { playback, speakTurn } = setup();
    env.element.policy = 'block';
    playback.play(request(4), listener().handlers);
    await settle();
    expect(env.urls.live()).toHaveLength(1);
    env.element.policy = 'allow';
    playback.play(request(6), listener().handlers);
    await settle();
    expect(speakTurn).toHaveBeenCalledTimes(2);
    // The blocked turn's URL was revoked; only the new one is live.
    expect(env.urls.live()).toHaveLength(1);
  });

  it('reports a voice that could not be made, with no blob left behind', async () => {
    const { playback } = setup({}, async () => {
      throw new Error('speech failed');
    });
    const { log, handlers } = listener();
    playback.play(request(), handlers);
    await settle();
    expect(log).toEqual(['failure:generation']);
    expect(env.urls.created).toBe(0);
  });

  it('gives up on a voice that takes too long, and aborts the request', async () => {
    let seen: AbortSignal | undefined;
    const { playback } = setup({}, (_s, _t, _l, signal) => {
      seen = signal;
      return new Promise<SpokenTurn>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('stopped', 'AbortError')));
      });
    });
    const { log, handlers } = listener();
    playback.play(request(), handlers);
    await vi.advanceTimersByTimeAsync(GENERATION_TIMEOUT_MS - 1);
    expect(log).toEqual([]);
    await vi.advanceTimersByTimeAsync(2);
    expect(seen?.aborted).toBe(true);
    expect(log).toEqual(['failure:generation']);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports a broken audio file and an element that fails to play as playback failures', async () => {
    const { playback } = setup();
    const broken = listener();
    playback.play(request(), broken.handlers);
    await settle();
    env.element.latest().breakDown();
    expect(broken.log).toEqual(['details', 'start', 'failure:playback']);
    expect(env.urls.live()).toHaveLength(0);

    env.element.policy = 'fail';
    const refused = listener();
    playback.play(request(), refused.handlers);
    await settle();
    expect(refused.log).toEqual(['details', 'failure:playback']);
    expect(env.urls.live()).toHaveLength(0);
  });

  it('stops at once: silent afterwards, blob revoked, request aborted', async () => {
    let seen: AbortSignal | undefined;
    const { playback } = setup({}, async (_s, _t, _l, signal) => {
      seen = signal;
      return turn();
    });
    const { log, handlers } = listener();
    const job = playback.play(request(), handlers);
    await settle();
    expect(log).toEqual(['details', 'start']);
    job.stop();
    expect(seen?.aborted).toBe(true);
    expect(env.urls.live()).toHaveLength(0);
    expect(env.element.latest().paused).toBe(true);
    env.element.latest().finish();
    env.element.latest().breakDown();
    expect(log).toEqual(['details', 'start']);
    expect(() => job.stop()).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops a reply that is still being fetched without ever playing it', async () => {
    let release: (value: SpokenTurn) => void = () => undefined;
    const { playback } = setup({}, () => new Promise<SpokenTurn>((resolve) => (release = resolve)));
    const { log, handlers } = listener();
    const job = playback.play(request(), handlers);
    job.stop();
    release(turn());
    await settle();
    expect(log).toEqual([]);
    expect(env.urls.created).toBe(0);
    expect(env.element.latest().plays).toHaveLength(0);
  });

  it('only ever plays one reply: starting another silences the first', async () => {
    const { playback } = setup();
    const first = listener();
    const second = listener();
    playback.play(request(2), first.handlers);
    await settle();
    playback.play(request(4), second.handlers);
    await settle();
    expect(first.log).toEqual(['details', 'start']);
    expect(second.log).toEqual(['details', 'start']);
    expect(env.element.maxConcurrent).toBeLessThanOrEqual(1);
    expect(env.urls.live()).toHaveLength(1);
    env.element.latest().finish();
    expect(first.log).toEqual(['details', 'start']);
    expect(second.log.at(-1)).toBe('end');
  });

  it('keeps a constant number of listeners however many replies it plays, and removes them when disposed', async () => {
    const { playback } = setup();
    playback.prime();
    await settle();
    playback.play(request(2), listener().handlers);
    await settle();
    const baseline = env.listenerCount();
    expect(baseline).toBeGreaterThan(0);
    for (let i = 0; i < 40; i++) {
      env.element.latest().finish();
      playback.play(request(2 + i), listener().handlers);
      await settle();
    }
    expect(env.listenerCount()).toBe(baseline);
    expect(env.urls.live()).toHaveLength(1);
    expect(env.element.maxConcurrent).toBeLessThanOrEqual(1);

    playback.dispose();
    expect(env.listenerCount()).toBe(0);
    expect(env.urls.live()).toHaveLength(0);
    expect(env.audio.openContexts()).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('fails cleanly when the browser has no audio element', async () => {
    const { playback } = setup({ audioElement: false });
    const { log, handlers } = listener();
    playback.play(request(), handlers);
    await settle();
    expect(log).toEqual(['failure:playback']);
  });
});
