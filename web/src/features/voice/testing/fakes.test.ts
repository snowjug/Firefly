import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeWav, wavBlob } from '../capture/wav.ts';
import { FakeAudioElement, installFakes, type FakeEnv } from './fakes.ts';

// The fake <audio> element has to behave like a real one in the one way the playback code can be
// fooled: a short clip reaches its end by itself, a moment after its length is known. These tests pin
// that down, so the regression tests that stand on it (the silent unlock clip must never finish a
// reply) keep meaning something.

let env: FakeEnv;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  env.uninstall();
  vi.useRealTimers();
});

/** A WAV clip of this many milliseconds: 16 kHz, so 16 samples a millisecond. */
const clip = (ms: number) => wavBlob(encodeWav(new Float32Array(16 * ms), 16000));

function recorded() {
  const element = new FakeAudioElement(env);
  const events: string[] = [];
  element.addEventListener('ended', () => events.push('ended'));
  element.addEventListener('durationchange', () =>
    events.push(`length:${Number.isNaN(element.duration) ? 'unknown' : element.duration}`),
  );
  return { element, events };
}

describe('the fake audio element', () => {
  it('reports the length of a WAV clip, then reaches its end by itself after exactly that long', async () => {
    env = installFakes();
    const { element, events } = recorded();
    element.src = URL.createObjectURL(clip(100));
    await element.play();
    await vi.advanceTimersByTimeAsync(0);
    expect(events).toEqual(['length:0.1']);
    await vi.advanceTimersByTimeAsync(99);
    expect(events).toEqual(['length:0.1']);
    await vi.advanceTimersByTimeAsync(1);
    expect(events).toEqual(['length:0.1', 'ended']);
    expect(element.paused).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('knows the unlock clip the playback code makes: 100 ms', async () => {
    env = installFakes();
    const unlockClip = wavBlob(encodeWav(new Float32Array(1600), 16000));
    const { element, events } = recorded();
    element.src = URL.createObjectURL(unlockClip);
    await element.play();
    await vi.advanceTimersByTimeAsync(100);
    expect(events).toEqual(['length:0.1', 'ended']);
  });

  describe('does not reach the end when it was stopped first', () => {
    const interruptions: Array<[string, (element: FakeAudioElement) => void]> = [
      ['paused', (element) => element.pause()],
      [
        'cleared',
        (element) => {
          element.removeAttribute('src');
          element.load();
        },
      ],
      ['loaded again', (element) => element.load()],
      [
        'given another source',
        (element) => {
          element.src = 'blob:fake/other';
        },
      ],
      ['ended by hand', (element) => element.finish()],
    ];

    it.each(interruptions)('when it is %s', async (_name, interrupt) => {
      env = installFakes();
      const { element, events } = recorded();
      element.src = URL.createObjectURL(clip(100));
      await element.play();
      await vi.advanceTimersByTimeAsync(0);
      interrupt(element);
      const before = events.filter((event) => event === 'ended').length;
      await vi.advanceTimersByTimeAsync(1000);
      expect(events.filter((event) => event === 'ended')).toHaveLength(before);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('and forgets a length it set itself with the source, but not when merely paused', async () => {
      env = installFakes();
      const { element } = recorded();
      element.src = URL.createObjectURL(clip(100));
      await element.play();
      await vi.advanceTimersByTimeAsync(0);
      element.pause();
      expect(element.duration).toBe(0.1);
      element.removeAttribute('src');
      element.load();
      expect(element.duration).toBeNaN();
    });

    it('and a play that only begins later still ends the clip by itself, from when it began', async () => {
      env = installFakes();
      env.element.policy = 'hang';
      const { element, events } = recorded();
      element.src = URL.createObjectURL(clip(100));
      void element.play();
      await vi.advanceTimersByTimeAsync(500);
      expect(events).toEqual([]);
      element.begin();
      await vi.advanceTimersByTimeAsync(100);
      expect(events).toEqual(['length:0.1', 'ended']);
    });
  });

  it('leaves a blob that is not a WAV, or too small to be one, to the test', async () => {
    env = installFakes();
    for (const blob of [new Blob(['audio']), new Blob(['sound'], { type: 'audio/wav' })]) {
      const { element, events } = recorded();
      element.src = URL.createObjectURL(blob);
      await element.play();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(events).toEqual([]);
      expect(element.paused).toBe(false);
    }
    expect(vi.getTimerCount()).toBe(0);
  });

  it('can be told to leave every end to the test', async () => {
    env = installFakes();
    env.element.autoEnd = false;
    const { element, events } = recorded();
    element.src = URL.createObjectURL(clip(100));
    await element.play();
    await vi.advanceTimersByTimeAsync(1000);
    expect(events).toEqual([]);
    element.finish();
    expect(events).toEqual(['ended']);
  });

  it('remembers what a blob URL was made from after it was revoked, as playing goes on after a revoke', () => {
    env = installFakes();
    const blob = clip(100);
    const url = URL.createObjectURL(blob);
    URL.revokeObjectURL(url);
    expect(env.urls.live()).toEqual([]);
    expect(env.urls.blobFor(url)).toBe(blob);
    expect(env.urls.blobFor('blob:fake/never')).toBeUndefined();
  });
});
