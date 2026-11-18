import { afterEach, describe, expect, it } from 'vitest';
import initScript from '../../public/theme-init.js?raw';
import { writeStorage } from './storage.ts';

// This script runs before the app does, so it has to read exactly what the app wrote.
function runInitScript() {
  new Function(initScript)();
}

const root = () => document.documentElement;

describe('theme-init.js (display preferences applied before first paint)', () => {
  afterEach(() => {
    localStorage.clear();
    root().removeAttribute('data-theme');
    root().removeAttribute('data-motion');
  });

  it('applies the theme and motion preferences in the format the app saves them', () => {
    writeStorage('firefly.theme', 'dark');
    writeStorage('firefly.motion', 'reduce');
    runInitScript();
    expect(root().getAttribute('data-theme')).toBe('dark');
    expect(root().getAttribute('data-motion')).toBe('reduce');
  });

  it('also accepts a bare value', () => {
    localStorage.setItem('firefly.theme', 'light');
    runInitScript();
    expect(root().getAttribute('data-theme')).toBe('light');
  });

  it('leaves the device defaults alone for "system", "full" and values it does not know', () => {
    writeStorage('firefly.theme', 'system');
    writeStorage('firefly.motion', 'full');
    runInitScript();
    expect(root().hasAttribute('data-theme')).toBe(false);
    expect(root().hasAttribute('data-motion')).toBe(false);

    localStorage.setItem('firefly.theme', '"sepia"');
    localStorage.setItem('firefly.motion', '{not json');
    runInitScript();
    expect(root().hasAttribute('data-theme')).toBe(false);
    expect(root().hasAttribute('data-motion')).toBe(false);
  });
});
