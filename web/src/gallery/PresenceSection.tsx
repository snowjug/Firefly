import { TEMPERATURE_BANDS, type TemperatureBandId } from '#shared/domain/vocab.ts';
import { useMemo, useState } from 'react';
import { atmosphereFor } from '../components/call/atmosphere.ts';
import { SignalPresence } from '../components/signal/SignalPresence.tsx';

type Mood = TemperatureBandId | 'neutral';
type Trend = 'rising' | 'steady' | 'falling';

const MOODS: Mood[] = ['calm', 'concerned', 'frustrated', 'angry', 'escalating', 'neutral'];
const TRENDS: Trend[] = ['steady', 'rising', 'falling'];
const POOL = 7;

function useAtmosphere(
  mood: Mood,
  trend: Trend,
  silent: boolean,
  discovered: number,
  shifts: number,
) {
  return useMemo(() => {
    const band = TEMPERATURE_BANDS.find((entry) => entry.id === mood) ?? TEMPERATURE_BANDS[0];
    return atmosphereFor(
      {
        band: { id: band.id, label: band.label },
        trend,
        discoveredCount: discovered,
        silent,
        shifts,
      },
      mood === 'neutral' ? 'none' : 'full',
    );
  }, [mood, trend, silent, discovered, shifts]);
}

function Seg<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (next: T) => void;
}) {
  return (
    <div className="gal-ctl">
      <span className="gal-ctl__label">{label}</span>
      <div role="radiogroup" aria-label={label} className="gal-seg">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PresenceSection() {
  const [mood, setMood] = useState<Mood>('calm');
  const [trend, setTrend] = useState<Trend>('steady');
  const [discovered, setDiscovered] = useState(0);
  const [shifts, setShifts] = useState(0);
  const [typing, setTyping] = useState(false);
  const [silent, setSilent] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [size, setSize] = useState(() => Math.min(340, Math.max(160, window.innerWidth - 80)));
  const atmosphere = useAtmosphere(mood, trend, silent, discovered, shifts);

  return (
    <section id="presence" aria-labelledby="presence-h" className="gal-section">
      <h2 id="presence-h" className="gal-h">
        Presence
      </h2>
      <p className="gal-note">
        The customer in the room. Mood sets how compressed, uneven and broken the rings are and the
        texture of the edge (smooth, round dashes, long and short dashes, serrated). A falling trend
        is recovery: rings widen, fragments rejoin, cool returns. Cues off is a neutral ring.
      </p>
      <div className="gal-presence">
        <div className="gal-stage gal-stage--big">
          <SignalPresence
            atmosphere={atmosphere}
            discovered={discovered}
            pool={POOL}
            shifts={shifts}
            typing={typing}
            frozen={frozen}
            size={size}
          />
        </div>
        <div className="gal-panel">
          <Seg label="Mood" value={mood} options={MOODS} onChange={setMood} />
          <Seg label="Trend" value={trend} options={TRENDS} onChange={setTrend} />
          <div className="gal-row">
            <button
              type="button"
              className="gal-btn"
              onClick={() => setDiscovered((n) => Math.min(POOL, n + 1))}
            >
              Discover a signal
            </button>
            <button type="button" className="gal-btn" onClick={() => setDiscovered(0)}>
              Reset signals
            </button>
            <button type="button" className="gal-btn" onClick={() => setShifts((n) => n + 1)}>
              Curveball
            </button>
          </div>
          <div className="gal-row">
            <button
              type="button"
              className="gal-btn"
              aria-pressed={typing}
              onClick={() => setTyping((v) => !v)}
            >
              Typing
            </button>
            <button
              type="button"
              className="gal-btn"
              aria-pressed={silent}
              onClick={() => setSilent((v) => !v)}
            >
              Silent
            </button>
            <button
              type="button"
              className="gal-btn"
              aria-pressed={frozen}
              onClick={() => setFrozen((v) => !v)}
            >
              Frozen
            </button>
          </div>
          <label className="gal-ctl">
            <span className="gal-ctl__label">Size {size}px</span>
            <input
              type="range"
              min={48}
              max={460}
              step={4}
              value={size}
              onChange={(event) => setSize(Number(event.target.value))}
            />
          </label>
          <p className="gal-readout" role="status">
            {atmosphere.status} Signals found {discovered}. Shifts {shifts}.
          </p>
        </div>
      </div>

      <h3 className="gal-sub">Every mood, frozen (steady, then easing)</h3>
      <ul className="gal-grid gal-grid--wide" aria-label="Moods">
        {MOODS.flatMap((entry) =>
          (entry === 'neutral' ? (['steady'] as Trend[]) : (['steady', 'falling'] as Trend[])).map(
            (entryTrend) => (
              <MoodCell key={`${entry}-${entryTrend}`} mood={entry} trend={entryTrend} />
            ),
          ),
        )}
      </ul>

      <h3 className="gal-sub">Sizes (frustrated, two signals found)</h3>
      <div className="gal-sizes__row">
        {[48, 64, 96, 160, 240].map((px) => (
          <FrozenAt key={px} size={px} />
        ))}
      </div>
    </section>
  );
}

function MoodCell({ mood, trend }: { mood: Mood; trend: Trend }) {
  const atmosphere = useAtmosphere(mood, trend, false, 0, 0);
  return (
    <li className="gal-cell">
      <SignalPresence atmosphere={atmosphere} discovered={0} shifts={0} frozen size={180} />
      <span className="gal-cell__cap">
        <b>{mood}</b>
        {trend === 'steady' ? '' : ', easing'}
      </span>
    </li>
  );
}

function FrozenAt({ size }: { size: number }) {
  const atmosphere = useAtmosphere('frustrated', 'steady', false, 2, 0);
  return <SignalPresence atmosphere={atmosphere} discovered={2} shifts={0} frozen size={size} />;
}
