import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { START_TEMPERATURE_LABELS } from '#shared/domain/vocab.ts';
import { Icon, LinkButton, StateBadge, Tag } from '../../design/index.ts';
import { briefPath, type CallConfig } from './config-params.ts';
import { START_STATE, difficultyLabel, impactLabel, minutesLabel } from './labels.ts';
import './summary-bar.css';

export interface SummaryBarProps {
  scenario: PublicScenarioDTO;
  config: CallConfig;
}

/**
 * What is about to be started, in a line of chips, with how long it takes and the way on. It sits
 * at the bottom of the pane (or the phone sheet), so the next step is always in view. The setup
 * above says the rest, so the bar keeps to the three choices that shape the call most.
 */
export function SummaryBar({ scenario, config }: SummaryBarProps) {
  return (
    <div className="scn-summary">
      <div className="scn-summary__grid">
        <ul className="scn-summary__chips" role="list" aria-label="Your choices">
          <li>
            <Tag>{difficultyLabel(config.difficulty)}</Tag>
          </li>
          <li>
            <Tag>{impactLabel(config.impact)}</Tag>
          </li>
          <li>
            <StateBadge
              state={START_STATE[config.temperature]}
              label={START_TEMPERATURE_LABELS[config.temperature].label}
            />
          </li>
        </ul>
        <p className="scn-summary__time">
          <Icon name="clock" size={16} />
          {minutesLabel(scenario.estimatedMinutes)}
        </p>
        <LinkButton
          className="scn-summary__action"
          to={briefPath(scenario.id, config, scenario)}
          appearance="primary"
          icon="arrow-right"
          iconPosition="end"
        >
          Continue to call brief
        </LinkButton>
      </div>
    </div>
  );
}
