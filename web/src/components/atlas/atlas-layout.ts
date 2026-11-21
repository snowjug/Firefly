import { DIFFICULTY_RANK, ISSUE_TYPES, type IssueType } from '#shared/domain/vocab.ts';
import { noise, signedNoise } from '../../lib/seeded-noise.ts';
import type { AtlasMission, AtlasModel } from './atlas-model.ts';

// Where each mission is drawn on the atlas. Positions are normalised (0..1 in both directions) and
// depend only on the catalogue (each mission's id, family and difficulty) and the seed: never on
// the trainee's history, the recommendation or the lens, so finishing a call or typing in the
// search never moves a mission. The same input and seed always give exactly the same layout.

/** Everything stays inside this square, which leaves room for labels and glow at the edges. */
export const ATLAS_BOUNDS = { min: 0.06, max: 0.94 } as const;

/**
 * No two missions are drawn closer than this. It is measured in units of the map's height, with the
 * horizontal distance scaled by `aspect`, so on screen it is the same in every direction. The
 * 13-mission catalogue clears it with room to spare, and it holds well beyond that (to about a
 * hundred missions on a square map, fewer on a narrow one). Past that the area cannot fit them, so
 * the target eases instead of the layout failing.
 */
export const MIN_MISSION_DISTANCE = 0.075;

export interface AtlasNode {
  id: string;
  x: number;
  y: number;
  /** 0 is nearest (starter) and 1 is deepest (challenge): for parallax, scale and blur. */
  depth: number;
}

export interface AtlasAnchor {
  family: IssueType;
  x: number;
  y: number;
}

export interface AtlasLayout {
  /** In the same order as `model.missions`. */
  nodes: AtlasNode[];
  /** One for each family that has a mission, in the order of the issue type vocabulary. */
  anchors: AtlasAnchor[];
}

export interface AtlasLayoutOptions {
  /** Changes the arrangement, never the depth. The same seed always gives the same map. */
  seed?: number;
  /** Width divided by height of the area the map is drawn in (default 1), so orbits stay round. */
  aspect?: number;
}

const DEFAULT_SEED = 1;
/** How far the family anchors sit from the centre, at most. */
const RING_RADIUS = 0.33;
/** Each anchor's distance from the centre varies by up to this share (a loose ring). */
const RING_LOOSENESS = 0.11;
/** ...and its angle by up to this share of the gap between neighbouring families. */
const ANGLE_LOOSENESS = 0.2;
const EDGE_MARGIN = 0.015;
/** How far apart the missions of one family start out: comfortably more than the minimum. */
const ORBIT_SPACING = MIN_MISSION_DISTANCE * 1.4;
/** Rounding positions to four decimals can bring two missions this much closer. */
const ROUNDING_MARGIN = 0.0005;
const MAX_PASSES = 400;
const DEPTH_SEED = 0x0d37;

const round = (value: number) => Math.round(value * 10_000) / 10_000;
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
/** Like clamp, but a range that does not exist (a cluster wider than the map) means the middle. */
const fit = (value: number, low: number, high: number) =>
  low > high ? 0.5 : clamp(value, low, high);

// ------------------------------------------------------------------------------------------
// Depth

/**
 * Starter sits in the nearest band, standard in the middle and challenge in the deepest. A small
 * offset from the id alone spreads each band out, and the bands never overlap, so depth always
 * agrees with difficulty. It does not use the seed: a mission keeps its depth whatever the layout.
 */
function depthOf(mission: AtlasMission): number {
  const base = 0.08 + DIFFICULTY_RANK[mission.difficulty] * 0.42;
  return round(clamp(base + signedNoise(DEPTH_SEED, `depth:${mission.id}`) * 0.08, 0, 1));
}

// ------------------------------------------------------------------------------------------
// Families and their orbits

interface Group {
  family: IssueType;
  /** Gentlest first, ties settled by id, so nothing depends on titles or listing order. */
  missions: AtlasMission[];
}

