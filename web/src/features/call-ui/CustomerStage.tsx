import { memo, useState } from 'react';
import {
  CUSTOMER_STATE_ICONS,
  cx,
  Icon,
  StatusBadge,
  Tag,
  VisuallyHidden,
} from '../../design/index.ts';
import type { CallStatePoint } from '../call/contract.ts';
import {
  describePresence,
  type CallStatus,
  type Caption,
  type CustomerStateView,
} from './call-model.ts';
import { Captions } from './Captions.tsx';
import { Crossfade } from './Crossfade.tsx';
import { Presence } from './Presence.tsx';
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
  /**
   * What the caption strip says now, or null between turns. Left out where there is no strip (a
   * narrow screen, where the transcript is beside it and shows the same words).
   */
  caption?: Caption | null;
}

/** How many times a value has changed since the screen first drew it: 0 until it does. */
function useChanges(value: string): number {
  const [seen, setSeen] = useState({ value, changes: 0 });
  if (seen.value !== value) setSeen({ value, changes: seen.changes + 1 });
  return seen.changes;
}

/**
 * The customer and the call as it is now: synthetic initials (never a photograph) in a ring that
 * shows what the call is doing, their name, role and organisation, how they feel, the status in
 * words, the waveform and, where there is room, live captions. The ring and the captions are drawn
 * for the eye and say nothing to assistive technology: the status label is the words for every
 * state. It changes in place and is not a live region: the call's announcer says each change once.
 * How they feel crossfades when it changes, with one soft pulse round it, and shows no number.
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
  caption,
}: CustomerStageProps) {
  const level =
    status.wave === 'trainee' ? micLevel : status.wave === 'customer' ? customerLevel : 0;
  const presence = describePresence(status.id);
  const moodChanges = useChanges(state?.tone ?? '');
  return (
    <div className={cx('cw-person', compact && 'cw-person--compact')}>
      <div className="cw-person__card">
        <Presence
          name={name}
          mode={presence}
          level={level}
          measured={presence === 'speaking' ? customerLevelMeasured : true}
          speaking={speaking}
          size={compact ? 'md' : 'xl'}
          reducedMotion={reducedMotion}
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
            <span className="cw-mood__chip">
              {/* One soft pulse round the state when it changes, and never when it stays the same. */}
              {moodChanges > 0 ? (
                <span key={moodChanges} className="cw-mood__cue" aria-hidden="true" />
              ) : null}
              <Crossfade id={`${state.tone}:${state.label}`}>
                <StatusBadge
                  label={state.label}
                  tone={state.tone}
                  icon={CUSTOMER_STATE_ICONS[state.tone]}
                />
              </Crossfade>
            </span>
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
      {caption === undefined ? null : <Captions caption={caption} customerName={name} />}
    </div>
  );
});
