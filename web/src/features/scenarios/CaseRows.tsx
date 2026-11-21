import { useId, type ReactNode } from 'react';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { CALL_STAGE_LABELS, ISSUE_TYPE_LABELS, type BusinessImpact } from '#shared/domain/vocab.ts';
import { Avatar } from '../../design/primitives/Avatar.tsx';
import { Badge, type BadgeTone } from '../../design/primitives/Badge.tsx';
import { Disclosure } from '../../design/primitives/Disclosure.tsx';
import type { CallConfig } from './config-params.ts';
import { impactLabel, productLine } from './labels.ts';

const IMPACT_TONES: Record<BusinessImpact, BadgeTone> = {
  low: 'neutral',
  medium: 'warning',
  high: 'danger',
};

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="brf-row">
      <dt className="brf-row__term">{term}</dt>
      <dd className="brf-row__value">{children}</dd>
    </div>
  );
}

export interface CaseRowsProps {
  scenario: PublicScenarioDTO;
  config: CallConfig;
}

/**
 * The support case as the trainee may know it: six short rows, then three optional details that
 * open on request. Everything comes from the scenario's public brief (which never holds a hidden
 * fact) and the settings chosen for the call; the impact is the sentence for the chosen level.
 */
export function CaseRows({ scenario, config }: CaseRowsProps) {
  const titleId = useId();
  const { persona, product } = scenario;
  const brief = scenario.publicBrief;
  // There is nothing to say about an earlier contact on a first call.
  const previous = config.stage === 'first-contact' ? undefined : brief.previousContact;
  const caseNumber = config.stage === 'first-contact' ? null : scenario.caseReference;
  return (
    <section className="brf-case" aria-labelledby={titleId}>
      <h2 className="visually-hidden" id={titleId}>
        Support case
      </h2>
      <dl className="brf-rows">
        <Row term="Customer">
          <span className="brf-person">
            <Avatar name={persona.name} size="md" />
            <span>
              <strong>{persona.name}</strong>
              <span className="brf-sub">
                {persona.role}, {persona.organisation}
              </span>
            </span>
          </span>
          <span className="brf-sub">Synthetic customer</span>
        </Row>
        <Row term="Product">{productLine(product)}</Row>
        <Row term="Issue">
          {brief.issue}
          <span className="brf-sub">{ISSUE_TYPE_LABELS[scenario.issueType]}</span>
        </Row>
        <Row term="Impact">
          <span className="brf-impact">
            <Badge tone={IMPACT_TONES[config.impact]} icon={null}>
              {impactLabel(config.impact)}
            </Badge>
            <span>{brief.impact[config.impact]}</span>
          </span>
        </Row>
        <Row term="Call stage">
          {CALL_STAGE_LABELS[config.stage].label}
          {caseNumber ? <span className="brf-sub">Case {caseNumber}</span> : null}
        </Row>
        <Row term="Objective">{brief.objective}</Row>
      </dl>
      {brief.knownContext || previous || brief.environment ? (
        <div className="brf-more">
          {brief.knownContext ? (
            <Disclosure summary="Known context" headingLevel={3}>
              <p className="brf-detail">{brief.knownContext}</p>
            </Disclosure>
          ) : null}
          {previous ? (
            <Disclosure summary="Previous contact" headingLevel={3}>
              <p className="brf-detail">{previous}</p>
            </Disclosure>
          ) : null}
          {brief.environment ? (
            <Disclosure summary="Environment" headingLevel={3}>
              <p className="brf-detail">{brief.environment}</p>
            </Disclosure>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
