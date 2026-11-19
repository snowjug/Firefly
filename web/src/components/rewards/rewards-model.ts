import type {
  BadgeDTO,
  BadgeId,
  ChallengeDTO,
  ChallengeId,
  RewardsDTO,
} from '#shared/domain/api.ts';
import { plural } from '../../lib/format.ts';
import type { IconName } from '../Icon.tsx';

// Wording and grouping for the rewards page. The numbers all come from the server; nothing here
// works out what was earned.

/** How many points-history entries show before "Show more". */
export const LEDGER_PAGE = 20;

export const REWARD_TABS = ['all', 'progress', 'challenges'] as const;
export type RewardTab = (typeof REWARD_TABS)[number];

export interface BadgeVisual {
  icon: IconName;
  tone: 'amber' | 'violet';
}

const BADGE_VISUALS: Record<BadgeId, BadgeVisual> = {
  'first-practice': { icon: 'award', tone: 'amber' },
  'scope-detective': { icon: 'search', tone: 'violet' },
  'de-escalator': { icon: 'smile', tone: 'violet' },
  'ownership-builder': { icon: 'flag', tone: 'amber' },
  'scenario-explorer': { icon: 'compass', tone: 'violet' },
  'consistency-streak': { icon: 'flame', tone: 'amber' },
};

/** The icon and tint for a badge. An id this app does not know yet still gets a sensible look. */
export function badgeVisual(id: string): BadgeVisual {
  return BADGE_VISUALS[id as BadgeId] ?? { icon: 'award', tone: 'amber' };
}

export const earnedCount = (badges: readonly BadgeDTO[]) => badges.filter((b) => b.earned).length;

/** Started but not earned yet. */
export const isBadgeInProgress = (badge: BadgeDTO) => !badge.earned && badge.progress.current > 0;

export const activeChallenges = (challenges: readonly ChallengeDTO[]) =>
  challenges.filter((c) => c.status === 'active');

/** The server counts "families"; learners know them as kinds of call. The noun agrees with the target. */
const UNIT_FORMS: Record<string, readonly [one: string, many: string]> = {
  families: ['kind of call', 'kinds of call'],
  scenarios: ['scenario', 'scenarios'],
  calls: ['call', 'calls'],
  days: ['day', 'days'],
};

function unitText(unit: string, target: number): string {
  const forms = UNIT_FORMS[unit];
  if (!forms) return unit;
  return target === 1 ? forms[0] : forms[1];
}

/** "2 of 3 scenarios", and "1 of 1 call". */
export function badgeProgressText(badge: BadgeDTO): string {
  const { current, target, unit } = badge.progress;
  return `${current} of ${target} ${unitText(unit, target)}`;
}

const CHALLENGE_UNITS: Partial<Record<ChallengeId, string>> = {
  'try-new-family': 'families',
  'find-every-fact': 'scenarios',
  'practise-again': 'days',
};

/** "3 of 7 kinds of call". A challenge that is a single step reads "Not yet" or "Done". */
export function challengeProgressText(challenge: ChallengeDTO): string {
  const { current, target } = challenge.progress;
  const unit = CHALLENGE_UNITS[challenge.id];
  if (!unit) return current >= target ? 'Done' : 'Not yet';
  return `${current} of ${target} ${unitText(unit, target)}`;
}

export interface LevelProgress {
  /**
   * 0 to 1. A level needs both enough points and enough kinds of call, so this is the average of
   * the two and only reaches 1 when both are met. The words beside the bar say what is left.
   */
  ratio: number;
  top: boolean;
  nextName: string | null;
  /** "480 points and 2 more kinds of call to go". */
  toGo: string;
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));

export function levelProgress(
  data: Pick<RewardsDTO, 'points' | 'level' | 'nextLevel' | 'families'>,
): LevelProgress {
  const next = data.nextLevel;
  if (!next) return { ratio: 1, top: true, nextName: null, toGo: 'You have reached the top level' };

  const pointSpan = next.minPoints - data.level.minPoints;
  const kindSpan = next.minFamilies - data.level.minFamilies;
  const pointsRatio = pointSpan > 0 ? clamp((data.points - data.level.minPoints) / pointSpan) : 1;
  const kindsRatio =
    kindSpan > 0 ? clamp((data.families.practised.length - data.level.minFamilies) / kindSpan) : 1;

  const needs: string[] = [];
  if (next.pointsToGo > 0) needs.push(plural(next.pointsToGo, 'point'));
  if (next.familiesToGo > 0) {
    needs.push(`${next.familiesToGo} more ${next.familiesToGo === 1 ? 'kind' : 'kinds'} of call`);
  }
  return {
    ratio: (pointsRatio + kindsRatio) / 2,
    top: false,
    nextName: next.name,
    toGo: needs.length > 0 ? `${needs.join(' and ')} to go` : `Ready for ${next.name}`,
  };
}

export const streakText = (days: number) => plural(days, 'day');
