import { describe, expect, it } from 'vitest';
import { buildAtlas } from './atlas-model.ts';
import { CATALOGUE, runningCall, fullCall, syntheticCatalogue } from './atlas.fixtures.ts';
import { buildChart, kickerFor, plateHeightFor, type Chart } from './atlas-chart.ts';
import {
  kickerWidth,
  labelsUnder,
  placeDetail,
  titleWidth,
  touchesCircle,
  wrapTitle,
  type Rect,
} from './atlas-labels.ts';
import type { PlateSize } from './atlas-plate.ts';

// The plate sizes the page draws at the windows it is designed for: beside the intro on a wide
// window, under it on a narrower one, and tall on a phone.
const WINDOWS = [
  { name: '1440x900', space: { width: 968, viewport: 900, beside: true } },
  { name: '1280x720', space: { width: 814, viewport: 720, beside: true } },
  { name: '1024x768', space: { width: 950, viewport: 768, beside: false } },
  { name: '768x1024', space: { width: 709, viewport: 1024, beside: false } },
  { name: '390x844', space: { width: 354, viewport: 844, beside: false } },
] as const;

const sizeOf = (space: (typeof WINDOWS)[number]['space']): PlateSize => ({
  width: space.width,
  height: plateHeightFor(space),
});

const model = (recommendedId: string | null = 'cannot-find-export-feature') =>
  buildAtlas(CATALOGUE, [], recommendedId);

/** Everything that must never touch: labels, family names, other glyphs, the plate's edge. */
function collisions(chart: Chart, size: PlateSize): string[] {
  const problems: string[] = [];
  const boxes: { id: string; rect: Rect }[] = [
    ...chart.placement.labels.map((label) => ({ id: `label ${label.id}`, rect: label.rect })),
    ...chart.placement.families.map((family) => ({ id: `family ${family.id}`, rect: family.rect })),
  ];
  // A hairline to a label that sits a little way off is part of it, and must keep clear too.
  const hairlines: { id: string; rect: Rect }[] = chart.placement.labels.flatMap((label) =>
    label.leader
      ? [
          {
            id: `leader ${label.id}`,
            rect: {
              x: Math.min(label.leader.x1, label.leader.x2),
              y: Math.min(label.leader.y1, label.leader.y2),
              w: Math.abs(label.leader.x2 - label.leader.x1),
              h: Math.abs(label.leader.y2 - label.leader.y1),
            },
          },
        ]
      : [],
  );
  for (let i = 0; i < boxes.length; i += 1) {
    const a = boxes[i] as (typeof boxes)[number];
    if (
      a.rect.x < 0 ||
      a.rect.y < 0 ||
      a.rect.x + a.rect.w > size.width ||
      a.rect.y + a.rect.h > size.height
    ) {
      problems.push(`${a.id} leaves the plate`);
    }
    for (let j = i + 1; j < boxes.length; j += 1) {
      const b = boxes[j] as (typeof boxes)[number];
      if (!apart(a.rect, b.rect)) problems.push(`${a.id} overlaps ${b.id}`);
    }
    for (const line of hairlines) {
      if (line.id !== `leader ${a.id.replace('label ', '')}` && !apart(a.rect, line.rect)) {
        problems.push(`${a.id} sits on ${line.id}`);
      }
    }
    for (const node of chart.plate.nodes) {
      if (touchesCircle(a.rect, node, node.reach)) problems.push(`${a.id} covers glyph ${node.id}`);
    }
  }
  for (const line of hairlines) {
    for (const node of chart.plate.nodes) {
      const own = line.id === `leader ${node.id}`;
      if (!own && touchesCircle(line.rect, node, node.reach)) {
        problems.push(`${line.id} crosses glyph ${node.id}`);
      }
    }
  }
  return problems;
}

const apart = (a: Rect, b: Rect): boolean =>
  a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;

