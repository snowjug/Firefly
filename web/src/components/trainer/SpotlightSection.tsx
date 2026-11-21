import { Link } from 'react-router';
import type { DemoStatusDTO, PublicScenarioDTO } from '#shared/domain/api.ts';
import type { AsyncState } from '../../lib/hooks.ts';
import { Icon, LoadingNotice, SignalGlyph } from './bridge.tsx';
import { StudioError, StudioNote, StudioSection } from './StudioFrame.tsx';
import { scenarioFacts, scenarioTraits, spotlightHighlights } from './trainer-model.ts';
import { useStartCall } from './useStartCall.ts';

function SpotlightCard({ scenario }: { scenario: PublicScenarioDTO }) {
  const { start, error } = useStartCall();
  const { persona } = scenario;

  return (
    <div className="tr-spot">
      <div className="tr-spot__text">
        <h3 className="tr-spot__title type-title">{scenario.title}</h3>
        <p className="tr-spot__who">
          {persona.name}, {persona.role} at {persona.organisation}
        </p>
        <ul className="tr-facts type-label" aria-label="Scenario settings">
          {scenarioFacts(scenario).map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
          <li>About {scenario.estimatedMinutes} min</li>
        </ul>
        <p className="tr-spot__summary">{scenario.summary}</p>
        <div className="action-row tr-spot__actions">
          <button type="button" className="action" onClick={() => start(scenario.id, {})}>
            Start the spotlight call <Icon name="arrow-right" size={18} />
          </button>
          <Link
            to={`/scenarios/${encodeURIComponent(scenario.id)}/setup`}
            className="text-link"
            viewTransition
          >
            Customise first
          </Link>
        </div>
        {error ? (
          <p role="alert" className="tr-problem">
            {error}
          </p>
        ) : null}
      </div>
      {/* Every fact the instrument draws is written out beside it. */}
      <div className="tr-spot__figure" aria-hidden="true">
        <SignalGlyph traits={scenarioTraits(scenario)} size={190} />
      </div>

      <div className="tr-shows">
        <h4 className="tr-shows__label type-label">What this scenario shows</h4>
        <ul className="tr-shows__list">
          {spotlightHighlights(scenario).map((item) => (
            <li key={item.title}>
              <p className="tr-shows__title">{item.title}</p>
              <p className="tr-shows__text">{item.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** The demo spotlight: loading, error and "no spotlight" states around the scenario. */
export function SpotlightSection({
  demo,
  spotlight,
}: {
  demo: AsyncState<DemoStatusDTO>;
  spotlight: AsyncState<PublicScenarioDTO | null>;
}) {
  let body;
  if (!demo.data) {
    body = demo.error ? (
      <StudioError
        error={demo.error}
        onRetry={demo.reload}
        title="Could not load the demo spotlight"
      />
    ) : (
      <LoadingNotice label="Loading the demo spotlight" lines={4} />
    );
  } else if (demo.data.spotlightScenarioId === null) {
    body = (
      <StudioNote
        title="No demo spotlight is set"
        action={
          <Link to="/scenarios" className="action action--quiet" viewTransition>
            Browse the scenario library
          </Link>
        }
      >
        <p>
          The spotlight is a scenario marked for demos. You can still start any scenario from the
          quick start below or from the library.
        </p>
      </StudioNote>
    );
  } else if (spotlight.error) {
    body = (
      <StudioError
        error={spotlight.error}
        onRetry={spotlight.reload}
        title="Could not load the spotlight scenario"
      />
    );
  } else if (!spotlight.data) {
    body = <LoadingNotice label="Loading the demo spotlight" lines={4} />;
  } else {
    body = <SpotlightCard scenario={spotlight.data} />;
  }

  return (
    <StudioSection
      id="spotlight"
      title="Demo spotlight"
      about="The scenario marked for demos, one press from a call."
    >
      {body}
    </StudioSection>
  );
}
