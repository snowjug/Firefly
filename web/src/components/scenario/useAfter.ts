import { useEffect, useState } from 'react';

/**
 * True once `active` has been true for `ms`, and false again as soon as it stops. For something that
 * should only appear if the wait is real: a state that would flash for a moment on a fast answer
 * stays out of the way until the answer is late.
 */
export function useAfter(active: boolean, ms: number): boolean {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => setDone(true), ms);
    return () => {
      window.clearTimeout(timer);
      setDone(false);
    };
  }, [active, ms]);
  return active && done;
}
