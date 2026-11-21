import { useId, type ReactNode } from 'react';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import {
  CALL_STAGE_LABELS,
  IMPACT_LABELS,
  ISSUE_TYPE_LABELS,
  PROFICIENCY_LABELS,
  START_TEMPERATURE_LABELS,
  STYLE_LABELS,
} from '#shared/domain/vocab.ts';
import { StateBadge, Surface } from '../../design/index.ts';
import { complicationsPhrase, hintsOn, type CallConfig } from './config-params.ts';
import { START_STATE, minutesLabel, situationParagraphs } from './labels.ts';
import { Persona } from './Persona.tsx';
import './brief-document.css';

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="brf-row">
      <dt className="brf-row__term">{term}</dt>
      <dd className="brf-row__value">{children}</dd>
    </div>
  );
}

/** A name for the value, then a sentence about it. */
function Described({ name, children }: { name: ReactNode; children: ReactNode }) {
  return (
    <div className="brf-row__pair">
      <p className="brf-row__name">{name}</p>
      <p>{children}</p>
    </div>
  );
}

export interface BriefDocumentProps {
  scenario: PublicScenarioDTO;
  config: CallConfig;
}

/**
 * The support-case briefing: everything the trainee is allowed to know before the call, laid out as
 * labelled rows. It never holds what the customer keeps back, how many things that is, what an
 * unexpected turn will be, or anything about how the call is scored.
 */
export function BriefDocument({ scenario, config }: BriefDocumentProps) {
  const titleId = useId();
  const hints = hintsOn(config);
  const impact = IMPACT_LABELS[config.impact];
  const stage = CALL_STAGE_LABELS[config.stage];
  const mood = START_TEMPERATURE_LABELS[config.temperature];
  const style = STYLE_LABELS[config.style];
  const proficiency = PROFICIENCY_LABELS[config.proficiency];
  const profile = DIFFICULTY_PROFILES[config.difficulty];
  const complications = complicationsPhrase(config) !== null;

  return (
    <Surface
      as="section"
      appearance="outlined"
      padding="none"
      className="brf-case"
      aria-labelledby={titleId}
    >
      <header className="brf-case__head">
        <h2 className="brf-case__title" id={titleId}>
          Support case
        </h2>
        <p className="brf-case__note">
          Everything you are allowed to know before the call. The customer shares important details
          only when you ask relevant questions.
        </p>
      </header>
      <dl className="brf-case__list">
        <Row term="Customer">
          <Persona persona={scenario.persona} />
        </Row>
        <Row term="Issue summary">
          <p>{scenario.summary}</p>
          <p className="brf-row__meta">{ISSUE_TYPE_LABELS[scenario.issueType]}</p>
        </Row>
        <Row term="Situation">
          {situationParagraphs(scenario, config.stage).map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </Row>
        <Row term="Business impact">
          <Described name={impact.label}>{impact.description}</Described>
        </Row>
        <Row term="Call stage">
          <Described name={stage.label}>{stage.description}</Described>
        </Row>
        <Row term="Customer's starting state">
          <Described
            name={<StateBadge state={START_STATE[config.temperature]} label={mood.label} />}
          >
            {mood.description}
          </Described>
        </Row>
        <Row term="How the customer communicates">
          <Described name={style.label}>{style.description}</Described>
          <Described name={`${proficiency.label} technical proficiency`}>
            {proficiency.description}
          </Described>
        </Row>
        <Row term="Your objective">
          <p>{scenario.brief.goal}</p>
        </Row>
        {scenario.brief.groundRules.length > 0 ? (
          <Row term="Ground rules">
            <ul className="brf-row__list" role="list">
              {scenario.brief.groundRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </Row>
        ) : null}
        <Row term="Difficulty">
          <Described name={profile.label}>{profile.summary}</Described>
        </Row>
        <Row term="Expected duration">
          <p>{minutesLabel(scenario.estimatedMinutes, true)}</p>
        </Row>
        <Row term="Live hints">
          <Described name={hints ? 'On' : 'Off'}>
            {hints
              ? "Light cues are shown during the call: the customer's mood trend and how much context you have found."
              : 'No cues are shown during the call, so it feels like a real one.'}
          </Described>
        </Row>
        <Row term="Complications">
          <p>
            {complications
              ? 'This call may include an unexpected turn.'
              : 'No complications are set.'}
          </p>
        </Row>
        {hints && scenario.expectedDiscoveryAreas.length > 0 ? (
          <Row term="Areas worth exploring">
            <ul className="brf-row__list" role="list">
              {scenario.expectedDiscoveryAreas.map((area) => (
                <li key={area}>{area}</li>
              ))}
            </ul>
          </Row>
        ) : null}
      </dl>
    </Surface>
  );
}
