import { SkeletonBlock } from '../Page.tsx';

/** The same shapes as the finished page, so nothing moves when the numbers arrive. */
export function RewardsSkeleton() {
  return (
    <div className="rw-content" role="status" aria-label="Loading your rewards">
      <div className="rw-summary" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="glass rw-stat">
            <span className="skeleton rw-skel-icon" />
            <div className="rw-stat-body rw-skel-text">
              <SkeletonBlock height={24} width="45%" />
              <SkeletonBlock height={12} width="75%" />
            </div>
          </div>
        ))}
      </div>
      <div aria-hidden="true">
        <SkeletonBlock height={44} width="min(100%, 24rem)" />
      </div>
      <div className="rw-badges" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div key={index} className="glass rw-badge rw-skel-badge">
            <span className="skeleton rw-skel-emblem" />
            <SkeletonBlock height={16} width="55%" />
            <SkeletonBlock height={12} width="85%" />
            <SkeletonBlock height={8} />
          </div>
        ))}
      </div>
    </div>
  );
}
