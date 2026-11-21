import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import {
  ISSUE_TYPE_LABELS,
  START_TEMPERATURE_LABELS,
  type StartTemperature,
} from '#shared/domain/vocab.ts';
import { Badge, StateBadge, TextLink, type CustomerState } from '../../design/index.ts';
import { Band, BandHead } from './Band.tsx';
import { SCENARIO_EXAMPLES } from './scenario-examples.ts';

// A starting mood is drawn as the customer state it begins in. "Anxious" is the amber "Concerned" state.
const MOOD_STATE: Record<StartTemperature, CustomerState> = {
  calm: 'calm',
  anxious: 'concerned',
  frustrated: 'frustrated',
  angry: 'angry',
};

export function ScenarioKinds() {
  return (
    <Band id="scenarios">
      <BandHead
        id="scenarios"
        title="Seven kinds of customer issue"
        intro="Each scenario has a fictional customer, a business impact, a starting mood and details they will only share if you ask."
      />
      <div>
        <div className="lp-kinds-head t-label" aria-hidden="true">
          <span>Kind of issue</span>
          <span>An example scenario</span>
          <span>Difficulty and starting mood</span>
        </div>
        <dl className="lp-kinds">
          {SCENARIO_EXAMPLES.map((example) => {
            const mood = START_TEMPERATURE_LABELS[example.startingTemperature].label;
            return (
              <div key={example.issueType} className="lp-kind">
                <dt className="lp-kind__family">{ISSUE_TYPE_LABELS[example.issueType]}</dt>
                <dd className="lp-kind__title">{example.title}</dd>
                <dd className="lp-kind__meta">
                  <span className="lp-kind__facet">
                    <span className="lp-kind__facet-label">Difficulty</span>
                    <Badge tone="neutral">{DIFFICULTY_PROFILES[example.difficulty].label}</Badge>
                  </span>
                  <span className="lp-kind__facet">
                    <span className="lp-kind__facet-label">Starts</span>
                    <StateBadge state={MOOD_STATE[example.startingTemperature]} label={mood} />
                  </span>
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
      <p className="lp-kinds-more">
        <TextLink to="/scenarios">Browse all scenarios</TextLink>
      </p>
    </Band>
  );
}
