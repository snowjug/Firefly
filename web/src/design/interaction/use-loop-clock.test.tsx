import { StrictMode } from 'react';
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useLoopClock, type LoopClock, type LoopClockOptions } from './use-loop-clock.ts';
import { stubRaf } from './test-utils.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

const BASE: LoopClockOptions = { durationMs: 1000, maxLoops: 3, paused: false, reduced: false };

function setUp(props: Partial<LoopClockOptions> = {}, strict = false) {
  const raf = stubRaf();
  let renders = 0;
  const view = renderHook(
    (options: LoopClockOptions) => {
      renders += 1;
      return useLoopClock(options);
    },
    { initialProps: { ...BASE, ...props }, ...(strict ? { wrapper: StrictMode } : {}) },
  );
  return {
    raf,
    renders: () => renders,
    now: () => view.result.current,
    set: (change: Partial<LoopClockOptions>) =>
      view.rerender({ ...BASE, ...props, ...change } satisfies LoopClockOptions),
    unmount: view.unmount,
  };
}

describe('useLoopClock', () => {
  it('starts at the beginning, playing, and asks for a frame', () => {
    const { now, raf } = setUp();
    expect(now()).toEqual({ t: 0, loop: 0, playing: true });
    expect(raf.pending()).toBe(1);
  });

  it('adds up the gaps between frame timestamps: the first frame is only a starting point', () => {
    const { now, raf } = setUp();
    raf.frame(5000);
    expect(now().t).toBe(0);
    raf.frame(5040);
    expect(now().t).toBe(40);
    raf.frame(5080);
    expect(now().t).toBe(80);
  });

  it('gives the same answers for the same frames, whatever the clock says', () => {
    const run = () => {
      const { now, raf } = setUp();
      const seen: LoopClock[] = [];
      for (const timestamp of [100, 150, 230, 260, 400, 450, 600]) {
        raf.frame(timestamp);
        seen.push(now());
      }
      return seen;
    };
    expect(run()).toEqual(run());
  });

  it('shows the time about 30 times a second, not on every frame', () => {
    const { raf, renders } = setUp({ maxLoops: Number.POSITIVE_INFINITY });
    const before = renders();
    for (let frame = 0; frame <= 60; frame += 1) raf.frame((frame * 1000) / 60);
    const shown = renders() - before;
    expect(shown).toBeGreaterThanOrEqual(28);
    expect(shown).toBeLessThanOrEqual(32);
  });

  it('never lets one frame move the clock more than 100ms', () => {
    const { now, raf } = setUp();
    raf.frame(0);
    raf.frame(5000);
    expect(now().t).toBe(100);
  });

  it('counts the loops it has completed and starts each from the top', () => {
    const { now, raf } = setUp({ durationMs: 200, maxLoops: 3 });
    const seen: LoopClock[] = [];
    for (let timestamp = 0; timestamp <= 300; timestamp += 100) {
      raf.frame(timestamp);
      seen.push(now());
    }
    expect(seen).toEqual([
      { t: 0, loop: 0, playing: true },
      { t: 100, loop: 0, playing: true },
      { t: 0, loop: 1, playing: true },
      { t: 100, loop: 1, playing: true },
    ]);
  });

  it('stops after maxLoops on the final frame and asks for nothing more', () => {
    const { now, raf } = setUp({ durationMs: 200, maxLoops: 2 });
    for (let timestamp = 0; timestamp <= 400; timestamp += 100) raf.frame(timestamp);
    expect(now()).toEqual({ t: 200, loop: 2, playing: false });
    expect(raf.pending()).toBe(0);
    const requested = raf.requested();
    raf.frame(500);
    expect(raf.requested()).toBe(requested);
  });

  it('keeps going for ever when maxLoops is Infinity', () => {
    const { now, raf } = setUp({ durationMs: 100, maxLoops: Number.POSITIVE_INFINITY });
    for (let timestamp = 0; timestamp <= 550; timestamp += 50) raf.frame(timestamp);
    expect(now()).toEqual({ t: 50, loop: 5, playing: true });
    expect(raf.pending()).toBe(1);
  });

  it('freezes t when paused, asks for no frames, and carries on from the same place when resumed', () => {
    const { now, raf, set } = setUp();
    raf.frame(0);
    raf.frame(100);
    raf.frame(200);
    expect(now().t).toBe(200);
    set({ paused: true });
    expect(now()).toEqual({ t: 200, loop: 0, playing: false });
    expect(raf.pending()).toBe(0);
    set({ paused: false });
    expect(raf.pending()).toBe(1);
    // A long time went by while paused: the first frame back is a new starting point, not a jump.
    raf.frame(100_000);
    expect(now().t).toBe(200);
    raf.frame(100_100);
    expect(now()).toEqual({ t: 300, loop: 0, playing: true });
  });

  it('does not ask for a single frame while it starts paused', () => {
    const { now, raf, set } = setUp({ paused: true });
    expect(now()).toEqual({ t: 0, loop: 0, playing: false });
    expect(raf.requested()).toBe(0);
    set({ paused: false });
    expect(now().playing).toBe(true);
    expect(raf.pending()).toBe(1);
  });

  it('shows the final, complete frame and never starts when motion is reduced', () => {
    const { now, raf } = setUp({ reduced: true });
    expect(now()).toEqual({ t: 1000, loop: 0, playing: false });
    expect(raf.requested()).toBe(0);
  });

  it('follows a change of the reduced-motion preference in both directions', () => {
    const { now, raf, set } = setUp({ reduced: true });
    set({ reduced: false });
    expect(now()).toEqual({ t: 0, loop: 0, playing: true });
    raf.frame(0);
    raf.frame(100);
    expect(now().t).toBe(100);
    set({ reduced: true });
    expect(now()).toEqual({ t: 1000, loop: 0, playing: false });
    expect(raf.pending()).toBe(0);
  });

  it.each([
    ['no loops to play', { maxLoops: 0 }, { t: 1000, loop: 0, playing: false }],
    ['a zero duration', { durationMs: 0 }, { t: 0, loop: 0, playing: false }],
    [
      'a duration that is not a number',
      { durationMs: Number.NaN },
      { t: 0, loop: 0, playing: false },
    ],
  ])('plays nothing for %s', (_name, props, expected) => {
    const { now, raf } = setUp(props);
    expect(now()).toEqual(expected);
    expect(raf.requested()).toBe(0);
  });

  it('cancels its pending frame when it unmounts', () => {
    const { raf, unmount } = setUp();
    expect(raf.pending()).toBe(1);
    unmount();
    expect(raf.pending()).toBe(0);
  });

  it('runs one loop at the right speed under StrictMode, where effects run twice', () => {
    const { now, raf } = setUp({}, true);
    expect(raf.pending()).toBe(1);
    for (const timestamp of [0, 100, 200]) raf.frame(timestamp);
    expect(now()).toEqual({ t: 200, loop: 0, playing: true });
    expect(raf.pending()).toBe(1);
  });
});
