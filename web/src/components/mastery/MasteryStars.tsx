import { useId } from 'react';
import {
  CONSTELLATIONS,
  MASTERY_TIER_LABELS,
  MASTERY_TIERS,
  type DimensionMastery,
} from '#shared/domain/mastery.ts';
import { DIMENSIONS, type DimensionId } from '#shared/domain/vocab.ts';

const SIZE = 300;
const CENTRE = SIZE / 2;
const RADIUS = 92;

export interface StarNode {
  dimension: DimensionId;
  /** 0 (dormant) to 4 (beacon). */
  tier: number;
  x: number;
  y: number;
  anchor: 'start' | 'end' | 'middle';
  /** Where the name sits, as a percentage of the width and height. */
  labelX: number;
  labelY: number;
}

/** The six skill constellations on a ring, in rubric order starting at the top. Pure, for tests. */
export function starLayout(mastery: readonly DimensionMastery[]): StarNode[] {
  return mastery.map((m, index) => {
    const angle = ((-90 + index * 60) * Math.PI) / 180;
    const x = CENTRE + Math.cos(angle) * RADIUS;
    const y = CENTRE + Math.sin(angle) * RADIUS;
    const side = Math.cos(angle);
    const anchor = side > 0.3 ? 'start' : side < -0.3 ? 'end' : 'middle';
    const gap = 32;
    const labelX = anchor === 'start' ? x + gap : anchor === 'end' ? x - gap : x;
    const labelY = anchor === 'middle' ? y + (Math.sin(angle) < 0 ? -gap : gap) : y;
    return {
      dimension: m.dimension,
      tier: m.tierIndex,
      x,
      y,
      anchor,
      labelX: (labelX / SIZE) * 100,
      labelY: (labelY / SIZE) * 100,
    };
  });
}

const BODY_RADIUS = [6, 4.5, 6, 7.5, 9] as const;

/** How bright the middle of the constellation is: the average tier, from 0 to 1. */
export function overallLight(mastery: readonly DimensionMastery[]): number {
  if (mastery.length === 0) return 0;
  const total = mastery.reduce((sum, m) => sum + m.tierIndex, 0);
  return total / (mastery.length * (MASTERY_TIERS.length - 1));
}

/** A plain-language description for assistive technology. */
export function describeStars(mastery: readonly DimensionMastery[]): string {
  return `Skill constellations. ${mastery
    .map(
      (m) =>
        `${CONSTELLATIONS[m.dimension].name}, ${DIMENSIONS[m.dimension].label}: ${MASTERY_TIER_LABELS[m.tier].label}`,
    )
    .join('. ')}.`;
}

/**
 * The six skills as constellations that light up with practice. Dormant is an empty ring; each tier
 * adds size and light; a beacon also gets a ring and rays. When `decorative` is set the same
 * information must be available as text next to it.
 */
export function MasteryStars({
  mastery,
  labels = true,
  decorative = false,
  className = '',
}: {
  mastery: readonly DimensionMastery[];
  labels?: boolean;
  decorative?: boolean;
  className?: string;
}) {
  const gradient = useId();
  const nodes = starLayout(mastery);
  const light = overallLight(mastery);
  return (
    <div
      className={`ms ${className}`.trim()}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : describeStars(mastery)}
      aria-hidden={decorative ? true : undefined}
      data-light={light.toFixed(2)}
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} focusable="false" className="ms-svg">
        <defs>
          <radialGradient id={gradient}>
            <stop offset="0" style={{ stopColor: 'var(--glow)', stopOpacity: 0.65 }} />
            <stop offset="1" style={{ stopColor: 'var(--glow)', stopOpacity: 0 }} />
          </radialGradient>
        </defs>
        <circle className="ms-ring" cx={CENTRE} cy={CENTRE} r={RADIUS} />
        <circle className="ms-ring ms-ring-inner" cx={CENTRE} cy={CENTRE} r={RADIUS * 0.55} />
        {nodes.map((n, i) => {
          const next = nodes[(i + 1) % nodes.length];
          if (!next) return null;
          const lit = n.tier > 0 && next.tier > 0;
          return (
            <line
              key={`link-${n.dimension}`}
              className="ms-link"
              data-lit={lit}
              x1={n.x}
              y1={n.y}
              x2={next.x}
              y2={next.y}
            />
          );
        })}
        <circle
          className="ms-glow"
          cx={CENTRE}
          cy={CENTRE}
          r={22 + light * 46}
          fill={`url(#${gradient})`}
          style={{ opacity: 0.25 + light * 0.75 }}
        />
        <circle className="ms-nucleus" cx={CENTRE} cy={CENTRE} r={3 + light * 4} />
        {nodes.map((n) => (
          <g key={n.dimension} className="ms-star" data-tier={n.tier}>
            <circle
              className="ms-halo"
              cx={n.x}
              cy={n.y}
              r={(BODY_RADIUS[n.tier] ?? 6) * 3.2}
              fill={`url(#${gradient})`}
            />
            <circle className="ms-body" cx={n.x} cy={n.y} r={BODY_RADIUS[n.tier] ?? 6} />
            {n.tier === 4 ? (
              <>
                <circle className="ms-beacon-ring" cx={n.x} cy={n.y} r={15} />
                <path
                  className="ms-rays"
                  d={`M${n.x} ${n.y - 22}V${n.y - 17}M${n.x} ${n.y + 17}V${n.y + 22}M${n.x - 22} ${n.y}H${n.x - 17}M${n.x + 17} ${n.y}H${n.x + 22}`}
                />
              </>
            ) : null}
          </g>
        ))}
      </svg>
      {labels
        ? nodes.map((n) => (
            <span
              key={n.dimension}
              className="ms-label"
              data-anchor={n.anchor}
              style={{ left: `${n.labelX}%`, top: `${n.labelY}%` }}
            >
              {CONSTELLATIONS[n.dimension].name}
            </span>
          ))
        : null}
    </div>
  );
}
