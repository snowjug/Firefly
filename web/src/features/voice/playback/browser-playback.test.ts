import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VOICE_IDS } from '#shared/domain/voices.ts';
import { installFakes, fakeVoice, type FakeEnv } from '../testing/fakes.ts';
import { createBrowserPlayback } from './browser-playback.ts';
import { cleanForSpeech, splitForSpeech } from './speech-text.ts';
import type { PlaybackHandlers, PlayRequest, VoiceDetails } from './types.ts';
import { deliveryFor, pickVoice, pickVoiceForChoice } from './voices.ts';

let env: FakeEnv;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  env.uninstall();
  vi.useRealTimers();
});

const LONG_REPLY =
  'I have been waiting for my replacement card for almost three weeks and nobody has told me why. Every time I call, someone says it is on its way, and then nothing arrives at all. Please just tell me exactly when I can expect it.';

const request = (text = 'Hello there.', mood: PlayRequest['mood'] = 'calm'): PlayRequest => ({
  sessionId: 'session-12345678',
  turnIndex: 2,
  text,
  language: 'en-GB',
  mood,
  voiceSeed: 'Alex Morgan',
});

function listener() {
  const log: string[] = [];
  const levels: number[] = [];
  const details: VoiceDetails[] = [];
  const starts: number[] = [];
  const handlers: PlaybackHandlers = {
    onStart: ({ estimateMs }) => {
      log.push('start');
      starts.push(estimateMs);
    },
    onDuration: () => log.push('duration'),
    onEnd: () => log.push('end'),
    onBlocked: () => log.push('blocked'),
    onFailure: (kind) => log.push(`failure:${kind}`),
    onLevel: (level) => levels.push(level),
    onDetails: (value) => {
      log.push('details');
      details.push(value);
    },
  };
  return { log, levels, details, starts, handlers };
}

function setup(voices?: SpeechSynthesisVoice[]) {
  env = installFakes({ synthesis: voices ?? true });
  return createBrowserPlayback();
}

