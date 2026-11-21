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

  it('can be asked again after a voice could not be made: the same stored turn, spoken once', async () => {
    let calls = 0;
    const { playback, speakTurn } = setup({}, async () => {
      if (++calls === 1) throw new Error('speech failed');
      return turn();
    });
    const first = listener();
    playback.play(request(3), first.handlers);
    await settle();
    expect(first.log).toEqual(['failure:generation']);

    const again = listener();
    playback.play(request(3), again.handlers);
    await settle();
    expect(again.log).toEqual(['details', 'start']);
    // Both times it asked for the stored turn by its place in the call: the browser sends no words, so
    // asking again cannot make a second turn.
    expect(speakTurn.mock.calls.map((call) => call.slice(0, 3))).toEqual([
      ['session-12345678', 3, 'en-GB'],
      ['session-12345678', 3, 'en-GB'],
    ]);
    env.element.latest().finish();
    expect(again.log).toEqual(['details', 'start', 'end']);
    expect(env.urls.live()).toHaveLength(0);
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

  describe('the chosen voice', () => {
    it('asks for the voice the trainee chose, and only then sends one', async () => {
      const { playback, speakTurn } = setup();
      playback.play({ ...request(3), voice: 'voice-c' }, listener().handlers);
      await settle();
      expect(speakTurn).toHaveBeenLastCalledWith(
        'session-12345678',
        3,
        'en-GB',
        expect.any(AbortSignal),
        { voice: 'voice-c' },
      );
      // No choice: the call is exactly what it was before voices could be chosen (four arguments).
      playback.play(request(5), listener().handlers);
      await settle();
      expect(speakTurn.mock.lastCall).toHaveLength(4);
    });

    it('does not play kept audio made for a different voice', async () => {
      const { playback, speakTurn } = setup();
      env.element.policy = 'block';
      playback.play({ ...request(4), voice: 'voice-a' }, listener().handlers);
      await settle();
      env.element.policy = 'allow';
      const again = listener();
      playback.play({ ...request(4), voice: 'voice-b' }, again.handlers);
      await settle();
      expect(speakTurn).toHaveBeenCalledTimes(2);
      expect(again.log).toEqual(['details', 'start']);
      // The same voice again does reuse what was kept.
      env.element.policy = 'block';
      playback.play({ ...request(6), voice: 'voice-b' }, listener().handlers);
      await settle();
      env.element.policy = 'allow';
      playback.play({ ...request(6), voice: 'voice-b' }, listener().handlers);
      await settle();
      expect(speakTurn).toHaveBeenCalledTimes(3);
    });
  });

  describe('stopping tells the call whether the customer was cut off', () => {
    it('says so, and how much was heard, when the voice was audible', async () => {
      const { playback } = setup();
      const { handlers } = listener();
      const job = playback.play(request(), handlers);
      await settle();
      await vi.advanceTimersByTimeAsync(1200);
      const stopped = job.stop();
      expect(stopped.interrupted).toBe(true);
      expect(stopped.playedMs).toBeGreaterThanOrEqual(1100);
      expect(stopped.playedMs).toBeLessThanOrEqual(1300);
      // The same answer again, and nothing more is reported.
      expect(job.stop()).toEqual(stopped);
    });

    it('prefers what the audio element says it has played', async () => {
      const { playback } = setup();
      const job = playback.play(request(), listener().handlers);
      await settle();
      env.element.latest().currentTime = 2.5;
      expect(job.stop()).toEqual({ interrupted: true, playedMs: 2500 });
    });

    it('says the customer was not cut off when the voice had not started, or had finished', async () => {
      const { playback } = setup();
      let release: (value: SpokenTurn) => void = () => undefined;
      const slow = createServerPlayback({
        speakTurn: () => new Promise<SpokenTurn>((resolve) => (release = resolve)),
      });
      const early = slow.play(request(), listener().handlers);
      expect(early.stop()).toEqual({ interrupted: false, playedMs: 0 });
      release(turn());
      await settle();
      slow.dispose();

      const finished = playback.play(request(), listener().handlers);
      await settle();
      await vi.advanceTimersByTimeAsync(800);
      env.element.latest().finish();
      const result = finished.stop();
      expect(result.interrupted).toBe(false);
      expect(result.playedMs).toBeGreaterThan(0);
    });

    it('stops the voice it replaces, and that stop says the customer was cut off', async () => {
      const { playback } = setup();
      const first = listener();
      playback.play(request(2), first.handlers);
      await settle();
      const second = playback.play(request(4), listener().handlers);
      await settle();
      expect(first.log).toEqual(['details', 'start']);
      expect(second.stop().interrupted).toBe(true);
    });
  });

  // Regression: "Test voice" primes the playback and asks for a reply in the same breath. The silent
  // clip that unlocks the element is 100 ms long and a real element ends it by itself (the fake does
  // too), which used to finish the reply that had only just been asked for, swallow its failure and
  // let its audio play while the page looked idle.
  describe('the unlock clip belongs to no reply', () => {
    const CLIP_MS = 100;
    const pending = () => new Promise<SpokenTurn>(() => undefined);

    it('does not let the clip end, time or fail a reply that is still being fetched, then plays it as itself', async () => {
      let answer: (spoken: SpokenTurn) => void = () => undefined;
      const { playback } = setup(
        {},
        () => new Promise<SpokenTurn>((resolve) => (answer = resolve)),
      );
      const { log, durations, handlers } = listener();
      playback.prime();
      playback.play(request(), handlers);
      // Well past the clip's end, with the reply still on its way.
      await vi.advanceTimersByTimeAsync(CLIP_MS * 3);
      expect(log).toEqual([]);
      expect(durations).toEqual([]);

      answer(turn());
      await settle();
      expect(log).toEqual(['details', 'start']);
      expect(durations).toEqual([]);
      // It ends when its own audio does, and not before.
      await vi.advanceTimersByTimeAsync(CLIP_MS * 3);
      expect(log).toEqual(['details', 'start']);
      env.element.latest().finish();
      expect(log).toEqual(['details', 'start', 'end']);
      expect(env.urls.live()).toHaveLength(0);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('still reports a reply that could not be made, when the failure arrives after the clip has ended', async () => {
      let refuse: (error: unknown) => void = () => undefined;
      const { playback } = setup(
        {},
        () => new Promise<SpokenTurn>((_resolve, reject) => (refuse = reject)),
      );
      const { log, handlers } = listener();
      playback.prime();
      playback.play(request(), handlers);
      await vi.advanceTimersByTimeAsync(441);
      expect(log).toEqual([]);
      refuse(new Error('speech failed'));
      await settle();
      expect(log).toEqual(['failure:generation']);
      expect(env.urls.live()).toHaveLength(0);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('lets go of the clip as soon as it has started, even while a reply is being fetched', async () => {
      const { playback } = setup({}, pending);
      playback.prime();
      playback.play(request(), listener().handlers);
      await settle();
      // The clip's own URL is revoked and the element is back at rest, so nothing is left to end.
      expect(env.urls.live()).toHaveLength(0);
      expect(env.element.latest().src).toBe('');
      expect(env.element.latest().paused).toBe(true);
      playback.dispose();
    });

    it('ignores whatever the element reports while a reply is only being fetched', async () => {
      const { playback } = setup({}, pending);
      const { log, durations, handlers } = listener();
      playback.prime();
      playback.play(request(), handlers);
      await settle();
      const element = env.element.latest();
      element.setDuration(CLIP_MS / 1000);
      element.breakDown();
      element.finish();
      expect(log).toEqual([]);
      expect(durations).toEqual([]);
      playback.dispose();
    });

    it('does not cut a reply that took the element over before the clip reported that it had started', async () => {
      const { playback } = setup();
      // The clip's play() is left pending, so the reply arrives while it still has not started.
      env.element.policy = 'hang';
      playback.prime();
      env.element.policy = 'allow';
      const { log, handlers } = listener();
      playback.play(request(), handlers);
      await settle();
      expect(log).toEqual(['details', 'start']);

      env.element.latest().begin();
      await settle();
      expect(log).toEqual(['details', 'start']);
      expect(env.element.latest().paused).toBe(false);
      expect(env.element.latest().src).toMatch(/^blob:fake\//);
      env.element.latest().finish();
      expect(log).toEqual(['details', 'start', 'end']);
    });

    it('is the same on a warm page: an element primed long ago, then a click that primes again and asks at once', async () => {
      let answer: (spoken: SpokenTurn) => void = () => undefined;
      const { playback } = setup(
        {},
        () => new Promise<SpokenTurn>((resolve) => (answer = resolve)),
      );
      playback.prime();
      await vi.advanceTimersByTimeAsync(1000);
      playback.prime();
      const { log, handlers } = listener();
      playback.play(request(), handlers);
      await vi.advanceTimersByTimeAsync(CLIP_MS * 2);
      expect(log).toEqual([]);
      answer(turn());
      await settle();
      expect(log).toEqual(['details', 'start']);
      env.element.latest().finish();
      expect(log).toEqual(['details', 'start', 'end']);
    });
  });
});
