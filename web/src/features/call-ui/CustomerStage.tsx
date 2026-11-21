import { memo } from 'react';
import {
  Avatar,
  CUSTOMER_STATE_ICONS,
  cx,
  Icon,
  StatusBadge,
  Tag,
  VisuallyHidden,
} from '../../design/index.ts';
import type { CallStatus, CustomerStateView } from './call-model.ts';
import { Waveform } from './Waveform.tsx';
import './stage.css';

export interface CustomerStageProps {
  name: string;
  role: string;
  organisation: string;
  /** The customer's voice is playing: a ring on the initials. */
  speaking: boolean;
  state: CustomerStateView | null;
  status: CallStatus;
  /** The id the controls point at, so a disabled control is described by the state. */
  statusId: string;
  micLevel: number;
  customerLevel: number;
  reducedMotion: boolean;
  /** One row for a narrow screen: the initials, the name and the state side by side. */
  compact: boolean;
}

/**
 * The customer and the call as it is now: synthetic initials (never a photograph), their name,
 * role and organisation, how they feel, the status in words and the waveform. The status label
 * changes in place and is not a live region: the call's announcer says each change once.
 */
export const CustomerStage = memo(function CustomerStage({
  name,
  role,
  organisation,
  speaking,
  state,
  status,
  statusId,
  micLevel,
  customerLevel,
  reducedMotion,
  compact,
}: CustomerStageProps) {
  const level =
    status.wave === 'trainee' ? micLevel : status.wave === 'customer' ? customerLevel : 0;
  return (
    <div className={cx('cw-person', compact && 'cw-person--compact')}>
      <div className="cw-person__card">
        <Avatar
          name={name}
          size={compact ? 'md' : 'xl'}
          speaking={speaking}
          voice="customer"
          className="cw-person__avatar"
        />
        <div className="cw-person__id">
          <p className="cw-person__name">{name}</p>
          <p className="cw-person__role">
            {role}, {organisation}
          </p>
        </div>
      </div>
      <div className="cw-person__meta">
        <Tag size="small">Synthetic customer</Tag>
        {state ? (
          <span className="cw-mood" data-tone={state.tone} role="group" aria-label="Customer state">
            <StatusBadge
              label={state.label}
              tone={state.tone}
              icon={CUSTOMER_STATE_ICONS[state.tone]}
            />
            <span className="cw-mood__trend">
              <Icon name={state.trendIcon} size={16} />
              <span>
                <VisuallyHidden>Trend: </VisuallyHidden>
                {state.trendWord}
              </span>
            </span>
          </span>
        ) : null}
      </div>
      <div className="cw-status" data-status={status.id} data-who={status.who}>
        <p className="cw-status__line" id={statusId}>
          <Icon name={status.icon} size={20} className="cw-status__icon" />
          <span key={status.id} className="cw-status__label">
            {status.label}
          </span>
        </p>
        <Waveform
          mode={status.wave}
          level={level}
          reducedMotion={reducedMotion}
          size={compact ? 'thin' : 'regular'}
          label={status.label}
        />
      </div>
    </div>
  );
});
