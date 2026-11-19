import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { readStorage, writeStorage } from './storage.ts';

export type ThemePreference = 'system' | 'light' | 'dark';
export type MotionPreference = 'system' | 'reduce' | 'full';

interface ThemeState {
  theme: ThemePreference;
  motion: MotionPreference;
  setTheme(theme: ThemePreference): void;
  setMotion(motion: MotionPreference): void;
  /** True when animation should be minimal (the system or the user asks for it). */
  reducedMotion: boolean;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeState | null>(null);

function systemPrefers(query: string): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(query).matches
  );
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(() =>
    readStorage<ThemePreference>('firefly.theme', 'system'),
  );
  const [motion, setMotionState] = useState<MotionPreference>(() =>
    readStorage<MotionPreference>('firefly.motion', 'system'),
  );
  const [systemLight, setSystemLight] = useState(() =>
    systemPrefers('(prefers-color-scheme: light)'),
  );
  const [systemReduce, setSystemReduce] = useState(() =>
    systemPrefers('(prefers-reduced-motion: reduce)'),
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const light = window.matchMedia('(prefers-color-scheme: light)');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onLight = () => setSystemLight(light.matches);
    const onReduce = () => setSystemReduce(reduce.matches);
    light.addEventListener('change', onLight);
    reduce.addEventListener('change', onReduce);
    return () => {
      light.removeEventListener('change', onLight);
      reduce.removeEventListener('change', onReduce);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    if (motion === 'reduce') root.setAttribute('data-motion', 'reduce');
    else root.removeAttribute('data-motion');
  }, [theme, motion]);

  const setTheme = useCallback((next: ThemePreference) => {
    writeStorage('firefly.theme', next);
    setThemeState(next);
  }, []);
  const setMotion = useCallback((next: MotionPreference) => {
    writeStorage('firefly.motion', next);
    setMotionState(next);
  }, []);

  const value = useMemo<ThemeState>(
    () => ({
      theme,
      motion,
      setTheme,
      setMotion,
      reducedMotion: motion === 'reduce' || (motion === 'system' && systemReduce),
      resolvedTheme: theme === 'system' ? (systemLight ? 'light' : 'dark') : theme,
    }),
    [theme, motion, setTheme, setMotion, systemLight, systemReduce],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
