import { useEffect } from 'react';
import { LANDING_TITLE } from './landing-copy.ts';

export { LANDING_TITLE };

/**
 * Sets the landing page's title exactly. `useDocumentTitle` always adds " · Firefly" after the page
 * name, which would read "Firefly: practise Microsoft support calls · Firefly" here.
 */
export function useLandingTitle(): void {
  useEffect(() => {
    document.title = LANDING_TITLE;
  }, []);
}
