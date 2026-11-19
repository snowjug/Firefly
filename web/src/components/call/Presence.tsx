import { useEffect, useState } from 'react';
import type { PublicStateDTO, SessionDTO } from '#shared/domain/api.ts';
import { play } from '../../lib/sound.ts';
import { FireflyCore } from '../core/FireflyCore.tsx';

const MAX_SIGNALS = 8;
const OPEN_ENDED = 2; // always leave a couple of dormant signals: more may remain, and we never say how many

/** What the Firefly Core shows for this call. Immersive practice shows nothing about the customer's state. */
export function presenceFor(session: SessionDTO, state: PublicStateDTO) {
  const guided = session.scenario.config.mode === 'guided';
  const found = state.discoveredCount;
  return {
    guided,
    found,
    mood: guided ? state.band.id : ('neutral' as const),
    tone: guided && state.trend !== 'steady' ? state.trend : ('steady' as const),
    signals: guided ? { total: Math.min(MAX_SIGNALS, found + OPEN_ENDED), lit: found } : null,
  };
}

/** A brief "signal found" acknowledgement. It never says what was found. */
function SignalFound({ discoveries, guided }: { discoveries: number; guided: boolean }) {
  const [seen, setSeen] = useState(discoveries);
  const [showing, setShowing] = useState(false);

  // Derived during render: a new discovery arrived since the last time we looked.
  if (seen !== discoveries) {
    setSeen(discoveries);
    if (guided && discoveries > seen) setShowing(true);
  }

  useEffect(() => {
    if (!showing) return;
    play('discovery');
    const timer = window.setTimeout(() => setShowing(false), 2800);
    return () => window.clearTimeout(timer);
  }, [showing, discoveries]);

  if (!showing) return null;
  return (
    <p className="signal-found" role="status">
      <span className="signal-found-dot" aria-hidden="true" />
      Signal found
    </p>
  );
}

interface PresenceProps {
  session: SessionDTO;
  state: PublicStateDTO;
  /** The customer is composing a reply. */
  pending: boolean;
  replies: number;
  discoveries: number;
  variant?: 'panel' | 'strip';
}

/**
 * The customer-presence region of the live call. It holds the Firefly Core and, in guided practice
 * only, dormant and lit signal points. The points carry no content and no total.
 */
export function Presence({
  session,
  state,
  pending,
  replies,
  discoveries,
  variant = 'panel',
}: PresenceProps) {
  const { persona } = session.scenario;
  const view = presenceFor(session, state);
  const strip = variant === 'strip';
  return (
    <section
      className={strip ? 'presence presence-strip' : 'presence'}
      aria-label={`${persona.name}, the customer`}
    >
      <div className="presence-core">
        <FireflyCore
          mood={view.mood}
          tone={view.tone}
          signals={view.signals}
          pulseKey={replies}
          discoveryKey={discoveries}
          thinking={pending}
          quality={strip ? 'low' : 'full'}
        />
      </div>
      {strip ? (
        <div className="presence-text">
          <p className="presence-name">{persona.name}</p>
          <p className="t-meta presence-note">
            {pending ? `${persona.name} is replying` : persona.role}
          </p>
        </div>
      ) : (
        <p className="presence-line t-meta" aria-live="off">
          {pending ? `${persona.name} is replying…` : 'On the line'}
        </p>
      )}
      {view.guided ? (
        <div className="presence-signals">
          <ul className="signal-row" aria-hidden="true">
            {Array.from({ length: Math.min(MAX_SIGNALS, view.found + OPEN_ENDED) }, (_, i) => (
              <li key={i} className="signal-dot" data-lit={i < view.found} />
            ))}
          </ul>
          <SignalFound discoveries={discoveries} guided={view.guided} />
        </div>
      ) : null}
    </section>
  );
}
