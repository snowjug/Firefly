/** Routes in the choose-and-configure journey. */
export const libraryPath = '/scenarios';

export function setupPath(id: string): string {
  return `/scenarios/${encodeURIComponent(id)}/setup`;
}

/**
 * Where "Back to the missions" leads. A mission opened from the plate remembers the address it was
 * opened from (with its search, lens and view), so coming back is to the same view; anything else
 * (a bookmark, a typed address) goes to the missions as they open.
 */
export function backToMissions(state: unknown): string {
  if (typeof state !== 'object' || state === null) return libraryPath;
  const from = (state as { from?: unknown }).from;
  return typeof from === 'string' && /^\/scenarios(?:[?#]|$)/.test(from) ? from : libraryPath;
}
