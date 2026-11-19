import { useDocumentTitle } from '../../lib/hooks.ts';
import { SkeletonBlock } from '../Page.tsx';

/** The shape of the call while it opens, so the screen does not jump when the conversation arrives. */
export function CallSkeleton() {
  useDocumentTitle('Opening your call');
  return (
    <div className="call">
      <div className="call-frame" role="status" aria-live="polite" aria-label="Opening your call">
        <div className="call-header glass">
          <SkeletonBlock height={22} width="min(100%, 320px)" />
        </div>
        <div className="call-body" aria-hidden="true">
          <div className="cstage cstage-skeleton" />
          <div className="chat glass cstage-skeleton-chat">
            <SkeletonBlock height={64} width="62%" />
            <SkeletonBlock height={48} width="48%" />
            <SkeletonBlock height={80} width="70%" />
          </div>
        </div>
        <span className="sr-only">Opening your call…</span>
      </div>
    </div>
  );
}
