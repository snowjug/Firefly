import { describe, expect, it } from 'vitest';
import { DIMENSION_IDS, DIMENSIONS, type DimensionId } from '#shared/domain/vocab.ts';
import { seeded } from '../../test-rng.ts';
import { EMPTY_PROGRESS, PROGRESS_WITH_DATA, trend } from '../progress/progress.fixtures.ts';
import {
  CLUSTER_NODE_CAP,
  CONSTELLATION_BOUNDS,
  CORE_ID,
  constellationLayout,
  levelFor,
  nextSkillToFocus,
  skillsFromProgress,
  type Constellation,
  type SkillInput,
  type SkillLevel,
} from './constellation-layout.ts';

const skill = (id: DimensionId, patch: Partial<SkillInput> = {}): SkillInput => ({
  id,
  label: DIMENSIONS[id].label,
  level: 0,
  evidence: 0,
  trend: 'not-enough-data',
  ...patch,
});
const all = (patch: Partial<SkillInput> = {}) => DIMENSION_IDS.map((id) => skill(id, patch));

const nodesOf = (c: Constellation, id: DimensionId) => c.nodes.filter((n) => n.cluster === id);
const positions = (c: Constellation) => [
  c.clusters.map((k) => [k.id, k.x, k.y, k.radius]),
  c.nodes.map((n) => [n.id, n.x, n.y]),
];

const shuffled = <T>(items: readonly T[], seed: number): T[] => seeded(seed).shuffle(items);

describe('levelFor', () => {
  it.each([
    [null, 0, 0],
    [null, 9, 0],
    [4.8, 0, 0],
    [Number.NaN, 4, 0],
    [1.0, 1, 1],
    [1.4, 40, 1],
    [2.4, 40, 1],
    [2.5, 1, 1],
    [2.5, 2, 2],
    [3.4, 40, 2],
    [3.5, 2, 2],
    [3.5, 3, 3],
    [4.1, 40, 3],
    [4.2, 4, 3],
    [4.2, 5, 4],
    [5, 100, 4],
  ] as const)('is %s on average over %s call(s) → level %i', (average, evidence, level) => {
    expect(levelFor(average, evidence)).toBe(level);
  });

  it('counts only whole calls, and never fewer than none', () => {
    expect(levelFor(4.5, 4.9)).toBe(3);
    expect(levelFor(4.5, 5.9)).toBe(4);
    expect(levelFor(4.5, -3)).toBe(0);
    expect(levelFor(4.5, Number.NaN)).toBe(0);
    expect(levelFor(4.5, Number.POSITIVE_INFINITY)).toBe(4);
  });

  it('never goes down when the average or the evidence goes up', () => {
    const random = seeded(12);
    for (let i = 0; i < 400; i += 1) {
      const average = 1 + random.next() * 4;
      const evidence = random.int(0, 8);
      const level = levelFor(average, evidence);
      expect(levelFor(average + random.next(), evidence)).toBeGreaterThanOrEqual(level);
      expect(levelFor(average, evidence + random.int(1, 3))).toBeGreaterThanOrEqual(level);
    }
  });

  it('needs more evidence for each higher level, so one excellent call is never top level', () => {
    expect(levelFor(5, 1)).toBe(1);
    expect(levelFor(5, 2)).toBe(2);
    expect(levelFor(5, 3)).toBe(3);
    expect(levelFor(5, 4)).toBe(3);
    expect(levelFor(5, 5)).toBe(4);
  });
});

