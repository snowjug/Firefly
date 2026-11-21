import { describe, expect, it } from 'vitest';
import { CALL_NAMES, callFixtures } from './fixtures.ts';
import {
  changeText,
  journeyListItems,
  journeySentence,
  journeyTableRows,
  layoutChart,
} from './journey-model.ts';

describe('journeyListItems', () => {
  it('lists only the start, the turning points, the unexpected turn and the end', async () => {
    const calls = await callFixtures();
    for (const name of CALL_NAMES) {
      const { report } = calls[name];
      const items = journeyListItems(report.journey);
      for (const item of items) {
        expect(['start', 'turning-point', 'curveball', 'end'], name).toContain(item.point.kind);
      }
      expect(items[0]?.point.kind).toBe('start');
      expect(items.at(-1)?.point.kind).toBe('end');
    }
  });

  it('writes "Turn N: from to to" for a change of band, and says when the band did not change', async () => {
    const { strong, weak } = await callFixtures();
    const items = journeyListItems(strong.report.journey);
    expect(items[0]?.heading).toBe('Turn 1: Started Frustrated');
    expect(items[1]?.heading).toBe('Turn 2: Frustrated to Concerned');
    expect(items.map((i) => i.heading)).toContain('Turn 10: Concerned to Calm');
    expect(items.map((i) => i.heading)).toContain('Turn 12: Still Calm, temperature eased');
    expect(journeyListItems(weak.report.journey).map((i) => i.heading)).toContain(
      'Turn 6: Still Frustrated, temperature rose',
    );
  });

  it('carries the reason and the trainee\u2019s words through untouched', async () => {
    const { strong } = await callFixtures();
    const turning = journeyListItems(strong.report.journey).find((i) => i.point.turnIndex === 2);
    expect(turning?.reason).toBe('Acknowledged the business impact');
    expect(turning?.quote).toBe(
      "I'm sorry your team can't open the project workspace, and I can see how much that holds you up.",
    );
  });

  it('calls an unexpected turn an unexpected turn', async () => {
    const { curveball } = await callFixtures();
    const kinds = journeyListItems(curveball.report.journey)
      .filter((i) => i.point.kind === 'curveball')
      .map((i) => i.kindLabel);
    expect(kinds.length).toBeGreaterThan(0);
    expect(new Set(kinds)).toEqual(new Set(['Unexpected turn']));
    for (const item of journeyListItems(curveball.report.journey)) {
      expect(item.reason ?? '').not.toMatch(/curveball/i);
    }
  });
});

describe('changeText', () => {
  const point = (band: string, delta: number, kind: 'turn' | 'start' = 'turn') => ({
    turnIndex: 4,
    temperature: 50,
    band,
    kind,
    delta,
    reason: null,
    quote: null,
  });

  it('says how the temperature moved without a number', () => {
    expect(changeText(point('Calm', 0), point('Angry', 15))).toBe('Calm to Angry');
    expect(changeText(point('Angry', 0), point('Angry', 5))).toBe('Still Angry, temperature rose');
    expect(changeText(point('Angry', 0), point('Angry', -5))).toBe(
      'Still Angry, temperature eased',
    );
    expect(changeText(point('Angry', 0), point('Angry', 0))).toBe('Still Angry');
    expect(changeText(null, point('Calm', 0, 'start'))).toBe('Started Calm');
  });
});

describe('journeyTableRows', () => {
  it('has a row for every point, the stand-in for the chart', async () => {
    const calls = await callFixtures();
    for (const name of CALL_NAMES) {
      const { journey } = calls[name].report;
      const rows = journeyTableRows(journey);
      expect(
        rows.map((r) => r.turnIndex),
        name,
      ).toEqual(journey.points.map((p) => p.turnIndex));
      expect(
        rows.every((r) => ['Rose', 'Eased', 'No change', 'Start of the call'].includes(r.change)),
      ).toBe(true);
    }
  });

  it('never shows the 0 to 100 temperature', async () => {
    const { weak } = await callFixtures();
    for (const row of journeyTableRows(weak.report.journey)) {
      expect(Object.keys(row).sort()).toEqual([
        'band',
        'change',
        'kindLabel',
        'reason',
        'turnIndex',
      ]);
      expect(row.band).toMatch(/^[A-Z][a-z]+$/);
    }
  });
});

