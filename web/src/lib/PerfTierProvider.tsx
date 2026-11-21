import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  createFrameMonitor,
  forcedTierFromSearch,
  initialTier,
  readPerfEnv,
  tierBudget,
  tierRank,
  type EffectBudget,
  type PerfTier,
} from './perf-tier.ts';

// Gives the app one answer to "how much decoration can this device afford?". The tier starts from
// what the browser reports, steps down (never up) if frames run slow, and is available as
// `usePerfTier()` and `useEffectBudget()`. While mounted it also sets `data-perf="high|medium|low"`
// on the root element, the way ThemeProvider sets `data-theme`, so CSS can switch blur off for
// `[data-perf='low']` without any script.
//
// Trying a tier: add `?perf=low`, `?perf=medium` or `?perf=high` to the address. It is read once,
// when the app loads; it pins the tier and turns the frame monitor off, so a forced tier stays put.
// The `tier` prop does the same for tests and stories, and wins over the address.

interface PerfState {
  tier: PerfTier;
  budget: EffectBudget;
  forced: boolean;
}

// Outside a provider (a test or a story) nothing has been measured, so the cheapest effects are
// the safe answer: components still work, they just draw less.
const FALLBACK: PerfState = { tier: 'low', budget: tierBudget('low'), forced: false };

const PerfContext = createContext<PerfState>(FALLBACK);

export interface PerfTierProviderProps {
  children: ReactNode;
  /**
   * Watch frame times and step down when the page struggles. On by default, but under Vitest it
   * stays off unless this is set, so a test never has a frame loop running behind it.
   */
  monitor?: boolean;
  /** Pins the tier. For tests and stories; wins over `?perf=`. */
  tier?: PerfTier;
}

export function PerfTierProvider({ children, monitor, tier: pinned }: PerfTierProviderProps) {
  // Read once: the address and the device do not change while the app is open.
  const [boot] = useState(() => {
    const win = typeof window === 'undefined' ? undefined : window;
    return {
      fromAddress: forcedTierFromSearch(win?.location.search ?? ''),
      measured: initialTier(readPerfEnv(win)),
    };
  });
  const [measured, setMeasured] = useState<PerfTier>(boot.measured);

  const forced = pinned ?? boot.fromAddress;
  const tier = forced ?? measured;
  const watching = (monitor ?? import.meta.env.MODE !== 'test') && forced === null;

  useEffect(() => {
    if (!watching) return;
    const frames = createFrameMonitor({
      now: () => performance.now(),
      requestFrame: (callback) => window.requestAnimationFrame(callback),
      cancelFrame: (id) => window.cancelAnimationFrame(id),
      isHidden: () => document.hidden,
      // Only ever down: a late or repeated report cannot raise the tier again.
      onDegrade: (next) =>
        setMeasured((current) => (tierRank(next) > tierRank(current) ? next : current)),
      start: boot.measured,
    });
    frames.start();
    return () => frames.stop();
  }, [watching, boot.measured]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-perf', tier);
    return () => root.removeAttribute('data-perf');
  }, [tier]);

  const value = useMemo<PerfState>(
    () => ({ tier, budget: tierBudget(tier), forced: forced !== null }),
    [tier, forced],
  );
  return <PerfContext.Provider value={value}>{children}</PerfContext.Provider>;
}

/** The current tier. Outside a provider it is "low", the cheapest. */
export function usePerfTier(): PerfTier {
  return useContext(PerfContext).tier;
}

/** What each effect may use at the current tier. Outside a provider it is the "low" budget. */
export function useEffectBudget(): EffectBudget {
  return useContext(PerfContext).budget;
}
