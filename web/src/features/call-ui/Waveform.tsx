import { memo, useEffect, useRef, useState } from 'react';
import { cx } from '../../design/index.ts';
import type { WaveMode } from './call-model.ts';
import './waveform.css';

// The voice strip: the trainee's level while they speak, the customer's while their voice plays, a
// quiet line when nothing is happening and dots while something is being worked out. It is drawn as
// SVG and describes nothing to assistive technology (the status line says it in words). It is
// redrawn at most about 15 times a second, only while a voice is moving, and under reduced motion it
// is a still level meter with no easing and no scrolling.

const BARS = 28;
const BAR_WIDTH = 4;
const BAR_STEP = 10;
const WIDTH = BARS * BAR_STEP;
const SAMPLE_MS = 66;
const DOTS = 14;
/** A little lift so that quiet speech still moves the bars. */
const shape = (level: number) => Math.pow(Math.min(1, Math.max(0, level)), 0.7);

export interface WaveformProps {
  mode: WaveMode;
  /** The level that matches the mode (the microphone's or the customer's), 0 to 1. */
  level: number;
  reducedMotion: boolean;
  size?: 'regular' | 'thin';
}

const EMPTY = Array.from({ length: BARS }, () => 0);

export const Waveform = memo(function Waveform({
  mode,
  level,
  reducedMotion,
  size = 'regular',
}: WaveformProps) {
  const height = size === 'thin' ? 20 : 40;
  const moving = (mode === 'trainee' || mode === 'customer') && !reducedMotion;
  const latest = useRef(level);
  const [samples, setSamples] = useState<number[]>(EMPTY);

  useEffect(() => {
    latest.current = level;
  }, [level]);

  // One new sample about fifteen times a second, and none at all while nothing is moving.
  useEffect(() => {
    if (!moving) return;
    const timer = window.setInterval(() => {
      setSamples((previous) => [...previous.slice(1), shape(latest.current)]);
    }, SAMPLE_MS);
    return () => {
      window.clearInterval(timer);
      setSamples(EMPTY);
    };
  }, [moving, mode]);

  const viewBox = `0 0 ${WIDTH} ${height}`;
  const classes = cx('cw-wave', `cw-wave--${mode}`, size === 'thin' && 'cw-wave--thin');

  if ((mode === 'trainee' || mode === 'customer') && reducedMotion) {
    const filled = Math.round(shape(level) * WIDTH);
    const bar = size === 'thin' ? 6 : 10;
    const y = (height - bar) / 2;
    return (
      <svg
        className={classes}
        viewBox={viewBox}
        aria-hidden="true"
        focusable="false"
        data-mode={mode}
        data-shape="meter"
      >
        <rect className="cw-wave__track" x={0} y={y} width={WIDTH} height={bar} rx={bar / 2} />
        <rect className="cw-wave__bar" x={0} y={y} width={filled} height={bar} rx={bar / 2} />
      </svg>
    );
  }

  if (mode === 'transcribing' || mode === 'thinking') {
    const step = WIDTH / DOTS;
    return (
      <svg
        className={classes}
        viewBox={viewBox}
        aria-hidden="true"
        focusable="false"
        data-mode={mode}
        data-shape="dots"
      >
        {Array.from({ length: DOTS }, (_, index) => (
          <circle
            key={index}
            className="cw-wave__dot"
            cx={step * index + step / 2}
            cy={height / 2}
            r={size === 'thin' ? 2 : 2.75}
          />
        ))}
      </svg>
    );
  }

  if (mode === 'idle') {
    return (
      <svg
        className={classes}
        viewBox={viewBox}
        aria-hidden="true"
        focusable="false"
        data-mode={mode}
        data-shape="line"
      >
        <rect className="cw-wave__base" x={0} y={height / 2 - 1} width={WIDTH} height={2} rx={1} />
      </svg>
    );
  }

  // A moving voice. The first moments, before any sample has arrived, show the quiet line's bars.
  const minimum = 3;
  const maximum = height - 2;
  return (
    <svg
      className={classes}
      viewBox={viewBox}
      aria-hidden="true"
      focusable="false"
      data-mode={mode}
      data-shape="bars"
    >
      {samples.map((sample, index) => {
        const bar = minimum + sample * (maximum - minimum);
        return (
          <rect
            key={index}
            className="cw-wave__bar"
            x={index * BAR_STEP + (BAR_STEP - BAR_WIDTH) / 2}
            y={(height - bar) / 2}
            width={BAR_WIDTH}
            height={bar}
            rx={BAR_WIDTH / 2}
          />
        );
      })}
    </svg>
  );
});
