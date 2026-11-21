import { Suspense, lazy, useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { usePerfTier } from '../../lib/PerfTierProvider.tsx';
import { routePose } from './route-poses.ts';
import { setBasePose } from './world-store.ts';

// The persistent layer behind every page: the field of light the app lives in. First paint is the
// still mineral gradient from the tokens (pure CSS), which is also what stays when effects are off.
// The animated field is a separate chunk, requested only once the browser is idle, so the shell never
// waits for it. Mount this once, in the app shell and in the public shell.

const WorldField = lazy(() => import('./WorldField.tsx'));

/** True once the browser has nothing better to do (or after a short wait where it cannot say). */
function useIdle(): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    const native =
      typeof window.requestIdleCallback === 'function' &&
      typeof window.cancelIdleCallback === 'function';
    const id = native
      ? window.requestIdleCallback(() => setIdle(true), { timeout: 1500 })
      : window.setTimeout(() => setIdle(true), 300);
    return () => (native ? window.cancelIdleCallback(id) : window.clearTimeout(id));
  }, []);
  return idle;
}

export function WorldLayer() {
  const { pathname } = useLocation();
  const tier = usePerfTier();
  const idle = useIdle();

  // Each route has its own presence; a page that wants more (the call) asks with `useWorldPose`.
  useEffect(() => {
    setBasePose(routePose(pathname));
  }, [pathname]);

  return (
    <div className="world" aria-hidden="true">
      {idle && tier !== 'low' ? (
        <Suspense fallback={null}>
          <WorldField />
        </Suspense>
      ) : null}
    </div>
  );
}
