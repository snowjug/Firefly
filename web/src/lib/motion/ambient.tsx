import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { readStorage, writeStorage } from '../storage.ts';
import { useReducedMotion } from '../theme.tsx';

// Ambient motion is anything that moves on its own: a breathing presence, a drifting light, the
// field behind the app. WCAG 2.2.2 asks that anything moving for more than five seconds can be
// paused, so there is always a visible control for it (in the utility cluster), separate from the
// "reduce motion" setting and honoured by everything that is marked `data-ambient` or that reads
// this hook. Reduced motion (the system's or the user's) pauses it too, without changing the
// stored choice.

export type AmbientPreference = 'on' | 'paused';

interface AmbientState {
  /** What the person chose. */
  preference: AmbientPreference;
  /** Whether ambient motion is stopped right now: chosen, or forced by reduced motion. */
  paused: boolean;
  /** Reduced motion forces the pause, so the control cannot undo it. */
  forced: boolean;
  setPreference(next: AmbientPreference): void;
  toggle(): void;
}

const STORAGE_KEY = 'firefly.ambient';

const AmbientContext = createContext<AmbientState | null>(null);

const readPreference = (): AmbientPreference =>
  readStorage<AmbientPreference>(STORAGE_KEY, 'on') === 'paused' ? 'paused' : 'on';

export function AmbientProvider({ children }: { children: ReactNode }) {
  const forced = useReducedMotion();
  const [preference, setPreferenceState] = useState<AmbientPreference>(readPreference);
  const paused = forced || preference === 'paused';

  useEffect(() => {
    const root = document.documentElement;
    if (paused) root.setAttribute('data-ambient', 'paused');
    else root.removeAttribute('data-ambient');
  }, [paused]);

  const setPreference = useCallback((next: AmbientPreference) => {
    writeStorage(STORAGE_KEY, next);
    setPreferenceState(next);
  }, []);
  const toggle = useCallback(
    () => setPreference(preference === 'paused' ? 'on' : 'paused'),
    [preference, setPreference],
  );

  const value = useMemo<AmbientState>(
    () => ({ preference, paused, forced, setPreference, toggle }),
    [preference, paused, forced, setPreference, toggle],
  );
  return <AmbientContext.Provider value={value}>{children}</AmbientContext.Provider>;
}

export function useAmbient(): AmbientState {
  const ctx = useContext(AmbientContext);
  if (!ctx) throw new Error('useAmbient must be used inside AmbientProvider');
  return ctx;
}

/** For decorative parts that must still work outside the provider: not paused, unless forced. */
export function useAmbientPaused(): boolean {
  const ctx = useContext(AmbientContext);
  const reduced = useReducedMotion();
  return ctx ? ctx.paused : reduced;
}
