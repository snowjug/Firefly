import type { PlotNode, PlateSize, Point, Segment } from './atlas-plate.ts';

// Where the words on the mission plate go, worked out from numbers alone so that it is the same on
// every machine and can be tested without a browser. The plate hands in where each mission is, how
// far its marks reach and what its label says; this decides, for every label, which side of its
// glyph it sits on, and tells the page to leave out any label that cannot be placed without
// touching something else (the mission is still named in the list, in the detail that opens on
// focus and in its accessible description).
//
// Nothing is measured in the browser. Text widths come from the advances of the real fonts
// (Newsreader for titles, IBM Plex Mono for the small lines), kept a little wide, and the page
// draws exactly the lines decided here, so the box that was checked is the box that is drawn.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Side = 'e' | 'w' | 's' | 'n' | 'se' | 'sw' | 'ne' | 'nw';
export type Align = 'start' | 'end' | 'center';

export interface LabelMetrics {
  titleSize: number;
  titleLine: number;
  kickerSize: number;
  kickerLine: number;
  /** The widest a label may be. */
  maxWidth: number;
  /** Title lines at most; a longer title ends in an ellipsis. */
  maxLines: number;
  /** Between a glyph and its label. */
  gap: number;
  /** Between two labels, and between a label and another glyph. */
  clearance: number;
  /** Kept free at the edge of the plate (the rulers run there). */
  edge: number;
  /** Whether the small family names are drawn at all. */
  families: boolean;
}

/** Label sizes for a plate of this width: smaller words and narrower labels on a narrow plate. */
export function labelMetricsFor(plateWidth: number): LabelMetrics {
  if (plateWidth >= 900) {
    return {
      titleSize: 16,
      titleLine: 20,
      kickerSize: 12,
      kickerLine: 16,
      maxWidth: 232,
      maxLines: 2,
      gap: 10,
      clearance: 6,
      edge: 12,
      families: true,
    };
  }
  if (plateWidth >= 600) {
    return {
      titleSize: 16,
      titleLine: 20,
      kickerSize: 12,
      kickerLine: 16,
      maxWidth: 188,
      maxLines: 2,
      gap: 8,
      clearance: 6,
      edge: 12,
      families: true,
    };
  }
  return {
    titleSize: 15,
    titleLine: 19,
    kickerSize: 12,
    kickerLine: 16,
    maxWidth: 148,
    maxLines: 3,
    gap: 6,
    clearance: 5,
    edge: 10,
    families: false,
  };
}

// ------------------------------------------------------------------------------------------
// Text

/** Advance widths of Newsreader (regular) for the printable ASCII characters, from a space, in 1/1000 em. */
const ADVANCES = [
  229, 270, 354, 567, 567, 781, 717, 199, 285, 285, 435, 511, 239, 354, 230, 401, 567, 567, 567,
  567, 567, 567, 567, 567, 567, 567, 253, 269, 511, 511, 511, 441, 891, 711, 644, 705, 763, 640,
  592, 751, 800, 339, 446, 730, 603, 979, 771, 777, 609, 777, 645, 555, 670, 768, 692, 967, 719,
  684, 634, 329, 401, 330, 511, 410, 500, 460, 546, 437, 556, 462, 345, 496, 561, 280, 247, 541,
  269, 832, 573, 526, 564, 545, 394, 384, 342, 537, 527, 743, 507, 524, 431, 322, 252, 322, 511,
] as const;

/** Anything outside ASCII (an accent, a dash) is taken to be about as wide as a wide letter. */
const OTHER_ADVANCE = 620;
const ELLIPSIS_ADVANCE = 900;
/** The estimate is kept a little wider than the real thing, so a label never grows past its box. */
const SAFETY = 1.035;

function advance(character: string): number {
  if (character === '\u2026') return ELLIPSIS_ADVANCE;
  const code = character.charCodeAt(0);
  return code >= 32 && code <= 126 ? (ADVANCES[code - 32] ?? OTHER_ADVANCE) : OTHER_ADVANCE;
}

