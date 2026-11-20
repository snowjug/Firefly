import { describe, expect, it } from 'vitest';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { ISSUE_TYPES } from '#shared/domain/vocab.ts';
import { seeded } from '../../test-rng.ts';
import { CATALOGUE, fullCall, runningCall, syntheticCatalogue } from './atlas.fixtures.ts';
import {
  ATLAS_BOUNDS,
  MIN_MISSION_DISTANCE,
  buildAtlas,
  layoutAtlas,
  type AtlasLayout,
  type AtlasModel,
} from './atlas-model.ts';

const modelOf = (scenarios: readonly PublicScenarioDTO[]) => buildAtlas(scenarios, [], null);

/** The distance between two nodes as it looks on screen: x counts `aspect` times as much as y. */
const apart = (a: { x: number; y: number }, b: { x: number; y: number }, aspect: number) =>
  Math.hypot((a.x - b.x) * aspect, a.y - b.y);

function closestPair(layout: AtlasLayout, aspect = 1): number {
  let closest = Infinity;
  for (let i = 0; i < layout.nodes.length; i += 1) {
    for (let j = i + 1; j < layout.nodes.length; j += 1) {
      closest = Math.min(
        closest,
        apart(
          layout.nodes[i] as { x: number; y: number },
          layout.nodes[j] as { x: number; y: number },
          aspect,
        ),
      );
    }
  }
  return closest;
}

/** Everything a layout promises, whatever it was made from. */
function expectSound(layout: AtlasLayout, model: AtlasModel, aspect = 1) {
  expect(layout.nodes.map((n) => n.id)).toEqual(model.missions.map((m) => m.id));
  expect(layout.anchors.map((a) => a.family)).toEqual(model.families.map((f) => f.id));
  const { min, max } = ATLAS_BOUNDS;
  for (const point of [...layout.nodes, ...layout.anchors]) {
    expect(point.x).toBeGreaterThanOrEqual(min);
    expect(point.x).toBeLessThanOrEqual(max);
    expect(point.y).toBeGreaterThanOrEqual(min);
    expect(point.y).toBeLessThanOrEqual(max);
  }
  for (const node of layout.nodes) {
    expect(node.depth).toBeGreaterThanOrEqual(0);
    expect(node.depth).toBeLessThanOrEqual(1);
  }
  expect(closestPair(layout, aspect)).toBeGreaterThanOrEqual(MIN_MISSION_DISTANCE);
}

const shuffled = <T>(items: readonly T[], seed: number): T[] => seeded(seed).shuffle(items);

const model = modelOf(CATALOGUE);

