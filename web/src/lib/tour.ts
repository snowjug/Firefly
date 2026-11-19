import { useSyncExternalStore } from 'react';
import { readStorage, writeStorage } from './storage.ts';

// The first-time tour is offered once and never forced. What the person chose is remembered on this
// device only: no account, no server call.

export type TourState = 'new' | 'done' | 'skipped';

const KEY = 'firefly.tour';
const listeners = new Set<() => void>();

let cached: TourState | null = null;
let openRequests = 0;

function read(): TourState {
  if (cached === null) {
    const stored = readStorage<string>(KEY, 'new');
    cached = stored === 'done' || stored === 'skipped' ? stored : 'new';
  }
  return cached;
}

function emit() {
  for (const listener of listeners) listener();
}

export function setTourState(state: TourState): void {
  cached = state;
  writeStorage(KEY, state);
  emit();
}

/** Asks the shell to open the tour (for example from Settings). */
export function requestTour(): void {
  openRequests += 1;
  emit();
}

export function resetTourForTests(): void {
  cached = null;
  openRequests = 0;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTourState(): TourState {
  return useSyncExternalStore(subscribe, read, () => 'done' as TourState);
}

/** Increases every time someone asks for the tour to open. */
export function useTourRequests(): number {
  return useSyncExternalStore(
    subscribe,
    () => openRequests,
    () => 0,
  );
}