describe('estimating text', () => {
  it('measures a title the way the real font does, never narrower', () => {
    // Measured in Edge at 16 px with Newsreader: the estimate must be at or above these.
    const measured: [string, number][] = [
      ['Locked out after a password reset', 225.2],
      ['A user needs help finding a feature', 234.1],
      ['Closing out a case where the fix is not fully confirmed', 360.9],
      ['Team cannot open the shared project workspace', 324.7],
      ['Checkout is down and the clock is running', 287.6],
      ['WWWWWWWWWWWW', 185.6],
      ['iiiiiiiiiiii', 53.8],
    ];
    for (const [text, real] of measured) {
      const estimate = titleWidth(text, 16);
      expect(estimate).toBeGreaterThanOrEqual(real);
      expect(estimate).toBeLessThan(real * 1.08);
    }
  });

  it('measures the small mono lines by their character count', () => {
    expect(kickerWidth('STARTER · 8 MIN', 12)).toBeCloseTo(15 * 0.7 * 12, 5);
  });

  it('wraps a title into the lines it will be drawn in, and ends a long one with an ellipsis', () => {
    const lines = wrapTitle('Closing out a case where the fix is not fully confirmed', 232, 16, 2);
    expect(lines).toHaveLength(2);
    for (const line of lines) expect(titleWidth(line, 16)).toBeLessThanOrEqual(232);
    const long = wrapTitle('word '.repeat(80), 200, 16, 2);
    expect(long).toHaveLength(2);
    expect(long[1]?.endsWith('\u2026')).toBe(true);
    expect(wrapTitle('   ', 200, 16, 2)).toEqual([]);
  });

  it('breaks a word that is wider than the label instead of overflowing it', () => {
    const lines = wrapTitle('Pneumonoultramicroscopicsilicovolcanoconiosis', 120, 16, 3);
    for (const line of lines) expect(titleWidth(line, 16)).toBeLessThanOrEqual(120);
  });
});

describe('the label of a mission', () => {
  it('says how hard and how long, and "Suggested" for the one to try next', () => {
    expect(kickerFor({ difficulty: 'starter', minutes: 8, recommended: false })).toBe(
      'Starter \u00b7 8 min',
    );
    expect(kickerFor({ difficulty: 'challenge', minutes: 14.4, recommended: true })).toBe(
      'Suggested \u00b7 Challenge \u00b7 14 min',
    );
  });
});

describe('placing the labels of the 13 real missions', () => {
  for (const window of WINDOWS) {
    const size = sizeOf(window.space);

    it(`never lets two marks touch at ${window.name}`, () => {
      const chart = buildChart(model(), size);
      expect(collisions(chart, size)).toEqual([]);
    });
  }

  for (const window of WINDOWS.slice(0, 4)) {
    const size = sizeOf(window.space);

    it(`names every mission at ${window.name}`, () => {
      const chart = buildChart(model(), size);
      expect(chart.placement.hidden).toEqual([]);
      expect(chart.placement.labels).toHaveLength(13);
    });
  }

  it('names the suggested mission wherever the plate is, however crowded', () => {
    for (const window of WINDOWS) {
      const chart = buildChart(model(), sizeOf(window.space));
      expect(chart.placement.hidden).not.toContain('cannot-find-export-feature');
    }
  });

  it('is the same every time', () => {
    const size = sizeOf(WINDOWS[0].space);
    expect(buildChart(model(), size)).toEqual(buildChart(model(), size));
  });

  it('does not move a mission when the trainee has practised, only the fill and the label change', () => {
    const size = sizeOf(WINDOWS[0].space);
    const fresh = buildChart(model(null), size);
    const practised = buildChart(
      buildAtlas(
        CATALOGUE,
        [fullCall('locked-out-after-password-reset'), runningCall('recurring-midday-slowdowns')],
        'checkout-outage-before-investor-event',
      ),
      size,
    );
    expect(practised.plate.nodes.map(({ id, x, y }) => ({ id, x, y }))).toEqual(
      fresh.plate.nodes.map(({ id, x, y }) => ({ id, x, y })),
    );
  });

  it('draws only the lines it checked, and never more than the label allows', () => {
    const chart = buildChart(model(), sizeOf(WINDOWS[0].space));
    for (const label of chart.placement.labels) {
      // A tight spot may use a narrower, taller label (two more lines at most).
      expect(label.lines.length).toBeLessThanOrEqual(chart.metrics.maxLines + 2);
      expect(label.rect.w).toBeLessThanOrEqual(chart.metrics.maxWidth);
      for (const line of label.lines) {
        expect(titleWidth(line, chart.metrics.titleSize)).toBeLessThanOrEqual(label.rect.w);
      }
    }
  });

  it('puts every family name beside its own missions', () => {
    const chart = buildChart(model(), sizeOf(WINDOWS[0].space));
    expect(chart.placement.families).toHaveLength(7);
    expect(chart.placement.hiddenFamilies).toEqual([]);
  });
});

