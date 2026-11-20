import type { CallStage } from '#shared/domain/vocab.ts';
import { memo, type CSSProperties } from 'react';
import { heartHalfPath, heartPath, lerp } from './geometry.ts';
import {
  BAND_PATHS,
  CORE_MARKS,
  CORE_ORBIT,
  GRATICULE,
  LIMB_RADIUS,
  NEEDLE_SCALE,
  NEEDLE_SWEEP,
  dormantDot,
  leaderPath,
  minuteTicks,
  onCore,
  segmentGlow,
  type CoreShape,
} from './core-shape.ts';
import { bezelPaths } from './rings.ts';
import type { GlyphStatus } from './types.ts';

// The parts of the core, each a memoised group that takes only the numbers it draws. While the
// pose moves, only the parts whose numbers changed are drawn again.

const LIMB = bezelPaths(LIMB_RADIUS, 'full');
const DOT_SLOTS = [0, 1, 2, 3, 4, 5, 6] as const;

/** The limb, the minute ticks and their numerals, the needle scale, the orbit and the leaders. */
export const CoreBase = memo(function CoreBase({
  minutes,
  hair,
  numeralSize,
}: {
  minutes: number;
  hair: number;
  numeralSize: number;
}) {
  const ticks = minuteTicks(minutes);
  return (
    <g className="sig-core__base">
      <g className="sig-detail">
        <path
          className="sig-limb sig-limb--fine"
          d={LIMB.fine}
          strokeWidth={hair}
          data-write="fade"
        />
        <path
          className="sig-limb sig-limb--strong"
          d={LIMB.strong}
          strokeWidth={hair}
          data-write="fade"
        />
        <circle
          className="sig-limb sig-limb--ring"
          r={LIMB_RADIUS}
          strokeWidth={hair}
          pathLength={1}
          data-write="line"
        />
        <path className="sig-scale" d={NEEDLE_SCALE.arc} strokeWidth={hair} data-write="fade" />
        <circle className="sig-orbit" r={CORE_ORBIT} strokeWidth={hair} data-write="fade" />
      </g>
      <g>
        {ticks.off ? (
          <path
            className="sig-minute sig-minute--off"
            d={ticks.off}
            strokeWidth={hair}
            data-write="fade"
          />
        ) : null}
        {ticks.on ? (
          <path
            className="sig-minute"
            d={ticks.on}
            strokeWidth={hair * 1.6}
            pathLength={1}
            data-write="line"
          />
        ) : null}
      </g>
      <g className="sig-detail">
        {ticks.numerals.map((numeral) => (
          <text
            key={numeral.n}
            className={numeral.on ? 'sig-numeral is-on' : 'sig-numeral'}
            x={numeral.x}
            y={numeral.y}
            fontSize={numeralSize}
            textAnchor="middle"
            data-write="fade"
          >
            {numeral.n}
          </text>
        ))}
        {CORE_MARKS.map((mark) => {
          const part = onCore(mark.angle, mark.part);
          return (
            <g key={mark.letter} className="sig-leader" data-write="fade">
              <path d={leaderPath(mark)} strokeWidth={hair} />
              <circle cx={part.x} cy={part.y} r={1.5} strokeWidth={hair} />
            </g>
          );
        })}
      </g>
    </g>
  );
});

/** A faint net: coarse always, finer as the customer's proficiency goes up. */
export const CoreGraticule = memo(function CoreGraticule({
  dens,
  hair,
}: {
  dens: number;
  hair: number;
}) {
  const fine = Math.min(1, Math.max(0, (dens - 0.3) / 0.6));
  return (
    <g className="sig-detail sig-graticule">
      <path d={GRATICULE.coarse} strokeWidth={hair} data-write="fade" />
      <path d={GRATICULE.fine} strokeWidth={hair} style={{ opacity: fine }} />
    </g>
  );
});

/** The pressure band: 24 segments from the left, lit clockwise, in the colour of the start. */
export const CoreBand = memo(function CoreBand({
  lit,
  width,
  hue,
}: {
  lit: number;
  width: number;
  hue: string;
}) {
  return (
    <g className="sig-detail sig-band sig-accent" style={{ '--sig-hue': hue } as CSSProperties}>
      {BAND_PATHS.map((d, i) => (
        <path
          key={i}
          d={d}
          className="sig-band__segment"
          strokeWidth={width}
          strokeOpacity={segmentGlow(lit, i).toFixed(3)}
          data-write="fade"
        />
      ))}
    </g>
  );
});

