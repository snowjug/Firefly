import { useEffect, useRef, useState } from 'react';

export interface LoopClock {
  /** Milliseconds into the current loop. It is `durationMs` once the clock has finished, and always when motion is reduced. */
  t: number;
  /** Loops completed so far. */
  loop: number;
  /** True while the clock is advancing: not paused, not reduced and not finished. */
  playing: boolean;
}

export interface LoopClockOptions {
  /** The length of one loop, in ms. */
  durationMs: number;
  /** How many loops to play before stopping on the final frame. `Infinity` never stops. */
  maxLoops: number;
  /** Off screen, in a hidden tab or paused by the user: freezes `t` where it is. */
  paused: boolean;
  /** Reduced motion: never starts and shows the final frame. */
  reduced: boolean;
}

// The clock re-renders its component about 30 times a second, not once per display frame.
const COMMIT_MS = 32;
// One frame never advances the clock by more than this, so a stalled tab or a debugger pause does
// not make the loop jump.
const MAX_STEP_MS = 100;

/**
 * Drives a short looping sequence (the call preview on the landing page) from animation frames. It
 * adds up the time between frame timestamps instead of reading the clock, so the same frames always
 * give the same `t`. `paused` freezes `t` without losing it and the clock carries on from the same
 * place; `reduced` never starts and returns the final, complete frame (`t` = `durationMs`); after
 * `maxLoops` loops it stops on that same frame, with `loop` equal to `maxLoops`. The pending frame is
 * cancelled on pause, on stop and on unmount. To start over, remount it with a `key`; changing
 * `durationMs` while it plays does not rescale the time already played.
 */
export function useLoopClock({
  durationMs,
  maxLoops,
  paused,
  reduced,
}: LoopClockOptions): LoopClock {
  const duration = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0;
  const loops = maxLoops > 0 ? Math.floor(maxLoops) : 0;
  const total = duration > 0 ? duration * loops : 0;

  const [elapsed, setElapsed] = useState(0);
  // The exact time played; `elapsed` is the part of it that has been shown.
  const exact = useRef(0);
  const finished = elapsed >= total;
  const running = !reduced && !paused && !finished;

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let last: number | null = null;
    let sinceShown = 0;
    const tick = (now: number) => {
      if (last !== null) {
        const step = Math.min(Math.max(now - last, 0), MAX_STEP_MS);
        exact.current = Math.min(exact.current + step, total);
        sinceShown += step;
      }
      last = now;
      const done = exact.current >= total;
      if (done || sinceShown >= COMMIT_MS) {
        sinceShown = 0;
        setElapsed(exact.current);
      }
      if (!done) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, total]);

  if (reduced || duration === 0) return { t: duration, loop: 0, playing: false };
  if (finished) return { t: duration, loop: loops, playing: false };
  return { t: elapsed % duration, loop: Math.floor(elapsed / duration), playing: !paused };
}
