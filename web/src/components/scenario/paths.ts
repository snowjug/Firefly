/** Routes in the choose-and-configure journey. */
export const libraryPath = '/scenarios';

export function setupPath(id: string, step?: number): string {
  const base = `/scenarios/${encodeURIComponent(id)}/setup`;
  return step ? `${base}?step=${step}` : base;
}

export function briefPath(id: string): string {
  return `/scenarios/${encodeURIComponent(id)}/brief`;
}
