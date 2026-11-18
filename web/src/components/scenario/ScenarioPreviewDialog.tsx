import { useId } from 'react';
import { Link, useNavigate } from 'react-router';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { DIMENSIONS } from '#shared/domain/vocab.ts';
import { saveDraft } from '../../lib/draft.ts';
import { useMediaQuery } from '../../lib/hooks.ts';
import { DifficultyChip } from '../Chips.tsx';
import { Dialog } from '../Dialog.tsx';
import { Icon } from '../Icon.tsx';
import { ScenarioChips } from './ScenarioChips.tsx';
import { briefPath, setupPath } from './paths.ts';

/** The public brief for a scenario, with the two ways to go on. Never shows anything a trainee should not know. */
export function ScenarioPreviewDialog({
  scenario,
  onClose,
}: {
  scenario: PublicScenarioDTO | null;
  onClose(): void;
}) {
  const navigate = useNavigate();
  const asSheet = useMediaQuery('(max-width: 640px)');
  const baseId = useId();
  if (!scenario) return null;

  const section = (name: string) => `${baseId}-${name}`;
  const startWithDefaults = () => {
    saveDraft({ scenarioId: scenario.id, overrides: {} });
    void navigate(briefPath(scenario.id), { viewTransition: true });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={scenario.title}
      description={scenario.summary}
      variant={asSheet ? 'sheet' : 'dialog'}
    >
      <div className="scn-preview">
        <div className="cluster">
          <DifficultyChip difficulty={scenario.difficulty} />
          <span className="chip">
            <Icon name="clock" size={14} /> About {scenario.estimatedMinutes} min
          </span>
        </div>
        <ScenarioChips scenario={scenario} withProficiency label="Starting settings" />

        <section aria-labelledby={section('situation')}>
          <h3 id={section('situation')}>The situation</h3>
          <p>{scenario.brief.situation}</p>
        </section>

        <section aria-labelledby={section('goal')}>
          <h3 id={section('goal')}>Your goal</h3>
          <p>{scenario.brief.goal}</p>
        </section>

        {scenario.brief.groundRules.length > 0 ? (
          <section aria-labelledby={section('rules')}>
            <h3 id={section('rules')}>Ground rules</h3>
            <ul className="scn-list">
              {scenario.brief.groundRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby={section('customer')}>
          <h3 id={section('customer')}>The customer</h3>
          <p>
            <strong>{scenario.persona.name}</strong>, {scenario.persona.role},{' '}
            {scenario.persona.organisation}. A fictional customer.
          </p>
        </section>

        {scenario.expectedDiscoveryAreas.length > 0 ? (
          <section aria-labelledby={section('areas')}>
            <h3 id={section('areas')}>Areas worth exploring</h3>
            <ul className="scn-list">
              {scenario.expectedDiscoveryAreas.map((area) => (
                <li key={area}>{area}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby={section('coaching')}>
          <h3 id={section('coaching')}>Coaching focus</h3>
          <ul className="scn-list">
            {scenario.coachingFocus.map((id) => (
              <li key={id}>
                <strong>{DIMENSIONS[id].label}.</strong> {DIMENSIONS[id].description}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="scn-preview-actions">
        <button type="button" className="btn btn-secondary" onClick={startWithDefaults}>
          Start with defaults
        </button>
        <Link to={setupPath(scenario.id)} className="btn btn-primary" viewTransition>
          Customise and begin <Icon name="arrow-right" size={18} />
        </Link>
      </div>
    </Dialog>
  );
}
