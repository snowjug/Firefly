import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import {
  CALL_STAGES,
  DIFFICULTIES,
  IMPACTS,
  PROFICIENCIES,
  START_TEMPERATURES,
  STYLES,
} from '#shared/domain/vocab.ts';
import { useEffect, useMemo, useState } from 'react';
import { coreParams } from '../components/atlas/core-params.ts';
import { defaultChoices, type SetupChoices } from '../components/scenario/setup-model.ts';
import { CoreLegend } from '../components/signal/CoreLegend.tsx';
import { SignalCore } from '../components/signal/SignalCore.tsx';
import type { CoreTraits, GlyphStatus } from '../components/signal/types.ts';
import { api } from '../lib/api.ts';

const STATUSES: GlyphStatus[] = ['new', 'attempted', 'completed'];

const PRESET_CHOICES: Record<string, Partial<SetupChoices>> = {
  starter: { impact: 'low', startingTemperature: 'calm', difficulty: 'starter' },
  standard: { impact: 'medium', startingTemperature: 'anxious', difficulty: 'standard' },
  challenge: { impact: 'high', startingTemperature: 'angry', difficulty: 'challenge' },
};

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

function CoreLab({ scenario }: { scenario: PublicScenarioDTO }) {
  const base = useMemo(() => defaultChoices(scenario), [scenario]);
  const [overrides, setOverrides] = useState<Partial<SetupChoices>>({});
  const [status, setStatus] = useState<GlyphStatus>('new');
  const [minutes, setMinutes] = useState(scenario.estimatedMinutes);
  const [size, setSize] = useState(() => Math.min(460, Math.max(240, window.innerWidth - 56)));
  const [quiet, setQuiet] = useState(false);
  const [settled, setSettled] = useState(0);
  const [replay, setReplay] = useState(0);

  const choices: SetupChoices = useMemo(() => ({ ...base, ...overrides }), [base, overrides]);
  const params = useMemo(() => coreParams(choices), [choices]);
  const traits: CoreTraits = {
    difficulty: choices.difficulty,
    impact: choices.impact,
    start: choices.startingTemperature,
    stage: choices.callStage,
    status,
    minutes,
  };
  const set = (patch: Partial<SetupChoices>) =>
    setOverrides((current) => ({ ...current, ...patch }));

  return (
    <div className="gal-presence">
      <div className="gal-stage gal-stage--big">
        <SignalCore
          key={replay}
          traits={traits}
          params={params}
          size={size}
          quiet={quiet}
          onSettled={() => setSettled((n) => n + 1)}
        />
      </div>
      <div className="gal-panel">
        <div className="gal-row" role="group" aria-label="Presets">
          {Object.entries(PRESET_CHOICES).map(([name, patch]) => (
            <button key={name} type="button" className="gal-btn" onClick={() => set(patch)}>
              {name}
            </button>
          ))}
          <button type="button" className="gal-btn" onClick={() => setOverrides({})}>
            as written
          </button>
        </div>
        <Seg
          label="Impact"
          value={choices.impact}
          options={IMPACTS}
          onChange={(impact) => set({ impact })}
        />
        <Seg
          label="Customer temperature"
          value={choices.startingTemperature}
          options={START_TEMPERATURES}
          onChange={(startingTemperature) => set({ startingTemperature })}
        />
        <Seg
          label="Difficulty"
          value={choices.difficulty}
          options={DIFFICULTIES}
          onChange={(difficulty) => set({ difficulty })}
        />
        <Seg
          label="Proficiency"
          value={choices.proficiency}
          options={PROFICIENCIES}
          onChange={(proficiency) => set({ proficiency })}
        />
        <Seg
          label="Style"
          value={choices.style}
          options={STYLES}
          onChange={(style) => set({ style })}
        />
        <Seg
          label="Call stage"
          value={choices.callStage}
          options={CALL_STAGES}
          onChange={(callStage) => set({ callStage })}
        />
        <Seg
          label="Curveballs"
          value={choices.curveballMode === 'none' ? 'off' : 'on'}
          options={['on', 'off'] as const}
          onChange={(value) => set({ curveballMode: value === 'off' ? 'none' : 'recommended' })}
        />
        <Seg label="Status" value={status} options={STATUSES} onChange={setStatus} />
        <label className="gal-ctl">
          <span className="gal-ctl__label">Minutes {minutes}</span>
          <input
            type="range"
            min={1}
            max={15}
            value={minutes}
            onChange={(event) => setMinutes(Number(event.target.value))}
          />
        </label>
        <label className="gal-ctl">
          <span className="gal-ctl__label">Size {size}px</span>
          <input
            type="range"
            min={240}
            max={640}
            step={10}
            value={size}
            onChange={(event) => setSize(Number(event.target.value))}
          />
        </label>
        <div className="gal-row">
          <button
            type="button"
            className="gal-btn"
            aria-pressed={quiet}
            onClick={() => setQuiet((v) => !v)}
          >
            Quiet
          </button>
          <button type="button" className="gal-btn" onClick={() => setReplay((n) => n + 1)}>
            Replay entrance
          </button>
        </div>
        <p className="gal-readout" role="status">
          Settled {settled} times.
        </p>
        <CoreLegend traits={traits} params={params} />
      </div>
    </div>
  );
}

export function CoreSection() {
  const [scenarios, setScenarios] = useState<PublicScenarioDTO[] | null>(null);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api
      .scenarios(controller.signal)
      .then(setScenarios)
      .catch(() => {
        if (!controller.signal.aborted) setScenarios([]);
      });
    return () => controller.abort();
  }, []);
  const scenario = scenarios?.[index];
  return (
    <section id="core" aria-labelledby="core-h" className="gal-section">
      <h2 id="core-h" className="gal-h">
        Core
      </h2>
      <p className="gal-note">
        The calibration instrument. Every setting turns a part of it: pressure lights the band, the
        starting temperature sets the edge and the needle, the difficulty adds rings and dormant
        dots. Proficiency engraves a finer graticule, the style makes the edge busier and curveballs
        let the rings sit off the heart. Changes glide on a spring; with reduced motion they are
        instant.
      </p>
      {scenarios && scenarios.length > 1 ? (
        <label className="gal-ctl">
          <span className="gal-ctl__label">Mission</span>
          <select value={index} onChange={(event) => setIndex(Number(event.target.value))}>
            {scenarios.map((entry, i) => (
              <option key={entry.id} value={i}>
                {entry.title}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {scenario ? (
        <CoreLab key={scenario.id} scenario={scenario} />
      ) : (
        <p className="gal-note">Loading.</p>
      )}
    </section>
  );
}
