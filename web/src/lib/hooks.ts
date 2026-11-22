import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { isApiError, type ApiError } from './api.ts';

export interface AsyncState<T> {
  data: T | null;
  error: ApiError | Error | null;
  loading: boolean;
  reload(): void;
}

function sameDeps(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
}

/**
 * Runs an async loader when `deps` change and exposes loading/error/data. Requests are cancelled when
 * the component unmounts or the dependencies change, so stale responses never overwrite newer ones.
 */
export function useApi<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
): AsyncState<T> {
  const [state, setState] = useState<{
    data: T | null;
    error: ApiError | Error | null;
    loading: boolean;
  }>({
    data: null,
    error: null,
    loading: true,
  });
  const [tick, setTick] = useState(0);

  // When the inputs change, show the loading state immediately (derived during render, not in an effect).
  const [seenDeps, setSeenDeps] = useState<readonly unknown[]>(deps);
  if (!sameDeps(seenDeps, deps)) {
    setSeenDeps(deps);
    setState((s) => ({ data: s.data, error: null, loading: true }));
  }

  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });

  useEffect(() => {
    const controller = new AbortController();
    loaderRef
      .current(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, error: null, loading: false });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          data: null,
          error: isApiError(error) ? error : error instanceof Error ? error : new Error('Failed'),
          loading: false,
        });
      });
    return () => controller.abort();
    // The caller supplies the dependency list; `tick` re-runs the request for reload().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => {
    setState((s) => ({ data: s.data, error: null, loading: true }));
    setTick((t) => t + 1);
  }, []);
  return { ...state, reload };
}

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title ? `${title} \u00b7 Firefly` : 'Firefly';
  }, [title]);
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia(query).matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** False while the browser reports that it has no network connection. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (notify) => {
      window.addEventListener('online', notify);
      window.addEventListener('offline', notify);
      return () => {
        window.removeEventListener('online', notify);
        window.removeEventListener('offline', notify);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

/** Calls `fn` every `ms` while `active`. Cleans up on unmount. */
export function useInterval(fn: () => void, ms: number, active = true): void {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => ref.current(), ms);
    return () => window.clearInterval(id);
  }, [ms, active]);
}
