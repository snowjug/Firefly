import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { usePerfTier } from '../../lib/PerfTierProvider.tsx';
import type { CoreParams } from '../atlas/core-params.ts';
import { useReducedMotion } from '../../lib/theme.tsx';
import {
  CoreBand,
  CoreBase,
  CoreDots,
  CoreGraticule,
  CoreHeart,
  CoreNeedle,
  CoreRings,
} from './CoreLayers.tsx';
import { engrave } from './core-entrance.ts';
import {
  CORE_BOX,
  CORE_HALF,
  CORE_MARKS,
  MARK_RADIUS,
  coreShape,
  corePercent,
} from './core-shape.ts';
import { describeCore } from './describe.ts';
import { BAND_SEGMENTS, CORE_SECONDS, corePose } from './poses.ts';
import type { CoreTraits } from './types.ts';
import { useTween } from './useTween.ts';
import '../../styles/signal.css';

export interface SignalCoreProps {
  traits: CoreTraits;
  /** The live settings (`coreParams(choices)`). The core is drawn from these, so it follows them. */
  params: CoreParams;
  /** Width and height in px, including the margin for the lettered marks. Default 420. */
  size?: number;
  /** Called when the instrument has come to rest after a change. */
  onSettled?: () => void;
  /** Dims the fine engraving, leaving the rings and the heart: the core settling into a call. */
  quiet?: boolean;
  /** Replaces the description read out for the picture. */
  label?: string;
  className?: string;
}

const VIEW = `${-CORE_HALF} ${-CORE_HALF} ${CORE_BOX} ${CORE_BOX}`;
const coreSeconds = () => CORE_SECONDS;

function CoreView({
  traits,
  params,
  size = 420,
  onSettled,
  quiet = false,
  label,
  className,
}: SignalCoreProps) {
  const reduced = useReducedMotion();
  const tier = usePerfTier();
  const still = reduced || tier === 'low';

  const { pressure, stability, complexity, density, rhythm, disturbance, horizon } = params;
  const { stage, status, minutes } = traits;
  const target = useMemo(
    () => corePose({ pressure, stability, complexity, density, rhythm, disturbance, horizon }),
    [pressure, stability, complexity, density, rhythm, disturbance, horizon],
  );
  const pose = useTween(target, { instant: still, seconds: coreSeconds, onSettled });
  const shape = useMemo(() => coreShape(pose, size), [pose, size]);

  const description = useMemo(
    () =>
      label ??
      describeCore(
        { stage, status, minutes },
        { pressure, stability, complexity, density, rhythm, disturbance, horizon },
      ),
    [
      label,
      stage,
      status,
      minutes,
      pressure,
      stability,
      complexity,
      density,
      rhythm,
      disturbance,
      horizon,
    ],
  );

  // The entrance is decided once, when the core first appears.
  const root = useRef<HTMLDivElement>(null);
  const [enters] = useState(() => !still);
  useEffect(() => {
    const element = root.current;
    if (!enters || !element || element.closest('[data-no-enter]')) return;
    const started = engrave(element);
    return () => started.forEach((animation) => animation.cancel());
  }, [enters]);

  // Only the few parts drawn in the accent carry its numbers (see `.sig-accent` in signal.css).
  const hue = pose.hue.toFixed(3);
  const accent = { '--sig-hue': hue } as CSSProperties;
  const halo = { ...accent, '--sig-glow': pose.glow.toFixed(3) } as CSSProperties;
  const style = { width: size, height: size } as CSSProperties;

  const hair = shape.width.inner * 0.9;
  const numeralSize = Math.max(4.4, 12 / (size / CORE_BOX));
  return (
    <div
      ref={root}
      className={className ? `sig-core ${className}` : 'sig-core'}
      style={style}
      role="img"
      aria-label={description}
      data-sig="core"
      data-still={still ? '' : undefined}
      data-quiet={quiet ? '' : undefined}
    >
      <div className="sig-presence__halo sig-accent" style={halo} />
      <svg className="sig-layer" viewBox={VIEW} focusable="false">
        <CoreGraticule dens={pose.dens} hair={hair} />
        <CoreBase minutes={minutes} hair={hair} numeralSize={numeralSize} />
        <CoreBand lit={pose.impact * BAND_SEGMENTS} width={shape.width.band} hue={hue} />
      </svg>
      <div
        className="sig-group"
        style={{
          translate: `${(pose.cross * 3.5).toFixed(2)}% ${(-pose.cross * 1.1).toFixed(2)}%`,
        }}
      >
        <div className="sig-drift sig-drift--outer sig-accent" style={accent} data-ambient="">
          <svg className="sig-layer" viewBox={VIEW} focusable="false">
            <CoreRings shape={shape} rings={pose} facets={{ a: pose.r2, b: pose.r3 }} />
          </svg>
        </div>
      </div>
      <svg className="sig-layer" viewBox={VIEW} focusable="false">
        <CoreDots soc={pose.soc} hair={hair} />
        <CoreNeedle needle={pose.needle} hair={hair} hue={hue} />
        <CoreHeart
          stage={stage}
          status={status}
          scale={shape.heartScale}
          width={shape.width.heart}
        />
      </svg>
      <div className="sig-marks" aria-hidden="true">
        {CORE_MARKS.map((mark) => (
          <span
            key={mark.letter}
            className="sig-mark"
            style={corePercent(mark.angle, MARK_RADIUS)}
            data-write="fade"
          >
            {mark.letter}
          </span>
        ))}
      </div>
    </div>
  );
}

const sameTraits = (a: CoreTraits, b: CoreTraits) =>
  a.stage === b.stage && a.status === b.status && a.minutes === b.minutes;

/**
 * The scenario core: the engraved instrument for calibrating a call. Each setting turns a part of
 * it: pressure lights the band, the starting temperature sets the edge and the needle, the
 * difficulty adds rings and dormant dots, the heart is the call stage and its fill the status.
 * It follows `params` with a spring (instantly when motion is reduced), draws itself in once, and
 * letters its six parts A to F for the legend. Only public settings appear: the dormant dots are
 * a fixed pool by difficulty, never a count of anything real.
 */
export const SignalCore = memo(
  CoreView,
  (prev, next) =>
    prev.size === next.size &&
    prev.quiet === next.quiet &&
    prev.label === next.label &&
    prev.className === next.className &&
    prev.onSettled === next.onSettled &&
    sameTraits(prev.traits, next.traits) &&
    prev.params.pressure === next.params.pressure &&
    prev.params.stability === next.params.stability &&
    prev.params.complexity === next.params.complexity &&
    prev.params.density === next.params.density &&
    prev.params.rhythm === next.params.rhythm &&
    prev.params.disturbance === next.params.disturbance &&
    prev.params.horizon === next.params.horizon,
);
