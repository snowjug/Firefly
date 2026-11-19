import { memo, useId } from 'react';
import { Link } from 'react-router';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import type { ScenarioPractice } from '#shared/domain/recommend.ts';
import {
  IMPACT_LABELS,
  ISSUE_TYPE_LABELS,
  START_TEMPERATURE_LABELS,
} from '#shared/domain/vocab.ts';
import { DifficultyChip } from '../Chips.tsx';
import { Icon } from '../Icon.tsx';
import { TemperatureOrb } from '../TemperatureOrb.tsx';
import { IssueIcon } from '../ui/IssueIcon.tsx';
import { setupPath } from './paths.ts';
import { practiceText } from './practice-text.ts';
import { temperatureBandFor } from './setup-model.ts';

interface ScenarioCardProps {
  scenario: PublicScenarioDTO;
  /** What has happened with this scenario. Leave out when it is not known. */
  practice?: ScenarioPractice;
  /** Set on the one suggested next: why it is suggested. */
  recommendedReason?: string;
  /** Say "Not tried yet" for a scenario with no history (only once the history has loaded). */
  showPractice?: boolean;
}

/** One scenario in the library: enough to choose by. The Start link opens its setup page. */
export const ScenarioCard = memo(function ScenarioCard({
  scenario,
  practice,
  recommendedReason,
  showPractice = false,
}: ScenarioCardProps) {
  const titleId = useId();
  return (
    <article
      className="glass card card-interactive lib-card"
      data-recommended={recommendedReason ? 'true' : undefined}
      aria-labelledby={titleId}
    >
      <div className="lib-card-top">
        <IssueIcon issue={scenario.issueType} />
        <div className="lib-card-head">
          {recommendedReason || scenario.spotlight ? (
            <p className="lib-card-flags">
              {recommendedReason ? (
                <span className="chip chip-accent">
                  <Icon name="spark" size={14} /> Recommended next
                </span>
              ) : null}
              {scenario.spotlight ? <span className="chip chip-violet">Demo spotlight</span> : null}
            </p>
          ) : null}
          <h2 id={titleId} className="lib-card-title">
            {scenario.title}
          </h2>
          <p className="lib-card-issue">{ISSUE_TYPE_LABELS[scenario.issueType]}</p>
        </div>
      </div>

      <p className="lib-card-summary">{scenario.summary}</p>

      <ul role="list" className="cluster lib-card-chips" aria-label="Scenario settings">
        <li>
          <DifficultyChip difficulty={scenario.difficulty} />
        </li>
        <li className="chip">{IMPACT_LABELS[scenario.impact].label} impact</li>
        <li className="chip">
          <TemperatureOrb band={temperatureBandFor(scenario.startingTemperature)} />
          Starts {START_TEMPERATURE_LABELS[scenario.startingTemperature].label.toLowerCase()}
        </li>
      </ul>

      <p className="lib-card-meta">
        <span>
          <Icon name="clock" size={14} /> About {scenario.estimatedMinutes} minutes
        </span>
        {showPractice ? (
          <span data-practice={practice?.state ?? 'new'}>
            <span className="lib-practice-dot" aria-hidden="true" />
            {practiceText(practice)}
          </span>
        ) : null}
      </p>

      {recommendedReason ? (
        <p className="lib-card-reason">
          <strong>Why:</strong> {recommendedReason}
        </p>
      ) : null}

      <div className="lib-card-foot">
        <Link
          to={setupPath(scenario.id)}
          className="btn btn-primary lib-card-link"
          viewTransition
          aria-label={`Start ${scenario.title}`}
        >
          Start <Icon name="arrow-right" size={18} />
        </Link>
      </div>
    </article>
  );
});
