import { useSyncExternalStore } from 'react';

// True between the browser's beforeprint and afterprint events, so collapsed disclosures can show
// all of their content on paper.

const listeners = new Set<() => void>();
let printing = false;

function set(value: boolean) {
  if (printing === value) return;
  printing = value;
  listeners.forEach((listener) => listener());
}
const onBefore = () => set(true);
const onAfter = () => set(false);

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    window.addEventListener('beforeprint', onBefore);
    window.addEventListener('afterprint', onAfter);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener('beforeprint', onBefore);
      window.removeEventListener('afterprint', onAfter);
    }
  };
}

export function usePrinting(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => printing,
    () => false,
  );
}
