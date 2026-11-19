import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { DIFFICULTIES, type Difficulty } from '#shared/domain/vocab.ts';

// The mission map lays every scenario out once, by difficulty territory, along a single winding
// path from the gentlest call to the hardest. Positions depend only on the scenarios themselves
// (never on filters or on what has been practised), so a mission stays where you last saw it.

export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 800;
const MARGIN_X = 78;
const JITTER = 16;

export interface MapNode {
  id: string;
  difficulty: Difficulty;
  /** The territory (row) this mission sits in. */
  row: number;
  /** Position along the whole path, starting at 0 for the gentlest call. */
  order: number;
  x: number;
  y: number;
  xPct: number;
  yPct: number;
}

export interface MapRow {
  difficulty: Difficulty;
  /** Where the row's missions sit, in map units: above centre, so names fit underneath. */
  y: number;
  yPct: number;
  /** The vertical centre of the territory band, as a percentage of the height. */
  bandPct: number;
  count: number;
}

export interface MapLink {
  from: string;
  to: string;
  d: string;
}

export interface MapLayout {
  nodes: MapNode[];
  rows: MapRow[];
  links: MapLink[];
}

/** A small stable number from text, so the "organic" wobble never changes between visits. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const gentlerFirst = (a: PublicScenarioDTO, b: PublicScenarioDTO) =>
  a.estimatedMinutes - b.estimatedMinutes || a.title.localeCompare(b.title);

function curve(a: MapNode, b: MapNode): string {
  if (a.row === b.row) {
    const dx = (b.x - a.x) * 0.45;
    return `M${a.x.toFixed(1)} ${a.y.toFixed(1)}C${(a.x + dx).toFixed(1)} ${a.y.toFixed(1)} ${(b.x - dx).toFixed(1)} ${b.y.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  }
  // Turning from one territory into the next: swing out past the edge and back.
  const side = a.x > MAP_WIDTH / 2 ? 1 : -1;
  const out = 95;
  return `M${a.x.toFixed(1)} ${a.y.toFixed(1)}C${(a.x + side * out).toFixed(1)} ${a.y.toFixed(1)} ${(b.x + side * out).toFixed(1)} ${b.y.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

/**
 * Territories run top to bottom (Starter, Standard, Challenge). Inside a territory the gentlest
 * call comes first; the path runs left to right, then turns and runs right to left, and so on.
 */
export function layoutMissionMap(scenarios: readonly PublicScenarioDTO[]): MapLayout {
  const groups = DIFFICULTIES.map((difficulty) => ({
    difficulty,
    items: scenarios.filter((s) => s.difficulty === difficulty).sort(gentlerFirst),
  })).filter((group) => group.items.length > 0);

  const nodes: MapNode[] = [];
  const rows: MapRow[] = [];
  const span = MAP_WIDTH - MARGIN_X * 2;
  groups.forEach((group, row) => {
    const y = (MAP_HEIGHT * (row + 0.4)) / groups.length;
    rows.push({
      difficulty: group.difficulty,
      y,
      yPct: (y / MAP_HEIGHT) * 100,
      bandPct: ((row + 0.5) / groups.length) * 100,
      count: group.items.length,
    });
    const reversed = row % 2 === 1;
    group.items.forEach((scenario, index) => {
      const visual = reversed ? group.items.length - 1 - index : index;
      const x = MARGIN_X + ((visual + 0.5) * span) / group.items.length;
      const wobble = ((hash(scenario.id) % 33) - 16) / 16;
      const wy = y + wobble * JITTER + Math.sin(index * 1.3) * (JITTER * 0.7);
      nodes.push({
        id: scenario.id,
        difficulty: group.difficulty,
        row,
        order: nodes.length,
        x,
        y: wy,
        xPct: (x / MAP_WIDTH) * 100,
        yPct: (wy / MAP_HEIGHT) * 100,
      });
    });
  });

  const links: MapLink[] = [];
  for (let i = 1; i < nodes.length; i += 1) {
    const a = nodes[i - 1];
    const b = nodes[i];
    if (a && b) links.push({ from: a.id, to: b.id, d: curve(a, b) });
  }
  return { nodes, rows, links };
}

export type MapKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';

const VECTORS: Record<'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown', [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/**
 * Where keyboard focus goes next. An arrow moves to the nearest mission that lies in that direction
 * (within a 45-degree cone, favouring ones in line). When nothing does, Left and Up step back along
 * the path and Right and Down step forward, so every mission can always be reached. Home and End go
 * to the first and last mission on the path. Only missions in `enabled` can be reached, and the
 * result is null when there is nowhere to go.
 */
export function nextMissionId(
  nodes: readonly MapNode[],
  fromId: string,
  key: MapKey,
  enabled: ReadonlySet<string>,
): string | null {
  const open = nodes.filter((n) => enabled.has(n.id));
  if (open.length === 0) return null;
  if (key === 'Home') return open[0]?.id ?? null;
  if (key === 'End') return open[open.length - 1]?.id ?? null;
  const from = nodes.find((n) => n.id === fromId);
  if (!from) return open[0]?.id ?? null;
  const [vx, vy] = VECTORS[key];
  let best: { id: string; score: number } | null = null;
  for (const n of open) {
    if (n.id === from.id) continue;
    const dx = n.x - from.x;
    const dy = n.y - from.y;
    const along = dx * vx + dy * vy;
    const across = Math.abs(dx * vy - dy * vx);
    if (along <= 1 || across > along) continue;
    const score = along + across * 1.8;
    if (!best || score < best.score) best = { id: n.id, score };
  }
  if (best) return best.id;

  const backwards = key === 'ArrowLeft' || key === 'ArrowUp';
  const along = open.filter((n) => (backwards ? n.order < from.order : n.order > from.order));
  const step = backwards ? along[along.length - 1] : along[0];
  return step?.id ?? null;
}