describe('the layout of the real catalogue', () => {
  const layout = layoutAtlas(model);

  it('places every mission once, in model order, inside the bounds and apart', () => {
    expect(layout.nodes).toHaveLength(13);
    expectSound(layout, model);
  });

  it('keeps the families together: each mission is nearest to its own anchor', () => {
    for (const seed of [1, 2, 3, 11, 2026]) {
      for (const aspect of [0.75, 1, 1.6, 2.4]) {
        const laid = layoutAtlas(model, { seed, aspect });
        for (const node of laid.nodes) {
          const family = model.missions.find((m) => m.id === node.id)?.family;
          const nearest = [...laid.anchors].sort(
            (a, b) => apart(node, a, aspect) - apart(node, b, aspect),
          )[0];
          expect(nearest?.family).toBe(family);
        }
      }
    }
  });

  it('puts a family of one right on its anchor', () => {
    const outage = layout.nodes.find((n) => n.id === 'checkout-outage-before-investor-event');
    const anchor = layout.anchors.find((a) => a.family === 'service-outage');
    expect(
      apart(outage as { x: number; y: number }, anchor as { x: number; y: number }, 1),
    ).toBeLessThan(0.01);
  });

  it('keeps the orbits round whatever shape the map is drawn in', () => {
    const slow = model.families.find((f) => f.id === 'slow-performance')?.missionIds ?? [];
    expect(slow).toHaveLength(3);
    for (const aspect of [0.6, 1, 1.78, 2.4]) {
      const laid = layoutAtlas(model, { aspect });
      const [a, b, c] = slow.map(
        (id) => laid.nodes.find((n) => n.id === id) as { x: number; y: number },
      );
      for (const [p, q] of [
        [a, b],
        [b, c],
        [a, c],
      ] as const) {
        expect(apart(p as never, q as never, aspect)).toBeGreaterThan(0.1);
        expect(apart(p as never, q as never, aspect)).toBeLessThan(0.115);
      }
    }
  });

  it('is exactly the same every time, and does not depend on how the scenarios were listed', () => {
    expect(layoutAtlas(model)).toEqual(layout);
    for (const seed of [1, 2, 3]) {
      expect(layoutAtlas(modelOf(shuffled(CATALOGUE, seed)))).toEqual(layout);
    }
  });

  it('never moves because of what the trainee has done or been recommended', () => {
    const busy = buildAtlas(
      CATALOGUE,
      [
        fullCall('locked-out-after-password-reset', 4.5),
        runningCall('escalated-integration-failures'),
      ],
      'licence-seat-not-assigned',
    );
    expect(layoutAtlas(busy)).toEqual(layout);
  });

  it('is rounded to four decimals, so every machine agrees on it', () => {
    for (const point of [...layout.nodes, ...layout.anchors]) {
      expect(point.x).toBe(Math.round(point.x * 10_000) / 10_000);
      expect(point.y).toBe(Math.round(point.y * 10_000) / 10_000);
    }
  });

  it('arranges differently for another seed and stays sound', () => {
    const other = layoutAtlas(model, { seed: 99 });
    expect(other).not.toEqual(layout);
    expect(other.anchors.map((a) => [a.x, a.y])).not.toEqual(layout.anchors.map((a) => [a.x, a.y]));
    expectSound(other, model);
  });

  it('ignores an aspect or seed that cannot be used, and caps an extreme aspect', () => {
    for (const aspect of [0, -2, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(layoutAtlas(model, { aspect })).toEqual(layout);
    }
    expect(layoutAtlas(model, { seed: Number.NaN })).toEqual(layout);
    expect(layoutAtlas(model, { aspect: 100 })).toEqual(layoutAtlas(model, { aspect: 3 }));
    expect(layoutAtlas(model, { aspect: 0.01 })).toEqual(layoutAtlas(model, { aspect: 0.4 }));
  });
});

describe('the family anchors', () => {
  const { anchors } = layoutAtlas(model);
  const fromCentre = anchors.map((a) => Math.hypot(a.x - 0.5, a.y - 0.5));

  it('follow the vocabulary order once round the centre, starting at the top', () => {
    expect(anchors.map((a) => a.family)).toEqual([...ISSUE_TYPES]);
    const turns = anchors.map((a) => {
      // 0 at the top, growing clockwise; the first family may sit a little before the top.
      const angle = Math.atan2(a.y - 0.5, a.x - 0.5) + Math.PI / 2;
      return angle < -Math.PI / 4 ? angle + Math.PI * 2 : angle;
    });
    for (let i = 1; i < turns.length; i += 1) {
      expect(turns[i] as number).toBeGreaterThan(turns[i - 1] as number);
    }
    expect(Math.abs(turns[0] as number)).toBeLessThan(0.25);
    expect(turns[turns.length - 1] as number).toBeLessThan(Math.PI * 2);
  });

  it('form a loose ring: well away from the centre and each other, but not a perfect circle', () => {
    expect(Math.min(...fromCentre)).toBeGreaterThan(0.2);
    expect(Math.max(...fromCentre)).toBeLessThan(0.45);
    const spread = Math.max(...fromCentre) - Math.min(...fromCentre);
    expect(spread).toBeGreaterThan(0.01);
    expect(spread).toBeLessThan(0.1);
    for (let i = 0; i < anchors.length; i += 1) {
      for (let j = i + 1; j < anchors.length; j += 1) {
        expect(apart(anchors[i] as never, anchors[j] as never, 1)).toBeGreaterThan(0.15);
      }
    }
  });

  it('keep their own distance from the centre, and their order, when another family goes', () => {
    const without = layoutAtlas(modelOf(CATALOGUE.filter((s) => s.issueType !== 'how-to')));
    // The ring is spaced for six families now, so the slots move, but the order never does...
    expect(without.anchors.map((a) => a.family)).toEqual(
      ISSUE_TYPES.filter((type) => type !== 'how-to'),
    );
    // ...and each family keeps the nudge the seed gave it: here, how far out it sits.
    for (const anchor of without.anchors) {
      const before = anchors.findIndex((a) => a.family === anchor.family);
      expect(Math.hypot(anchor.x - 0.5, anchor.y - 0.5)).toBeCloseTo(
        fromCentre[before] as number,
        3,
      );
    }
  });

  it('put a lone family in the middle and two families on either side', () => {
    const one = layoutAtlas(modelOf(CATALOGUE.filter((s) => s.issueType === 'how-to')));
    expect(one.anchors).toEqual([{ family: 'how-to', x: 0.5, y: 0.5 }]);
    const two = layoutAtlas(
      modelOf(CATALOGUE.filter((s) => s.issueType === 'how-to' || s.issueType === 'data-missing')),
    );
    const [a, b] = two.anchors;
    expect(Math.abs((a?.x ?? 0) - (b?.x ?? 0))).toBeGreaterThan(0.4);
  });
});

describe('depth', () => {
  const layout = layoutAtlas(model);
  const depths = (difficulty: string) =>
    layout.nodes
      .filter((n) => model.missions.find((m) => m.id === n.id)?.difficulty === difficulty)
      .map((n) => n.depth);

  it('is nearest for starter and deepest for challenge, in bands that never overlap', () => {
    const [starter, standard, challenge] = [
      depths('starter'),
      depths('standard'),
      depths('challenge'),
    ];
    expect(Math.max(...starter)).toBeLessThanOrEqual(0.16);
    expect(Math.min(...standard)).toBeGreaterThanOrEqual(0.42);
    expect(Math.max(...standard)).toBeLessThanOrEqual(0.58);
    expect(Math.min(...challenge)).toBeGreaterThanOrEqual(0.84);
    expect(Math.max(...starter)).toBeLessThan(Math.min(...standard));
    expect(Math.max(...standard)).toBeLessThan(Math.min(...challenge));
  });

  it('is spread a little within each band, so a row of equals does not look stamped out', () => {
    for (const band of [depths('starter'), depths('standard'), depths('challenge')]) {
      expect(new Set(band).size).toBeGreaterThan(1);
    }
  });

  it('belongs to the mission: the same under any seed, shape or company', () => {
    const alone = layoutAtlas(modelOf([CATALOGUE[5] as PublicScenarioDTO]), { seed: 5 });
    const here = layout.nodes.find((n) => n.id === CATALOGUE[5]?.id);
    expect(alone.nodes[0]?.depth).toBe(here?.depth);
    expect(layoutAtlas(model, { seed: 8, aspect: 2 }).nodes.map((n) => n.depth)).toEqual(
      layout.nodes.map((n) => n.depth),
    );
  });
});

describe('any number of missions', () => {
  it('has nothing to place when there are no missions', () => {
    expect(layoutAtlas(modelOf([]))).toEqual({ nodes: [], anchors: [] });
  });

  it.each([1, 2, 13, 40, 60])(
    'keeps %i missions inside the bounds and at least the minimum apart',
    (size) => {
      for (const aspect of [0.75, 1, 1.6, 2.4]) {
        const catalogue = size === 13 ? CATALOGUE : syntheticCatalogue(size, size);
        const small = modelOf(catalogue);
        expectSound(layoutAtlas(small, { aspect }), small, aspect);
      }
    },
  );

  it('spreads out a crowd that all belongs to one family', () => {
    for (const size of [2, 7, 19, 40]) {
      const crowd = syntheticCatalogue(size, 3).map((s) => ({
        ...s,
        issueType: 'how-to' as const,
      }));
      const crowded = modelOf(crowd);
      expectSound(layoutAtlas(crowded), crowded);
    }
  });

  it('eases the minimum when the map is simply too full, and still stays inside the bounds', () => {
    const full = modelOf(syntheticCatalogue(160, 4));
    const layout = layoutAtlas(full);
    expect(layout.nodes).toHaveLength(160);
    expect(closestPair(layout)).toBeGreaterThan(0.04);
    for (const node of layout.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(ATLAS_BOUNDS.min);
      expect(node.x).toBeLessThanOrEqual(ATLAS_BOUNDS.max);
      expect(node.y).toBeGreaterThanOrEqual(ATLAS_BOUNDS.min);
      expect(node.y).toBeLessThanOrEqual(ATLAS_BOUNDS.max);
    }
    expect(layoutAtlas(full)).toEqual(layout);
  });

  it('holds for random catalogues, seeds and shapes, and does not depend on the order listed', () => {
    const random = seeded(2026);
    for (let trial = 0; trial < 60; trial += 1) {
      const size = random.int(0, 60);
      const options = { seed: random.int(0, 1_000_000), aspect: 0.75 + random.next() * 1.65 };
      const scenarios = syntheticCatalogue(size, trial + 1);
      const generated = modelOf(scenarios);
      const layout = layoutAtlas(generated, options);
      expectSound(layout, generated, options.aspect);
      expect(layoutAtlas(generated, options)).toEqual(layout);
      expect(layoutAtlas(modelOf(shuffled(scenarios, trial)), options)).toEqual(layout);
    }
  });
});