describe('browser playback', () => {
  it('speaks a long reply a sentence or two at a time, reporting start once and end once', async () => {
    const playback = setup();
    const { log, starts, handlers } = listener();
    playback.play(request(LONG_REPLY), handlers);
    await vi.advanceTimersByTimeAsync(0);
    const chunks = splitForSpeech(cleanForSpeech(LONG_REPLY));
    expect(chunks.length).toBeGreaterThan(1);

    chunks.forEach((chunk, index) => {
      expect(env.speech.spoken).toHaveLength(index + 1);
      expect(env.speech.latest().text).toBe(chunk.text);
      env.speech.finishLatest();
    });
    expect(log).toEqual(['details', 'start', 'end']);
    expect(starts[0]).toBeGreaterThan(5000);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('chooses a natural online voice in the right language, and says what it is', async () => {
    const playback = setup();
    const { details, handlers } = listener();
    playback.play(request(), handlers);
    await vi.advanceTimersByTimeAsync(0);
    expect(details[0]).toEqual({
      voice: 'Online Natural English (United Kingdom)',
      style: 'none',
      local: false,
      lang: 'en-GB',
    });
    const utterance = env.speech.latest();
    expect(utterance.lang).toBe('en-GB');
    expect((utterance.voice as SpeechSynthesisVoice).name).toBe(details[0]?.voice);
  });

  it('delivers a tenser mood a little faster and higher: its only way to sound different', async () => {
    const playback = setup();
    playback.play(request('Hello there.', 'angry'), listener().handlers);
    await vi.advanceTimersByTimeAsync(0);
    const utterance = env.speech.latest();
    expect(utterance.rate).toBe(1.1);
    expect(utterance.pitch).toBe(deliveryFor('angry', 'Alex Morgan').pitch);
  });

  it('waits for voices that load late, then uses the one chosen for this customer', async () => {
    const playback = setup([]);
    playback.play(request(), listener().handlers);
    await vi.advanceTimersByTimeAsync(300);
    expect(env.speech.spoken).toHaveLength(0);
    const voices = [fakeVoice('Late English', 'en-GB', true)];
    env.speech.voices = voices;
    env.speech.emit('voiceschanged');
    await vi.advanceTimersByTimeAsync(0);
    expect(env.speech.latest().voice).toBe(pickVoice(voices, 'Alex Morgan', 'en-GB'));
  });

  it("speaks with the browser's default voice if it never lists one, and does not claim a voice name", async () => {
    const playback = setup([]);
    const { details, handlers } = listener();
    playback.play(request(), handlers);
    await vi.advanceTimersByTimeAsync(1600);
    expect(env.speech.latest().voice).toBeNull();
    expect(env.speech.latest().lang).toBe('en-GB');
    expect(details[0]).toEqual({ voice: null, style: 'none', local: null, lang: null });
  });

  // What Edge 158 and Chrome 157 list on a Windows laptop: five local voices and none for en-GB,
  // and an empty list until `voiceschanged` (about 40 ms after the first call).
  describe('on a browser with no voice for the language chosen', () => {
    const WINDOWS_VOICES = [
      fakeVoice('Microsoft David - English (United States)', 'en-US', true),
      fakeVoice('Microsoft Ravi - English (India)', 'en-IN', true),
      fakeVoice('Microsoft Heera - English (India)', 'en-IN', true),
      fakeVoice('Microsoft Mark - English (United States)', 'en-US', true),
      fakeVoice('Microsoft Zira - English (United States)', 'en-US', true),
    ];

    it('waits for the list, then speaks with another English voice and says which one', async () => {
      const playback = setup([]);
      const { details, handlers } = listener();
      playback.play(request(), handlers);
      await vi.advanceTimersByTimeAsync(43);
      expect(env.speech.spoken).toHaveLength(0);

      env.speech.voices = WINDOWS_VOICES;
      env.speech.emit('voiceschanged');
      await vi.advanceTimersByTimeAsync(0);
      const utterance = env.speech.latest();
      const voice = utterance.voice as SpeechSynthesisVoice;
      expect(WINDOWS_VOICES).toContain(voice);
      expect(voice.lang).not.toBe('en-GB');
      // It speaks in the voice's own language, not one it does not have.
      expect(utterance.lang).toBe(voice.lang);
      expect(details[0]).toEqual({
        voice: voice.name,
        style: 'none',
        local: true,
        lang: voice.lang,
      });
    });

    it('gives one customer the same voice for the whole call, and different customers different ones', async () => {
      const playback = setup(WINDOWS_VOICES);
      const chosen = new Map<string, string>();
      for (const seed of ['Alex Morgan', 'Sam Patel', 'Dana Wu', 'Marcus Reid', 'Priya Nair']) {
        for (let turn = 0; turn < 2; turn++) {
          const job = playback.play({ ...request(), voiceSeed: seed }, listener().handlers);
          await vi.advanceTimersByTimeAsync(100);
          const name = (env.speech.latest().voice as SpeechSynthesisVoice).name;
          expect(chosen.get(seed) ?? name).toBe(name);
          chosen.set(seed, name);
          job.stop();
          await vi.advanceTimersByTimeAsync(100);
        }
      }
      expect(new Set(chosen.values()).size).toBeGreaterThan(1);
    });

    it('speaks anyway, with the browser’s own default voice, when it has no English voice at all', async () => {
      const playback = setup([
        fakeVoice('Microsoft Hortense - French (France)', 'fr-FR', true, true),
      ]);
      const { log, details, handlers } = listener();
      playback.play(request(), handlers);
      await vi.advanceTimersByTimeAsync(0);
      const utterance = env.speech.latest();
      expect(utterance.voice).toBeNull();
      expect(utterance.lang).toBe('en-GB');
      // It never names a voice it did not choose.
      expect(details[0]).toEqual({ voice: null, style: 'none', local: null, lang: null });
      env.speech.finishLatest();
      expect(log).toEqual(['details', 'start', 'end']);
    });
  });

  it('stops at once, reports nothing for what was cancelled, and can speak again', async () => {
    const playback = setup();
    const { log, handlers } = listener();
    const job = playback.play(request(LONG_REPLY), handlers);
    await vi.advanceTimersByTimeAsync(0);
    env.speech.startLatest();
    const interrupted = env.speech.latest();
    job.stop();
    expect(env.speech.cancels).toBeGreaterThan(0);
    await vi.advanceTimersByTimeAsync(0);
    interrupted.onend?.();
    interrupted.onerror?.({ error: 'canceled' });
    expect(log).toEqual(['details', 'start']);
    expect(vi.getTimerCount()).toBe(0);

    const again = listener();
    playback.play(request('Starting again.'), again.handlers);
    expect(env.speech.spoken).toHaveLength(1); // some browsers need a moment after a cancel
    await vi.advanceTimersByTimeAsync(60);
    expect(env.speech.spoken).toHaveLength(2);
    env.speech.finishLatest();
    expect(again.log).toEqual(['details', 'start', 'end']);
  });

  it('only ever speaks one reply: a new one silences the old', async () => {
    const playback = setup();
    const first = listener();
    const second = listener();
    playback.play(request('First reply.'), first.handlers);
    await vi.advanceTimersByTimeAsync(0);
    env.speech.startLatest();
    const old = env.speech.latest();
    playback.play(request('Second reply.'), second.handlers);
    await vi.advanceTimersByTimeAsync(100);
    old.onend?.();
    env.speech.finishLatest();
    expect(first.log).toEqual(['details', 'start']);
    expect(second.log).toEqual(['details', 'start', 'end']);
  });

  it('clears a stuck "speaking" state before speaking, and gives up on a voice that never starts', async () => {
    const playback = setup();
    env.speech.speaking = true; // Chromium's stuck state
    env.speech.paused = true;
    const { log, handlers } = listener();
    playback.play(request(), handlers);
    await vi.advanceTimersByTimeAsync(0);
    expect(env.speech.cancels).toBe(1);
    expect(env.speech.paused).toBe(false);
    expect(env.speech.spoken).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(60);
    expect(env.speech.spoken).toHaveLength(1);

    // The browser never says it started, so the player does not wait for ever.
    await vi.advanceTimersByTimeAsync(6000);
    expect(log).toEqual(['details', 'failure:playback']);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('gives up on a voice that starts but never finishes', async () => {
    const playback = setup();
    const { log, handlers } = listener();
    playback.play(request(), handlers);
    await vi.advanceTimersByTimeAsync(0);
    env.speech.startLatest();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(log).toEqual(['details', 'start', 'failure:playback']);
  });

  it('is blocked when the browser refuses speech before the trainee has interacted', async () => {
    const playback = setup();
    const { log, handlers } = listener();
    playback.play(request(), handlers);
    await vi.advanceTimersByTimeAsync(0);
    env.speech.latest().onerror?.({ error: 'not-allowed' });
    expect(log).toEqual(['details', 'blocked']);
  });

  it('treats other speech errors as a playback failure, and a cancellation it did not ask for as the end', async () => {
    const playback = setup();
    const failed = listener();
    playback.play(request(), failed.handlers);
    await vi.advanceTimersByTimeAsync(0);
    env.speech.latest().onerror?.({ error: 'synthesis-failed' });
    expect(failed.log).toEqual(['details', 'failure:playback']);

    const ended = listener();
    playback.play(request(), ended.handlers);
    await vi.advanceTimersByTimeAsync(100);
    env.speech.latest().onerror?.({ error: 'interrupted' });
    expect(ended.log).toEqual(['details', 'end']);
  });

  it('has nothing to say for a reply with no words, and ends at once', async () => {
    const playback = setup();
    const { log, handlers } = listener();
    playback.play(request('*sighs*'), handlers);
    await vi.advanceTimersByTimeAsync(0);
    expect(env.speech.spoken).toHaveLength(0);
    expect(log).toEqual(['end']);
  });

  it('shapes the level from the words while it speaks, and stops when it ends', async () => {
    const playback = setup();
    const { levels, handlers } = listener();
    playback.play(request('Hello there. I am calling about my order.'), handlers);
    await vi.advanceTimersByTimeAsync(0);
    env.speech.startLatest();
    await vi.advanceTimersByTimeAsync(1000);
    expect(levels.length).toBeGreaterThanOrEqual(10);
    expect(levels.length).toBeLessThanOrEqual(16);
    expect(levels.every((level) => level >= 0 && level <= 1)).toBe(true);
    expect(new Set(levels).size).toBeGreaterThan(3);
    env.speech.finishLatest();
    const count = levels.length;
    await vi.advanceTimersByTimeAsync(500);
    expect(levels).toHaveLength(count);
  });

  it('is unlocked inside the click with a silent utterance, and only when nothing is speaking', async () => {
    const playback = setup();
    playback.prime();
    expect(env.speech.primes).toBe(1);
    playback.play(request(), listener().handlers);
    await vi.advanceTimersByTimeAsync(0);
    playback.prime();
    expect(env.speech.primes).toBe(1);
  });

  it('cancels speech and clears every timer when disposed', async () => {
    const playback = setup();
    const { log, handlers } = listener();
    playback.play(request(LONG_REPLY), handlers);
    await vi.advanceTimersByTimeAsync(0);
    env.speech.startLatest();
    playback.dispose();
    expect(env.speech.cancels).toBeGreaterThan(0);
    expect(vi.getTimerCount()).toBe(0);
    env.speech.latest().onend?.();
    expect(log).toEqual(['details', 'start']);
  });

  it('reports a failure when the browser has no speech synthesis', async () => {
    env = installFakes();
    const playback = createBrowserPlayback();
    const { log, handlers } = listener();
    playback.play(request(), handlers);
    await vi.advanceTimersByTimeAsync(0);
    expect(log).toEqual(['failure:playback']);
  });

  describe('the chosen voice', () => {
    const FOUR = [
      fakeVoice('Voice One (United Kingdom)', 'en-GB', true),
      fakeVoice('Voice Two (United Kingdom)', 'en-GB', true),
      fakeVoice('Voice Three (United Kingdom)', 'en-GB', true),
      fakeVoice('Voice Four (United Kingdom)', 'en-GB', true),
    ];

    it("speaks with the voice that stands for the choice, at that voice's own pace, and says which", async () => {
      const playback = setup(FOUR);
      const { details, handlers } = listener();
      playback.play({ ...request('Hello there.', 'calm'), voice: 'voice-c' }, handlers);
      await vi.advanceTimersByTimeAsync(0);
      const utterance = env.speech.latest();
      const expected = pickVoiceForChoice(FOUR, 'voice-c', 'en-GB');
      expect(utterance.voice).toBe(expected);
      const delivery = deliveryFor('calm', 'Alex Morgan', 'voice-c');
      expect(utterance.rate).toBe(delivery.rate);
      expect(utterance.pitch).toBe(delivery.pitch);
      expect(details[0]).toMatchObject({ voice: expected?.name, style: 'none', local: true });
    });

    it('gives each choice its own voice when the browser has enough, and keeps it all call', async () => {
      const playback = setup(FOUR);
      const seen = new Map<string, string>();
      for (const id of VOICE_IDS) {
        for (let turn = 0; turn < 2; turn++) {
          const job = playback.play({ ...request(), voice: id }, listener().handlers);
          await vi.advanceTimersByTimeAsync(100);
          const name = (env.speech.latest().voice as SpeechSynthesisVoice).name;
          expect(seen.get(id) ?? name).toBe(name);
          seen.set(id, name);
          job.stop();
          await vi.advanceTimersByTimeAsync(100);
        }
      }
      expect(new Set(seen.values()).size).toBe(4);
    });
  });

  describe('stopping tells the call whether the customer was cut off', () => {
    it('says so, and how much was heard, once the voice had started', async () => {
      const playback = setup();
      const job = playback.play(request(LONG_REPLY), listener().handlers);
      await vi.advanceTimersByTimeAsync(0);
      env.speech.startLatest();
      await vi.advanceTimersByTimeAsync(1500);
      const result = job.stop();
      expect(result).toEqual({ interrupted: true, playedMs: 1500 });
      expect(job.stop()).toEqual(result);
    });

    it('says the customer was not cut off before the voice started, or after it finished', async () => {
      const playback = setup();
      const early = playback.play(request(), listener().handlers);
      await vi.advanceTimersByTimeAsync(0);
      expect(early.stop()).toEqual({ interrupted: false, playedMs: 0 });

      const finished = playback.play(request(), listener().handlers);
      await vi.advanceTimersByTimeAsync(100);
      env.speech.startLatest();
      await vi.advanceTimersByTimeAsync(700);
      env.speech.finishLatest();
      expect(finished.stop()).toEqual({ interrupted: false, playedMs: 700 });
    });

    it('ends the wait for voices at once: no poll, time limit or listener outlives the reply', async () => {
      const playback = setup([]);
      const { log, handlers } = listener();
      const job = playback.play(request(), handlers);
      await vi.advanceTimersByTimeAsync(300);
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      expect(env.speech.listenerCount()).toBe(1);
      job.stop();
      expect(vi.getTimerCount()).toBe(0);
      expect(env.speech.listenerCount()).toBe(0);
      // Voices that turn up afterwards are not used for a reply that was stopped.
      env.speech.voices = [fakeVoice('Late English', 'en-GB', true)];
      env.speech.emit('voiceschanged');
      await vi.advanceTimersByTimeAsync(5000);
      expect(env.speech.spoken).toHaveLength(0);
      expect(log).toEqual([]);
    });
  });
});
