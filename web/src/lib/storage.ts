import { useCallback, useState } from 'react';

// Safe wrappers: storage can be unavailable (private mode, blocked cookies) and must never break the app.

export function readStorage<T>(key: string, fallback: T, area: 'local' | 'session' = 'local'): T {
  try {
    const raw = (area === 'local' ? localStorage : sessionStorage).getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeStorage(
  key: string,
  value: unknown,
  area: 'local' | 'session' = 'local',
): void {
  try {
    (area === 'local' ? localStorage : sessionStorage).setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function removeStorage(key: string, area: 'local' | 'session' = 'local'): void {
  try {
    (area === 'local' ? localStorage : sessionStorage).removeItem(key);
  } catch {
    // ignore
  }
}

export function useStoredState<T>(key: string, initial: T, area: 'local' | 'session' = 'local') {
  const [value, setValue] = useState<T>(() => readStorage(key, initial, area));
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        writeStorage(key, resolved, area);
        return resolved;
      });
    },
    [key, area],
  );
  return [value, set] as const;
}