describe('journeySentence', () => {
  it('says where the customer started and ended, and the high point when it was a different band', async () => {
    const { strong, weak } = await callFixtures();
    expect(journeySentence(strong.report.journey)).toBe(
      'The customer started Frustrated and ended Calm.',
    );
    expect(journeySentence(weak.report.journey)).toBe(
      'The customer started Concerned and ended Frustrated. It was highest at turn 10, when the customer was Frustrated.',
    );
  });

  it('is honest when nothing was recorded', async () => {
    const { strong } = await callFixtures();
    expect(journeySentence({ ...strong.report.journey, points: [] })).toMatch(/not recorded/);
  });
});

describe('layoutChart', () => {
  it('draws five bands, the hottest at the top, filling the plot', async () => {
    const { strong } = await callFixtures();
    const chart = layoutChart(strong.report.journey.points, { width: 640, height: 288 });
    expect(chart.bands.map((b) => b.label)).toEqual([
      'Escalating',
      'Angry',
      'Frustrated',
      'Concerned',
      'Calm',
    ]);
    expect(chart.bands[0]?.top).toBe(chart.plot.top);
    expect(chart.bands.at(-1)?.bottom).toBeCloseTo(chart.plot.bottom);
    for (const [i, band] of chart.bands.entries()) {
      if (i > 0) expect(band.top).toBeCloseTo(chart.bands[i - 1]?.bottom ?? 0);
    }
  });

  it('places every point inside the plot, left to right, hotter points higher', async () => {
    const calls = await callFixtures();
    for (const name of CALL_NAMES) {
      const { points } = calls[name].report.journey;
      const chart = layoutChart(points, { width: 480, height: 244, gutter: 92 });
      expect(chart.points).toHaveLength(points.length);
      chart.points.forEach((p, i) => {
        expect(p.x, name).toBeGreaterThanOrEqual(chart.plot.left);
        expect(p.x, name).toBeLessThanOrEqual(chart.plot.right);
        expect(p.y, name).toBeGreaterThanOrEqual(chart.plot.top);
        expect(p.y, name).toBeLessThanOrEqual(chart.plot.bottom);
        if (i > 0) expect(p.x, name).toBeGreaterThan(chart.points[i - 1]?.x ?? 0);
      });
      const hottest = points.reduce((a, b) => (b.temperature > a.temperature ? b : a));
      const coldest = points.reduce((a, b) => (b.temperature < a.temperature ? b : a));
      const yOf = (p: typeof hottest) => chart.points[points.indexOf(p)]?.y ?? 0;
      if (hottest.temperature > coldest.temperature)
        expect(yOf(hottest)).toBeLessThan(yOf(coldest));
    }
  });

  it('draws a line through every point', async () => {
    const { strong } = await callFixtures();
    const chart = layoutChart(strong.report.journey.points, { width: 640, height: 288 });
    expect(chart.path.startsWith('M')).toBe(true);
    expect(chart.path.match(/L/g)).toHaveLength(strong.report.journey.points.length - 1);
  });

  it('labels the first and last turn and thins the rest to fit a long call', async () => {
    const { long } = await callFixtures();
    const { points } = long.report.journey;
    expect(points.length).toBeGreaterThan(30);
    const wide = layoutChart(points, { width: 900, height: 288 });
    const narrow = layoutChart(points, { width: 320, height: 244, gutter: 92 });
    for (const chart of [wide, narrow]) {
      expect(chart.ticks[0]?.label).toBe(String(points[0]?.turnIndex));
      expect(chart.ticks.at(-1)?.label).toBe(String(points.at(-1)?.turnIndex));
      expect(chart.ticks.length).toBeLessThan(points.length);
      const xs = chart.ticks.map((t) => t.x);
      for (let i = 1; i < xs.length; i += 1)
        expect((xs[i] ?? 0) - (xs[i - 1] ?? 0)).toBeGreaterThan(20);
    }
    expect(narrow.ticks.length).toBeLessThan(wide.ticks.length);
  });

  it('copes with a single point', async () => {
    const { strong } = await callFixtures();
    const [first] = strong.report.journey.points;
    if (!first) throw new Error('no points');
    const chart = layoutChart([first], { width: 500, height: 260 });
    expect(chart.points).toHaveLength(1);
    expect(chart.ticks).toHaveLength(1);
  });
});
