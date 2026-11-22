import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  THEME_STORAGE_KEY,
  applyTheme,
  parsePreference,
  readStoredPreference,
  resolveTheme,
  storePreference,
  systemPrefersDark,
  withThemeTransition,
  type ResolvedTheme,
  type ThemePreference,
} from './theme.ts';

export interface ThemeValue {
  /** What the person chose: light, dark, or follow the system. */
  preference: ThemePreference;
  /** What is on the page now. */
  resolved: ResolvedTheme;
  setPreference(next: ThemePreference): void;
  /** Switches to the other theme as an explicit choice. */
  toggle(): void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

/**
 * Keeps the page's theme in step with the person's choice and the system's, and remembers the
 * choice on this device. The page already has its theme (a script in the head applied it before
 * the first paint); this provider reads the same inputs, so the first render agrees with it.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readStoredPreference());
  const [systemDark, setSystemDark] = useState<boolean>(() => systemPrefersDark());
  const resolved = resolveTheme(preference, systemDark);

  // The system's own setting, while the person has chosen nothing.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemDark(query.matches);
    onChange();
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  // Another tab chose a theme: follow it.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) {
        setPreferenceState(parsePreference(event.newValue));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Whatever the cause, the page follows the resolved theme.
  useEffect(() => {
    applyTheme(document.documentElement, resolved, preference);
  }, [resolved, preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    const nextResolved = resolveTheme(next, systemPrefersDark());
    withThemeTransition(() => {
      applyTheme(document.documentElement, nextResolved, next);
      storePreference(next);
      setPreferenceState(next);
    });
  }, []);

  const toggle = useCallback(
    () => setPreference(resolved === 'dark' ? 'light' : 'dark'),
    [resolved, setPreference],
  );

  const value = useMemo<ThemeValue>(
    () => ({ preference, resolved, setPreference, toggle }),
    [preference, resolved, setPreference, toggle],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** The theme, or null where there is no provider (a component shown on its own, or in a test). */
export function useOptionalTheme(): ThemeValue | null {
  return useContext(ThemeContext);
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme needs a ThemeProvider above it.');
  return value;
}
