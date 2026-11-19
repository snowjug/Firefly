import { useId } from 'react';
import type { DimensionResult } from '#shared/domain/report.ts';
import { DIMENSION_IDS, DIMENSIONS, type DimensionId } from '#shared/domain/vocab.ts';
import { useReveal } from '../../lib/motion.ts';

const SIZE = 400;
const CENTRE = SIZE / 2;

/** Brighter, larger and further out as the score rises: a 5 is a beacon, a 1 is a dormant ring. */
const radiusFor = (score: number) => 60 + score * 10;
const starSize = (score: number) => 5 + score * 1.5;

export interface ConstellationNode {
  id: DimensionId;
  score: number;
  /** 0 (dormant ring) to 4 (beacon). */
  tier: number;
  x: number;
  y: number;
  size: number;
  /** Which side of the star its name goes on, so names never sit on top of the lines. */
  anchor: 'start' | 'end' | 'middle';
  /** Where the name sits, as a percentage of the width and height. */
  labelX: number;
  labelY: number;
}

/** Pure layout for the six skills, so it can be tested without rendering. */
export function constellationLayout(dimensions: readonly DimensionResult[]): ConstellationNode[] {
  return DIMENSION_IDS.map((id, index) => {
    const score = dimensions.find((d) => d.id === id)?.score ?? 1;
    const angle = ((-90 + index * 60) * Math.PI) / 180;
    const r = radiusFor(score);
    const size = starSize(score);
    const x = CENTRE + Math.cos(angle) * r;
    const y = CENTRE + Math.sin(angle) * r;
    const side = Math.cos(angle);
    const anchor = side > 0.3 ? 'start' : side < -0.3 ? 'end' : 'middle';
    const gap = size + 14;
    const labelX = anchor === 'start' ? x + gap : anchor === 'end' ? x - gap : x;
    const labelY = anchor === 'middle' ? y + (Math.sin(angle) < 0 ? -gap : gap) : y;
    return {
      id,
      score,
      tier: Math.max(0, Math.min(4, score - 1)),
      x,
      y,
      size,
      anchor,
      labelX: (labelX / SIZE) * 100,
      labelY: (labelY / SIZE) * 100,
    };
  });
}

/**
 * The six coaching skills as a small constellation: each skill is a star whose distance, size and
 * light follow its score. It is decorative: the same information is in the skill list right below
 * it, so it is hidden from assistive technology and its links are pointer shortcuts only.
 */
export function ReportConstellation({ dimensions }: { dimensions: readonly DimensionResult[] }) {
  const gradient = useId();
  const ref = useReveal<HTMLDivElement>();
  const nodes = constellationLayout(dimensions);
  const outline = `${nodes.map((n, i) => `${i === 0 ? 'M' : 'L'}${n.x.toFixed(1)} ${n.y.toFixed(1)}`).join(' ')} Z`;
  return (
    <div ref={ref} className="rp-const" aria-hidden="true">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} focusable="false" className="rp-const-svg">
        <defs>
          <radialGradient id={gradient}>
            <stop offset="0" style={{ stopColor: 'var(--glow)', stopOpacity: 0.6 }} />
            <stop offset="1" style={{ stopColor: 'var(--glow)', stopOpacity: 0 }} />
          </radialGradient>
        </defs>
        {[2, 3, 4, 5].map((score) => (
          <circle
            key={score}
            className="rp-const-ring"
            cx={CENTRE}
            cy={CENTRE}
            r={radiusFor(score)}
          />
        ))}
        {nodes.map((n) => (
          <line key={n.id} className="rp-const-spoke" x1={CENTRE} y1={CENTRE} x2={n.x} y2={n.y} />
        ))}
        <path className="rp-const-outline" d={outline} pathLength={1} />
        <circle className="rp-const-core" cx={CENTRE} cy={CENTRE} r={50} />
        {nodes.map((n, i) => (
          <a
            key={n.id}
            href={`#dim-${n.id}`}
            tabIndex={-1}
            aria-hidden="true"
            className="rp-star"
            data-tier={n.tier}
            style={{ ['--i' as string]: i }}
          >
            <circle
              className="rp-star-halo"
              cx={n.x}
              cy={n.y}
              r={n.size * 3.4}
              fill={`url(#${gradient})`}
            />
            <circle className="rp-star-body" cx={n.x} cy={n.y} r={n.size} />
            {n.score >= 5 ? (
              <circle className="rp-star-ring" cx={n.x} cy={n.y} r={n.size + 6} />
            ) : null}
          </a>
        ))}
      </svg>
      {nodes.map((n) => (
        <span
          key={n.id}
          className="rp-const-label"
          data-anchor={n.anchor}
          style={{ left: `${n.labelX}%`, top: `${n.labelY}%` }}
        >
          {DIMENSIONS[n.id].short}
        </span>
      ))}
    </div>
  );
}
