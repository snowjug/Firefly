import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { RewardsDTO } from '#shared/domain/api.ts';
import { play } from '../../lib/sound.ts';
import { readStorage, writeStorage } from '../../lib/storage.ts';
import { useReducedMotion } from '../../lib/theme.tsx';
import { badgesToCelebrate, celebrationText } from './rewards-model.ts';

const SEEN_KEY = 'firefly.badges.seen';
/** The whole moment lasts about this long, and any key or tap ends it sooner. */
const MOMENT_MS = 1400;

const readSeen = (): Set<string> => {
  const stored = readStorage<unknown>(SEEN_KEY, []);
  return new Set(Array.isArray(stored) ? stored.filter((id) => typeof id === 'string') : []);
};

export interface EarnedMoment {
  /** The badges whose marks are lighting up right now. */
  lit: ReadonlySet<string>;
  /** What the status line says, once, when the moment starts (empty before and without one). */
  announcement: string;
}

const NONE: EarnedMoment = { lit: new Set(), announcement: '' };

/**
 * When a badge was earned in the newest call and has not been shown yet, its mark lights once, the
 * first time the badges are on screen. It is quiet: no confetti, a sound only if the person has
 * turned sound on, and with reduced motion the mark is simply lit and the words say so. Any key or
 * tap ends it early. What has been shown is remembered on this device, so nothing replays.
 */
export function useEarnedMoment(
  data: Pick<RewardsDTO, 'badges' | 'ledger'>,
  target: RefObject<Element | null>,
): EarnedMoment {
  const reduced = useReducedMotion();
  const [moment, setMoment] = useState<EarnedMoment>(NONE);
  const started = useRef(false);

  const fresh = useMemo(
    () => badgesToCelebrate(data.badges, data.ledger, readSeen()),
    [data.badges, data.ledger],
  );
  const earnedIds = useMemo(
    () => data.badges.filter((badge) => badge.earned).map((badge) => badge.id),
    [data.badges],
  );

  // Start: at once if there is nothing to watch for, otherwise when the badges come into view.
  useEffect(() => {
    if (started.current) return;
    const remember = () => writeStorage(SEEN_KEY, [...new Set([...readSeen(), ...earnedIds])]);
    if (fresh.length === 0) {
      remember();
      return;
    }
    const start = () => {
      if (started.current) return;
      started.current = true;
      remember();
      play('earned');
      setMoment({
        lit: reduced ? new Set() : new Set(fresh.map((badge) => badge.id)),
        announcement: celebrationText(fresh),
      });
    };
    const node = target.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      start();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        start();
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [fresh, earnedIds, reduced, target]);

  // End: after a moment, or at the first key or tap.
  useEffect(() => {
    if (moment.lit.size === 0) return;
    const end = () =>
      setMoment((current) => (current.lit.size ? { ...current, lit: new Set() } : current));
    const timer = window.setTimeout(end, MOMENT_MS);
    window.addEventListener('pointerdown', end, { once: true });
    window.addEventListener('keydown', end, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', end);
      window.removeEventListener('keydown', end);
    };
  }, [moment.lit]);

  return moment;
}
