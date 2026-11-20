import { memo, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { DIMENSIONS, type DimensionId } from '#shared/domain/vocab.ts';
import { plural } from '../../lib/format.ts';
import type { SkillInput } from '../atlas/constellation-layout.ts';
import { nextInDirection, readingOrder, type Direction } from '../../lib/spatial/traversal.ts';
import '../../styles/progress.css';
import { LightPips } from './LightPips.tsx';
import { skillNumber, starCounts } from './progress-model.ts';
import {
  skyChart,
  skyPercent,
  type SkyChart,
  type SkyCluster,
  type SkyLink,
  type SkyPoint,
  type SkyStar,
} from './sky-geometry.ts';

// The mastery constellation: six clusters of fourteen stars around a core. A star is lit for each
// completed call scored on that skill; a skill with no practice is drawn as outlines, which says
// "no evidence yet" and never "low". Each cluster is a real button laid over the drawing (so it can
// be reached, named and pressed), and the arrow keys move between clusters by where they lie.

const ARROWS: Record<string, Direction> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

/** The halo sits a little outside the stars. */
const HALO_GAP = 12;

const rayPath = (cx: number, cy: number, inner: number, outer: number, angle: number) => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return `M${(cx + cos * inner).toFixed(1)} ${(cy + sin * inner).toFixed(1)}L${(cx + cos * outer).toFixed(1)} ${(cy + sin * outer).toFixed(1)}`;
};

/** Eight short rays outside the halo, the long ones at the compass points: the instrument's glint. */
function glintRays(cx: number, cy: number, radius: number): { cardinal: string; diagonal: string } {
  const cardinal: string[] = [];
  const diagonal: string[] = [];
  for (let step = 0; step < 8; step += 1) {
    const angle = (step * Math.PI) / 4;
    if (step % 2 === 0) cardinal.push(rayPath(cx, cy, radius + 5, radius + 24, angle));
    else diagonal.push(rayPath(cx, cy, radius + 5, radius + 14, angle));
  }
  return { cardinal: cardinal.join(''), diagonal: diagonal.join('') };
}

/** Four small ticks across the halo at the compass points: the lens resting on the chosen cluster. */
function lensTicks(cx: number, cy: number, radius: number): string {
  const ticks: string[] = [];
  for (let step = 0; step < 4; step += 1) {
    ticks.push(rayPath(cx, cy, radius - 5, radius + 7, (step * Math.PI) / 2));
  }
  return ticks.join('');
}

function starGeometry(star: SkyStar, level: number) {
  if (!star.lit) return { dot: 2.4, glow: 0 };
  return { dot: 2.7 + level * 0.45, glow: 11 + level * 2.5 };
}

const Star = memo(function Star({
  star,
  level,
  glow,
}: {
  star: SkyStar;
  level: number;
  /** The gradients the glows are filled with (`url(#...)`): ink-coloured, and amber for the newest. */
  glow: { calm: string; warm: string };
}) {
  const { dot, glow: radius } = starGeometry(star, level);
  if (!star.lit) {
    return <circle className="pg-star pg-star--dormant" cx={star.x} cy={star.y} r={dot} />;
  }
  return (
    <g className={star.recent ? 'pg-star pg-star--lit pg-star--recent' : 'pg-star pg-star--lit'}>
      <circle
        className="pg-star__glow"
        cx={star.x}
        cy={star.y}
        r={radius}
        fill={star.recent ? glow.warm : glow.calm}
      />
      {star.recent ? (
        <>
          <circle className="pg-star__wave" cx={star.x} cy={star.y} r={dot + 2} />
          <path
            className="pg-star__glint"
            d={`M${star.x - 9} ${star.y}H${star.x + 9}M${star.x} ${star.y - 9}V${star.y + 9}`}
          />
        </>
      ) : null}
      <circle className="pg-star__dot" cx={star.x} cy={star.y} r={dot} />
    </g>
  );
});

const Links = memo(function Links({ links }: { links: readonly SkyLink[] }) {
  return (
    <g className="pg-links">
      {links.map((link, index) =>
        link.strength > 0 ? (
          <line
            key={index}
            className={link.toCore ? 'pg-link pg-link--core' : 'pg-link'}
            x1={link.from.x}
            y1={link.from.y}
            x2={link.to.x}
            y2={link.to.y}
            style={{ ['--strength' as string]: link.strength }}
          />
        ) : null,
      )}
    </g>
  );
});

