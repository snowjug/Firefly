import { Link } from 'react-router';
import type { MissionRecommendation } from '#shared/domain/recommend.ts';
import { DifficultyChip } from '../Chips.tsx';
import { Icon } from '../Icon.tsx';
import { briefPath, setupPath } from '../scenario/paths.ts';
import { ScenarioChips } from '../scenario/ScenarioChips.tsx';
import { temperatureBandFor } from '../scenario/setup-model.ts';

const HEADINGS: Record<MissionRecommendation['kind'], string> = {
  'first-call': 'Your first mission',
  'build-skill': 'Recommended next mission',
  'step-up': 'Recommended next mission',
  'ease-back': 'Recommended next mission',
  'new-ground': 'Recommended next mission',
  revisit: 'Recommended next mission',
};

/**
 * One clear next step, with the evidence behind it. The node shows how the customer starts: the
 * ring takes the colour of their temperature, and the label says it in words as well.
 */
export function NextMission({ recommendation }: { recommendation: MissionRecommendation }) {
  const { scenario, kind, reason } = recommendation;
  return (
    <section className="nm" aria-labelledby="nm-title">
      <div
        className="nm-node"
        aria-hidden="true"
        data-band={temperatureBandFor(scenario.startingTemperature)}
      >
        <span className="nm-node-core" />
      </div>
      <div className="nm-body">
        <p className="t-label">{HEADINGS[kind]}</p>
        <h2 id="nm-title" className="nm-title">
          {scenario.title}
        </h2>
        <p className="nm-who t-small t-muted">
          {scenario.persona.name}, {scenario.persona.role}, {scenario.persona.organisation}
        </p>
        <p className="nm-reason">{reason}</p>
        <div className="cluster nm-chips">
          <DifficultyChip difficulty={scenario.difficulty} />
          <span className="chip">About {scenario.estimatedMinutes} min</span>
        </div>
        <ScenarioChips scenario={scenario} label="How this customer starts" />
        <div className="cluster nm-actions">
          <Link to={setupPath(scenario.id)} className="btn btn-primary btn-lg" viewTransition>
            Set up this call <Icon name="arrow-right" size={18} />
          </Link>
          <Link to={briefPath(scenario.id)} className="btn btn-secondary">
            Start with its defaults
          </Link>
        </div>
      </div>
    </section>
  );
}
