import type { IconName } from '../Icon.tsx';
import { StatCard, type Tone } from '../ui/StatCard.tsx';
import { NONE, formatPracticeTime, type PracticeStats } from './dashboard-model.ts';

type Loadable<T> = T | 'loading' | 'error';

export interface BadgeCount {
  earned: number;
  total: number;
}

/** Same shape as a stat card, so the row does not change size when the numbers arrive. */
function StatSkeleton() {
  return (
    <div className="stat glass dash-stat-skeleton" aria-hidden="true">
      <span className="skeleton dash-stat-skeleton-icon" />
      <div className="dash-stat-skeleton-text">
        <span className="skeleton" style={{ height: 24, width: '3.2rem' }} />
        <span className="skeleton" style={{ height: 12, width: '7rem' }} />
      </div>
    </div>
  );
}

function Stat({
  icon,
  tone,
  label,
  state,
  value,
  note,
}: {
  icon: IconName;
  tone: Tone;
  label: string;
  state: 'loading' | 'error' | 'ready';
  value: string | number;
  note?: string;
}) {
  if (state === 'loading') return <StatSkeleton />;
  if (state === 'error') {
    return (
      <StatCard icon={icon} tone={tone} value={NONE} label={label} note="Not available right now" />
    );
  }
  return <StatCard icon={icon} tone={tone} value={value} label={label} note={note} />;
}

/**
 * Four real numbers from the saved practice calls. Nothing is estimated: a number that cannot be
 * worked out yet reads as a dash, and one that could not be loaded says so.
 */
export function StatsRow({
  stats,
  badges,
}: {
  stats: Loadable<PracticeStats>;
  badges: Loadable<BadgeCount>;
}) {
  const practice = typeof stats === 'object' ? stats : null;
  const earned = typeof badges === 'object' ? badges : null;
  const sessionsState = practice ? 'ready' : (stats as 'loading' | 'error');
  const badgesState = earned ? 'ready' : (badges as 'loading' | 'error');
  const average = practice?.averageScore ?? null;
  return (
    <div className="grid-4 dash-stats">
      <Stat
        icon="check-circle"
        tone="blue"
        label="Scenarios completed"
        state={sessionsState}
        value={practice?.completed ?? 0}
      />
      <Stat
        icon="chart"
        tone="green"
        label="Average score"
        state={sessionsState}
        value={average === null ? NONE : `${average.toFixed(1)} of 5`}
      />
      <Stat
        icon="trophy"
        tone="amber"
        label="Badges earned"
        state={badgesState}
        value={earned ? `${earned.earned} of ${earned.total}` : NONE}
      />
      <Stat
        icon="clock"
        tone="violet"
        label="Practice time"
        state={sessionsState}
        value={formatPracticeTime(practice?.practiceSeconds ?? 0)}
      />
      {practice && average === null ? (
        <p className="sr-only">Your average score appears after your first finished call.</p>
      ) : null}
    </div>
  );
}