describe('nextSkillToFocus', () => {
  it('is the skill flagged as the focus, even over a lower one, and the first of several flags', () => {
    const skills = all({ evidence: 3, level: 3 });
    skills[3] = skill('clarity', { evidence: 3, level: 1 });
    expect(nextSkillToFocus(skills)).toBe('clarity');
    const flagged = skills.map((s) =>
      s.id === 'closing' || s.id === 'scoping-discovery' ? { ...s, focus: true } : s,
    );
    expect(nextSkillToFocus(flagged)).toBe('scoping-discovery');
  });

  it('is a flagged skill even when it has no evidence yet', () => {
    expect(
      nextSkillToFocus([
        skill('closing', { focus: true }),
        skill('clarity', { evidence: 4, level: 2 }),
      ]),
    ).toBe('closing');
  });

  it('is otherwise the lowest level among skills that have evidence', () => {
    const skills = [
      skill('opening-rapport', { evidence: 4, level: 3 }),
      skill('scoping-discovery', { evidence: 2, level: 1 }),
      skill('empathy-deescalation', { evidence: 5, level: 2 }),
      skill('clarity'), // no evidence: never chosen, however low
      skill('ownership-next-steps', { evidence: 6, level: 4 }),
    ];
    expect(nextSkillToFocus(skills)).toBe('scoping-discovery');
  });

  it('breaks a tie in level by the skill with more evidence, then by vocabulary order', () => {
    expect(
      nextSkillToFocus([
        skill('clarity', { evidence: 2, level: 1 }),
        skill('closing', { evidence: 5, level: 1 }),
      ]),
    ).toBe('closing');
    expect(
      nextSkillToFocus([
        skill('closing', { evidence: 3, level: 2 }),
        skill('clarity', { evidence: 3, level: 2 }),
      ]),
    ).toBe('clarity');
  });

  it('is nothing at all when there is no evidence and no flag, rather than a guess', () => {
    expect(nextSkillToFocus(all())).toBeNull();
    expect(nextSkillToFocus([])).toBeNull();
    expect(nextSkillToFocus(skillsFromProgress(null))).toBeNull();
  });

  it('does not depend on the order the skills are listed in', () => {
    const skills = DIMENSION_IDS.map((id, index) =>
      skill(id, { evidence: 2 + (index % 3), level: (1 + (index % 3)) as SkillLevel }),
    );
    const expected = nextSkillToFocus(skills);
    for (const seed of [1, 2, 3, 4])
      expect(nextSkillToFocus(shuffled(skills, seed))).toBe(expected);
  });
});

describe('skillsFromProgress', () => {
  it('is six skills with nothing lit for someone with no practice', () => {
    for (const progress of [null, EMPTY_PROGRESS]) {
      const skills = skillsFromProgress(progress);
      expect(skills.map((s) => s.id)).toEqual([...DIMENSION_IDS]);
      for (const s of skills) {
        expect(s).toMatchObject({ level: 0, evidence: 0, trend: 'not-enough-data', focus: false });
        expect(s.label).toBe(DIMENSIONS[s.id].label);
      }
    }
  });

  it('takes evidence, level, direction and focus from the stored progress and nothing else', () => {
    const skills = skillsFromProgress(PROGRESS_WITH_DATA);
    const byId = new Map(skills.map((s) => [s.id, s]));
    expect(skills.every((s) => s.evidence === 5)).toBe(true);
    expect(byId.get('opening-rapport')).toMatchObject({ trend: 'up', focus: false });
    expect(byId.get('scoping-discovery')).toMatchObject({ trend: 'down', focus: true });
    expect(byId.get('clarity')).toMatchObject({ trend: 'steady' });
    // Scores of 3, 3, 4, 4, 4 average 3.6 over five calls: level 3. Opening's 2, 3, 4, 4, 4
    // average 3.4, which falls just short of the 3.5 that level 3 asks for.
    expect(byId.get('clarity')?.level).toBe(3);
    expect(byId.get('opening-rapport')?.level).toBe(2);
    expect(skills.filter((s) => s.focus)).toHaveLength(1);
  });

  it('is empty where a skill has no scored call, even if others do', () => {
    const progress = {
      focus: null,
      dimensionTrends: [trend('clarity', [3, 4, 4], 'steady')],
    };
    const skills = skillsFromProgress(progress);
    expect(skills.find((s) => s.id === 'clarity')).toMatchObject({ evidence: 3, level: 3 });
    expect(skills.find((s) => s.id === 'closing')).toMatchObject({ evidence: 0, level: 0 });
    expect(skills.some((s) => s.focus)).toBe(false);
  });
});

