import { useId } from 'react';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { DIMENSIONS, ISSUE_TYPE_LABELS } from '#shared/domain/vocab.ts';
import { DifficultyChip } from '../Chips.tsx';
import { Icon } from '../Icon.tsx';
import { CustomerAvatar } from '../illustration/index.ts';
import { ProviderBadge } from '../ProviderBadge.tsx';
import { ProviderNote } from './ProviderNote.tsx';
import { ScenarioChips } from './ScenarioChips.tsx';
import { temperatureBandFor, type SetupChoices } from './setup-model.ts';

interface ScenarioPreviewProps {
  scenario: PublicScenarioDTO;
  /** What the call will use. The customer's expression and the chips follow it. */
  choices: SetupChoices;
  /** True when any setting differs from the scenario as written. */
  customised: boolean;
}

/**
 * Everything a trainee may know before the call: who is calling, why, what the goal is, what the
 * call practises and the ground rules, with the honest reminders. It is built only from the public
 * scenario, so nothing the customer holds back can appear here.
 */
export function ScenarioPreview({ scenario, choices, customised }: ScenarioPreviewProps) {
  const titleId = useId();
  const { persona, brief } = scenario;
  const call: PublicScenarioDTO = {
    ...scenario,
    impact: choices.impact,
    startingTemperature: choices.startingTemperature,
    style: choices.style,
    proficiency: choices.proficiency,
    callStage: choices.callStage,
    difficulty: choices.difficulty,
  };

  return (
    <aside className="glass card stp-preview" aria-labelledby={titleId}>
      <header className="stp-pv-head">
        <p className="t-label">Scenario preview</p>
        <h2 id={titleId} className="stp-pv-title">
          {scenario.title}
        </h2>
        <p className="stp-pv-issue">{ISSUE_TYPE_LABELS[scenario.issueType]}</p>
        <div className="cluster">
          <DifficultyChip difficulty={choices.difficulty} />
          <span className="chip">
            <Icon name="clock" size={14} /> About {scenario.estimatedMinutes} minutes
          </span>
        </div>
      </header>

      <div className="stp-pv-persona">
        <span className="stp-avatar">
          <CustomerAvatar
            seed={persona.name}
            mood={temperatureBandFor(choices.startingTemperature)}
          />
        </span>
        <div className="stp-pv-who">
          <p className="stp-pv-name">{persona.name}</p>
          <p className="stp-pv-role">
            {persona.role}, {persona.organisation}
          </p>
          <p className="stp-pv-fictional">
            <Icon name="shield" size={14} /> A fictional customer
          </p>
        </div>
      </div>
      <ScenarioChips scenario={call} withProficiency label="This call" />

      <div className="stp-pv-section">
        <h3>The situation</h3>
        <p>{brief.situation}</p>
        {customised ? (
          <p className="hint">
            This describes the scenario as written. The settings you changed apply to how the
            customer behaves on the call.
          </p>
        ) : null}
      </div>

      <div className="stp-pv-section">
        <h3>Your goal</h3>
        <p>{brief.goal}</p>
      </div>

      <div className="stp-pv-section">
        <h3>What you will practise</h3>
        <ul role="list" className="cluster">
          {scenario.coachingFocus.map((dimension) => (
            <li key={dimension} className="chip chip-accent">
              {DIMENSIONS[dimension].label}
            </li>
          ))}
        </ul>
      </div>

      {brief.groundRules.length > 0 ? (
        <div className="stp-pv-section">
          <h3>Ground rules</h3>
          <ul className="stp-list">
            {brief.groundRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="callout stp-reminders">
        <Icon name="shield" size={20} />
        <div className="stp-reminders-body">
          <h3>Before you begin</h3>
          <ul className="stp-list">
            <li>
              The customer is fictional. Never type real customer names, case details or
              credentials.
            </li>
            <li>You can end the call at any time.</li>
            <li>Feedback afterwards is coaching for practice, not a performance assessment.</li>
          </ul>
          <div className="stp-provider">
            <ProviderBadge />
            <ProviderNote />
          </div>
        </div>
      </div>
    </aside>
  );
}
