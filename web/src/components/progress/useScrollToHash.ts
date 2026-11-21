import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { useReducedMotion } from '../../lib/theme.tsx';

/**
 * Takes the page to the section the address names (`#recognition`) once that section exists. The
 * browser cannot do it by itself: the section is only there after its numbers have arrived, and by
 * then the browser has long since looked for it. Focus goes with the scroll, so a keyboard or
 * screen-reader user starts reading at the section instead of at the top of the page.
 */
export function useScrollToHash(ready: boolean): void {
  const { hash } = useLocation();
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!ready || hash.length < 2) return;
    let id: string;
    try {
      id = decodeURIComponent(hash.slice(1));
    } catch {
      return;
    }
    // After the shell has put focus and the scroll position back at the top for a new page.
    const timer = window.setTimeout(() => {
      const target = document.getElementById(id);
      if (!target) return;
      if (typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
      }
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [ready, hash, reduced]);
}
