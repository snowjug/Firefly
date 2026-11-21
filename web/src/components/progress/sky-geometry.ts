import type { DimensionId } from '#shared/domain/vocab.ts';
import {
  CORE_ID,
  constellationLayout,
  type SkillInput,
  type SkillLevel,
} from '../atlas/constellation-layout.ts';

// The constellation drawn on a wide plate. `constellationLayout` works in a square (0 to 1); here
// the ring of clusters is stretched sideways to suit a wide screen while every cluster keeps its
// own shape, so the stars still sit in round spirals. Pure: skills in, coordinates out, in the
// plate's own units. The component scales the whole plate to its container.

export const SKY_BOX = { width: 1000, height: 700 } as const;

/** How far the ring of clusters reaches, in plate units per layout unit. */
const RING = { x: 700, y: 690 } as const;
/** Plate units per layout unit inside a cluster: one scale both ways, so spirals stay round. */
const STAR_SCALE = 700;
/** The spokes run this far past a cluster, as a share of its distance from the core. */
const SPOKE_REACH = 1.34;

export type LabelSide = 'above' | 'below' | 'left' | 'right';

export interface SkyPoint {
  x: number;
  y: number;
}

export interface SkyCluster extends SkyPoint {
  id: DimensionId;
  /** Encloses every star of the cluster. */
  radius: number;
  level: SkillLevel;
  focus: boolean;
  /** Stars lit: one per scored call, up to the number of stars. */
  lit: number;
  /** Which way the name sits from the cluster, so names run outward and never across the core. */
  side: LabelSide;
}

export interface SkyStar extends SkyPoint {
  /** `${skill}:${index}`, as in the layout. */
  id: string;
  cluster: DimensionId;
  index: number;
  lit: boolean;
  /** Lit by the newest call. */
  recent: boolean;
}

export interface SkyLink {
  cluster: DimensionId;
  from: SkyPoint;
  to: SkyPoint;
  /** 0 until both ends are lit, then 0.2 to 1 with the skill's level. */
  strength: number;
  toCore: boolean;
}

export interface SkyChart {
  box: typeof SKY_BOX;
  core: SkyPoint;
  clusters: SkyCluster[];
  stars: SkyStar[];
  links: SkyLink[];
  /** Faint construction lines: rings around the core and a spoke through every cluster. */
  graticule: { rings: { rx: number; ry: number }[]; spokes: { from: SkyPoint; to: SkyPoint }[] };
}

const round = (value: number) => Math.round(value * 100) / 100;

/** Names run away from the core: above for the clusters in the top third of the ring, and so on. */
export function labelSide(dx: number, dy: number): LabelSide {
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angle > -35 && angle <= 35) return 'right';
  if (angle > 35 && angle <= 145) return 'below';
  if (angle > -145 && angle <= -35) return 'above';
  return 'left';
}

export function skyChart(
  skills: readonly SkillInput[],
  recent: ReadonlySet<string> = new Set(),
  options: { seed?: number } = {},
): SkyChart {
  const layout = constellationLayout(skills, options);
  const { width, height } = SKY_BOX;
  const core = { x: width / 2, y: height / 2 };

  const centres = new Map<DimensionId, SkyPoint>();
  const clusters: SkyCluster[] = layout.clusters.map((cluster) => {
    const x = core.x + (cluster.x - layout.core.x) * RING.x;
    const y = core.y + (cluster.y - layout.core.y) * RING.y;
    centres.set(cluster.id, { x, y });
    const lit = layout.nodes.filter((node) => node.cluster === cluster.id && node.lit).length;
    return {
      id: cluster.id,
      x: round(x),
      y: round(y),
      radius: round(cluster.radius * STAR_SCALE),
      level: cluster.level,
      focus: cluster.focus,
      lit,
      side: labelSide(x - core.x, y - core.y),
    };
  });

  const layoutCentre = new Map(layout.clusters.map((cluster) => [cluster.id, cluster]));
  const place = new Map<string, SkyPoint>();
  const stars: SkyStar[] = layout.nodes.map((node) => {
    const centre = centres.get(node.cluster) as SkyPoint;
    const from = layoutCentre.get(node.cluster) as { x: number; y: number };
    const point = {
      x: round(centre.x + (node.x - from.x) * STAR_SCALE),
      y: round(centre.y + (node.y - from.y) * STAR_SCALE),
    };
    place.set(node.id, point);
    return {
      ...point,
      id: node.id,
      cluster: node.cluster,
      index: Number(node.id.slice(node.id.lastIndexOf(':') + 1)),
      lit: node.lit,
      recent: node.lit && recent.has(node.id),
    };
  });

  const links: SkyLink[] = layout.links.map((link) => {
    const cluster = link.from.slice(0, link.from.lastIndexOf(':')) as DimensionId;
    const toCore = link.to === CORE_ID;
    return {
      cluster,
      from: place.get(link.from) as SkyPoint,
      to: toCore ? core : (place.get(link.to) as SkyPoint),
      strength: link.strength,
      toCore,
    };
  });

  const spokes = clusters.map((cluster) => ({
    from: core,
    to: {
      x: round(core.x + (cluster.x - core.x) * SPOKE_REACH),
      y: round(core.y + (cluster.y - core.y) * SPOKE_REACH),
    },
  }));
  const rings = [0.13, 0.26, 0.39].map((share) => ({
    rx: round(RING.x * share),
    ry: round(RING.y * share),
  }));

  return { box: SKY_BOX, core, clusters, stars, links, graticule: { rings, spokes } };
}

/** A point on the plate as CSS percentages of the plate, for the buttons and names laid over it. */
export function skyPercent(point: SkyPoint): { left: string; top: string } {
  return {
    left: `${round((point.x / SKY_BOX.width) * 100)}%`,
    top: `${round((point.y / SKY_BOX.height) * 100)}%`,
  };
}