describe('constellationLayout', () => {
  const layout = constellationLayout(all({ evidence: 5, level: 3 }));

  it('has the six skills as clusters, in vocabulary order, each with the full number of stars', () => {
    expect(layout.clusters.map((c) => c.id)).toEqual([...DIMENSION_IDS]);
    expect(layout.nodes).toHaveLength(6 * CLUSTER_NODE_CAP);
    expect(CLUSTER_NODE_CAP).toBe(14);
    expect(new Set(layout.nodes.map((n) => n.id)).size).toBe(layout.nodes.length);
    for (const id of DIMENSION_IDS) {
      expect(nodesOf(layout, id).map((n) => n.id)).toEqual(
        Array.from({ length: CLUSTER_NODE_CAP }, (_, i) => `${id}:${i}`),
      );
    }
    expect(layout.core).toEqual({ x: 0.5, y: 0.5 });
  });

  it('keeps everything inside the bounds, every star inside its cluster, and clusters apart', () => {
    const { min, max } = CONSTELLATION_BOUNDS;
    for (const point of [...layout.nodes, ...layout.clusters]) {
      expect(point.x).toBeGreaterThanOrEqual(min);
      expect(point.x).toBeLessThanOrEqual(max);
      expect(point.y).toBeGreaterThanOrEqual(min);
      expect(point.y).toBeLessThanOrEqual(max);
    }
    for (const node of layout.nodes) {
      const cluster = layout.clusters.find((c) => c.id === node.cluster);
      expect(
        Math.hypot(node.x - (cluster?.x ?? 0), node.y - (cluster?.y ?? 0)),
      ).toBeLessThanOrEqual(cluster?.radius ?? 0);
    }
    for (let i = 0; i < layout.clusters.length; i += 1) {
      for (let j = i + 1; j < layout.clusters.length; j += 1) {
        const [a, b] = [layout.clusters[i], layout.clusters[j]] as [
          (typeof layout.clusters)[number],
          (typeof layout.clusters)[number],
        ];
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.radius + b.radius);
      }
    }
  });

  it('spaces the stars so none sit on top of each other', () => {
    for (const seed of [1, 2, 3, 9, 1234]) {
      const { nodes } = constellationLayout(all(), { seed });
      let closest = Infinity;
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const [a, b] = [nodes[i], nodes[j]] as [(typeof nodes)[number], (typeof nodes)[number]];
          closest = Math.min(closest, Math.hypot(a.x - b.x, a.y - b.y));
        }
      }
      expect(closest).toBeGreaterThan(0.012);
    }
  });

  it('puts the clusters on a loose ring around the core, in order, with uneven gaps', () => {
    const centre = layout.core;
    const distances = layout.clusters.map((c) => Math.hypot(c.x - centre.x, c.y - centre.y));
    expect(Math.min(...distances)).toBeGreaterThan(0.26);
    expect(Math.max(...distances)).toBeLessThan(0.34);
    expect(Math.max(...distances) - Math.min(...distances)).toBeGreaterThan(0.003);

    const angles = layout.clusters.map((c) => Math.atan2(c.y - centre.y, c.x - centre.x));
    const first = angles[0] as number;
    const turns = angles.map((a) => (((a - first) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2));
    for (let i = 1; i < turns.length; i += 1) {
      expect(turns[i] as number).toBeGreaterThan(turns[i - 1] as number);
    }
    const gaps = turns.slice(1).map((t, i) => t - (turns[i] as number));
    gaps.push(Math.PI * 2 - (turns[turns.length - 1] as number));
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeGreaterThan(0.02);
  });

  it('lights exactly as many stars as there is evidence, up to the cap, nearest the middle first', () => {
    const cases: [number, number][] = [
      [0, 0],
      [1, 1],
      [5, 5],
      [13, 13],
      [14, 14],
      [15, 14],
      [400, 14],
      [3.9, 3],
      [-2, 0],
      [Number.NaN, 0],
      [Number.POSITIVE_INFINITY, 14],
    ];
    for (const [evidence, lit] of cases) {
      const result = constellationLayout([skill('clarity', { evidence })]);
      const stars = nodesOf(result, 'clarity');
      expect(stars).toHaveLength(CLUSTER_NODE_CAP);
      expect(stars.filter((n) => n.lit)).toHaveLength(lit);
      expect(stars.slice(0, lit).every((n) => n.lit)).toBe(true);
      expect(stars.slice(lit).every((n) => !n.lit)).toBe(true);
    }
  });

  it('draws an unpractised skill as a full set of dormant stars, so it is visible and neutral', () => {
    const result = constellationLayout(all());
    expect(result.nodes).toHaveLength(6 * CLUSTER_NODE_CAP);
    expect(result.nodes.every((n) => !n.lit)).toBe(true);
    expect(result.links.every((l) => l.strength === 0)).toBe(true);
    expect(result.clusters.every((c) => c.level === 0 && !c.focus)).toBe(true);
  });

  it('never moves a star because of evidence, level, direction or focus', () => {
    const quiet = constellationLayout(all());
    const busy = constellationLayout(
      DIMENSION_IDS.map((id, i) =>
        skill(id, {
          evidence: i * 3,
          level: Math.min(4, i) as SkillLevel,
          trend: i % 2 ? 'down' : 'up',
          focus: i === 2,
        }),
      ),
    );
    expect(positions(busy)).toEqual(positions(quiet));
    expect(busy.clusters.find((c) => c.focus)?.id).toBe('empathy-deescalation');
  });

  it('is exactly the same every time, and does not depend on the order the skills were given', () => {
    const skills = all({ evidence: 4, level: 2 });
    const expected = constellationLayout(skills, { seed: 5 });
    expect(constellationLayout(skills, { seed: 5 })).toEqual(expected);
    for (const seed of [1, 2, 3]) {
      expect(constellationLayout(shuffled(skills, seed), { seed: 5 })).toEqual(expected);
    }
  });

  it('arranges differently for another seed and stays sound for any seed', () => {
    const a = constellationLayout(all(), { seed: 1 });
    const b = constellationLayout(all(), { seed: 2 });
    expect(positions(a)).not.toEqual(positions(b));
    const random = seeded(90);
    for (let i = 0; i < 40; i += 1) {
      const result = constellationLayout(all({ evidence: 14 }), { seed: random.int(0, 1_000_000) });
      for (let x = 0; x < result.clusters.length; x += 1) {
        for (let y = x + 1; y < result.clusters.length; y += 1) {
          const [p, q] = [result.clusters[x], result.clusters[y]] as [
            (typeof result.clusters)[number],
            (typeof result.clusters)[number],
          ];
          expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThan(p.radius + q.radius);
        }
      }
      for (const n of result.nodes) {
        expect(n.x).toBeGreaterThanOrEqual(CONSTELLATION_BOUNDS.min);
        expect(n.x).toBeLessThanOrEqual(CONSTELLATION_BOUNDS.max);
        expect(n.y).toBeGreaterThanOrEqual(CONSTELLATION_BOUNDS.min);
        expect(n.y).toBeLessThanOrEqual(CONSTELLATION_BOUNDS.max);
      }
    }
  });

  it('rounds to four decimals, so every machine agrees on it', () => {
    for (const p of [...layout.nodes, ...layout.clusters]) {
      expect(p.x).toBe(Math.round(p.x * 10_000) / 10_000);
      expect(p.y).toBe(Math.round(p.y * 10_000) / 10_000);
    }
  });

  it('leaves a gap for a skill that is missing instead of moving the others', () => {
    const some = constellationLayout(
      all().filter((s) => s.id !== 'empathy-deescalation' && s.id !== 'closing'),
    );
    expect(some.clusters.map((c) => c.id)).toEqual([
      'opening-rapport',
      'scoping-discovery',
      'clarity',
      'ownership-next-steps',
    ]);
    const full = constellationLayout(all());
    for (const cluster of some.clusters) {
      expect(cluster).toEqual(full.clusters.find((c) => c.id === cluster.id));
    }
    expect(some.nodes).toHaveLength(4 * CLUSTER_NODE_CAP);
  });

  it('keeps one of each known skill, and has nothing to draw without any', () => {
    const doubled = constellationLayout([
      skill('clarity', { evidence: 2 }),
      skill('clarity', { evidence: 9 }),
      { ...skill('closing'), id: 'not-a-skill' as DimensionId },
    ]);
    expect(doubled.clusters.map((c) => c.id)).toEqual(['clarity']);
    expect(doubled.nodes.filter((n) => n.lit)).toHaveLength(2);
    expect(constellationLayout([])).toEqual({
      clusters: [],
      nodes: [],
      links: [],
      core: { x: 0.5, y: 0.5 },
    });
  });

  it('marks the focus on its cluster only when the skill says so, and the level as given', () => {
    const result = constellationLayout([
      skill('clarity', { focus: true, level: 2, evidence: 3 }),
      skill('closing', { level: 9 as SkillLevel }),
      skill('opening-rapport', { level: -1 as SkillLevel }),
    ]);
    const get = (id: DimensionId) => result.clusters.find((c) => c.id === id);
    expect(get('clarity')).toMatchObject({ focus: true, level: 2 });
    expect(get('closing')).toMatchObject({ focus: false, level: 4 });
    expect(get('opening-rapport')).toMatchObject({ focus: false, level: 0 });
  });
});

