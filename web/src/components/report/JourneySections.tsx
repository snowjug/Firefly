import { useId } from 'react';
import { Link } from 'react-router';
import type { CoachingReport } from '#shared/domain/report.ts';
import { CURVEBALL_LABELS } from '#shared/domain/vocab.ts';
import { Icon } from '../Icon.tsx';
import { Section, Tag, type TagTone } from './bridge.tsx';
import { journeyDiscoveries } from './journey-model.ts';
import { CURVEBALL_STATUS } from './labels.ts';
import { TemperatureTimeline } from './TemperatureTimeline.tsx';

/** How the customer's mood moved: the filament, with the signals found along it. */
export function JourneySection({
  journey,
  discovery,
  eyebrow,
  turnHref,
}: {
  journey: CoachingReport['journey'];
  discovery: CoachingReport['discovery'];
  eyebrow?: string;
  turnHref: (turn: number) => string;
}) {
  return (
    <Section id="mood" eyebrow={eyebrow} title="Customer temperature">
      <p className="rp-lead">
        How the customer&rsquo;s mood moved through the call, and what moved it. Turning points link
        back to the exact turn in your transcript.
      </p>
      <TemperatureTimeline
        points={journey.points}
        turnHref={turnHref}
        discoveries={journeyDiscoveries(discovery.results)}
        facts={discovery.total}
      />
    </Section>
  );
}

const STATUS_TONE: Record<'positive' | 'caution' | 'info', TagTone> = {
  positive: 'sage',
  caution: 'coral',
  info: 'aqua',
};

export function CurveballSection({
  curveball,
  eyebrow,
  turnHref,
}: {
  curveball: NonNullable<CoachingReport['curveball']>;
  eyebrow?: string;
  turnHref: (turn: number) => string;
}) {
  const titleId = useId();
  const label = CURVEBALL_LABELS[curveball.type];
  const status = CURVEBALL_STATUS[curveball.status];
  return (
    <Section id="curveball" eyebrow={eyebrow} title="Curveball">
      <p className="rp-lead">
        A curveball is an unexpected turn the customer takes mid-call. It is part of the practice,
        not a mistake.
      </p>
      <article className="rp-curve" aria-labelledby={titleId}>
        <header className="rp-curve__head">
          <div>
            <h3 id={titleId} className="rp-curve__title">
              {label.label}
            </h3>
            <p className="rp-curve__what">{label.description}</p>
          </div>
          <p className="rp-curve__status">
            <span className="sr-only">Outcome: </span>
            <Tag tone={STATUS_TONE[status.tone]}>{status.label}</Tag>
          </p>
        </header>
        <p className="rp-curve__where">
          Came up after turn {curveball.firedAtTurn}.{' '}
          <Link to={turnHref(curveball.firedAtTurn)} className="text-link" viewTransition>
            View turn {curveball.firedAtTurn} in the transcript
            <Icon name="arrow-right" size={14} />
          </Link>
        </p>
        {curveball.assessment.trim() ? (
          <div className="rp-why">
            <p className="type-label">How it went</p>
            <p>{curveball.assessment}</p>
          </div>
        ) : null}
      </article>
    </Section>
  );
}
