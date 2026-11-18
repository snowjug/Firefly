import { Link } from 'react-router';
import type { CoachingReport } from '#shared/domain/report.ts';
import { CURVEBALL_LABELS } from '#shared/domain/vocab.ts';
import { Icon } from '../Icon.tsx';
import { TemperatureTimeline } from './TemperatureTimeline.tsx';
import { CURVEBALL_STATUS } from './labels.ts';

export function JourneySection({
  journey,
  turnHref,
}: {
  journey: CoachingReport['journey'];
  turnHref: (turn: number) => string;
}) {
  return (
    <section id="mood" className="rp-section" aria-labelledby="mood-title">
      <div className="rp-section-head">
        <h2 id="mood-title" className="t-section">
          Customer temperature
        </h2>
        <p className="rp-lead">
          How the customer&rsquo;s mood moved through the call, and what moved it. Turning points
          link back to the exact turn in your transcript.
        </p>
      </div>
      <div className="surface rp-card rp-timeline-card">
        <TemperatureTimeline points={journey.points} turnHref={turnHref} />
      </div>
    </section>
  );
}

export function CurveballSection({
  curveball,
  turnHref,
}: {
  curveball: NonNullable<CoachingReport['curveball']>;
  turnHref: (turn: number) => string;
}) {
  const label = CURVEBALL_LABELS[curveball.type];
  const status = CURVEBALL_STATUS[curveball.status];
  return (
    <section id="curveball" className="rp-section" aria-labelledby="curveball-title">
      <div className="rp-section-head">
        <h2 id="curveball-title" className="t-section">
          Curveball
        </h2>
        <p className="rp-lead">
          A curveball is an unexpected turn the customer takes mid-call. It is part of the practice,
          not a mistake.
        </p>
      </div>
      <article className="surface rp-card rp-curve" aria-labelledby="curveball-type">
        <header className="rp-curve-head">
          <span className="rp-tone-icon rp-tone-caution" aria-hidden="true">
            <Icon name="flag" size={18} />
          </span>
          <div className="grow">
            <h3 id="curveball-type" className="rp-moment-title">
              {label.label}
            </h3>
            <p className="t-small t-muted">{label.description}</p>
          </div>
          <span className={`chip chip-${status.tone}`}>
            <span className="sr-only">Outcome: </span>
            {status.label}
          </span>
        </header>
        <p className="t-small">
          Came up after turn {curveball.firedAtTurn}.{' '}
          <Link to={turnHref(curveball.firedAtTurn)} viewTransition>
            View turn {curveball.firedAtTurn} in the transcript
          </Link>
        </p>
        <div>
          <p className="t-label">How it went</p>
          <p>{curveball.assessment}</p>
        </div>
      </article>
    </section>
  );
}
