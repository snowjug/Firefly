import { Ledger } from '../frame/Ledger.tsx';
import { NONE, formatPracticeTime, type PracticeStats } from './dashboard-model.ts';

type Loadable<T> = T | 'loading' | 'error';

export interface BadgeCount {
  earned: number;
  total: number;
  /** Points are points: what the rewards ledger adds up. Never a rank. */
  points: number;
}

const UNAVAILABLE = 'Not available right now';

/**
 * What the saved practice adds up to, as rows on hairlines. Nothing is estimated: a figure that
 * cannot be worked out yet reads as a dash and says why, and one that could not be loaded says so.
 * It is only shown once there is practice to add up (see `hasPractised`).
 */
export function PracticeLedger({
  stats,
  badges,
}: {
  stats: Loadable<PracticeStats>;
  badges: Loadable<BadgeCount>;
}) {
  const practice = typeof stats === 'object' ? stats : null;
  const earned = typeof badges === 'object' ? badges : null;
  const sessionNote = stats === 'error' ? UNAVAILABLE : stats === 'loading' ? 'Loading' : undefined;
  const average = practice?.averageScore ?? null;

  return (
    <Ledger
      rows={[
        {
          label: 'Scenarios completed',
          value: practice ? practice.completed : NONE,
          note: sessionNote,
        },
        {
          label: 'Average score',
          value: practice && average !== null ? `${average.toFixed(1)} of 5` : NONE,
          note: practice
            ? average === null
              ? 'Appears after your first finished call.'
              : undefined
            : sessionNote,
        },
        {
          label: 'Badges earned',
          value: earned ? `${earned.earned} of ${earned.total}` : NONE,
          note: earned
            ? earned.points > 0
              ? `${earned.points} ${earned.points === 1 ? 'point' : 'points'}`
              : undefined
            : badges === 'error'
              ? UNAVAILABLE
              : 'Loading',
        },
        {
          label: 'Practice time',
          value: practice ? formatPracticeTime(practice.practiceSeconds) : NONE,
          note: sessionNote,
        },
      ]}
    />
  );
}