const ClusterArt = memo(function ClusterArt({
  cluster,
  stars,
  selected,
  hot,
  glow,
}: {
  cluster: SkyCluster;
  stars: readonly SkyStar[];
  selected: boolean;
  hot: boolean;
  glow: { calm: string; warm: string };
}) {
  const halo = cluster.radius + HALO_GAP;
  const rays = cluster.focus ? glintRays(cluster.x, cluster.y, halo) : null;
  return (
    <g
      className="pg-cluster"
      data-skill={cluster.id}
      data-level={cluster.level}
      data-selected={selected ? '' : undefined}
      data-hot={hot ? '' : undefined}
    >
      <circle className="pg-halo" cx={cluster.x} cy={cluster.y} r={halo} />
      {selected ? <path className="pg-lens" d={lensTicks(cluster.x, cluster.y, halo)} /> : null}
      {rays ? (
        <g className="pg-rays" data-ambient>
          <path className="pg-ray" d={rays.cardinal} />
          <path className="pg-ray pg-ray--diagonal" d={rays.diagonal} />
        </g>
      ) : null}
      {stars.map((star) => (
        <Star key={star.id} star={star} level={cluster.level} glow={glow} />
      ))}
    </g>
  );
});

function Plate({
  chart,
  selected,
  hot,
  uid,
}: {
  chart: SkyChart;
  selected: DimensionId | null;
  hot: DimensionId | null;
  uid: string;
}) {
  const byCluster = useMemo(() => {
    const groups = new Map<DimensionId, SkyStar[]>();
    for (const star of chart.stars) {
      const group = groups.get(star.cluster);
      if (group) group.push(star);
      else groups.set(star.cluster, [star]);
    }
    return groups;
  }, [chart.stars]);
  const glow = useMemo(() => ({ calm: `url(#${uid}-calm)`, warm: `url(#${uid}-warm)` }), [uid]);
  const { core, graticule, box } = chart;
  const lit = chart.clusters.some((cluster) => cluster.lit > 0);
  return (
    <svg
      className="pg-plate"
      viewBox={`0 0 ${box.width} ${box.height}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={`${uid}-calm`}>
          <stop offset="0" className="pg-glow pg-glow--calm" />
          <stop offset="1" className="pg-glow pg-glow--none" />
        </radialGradient>
        <radialGradient id={`${uid}-warm`}>
          <stop offset="0" className="pg-glow pg-glow--warm" />
          <stop offset="1" className="pg-glow pg-glow--warm pg-glow--none" />
        </radialGradient>
      </defs>
      <g className="pg-graticule">
        {graticule.rings.map((ring) => (
          <ellipse key={ring.rx} cx={core.x} cy={core.y} rx={ring.rx} ry={ring.ry} />
        ))}
        {graticule.spokes.map((spoke, index) => (
          <line key={index} x1={spoke.from.x} y1={spoke.from.y} x2={spoke.to.x} y2={spoke.to.y} />
        ))}
      </g>
      <Links links={chart.links} />
      <g className={lit ? 'pg-core is-lit' : 'pg-core'}>
        <circle className="pg-core__ring" cx={core.x} cy={core.y} r={19} />
        <circle className="pg-core__ring" cx={core.x} cy={core.y} r={10} />
        <circle className="pg-core__dot" cx={core.x} cy={core.y} r={3} />
      </g>
      {chart.clusters.map((cluster) => (
        <ClusterArt
          key={cluster.id}
          cluster={cluster}
          stars={byCluster.get(cluster.id) ?? []}
          selected={selected === cluster.id}
          hot={hot === cluster.id}
          glow={glow}
        />
      ))}
    </svg>
  );
}

export interface SkyProps {
  skills: readonly SkillInput[];
  /** Stars the newest call lit, as `${skill}:${index}`. */
  recent: ReadonlySet<string>;
  selected: DimensionId | null;
  onSelect(id: DimensionId | null): void;
  /** The id of the panel a chosen cluster opens, for `aria-controls`. */
  controls: string;
  /** What each skill is, in one sentence, for assistive technology. */
  descriptions: Readonly<Record<DimensionId, string>>;
  /** Pulse the stars the newest call lit, once (arriving from a report). */
  pulse?: boolean;
}

/**
 * The constellation. The drawing is decoration (`aria-hidden`); the buttons over it carry the
 * names, the figures and the selection, so everything the stars show is also said in words.
 * Arrow keys move between clusters, Enter or Space opens one, Escape puts it away.
 */
export function Sky({
  skills,
  recent,
  selected,
  onSelect,
  controls,
  descriptions,
  pulse,
}: SkyProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const chart = useMemo(() => skyChart(skills, recent), [skills, recent]);
  const counts = useMemo(() => starCounts(skills), [skills]);
  const skillById = useMemo(() => new Map(skills.map((skill) => [skill.id, skill])), [skills]);
  const buttons = useRef(new Map<DimensionId, HTMLButtonElement>());
  const [hot, setHot] = useState<DimensionId | null>(null);
  const [rovingId, setRoving] = useState<DimensionId | null>(null);
  const tabbable = chart.clusters.some((cluster) => cluster.id === (selected ?? rovingId))
    ? (selected ?? rovingId)
    : (chart.clusters[0]?.id ?? null);

  const points = useMemo(
    () => chart.clusters.map((cluster) => ({ id: cluster.id, x: cluster.x, y: cluster.y })),
    [chart.clusters],
  );

  const move = (event: KeyboardEvent<HTMLButtonElement>, id: DimensionId) => {
    let target: string | null = null;
    const direction = ARROWS[event.key];
    if (direction) target = nextInDirection(points, id, direction, { wrap: true });
    else if (event.key === 'Home') target = readingOrder(points)[0]?.id ?? null;
    else if (event.key === 'End') target = readingOrder(points).at(-1)?.id ?? null;
    else if (event.key === 'Escape' && selected !== null) {
      event.preventDefault();
      onSelect(null);
      return;
    }
    if (!target) return;
    event.preventDefault();
    buttons.current.get(target as DimensionId)?.focus();
  };

  return (
    <div className="pg-sky" data-pulse={pulse ? '' : undefined}>
      <div className="pg-sky__frame">
        <Plate chart={chart} selected={selected} hot={hot} uid={uid} />
        <ul className="pg-sky__skills" aria-label="The six skills">
          {chart.clusters.map((cluster) => {
            const skill = skillById.get(cluster.id);
            const meta = DIMENSIONS[cluster.id];
            const position = skyPercent(cluster);
            const size = ((cluster.radius + HALO_GAP) * 2 * 100) / chart.box.width;
            const nameId = `${uid}-${cluster.id}-name`;
            const descId = `${uid}-${cluster.id}-desc`;
            const buttonId = `${uid}-${cluster.id}`;
            return (
              <li
                key={cluster.id}
                className="pg-skill"
                data-skill={cluster.id}
                data-side={cluster.side}
                data-focus={cluster.focus ? '' : undefined}
                data-pressed={selected === cluster.id ? '' : undefined}
                style={{ ...position, ['--size' as string]: `${size}%` }}
                onPointerEnter={(event) => {
                  if (event.pointerType === 'mouse') setHot(cluster.id);
                }}
                onPointerLeave={() =>
                  setHot((current) => (current === cluster.id ? null : current))
                }
              >
                {/* The button is the circle over the stars. It has no text of its own: its name is the
                    visible label beside it (aria-labelledby), and clicking that label presses it. */}
                <button
                  type="button"
                  id={buttonId}
                  className="pg-skill__button"
                  aria-pressed={selected === cluster.id}
                  aria-controls={controls}
                  aria-labelledby={nameId}
                  aria-describedby={descId}
                  tabIndex={tabbable === cluster.id ? 0 : -1}
                  ref={(node) => {
                    if (node) buttons.current.set(cluster.id, node);
                    else buttons.current.delete(cluster.id);
                  }}
                  onClick={() => onSelect(selected === cluster.id ? null : cluster.id)}
                  onKeyDown={(event) => move(event, cluster.id)}
                  onFocus={() => {
                    setRoving(cluster.id);
                    setHot(cluster.id);
                  }}
                  onBlur={() => setHot((current) => (current === cluster.id ? null : current))}
                />
                <label htmlFor={buttonId} className="pg-skill__label">
                  <span className="pg-skill__no" aria-hidden="true">
                    {skillNumber(cluster.id)}
                  </span>
                  <span id={nameId} className="pg-skill__name">
                    {meta.label}
                  </span>
                  <span className="pg-skill__meta" aria-hidden="true">
                    {skill && skill.evidence > 0 ? (
                      <>
                        {plural(skill.evidence, 'call')}
                        <LightPips level={skill.level} />
                      </>
                    ) : (
                      'No evidence yet'
                    )}
                  </span>
                  {cluster.focus ? (
                    <span className="pg-skill__next" aria-hidden="true">
                      Next focus
                    </span>
                  ) : null}
                </label>
                <span id={descId} className="sr-only">
                  {descriptions[cluster.id]}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="pg-sky__count type-label">
        <span>Six skills, {chart.stars.length / 6} stars each</span>
        <span>
          {counts.lit} of {counts.total} lit
        </span>
      </p>
    </div>
  );
}

export type { SkyPoint };