/** How wide a run of title text is, in px, at a font size. */
export function titleWidth(text: string, size: number): number {
  let total = 0;
  for (const character of text) total += advance(character);
  return (total / 1000) * size * SAFETY;
}

/** IBM Plex Mono advances 0.6 em, and the small lines are tracked at 0.1 em. */
export function kickerWidth(text: string, size = 12, tracking = 0.1): number {
  return [...text].length * (0.6 + tracking) * size;
}

/**
 * Breaks a title into at most `maxLines` lines no wider than `maxWidth`, at spaces where it can and
 * inside a word where it must. What does not fit ends the last line with an ellipsis.
 */
export function wrapTitle(
  text: string,
  maxWidth: number,
  size: number,
  maxLines: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let line = '';
  const push = () => {
    if (line) lines.push(line);
    line = '';
  };
  for (const word of words) {
    let rest = word;
    while (titleWidth(rest, size) > maxWidth) {
      // A single word wider than the label: cut it where the width runs out.
      push();
      let cut = 1;
      while (cut < rest.length && titleWidth(rest.slice(0, cut + 1), size) <= maxWidth) cut += 1;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
      if (lines.length > maxLines) break;
    }
    if (rest === '') continue;
    const candidate = line ? `${line} ${rest}` : rest;
    if (titleWidth(candidate, size) <= maxWidth) line = candidate;
    else {
      push();
      line = rest;
    }
  }
  push();
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1] as string;
  while (last.length > 1 && titleWidth(`${last}\u2026`, size) > maxWidth) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last.replace(/[\s,;:.-]+$/, '')}\u2026`;
  return kept;
}

// ------------------------------------------------------------------------------------------
// Geometry

const overlaps = (a: Rect, b: Rect, clearance = 0): boolean =>
  a.x < b.x + b.w + clearance &&
  b.x < a.x + a.w + clearance &&
  a.y < b.y + b.h + clearance &&
  b.y < a.y + a.h + clearance;

/** Whether a rectangle comes within `radius` of a point (a glyph and its reach). */
export function touchesCircle(rect: Rect, centre: Point, radius: number): boolean {
  const dx = Math.max(rect.x - centre.x, 0, centre.x - (rect.x + rect.w));
  const dy = Math.max(rect.y - centre.y, 0, centre.y - (rect.y + rect.h));
  return dx * dx + dy * dy < radius * radius;
}

const inside = (rect: Rect, size: PlateSize, edge: number): boolean =>
  rect.x >= edge &&
  rect.y >= edge &&
  rect.x + rect.w <= size.width - edge &&
  rect.y + rect.h <= size.height - edge;

/** Whether a line segment passes through a rectangle (a link running under a label). */
function crosses(segment: Segment, rect: Rect): boolean {
  const { x1, y1, x2, y2 } = segment;
  if (Math.max(x1, x2) < rect.x || Math.min(x1, x2) > rect.x + rect.w) return false;
  if (Math.max(y1, y2) < rect.y || Math.min(y1, y2) > rect.y + rect.h) return false;
  const corners: Point[] = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x + rect.w, y: rect.y + rect.h },
    { x: rect.x, y: rect.y + rect.h },
  ];
  const side = (p: Point) => (x2 - x1) * (p.y - y1) - (y2 - y1) * (p.x - x1);
  const signs = corners.map(side);
  return signs.some((s) => s > 0) && signs.some((s) => s < 0);
}

const DIRECTIONS: Record<Side, Point> = {
  e: { x: 1, y: 0 },
  w: { x: -1, y: 0 },
  s: { x: 0, y: 1 },
  n: { x: 0, y: -1 },
  se: { x: Math.SQRT1_2, y: Math.SQRT1_2 },
  sw: { x: -Math.SQRT1_2, y: Math.SQRT1_2 },
  ne: { x: Math.SQRT1_2, y: -Math.SQRT1_2 },
  nw: { x: -Math.SQRT1_2, y: -Math.SQRT1_2 },
};
/** Sides in the order that settles ties, and what each costs before the lean away from the family. */
const SIDE_ORDER: readonly Side[] = ['e', 'w', 's', 'n', 'se', 'sw', 'ne', 'nw'];
const SIDE_COST: Record<Side, number> = {
  e: 0,
  w: 0,
  s: 1.5,
  n: 3,
  se: 2,
  sw: 2,
  ne: 3.5,
  nw: 3.5,
};
const LEAN = 6;
const CROSSING_COST = 3;
const FAMILY_ORDER = ['above', 'below', 'left', 'right'] as const;

const ALIGN: Record<Side, Align> = {
  e: 'start',
  w: 'end',
  s: 'center',
  n: 'center',
  se: 'start',
  sw: 'end',
  ne: 'start',
  nw: 'end',
};

// ------------------------------------------------------------------------------------------
// Mission labels

export interface LabelNode {
  id: string;
  x: number;
  y: number;
  /** How far the glyph's marks reach from its centre. */
  reach: number;
  /** A small line above the title: "Starter · 8 min". */
  kicker: string;
  title: string;
  /** The family's anchor: a label leans away from it, out of its own constellation. */
  anchor: Point;
  /** The suggested mission is placed first and dropped last. */
  recommended?: boolean;
}

export interface PlacedLabel {
  id: string;
  side: Side;
  align: Align;
  rect: Rect;
  kicker: string;
  /** The title lines to draw, as wrapped here. */
  lines: string[];
  /** A hairline from the glyph, when the label sits a little way off to find room. */
  leader: Segment | null;
}

export interface FamilyNode {
  id: string;
  text: string;
  /** The ids of the family's missions, which the name is placed beside. */
  members: string[];
}

export interface PlacedFamily {
  id: string;
  side: 'above' | 'below' | 'left' | 'right';
  align: Align;
  rect: Rect;
  text: string;
  /** A hairline from the name to the nearest mission when they are not touching. */
  leader: Segment | null;
}

export interface PlaceInput {
  size: PlateSize;
  nodes: readonly LabelNode[];
  families?: readonly FamilyNode[];
  /** The hairlines between missions, which labels keep out of where they can. */
  links?: readonly Segment[];
  metrics: LabelMetrics;
}

export interface Placement {
  labels: PlacedLabel[];
  /** Missions whose label did not fit anywhere without touching another mark. */
  hidden: string[];
  families: PlacedFamily[];
  hiddenFamilies: string[];
}

interface Candidate {
  rect: Rect;
  cost: number;
  side: Side;
  /** For family names: which edge of the constellation. */
  edgeSide?: PlacedFamily['side'];
  align: Align;
  /** For mission labels: the title lines that were measured for this box. */
  lines?: string[];
  /** For mission labels: the small line, or '' where the shape leaves it out. */
  kicker?: string;
  /** A family name stacked on one of its own missions' labels: no hairline needed. */
  stacked?: boolean;
  /** A hairline to the glyph, for a label set a little way off; its thin box is kept clear too. */
  leader?: Segment;
  extras?: Rect[];
}

interface Item {
  key: string;
  candidates: Candidate[];
  priority: number;
}

const unit = (v: Point): Point => {
  const length = Math.hypot(v.x, v.y);
  return length < 1e-6 ? { x: 1, y: 0 } : { x: v.x / length, y: v.y / length };
};
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;

/**
 * A label can be wide and short or narrow and tall. The wide one is tried first; the others are
 * for where a constellation is tight and only a narrower label fits. The last two leave out the
 * small line (how hard, how long), which the glyph, the detail and the list all still say.
 */
const SHAPES = [
  { scale: 1, extraLines: 0, cost: 0, kicker: true },
  { scale: 0.72, extraLines: 1, cost: 1.4, kicker: true },
  { scale: 0.5, extraLines: 2, cost: 3, kicker: true },
  { scale: 1, extraLines: 0, cost: 3.6, kicker: false },
  { scale: 0.62, extraLines: 1, cost: 4.4, kicker: false },
] as const;

function labelSize(node: LabelNode, metrics: LabelMetrics, shape: (typeof SHAPES)[number]) {
  const lines = wrapTitle(
    node.title,
    metrics.maxWidth * shape.scale,
    metrics.titleSize,
    metrics.maxLines + shape.extraLines,
  );
  const kicker = shape.kicker && node.kicker ? node.kicker : '';
  const widest = Math.max(
    kicker ? kickerWidth(kicker, metrics.kickerSize) : 0,
    ...lines.map((line) => titleWidth(line, metrics.titleSize)),
  );
  const width = Math.ceil(widest);
  return {
    lines,
    kicker,
    width,
    height: (kicker ? metrics.kickerLine : 0) + lines.length * metrics.titleLine,
  };
}

function sideRect(side: Side, node: LabelNode, w: number, h: number, gap: number): Rect {
  const reach = node.reach;
  const diagonal = reach * Math.SQRT1_2 + gap * 0.6;
  switch (side) {
    case 'e':
      return { x: node.x + reach + gap, y: node.y - h / 2, w, h };
    case 'w':
      return { x: node.x - reach - gap - w, y: node.y - h / 2, w, h };
    case 's':
      return { x: node.x - w / 2, y: node.y + reach + gap, w, h };
    case 'n':
      return { x: node.x - w / 2, y: node.y - reach - gap - h, w, h };
    case 'se':
      return { x: node.x + diagonal, y: node.y + diagonal, w, h };
    case 'sw':
      return { x: node.x - diagonal - w, y: node.y + diagonal, w, h };
    case 'ne':
      return { x: node.x + diagonal, y: node.y - diagonal - h, w, h };
    default:
      return { x: node.x - diagonal - w, y: node.y - diagonal - h, w, h };
  }
}

function missionCandidates(
  node: LabelNode,
  all: readonly LabelNode[],
  size: PlateSize,
  centre: Point,
  links: readonly Segment[],
  metrics: LabelMetrics,
): Candidate[] {
  // Which way to lean: out of the family, or out of the plate's middle for a mission on its own.
  let lean = unit({ x: node.x - node.anchor.x, y: node.y - node.anchor.y });
  if (Math.hypot(node.x - node.anchor.x, node.y - node.anchor.y) < 6) {
    lean = unit({ x: node.x - centre.x, y: node.y - centre.y });
  }
  const sides = SIDE_ORDER.map((side, order) => ({
    side,
    order,
    cost: (1 - dot(lean, DIRECTIONS[side])) * LEAN + SIDE_COST[side],
  })).sort((a, b) => a.cost - b.cost || a.order - b.order);

  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  for (const shape of SHAPES) {
    const { lines, kicker, width, height } = labelSize(node, metrics, shape);
    for (const { side, cost } of sides) {
      const rect = sideRect(side, node, width, height, metrics.gap);
      // Two shapes can come out the same (a short title): keep the first.
      const signature = `${side}:${rect.w}:${rect.h}`;
      if (seen.has(signature)) continue;
      seen.add(signature);
      if (!inside(rect, size, metrics.edge)) continue;
      // Clear of every other glyph (and its glint), and of its own by construction.
      if (
        all.some(
          (other) =>
            other.id !== node.id &&
            touchesCircle(rect, other, other.reach + metrics.clearance * 0.5),
        )
      ) {
        continue;
      }
      const struck = links.filter((link) => crosses(link, rect)).length;
      candidates.push({
        rect,
        cost: cost + shape.cost + struck * CROSSING_COST,
        side,
        align: ALIGN[side],
        lines,
        kicker,
      });
    }
  }

  // Last resort, for a tight constellation: the label a little further out, on a hairline.
  for (const shape of SHAPES.filter((one) => one.kicker).slice(0, 2)) {
    const { lines, kicker, width, height } = labelSize(node, metrics, shape);
    for (const { side, cost } of sides) {
      if (!CARDINAL.includes(side)) continue;
      FAR.forEach((extra, step) => {
        const rect = sideRect(side, node, width, height, metrics.gap + extra);
        if (!inside(rect, size, metrics.edge)) return;
        const leader = leaderTo(side, node, rect, metrics.gap + extra);
        const thin = thinRect(leader);
        const blocked = all.some(
          (other) =>
            other.id !== node.id &&
            (touchesCircle(rect, other, other.reach + metrics.clearance * 0.5) ||
              touchesCircle(thin, other, other.reach)),
        );
        if (blocked) return;
        candidates.push({
          rect,
          cost: cost + shape.cost + FAR_COST[step] + CROSSING_COST * 0.5,
          side,
          align: ALIGN[side],
          lines,
          kicker,
          leader,
          extras: [thin],
        });
      });
    }
  }
  return candidates.sort((a, b) => a.cost - b.cost);
}

const CARDINAL: readonly Side[] = ['e', 'w', 's', 'n'];
/** How much further out than the usual gap, and what it costs: it is the last thing to try. */
const FAR = [16, 36] as const;
const FAR_COST = [6, 9] as const;

/** The hairline from the edge of a glyph to a label that sits level with it, on one side. */
function leaderTo(side: Side, node: LabelNode, rect: Rect, span: number): Segment {
  const edge = 2;
  const end = span - 3;
  switch (side) {
    case 'e':
      return {
        x1: node.x + node.reach + edge,
        y1: node.y,
        x2: node.x + node.reach + end,
        y2: node.y,
      };
    case 'w':
      return {
        x1: node.x - node.reach - edge,
        y1: node.y,
        x2: node.x - node.reach - end,
        y2: node.y,
      };
    case 's':
      return { x1: node.x, y1: node.y + node.reach + edge, x2: node.x, y2: rect.y - 3 };
    default:
      return { x1: node.x, y1: node.y - node.reach - edge, x2: node.x, y2: rect.y + rect.h + 3 };
  }
}

/** A hairline's box, one pixel either side, so labels can be kept off it. */
function thinRect(segment: Segment): Rect {
  const x = Math.min(segment.x1, segment.x2);
  const y = Math.min(segment.y1, segment.y2);
  return {
    x: x - 1,
    y: y - 1,
    w: Math.abs(segment.x2 - segment.x1) + 2,
    h: Math.abs(segment.y2 - segment.y1) + 2,
  };
}

// ------------------------------------------------------------------------------------------
// The search

function collides(rect: Rect, placed: readonly Rect[], clearance: number): boolean {
  for (const other of placed) if (overlaps(rect, other, clearance)) return true;
  return false;
}

/** The boxes a candidate takes up: its label and, for one set further out, its hairline. */
const boxesOf = (candidate: Candidate): Rect[] => [candidate.rect, ...(candidate.extras ?? [])];

function fits(candidate: Candidate, placed: readonly Rect[], clearance: number): boolean {
  return !boxesOf(candidate).some((box) =>
    collides(box, placed, box === candidate.rect ? clearance : 1),
  );
}

/** Depth-first, in the order of each item's preferences, with at most `maxSkips` items left out. */
function search(
  items: readonly Item[],
  order: readonly number[],
  maxSkips: number,
  clearance: number,
  steps: { left: number },
): (Candidate | null)[] | null {
  const chosen: (Candidate | null)[] = items.map(() => null);
  const placed: Rect[] = [];
  const go = (depth: number, skips: number): boolean => {
    if (depth === order.length) return true;
    if (steps.left <= 0) return false;
    steps.left -= 1;
    const index = order[depth] as number;
    const item = items[index] as Item;
    for (const candidate of item.candidates) {
      if (!fits(candidate, placed, clearance)) continue;
      chosen[index] = candidate;
      const boxes = boxesOf(candidate);
      placed.push(...boxes);
      if (go(depth + 1, skips)) return true;
      placed.length -= boxes.length;
      chosen[index] = null;
      if (steps.left <= 0) return false;
    }
    const free = item.candidates.length === 0;
    if (free || skips < maxSkips) return go(depth + 1, free ? skips : skips + 1);
    return false;
  };
  return go(0, 0) ? chosen : null;
}

/** The first free place for each item in turn; the fallback when the search runs out of steps. */
function greedy(
  items: readonly Item[],
  order: readonly number[],
  clearance: number,
): (Candidate | null)[] {
  const chosen: (Candidate | null)[] = items.map(() => null);
  const taken: Rect[] = [];
  for (const index of order) {
    const item = items[index] as Item;
    const hit = item.candidates.find((candidate) => fits(candidate, taken, clearance));
    if (hit) {
      chosen[index] = hit;
      taken.push(...boxesOf(hit));
    }
  }
  return chosen;
}

const STEP_BUDGET = 40_000;

/**
 * Chooses a place for every item. The most constrained go first and the suggested mission is
 * kept before the rest; the whole set is tried without leaving anything out, then leaving out one,
 * then two, and so on, so as few labels as possible are dropped. The number of steps is fixed, so
 * the answer is the same every time and never takes long.
 */
function solve(items: readonly Item[], clearance: number): (Candidate | null)[] {
  const order = items
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        b.item.priority - a.item.priority ||
        a.item.candidates.length - b.item.candidates.length ||
        (a.item.key < b.item.key ? -1 : a.item.key > b.item.key ? 1 : 0),
    )
    .map(({ index }) => index);

  const steps = { left: STEP_BUDGET };
  for (let skips = 0; skips <= Math.min(items.length, 8) && steps.left > 0; skips += 1) {
    const found = search(items, order, skips, clearance, steps);
    if (found) return found;
  }
  return greedy(items, order, clearance);
}

// ------------------------------------------------------------------------------------------
// Family names

function discBox(nodes: readonly LabelNode[]): Rect {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const node of nodes) {
    x0 = Math.min(x0, node.x - node.reach);
    y0 = Math.min(y0, node.y - node.reach);
    x1 = Math.max(x1, node.x + node.reach);
    y1 = Math.max(y1, node.y + node.reach);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

const FAMILY_TRACKING = 0.14;
const FAMILY_HEIGHT = 16;

function familyCandidates(
  family: FamilyNode,
  members: readonly LabelNode[],
  all: readonly LabelNode[],
  size: PlateSize,
  centre: Point,
  metrics: LabelMetrics,
  taken: readonly Rect[],
  memberLabels: readonly { rect: Rect; align: Align }[],
): Candidate[] {
  const box = discBox(members);
  const w = Math.ceil(kickerWidth(family.text, 12, FAMILY_TRACKING));
  const h = FAMILY_HEIGHT;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const outward = unit({ x: cx - centre.x, y: cy - centre.y });
  const candidates: Candidate[] = [];
  type Spot = {
    edge: PlacedFamily['side'];
    align: Align;
    rect: Rect;
    extra: number;
    stacked?: boolean;
  };
  const spots: Spot[] = [];
  for (const distance of [12, 28, 48]) {
    const above = box.y - distance - h;
    const below = box.y + box.h + distance;
    const far = distance > 12 ? (distance > 28 ? 5 : 2) : 0;
    const at = (edge: Spot['edge'], align: Align, x: number, y: number): Spot => ({
      edge,
      align,
      rect: { x, y, w, h },
      extra: far,
    });
    spots.push(
      at('above', 'start', box.x, above),
      at('above', 'center', cx - w / 2, above),
      at('above', 'end', box.x + box.w - w, above),
      at('below', 'start', box.x, below),
      at('below', 'center', cx - w / 2, below),
      at('below', 'end', box.x + box.w - w, below),
      at('left', 'end', box.x - distance - w, box.y),
      at('left', 'end', box.x - distance - w, cy - h / 2),
      at('left', 'end', box.x - distance - w, box.y + box.h - h),
      at('right', 'start', box.x + box.w + distance, box.y),
      at('right', 'start', box.x + box.w + distance, cy - h / 2),
      at('right', 'start', box.x + box.w + distance, box.y + box.h - h),
    );
  }
  // Or stacked on the name of one of its own missions, the way a small line sits above a title.
  for (const { rect, align } of memberLabels) {
    const x =
      align === 'end'
        ? rect.x + rect.w - w
        : align === 'center'
          ? rect.x + rect.w / 2 - w / 2
          : rect.x;
    for (const edge of ['above', 'below'] as const) {
      const y =
        edge === 'above' ? rect.y - metrics.clearance - h : rect.y + rect.h + metrics.clearance;
      spots.push({ edge, align, rect: { x, y, w, h }, extra: 3, stacked: true });
    }
  }
  for (const spot of spots) {
    if (!inside(spot.rect, size, metrics.edge)) continue;
    if (all.some((node) => touchesCircle(spot.rect, node, node.reach + metrics.clearance)))
      continue;
    if (collides(spot.rect, taken, metrics.clearance)) continue;
    const direction: Point =
      spot.edge === 'above'
        ? { x: 0, y: -1 }
        : spot.edge === 'below'
          ? { x: 0, y: 1 }
          : spot.edge === 'left'
            ? { x: -1, y: 0 }
            : { x: 1, y: 0 };
    candidates.push({
      rect: spot.rect,
      cost:
        spot.extra +
        (1 - dot(outward, direction)) * 2.5 +
        (spot.align === 'center' ? 0.4 : 0) +
        FAMILY_ORDER.indexOf(spot.edge) * 0.1,
      side: 'e',
      edgeSide: spot.edge,
      align: spot.align,
      ...(spot.stacked ? { stacked: true } : {}),
    });
  }
  return candidates.sort((a, b) => a.cost - b.cost);
}

/** A hairline from a family name to the nearest mission, when they are not already touching. */
function leaderFor(rect: Rect, members: readonly LabelNode[]): Segment | null {
  const px = rect.x + rect.w / 2;
  const py = rect.y + rect.h / 2;
  let nearest: LabelNode | null = null;
  let nearestDistance = Infinity;
  for (const member of members) {
    const distance = Math.hypot(member.x - px, member.y - py);
    if (distance < nearestDistance) {
      nearest = member;
      nearestDistance = distance;
    }
  }
  if (!nearest) return null;
  const sx = Math.min(Math.max(nearest.x, rect.x), rect.x + rect.w);
  const sy = nearest.y < rect.y ? rect.y + rect.h : nearest.y > rect.y + rect.h ? rect.y : py;
  const distance = Math.hypot(nearest.x - sx, nearest.y - sy);
  if (distance - nearest.reach < 30) return null;
  const ux = (nearest.x - sx) / distance;
  const uy = (nearest.y - sy) / distance;
  const end = nearest.reach + 4;
  return {
    x1: Math.round(sx * 10) / 10,
    y1: Math.round((sy + (sy === rect.y + rect.h ? 2 : sy === rect.y ? -2 : 0)) * 10) / 10,
    x2: Math.round((nearest.x - ux * end) * 10) / 10,
    y2: Math.round((nearest.y - uy * end) * 10) / 10,
  };
}

// ------------------------------------------------------------------------------------------

/** Places every label. The result depends only on the input. */
export function placeLabels(input: PlaceInput): Placement {
  const { size, nodes, metrics } = input;
  const families = metrics.families ? (input.families ?? []) : [];
  const links = input.links ?? [];
  const centre = { x: size.width / 2, y: size.height / 2 };

  const prepared = nodes.map((node) => ({
    node,
    candidates: missionCandidates(node, nodes, size, centre, links, metrics),
  }));
  const items: Item[] = prepared.map(({ node, candidates }) => ({
    key: node.id,
    candidates,
    priority: node.recommended ? 1 : 0,
  }));
  const chosen = solve(items, metrics.clearance);

  const labels: PlacedLabel[] = [];
  const hidden: string[] = [];
  const taken: Rect[] = [];
  prepared.forEach(({ node }, index) => {
    const pick = chosen[index];
    if (!pick) {
      hidden.push(node.id);
      return;
    }
    taken.push(pick.rect, ...(pick.extras ?? []));
    labels.push({
      id: node.id,
      side: pick.side,
      align: pick.align,
      rect: pick.rect,
      kicker: pick.kicker ?? '',
      lines: pick.lines ?? [],
      leader: pick.leader ?? null,
    });
  });

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const labelOf = new Map(labels.map((label) => [label.id, label]));
  const familyPrepared = families.map((family) => {
    const members = family.members.flatMap((id) => {
      const member = byId.get(id);
      return member ? [member] : [];
    });
    const memberLabels = family.members.flatMap((id) => {
      const label = labelOf.get(id);
      return label ? [{ rect: label.rect, align: label.align }] : [];
    });
    return {
      family,
      members,
      candidates:
        members.length > 0
          ? familyCandidates(family, members, nodes, size, centre, metrics, taken, memberLabels)
          : [],
    };
  });
  const familyChosen = solve(
    familyPrepared.map(({ family, candidates }) => ({
      key: family.id,
      candidates,
      priority: 0,
    })),
    metrics.clearance,
  );
  const placedFamilies: PlacedFamily[] = [];
  const hiddenFamilies: string[] = [];
  familyPrepared.forEach(({ family, members }, index) => {
    const pick = familyChosen[index];
    if (!pick || !pick.edgeSide) {
      hiddenFamilies.push(family.id);
      return;
    }
    placedFamilies.push({
      id: family.id,
      side: pick.edgeSide,
      align: pick.align,
      rect: pick.rect,
      text: family.text,
      leader: pick.stacked ? null : leaderFor(pick.rect, members),
    });
  });

  return { labels, hidden, families: placedFamilies, hiddenFamilies };
}

// ------------------------------------------------------------------------------------------
// The detail that opens beside the mission under the pointer or the focus

export interface DetailPlacement {
  side: 'e' | 'w' | 's' | 'n';
  rect: Rect;
}

/**
 * Where the detail card goes for one mission: to the right if there is room, then the left, below
 * and above; never over its own glyph, over as few other glyphs as possible, and always inside the
 * plate (a plate too small for the card puts it as near as it can).
 */
export function placeDetail(
  node: PlotNode,
  card: { w: number; h: number },
  size: PlateSize,
  others: readonly PlotNode[],
  edge = 8,
  gap = 14,
): DetailPlacement {
  const { w, h } = card;
  const clampX = (x: number) => Math.max(edge, Math.min(x, size.width - w - edge));
  const clampY = (y: number) => Math.max(edge, Math.min(y, size.height - h - edge));
  const wanted: { side: DetailPlacement['side']; x: number; y: number }[] = [
    { side: 'e', x: node.x + node.reach + gap, y: node.y - h * 0.3 },
    { side: 'w', x: node.x - node.reach - gap - w, y: node.y - h * 0.3 },
    { side: 's', x: node.x - w / 2, y: node.y + node.reach + gap },
    { side: 'n', x: node.x - w / 2, y: node.y - node.reach - gap - h },
  ];
  let chosen: DetailPlacement | null = null;
  let chosenCost = Infinity;
  wanted.forEach(({ side, x, y }, order) => {
    // Pushed back inside the plate if it would overhang; the further it is pushed, the worse.
    const rect: Rect = { x: clampX(x), y: clampY(y), w, h };
    const pushed = Math.abs(rect.x - x) + Math.abs(rect.y - y);
    const covered = others.filter(
      (other) => other.id !== node.id && touchesCircle(rect, other, other.reach),
    ).length;
    const own = touchesCircle(rect, node, node.reach) ? 1000 : 0;
    const cost = pushed + covered * 40 + own + order;
    if (cost < chosenCost) {
      chosen = { side, rect };
      chosenCost = cost;
    }
  });
  return chosen ?? { side: 'e', rect: { x: edge, y: edge, w, h } };
}

/** The labels a detail card sits over, which step back while it is open. */
export function labelsUnder(card: Rect, labels: readonly PlacedLabel[], margin = 4): string[] {
  return labels.filter((label) => overlaps(card, label.rect, margin)).map((label) => label.id);
}