/** The edge and the rings: the part that turns slowly, and the part that carries the mood. */
export const CoreRings = memo(function CoreRings({
  shape,
  rings,
  facets,
}: {
  shape: CoreShape;
  rings: { r2: number; r3: number };
  facets: { a: number; b: number };
}) {
  return (
    <>
      <g className="sig-detail">
        <g style={{ opacity: facets.a }}>
          <path className="sig-facet" d={shape.facetsA} strokeWidth={shape.width.inner} />
        </g>
        <g style={{ opacity: facets.b }}>
          <path className="sig-facet" d={shape.facetsB} strokeWidth={shape.width.inner} />
        </g>
      </g>
      <path
        className="sig-inner-ring"
        d={shape.ring2}
        strokeWidth={shape.width.inner}
        style={{ opacity: rings.r2 }}
        pathLength={1}
        data-write="line"
      />
      <path
        className="sig-inner-ring"
        d={shape.ring3}
        strokeWidth={shape.width.inner}
        style={{ opacity: rings.r3 }}
        pathLength={1}
        data-write="line"
      />
      <path
        className="sig-edge-ring"
        d={shape.edge}
        strokeWidth={shape.width.edge}
        strokeDasharray={shape.dasharray}
        strokeLinecap={shape.round ? 'round' : 'butt'}
        strokeLinejoin="round"
        data-write="fade"
      />
    </>
  );
});

/** The dormant dots: a fixed pool by difficulty. A density cue, never a count of anything real. */
export const CoreDots = memo(function CoreDots({ soc, hair }: { soc: number; hair: number }) {
  return (
    <g className="sig-detail">
      {DOT_SLOTS.map((i) => {
        const dot = dormantDot(i, soc);
        return (
          <g
            key={i}
            transform={`translate(${dot.x} ${dot.y}) scale(${dot.scale.toFixed(3)})`}
            opacity={dot.opacity.toFixed(3)}
            data-write="fade"
          >
            <circle className="sig-dot__ring" r={2.5} strokeWidth={hair * 1.1} />
          </g>
        );
      })}
    </g>
  );
});

/** The needle on its scale, pointing at how settled the customer starts. */
export const CoreNeedle = memo(function CoreNeedle({
  needle,
  hair,
  hue,
}: {
  needle: number;
  hair: number;
  hue: string;
}) {
  const angle = lerp(-NEEDLE_SWEEP, NEEDLE_SWEEP, needle);
  return (
    <g className="sig-accent" style={{ '--sig-hue': hue } as CSSProperties}>
      <g className="sig-detail">
        {NEEDLE_SCALE.stops.map((d, i) => (
          <path
            key={i}
            d={d}
            className={Math.abs(i / 3 - needle) < 0.12 ? 'sig-stop is-on' : 'sig-stop'}
            strokeWidth={hair}
          />
        ))}
      </g>
      <g className="sig-detail" transform={`rotate(${angle.toFixed(2)})`} data-write="fade">
        <path className="sig-needle" d="M0 12V-86" strokeWidth={hair * 1.2} />
        <circle className="sig-needle__tip" cx={0} cy={-90} r={2.1} />
      </g>
    </g>
  );
});

/** The heart: the call stage as its shape, the status as its fill, and the amber point. */
export const CoreHeart = memo(function CoreHeart({
  stage,
  status,
  scale,
  width,
}: {
  stage: CallStage;
  status: GlyphStatus;
  scale: number;
  width: number;
}) {
  return (
    <g transform={`scale(${scale.toFixed(3)})`} className="sig-core__heart">
      {status === 'attempted' ? (
        <path className="sig-heart-half" d={heartHalfPath(stage, 16)} />
      ) : null}
      <path
        className={status === 'completed' ? 'sig-heart is-solid' : 'sig-heart'}
        d={heartPath(stage, 16)}
        strokeWidth={width / scale}
        strokeLinejoin="round"
        pathLength={1}
        data-write="line"
      />
      {status === 'completed' ? <circle className="sig-heart__knock" r={16 * 0.6} /> : null}
      <circle className="sig-heart__pip" r={1.8} />
    </g>
  );
});