describe('the links of a constellation', () => {
  const strengthBetween = (c: Constellation, from: string, to: string) =>
    c.links.find((l) => l.from === from && l.to === to)?.strength;

  it('join each star to the next in its cluster, and each cluster to the core by its first star', () => {
    const result = constellationLayout(all({ evidence: 14, level: 2 }));
    expect(result.links).toHaveLength(6 * CLUSTER_NODE_CAP);
    for (const id of DIMENSION_IDS) {
      for (let i = 0; i + 1 < CLUSTER_NODE_CAP; i += 1) {
        expect(strengthBetween(result, `${id}:${i}`, `${id}:${i + 1}`)).toBeDefined();
      }
      expect(strengthBetween(result, `${id}:0`, CORE_ID)).toBeDefined();
    }
    expect(result.links.filter((l) => l.to === CORE_ID)).toHaveLength(6);
    const known = new Set([...result.nodes.map((n) => n.id), CORE_ID]);
    for (const link of result.links) {
      expect(known.has(link.from) && known.has(link.to)).toBe(true);
    }
  });

  it('are drawn only between lit stars, and from the first star to the core once it is lit', () => {
    const result = constellationLayout([skill('clarity', { evidence: 3, level: 2 })]);
    expect(strengthBetween(result, 'clarity:0', 'clarity:1')).toBeGreaterThan(0);
    expect(strengthBetween(result, 'clarity:1', 'clarity:2')).toBeGreaterThan(0);
    expect(strengthBetween(result, 'clarity:2', 'clarity:3')).toBe(0);
    expect(strengthBetween(result, 'clarity:5', 'clarity:6')).toBe(0);
    expect(strengthBetween(result, 'clarity:0', CORE_ID)).toBeGreaterThan(0);
    expect(
      constellationLayout([skill('clarity', { evidence: 1, level: 1 })]).links.filter(
        (l) => l.strength > 0,
      ),
    ).toEqual([expect.objectContaining({ from: 'clarity:0', to: CORE_ID })]);
    expect(
      constellationLayout([skill('clarity', { evidence: 0, level: 0 })]).links.every(
        (l) => l.strength === 0,
      ),
    ).toBe(true);
  });

  it('grow stronger with the level and stay within 0..1', () => {
    const strengths = ([0, 1, 2, 3, 4] as const).map((level) => {
      const result = constellationLayout([skill('clarity', { evidence: 4, level })]);
      return strengthBetween(result, 'clarity:0', 'clarity:1') as number;
    });
    for (let i = 1; i < strengths.length; i += 1) {
      expect(strengths[i] as number).toBeGreaterThan(strengths[i - 1] as number);
    }
    expect(Math.min(...strengths)).toBeGreaterThan(0);
    expect(Math.max(...strengths)).toBeLessThanOrEqual(1);
    const everything = constellationLayout(all({ evidence: 14, level: 4 }));
    expect(everything.links.every((l) => l.strength >= 0 && l.strength <= 1)).toBe(true);
  });
});

describe('a person with real progress', () => {
  it('lights five stars in every skill, and the focus skill is marked', () => {
    const skills = skillsFromProgress(PROGRESS_WITH_DATA);
    const result = constellationLayout(skills);
    for (const id of DIMENSION_IDS) {
      expect(nodesOf(result, id).filter((n) => n.lit)).toHaveLength(5);
    }
    expect(result.clusters.filter((c) => c.focus).map((c) => c.id)).toEqual(['scoping-discovery']);
    expect(nextSkillToFocus(skills)).toBe('scoping-discovery');
  });

  it('shows nothing lit for a new person, and invents no focus', () => {
    const skills = skillsFromProgress(EMPTY_PROGRESS);
    const result = constellationLayout(skills);
    expect(result.nodes.some((n) => n.lit)).toBe(false);
    expect(result.links.some((l) => l.strength > 0)).toBe(false);
    expect(nextSkillToFocus(skills)).toBeNull();
  });
});
