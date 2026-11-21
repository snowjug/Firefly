import { Icon } from '../../design/icons.tsx';
import { Avatar } from '../../design/primitives/Avatar.tsx';
import { StateBadge } from '../../design/primitives/Badge.tsx';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import {
  LEVEL_LABELS,
  LEVEL_STEPS,
  type CustomerPreview as Preview,
  type Level,
} from './customer-preview.ts';

function Meter({ label, level }: { label: string; level: Level }) {
  return (
    <div className="scn-meter">
      <dt className="scn-meter__label">{label}</dt>
      <dd className="scn-meter__value">
        <span className="scn-meter__bars" data-steps={LEVEL_STEPS[level]} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="scn-swap" key={level}>
          {LEVEL_LABELS[level]}
        </span>
      </dd>
    </div>
  );
}

export interface CustomerPreviewProps {
  persona: PublicScenarioDTO['persona'];
  preview: Preview;
}

/**
 * The customer as the call will start, built from the engine's own starting state: who they are
 * (made up), their mood and how patient and trusting they begin. It moves when the difficulty, the
 * mood or the call stage changes. It never says what the customer knows or keeps back.
 */
export function CustomerPreview({ persona, preview }: CustomerPreviewProps) {
  return (
    <div className="scn-cust">
      <Avatar name={persona.name} size="lg" />
      <div className="scn-cust__body">
        <p className="scn-cust__name">{persona.name}</p>
        <p className="scn-cust__role">
          {persona.role}, {persona.organisation}
        </p>
        <p className="scn-cust__note">
          <Icon name="person" size={14} />
          Synthetic customer
        </p>
      </div>
      <div className="scn-cust__state">
        <span className="scn-swap" key={preview.mood}>
          <StateBadge state={preview.state} label={preview.mood} />
        </span>
        <dl className="scn-cust__levels">
          <Meter label="Patience" level={preview.patience} />
          <Meter label="Trust" level={preview.trust} />
        </dl>
      </div>
    </div>
  );
}
