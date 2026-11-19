import { describe, expect, it } from 'vitest';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import type { Difficulty } from '#shared/domain/vocab.ts';
import { makeScenario } from '../scenario/scenario-fixtures.ts';
import { layoutMissionMap, nextMissionId } from './map-layout.ts';

const make = (id: string, difficulty: Difficulty, minutes: number, title = id): PublicScenarioDTO =>
  makeScenario({ id, difficulty, estimatedMinutes: minutes, title });

const LIBRARY = [
  make('hard-b', 'challenge', 14),
  make('easy-b', 'starter', 9),
  make('mid-a', 'standard', 10),
  make('easy-a', 'starter', 7),
  make('mid-b', 'standard', 12),
  make('hard-a', 'challenge', 12),
  make('easy-c', 'starter', 9, 'Another easy one'),
];

describe('layoutMissionMap', () => {
  const layout = layoutMissionMap(LIBRARY);
  const ids = (row: number) => layout.nodes.filter((n) => n.row === row).map((n) => n.id);

  it('puts Starter, Standard and Challenge in territories from top to bottom', () => {
    expect(layout.rows.map((r) => r.difficulty)).toEqual(['starter', 'standard', 'challenge']);
    expect(layout.rows.map((r) => r.count)).toEqual([3, 2, 2]);
    const ys = layout.rows.map((r) => r.y);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
  });

  it('puts the gentlest call first along the path, shortest then alphabetical', () => {
    expect(layout.nodes.map((n) => n.id).slice(0, 3)).toEqual(['easy-a', 'easy-c', 'easy-b']);
    expect(layout.nodes.map((n) => n.order)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('winds like a path: left to right, then back right to left', () => {
    const xs = (row: number) => layout.nodes.filter((n) => n.row === row).map((n) => n.x);
    const first = xs(0);
    const second = xs(1);
    expect(first).toEqual([...first].sort((a, b) => a - b));
    expect(second).toEqual([...second].sort((a, b) => b - a));
    expect(xs(2)).toEqual([...xs(2)].sort((a, b) => a - b));
  });

  it('is stable: the same scenarios give the same map whatever order they arrive in', () => {
    const shuffled = layoutMissionMap([...LIBRARY].reverse());
    expect(shuffled.nodes).toEqual(layout.nodes);
    expect(layoutMissionMap(LIBRARY)).toEqual(layout);
  });

  it('keeps every mission inside the board and joins consecutive missions with a link', () => {
    for (const n of layout.nodes) {
      expect(n.xPct).toBeGreaterThan(0);
      expect(n.xPct).toBeLessThan(100);
      expect(n.yPct).toBeGreaterThan(0);
      expect(n.yPct).toBeLessThan(100);
    }
    expect(layout.links).toHaveLength(layout.nodes.length - 1);
    expect(layout.links[0]).toMatchObject({ from: 'easy-a', to: 'easy-c' });
    expect(layout.links.every((l) => /^M[\d.]+ [\d.]+C/.test(l.d))).toBe(true);
  });

  it('skips a territory with no missions and spreads the rest', () => {
    const only = layoutMissionMap(LIBRARY.filter((s) => s.difficulty !== 'standard'));
    expect(only.rows.map((r) => r.difficulty)).toEqual(['starter', 'challenge']);
    expect(only.rows[0]?.bandPct).toBeCloseTo(25, 0);
    expect(only.rows[1]?.bandPct).toBeCloseTo(75, 0);
    // Missions sit above the middle of their band, leaving room for their names underneath.
    for (const row of only.rows) expect(row.yPct).toBeLessThan(row.bandPct);
    expect(ids(0)).toBeDefined();
  });

  it('handles an empty library', () => {
    expect(layoutMissionMap([])).toEqual({ nodes: [], rows: [], links: [] });
  });
});

describe('nextMissionId', () => {
  const { nodes } = layoutMissionMap(LIBRARY);
  const all = new Set(nodes.map((n) => n.id));
  const at = (id: string) => nodes.find((n) => n.id === id)!;

  it('moves to the nearest mission in the direction of the arrow', () => {
    const right = nextMissionId(nodes, 'easy-a', 'ArrowRight', all);
    expect(right).toBe('easy-c');
    expect(at(right!).x).toBeGreaterThan(at('easy-a').x);
    const down = nextMissionId(nodes, 'easy-a', 'ArrowDown', all);
    expect(at(down!).row).toBeGreaterThan(at('easy-a').row);
    const left = nextMissionId(nodes, right!, 'ArrowLeft', all);
    expect(left).toBe('easy-a');
  });

  it('stays put at an edge instead of jumping somewhere surprising', () => {
    expect(nextMissionId(nodes, 'easy-a', 'ArrowLeft', all)).toBeNull();
    expect(nextMissionId(nodes, 'easy-a', 'ArrowUp', all)).toBeNull();
  });

  it('never leaves a mission out of reach: with nothing in that direction it steps along the path', () => {
    // From the last mission on the path there is nothing further on, so Right and Down stay put.
    const last = nodes[nodes.length - 1]!;
    expect(nextMissionId(nodes, last.id, 'ArrowRight', all)).toBeNull();
    // Following Right/Down from the first mission eventually visits every mission.
    const seen = new Set<string>(['easy-a']);
    let at = 'easy-a';
    for (let i = 0; i < 40; i += 1) {
      const next = nextMissionId(nodes, at, i % 2 === 0 ? 'ArrowRight' : 'ArrowDown', all);
      if (next && !seen.has(next)) {
        seen.add(next);
        at = next;
      }
    }
    expect(seen.size).toBeGreaterThan(3);
    // Only two missions are open and neither lies in the pressed direction: step along the path.
    const open = new Set(['easy-b', 'mid-a']);
    expect(nextMissionId(nodes, 'easy-b', 'ArrowLeft', open)).toBeNull();
    expect(nextMissionId(nodes, 'mid-a', 'ArrowLeft', open)).toBe('easy-b');
  });

  it('goes to the first and last mission on the path with Home and End', () => {
    expect(nextMissionId(nodes, 'mid-a', 'Home', all)).toBe('easy-a');
    expect(nextMissionId(nodes, 'mid-a', 'End', all)).toBe(nodes[nodes.length - 1]?.id);
  });

  it('only ever lands on missions that are enabled', () => {
    const enabled = new Set(['easy-a', 'hard-b']);
    expect(nextMissionId(nodes, 'easy-a', 'ArrowRight', enabled)).not.toBe('easy-c');
    expect(nextMissionId(nodes, 'easy-a', 'Home', enabled)).toBe('easy-a');
    expect(nextMissionId(nodes, 'easy-a', 'End', enabled)).toBe('hard-b');
    expect(nextMissionId(nodes, 'easy-a', 'End', new Set())).toBeNull();
  });
});
