import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useOnDemand } from './onDemand.ts';

describe('useOnDemand', () => {
  it('has nothing at first, then the loaded code, and loads it once', async () => {
    const load = vi.fn(() => Promise.resolve({ value: 1 }));
    const { result } = renderHook(() => useOnDemand(load));
    expect(result.current).toEqual({ module: null, failed: false });
    await waitFor(() => expect(result.current.module).toEqual({ value: 1 }));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('has the code straight away on later mounts', async () => {
    const load = vi.fn(() => Promise.resolve({ value: 2 }));
    const first = renderHook(() => useOnDemand(load));
    await waitFor(() => expect(first.result.current.module).not.toBeNull());

    const second = renderHook(() => useOnDemand(load));
    expect(second.result.current.module).toEqual({ value: 2 });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('reports a failed load instead of throwing', async () => {
    const load = vi.fn(() => Promise.reject(new Error('chunk missing')));
    const { result } = renderHook(() => useOnDemand(load));
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.module).toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('waits until it is wanted, and tries again when asked again after a failure', async () => {
    let attempts = 0;
    const load = vi.fn(() =>
      ++attempts === 1 ? Promise.reject(new Error('blip')) : Promise.resolve({ ok: true }),
    );
    const { result, rerender } = renderHook(({ wanted }) => useOnDemand(load, wanted), {
      initialProps: { wanted: false },
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(load).not.toHaveBeenCalled();

    rerender({ wanted: true });
    await waitFor(() => expect(result.current.failed).toBe(true));

    rerender({ wanted: false });
    expect(result.current.failed).toBe(false);

    rerender({ wanted: true });
    await waitFor(() => expect(result.current.module).toEqual({ ok: true }));
    expect(load).toHaveBeenCalledTimes(2);
  });
});
