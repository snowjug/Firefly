import { useCallback, useEffect, useState } from 'react';
import { usePerfTier } from '../../lib/PerfTierProvider.tsx';
import { useReducedMotion } from '../../lib/theme.tsx';

// The front door lights its instrument once per device. "Seen" is a flag in this browser's local
// storage: Settings clears it ("Replay the introduction"), and a browser that cannot remember
// anything never plays it, because it could not tell that it had.

export const IGNITION_KEY = 'firefly.ignition';

/** The longest the introduction runs; any key or press ends it sooner. */
export const IGNITION_MS = 1200;

/** True when this device has not seen the introduction and storage can remember that it has. */
export function ignitionAvailable(): boolean {
  try {
    return localStorage.getItem(IGNITION_KEY) === null;
  } catch {
    return false;
  }
}

export function markIgnitionSeen(): void {
  try {
    localStorage.setItem(IGNITION_KEY, JSON.stringify('seen'));
  } catch {
    // Nothing to remember it with; the next visit will not play it either (see above).
  }
}

/** Makes the next visit to the front door play the introduction again. */
export function resetIgnition(): void {
  try {
    localStorage.removeItem(IGNITION_KEY);
  } catch {
    // Nothing was remembered, so there is nothing to forget.
  }
}

export interface Ignition {
  /** The introduction is running now. */
  playing: boolean;
  /** It was ended early by a key or a press. */
  skipped: boolean;
  /** Ends it at once. */
  skip(): void;
}

type Phase = 'playing' | 'done' | 'skipped';

/**
 * Whether the introduction runs on this visit and for how long. It runs only on the first visit
 * on a device, never with reduced motion (the system's or Settings') and never on the cheapest
 * effects tier. It is marked as seen as it starts, so a reload does not repeat it, and any key or
 * press ends it.
 */
export function useIgnition(): Ignition {
  const reduced = useReducedMotion();
  const tier = usePerfTier();
  const [fresh] = useState(ignitionAvailable);
  const eligible = fresh && !reduced && tier !== 'low';
  const [phase, setPhase] = useState<Phase>('playing');

  const finish = useCallback(
    (next: Exclude<Phase, 'playing'>) => setPhase((now) => (now === 'playing' ? next : now)),
    [],
  );

  const playing = eligible && phase === 'playing';
  useEffect(() => {
    if (!playing) return;
    markIgnitionSeen();
    // Counted from the first frame, not from the moment the page began to start: on a slow device
    // the browser may not draw anything for a while, and the time must not run out unseen.
    let timer = 0;
    const frame = requestAnimationFrame(() => {
      timer = window.setTimeout(() => finish('done'), IGNITION_MS);
    });
    const skip = () => finish('skipped');
    window.addEventListener('keydown', skip, true);
    window.addEventListener('pointerdown', skip, true);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      window.removeEventListener('keydown', skip, true);
      window.removeEventListener('pointerdown', skip, true);
    };
  }, [playing, finish]);

  const skip = useCallback(() => finish('skipped'), [finish]);
  return { playing, skipped: eligible && phase === 'skipped', skip };
}
