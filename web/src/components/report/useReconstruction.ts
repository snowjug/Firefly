import { useCallback, useEffect, useState } from 'react';
import { usePerfTier } from '../../lib/PerfTierProvider.tsx';
import { useReducedMotion } from '../../lib/theme.tsx';

// The opening of the debrief: the call replays once, as a line across the head of the page. It is a
// drawing and nothing else (the report is all there, readable and focusable, from the first frame),
// it is over in under two and a half seconds, any press or key skips it, and it is never played
// again for a call in the same browser session. With reduced motion, or on the cheapest
// performance tier, it is not played at all: the line is simply there.

export type ReconstructionPhase = 'playing' | 'done';

/** How long the replay takes at most. The CSS timings in debrief.css fit inside it. */
export const RECONSTRUCTION_MS = 2400;

export const reconstructionKey = (sessionId: string) => `firefly.debrief.played.${sessionId}`;

function seenBefore(sessionId: string): boolean {
  try {
    return window.sessionStorage.getItem(reconstructionKey(sessionId)) !== null;
  } catch {
    // Storage can be blocked: playing again is harmless, so it is not worth failing over.
    return false;
  }
}

function markSeen(sessionId: string): void {
  try {
    window.sessionStorage.setItem(reconstructionKey(sessionId), '1');
  } catch {
    // Nothing to do: the replay may play again on a later visit.
  }
}

/** Whether the replay should play now. Pure, so every reason to skip it can be tested. */
export function shouldReconstruct(options: {
  enabled: boolean;
  reducedMotion: boolean;
  quietTier: boolean;
  seen: boolean;
}): boolean {
  return options.enabled && !options.reducedMotion && !options.quietTier && !options.seen;
}

export interface Reconstruction {
  phase: ReconstructionPhase;
  /** Ends the replay at once, leaving the line as it is when it has finished. */
  skip(): void;
}

/**
 * The state of the opening replay for one call. `enabled` is false when there is nothing to
 * replay (a call with no recorded journey).
 */
export function useReconstruction(sessionId: string, enabled: boolean): Reconstruction {
  const reducedMotion = useReducedMotion();
  const tier = usePerfTier();
  const [phase, setPhase] = useState<ReconstructionPhase>(() =>
    shouldReconstruct({
      enabled,
      reducedMotion,
      quietTier: tier === 'low',
      seen: seenBefore(sessionId),
    })
      ? 'playing'
      : 'done',
  );
  const skip = useCallback(() => setPhase('done'), []);

  useEffect(() => {
    if (phase !== 'playing') return;
    markSeen(sessionId);
    const timer = window.setTimeout(() => setPhase('done'), RECONSTRUCTION_MS);
    const events = ['pointerdown', 'keydown', 'touchstart'] as const;
    for (const name of events) window.addEventListener(name, skip, { passive: true });
    return () => {
      window.clearTimeout(timer);
      for (const name of events) window.removeEventListener(name, skip);
    };
  }, [phase, sessionId, skip]);

  return { phase, skip };
}