const byDifficultyThenId = (a: AtlasMission, b: AtlasMission) =>
  DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty] ||
  (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function groupByFamily(missions: readonly AtlasMission[]): Group[] {
  const groups = new Map<IssueType, AtlasMission[]>();
  for (const mission of missions) {
    const list = groups.get(mission.family) ?? [];
    list.push(mission);
    groups.set(mission.family, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => ISSUE_TYPES.indexOf(a) - ISSUE_TYPES.indexOf(b))
    .map(([family, list]) => ({ family, missions: list.sort(byDifficultyThenId) }));
}

/** How far from its anchor the outermost mission of a family sits, in units of the map's height. */
function orbitExtent(count: number): number {
  if (count <= 1) return 0;
  if (count <= 6) return ORBIT_SPACING / (2 * Math.sin(Math.PI / count));
  let rings = 1;
  while (3 * rings * (rings + 1) < count) rings += 1;
  return rings * ORBIT_SPACING;
}

interface Offset {
  dx: number;
  dy: number;
}

/**
 * Where a family's missions sit around its anchor. One sits on it; up to six share a ring just far
 * enough out to keep their spacing; more fill further rings (six, then twelve, then eighteen...)
 * with each ring turned half a step from the one inside it. `phase` turns the whole cluster so
 * the families do not all look alike.
 */
function orbit(count: number, phase: number): Offset[] {
  if (count <= 0) return [];
  if (count === 1) return [{ dx: 0, dy: 0 }];
  const offsets: Offset[] = [];
  let placed = 0;
  for (let ring = 1; placed < count; ring += 1) {
    const here = Math.min(count - placed, ring * 6);
    const radius = count <= 6 ? orbitExtent(count) : ring * ORBIT_SPACING;
    const step = (Math.PI * 2) / here;
    const turn = phase + (ring % 2 === 0 ? step / 2 : 0);
    for (let i = 0; i < here; i += 1) {
      offsets.push({
        dx: Math.cos(turn + i * step) * radius,
        dy: Math.sin(turn + i * step) * radius,
      });
    }
    placed += here;
  }
  return offsets;
}

// ------------------------------------------------------------------------------------------
// Anchors

/**
 * The families sit on a loose ring around the centre, in vocabulary order, starting at the top.
 * Each anchor's angle and distance are nudged by the seed (one family at a time, so a family keeps
 * its nudge when another is added), which makes the ring slightly lopsided. The ring is sized so
 * that the widest cluster still fits inside the bounds.
 */
function placeAnchors(groups: readonly Group[], seed: number, aspect: number): AtlasAnchor[] {
  const first = groups[0];
  if (!first) return [];
  if (groups.length === 1) return [{ family: first.family, x: 0.5, y: 0.5 }];

  const low = ATLAS_BOUNDS.min;
  const high = ATLAS_BOUNDS.max;
  const widest = Math.max(...groups.map((group) => orbitExtent(group.missions.length)));
  const reach = (extent: number) =>
    clamp((0.5 - low - extent - EDGE_MARGIN) / (1 + RING_LOOSENESS), 0.04, RING_RADIUS);
  const radiusX = reach(widest / aspect);
  const radiusY = reach(widest);

  const slot = (Math.PI * 2) / groups.length;
  // An even number of families starts half a slot round, so none sits exactly at the top.
  const start = -Math.PI / 2 - (groups.length % 2 === 0 ? slot / 2 : 0);
  return groups.map((group, index) => {
    const angle =
      start +
      index * slot +
      signedNoise(seed, `anchor-angle:${group.family}`) * ANGLE_LOOSENESS * slot;
    const stretch = 1 + signedNoise(seed, `anchor-reach:${group.family}`) * RING_LOOSENESS;
    const extent = orbitExtent(group.missions.length);
    return {
      family: group.family,
      x: fit(
        0.5 + Math.cos(angle) * radiusX * stretch,
        low + extent / aspect,
        high - extent / aspect,
      ),
      y: fit(0.5 + Math.sin(angle) * radiusY * stretch, low + extent, high - extent),
    };
  });
}

// ------------------------------------------------------------------------------------------
// Relaxation

interface Body {
  id: string;
  x: number;
  y: number;
}

interface Box {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function keepInside(body: Body, box: Box): void {
  body.x = clamp(body.x, box.minX, box.maxX);
  body.y = clamp(body.y, box.minY, box.maxY);
}

/**
 * Pushes any two bodies closer than `gap` apart, pair by pair in a fixed order, until none is or
 * the passes run out. A body held against an edge cannot give way, so its partner takes the whole
 * push. Bodies that start in the same spot are separated along a direction taken from their ids.
 */
function relax(bodies: Body[], gap: number, box: Box): void {
  for (const body of bodies) keepInside(body, box);
  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    let crowded = false;
    for (let i = 0; i < bodies.length; i += 1) {
      const a = bodies[i] as Body;
      for (let j = i + 1; j < bodies.length; j += 1) {
        const b = bodies[j] as Body;
        let ux = b.x - a.x;
        let uy = b.y - a.y;
        let distance = Math.hypot(ux, uy);
        if (distance >= gap) continue;
        crowded = true;
        if (distance < 1e-9) {
          const angle = noise(0, `${a.id}|${b.id}`) * Math.PI * 2;
          ux = Math.cos(angle);
          uy = Math.sin(angle);
          distance = 0;
        } else {
          ux /= distance;
          uy /= distance;
        }
        // A hair more than needed, so floating point cannot leave a pair a rounding error short.
        const need = gap - distance + 1e-9;
        const fromX = a.x;
        const fromY = a.y;
        a.x -= ux * (need / 2);
        a.y -= uy * (need / 2);
        keepInside(a, box);
        const gave = (fromX - a.x) * ux + (fromY - a.y) * uy;
        b.x += ux * (need - gave);
        b.y += uy * (need - gave);
        keepInside(b, box);
      }
    }
    if (!crowded) return;
  }
}

/**
 * The distance to aim for. Normally the minimum; but in an area too small to hold this many
 * missions that far apart (the densest packing is hexagonal, and a simple push gets about 80% of
 * it) it eases, so the push still settles instead of piling them against the edges.
 */
function separationFor(count: number, aspect: number): number {
  const span = ATLAS_BOUNDS.max - ATLAS_BOUNDS.min;
  const area = span * span * aspect;
  const capacity = 0.8 * Math.sqrt((2 * area) / (Math.sqrt(3) * Math.max(1, count)));
  return Math.min(MIN_MISSION_DISTANCE, capacity);
}

// ------------------------------------------------------------------------------------------

/**
 * Lays the atlas out. Family anchors sit on a loose ring, missions orbit their anchor, and a small
 * relaxation then makes sure no two missions are closer than `MIN_MISSION_DISTANCE`. Positions
 * are rounded to four decimals, so the output is the same on every machine.
 */
export function layoutAtlas(model: AtlasModel, options: AtlasLayoutOptions = {}): AtlasLayout {
  const seed =
    options.seed !== undefined && Number.isFinite(options.seed) ? options.seed : DEFAULT_SEED;
  const aspect =
    options.aspect !== undefined && Number.isFinite(options.aspect) && options.aspect > 0
      ? clamp(options.aspect, 0.4, 3)
      : 1;

  const groups = groupByFamily(model.missions);
  const anchors = placeAnchors(groups, seed, aspect);

  // Work in units of the map's height, so that a distance means the same thing in every direction.
  const bodies = new Map<AtlasMission, Body>();
  const ordered: Body[] = [];
  groups.forEach((group, index) => {
    const anchor = anchors[index] as AtlasAnchor;
    const offsets = orbit(
      group.missions.length,
      noise(seed, `orbit:${group.family}`) * Math.PI * 2,
    );
    group.missions.forEach((mission, slot) => {
      const offset = offsets[slot] as Offset;
      const body = { id: mission.id, x: anchor.x * aspect + offset.dx, y: anchor.y + offset.dy };
      bodies.set(mission, body);
      ordered.push(body);
    });
  });
  relax(ordered, separationFor(ordered.length, aspect) + ROUNDING_MARGIN, {
    minX: ATLAS_BOUNDS.min * aspect,
    maxX: ATLAS_BOUNDS.max * aspect,
    minY: ATLAS_BOUNDS.min,
    maxY: ATLAS_BOUNDS.max,
  });

  return {
    nodes: model.missions.map((mission) => {
      const body = bodies.get(mission) as Body;
      return {
        id: mission.id,
        x: round(clamp(body.x / aspect, ATLAS_BOUNDS.min, ATLAS_BOUNDS.max)),
        y: round(clamp(body.y, ATLAS_BOUNDS.min, ATLAS_BOUNDS.max)),
        depth: depthOf(mission),
      };
    }),
    anchors: anchors.map((anchor) => ({
      family: anchor.family,
      x: round(anchor.x),
      y: round(anchor.y),
    })),
  };
}
