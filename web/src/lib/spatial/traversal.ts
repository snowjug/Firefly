// Keyboard traversal for spatial maps: nodes placed on a plane (a constellation, a map of moments)
// rather than in a list. An arrow key should move toward whatever lies in that direction, the way
// an eye would, not follow DOM order. This is plain geometry on screen coordinates (x grows to the
// right, y grows downwards), so it needs no DOM and can be tested directly.

export interface SpatialPoint {
  id: string;
  x: number;
  y: number;
}

export type Direction = 'left' | 'right' | 'up' | 'down';

export interface TraversalOptions {
  /** Half-angle of the cone searched around the direction, in degrees (0 to 90). Default 60. */
  coneDegrees?: number;
  /** With nothing ahead, jump to the far side like a ring instead of staying where you are. */
  wrap?: boolean;
}

export const DEFAULT_CONE_DEGREES = 60;

const AXES: Record<Direction, { x: number; y: number }> = {
  right: { x: 1, y: 0 },
  left: { x: -1, y: 0 },
  down: { x: 0, y: 1 },
  up: { x: 0, y: -1 },
};

const RIGHT_ANGLE = Math.PI / 2;

/** A point 90 degrees off the axis would count as twice as far away; one on the axis as itself. */
const SIDEWAYS_PENALTY = 1;

/** Keeps a point exactly on the cone's edge inside it, whatever the rounding does to the angle. */
const EDGE_TOLERANCE = 1e-9;

// Ids are compared by code unit, never with a locale, so ties come out the same on every machine.
function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// A node with no usable position (a layout that has not been measured yet) cannot be steered to or
// from, but it must not break the others either.
function isPlaced(point: SpatialPoint): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function compareReading(a: SpatialPoint, b: SpatialPoint): number {
  const aPlaced = isPlaced(a);
  if (aPlaced !== isPlaced(b)) return aPlaced ? -1 : 1;
  if (!aPlaced) return compareIds(a.id, b.id);
  if (a.y !== b.y) return a.y < b.y ? -1 : 1;
  if (a.x !== b.x) return a.x < b.x ? -1 : 1;
  return compareIds(a.id, b.id);
}

/**
 * The points as they would be read: row by row from the top, each row from the left. Rows are
 * exact (a point one pixel lower starts the next row), so lay nodes out on a grid when a row
 * should read as one. Points in the very same place fall back to their id, so the order never
 * depends on how the caller happened to list them. Points without a usable position come last.
 */
export function readingOrder(points: readonly SpatialPoint[]): SpatialPoint[] {
  return [...points].sort(compareReading);
}

interface Candidate {
  id: string;
  /** How far the point lies along the direction. Negative means behind. */
  along: number;
  /** How far it lies to the side of the direction's axis. Never negative. */
  across: number;
}

interface Scored extends Candidate {
  score: number;
}

function pick<T extends Candidate>(best: T | undefined, next: T, order: (a: T, b: T) => number): T {
  return best === undefined || order(next, best) < 0 ? next : best;
}

// The lowest score wins, then the lowest id.
const byScore = (a: Scored, b: Scored) => a.score - b.score || compareIds(a.id, b.id);

// Smallest `along` first: the nearest point ahead, or the farthest one behind (it is the most
// negative). Whichever is less off to the side wins a tie, then the lowest id.
const byAlong = (a: Candidate, b: Candidate) =>
  a.along - b.along || a.across - b.across || compareIds(a.id, b.id);

function coneRadians(degrees: number | undefined): number {
  const clamped =
    degrees === undefined || Number.isNaN(degrees)
      ? DEFAULT_CONE_DEGREES
      : Math.min(90, Math.max(0, degrees));
  return (clamped * Math.PI) / 180;
}

/**
 * Where an arrow key should move focus from `currentId`. Returns the id to focus: the next point,
 * or `currentId` when there is nowhere to go. `null` comes back only when there are no points.
 *
 * With no current point (`null`, or an id that is not in `points`) the first point in reading
 * order is returned, so a map can always be entered from the keyboard.
 *
 * Otherwise the nearest point inside a cone around the direction wins. Distance is scaled up the
 * further a point sits off the axis, so a node straight ahead beats a slightly nearer one at the
 * edge of the cone. When the cone is empty the nearest point ahead, measured along the axis, is
 * used instead, so every node that lies ahead stays reachable. With `wrap`, and nothing ahead at
 * all, focus jumps to the farthest point on the opposite side (preferring the same row or column),
 * which makes the arrow keys rove like a ring. Ties are broken by id.
 *
 * A point exactly beside the current one (no progress along the axis), or in the very same place,
 * is never "ahead". Reading order is how to reach those.
 */
export function nextInDirection(
  points: readonly SpatialPoint[],
  currentId: string | null,
  direction: Direction,
  options: TraversalOptions = {},
): string | null {
  if (points.length === 0) return null;
  const from = currentId === null ? undefined : points.find((point) => point.id === currentId);
  if (!from) return readingOrder(points)[0]?.id ?? null;
  if (!isPlaced(from)) return from.id;

  const axis = AXES[direction];
  const cone = coneRadians(options.coneDegrees);
  let inCone: Scored | undefined;
  let ahead: Candidate | undefined;
  let behind: Candidate | undefined;

  for (const point of points) {
    if (point.id === from.id || !isPlaced(point)) continue;
    const dx = point.x - from.x;
    const dy = point.y - from.y;
    const along = dx * axis.x + dy * axis.y;
    const across = Math.abs(dy * axis.x - dx * axis.y);
    if (along > 0) {
      const angle = Math.atan2(across, along);
      const candidate = {
        id: point.id,
        along,
        across,
        score: Math.hypot(along, across) * (1 + (SIDEWAYS_PENALTY * angle) / RIGHT_ANGLE),
      };
      ahead = pick(ahead, candidate, byAlong);
      if (angle <= cone + EDGE_TOLERANCE) inCone = pick(inCone, candidate, byScore);
    } else if (along < 0) {
      behind = pick(behind, { id: point.id, along, across }, byAlong);
    }
  }

  if (inCone) return inCone.id;
  if (ahead) return ahead.id;
  return options.wrap && behind ? behind.id : from.id;
}
