import { useEffect, useState } from 'react';

const loaded = new Map<() => Promise<unknown>, unknown>();

export interface OnDemand<T> {
  /** The loaded code, or null until it arrives (and for good if it could not be loaded). */
  module: T | null;
  /** True once loading has failed. It resets when the caller stops asking (`enabled` false). */
  failed: boolean;
}

/**
 * Loads code after the first paint and hands it over when it arrives.
 *
 * This is used instead of `React.lazy` with `Suspense` for the pieces of a page that can appear a
 * moment later (a canvas, a view that waits for data anyway). A suspended boundary on a page's first
 * render makes React hold back that render to avoid flashing a fallback, which delays the first
 * paint of the whole page; an effect that swaps the real view in afterwards never does. A failed
 * load is reported through `failed` instead of throwing, so it can never take the whole app down.
 *
 * `load` must be a stable function (declare it once at module level), because it is the cache key.
 * Pass `enabled: false` to hold the download back until it is wanted.
 */
export function useOnDemand<T>(load: () => Promise<T>, enabled = true): OnDemand<T> {
  const [slot, setSlot] = useState<OnDemand<T>>(() => ({
    module: (loaded.get(load) as T | undefined) ?? null,
    failed: false,
  }));
  // A failure is forgotten when the caller stops asking, so asking again tries again.
  if (!enabled && slot.failed) setSlot({ module: null, failed: false });

  const needed = enabled && slot.module === null && !slot.failed;
  useEffect(() => {
    if (!needed) return;
    let cancelled = false;
    load().then(
      (result) => {
        loaded.set(load, result);
        if (!cancelled) setSlot({ module: result, failed: false });
      },
      () => {
        if (!cancelled) setSlot({ module: null, failed: true });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [load, needed]);
  return slot;
}
