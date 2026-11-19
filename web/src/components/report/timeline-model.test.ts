import { describe, expect, it } from 'vitest';
import {
  buildMoments,
  defaultSelection,
  journeyAriaLabel,
  layoutChart,
  moodRange,
  planLabels,
  planTicks,
  summariseJourney,
} from './timeline-model.ts';
import { PEAKED_JOURNEY, longJourney, point } from './report.fixtures.ts';

describe('journey summary', () => {
  it('names the start, the peak and the end in bands, never as numbers', () => {
    const moments = buildMoments(PEAKED_JOURNEY);
    expect(summariseJourney(moments)).toBe(
      'started Frustrated, peaked Angry at turn 6, ended Calm',
    );
    expect(journeyAriaLabel(moments)).toBe(
      'Customer mood timeline: started Frustrated, peaked Angry at turn 6, ended Calm.',
    );
  });

  it('handles a call that never left one band, and a very short journey', () => {
    expect(summariseJourney(buildMoments([point(1, 12, 'start', 0), point(2, 4, 'end', -8)]))).toBe(
      'stayed Calm throughout',
    );
    expect(
      summariseJourney(buildMoments([point(1, 12, 'start', 0), point(2, 33, 'end', 21)])),
    ).toBe('started Calm, ended Concerned');
  });
});

describe('the customer mood in one phrase', () => {
  it('names where it started and where it ended', () => {
    expect(moodRange(PEAKED_JOURNEY)).toBe('Frustrated to Calm');
    expect(moodRange([point(1, 12, 'start', 0), point(2, 5, 'end', -7)])).toBe('Stayed Calm');
    expect(moodRange([point(1, 12, 'start', 0), point(2, 33, 'end', 21)])).toBe(
      'Calm to Concerned',
    );
    expect(moodRange([])).toBeNull();
  });
});

describe('moments', () => {
  it('describes direction from the band change first, then from the size of the move', () => {
    const moments = buildMoments([
      point(1, 38, 'start', 0),
      point(2, 41, 'turn', 3),
      point(4, 42, 'turn', 1),
      point(6, 30, 'turn', -12),
    ]);
    expect(moments.map((m) => m.direction)).toEqual(['start', 'rose', 'steady', 'eased']);
    expect(moments[1]?.change).toBe('Rose from Concerned to Frustrated.');
    expect(moments[2]?.change).toBe('Held steady at Frustrated.');
    expect(moments[3]?.name).toBe('Turn 6, Concerned, eased');
  });

  it('starts on the point where the mood moved most', () => {
    expect(defaultSelection(buildMoments(PEAKED_JOURNEY))).toBe(4);
    expect(defaultSelection(buildMoments([point(1, 20, 'start', 0), point(2, 20, 'end', 0)]))).toBe(
      1,
    );
  });
});

describe('layout', () => {
  it('spaces points evenly and keeps every position inside the chart', () => {
    const moments = buildMoments(longJourney(41));
    const layout = layoutChart(moments, 320);
    const gaps = layout.xs.slice(1).map((x, i) => x - (layout.xs[i] as number));
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(0.001);
    expect(layout.xs[0]).toBeGreaterThanOrEqual(layout.plot.left);
    expect(layout.xs[40]).toBeLessThanOrEqual(layout.plot.right);
    expect(layout.ys.every((y) => y >= layout.plot.top && y <= layout.plot.bottom)).toBe(true);
    expect(layout.dense).toBe(true);
  });

  it('thins ticks and drops labels that would collide', () => {
    const moments = buildMoments(longJourney(41));
    const layout = layoutChart(moments, 320);
    const ticks = planTicks(moments, layout);
    expect(ticks.length).toBeLessThan(15);
    expect(ticks[0]?.index).toBe(0);
    expect(ticks[ticks.length - 1]?.index).toBe(40);
    const gaps = ticks.slice(1).map((t, i) => t.x - (ticks[i] as { x: number }).x);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(26);

    const labels = planLabels(moments, layout);
    const turning = moments.filter((m) => m.point.kind === 'turning-point').length;
    expect(labels.length).toBeLessThan(turning);
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        const a = labels[i]!;
        const b = labels[j]!;
        const sameLine = Math.abs(a.y - b.y) < 14;
        expect(sameLine && Math.abs(a.x - b.x) < 40).toBe(false);
      }
    }
  });

  it('renders two points as a single segment across the chart', () => {
    const moments = buildMoments([point(1, 52, 'start', 0), point(2, 30, 'end', -22)]);
    const layout = layoutChart(moments, 640);
    expect(layout.xs).toHaveLength(2);
    expect((layout.xs[1] as number) - (layout.xs[0] as number)).toBeGreaterThan(300);
  });

  it('keeps the plot a positive width even if the container is measured tiny for a moment', () => {
    const layout = layoutChart(buildMoments(PEAKED_JOURNEY), 60);
    expect(layout.plot.right).toBeGreaterThan(layout.plot.left);
  });
});
