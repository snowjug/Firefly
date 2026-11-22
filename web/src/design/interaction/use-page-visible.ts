import { useSyncExternalStore } from 'react';

function subscribe(notify: () => void): () => void {
  document.addEventListener('visibilitychange', notify);
  return () => document.removeEventListener('visibilitychange', notify);
}

const visible = () => document.visibilityState !== 'hidden';
const assumeVisible = () => true;

/** False while the tab is in the background. Pair it with anything that loops, so it pauses there. */
export function usePageVisible(): boolean {
  return useSyncExternalStore(subscribe, visible, assumeVisible);
}
