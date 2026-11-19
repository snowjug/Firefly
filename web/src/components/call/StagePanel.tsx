import { memo, useEffect, useState } from 'react';
import type { PublicStateDTO, SessionDTO } from '#shared/domain/api.ts';
import { IMPACT_LABELS } from '#shared/domain/vocab.ts';
import { play } from '../../lib/sound.ts';
import { Icon } from '../Icon.tsx';
import { CustomerAvatar } from '../illustration/index.ts';
import { MoodDot, MoodMeter } from './MoodMeter.tsx';

/**
 * A brief "signal found" acknowledgement. It never says what was found. `quiet` keeps it to the
 * sound and the screen reader (on a narrow screen the marker beside the reply is the visible cue).
 */
function SignalFound({ discoveries, quiet = false }: { discoveries: number; quiet?: boolean }) {
  const [seen, setSeen] = useState(discoveries);
  const [showing, setShowing] = useState(false);

  // Derived during render: a new discovery arrived since the last time we looked.
  if (seen !== discoveries) {
    setSeen(discoveries);
    if (discoveries > seen) setShowing(true);
  }

  useEffect(() => {
    if (!showing) return;
    play('discovery');
    const timer = window.setTimeout(() => setShowing(false), 2800);
    return () => window.clearTimeout(timer);
  }, [showing, discoveries]);

  // The region is always there, so a screen reader notices when its text appears.
  return (
    <p className={quiet ? 'sr-only' : 'cstage-signal'} role="status">
      {showing ? <>{quiet ? null : <Icon name="spark" size={14} />} Signal found</> : null}
    </p>
  );
}

interface CustomerStageProps {
  session: SessionDTO;
  state: PublicStateDTO;
  /** The customer is composing a reply. */
  typing: boolean;
  /** The customer's voice is playing. */
  speaking: boolean;
  /** The customer's latest message, shown again as a speech bubble. */
  latest: string | null;
  /** How many times a new signal was found since the call was opened. */
  discoveries: number;
  variant: 'panel' | 'strip';
}

/**
 * The customer on the call: a portrait that follows their mood, who they are, how much is at stake
 * and what they said last. Guided practice adds the mood and a count of what has been uncovered.
 * Immersive practice shows no label or meter, and the face stays calm: reading the customer from
 * what they say is the point of it, so nothing about their state may show here.
 */
export const CustomerStage = memo(function CustomerStage({
  session,
  state,
  typing,
  speaking,
  latest,
  discoveries,
  variant,
}: CustomerStageProps) {
  const { persona, config } = session.scenario;
  const guided = config.mode === 'guided';
  const name = persona.name;
  const faceMood = guided ? state.band.id : 'calm';

  if (variant === 'strip') {
    return (
      <section className="cstrip" aria-label={`${name}, the customer`}>
        <div className="cstrip-avatar">
          <CustomerAvatar seed={name} mood={faceMood} speaking={speaking || typing} />
        </div>
        <div className="cstrip-text">
          <p className="cstrip-name">{name}</p>
          <p className="t-meta cstrip-note">{typing ? `${name} is typing…` : persona.role}</p>
        </div>
        {guided ? (
          <span className="chip cstrip-mood" data-band={state.band.id}>
            <MoodDot band={state.band.id} />
            {state.band.label}
          </span>
        ) : null}
        {guided ? <SignalFound discoveries={discoveries} quiet /> : null}
      </section>
    );
  }

  const found = state.discoveredCount;
  return (
    <section
      className="cstage"
      aria-label={`${name}, the customer`}
      data-speaking={speaking || typing ? 'true' : 'false'}
    >
      <div className="cstage-figure">
        <CustomerAvatar
          className="cstage-avatar"
          seed={name}
          mood={faceMood}
          speaking={speaking || typing}
          interactive
        />
        <div className="cstage-caption">
          <p className="cstage-name">{name}</p>
          <p className="cstage-role">
            {persona.role}, {persona.organisation}
          </p>
          <ul role="list" className="cstage-chips">
            <li className="cstage-chip" data-impact={config.impact}>
              <span className="cstage-chip-dot" aria-hidden="true" />
              {IMPACT_LABELS[config.impact].label} impact
            </li>
            {guided ? (
              <li className="cstage-chip" data-band={state.band.id} aria-hidden="true">
                <MoodDot band={state.band.id} />
                {state.band.label}
              </li>
            ) : null}
          </ul>
        </div>
      </div>
      {latest ? (
        <div className="cstage-bubble" aria-hidden="true">
          <p className="cstage-bubble-text">{latest}</p>
        </div>
      ) : null}
      {guided ? (
        <div className="cstage-guide">
          <MoodMeter state={state} />
          <p className="cstage-facts">
            <strong>{found}</strong> {found === 1 ? 'fact' : 'facts'} uncovered so far
          </p>
          <SignalFound discoveries={discoveries} />
        </div>
      ) : null}
    </section>
  );
});
