import { memo } from 'react';
import { WAVE_BARS, waveScales } from './preview-script.ts';

const BAR = 3;
const GAP = 4;
const HEIGHT = 32;
const STEP = BAR + GAP;
const WIDTH = WAVE_BARS * STEP - GAP;

/**
 * The customer's waveform: a row of bars that rise and fall with `level`, drawn from the script and
 * never from a microphone. Each bar is a full-height rectangle squeezed with a transform, so nothing
 * but transform moves. It is decorative and hidden from assistive technology.
 */
export const Waveform = memo(function Waveform({ t, level }: { t: number; level: number }) {
  const scales = waveScales(t, level);
  return (
    <svg
      className="lp-wave"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      aria-hidden="true"
      focusable="false"
    >
      {scales.map((scale, index) => (
        <rect
          key={index}
          className="lp-wave__bar"
          x={index * STEP}
          y={0}
          width={BAR}
          height={HEIGHT}
          rx={BAR / 2}
          style={{ transform: `scaleY(${scale})` }}
        />
      ))}
    </svg>
  );
});
