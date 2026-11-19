import { describe, expect, it } from 'vitest';
import {
  BADGES,
  BUILDER,
  CHALLENGES,
  CONFIDENT,
  FOUNDATION,
  LIFT_SKILL,
  PRACTISE_AGAIN,
  PRACTITIONER,
  SCOPE_DETECTIVE,
  TRY_FAMILY,
  makeBadge,
  makeRewards,
} from './rewards.fixtures.ts';
import {
  activeChallenges,
  badgeProgressText,
  badgeVisual,
  challengeProgressText,
  earnedCount,
  isBadgeInProgress,
  levelProgress,
  streakText,
} from './rewards-model.ts';

describe('levelProgress', () => {
  it('shows both what is left in points and in kinds of call, and averages the two', () => {
    const progress = levelProgress(makeRewards());
    expect(progress.top).toBe(false);
    expect(progress.nextName).toBe('Confident Handler');
    expect(progress.toGo).toBe('245 points and 1 more kind of call to go');
    // 155 of the 400 points between the levels, and none of the 2 extra kinds of call yet.
    expect(progress.ratio).toBeCloseTo((155 / 400 + 0) / 2, 5);
  });

  it('only fills the bar when both the points and the kinds of call are there', () => {
    const progress = levelProgress({
      points: 900,
      level: PRACTITIONER,
      nextLevel: { ...CONFIDENT, pointsToGo: 0, familiesToGo: 0 },
      families: {
        practised: [
          'how-to',
          'data-missing',
          'service-outage',
          'slow-performance',
          'billing-licence',
          'sign-in-access',
        ],
        total: 7,
      },
    });
    expect(progress.ratio).toBe(1);
    expect(progress.toGo).toBe('Ready for Confident Handler');
  });

  it('reads singular and plural correctly', () => {
    const one = levelProgress({
      points: 149,
      level: FOUNDATION,
      nextLevel: { ...BUILDER, pointsToGo: 1, familiesToGo: 0 },
      families: { practised: ['how-to', 'data-missing'], total: 7 },
    });
    expect(one.toGo).toBe('1 point to go');
    const kinds = levelProgress({
      points: 150,
      level: FOUNDATION,
      nextLevel: { ...BUILDER, pointsToGo: 0, familiesToGo: 2 },
      families: { practised: [], total: 7 },
    });
    expect(kinds.toGo).toBe('2 more kinds of call to go');
  });

  it('says so at the top level, with nothing left to fill', () => {
    const top = levelProgress(makeRewards({ level: CONFIDENT, nextLevel: null, points: 1200 }));
    expect(top).toMatchObject({ top: true, ratio: 1, nextName: null });
    expect(top.toGo).toBe('You have reached the top level');
  });
});

describe('badges', () => {
  it('counts the earned ones and the ones that are started but not earned', () => {
    expect(earnedCount(BADGES)).toBe(2);
    expect(BADGES.filter(isBadgeInProgress).map((b) => b.id)).toEqual([
      'scope-detective',
      'scenario-explorer',
    ]);
  });

  it('writes progress in plain words that agree with the number', () => {
    expect(badgeProgressText(SCOPE_DETECTIVE)).toBe('2 of 3 scenarios');
    expect(
      badgeProgressText(makeBadge({ progress: { current: 0, target: 1, unit: 'calls' } })),
    ).toBe('0 of 1 call');
    expect(
      badgeProgressText(makeBadge({ progress: { current: 3, target: 4, unit: 'families' } })),
    ).toBe('3 of 4 kinds of call');
    expect(
      badgeProgressText(makeBadge({ progress: { current: 1, target: 3, unit: 'days' } })),
    ).toBe('1 of 3 days');
  });

  it('gives a badge this app has not heard of a sensible look', () => {
    expect(badgeVisual('first-practice')).toMatchObject({ icon: 'award' });
    expect(badgeVisual('brand-new-badge')).toEqual({ icon: 'award', tone: 'amber' });
  });
});

describe('challenges', () => {
  it('counts the active ones only', () => {
    expect(activeChallenges(CHALLENGES)).toHaveLength(2);
  });

  it('writes progress by what is being counted, and single steps as Done or Not yet', () => {
    expect(challengeProgressText(TRY_FAMILY)).toBe('3 of 7 kinds of call');
    expect(challengeProgressText(LIFT_SKILL)).toBe('Not yet');
    expect(challengeProgressText(PRACTISE_AGAIN)).toBe('3 of 3 days');
    expect(challengeProgressText({ ...LIFT_SKILL, progress: { current: 1, target: 1 } })).toBe(
      'Done',
    );
  });
});

describe('streakText', () => {
  it('counts days', () => {
    expect(streakText(0)).toBe('0 days');
    expect(streakText(1)).toBe('1 day');
    expect(streakText(4)).toBe('4 days');
  });
});
