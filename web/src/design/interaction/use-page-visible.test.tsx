import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePageVisible } from './use-page-visible.ts';

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

afterEach(() => {
  // Back to jsdom's own property on the prototype.
  Reflect.deleteProperty(document, 'visibilityState');
  vi.restoreAllMocks();
});

describe('usePageVisible', () => {
  it('is true while the tab is showing', () => {
    const { result } = renderHook(() => usePageVisible());
    expect(result.current).toBe(true);
  });

  it('starts false when the tab is already in the background', () => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    const { result } = renderHook(() => usePageVisible());
    expect(result.current).toBe(false);
  });

  it('follows the tab into the background and back', () => {
    const { result } = renderHook(() => usePageVisible());
    setVisibility('hidden');
    expect(result.current).toBe(false);
    setVisibility('visible');
    expect(result.current).toBe(true);
  });

  it('stops listening when it unmounts', () => {
    const removed = vi.spyOn(document, 'removeEventListener');
    const { unmount } = renderHook(() => usePageVisible());
    unmount();
    expect(removed).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    // Nothing is left to hear the change, and nothing throws.
    expect(() => setVisibility('hidden')).not.toThrow();
  });
});
