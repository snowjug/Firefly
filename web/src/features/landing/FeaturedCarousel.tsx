import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { Carousel } from '../../design/carousel/Carousel.tsx';
import { useInViewOnce } from '../../design/interaction/use-in-view.ts';
import { ScenarioCard } from '../scenarios/ScenarioCard.tsx';

// The cards arrive once the row is a little way up the window, so the beat is seen, not scrolled past.
const IN_VIEW = '0px 0px -15% 0px';

/**
 * The featured row: the scenarios as cards in the product gallery, each a link into the workspace
 * with that scenario chosen. Kept in a file of its own so that the gallery and the card, and their
 * styles, are fetched only when there are scenarios to show. The first eight cards arrive one after
 * another (a fade and a small rise) the first time the row is in view, and not before: until then each
 * rests on its first frame. One observer watches the whole row. Without IntersectionObserver, or with
 * less motion, they are simply there.
 */
export default function FeaturedCarousel({
  scenarios,
}: {
  scenarios: readonly PublicScenarioDTO[];
}) {
  const [row, seen] = useInViewOnce<HTMLDivElement>({ rootMargin: IN_VIEW });
  return (
    <div ref={row}>
      <Carousel label="Scenario cards" noun="scenarios" mode="link">
        {scenarios.map((scenario, index) => (
          <ScenarioCard
            key={scenario.id}
            scenario={scenario}
            mode="link"
            arrive={{ index, waiting: !seen }}
          />
        ))}
      </Carousel>
    </div>
  );
}
