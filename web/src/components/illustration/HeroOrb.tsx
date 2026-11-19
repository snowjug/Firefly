import { useId, type CSSProperties, type ReactNode } from 'react';
import { useReducedMotion } from '../../lib/theme.tsx';
import { makeRefs, Stops } from './avatar-kit.tsx';
import './illustration.css';

export interface HeroOrbProps {
  className?: string;
  /** Describes the artwork. Without it the artwork is decorative and hidden from assistive technology. */
  title?: string;
  /** Real text shown over the sphere, for example the product's two-line promise. */
  children?: ReactNode;
}

interface Dot {
  /** Where on its ring the dot starts, as a fraction of a full turn. */
  phase: number;
  /** Seconds for one trip round the ring. */
  seconds: number;
  color: string;
  size: number;
}

interface Ring {
  a: number;
  b: number;
  rotate: number;
  from: string;
  to: string;
  width: number;
  dots: readonly Dot[];
}

const C = 300;
const R = 178;

const RINGS: readonly Ring[] = [
  {
    a: 262,
    b: 78,
    rotate: -20,
    from: '#6fe0ff',
    to: '#b79bff',
    width: 2.6,
    dots: [
      { phase: 0.14, seconds: 46, color: '#9af2ff', size: 1.1 },
      { phase: 0.66, seconds: 46, color: '#d6c4ff', size: 0.7 },
    ],
  },
  {
    a: 238,
    b: 120,
    rotate: 26,
    from: '#b79bff',
    to: '#62d4ff',
    width: 2,
    dots: [{ phase: 0.36, seconds: 58, color: '#ffffff', size: 0.9 }],
  },
  {
    a: 284,
    b: 46,
    rotate: -62,
    from: '#8fb5ff',
    to: '#e2d0ff',
    width: 1.5,
    dots: [{ phase: 0.82, seconds: 34, color: '#a9ecff', size: 0.8 }],
  },
];

// Star dust: a fixed scatter, so the picture is the same on every render.
const DUST = (() => {
  const dots: { x: number; y: number; r: number; o: number; d: number; twinkle: boolean }[] = [];
  let seed = 7;
  const next = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  while (dots.length < 64) {
    const x = 8 + next() * 584;
    const y = 8 + next() * 584;
    if (Math.hypot(x - C, y - C) < R + 14) continue;
    dots.push({
      x,
      y,
      r: 0.5 + next() * 1.3,
      o: 0.2 + next() * 0.6,
      d: Math.round(next() * 90) / 10,
      twinkle: dots.length % 4 === 0,
    });
  }
  return dots;
})();

const FRONT_ARC = (a: number, b: number) => `M ${-a} 0 A ${a} ${b} 0 0 0 ${a} 0`;
const BACK_ARC = (a: number, b: number) => `M ${-a} 0 A ${a} ${b} 0 0 1 ${a} 0`;

function Orbiters({
  ring,
  index,
  layer,
  refs,
}: {
  ring: Ring;
  index: number;
  layer: 'front' | 'back';
  refs: ReturnType<typeof makeRefs>;
}) {
  const k = ring.b / ring.a;
  return (
    <g transform={`translate(${C} ${C}) rotate(${ring.rotate})`}>
      <g transform={`scale(1 ${k})`}>
        {ring.dots.map((dot, i) => {
          // At rest a dot is drawn once, on the side of the sphere it started on.
          const startsInFront = dot.phase < 0.5;
          const off = (layer === 'front') !== startsInFront;
          return (
            <g
              key={`${index}-${i}`}
              className={`ill-orbit ill-orbit-${layer}${off ? ' ill-orbit-off' : ''}`}
              style={
                { '--ill-phase': dot.phase, '--ill-orbit-time': `${dot.seconds}s` } as CSSProperties
              }
            >
              <g transform={`translate(${ring.a} 0)`}>
                <g transform={`scale(1 ${1 / k})`}>
                  <circle r={11 * dot.size} fill={refs.url(`dot${index}${i}`)} />
                  <circle r={2.8 * dot.size} fill="#ffffff" />
                </g>
              </g>
            </g>
          );
        })}
      </g>
    </g>
  );
}

/**
 * The landing hero: a glowing blue-violet sphere with tilted orbit rings, built for a dark
 * background. `children` is real text laid over the sphere. The motion is a slow drift of a few
 * light points and a gentle glow; it stops under reduced motion. It fills the width of its
 * container (always square), and reads well from about 280 px to 560 px.
 */
