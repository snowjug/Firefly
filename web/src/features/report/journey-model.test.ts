import { describe, expect, it } from 'vitest';
import type { JourneyPoint } from '#shared/domain/report.ts';
import { CALLS, CALL_NAMES } from './fixtures.ts';
import {
  changeText,
  journeyListItems,
  journeySentence,
  journeyTableRows,
  layoutChart,
  pointSummary,
} from './journey-model.ts';

describe('journeyListItems', () => {
  it('lists only the start, the turning points, the unexpected turn and the end', () => {
    for (const name of CALL_NAMES) {
      const items = journeyListItems(CALLS[name].report.journey);
      for (const item of items) {
        expect(['start', 'turning-point', 'curveball', 'end'], name).toContain(item.point.kind);
      }
      expect(items[0]?.point.kind).toBe('start');
      expect(items.at(-1)?.point.kind).toBe('end');
    }
  });

  it('writes "Turn N: from to to" for a change of band, and says when the band did not change', () => {
    const items = journeyListItems(CALLS.strong.report.journey);
    expect(items.map((i) => i.heading)).toEqual([
      'Start of the call: Frustrated',
      'Turn 4: Frustrated to Concerned',
      'Turn 10: Concerned to Calm',
      'Turn 14: Still Calm, temperature eased',
    ]);
    expect(journeyListItems(CALLS.weak.report.journey).map((i) => i.heading)).toContain(
      'Turn 10: Still Escalating, temperature rose',
    );
  });

  it('carries the reason and the trainee\u2019s words through untouched', () => {
    const turning = journeyListItems(CALLS.strong.report.journey).find(
      (i) => i.point.turnIndex === 4,
    );
    expect(turning?.reason).toBe('Asked a focused question about scope');
    expect(turning?.quote).toBe('Is it happening in every meeting, or only for some organisers?');
  });

  it('calls an unexpected turn an unexpected turn', () => {
    const items = journeyListItems(CALLS.curveball.report.journey);
    const kinds = items.filter((i) => i.point.kind === 'curveball').map((i) => i.kindLabel);
    expect(kinds).toEqual(['Unexpected turn']);
    for (const item of items) expect(item.reason ?? '').not.toMatch(/curveball/i);
  });
});

describe('changeText and pointSummary', () => {
  const point = (band: string, delta: number, kind: JourneyPoint['kind'] = 'turn') => ({
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

  it('names the turn for a point and the call itself for the start', () => {
    expect(pointSummary(point('Calm', 0), point('Concerned', 5))).toBe('Turn 4: Calm to Concerned');
    expect(pointSummary(null, point('Calm', 0, 'start'))).toBe('Start of the call: Calm');
  });
});

describe('journeyTableRows', () => {
  it('has a row for every point, the stand-in for the chart', () => {
    for (const name of CALL_NAMES) {
      const { journey } = CALLS[name].report;
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

  it('never shows the 0 to 100 temperature', () => {
    for (const row of journeyTableRows(CALLS.weak.report.journey)) {
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
  it('says where the customer started and ended', () => {
    expect(journeySentence(CALLS.strong.report.journey)).toBe(
      'The customer started Frustrated and ended Calm.',
    );
  });

  it('adds the high point only when it was neither where the call began nor where it ended', () => {
    expect(journeySentence(CALLS.curveball.report.journey)).toBe(
      'The customer started Frustrated and ended Calm. It was highest at turn 2, when the customer was Angry.',
    );
    // The weak call ended at its hottest: the ending already says so.
    expect(journeySentence(CALLS.weak.report.journey)).toBe(
      'The customer started Angry and ended Escalating.',
    );
  });

  it('is honest when nothing was recorded', () => {
    expect(journeySentence({ ...CALLS.strong.report.journey, points: [] })).toMatch(/not recorded/);
  });
});

describe('layoutChart', () => {
  it('draws five bands, the hottest at the top, filling the plot', () => {
    const chart = layoutChart(CALLS.strong.report.journey.points, { width: 640, height: 288 });
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

  it('places every point inside the plot, left to right, hotter points higher', () => {
    for (const name of CALL_NAMES) {
      const { points } = CALLS[name].report.journey;
      const chart = layoutChart(points, { width: 480, height: 244, gutter: 92 });
      expect(chart.points).toHaveLength(points.length);
      chart.points.forEach((p, i) => {
        expect(p.index, name).toBe(i);
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

  it('draws a line through every point', () => {
    const { points } = CALLS.strong.report.journey;
    const chart = layoutChart(points, { width: 640, height: 288 });
    expect(chart.path.startsWith('M')).toBe(true);
    expect(chart.path.match(/L/g)).toHaveLength(points.length - 1);
  });

  it('labels the first and last turn and thins the rest to fit a long call', () => {
    const { points } = CALLS.long.report.journey;
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

  it('copes with a single point', () => {
    const [first] = CALLS.strong.report.journey.points;
    if (!first) throw new Error('no points');
    const chart = layoutChart([first], { width: 500, height: 260 });
    expect(chart.points).toHaveLength(1);
    expect(chart.ticks).toHaveLength(1);
  });
});
