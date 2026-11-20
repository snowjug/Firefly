import { describe, expect, it } from 'vitest';
import { DIMENSION_IDS, DIMENSIONS, type DimensionId } from '#shared/domain/vocab.ts';
import {
  CLUSTER_NODE_CAP,
  type SkillInput,
  type SkillLevel,
} from '../atlas/constellation-layout.ts';
import { SKY_BOX, labelSide, skyChart, skyPercent } from './sky-geometry.ts';

const skill = (id: DimensionId, patch: Partial<SkillInput> = {}): SkillInput => ({
  id,
  label: DIMENSIONS[id].label,
  level: 0,
  evidence: 0,
  trend: 'not-enough-data',
  ...patch,
});
const all = (patch: Partial<SkillInput> = {}) => DIMENSION_IDS.map((id) => skill(id, patch));

describe('skyChart', () => {
  const chart = skyChart(all({ evidence: 5, level: 3 as SkillLevel }));

  it('draws six clusters of fourteen stars around a core in the middle of the plate', () => {
    expect(chart.clusters.map((c) => c.id)).toEqual([...DIMENSION_IDS]);
    expect(chart.stars).toHaveLength(6 * CLUSTER_NODE_CAP);
    expect(chart.core).toEqual({ x: SKY_BOX.width / 2, y: SKY_BOX.height / 2 });
  });

  it('keeps every star and cluster inside the plate, with room for the names', () => {
    for (const point of [...chart.stars, ...chart.clusters]) {
      expect(point.x).toBeGreaterThan(80);
      expect(point.x).toBeLessThan(SKY_BOX.width - 80);
      expect(point.y).toBeGreaterThan(80);
      expect(point.y).toBeLessThan(SKY_BOX.height - 80);
    }
  });

  it('keeps each cluster round: every star lies within its cluster, and clusters stay apart', () => {
    for (const star of chart.stars) {
      const cluster = chart.clusters.find((c) => c.id === star.cluster)!;
      expect(Math.hypot(star.x - cluster.x, star.y - cluster.y)).toBeLessThanOrEqual(
        cluster.radius + 0.5,
      );
    }
    for (let i = 0; i < chart.clusters.length; i += 1) {
      for (let j = i + 1; j < chart.clusters.length; j += 1) {
        const [a, b] = [chart.clusters[i]!, chart.clusters[j]!];
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.radius + b.radius + 24);
      }
    }
  });

  it('sends every name outward: above, right, below and left, never across the core', () => {
    expect(chart.clusters.map((c) => [c.id, c.side])).toEqual([
      ['opening-rapport', 'above'],
      ['scoping-discovery', 'above'],
      ['empathy-deescalation', 'right'],
      ['clarity', 'below'],
      ['ownership-next-steps', 'below'],
      ['closing', 'left'],
    ]);
  });

  it('lights as many stars as there is evidence and marks the stars the newest call lit', () => {
    const lit = skyChart(
      [skill('clarity', { evidence: 3, level: 2 }), skill('closing', { evidence: 20, level: 4 })],
      new Set(['clarity:2', 'closing:13', 'clarity:9']),
    );
    const of = (id: DimensionId) => lit.stars.filter((s) => s.cluster === id);
    expect(of('clarity').filter((s) => s.lit)).toHaveLength(3);
    expect(of('closing').filter((s) => s.lit)).toHaveLength(14);
    expect(lit.clusters.find((c) => c.id === 'clarity')?.lit).toBe(3);
    // Only a star that is lit can be the newest one: clarity:9 is still dormant.
    expect(lit.stars.filter((s) => s.recent).map((s) => s.id)).toEqual(['clarity:2', 'closing:13']);
  });

  it('joins only stars that are both lit, and a cluster to the core only once it has a star', () => {
    const none = skyChart(all());
    expect(none.links.every((l) => l.strength === 0)).toBe(true);
    const one = skyChart([skill('clarity', { evidence: 1, level: 1 })]);
    expect(one.links.filter((l) => l.strength > 0).map((l) => l.toCore)).toEqual([true]);
    const three = skyChart([skill('clarity', { evidence: 3, level: 2 })]);
    const drawn = three.links.filter((l) => l.strength > 0);
    expect(drawn.filter((l) => !l.toCore)).toHaveLength(2);
    expect(drawn.filter((l) => l.toCore)).toHaveLength(1);
  });

  it('never moves a star because of evidence, light or focus', () => {
    const quiet = skyChart(all());
    const busy = skyChart(
      DIMENSION_IDS.map((id, i) =>
        skill(id, { evidence: i * 3, level: Math.min(4, i) as SkillLevel, focus: i === 2 }),
      ),
    );
    expect(busy.stars.map((s) => [s.id, s.x, s.y])).toEqual(
      quiet.stars.map((s) => [s.id, s.x, s.y]),
    );
    expect(busy.clusters.find((c) => c.focus)?.id).toBe('empathy-deescalation');
  });

  it('draws a spoke through each cluster and three rings around the core', () => {
    expect(chart.graticule.spokes).toHaveLength(6);
    expect(chart.graticule.rings).toHaveLength(3);
    for (const [index, spoke] of chart.graticule.spokes.entries()) {
      const cluster = chart.clusters[index]!;
      // The cluster lies on its spoke, between the core and the spoke's far end.
      const cross =
        (cluster.x - spoke.from.x) * (spoke.to.y - spoke.from.y) -
        (cluster.y - spoke.from.y) * (spoke.to.x - spoke.from.x);
      expect(Math.abs(cross)).toBeLessThan(1);
    }
  });
});

describe('labelSide', () => {
  it('puts the name on the side facing away from the core', () => {
    expect(labelSide(100, 0)).toBe('right');
    expect(labelSide(-100, 0)).toBe('left');
    expect(labelSide(0, -100)).toBe('above');
    expect(labelSide(0, 100)).toBe('below');
    expect(labelSide(60, -100)).toBe('above');
    expect(labelSide(-100, 60)).toBe('left');
  });
});

describe('skyPercent', () => {
  it('turns a point on the plate into percentages of it', () => {
    expect(skyPercent({ x: 500, y: 350 })).toEqual({ left: '50%', top: '50%' });
    expect(skyPercent({ x: 0, y: SKY_BOX.height })).toEqual({ left: '0%', top: '100%' });
  });
});
