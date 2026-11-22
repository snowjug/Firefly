import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  THEME_COLOURS,
  THEME_STORAGE_KEY,
  applyTheme,
  parsePreference,
  readStoredPreference,
  resolveTheme,
  storePreference,
  systemPrefersDark,
  withThemeTransition,
} from './theme.ts';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    data,
  };
}

const blockedStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-theme-preference');
  document.documentElement.style.colorScheme = '';
  document.head.querySelector('meta[name="theme-color"]')?.remove();
});

describe('theme preference', () => {
  it('reads only an explicit light or dark; anything else follows the system', () => {
    expect(parsePreference('light')).toBe('light');
    expect(parsePreference('dark')).toBe('dark');
    for (const value of ['system', 'DARK', '', null, undefined, 3, {}]) {
      expect(parsePreference(value)).toBe('system');
    }
  });

  it('resolves a choice, and the system when there is none', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('stores a choice, and stores "system" as no choice at all', () => {
    const storage = memoryStorage();
    storePreference('dark', storage);
    expect(storage.data.get(THEME_STORAGE_KEY)).toBe('dark');
    expect(readStoredPreference(storage)).toBe('dark');
    storePreference('system', storage);
    expect(storage.data.has(THEME_STORAGE_KEY)).toBe(false);
    expect(readStoredPreference(storage)).toBe('system');
  });

  it('survives storage that is blocked, and a value someone edited by hand', () => {
    expect(readStoredPreference(blockedStorage)).toBe('system');
    expect(() => storePreference('dark', blockedStorage)).not.toThrow();
    expect(readStoredPreference(memoryStorage({ [THEME_STORAGE_KEY]: 'purple' }))).toBe('system');
    expect(readStoredPreference(null)).toBe('system');
  });

  it('says whether a choice was kept: yes for a working store, no for blocked or missing storage', () => {
    expect(storePreference('dark', memoryStorage())).toBe(true);
    expect(storePreference('system', memoryStorage())).toBe(true);
    expect(storePreference('dark', blockedStorage)).toBe(false);
    expect(storePreference('dark', null)).toBe(false);
  });

  it('asks the system without a window or a media query', () => {
    expect(systemPrefersDark(undefined)).toBe(false);
    expect(systemPrefersDark({} as Pick<Window, 'matchMedia'>)).toBe(false);
    expect(
      systemPrefersDark({
        matchMedia: () => ({ matches: true }) as MediaQueryList,
      }),
    ).toBe(true);
  });
});

describe('applyTheme', () => {
  it('puts the theme and the preference on the page and tints the browser chrome, but never sets color-scheme inline', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', '#ffffff');
    document.head.append(meta);

    applyTheme(document.documentElement, 'dark', 'system');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.dataset.themePreference).toBe('system');
    // The stylesheet owns color-scheme, for screens only. An inline value would also reach print, where
    // the printed report's system colours (Canvas, CanvasText) would turn dark.
    expect(document.documentElement.style.colorScheme).toBe('');
    expect(meta.getAttribute('content')).toBe(THEME_COLOURS.dark);

    applyTheme(document.documentElement, 'light', 'light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(meta.getAttribute('content')).toBe(THEME_COLOURS.light);
  });

  it('works when the page has no theme-color tag', () => {
    expect(() => applyTheme(document.documentElement, 'dark', 'dark')).not.toThrow();
  });
});

describe('withThemeTransition', () => {
  const stubMotion = (reduced: boolean) =>
    vi.stubGlobal(
      'matchMedia',
      (query: string) => ({ matches: reduced && query.includes('reduce') }) as MediaQueryList,
    );

  it('commits at once when the browser has no view transitions', () => {
    stubMotion(false);
    const commit = vi.fn();
    withThemeTransition(commit);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('hands the change to the browser as a crossfade when it can', () => {
    stubMotion(false);
    const start = vi.fn((update: () => void) => update());
    Object.defineProperty(document, 'startViewTransition', { value: start, configurable: true });
    const commit = vi.fn();
    try {
      withThemeTransition(commit);
      expect(start).toHaveBeenCalledTimes(1);
      expect(commit).toHaveBeenCalledTimes(1);
    } finally {
      Reflect.deleteProperty(document, 'startViewTransition');
    }
  });

  it('never fades for a person who asks for less motion', () => {
    stubMotion(true);
    const start = vi.fn();
    Object.defineProperty(document, 'startViewTransition', { value: start, configurable: true });
    const commit = vi.fn();
    try {
      withThemeTransition(commit);
      expect(start).not.toHaveBeenCalled();
      expect(commit).toHaveBeenCalledTimes(1);
    } finally {
      Reflect.deleteProperty(document, 'startViewTransition');
    }
  });
});
