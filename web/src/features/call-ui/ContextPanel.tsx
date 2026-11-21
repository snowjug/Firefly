import { memo, type ReactNode } from 'react';
import type { SessionDTO } from '#shared/domain/api.ts';
import {
  CALL_STAGE_LABELS,
  IMPACT_LABELS,
  START_TEMPERATURE_LABELS,
} from '#shared/domain/vocab.ts';
import { DIFFICULTY_NAMES, providerDescription } from './call-model.ts';
import './context.css';

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="cw-ctx__item">
      <dt className="cw-ctx__label">{label}</dt>
      <dd className="cw-ctx__value">{children}</dd>
    </div>
  );
}

function Described({ label, description }: { label: string; description: string }) {
  return (
    <>
      <strong className="cw-ctx__strong">{label}</strong>
      <span className="cw-ctx__detail">{description}</span>
    </>
  );
}

export interface ContextBodyProps {
  session: SessionDTO;
  provider: { demo: boolean; label: string };
}

/**
 * Everything the trainee was told about this call, so it can be read again while it happens:
 * the situation, the objective, the ground rules and how the call was set up. Nothing in it is
 * hidden from the trainee, and nothing in it is something they were not told before the call.
 * Guided practice adds the areas worth exploring, which standard calls never show.
 */
export const ContextBody = memo(function ContextBody({ session, provider }: ContextBodyProps) {
  const { scenario } = session;
  const { config, persona, brief } = scenario;
  const guided = config.mode === 'guided';
  const impact = IMPACT_LABELS[config.impact];
  const stage = CALL_STAGE_LABELS[config.callStage];
  const start = START_TEMPERATURE_LABELS[config.startingTemperature];
  return (
    <dl className="cw-ctx">
      <Item label="Scenario">{scenario.title}</Item>
      <Item label="Customer">
        <strong className="cw-ctx__strong">{persona.name}</strong>
        <span className="cw-ctx__detail">
          {persona.role}, {persona.organisation}
        </span>
      </Item>
      <Item label="The situation">{brief.situation}</Item>
      <Item label="Your objective">{brief.goal}</Item>
      <Item label="Business impact">
        <Described label={impact.label} description={impact.description} />
      </Item>
      <Item label="Call stage">
        <Described label={stage.label} description={stage.description} />
      </Item>
      <Item label="Customer's starting state">
        <Described label={start.label} description={start.description} />
      </Item>
      <Item label="Difficulty">{DIFFICULTY_NAMES[config.difficulty]}</Item>
      <Item label="AI customer">{providerDescription(provider)}</Item>
      <Item label="Ground rules">
        <ul className="cw-ctx__list">
          {brief.groundRules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </Item>
      <Item label="Live hints">
        <Described
          label={guided ? 'On' : 'Off'}
          description={
            guided
              ? 'Guided practice shows light cues during the call.'
              : 'This is a standard call, so no hints are shown while you talk.'
          }
        />
      </Item>
      {guided ? (
        <Item label="Areas worth exploring">
          <ul className="cw-ctx__list">
            {scenario.expectedDiscoveryAreas.map((area) => (
              <li key={area}>{area}</li>
            ))}
          </ul>
        </Item>
      ) : null}
    </dl>
  );
});

export interface ContextPanelProps extends ContextBodyProps {
  titleId: string;
}

/**
 * The context column on wide screens. Narrow screens show the same body in the details sheet. The
 * column scrolls on its own and holds only text, so the scrolling area is the focusable, named
 * region: a keyboard user can scroll it, and it is the one landmark with this name.
 */
export const ContextPanel = memo(function ContextPanel({
  session,
  provider,
  titleId,
}: ContextPanelProps) {
  return (
    <section className="cw-context">
      <h2 className="cw-context__title" id={titleId}>
        Call context
      </h2>
      <div className="cw-context__scroll" role="region" aria-labelledby={titleId} tabIndex={0}>
        <ContextBody session={session} provider={provider} />
      </div>
    </section>
  );
});
