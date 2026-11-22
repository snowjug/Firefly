import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { Carousel } from '../../design/carousel/Carousel.tsx';
import { ScenarioCard } from '../scenarios/ScenarioCard.tsx';

/**
 * The featured row: the scenarios as cards in the product gallery, each a link into the workspace
 * with that scenario chosen. Kept in a file of its own so that the gallery and the card, and their
 * styles, are fetched only when there are scenarios to show.
 */
export default function FeaturedCarousel({
  scenarios,
}: {
  scenarios: readonly PublicScenarioDTO[];
}) {
  return (
    <Carousel label="Scenario cards" noun="scenarios" mode="link">
      {scenarios.map((scenario) => (
        <ScenarioCard key={scenario.id} scenario={scenario} mode="link" />
      ))}
    </Carousel>
  );
}