describe('placing the labels of a crowd of missions', () => {
  for (const seed of [1, 7, 42]) {
    for (const window of WINDOWS) {
      it(`40 made-up missions never touch at ${window.name} (seed ${seed})`, () => {
        const size = sizeOf(window.space);
        const crowd = buildAtlas(syntheticCatalogue(40, seed), [], null);
        const chart = buildChart(crowd, size);
        expect(collisions(chart, size)).toEqual([]);
        // What cannot be named without touching something is left unnamed, never drawn over.
        expect(chart.placement.labels.length + chart.placement.hidden.length).toBe(40);
      });
    }
  }

  it('still names some missions on a wide plate, and drops labels instead of crowding them', () => {
    const size = sizeOf(WINDOWS[0].space);
    const chart = buildChart(buildAtlas(syntheticCatalogue(40, 3), [], null), size);
    expect(chart.placement.labels.length).toBeGreaterThan(8);
  });

  it('copes with a very long title, an empty title and one mission', () => {
    const catalogue = [...syntheticCatalogue(3, 9)].map((scenario, index) => ({
      ...scenario,
      title: index === 0 ? 'x'.repeat(400) : index === 1 ? '' : scenario.title,
    }));
    const size = sizeOf(WINDOWS[0].space);
    const chart = buildChart(buildAtlas(catalogue, [], null), size);
    expect(collisions(chart, size)).toEqual([]);
    const single = buildChart(buildAtlas(catalogue.slice(0, 1), [], null), size);
    expect(single.placement.labels).toHaveLength(1);
    expect(collisions(single, size)).toEqual([]);
    expect(buildChart(buildAtlas([], [], null), size).plate.nodes).toEqual([]);
  });
});

describe('the detail beside a mission', () => {
  const size = sizeOf(WINDOWS[0].space);
  const chart = buildChart(model(), size);
  const card = { w: 272, h: 176 };

  it('opens inside the plate and never over its own glyph', () => {
    for (const node of chart.plate.nodes) {
      const { rect } = placeDetail(node, card, size, chart.plate.nodes);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.w).toBeLessThanOrEqual(size.width);
      expect(rect.y + rect.h).toBeLessThanOrEqual(size.height);
      expect(touchesCircle(rect, node, node.reach)).toBe(false);
    }
  });

  it('prefers the right, and moves to the left at the right edge', () => {
    const first = { id: 'a', x: 100, y: 300, reach: 30, depth: 0 };
    const last = { id: 'b', x: size.width - 60, y: 300, reach: 30, depth: 0 };
    expect(placeDetail(first, card, size, [first, last]).side).toBe('e');
    expect(placeDetail(last, card, size, [first, last]).side).toBe('w');
  });

  it('says which labels it sits over, so they can step back', () => {
    const labels = chart.placement.labels;
    const under = labels[0] as (typeof labels)[number];
    expect(labelsUnder(under.rect, labels)).toContain(under.id);
    expect(labelsUnder({ x: -500, y: -500, w: 10, h: 10 }, labels)).toEqual([]);
  });
});
