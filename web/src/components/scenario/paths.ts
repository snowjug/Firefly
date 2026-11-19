/** Routes in the choose-and-configure journey. */
export const libraryPath = '/scenarios';

export function setupPath(id: string): string {
  return `/scenarios/${encodeURIComponent(id)}/setup`;
}
