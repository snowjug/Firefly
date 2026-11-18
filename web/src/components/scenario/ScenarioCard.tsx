import { memo, useId } from 'react';
import { Link } from 'react-router';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { DIMENSIONS } from '#shared/domain/vocab.ts';
import { DifficultyChip } from '../Chips.tsx';
import { Icon } from '../Icon.tsx';
import { ScenarioChips } from './ScenarioChips.tsx';
import { setupPath } from './paths.ts';

interface ScenarioCardProps {
  scenario: PublicScenarioDTO;
  onPreview(scenario: PublicScenarioDTO): void;
}

/** One scenario in the library: enough to choose by, with the full brief a click away. */
export const ScenarioCard = memo(function ScenarioCard({ scenario, onPreview }: ScenarioCardProps) {
  const titleId = useId();
  const { persona } = scenario;
  return (
    <article
      className="glass card scn-card card-interactive"
      data-spotlight={scenario.spotlight ? 'true' : undefined}
      aria-labelledby={titleId}
    >
      {scenario.spotlight ? (
        <p className="scn-spotlight">
          <span className="chip chip-accent">
            <Icon name="spark" size={14} /> Demo spotlight
          </span>
        </p>
      ) : null}
      <div className="scn-card-top">
        <DifficultyChip difficulty={scenario.difficulty} />
        <span className="scn-minutes t-meta">
          <Icon name="clock" size={14} />
          <span>About {scenario.estimatedMinutes} min</span>
        </span>
      </div>

      <h2 id={titleId} className="scn-card-title">
        {scenario.title}
      </h2>
      <p className="scn-card-summary">{scenario.summary}</p>

      <p className="scn-persona">
        <Icon name="user" size={16} />
        <span>
          <strong>{persona.name}</strong>, {persona.role}, {persona.organisation}
        </span>
      </p>

      <ScenarioChips scenario={scenario} />

      <p className="scn-focus">
        <span className="scn-focus-label">Coaching focus</span>{' '}
        {scenario.coachingFocus.map((id) => DIMENSIONS[id].short).join(' \u00b7 ')}
      </p>

      <div className="scn-card-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onPreview(scenario)}
          aria-label={`Preview ${scenario.title}`}
        >
          Preview
        </button>
        <Link
          to={setupPath(scenario.id)}
          className="btn btn-primary"
          viewTransition
          aria-label={`Set up call: ${scenario.title}`}
        >
          Set up call <Icon name="arrow-right" size={18} />
        </Link>
      </div>
    </article>
  );
});
