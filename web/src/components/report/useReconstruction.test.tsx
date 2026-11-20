import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PerfTierProvider } from '../../lib/PerfTierProvider.tsx';
import type { PerfTier } from '../../lib/perf-tier.ts';
import {
  RECONSTRUCTION_MS,
  reconstructionKey,
  shouldReconstruct,
  useReconstruction,
} from './useReconstruction.ts';

const withTier = (tier: PerfTier) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <PerfTierProvider tier={tier}>{children}</PerfTierProvider>;
  };

beforeEach(() => {
  window.sessionStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  window.sessionStorage.clear();
});

describe('shouldReconstruct', () => {
  const base = { enabled: true, reducedMotion: false, quietTier: false, seen: false };

  it('plays for a call with a journey, once, where motion is welcome', () => {
    expect(shouldReconstruct(base)).toBe(true);
  });

  it('does not play when there is nothing to replay, motion is reduced, the device is quiet or it was seen', () => {
    expect(shouldReconstruct({ ...base, enabled: false })).toBe(false);
    expect(shouldReconstruct({ ...base, reducedMotion: true })).toBe(false);
    expect(shouldReconstruct({ ...base, quietTier: true })).toBe(false);
    expect(shouldReconstruct({ ...base, seen: true })).toBe(false);
  });
});

describe('useReconstruction', () => {
  it('plays at first, notes that it did, and ends by itself', () => {
    const { result } = renderHook(() => useReconstruction('call-1', true), {
      wrapper: withTier('high'),
    });
    expect(result.current.phase).toBe('playing');
    expect(window.sessionStorage.getItem(reconstructionKey('call-1'))).not.toBeNull();
    act(() => void vi.advanceTimersByTime(RECONSTRUCTION_MS - 10));
    expect(result.current.phase).toBe('playing');
    act(() => void vi.advanceTimersByTime(20));
    expect(result.current.phase).toBe('done');
  });

  it('ends at once on a press, a key or a touch, and when asked', () => {
    for (const name of ['pointerdown', 'keydown', 'touchstart']) {
      window.sessionStorage.clear();
      const { result, unmount } = renderHook(() => useReconstruction('call-1', true), {
        wrapper: withTier('high'),
      });
      expect(result.current.phase).toBe('playing');
      act(() => void window.dispatchEvent(new Event(name)));
      expect(result.current.phase).toBe('done');
      unmount();
    }
    window.sessionStorage.clear();
    const { result } = renderHook(() => useReconstruction('call-1', true), {
      wrapper: withTier('high'),
    });
    act(() => result.current.skip());
    expect(result.current.phase).toBe('done');
  });

  it('is not played again for the same call in the same session, but is for another', () => {
    const first = renderHook(() => useReconstruction('call-1', true), {
      wrapper: withTier('high'),
    });
    expect(first.result.current.phase).toBe('playing');
    first.unmount();
    const again = renderHook(() => useReconstruction('call-1', true), {
      wrapper: withTier('high'),
    });
    expect(again.result.current.phase).toBe('done');
    const other = renderHook(() => useReconstruction('call-2', true), {
      wrapper: withTier('high'),
    });
    expect(other.result.current.phase).toBe('playing');
  });

  it('does not play on the cheapest tier, nor without a journey, and does not count that as seeing it', () => {
    const quiet = renderHook(() => useReconstruction('call-1', true), { wrapper: withTier('low') });
    expect(quiet.result.current.phase).toBe('done');
    const empty = renderHook(() => useReconstruction('call-1', false), {
      wrapper: withTier('high'),
    });
    expect(empty.result.current.phase).toBe('done');
    expect(window.sessionStorage.getItem(reconstructionKey('call-1'))).toBeNull();
  });

  it('stops listening for a key press once it is over', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { result } = renderHook(() => useReconstruction('call-1', true), {
      wrapper: withTier('high'),
    });
    act(() => void vi.advanceTimersByTime(RECONSTRUCTION_MS + 10));
    expect(result.current.phase).toBe('done');
    expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function));
    remove.mockRestore();
  });
});
