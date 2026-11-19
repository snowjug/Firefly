import { describe, expect, it } from 'vitest';
import { DIMENSION_IDS } from '#shared/domain/vocab.ts';
import { trend } from './progress.fixtures.ts';
import {
  CALLS_FOR_TREND,
  RECENT_CHANGE,
  SPARK,
  orderedTrends,
  scoreRows,
  sparkGeometry,
  trendAlt,
  trendSummary,
} from './progress-model.ts';

describe('trendSummary', () => {
  it('says latest, average and direction in one line, with an icon for the direction', () => {
    const summary = trendSummary(trend('clarity', [2, 3, 3, 4, 4], 'up'));
    expect(summary.text).toBe('Latest 4 \u00b7 average 3.2 \u00b7 rising');
    expect(summary.direction).toEqual({ word: 'rising', icon: 'trending-up' });
    expect(trendSummary(trend('clarity', [4, 3, 3, 2], 'down')).direction?.word).toBe(
      'lower lately',
    );
    expect(trendSummary(trend('clarity', [3, 3, 3, 3], 'steady')).direction?.word).toBe('steady');
  });

  it('does not name a direction before the server can, and says when it will', () => {
    const two = trendSummary(trend('clarity', [2, 4], 'not-enough-data'));
    expect(two.direction).toBeNull();
    expect(two.text).toBe(
      `Latest 4 \u00b7 average 3.0 \u00b7 a trend shows after ${CALLS_FOR_TREND} calls`,
    );
  });

  it('asks for a second call when there is only one, and says when there is none', () => {
    expect(trendSummary(trend('clarity', [3], 'not-enough-data'))).toEqual({
      text: 'Latest 3 \u00b7 Complete 2+ calls to see a trend',
      direction: null,
    });
    expect(trendSummary(trend('clarity', [], 'not-enough-data'))).toEqual({
      text: 'Not scored yet',
      direction: null,
    });
  });
});

describe('trendAlt', () => {
  it('lists every score, oldest to newest, for a screen reader', () => {
    expect(trendAlt(trend('opening-rapport', [3, 3, 4], 'not-enough-data'))).toBe(
      'Opening & Rapport scores across 3 calls, oldest to newest: 3, 3, 4.',
    );
    expect(trendAlt(trend('closing', [5], 'not-enough-data'))).toBe(
      'Closing scores across 1 call, oldest to newest: 5.',
    );
  });
});

describe('sparkGeometry', () => {
  const { width, height, padX, padY } = SPARK;

  it('puts 5 at the top and 1 at the bottom, and spaces calls evenly from left to right', () => {
    const { points, grid } = sparkGeometry([1, 3, 5]);
    expect(points.map((p) => p.x)).toEqual([padX, width / 2, width - padX]);
    expect(points[0]?.y).toBe(height - padY);
    expect(points[2]?.y).toBe(padY);
    expect(points[1]?.y).toBe(height / 2);
    // The 1, 3 and 5 lines sit where those scores are drawn.
    expect(grid).toEqual([height - padY, height / 2, padY]);
  });

  it('draws a single call as one centred point with no line', () => {
    const geometry = sparkGeometry([4]);
    expect(geometry.points).toHaveLength(1);
    expect(geometry.points[0]?.x).toBe(width / 2);
    expect(geometry.line).toBe('');
    expect(geometry.area).toBe('');
  });

  it('keeps scores outside 1 to 5 inside the chart', () => {
    const { points } = sparkGeometry([0, 9]);
    expect(points[0]?.y).toBe(height - padY);
    expect(points[1]?.y).toBe(padY);
  });

  it('closes the fill along the bottom of the chart', () => {
    const { line, area } = sparkGeometry([2, 4]);
    expect(line.startsWith('M')).toBe(true);
    expect(area.startsWith(line)).toBe(true);
    expect(area.endsWith('Z')).toBe(true);
  });
});

describe('orderedTrends and scoreRows', () => {
  it('puts the six skills in the report order whatever order they arrive in', () => {
    const shuffled = [...DIMENSION_IDS].reverse().map((id) => trend(id, [3], 'not-enough-data'));
    expect(orderedTrends(shuffled).map((t) => t.dimension)).toEqual([...DIMENSION_IDS]);
  });

  it('makes one row per call, oldest first, with a score for each skill that has one', () => {
    const rows = scoreRows([
      trend('clarity', [3, 4], 'not-enough-data', 5),
      trend('closing', [2], 'not-enough-data', 5),
    ]);
    expect(rows.map((r) => r.sessionId)).toEqual(['call-1', 'call-2']);
    expect(rows[0]?.scores).toEqual({ clarity: 3, closing: 2 });
    expect(rows[1]?.scores).toEqual({ clarity: 4 });
  });
});

describe('RECENT_CHANGE', () => {
  it('has calm wording for every case, and never an alarm tone for a dip', () => {
    expect(Object.keys(RECENT_CHANGE).sort()).toEqual([
      'declining',
      'improving',
      'not-enough-data',
      'steady',
    ]);
    expect(RECENT_CHANGE.declining.tone).not.toBe('red');
    expect(RECENT_CHANGE.declining.label).toBe('A little lower');
  });
});
