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
import type { CallStatePoint } from '../call/contract.ts';
import type { CallStatus, CustomerStateView } from './call-model.ts';
import { Crossfade } from './Crossfade.tsx';
import { StateTrace } from './StateTrace.tsx';
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
  /** The customer's level was measured from the sound that plays, not shaped from the words. */
  customerLevelMeasured?: boolean;
  reducedMotion: boolean;
  /** One row for a narrow screen: the initials, the name and the state side by side. */
  compact: boolean;
  /**
   * The customer's state after each exchange, for the thin trace under their state. Left out
   * (null) everywhere but guided practice; a narrow screen has no room for it.
   */
  trace?: readonly CallStatePoint[] | null;
}

/**
 * The customer and the call as it is now: synthetic initials (never a photograph), their name,
 * role and organisation, how they feel, the status in words and the waveform. The status label
 * changes in place and is not a live region: the call's announcer says each change once. How they
 * feel crossfades when it changes, and shows no number.
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
  customerLevelMeasured = false,
  reducedMotion,
  compact,
  trace = null,
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
            <Crossfade id={`${state.tone}:${state.label}`}>
              <StatusBadge
                label={state.label}
                tone={state.tone}
                icon={CUSTOMER_STATE_ICONS[state.tone]}
              />
            </Crossfade>
            <span className="cw-mood__trend">
              <Icon name={state.trendIcon} size={16} />
              <span>
                <VisuallyHidden>Trend: </VisuallyHidden>
                <span className="cw-mood__word">{state.trendWord}</span>
              </span>
            </span>
          </span>
        ) : null}
      </div>
      {trace && !compact ? (
        <div className="cw-trail">
          {/* The line has a name you can see; a screen reader has the line's own words instead. */}
          {trace.length > 0 ? (
            <span className="cw-trail__label" aria-hidden="true">
              State so far
            </span>
          ) : null}
          <StateTrace history={trace} tone={state?.tone ?? null} />
        </div>
      ) : null}
      <div className="cw-status" data-status={status.id} data-who={status.who}>
        <p className="cw-status__line" id={statusId}>
          {/* The three points beside the label are the cue while the customer works out a reply: an icon too would say it twice. */}
          {status.wave === 'thinking' ? null : (
            <Icon name={status.icon} size={20} className="cw-status__icon" />
          )}
          <span key={status.id} className="cw-status__label">
            {status.label}
          </span>
        </p>
        <Waveform
          mode={status.wave}
          level={level}
          measured={status.wave === 'customer' ? customerLevelMeasured : true}
          reducedMotion={reducedMotion}
          size={compact ? 'thin' : 'regular'}
          label={status.wave === 'thinking' ? (status.signal ?? undefined) : status.label}
        />
      </div>
    </div>
  );
});
