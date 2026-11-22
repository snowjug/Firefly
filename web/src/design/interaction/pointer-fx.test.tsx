import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pointerFxEnabled, usePointerFx } from './pointer-fx.ts';
import { DESKTOP_MOUSE, stubMedia } from './test-utils.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const REDUCED_DATA = '(prefers-reduced-data: reduce)';
const SLOW_UPDATE = '(update: slow)';

/** A window that answers media queries from a table, for the `win` argument. */
const windowWith = (answers: Record<string, boolean>) =>
  ({ matchMedia: (query: string) => ({ matches: answers[query] ?? false }) }) as unknown as Window;

describe('pointerFxEnabled', () => {
  it('is on for a fine hovering pointer when nobody asked for less', () => {
    expect(pointerFxEnabled(windowWith(DESKTOP_MOUSE))).toBe(true);
  });

  it.each([
    ['a pointer that cannot hover', { '(hover: hover)': false }],
    ['a coarse pointer', { '(pointer: fine)': false }],
    ['reduced motion', { [REDUCED_MOTION]: true }],
    ['reduced data', { [REDUCED_DATA]: true }],
    ['a slow display', { [SLOW_UPDATE]: true }],
  ])('is off for %s, on its own', (_name, change) => {
    expect(pointerFxEnabled(windowWith({ ...DESKTOP_MOUSE, ...change }))).toBe(false);
  });

  it('is off when there is no matchMedia to ask, or it answers nothing', () => {
    expect(pointerFxEnabled({} as Window)).toBe(false);
    expect(pointerFxEnabled({ matchMedia: () => undefined } as unknown as Window)).toBe(false);
  });

  it('asks the browser window when no window is passed', () => {
    stubMedia();
    expect(pointerFxEnabled()).toBe(true);
    vi.unstubAllGlobals();
    stubMedia({ ...DESKTOP_MOUSE, [REDUCED_MOTION]: true });
    expect(pointerFxEnabled()).toBe(false);
  });
});

describe('usePointerFx', () => {
  it('is off where the browser cannot answer (no matchMedia)', () => {
    const { result } = renderHook(() => usePointerFx());
    expect(result.current).toBe(false);
  });

  it('starts with the current answer', () => {
    stubMedia();
    expect(renderHook(() => usePointerFx()).result.current).toBe(true);
  });

  it.each([
    ['(hover: hover)', false],
    ['(pointer: fine)', false],
    [REDUCED_MOTION, true],
    [REDUCED_DATA, true],
    [SLOW_UPDATE, true],
  ])('re-evaluates when %s changes', (query, blocking) => {
    const media = stubMedia();
    const { result } = renderHook(() => usePointerFx());
    expect(result.current).toBe(true);
    media.set(query, blocking);
    expect(result.current).toBe(false);
    media.set(query, !blocking);
    expect(result.current).toBe(true);
  });

  it('stops listening when it unmounts', () => {
    const media = stubMedia();
    const { unmount } = renderHook(() => usePointerFx());
    expect(media.listeners()).toBe(5);
    unmount();
    expect(media.listeners()).toBe(0);
  });
});
