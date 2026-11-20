import { memo } from 'react';
import type { SessionDTO } from '#shared/domain/api.ts';
import { TEMPERATURE_BANDS } from '#shared/domain/vocab.ts';
import { Icon } from '../Icon.tsx';
import type { Atmosphere } from './atmosphere.ts';
import { PRESENCE_POOL, SignalPresence } from './signal-bridge.tsx';

const TREND_WORDS: Record<Atmosphere['trend'], string> = {
  rising: 'rising',
  steady: 'steady',
  falling: 'easing',
};

interface PresenceRailProps {
  persona: SessionDTO['scenario']['persona'];
  atmosphere: Atmosphere;
  /** Guided practice: the cues are shown. Immersive practice shows none. */
  guided: boolean;
  /** How many signals have been found so far. Never shown as a share of a total. */
  found: number;
  /** How many times the conversation has shifted (guided practice only; 0 otherwise). */
  shifts: number;
  /** A signal was found a moment ago: say so, once. */
  announceFound: boolean;
  /** The customer is composing a reply, or their voice is playing. */
  speaking: boolean;
  /** The call is being ended: the presence closes and the room quiets. */
  ending: boolean;
  size: number;
  soundOn: boolean;
  onSound(on: boolean): void;
  onOpenDetails(): void;
  onEnd(): void;
}

/**
 * The customer's side of the room: the presence that breathes with how they are, their name set
 * large, and the few things a person may want to do without leaving the conversation. Guided
 * practice adds the mood in a word and how many signals have been found; immersive practice adds
 * nothing, and says so.
 */
export const PresenceRail = memo(function PresenceRail({
  persona,
  atmosphere,
  guided,
  found,
  shifts,
  announceFound,
  speaking,
  ending,
  size,
  soundOn,
  onSound,
  onOpenDetails,
  onEnd,
}: PresenceRailProps) {
  const level = Math.max(
    0,
    TEMPERATURE_BANDS.findIndex((band) => band.id === atmosphere.mood),
  );
  const pool = Math.max(PRESENCE_POOL, found + 2);
  return (
    <aside className="ch-rail" aria-label={`${persona.name}, the customer`}>
      <div className="ch-rail__presence" data-closing={ending || undefined} aria-hidden="true">
        <SignalPresence
          atmosphere={atmosphere}
          discovered={guided ? found : 0}
          pool={pool}
          shifts={guided ? shifts : 0}
          typing={speaking}
          size={size}
        />
      </div>
      <div className="ch-rail__who">
        <h1 className="ch-rail__name">{persona.name}</h1>
        <p className="ch-rail__role">
          {persona.role}, {persona.organisation}
        </p>
      </div>

      {guided ? (
        <div
          className="ch-mood"
          data-trend={atmosphere.trend}
          data-silent={atmosphere.silent || undefined}
        >
          <p className="ch-eyebrow">Customer mood</p>
          <p className="ch-mood__word">
            <span className="ch-trend" aria-hidden="true" />
            <span>
              {atmosphere.label}, {TREND_WORDS[atmosphere.trend]}
            </span>
          </p>
          <span
            className="ch-scale"
            aria-hidden="true"
            style={{ ['--level' as string]: level / 4 }}
          >
            <i />
            <i />
            <i />
            <i />
            <i />
            <b className="ch-scale__pip" />
          </span>
        </div>
      ) : (
        <p className="ch-mood ch-mood--off">{atmosphere.status}</p>
      )}

      {guided ? (
        <div className="ch-signals">
          <p className="ch-signals__line">
            <span className="ch-signals__dots" aria-hidden="true">
              {Array.from({ length: PRESENCE_POOL }, (_, i) => (
                <i key={i} data-lit={i < found || undefined} />
              ))}
            </span>
            <span>
              <strong>{found}</strong> {found === 1 ? 'signal' : 'signals'} found
            </span>
          </p>
          <p className="ch-found glass glass--signal" role="status">
            {announceFound ? 'Signal found' : ''}
          </p>
        </div>
      ) : null}

      <div className="ch-rail__tools">
        <button type="button" className="ch-end" onClick={onEnd}>
          <Icon name="phone" size={16} />
          End call
        </button>
        <button
          type="button"
          className="ch-tool"
          aria-pressed={soundOn}
          onClick={() => onSound(!soundOn)}
          title={soundOn ? 'Sound effects are on' : 'Sound effects are off'}
        >
          <Icon name={soundOn ? 'volume' : 'volume-off'} size={16} />
          Sound effects
        </button>
        <button type="button" className="ch-tool" onClick={onOpenDetails} aria-label="Call details">
          <Icon name="info" size={16} />
          Details
        </button>
      </div>
    </aside>
  );
});
