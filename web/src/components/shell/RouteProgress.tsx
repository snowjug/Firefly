import { useEffect, useState } from 'react';
import { useNavigation } from 'react-router';

type Phase = 'idle' | 'loading' | 'done';

/**
 * A 2 px amber hairline along the very top that advances while the router is moving to a page.
 * It stays out of sight for a quick navigation (nothing to report) and, when one is slow, says so
 * without moving anything: it is a transform on a fixed line, so it never shifts the layout.
 * Reduced motion shows a short static line instead of the advance.
 */
export function RouteProgress({ delayMs = 200 }: { delayMs?: number }) {
  const busy = useNavigation().state !== 'idle';
  const [phase, setPhase] = useState<Phase>('idle');
  const [wasBusy, setWasBusy] = useState(busy);

  // When the router goes quiet, a line that was showing completes; one that never showed stays away.
  if (busy !== wasBusy) {
    setWasBusy(busy);
    if (!busy) setPhase((current) => (current === 'loading' ? 'done' : 'idle'));
  }

  useEffect(() => {
    if (!busy) return;
    const timer = window.setTimeout(() => setPhase('loading'), delayMs);
    return () => window.clearTimeout(timer);
  }, [busy, delayMs]);

  useEffect(() => {
    if (phase !== 'done') return;
    const timer = window.setTimeout(() => setPhase('idle'), 400);
    return () => window.clearTimeout(timer);
  }, [phase]);

  return <div className="route-progress" data-state={phase} aria-hidden="true" />;
}
