import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { cx, ProgressShimmer, usePageVisible, VisuallyHidden } from '../../design/index.ts';
import type { WaveMode } from './call-model.ts';
import './waveform.css';

// The voice strip, one signal for each thing that can be going on:
//   - a voice that can be measured: the trainee's level while they speak, or the customer's while
//     their voice plays, as moving bars;
//   - a customer voice that cannot be measured (a browser voice): a calm fixed pattern. The level the
//     engine shapes from the words is never drawn as if it were a measurement;
//   - the customer working out a reply: three points that brighten one after another;
//   - speech being turned into text: a shimmer, never a percentage;
//   - nothing: a quiet line, which the bars settle onto when a voice finishes.
// It is drawn as SVG (or three spans) and says nothing to assistive technology except the name of
// the shimmer and of the three points: the status label says the rest in words. It is redrawn at
// most about 15 times a second, only while a voice is moving and the tab is showing, and under
// reduced motion it is a still level meter with no easing and no scrolling.

const BARS = 28;
const BAR_WIDTH = 4;
const BAR_STEP = 10;
const WIDTH = BARS * BAR_STEP;
const SAMPLE_MS = 66;
const POINTS = 3;
/** Each tick the bars keep this fraction of their height: about half a second from loud to the line. */
const SETTLE_KEEP = 0.5;
/** Below this a bar is as low as it goes. */
const SETTLED_BELOW = 0.04;
/** A little lift so that quiet speech still moves the bars. */
const shape = (level: number) => Math.pow(Math.min(1, Math.max(0, level)), 0.7);
/** A swell with its high point in the middle: the same bars every time, because it is not data. */
const CALM = Array.from({ length: BARS }, (_, index) => {
  const place = Math.sin((Math.PI * (index + 0.5)) / BARS);
  return 0.16 + 0.3 * place * place;
});

export interface WaveformProps {
  mode: WaveMode;
  /** The level that matches the mode (the microphone's or the customer's), 0 to 1. */
  level: number;
  /**
   * The level was read from the sound itself. The microphone's always is; the customer's is not when
   * a browser voice speaks, and then the strip draws a calm fixed pattern and not the level.
   */
  measured?: boolean;
  reducedMotion: boolean;
  size?: 'regular' | 'thin';
  /**
   * What the shimmer is called to assistive technology (the status that is showing), and what the
   * three points of a customer working out a reply say. The three points have no name unless one is
   * given: where the status label already says it, a second would only be read twice.
   */
  label?: string;
}

const EMPTY = Array.from({ length: BARS }, () => 0);

export const Waveform = memo(function Waveform({
  mode,
  level,
  measured = true,
  reducedMotion,
  size = 'regular',
  label,
}: WaveformProps) {
  const height = size === 'thin' ? 20 : 40;
  const voice = mode === 'trainee' || mode === 'customer';
  const calm = mode === 'customer' && !measured;
  const showing = usePageVisible();
  const moving = voice && !calm && !reducedMotion && showing;
  const latest = useRef(level);
  const [samples, setSamples] = useState<number[]>(EMPTY);
  const resting = samples.every((sample) => sample === 0);
  // A voice has just finished: its bars are still up, and sink to the quiet line.
  const settling = mode === 'idle' && !resting && !reducedMotion && showing;

  useEffect(() => {
    latest.current = level;
  }, [level]);

  // One new sample about fifteen times a second, and none at all while nothing is moving.
  useEffect(() => {
    if (!moving) return;
    const timer = window.setInterval(() => {
      setSamples((previous) => [...previous.slice(1), shape(latest.current)]);
    }, SAMPLE_MS);
    return () => window.clearInterval(timer);
  }, [moving, mode]);

  // What is left of a voice settles when the strip goes quiet, and is cleared at once when the strip
  // shows anything else, when motion is reduced or while the tab is hidden.
  useEffect(() => {
    if (moving || resting) return;
    if (!settling) {
      setSamples(EMPTY);
      return;
    }
    const timer = window.setInterval(() => {
      setSamples((previous) => {
        const next = previous.map((sample) => (sample < SETTLED_BELOW ? 0 : sample * SETTLE_KEEP));
        return next.every((sample) => sample === 0) ? EMPTY : next;
      });
    }, SAMPLE_MS);
    return () => window.clearInterval(timer);
  }, [moving, resting, settling]);

  const classes = cx(
    'cw-wave',
    `cw-wave--${mode}`,
    calm && 'cw-wave--calm',
    settling && 'cw-wave--settling',
    size === 'thin' && 'cw-wave--thin',
  );
  const draw = (shapeName: string, content: ReactNode) => (
    <svg
      className={classes}
      viewBox={`0 0 ${WIDTH} ${height}`}
      aria-hidden="true"
      focusable="false"
      data-mode={mode}
      data-shape={shapeName}
    >
      {content}
    </svg>
  );
  const bars = (heights: readonly number[]) => {
    const minimum = 3;
    const maximum = height - 2;
    return heights.map((sample, index) => {
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
    });
  };

  if (mode === 'transcribing') {
    return (
      <span className={cx('cw-wave-shimmer', size === 'thin' && 'cw-wave--thin')} data-mode={mode}>
        <ProgressShimmer
          label={label ?? 'Transcribing'}
          size={size === 'thin' ? 'small' : 'medium'}
        />
      </span>
    );
  }

  if (mode === 'thinking') {
    return (
      <span
        className={cx('cw-think', size === 'thin' && 'cw-wave--thin')}
        data-mode={mode}
        data-shape="points"
      >
        <span className="cw-think__points" aria-hidden="true">
          {Array.from({ length: POINTS }, (_, index) => (
            <span key={index} className="cw-think__dot" />
          ))}
        </span>
        {label ? <VisuallyHidden>{label}</VisuallyHidden> : null}
      </span>
    );
  }

  if (calm) return draw('pattern', bars(CALM));

  if (voice && reducedMotion) {
    const filled = Math.round(shape(level) * WIDTH);
    const bar = size === 'thin' ? 6 : 10;
    const y = (height - bar) / 2;
    return draw(
      'meter',
      <>
        <rect className="cw-wave__track" x={0} y={y} width={WIDTH} height={bar} rx={bar / 2} />
        <rect className="cw-wave__bar" x={0} y={y} width={filled} height={bar} rx={bar / 2} />
      </>,
    );
  }

  if (mode === 'idle' && !settling) {
    return draw(
      'line',
      <rect className="cw-wave__base" x={0} y={height / 2 - 1} width={WIDTH} height={2} rx={1} />,
    );
  }

  // A moving voice, or one that is settling. The first moments, before any sample has arrived,
  // show the quiet line's bars.
  return draw('bars', bars(samples));
});
