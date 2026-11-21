import { DIFFICULTY_RANK } from '#shared/domain/vocab.ts';
import type { AtlasLayout, AtlasMission, AtlasModel } from './atlas-model.ts';

// The geometry of the mission plate in screen pixels: where each mission sits in a plate of a given
// size, how large its glyph is drawn, how far its marks reach, which missions are joined by a
// hairline, and which one the pointer is nearest to. Pure numbers in and out: no DOM, no React, so
// every rule can be tested. Where a mission sits comes from `layoutAtlas` and never changes with
// the trainee's history, the recommendation or the lens.

export interface PlateSize {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** What the plate is drawn at when nothing has been measured yet (a test, or the first frame). */
export const FALLBACK_PLATE: PlateSize = { width: 960, height: 640 };

/** The aspect handed to the layout. It moves in steps, so a few pixels of resizing never shuffle the map. */
export function layoutAspect(size: PlateSize): number {
  const raw = size.height > 0 ? size.width / size.height : 1;
  const stepped = Math.round(raw * 20) / 20;
  return Math.min(3, Math.max(0.4, stepped));
}

export interface PlotNode extends Point {
  id: string;
  /** Radius of everything drawn for the mission, from its centre. */
  reach: number;
  /** 0 nearest (starter) to 1 deepest (challenge), from the layout. */
  depth: number;
}

/**
 * The glyph is drawn in a 92 unit box. Everything the marks reach (the outer ring, the minute
 * ticks) fits inside these shares of half the box, by impact; the glint of the suggested mission
 * reaches out to the whole box.
 */
const REACH_SHARE = { low: 0.72, medium: 0.8, high: 0.9 } as const;
const GLINT_SHARE = 1.06;

/** The distance from a mission's centre to the furthest mark of its glyph, in pixels. */
export function glyphReach(
  mission: Pick<AtlasMission, 'impact' | 'recommended'>,
  glyphSize: number,
): number {
  const share = mission.recommended
    ? GLINT_SHARE
    : (REACH_SHARE[mission.impact] ?? REACH_SHARE.high);
  return (glyphSize / 2) * share;
}

const MIN_GLYPH = 40;
const MAX_GLYPH = 80;

/**
 * How large to draw every glyph: as large as the nearest pair of missions allows (their marks stay
 * a few pixels apart), within a range that keeps the marks legible (about 40 px) and keeps a large
 * screen calm.
 */
export function glyphSizeFor(points: readonly Point[]): number {
  let nearest = Infinity;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i] as Point;
    for (let j = i + 1; j < points.length; j += 1) {
      const b = points[j] as Point;
      nearest = Math.min(nearest, Math.hypot(a.x - b.x, a.y - b.y));
    }
  }
  if (!Number.isFinite(nearest)) return MAX_GLYPH;
  const size = Math.floor((nearest * 1.04) / 2) * 2;
  return Math.min(MAX_GLYPH, Math.max(MIN_GLYPH, size));
}

export interface Plate {
  size: PlateSize;
  glyph: number;
  nodes: PlotNode[];
  byId: Map<string, PlotNode>;
}

/** The missions in plate pixels, with the glyph size and reach that suit them. */
export function projectAtlas(model: AtlasModel, layout: AtlasLayout, size: PlateSize): Plate {
  const points = layout.nodes.map((node) => ({ x: node.x * size.width, y: node.y * size.height }));
  const glyph = glyphSizeFor(points);
  const nodes = model.missions.map((mission, index) => {
    const at = points[index] as Point;
    const node = layout.nodes[index];
    return {
      id: mission.id,
      x: Math.round(at.x * 10) / 10,
      y: Math.round(at.y * 10) / 10,
      reach: glyphReach(mission, glyph),
      depth: node?.depth ?? 0,
    };
  });
  return { size, glyph, nodes, byId: new Map(nodes.map((node) => [node.id, node])) };
}

// ------------------------------------------------------------------------------------------
// Constellations

export interface Link {
  family: string;
  from: string;
  to: string;
}

/**
 * The hairlines of a family: each mission is joined to the next one up in difficulty (ties by id),
 * so a family of three reads as a short chain, gentlest to hardest. A family of one has none.
 */
export function constellationLinks(missions: readonly AtlasMission[]): Link[] {
  const families = new Map<string, AtlasMission[]>();
  for (const mission of missions) {
    const list = families.get(mission.family) ?? [];
    list.push(mission);
    families.set(mission.family, list);
  }
  const links: Link[] = [];
  for (const [family, members] of families) {
    const ordered = [...members].sort(
      (a, b) =>
        DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty] ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
    for (let i = 0; i + 1 < ordered.length; i += 1) {
      links.push({
        family,
        from: (ordered[i] as AtlasMission).id,
        to: (ordered[i + 1] as AtlasMission).id,
      });
    }
  }
  return links;
}

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** A link as a line between the edges of two glyphs (not their centres), or null if they touch. */
export function linkSegment(a: PlotNode, b: PlotNode, gap = 6): Segment | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  const start = a.reach + gap;
  const end = b.reach + gap;
  if (length <= start + end) return null;
  const ux = dx / length;
  const uy = dy / length;
  return {
    x1: round(a.x + ux * start),
    y1: round(a.y + uy * start),
    x2: round(b.x - ux * end),
    y2: round(b.y - uy * end),
  };
}

const round = (value: number) => Math.round(value * 10) / 10;

// ------------------------------------------------------------------------------------------
// The pointer

export interface NearestOptions {
  /** How close a mission must be to be picked when nothing is. */
  acquire: number;
  /** How far the current mission may drift before it is let go: a little more than `acquire`. */
  release: number;
  /** The mission already picked, if any. */
  current: string | null;
}

/**
 * The mission the pointer is nearest to, or null when none is near. Once one is picked it stays
 * picked until the pointer is further than `release`, unless another is clearly nearer, so the
 * detail does not flicker between two neighbours.
 */
export function nearestMission(
  nodes: readonly PlotNode[],
  at: Point,
  { acquire, release, current }: NearestOptions,
): string | null {
  let best: PlotNode | null = null;
  let bestDistance = Infinity;
  let kept: PlotNode | null = null;
  let keptDistance = Infinity;
  for (const node of nodes) {
    const distance = Math.hypot(node.x - at.x, node.y - at.y) - node.reach;
    if (node.id === current) {
      kept = node;
      keptDistance = distance;
    }
    if (distance < bestDistance || (distance === bestDistance && best && node.id < best.id)) {
      best = node;
      bestDistance = distance;
    }
  }
  if (
    kept &&
    keptDistance <= release &&
    (!best || best === kept || bestDistance > keptDistance - 12)
  ) {
    return kept.id;
  }
  return best && bestDistance <= acquire ? best.id : null;
}
