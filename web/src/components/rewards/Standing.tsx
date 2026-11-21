import type { RewardsDTO } from '#shared/domain/api.ts';
import { Ledger } from '../frame/index.ts';
import { Meter } from './Meter.tsx';
import { activeChallenges, earnedCount, levelProgress, streakText } from './rewards-model.ts';
import '../../styles/rewards.css';

/**
 * Where practice has got to, in points: the points, the level and how far it is to the next one in
 * both points and kinds of call, then three facts as ledger rows (badges, challenges, streak).
 * Points are points, never experience; nothing here is a rank, and a missed day costs nothing.
 */
export function Standing({ data }: { data: RewardsDTO }) {
  const progress = levelProgress(data);
  const kinds = data.families.practised.length;
  return (
    <div className="rw-standing">
      <section className="rw-level" aria-labelledby="rw-points-title">
        <h3 id="rw-points-title" className="rw-level__label type-label">
          Your points
        </h3>
        <p className="rw-points">
          <span className="rw-points__n">{data.points}</span>{' '}
          <span className="rw-points__unit">{data.points === 1 ? 'point' : 'points'}</span>
        </p>
        <p className="rw-level__name">
          <span className="type-label">
            Level {data.level.index} of {data.levels.length}
          </span>
          <span className="rw-level__title">{data.level.name}</span>
        </p>
        {progress.top ? (
          <p className="rw-level__togo">{progress.toGo}</p>
        ) : (
          <>
            <Meter
              value={Math.round(progress.ratio * 100)}
              max={100}
              label={`Progress to ${progress.nextName}`}
            />
            <p className="rw-level__next">
              Next level: <strong>{progress.nextName}</strong>
            </p>
            <p className="rw-level__togo">{progress.toGo}</p>
          </>
        )}
        <p className="rw-level__kinds">
          {kinds} of {data.families.total} kinds of call practised
        </p>
      </section>

      <Ledger
        rows={[
          { label: 'Badges earned', value: `${earnedCount(data.badges)} of ${data.badges.length}` },
          { label: 'Active challenges', value: String(activeChallenges(data.challenges).length) },
          {
            label: 'Current streak',
            value: streakText(data.streak.current),
            note: (
              <>
                Best: {streakText(data.streak.best)}
                {data.streak.practisedToday ? '. You practised today.' : ''} A missed day never
                costs you anything.
              </>
            ),
          },
        ]}
      />
    </div>
  );
}
