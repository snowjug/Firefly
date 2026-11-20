import { memo, type CSSProperties } from 'react';
import { ORBIT_RADIUS, PRESENCE_BOX, PRESENCE_HALF } from './presence-shape.ts';
import { bezelPaths, dotAt } from './rings.ts';
import type { Detail } from './presence-shape.ts';

// The parts of the presence that do not change while it moves, or change on their own: each is a
// memoised piece so a frame of a pose tween only draws the rings and the heart's colour.

export const PRESENCE_VIEW = `${-PRESENCE_HALF} ${-PRESENCE_HALF} ${PRESENCE_BOX} ${PRESENCE_BOX}`;

/** The bezel's ticks and the dotted track the dormant dots sit on. */
export const PresenceBezel = memo(function PresenceBezel({
  detail,
  bezel,
  inner,
}: {
  detail: Detail;
  bezel: number;
  inner: number;
}) {
  const paths = bezelPaths(96, detail);
  return (
    <svg className="sig-layer" viewBox={PRESENCE_VIEW} focusable="false">
      <path className="sig-bezel" d={paths.fine} strokeWidth={bezel} />
      <path className="sig-bezel sig-bezel--strong" d={paths.strong} strokeWidth={bezel} />
      {detail !== 'small' ? (
        <circle className="sig-orbit" r={ORBIT_RADIUS} strokeWidth={inner} />
      ) : null}
    </svg>
  );
});

/**
 * The dormant dots: a fixed pool, the first `lit` of them found. The one found just now (`pulsing`)
 * gets a short pulse. There is never a total on show.
 */
export const PresenceDots = memo(function PresenceDots({
  count,
  lit,
  pulsing,
  radius,
  width,
}: {
  count: number;
  lit: number;
  pulsing: number;
  radius: number;
  width: number;
}) {
  return (
    <svg className="sig-layer" viewBox={PRESENCE_VIEW} focusable="false">
      {Array.from({ length: count }, (_, i) => {
        const { x, y } = dotAt(i, ORBIT_RADIUS);
        const className =
          i < lit ? (i === pulsing ? 'sig-dot is-lit is-new' : 'sig-dot is-lit') : 'sig-dot';
        return (
          <g key={i} transform={`translate(${x} ${y})`} className={className}>
            <circle className="sig-dot__ring" r={radius} strokeWidth={width} />
            {i === pulsing ? (
              <g key={`pulse-${lit}`} className="sig-dot__pulse">
                <circle className="sig-dot__wave" r={radius} strokeWidth={width} />
                <path className="sig-dot__glint" d="M0 -9V9M-9 0H9" strokeWidth={width} />
              </g>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
});

/**
 * The heart: a halo ring in the mood's colour, the point of the customer, and the amber point. It
 * is the one thing in the accent colour that is not a ring, so it carries its own colour scope.
 * While the customer types the whole heart wobbles on its wrapper.
 */
export const PresenceHeart = memo(function PresenceHeart({
  halo,
  dot,
  pip,
  width,
  hue,
  cool,
}: {
  halo: number;
  dot: number;
  pip: number;
  width: number;
  hue: string;
  cool: string;
}) {
  const style = { '--sig-hue': hue, '--sig-cool': cool } as CSSProperties;
  return (
    <div className="sig-beat sig-accent" style={style} data-ambient="">
      <svg className="sig-layer" viewBox={PRESENCE_VIEW} focusable="false">
        <circle className="sig-heart__halo" r={halo} strokeWidth={width} />
        <circle className="sig-heart__dot" r={dot} />
        <circle className="sig-heart__pip" r={pip} />
      </svg>
    </div>
  );
});
