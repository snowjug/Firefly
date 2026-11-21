import { useEffect } from 'react';

export const LANDING_TITLE = 'Firefly: practise customer conversations';

/**
 * Sets the landing page's title exactly. `useDocumentTitle` always adds " · Firefly" after the page
 * name, which would read "Firefly: practise customer conversations · Firefly" here.
 */
export function useLandingTitle(): void {
  useEffect(() => {
    document.title = LANDING_TITLE;
  }, []);
}
