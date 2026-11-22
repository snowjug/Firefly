import { Icon } from '../../design/icons.tsx';
import { Button } from '../../design/primitives/Button.tsx';
import { Skeleton } from '../../design/primitives/Skeleton.tsx';
import { VisuallyHidden } from '../../design/primitives/VisuallyHidden.tsx';
import { ScenarioCardSkeleton } from './ScenarioCard.tsx';

/** Placeholder cards while the scenarios load. The row says it is busy, and says so once. */
export function GallerySkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="scn-gallery-loading" aria-busy="true">
      <VisuallyHidden>Loading scenarios</VisuallyHidden>
      <div className="scn-gallery-loading__row" aria-hidden="true">
        {Array.from({ length: cards }, (_, index) => (
          <ScenarioCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

/** The shape of the product rail while the scenarios load, so nothing moves when it arrives. */
export function RailSkeleton() {
  return (
    <div className="scn-rail-loading" aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} width="5.5rem" height="2rem" />
      ))}
    </div>
  );
}

export function GalleryEmpty({
  filtered,
  onClear,
  onRetry,
}: {
  /** Something is narrowing the gallery, so clearing it can help. */
  filtered: boolean;
  onClear(): void;
  onRetry(): void;
}) {
  return (
    <div className="scn-empty u-enter">
      <Icon name="search" size={28} className="scn-empty__icon" />
      <h2 className="scn-empty__title">
        {filtered ? 'No scenarios match' : 'No scenarios available'}
      </h2>
      {filtered ? (
        <Button onClick={onClear}>Clear filters</Button>
      ) : (
        <Button onClick={onRetry}>Try again</Button>
      )}
    </div>
  );
}
