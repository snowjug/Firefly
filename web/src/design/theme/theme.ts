// The theme: light, dark, or follow the system. The choice is kept in this browser only
// (localStorage key `firefly.theme`) and is never sent anywhere. A tiny script in the page's head
// (web/public/theme-init.js) applies it before the first paint; everything here keeps it in step
// afterwards, so the two are tested against the same inputs.

export const THEME_STORAGE_KEY = 'firefly.theme';

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = 'light' | 'dark';

/** The browser chrome colour for each theme: the page canvas, so the address bar blends in. */
export const THEME_COLOURS: Record<ResolvedTheme, string> = {
  light: '#ffffff',
  dark: '#161a22',
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Anything that is not an explicit choice means "follow the system". */
export function parsePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') return preference;
  return systemDark ? 'dark' : 'light';
}

function browserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    // Reading localStorage throws when storage is blocked.
    return null;
  }
}

export function readStoredPreference(
  storage: StorageLike | null = browserStorage(),
): ThemePreference {
  try {
    return parsePreference(storage?.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

/**
 * "System" is the default, so it is stored as the absence of a choice. Says whether the choice is now
 * kept by this browser: false when storage is blocked or full, which only means it is not remembered.
 */
export function storePreference(
  preference: ThemePreference,
  storage: StorageLike | null = browserStorage(),
): boolean {
  if (!storage) return false;
  try {
    if (preference === 'system') storage.removeItem(THEME_STORAGE_KEY);
    else storage.setItem(THEME_STORAGE_KEY, preference);
    return true;
  } catch {
    return false;
  }
}

export function systemPrefersDark(
  win: Pick<Window, 'matchMedia'> | undefined = typeof window === 'undefined' ? undefined : window,
): boolean {
  try {
    return win?.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  } catch {
    return false;
  }
}

/**
 * Puts a theme on the page: the attribute the stylesheet reads and the browser chrome. It does NOT set
 * `color-scheme` on the page: the stylesheet does that, inside `@media screen` (tokens.css). An inline
 * value would also apply to print, and there the system colours that the printed report is drawn in
 * (`Canvas` and `CanvasText`) would turn dark, so a report printed from the dark theme would come out
 * as white text.
 */
export function applyTheme(
  root: HTMLElement,
  resolved: ResolvedTheme,
  preference: ThemePreference,
): void {
  root.setAttribute('data-theme', resolved);
  root.setAttribute('data-theme-preference', preference);
  root.ownerDocument
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLOURS[resolved]);
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => unknown;
};

/**
 * Runs a change of theme as a short crossfade of the whole page where the browser can (the View
 * Transitions API), and as a plain change anywhere else and for people who ask for less motion.
 * `commit` must change the page synchronously: the browser takes its pictures around it.
 */
export function withThemeTransition(commit: () => void): void {
  const doc = typeof document === 'undefined' ? null : (document as ViewTransitionDocument);
  let reduced = false;
  try {
    reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    reduced = false;
  }
  if (doc && typeof doc.startViewTransition === 'function' && !reduced) {
    doc.startViewTransition(commit);
    return;
  }
  commit();
}
