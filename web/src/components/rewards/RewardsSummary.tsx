import type { ReactNode } from 'react';
import type { RewardsDTO } from '#shared/domain/api.ts';
import { plural } from '../../lib/format.ts';
import { Icon, type IconName } from '../Icon.tsx';
import { ProgressBar } from '../ui/ProgressBar.tsx';
import type { Tone } from '../ui/StatCard.tsx';
import { activeChallenges, earnedCount, levelProgress, streakText } from './rewards-model.ts';

function SummaryCard({
  icon,
  tone,
  value,
  label,
  children,
}: {
  icon: IconName;
  tone: Tone;
  value: string | number;
  label: string;
  children?: ReactNode;
}) {
  return (
    <div className="glass rw-stat">
      <span className="stat-icon" data-tone={tone} aria-hidden="true">
        <Icon name={icon} size={22} />
      </span>
      <div className="rw-stat-body">
        <p className="stat-value">{value}</p>
        <p className="stat-label">{label}</p>
        {children}
      </div>
    </div>
  );
}

/** Level, badges, challenges and streak: the four things worth a glance. */
export function RewardsSummary({ data }: { data: RewardsDTO }) {
  const progress = levelProgress(data);
  const kinds = data.families.practised.length;
  return (
    <div className="rw-summary">
      <div className="glass rw-level">
        <div className="rw-level-top">
          <span className="stat-icon rw-level-icon" data-tone="amber" aria-hidden="true">
            <Icon name="star" size={26} />
          </span>
          <div>
            <p className="t-label">
              Level {data.level.index} of {data.levels.length}
            </p>
            <p className="rw-level-name">{data.level.name}</p>
            <p className="rw-level-points tabular">{plural(data.points, 'point')}</p>
          </div>
        </div>
        {progress.top ? (
          <p className="rw-togo">
            <Icon name="trophy" size={16} /> {progress.toGo}
          </p>
        ) : (
          <div className="rw-level-bar">
            <ProgressBar
              value={Math.round(progress.ratio * 100)}
              max={100}
              label={`Progress to ${progress.nextName}`}
              tone="amber"
            />
            <p className="rw-togo">
              <span>
                Next level: <strong>{progress.nextName}</strong>
              </span>
              <span>{progress.toGo}</span>
            </p>
          </div>
        )}
        <p className="rw-meta">
          {kinds} of {data.families.total} kinds of call practised
        </p>
      </div>

      <SummaryCard
        icon="trophy"
        tone="amber"
        value={`${earnedCount(data.badges)} of ${data.badges.length}`}
        label="Badges earned"
      />
      <SummaryCard
        icon="target"
        tone="violet"
        value={activeChallenges(data.challenges).length}
        label="Active challenges"
      />
      <SummaryCard
        icon="flame"
        tone="amber"
        value={streakText(data.streak.current)}
        label="Current streak"
      >
        <p className="rw-meta">
          Best: {streakText(data.streak.best)}
          {data.streak.practisedToday ? '. You practised today.' : ''}
        </p>
        <p className="rw-meta">A missed day never costs you anything.</p>
      </SummaryCard>
    </div>
  );
}
