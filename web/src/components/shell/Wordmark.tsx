import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { readStorage, writeStorage } from '../../lib/storage.ts';
import { useReducedMotion } from '../../lib/theme.tsx';
import { BrandMark } from './BrandMark.tsx';
import type { ShellMode } from './shell-mode.ts';

const IGNITED_KEY = 'firefly.ignited';

/**
 * "Firefly" in light serif with the dot of the i lit amber, beside the spiral mark. It links home
 * (the front door when signed out of the app). During a call it stays as a quiet signature that is
 * not a link: leaving a live call goes through the call's own End call control. The mark draws
 * itself once per browser session, and never with reduced motion.
 */
export function Wordmark({ mode }: { mode: ShellMode }) {
  const reduced = useReducedMotion();
  const [fresh] = useState(() => !readStorage<boolean>(IGNITED_KEY, false, 'session'));
  useEffect(() => {
    writeStorage(IGNITED_KEY, true, 'session');
  }, []);

  const content = (
    <>
      <BrandMark size={34} ignite={fresh && !reduced} />
      <span className="wordmark__word" aria-hidden="true">
        F
        <span className="wordmark__i">
          {'\u0131'}
          <i />
        </span>
        refly
      </span>
    </>
  );

  if (mode === 'call') {
    return (
      <span className="wordmark wordmark--still" aria-hidden="true">
        {content}
      </span>
    );
  }
  // The name comes from the text (not an aria-label) so it always agrees with what is on screen:
  // the drawn word has its own dot on the i and would not match a spoken "Firefly".
  return (
    <Link to={mode === 'public' ? '/' : '/home'} className="wordmark" viewTransition={!reduced}>
      {content}
      <span className="sr-only">Firefly, home</span>
    </Link>
  );
}
