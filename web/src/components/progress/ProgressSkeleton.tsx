import { SkeletonBlock } from '../Page.tsx';

/** The same shapes as the finished page, so nothing moves when the numbers arrive. */
export function ProgressSkeleton() {
  return (
    <div className="pg-content" role="status" aria-label="Loading your progress">
      <div className="pg-tiles" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <div key={index} className="glass pg-tile">
            <span className="skeleton pg-skel-icon" />
            <div className="pg-tile-body">
              <SkeletonBlock height={10} width="40%" />
              <SkeletonBlock height={22} width="55%" />
              <SkeletonBlock height={12} />
            </div>
          </div>
        ))}
      </div>
      <div className="pg-duo" aria-hidden="true">
        {[0, 1].map((index) => (
          <div key={index} className="glass pg-focus">
            <SkeletonBlock height={22} width="50%" />
            <SkeletonBlock height={28} width="65%" />
            <SkeletonBlock height={14} />
            <SkeletonBlock height={14} width="80%" />
          </div>
        ))}
      </div>
      <div className="pg-skills" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div key={index} className="glass pg-skill">
            <SkeletonBlock height={18} width="60%" />
            <SkeletonBlock height={12} />
            <SkeletonBlock height={64} />
            <SkeletonBlock height={12} width="75%" />
          </div>
        ))}
      </div>
    </div>
  );
}