export function HeroOrb({ className, title, children }: HeroOrbProps) {
  const uid = `ill${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const reducedMotion = useReducedMotion();
  const refs = makeRefs(uid);
  const { id, url } = refs;
  return (
    <div
      className={['ill-orb', reducedMotion ? '' : 'ill-live', className ?? '']
        .filter(Boolean)
        .join(' ')}
    >
      <svg
        className="ill-orb-art"
        viewBox="0 0 600 600"
        role={title ? 'img' : undefined}
        aria-label={title}
        aria-hidden={title ? undefined : true}
        focusable="false"
      >
        <defs>
          <radialGradient id={id('glow')} gradientUnits="userSpaceOnUse" cx={C} cy={C} r={300}>
            <Stops
              stops={[
                [0.55, '#5a63ff', 0.6],
                [0.66, '#5a63ff', 0.34],
                [0.8, '#8a5bff', 0.12],
                [1, '#8a5bff', 0],
              ]}
            />
          </radialGradient>
          <radialGradient id={id('base')} cx="0.36" cy="0.3" r="0.88">
            <Stops
              stops={[
                [0, '#7f93ff'],
                [0.2, '#4c5cf2'],
                [0.52, '#2b2db8'],
                [0.8, '#171a6e'],
                [1, '#0a0b3a'],
              ]}
            />
          </radialGradient>
          <radialGradient id={id('violet')} cx="0.78" cy="0.84" r="0.62">
            <Stops
              stops={[
                [0, '#a35cff', 0.62],
                [1, '#a35cff', 0],
              ]}
            />
          </radialGradient>
          <radialGradient id={id('limb')} cx="0.5" cy="0.5" r="0.5">
            <Stops
              stops={[
                [0.6, '#04051f', 0],
                [1, '#04051f', 0.6],
              ]}
            />
          </radialGradient>
          <radialGradient id={id('shine')}>
            <Stops
              stops={[
                [0, '#ffffff', 0.55],
                [1, '#ffffff', 0],
              ]}
            />
          </radialGradient>
          <linearGradient id={id('edge')} x1="0.1" y1="0.05" x2="0.9" y2="0.95">
            <Stops
              stops={[
                [0, '#a8e8ff', 0.95],
                [0.5, '#7d86ff', 0.35],
                [1, '#c08bff', 0.75],
              ]}
            />
          </linearGradient>
          {RINGS.map((ring, i) => (
            <linearGradient
              key={i}
              id={id(`ring${i}`)}
              gradientUnits="userSpaceOnUse"
              x1={-ring.a}
              y1="0"
              x2={ring.a}
              y2="0"
            >
              <Stops
                stops={[
                  [0, ring.from, 0.1],
                  [0.3, ring.from, 0.95],
                  [0.7, ring.to, 0.95],
                  [1, ring.to, 0.1],
                ]}
              />
            </linearGradient>
          ))}
          {RINGS.flatMap((ring, i) =>
            ring.dots.map((dot, j) => (
              <radialGradient key={`${i}${j}`} id={id(`dot${i}${j}`)}>
                <Stops
                  stops={[
                    [0, dot.color, 0.95],
                    [0.35, dot.color, 0.35],
                    [1, dot.color, 0],
                  ]}
                />
              </radialGradient>
            )),
          )}
        </defs>

        <g className="ill-orb-dust">
          {DUST.map((dot, i) => (
            <circle
              key={i}
              cx={dot.x.toFixed(1)}
              cy={dot.y.toFixed(1)}
              r={dot.r.toFixed(2)}
              fill="#dfe6ff"
              opacity={dot.o.toFixed(2)}
              className={dot.twinkle ? 'ill-twinkle' : undefined}
              style={dot.twinkle ? ({ '--ill-delay': `${-dot.d}s` } as CSSProperties) : undefined}
            />
          ))}
        </g>

        <circle className="ill-orb-glow" cx={C} cy={C} r={300} fill={url('glow')} />

        {RINGS.map((ring, i) => (
          <g key={`back${i}`} transform={`translate(${C} ${C}) rotate(${ring.rotate})`}>
            <path
              d={BACK_ARC(ring.a, ring.b)}
              fill="none"
              stroke={url(`ring${i}`)}
              strokeWidth={ring.width}
              strokeOpacity={0.42}
            />
          </g>
        ))}
        {RINGS.map((ring, i) => (
          <Orbiters key={`ob${i}`} ring={ring} index={i} layer="back" refs={refs} />
        ))}

        <circle cx={C} cy={C} r={R} fill={url('base')} />
        <circle cx={C} cy={C} r={R} fill={url('violet')} />
        <circle cx={C} cy={C} r={R} fill={url('limb')} />
        <ellipse
          cx={238}
          cy={208}
          rx={104}
          ry={64}
          fill={url('shine')}
          transform="rotate(-30 238 208)"
        />
        <circle cx={206} cy={182} r={15} fill={url('shine')} />
        <circle
          cx={C}
          cy={C}
          r={R - 1}
          fill="none"
          stroke={url('edge')}
          strokeWidth={9}
          strokeOpacity={0.14}
        />
        <circle cx={C} cy={C} r={R - 1} fill="none" stroke={url('edge')} strokeWidth={2.2} />

        {RINGS.map((ring, i) => (
          <g key={`front${i}`} transform={`translate(${C} ${C}) rotate(${ring.rotate})`}>
            <path
              d={FRONT_ARC(ring.a, ring.b)}
              fill="none"
              stroke={url(`ring${i}`)}
              strokeWidth={ring.width * 3.4}
              strokeOpacity={0.12}
            />
            <path
              d={FRONT_ARC(ring.a, ring.b)}
              fill="none"
              stroke={url(`ring${i}`)}
              strokeWidth={ring.width}
            />
          </g>
        ))}
        {RINGS.map((ring, i) => (
          <Orbiters key={`of${i}`} ring={ring} index={i} layer="front" refs={refs} />
        ))}
      </svg>
      {children ? <div className="ill-orb-slot">{children}</div> : null}
    </div>
  );
}
