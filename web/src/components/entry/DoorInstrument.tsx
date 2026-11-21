import { useEffect, useState } from 'react';
import type { CoreParams } from '../atlas/core-params.ts';
import { SignalCore } from '../signal/SignalCore.tsx';
import type { CoreTraits } from '../signal/types.ts';
import { useIgnition } from './ignition.ts';
import { useFittedSize } from './useFittedSize.ts';

// An example call, drawn as the instrument: a Standard call that matters to a team, a customer who
// starts anxious, a follow-up. Nothing here is anyone's data; it is only what the object looks like.
const TRAITS: CoreTraits = {
  difficulty: 'standard',
  impact: 'medium',
  start: 'anxious',
  stage: 'follow-up',
  status: 'new',
  minutes: 10,
};

const RESTING: CoreParams = {
  pressure: 0.55,
  stability: 0.65,
  density: 0.6,
  rhythm: 0.5,
  horizon: 0.5,
  complexity: 0.55,
  disturbance: 0.45,
};

// Where it starts while it is being lit: no pressure, a steady customer, one ring.
const UNLIT: CoreParams = {
  pressure: 0,
  stability: 0.9,
  density: 0.3,
  rhythm: 0.5,
  horizon: 0.5,
  complexity: 0.25,
  disturbance: 0,
};

const LABEL =
  'The Firefly signal instrument, drawn for an example Standard call: two rings, a lit band, a dashed edge and a diamond at the heart.';

/**
 * The instrument alone in the field. On the first visit on a device it is engraved and then turned
 * up to its resting settings by the core's own spring (see `useIgnition`); on every other visit,
 * and with reduced motion, it is simply there. It breathes very slowly, and that stops with the
 * ambient pause.
 */
export function DoorInstrument() {
  const { playing, skipped } = useIgnition();
  const [lit, setLit] = useState(false);
  const [box, size] = useFittedSize<HTMLDivElement>(240, 600);

  useEffect(() => {
    if (!playing) return;
    // The instrument starts unlit and is turned up a moment after the first frame.
    let timer = 0;
    const frame = requestAnimationFrame(() => {
      timer = window.setTimeout(() => setLit(true), 140);
    });
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [playing]);

  return (
    <div
      className="door-instrument"
      data-ignition={playing ? 'playing' : 'rest'}
      data-no-enter={playing ? undefined : ''}
    >
      <div className="door-instrument__box" ref={box} data-ambient="">
        <span className="door-instrument__bloom" aria-hidden="true" />
        {/* A skipped introduction starts the instrument again, already at rest. */}
        <SignalCore
          key={skipped ? 'skipped' : 'live'}
          traits={TRAITS}
          params={playing && !lit ? UNLIT : RESTING}
          size={size}
          label={LABEL}
        />
      </div>
    </div>
  );
}
