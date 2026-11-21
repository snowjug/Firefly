import { describe, expect, it } from 'vitest';
import { DIMENSION_IDS } from '#shared/domain/vocab.ts';
import {
  levelFor,
  skillsFromProgress,
  type SkillInput,
  type SkillLevel,
} from '../atlas/constellation-layout.ts';
import { EMPTY_PROGRESS, PROGRESS_WITH_DATA, trend } from './progress.fixtures.ts';
import {
  CALLS_FOR_TREND,
  LIGHT_STEPS,
  RECENT_CHANGE,
  SPARK,
  STARS_IN_SKY,
  STARS_PER_SKILL,
  callsScored,
  describeSkill,
  latestCall,
  lightNext,
  lightText,
  litStarsOf,
  movedText,
  orderedTrends,
  overallAverage,
  recentStarIds,
  scoreRows,
  skillCaption,
  skillNumber,
  sparkGeometry,
  starCounts,
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
    expect(RECENT_CHANGE.declining.label).toBe('A little lower');
    expect(RECENT_CHANGE.declining.text).toMatch(/can happen when you try a harder scenario/);
    const wording = Object.values(RECENT_CHANGE)
      .map((change) => `${change.label} ${change.text}`)
      .join(' ');
    expect(wording).not.toMatch(/\b(worse|poor|bad|fail|drop|decline|alarm)/i);
  });
});

describe('how a skill is read from its stars', () => {
  it('numbers the skills 01 to 06 in report order', () => {
    expect(DIMENSION_IDS.map(skillNumber)).toEqual(['01', '02', '03', '04', '05', '06']);
    expect(STARS_PER_SKILL).toBe(14);
    expect(STARS_IN_SKY).toBe(84);
  });

  it('states the thresholds the constellation really applies', () => {
    // Each light needs exactly its stated calls and average, and falls to the light below without them.
    for (const step of LIGHT_STEPS) {
      const average = step.average ?? 1;
      expect(levelFor(average, step.calls)).toBe(step.light);
      expect(levelFor(average, step.calls - 1)).toBeLessThan(step.light);
      if (step.average !== null)
        expect(levelFor(step.average - 0.1, step.calls)).toBeLessThan(step.light);
    }
  });

  it('says in words how far a skill is lit, and never calls no evidence low', () => {
    expect(lightText(0)).toBe('No evidence yet');
    expect(lightText(3)).toBe('Light 3 of 4');
    expect(callsScored(0)).toBe('Not scored yet');
    expect(callsScored(1)).toBe('1 call scored');
    expect(callsScored(9)).toBe('9 calls scored');
    expect(skillCaption({ level: 2, evidence: 3 })).toBe('3 calls \u00b7 light 2 of 4');
    expect(skillCaption({ level: 0, evidence: 0 })).toBe('No evidence yet');
  });

  it('says what the next light asks for, or that there is none', () => {
    expect(lightNext(0)).toBe('A star lights once a completed call is scored on this skill.');
    expect(lightNext(1)).toBe('Light 2 asks for 2 calls averaging 2.5 or more.');
    expect(lightNext(3)).toBe('Light 4 asks for 5 calls averaging 4.2 or more.');
    expect(lightNext(4)).toBe('This is the brightest light.');
  });

  it('lights one star per call up to the stars there are, and counts them all', () => {
    expect([0, 1, 5, 14, 15, 400, -3, Number.NaN, 2.9].map(litStarsOf)).toEqual([
      0, 1, 5, 14, 14, 14, 0, 0, 2,
    ]);
    const skills = skillsFromProgress(PROGRESS_WITH_DATA);
    expect(starCounts(skills)).toEqual({ lit: 30, total: 84 });
    expect(starCounts(skillsFromProgress(EMPTY_PROGRESS))).toEqual({ lit: 0, total: 84 });
  });
});

describe('overallAverage and latestCall', () => {
  it('is the mean of every score, or nothing when nothing has been scored', () => {
    expect(overallAverage(EMPTY_PROGRESS.dimensionTrends)).toBeNull();
    expect(
      overallAverage([
        trend('clarity', [2, 4], 'not-enough-data'),
        trend('closing', [3], 'not-enough-data'),
      ]),
    ).toBeCloseTo(3, 5);
  });

  it('finds the newest scored call across every skill', () => {
    const trends = [
      trend('clarity', [3, 4], 'not-enough-data', 1),
      trend('closing', [2], 'not-enough-data', 9),
    ];
    expect(latestCall(trends)).toEqual({ sessionId: 'call-1', at: trends[1]?.points[0]?.at });
    expect(latestCall(EMPTY_PROGRESS.dimensionTrends)).toBeNull();
  });
});

describe('recentStarIds', () => {
  it('marks, for each skill the newest call scored, the last star it lit', () => {
    const trends = [
      trend('opening-rapport', [3, 3, 4], 'not-enough-data', 1),
      trend('clarity', [4, 4], 'not-enough-data', 2),
      // Scored before the newest call, so nothing of it is new.
      trend('closing', [2], 'not-enough-data', 1),
    ];
    // The newest call is call-3 of opening (day 3); clarity's last call is day 3 as well (call-2 on day 3).
    const ids = recentStarIds(trends);
    expect(ids.has('opening-rapport:2')).toBe(true);
    expect(ids.has('clarity:1')).toBe(false);
    expect(ids.size).toBe(1);
  });

  it('never points past the last star of a long history', () => {
    const long = trend(
      'clarity',
      Array.from({ length: 30 }, () => 3),
      'steady',
    );
    expect([...recentStarIds([long])]).toEqual(['clarity:13']);
  });

  it('is empty when nothing has been scored', () => {
    expect(recentStarIds(EMPTY_PROGRESS.dimensionTrends).size).toBe(0);
  });
});

describe('movedText', () => {
  it('puts the two newest scores side by side, in plain numbers', () => {
    expect(movedText(trend('clarity', [3, 4], 'not-enough-data'))).toBe(
      'Latest 4, up from 3 on the call before.',
    );
    expect(movedText(trend('clarity', [4, 2], 'not-enough-data'))).toBe(
      'Latest 2, down from 4 on the call before.',
    );
    expect(movedText(trend('clarity', [3, 3], 'not-enough-data'))).toBe(
      'Latest 3, the same as the call before.',
    );
  });

  it('says nothing when there is no earlier call to compare with', () => {
    expect(movedText(trend('clarity', [3], 'not-enough-data'))).toBeNull();
    expect(movedText(trend('clarity', [], 'not-enough-data'))).toBeNull();
  });
});

describe('describeSkill', () => {
  const skill = (patch: Partial<SkillInput>): SkillInput => ({
    id: 'clarity',
    label: 'Clarity',
    level: 2 as SkillLevel,
    evidence: 3,
    trend: 'steady',
    ...patch,
  });

  it('puts every figure in words, with the direction, and names the suggested focus', () => {
    const text = describeSkill(
      skill({ focus: true }),
      trend('clarity', [3, 3, 3], 'not-enough-data'),
    );
    expect(text).toContain('Clarity: 3 stars lit of 14, 3 calls scored, light 2 of 4.');
    expect(text).toContain('Latest 3');
    expect(text).toContain('Suggested next focus.');
  });

  it('says there is no evidence yet, rather than that the skill is low', () => {
    expect(describeSkill(skill({ evidence: 0, level: 0 }), undefined)).toBe(
      'Clarity: no evidence yet. A star lights once a completed call is scored on this skill.',
    );
  });
});
