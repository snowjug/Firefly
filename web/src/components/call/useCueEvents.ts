import { useEffect, useRef, useState } from 'react';
import { play } from '../../lib/sound.ts';
import { pulseWorld } from './signal-bridge.tsx';
import type { CueLevel } from './atmosphere.ts';

/** How long "Signal found" stays on screen. It is a moment, not a notice. */
export const FOUND_MS = 6000;

/**
 * What happens in the room when something is found or the conversation turns. Both are guided
 * practice only: with cues off nothing here fires, so nothing can be read from its absence. A
 * found signal says so once (for a moment, and to a screen reader) and may play a short tone; both
 * kinds of moment give the field behind the page one brief event.
 */
export function useCueEvents({
  cue,
  discoveries,
  curveballs,
}: {
  cue: CueLevel;
  /** How many signals have been found since the call was opened. */
  discoveries: number;
  /** How many times the conversation has turned since the call was opened. */
  curveballs: number;
}): { announceFound: boolean } {
  const [seen, setSeen] = useState(discoveries);
  const [showing, setShowing] = useState(false);

  // Derived while rendering: a new discovery arrived since the last time we looked.
  if (seen !== discoveries) {
    setSeen(discoveries);
    if (cue === 'full' && discoveries > seen) setShowing(true);
  }

  useEffect(() => {
    if (!showing) return;
    play('discovery');
    pulseWorld('discovery');
    const timer = window.setTimeout(() => setShowing(false), FOUND_MS);
    return () => window.clearTimeout(timer);
  }, [showing, discoveries]);

  const turns = useRef(curveballs);
  useEffect(() => {
    if (cue === 'full' && curveballs > turns.current) pulseWorld('curveball');
    turns.current = curveballs;
  }, [curveballs, cue]);

  return { announceFound: showing };
}
