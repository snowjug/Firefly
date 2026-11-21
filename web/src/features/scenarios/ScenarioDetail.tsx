import type { ReactNode } from 'react';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { ISSUE_TYPE_LABELS } from '#shared/domain/vocab.ts';
import { situationParagraphs } from './labels.ts';
import { Persona } from './Persona.tsx';
import './detail.css';

export interface ScenarioDetailProps {
  scenario: PublicScenarioDTO;
  /** The call stage chosen for the call: what the trainee is told depends on it. */
  stage: PublicScenarioDTO['callStage'];
  /** Leave the title out where the surrounding dialog already shows it. */
  showTitle?: boolean;
  titleId?: string;
}

/**
 * The scenario as the trainee may know it: who is calling, what they are told, their goal and the
 * ground rules. Nothing hidden from the trainee in the real call is in the public scenario at all.
 */
export function ScenarioDetail({
  scenario,
  stage,
  showTitle = true,
  titleId,
}: ScenarioDetailProps) {
  const told = situationParagraphs(scenario, stage);
  return (
    <div className="scn-detail">
      <header className="scn-detail__head">
        <p className="scn-detail__kicker">{ISSUE_TYPE_LABELS[scenario.issueType]}</p>
        {showTitle ? (
          <h2 className="scn-detail__title" id={titleId}>
            {scenario.title}
          </h2>
        ) : null}
        <Persona persona={scenario.persona} />
        <p className="scn-detail__summary">{scenario.summary}</p>
      </header>
      <DetailSection title="What you are told">
        {told.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </DetailSection>
      <DetailSection title="Your goal">
        <p>{scenario.brief.goal}</p>
      </DetailSection>
      {scenario.brief.groundRules.length > 0 ? (
        <DetailSection title="Ground rules">
          <ul className="scn-detail__rules" role="list">
            {scenario.brief.groundRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </DetailSection>
      ) : null}
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="scn-detail__section">
      <h3 className="scn-detail__heading">{title}</h3>
      <div className="scn-detail__body">{children}</div>
    </div>
  );
}
