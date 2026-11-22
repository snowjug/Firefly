import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { THEME_COLOURS, THEME_STORAGE_KEY } from './theme.ts';

// The page's head runs web/public/theme-init.js before anything paints. This runs that very file
// against the same inputs the app's own theme code reads, and checks the page it is served in.

const web = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const script = readFileSync(join(web, 'public', 'theme-init.js'), 'utf8');
const html = readFileSync(join(web, 'index.html'), 'utf8');

function runInit(options: {
  stored?: string | null;
  systemDark?: boolean;
  storageThrows?: boolean;
  noMatchMedia?: boolean;
}) {
  const meta = document.createElement('meta');
  meta.setAttribute('name', 'theme-color');
  meta.setAttribute('content', '#ffffff');
  document.head.append(meta);
  vi.stubGlobal(
    'matchMedia',
    options.noMatchMedia ? undefined : () => ({ matches: Boolean(options.systemDark) }),
  );
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => {
        if (options.storageThrows) throw new Error('blocked');
        return key === THEME_STORAGE_KEY ? (options.stored ?? null) : null;
      },
    },
  });
  new Function(script)();
  return {
    theme: document.documentElement.dataset.theme,
    preference: document.documentElement.dataset.themePreference,
    scheme: document.documentElement.style.colorScheme,
    chrome: meta.getAttribute('content'),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-theme-preference');
  document.documentElement.style.colorScheme = '';
  document.head.querySelector('meta[name="theme-color"]')?.remove();
});

describe('theme-init.js (runs before the first paint)', () => {
  it('uses a saved dark choice even when the system is light', () => {
    expect(runInit({ stored: 'dark', systemDark: false })).toEqual({
      theme: 'dark',
      preference: 'dark',
      scheme: 'dark',
      chrome: THEME_COLOURS.dark,
    });
  });

  it('uses a saved light choice even when the system is dark', () => {
    expect(runInit({ stored: 'light', systemDark: true })).toEqual({
      theme: 'light',
      preference: 'light',
      scheme: 'light',
      chrome: THEME_COLOURS.light,
    });
  });

  it('follows the system when nothing is saved', () => {
    expect(runInit({ systemDark: true }).theme).toBe('dark');
    expect(runInit({ systemDark: false }).theme).toBe('light');
    expect(runInit({ systemDark: true }).preference).toBe('system');
  });

  it('ignores a value that is not a theme', () => {
    expect(runInit({ stored: 'sepia', systemDark: true })).toMatchObject({
      theme: 'dark',
      preference: 'system',
    });
  });

  it('falls back to light when storage is blocked or there are no media queries', () => {
    expect(runInit({ storageThrows: true }).theme).toBe('light');
    expect(runInit({ noMatchMedia: true, stored: 'dark' }).theme).toBe('dark');
    expect(runInit({ noMatchMedia: true }).theme).toBe('light');
  });
});

describe('the page that loads it', () => {
  it('loads the script from this origin, in the head, before the app, and not inline', () => {
    const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
    expect(head).toMatch(/<script src="\/theme-init\.js"><\/script>/);
    expect(html.indexOf('/theme-init.js')).toBeLessThan(html.indexOf('/src/main.tsx'));
    // The content security policy allows no inline script, so there must be none.
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
  });

  it('declares both colour schemes to the browser', () => {
    expect(html).toMatch(/<meta name="color-scheme" content="light dark" \/>/);
    expect(html).toMatch(/<meta name="theme-color" content="#ffffff" \/>/);
  });
});
