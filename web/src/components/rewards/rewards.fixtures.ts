import type {
  BadgeDTO,
  ChallengeDTO,
  LedgerEntryDTO,
  RewardLevelDTO,
  RewardRuleDTO,
  RewardsDTO,
} from '#shared/domain/api.ts';

// Rewards as the server returns them, for tests. Every name and number here is invented.

export const FOUNDATION: RewardLevelDTO = {
  id: 'foundation',
  index: 1,
  name: 'Foundation',
  minPoints: 0,
  minFamilies: 0,
};
export const BUILDER: RewardLevelDTO = {
  id: 'builder',
  index: 2,
  name: 'Builder',
  minPoints: 150,
  minFamilies: 2,
};
export const PRACTITIONER: RewardLevelDTO = {
  id: 'practitioner',
  index: 3,
  name: 'Practitioner',
  minPoints: 400,
  minFamilies: 4,
};
export const CONFIDENT: RewardLevelDTO = {
  id: 'confident-handler',
  index: 4,
  name: 'Confident Handler',
  minPoints: 800,
  minFamilies: 6,
};
export const LEVELS = [FOUNDATION, BUILDER, PRACTITIONER, CONFIDENT];

export const RULES: RewardRuleDTO[] = [
  ['complete-scenario', 'Complete a full scenario', 50],
  ['hidden-fact', 'Uncover a hidden fact', 10],
  ['owner-and-update', 'Give a clear owner and update', 10],
  ['skill-improvement', 'Lift a skill', 15],
  ['new-scenario-family', 'Try a new scenario family', 20],
  ['practice-day', 'Practise on a day', 5],
  ['mentor-confirmed', 'A mentor confirms the result', 25],
].map(([id, title, points]) => ({
  id: id as RewardRuleDTO['id'],
  title: title as string,
  points: points as number,
  detail: `How you earn it: ${title}.`,
  safeguard: `The safeguard for ${title}.`,
}));

export function makeBadge(overrides: Partial<BadgeDTO> = {}): BadgeDTO {
  return {
    id: 'first-practice',
    title: 'First Practice',
    criteria: 'Complete your first full scenario.',
    earned: false,
    earnedAt: null,
    earnedInSessionId: null,
    progress: { current: 0, target: 1, unit: 'scenarios' },
    ...overrides,
  };
}

export const FIRST_PRACTICE = makeBadge({
  id: 'first-practice',
  title: 'First Practice',
  criteria: 'Complete your first full scenario.',
  earned: true,
  earnedAt: '2026-11-12T10:00:00.000Z',
  earnedInSessionId: 'call-1',
  progress: { current: 1, target: 1, unit: 'scenarios' },
});
export const SCOPE_DETECTIVE = makeBadge({
  id: 'scope-detective',
  title: 'Scope Detective',
  criteria: 'Find every hidden fact in three different scenarios.',
  progress: { current: 2, target: 3, unit: 'scenarios' },
});

/** The six badges: two earned, two started, two not started. */
export const BADGES: BadgeDTO[] = [
  FIRST_PRACTICE,
  SCOPE_DETECTIVE,
  makeBadge({
    id: 'de-escalator',
    title: 'De-escalator',
    criteria: 'Bring a tense customer back down.',
    progress: { current: 0, target: 1, unit: 'calls' },
  }),
  makeBadge({
    id: 'ownership-builder',
    title: 'Ownership Builder',
    criteria: 'Give a clear owner, action and next-update time in three calls.',
    earned: true,
    earnedAt: '2026-11-15T10:00:00.000Z',
    earnedInSessionId: 'call-3',
    progress: { current: 3, target: 3, unit: 'calls' },
  }),
  makeBadge({
    id: 'scenario-explorer',
    title: 'Scenario Explorer',
    criteria: 'Complete full calls across four different scenario families.',
    progress: { current: 3, target: 4, unit: 'families' },
  }),
  makeBadge({
    id: 'consistency-streak',
    title: 'Consistency Streak',
    criteria: 'Build a streak of three practice days.',
    progress: { current: 0, target: 3, unit: 'days' },
  }),
];

export function makeChallenge(overrides: Partial<ChallengeDTO> = {}): ChallengeDTO {
  return {
    id: 'try-new-family',
    title: 'Try a new scenario family',
    detail: 'Practise a kind of customer issue you have not tried yet.',
    reward: '20 points',
    progress: { current: 3, target: 7 },
    status: 'active',
    scenarioId: 'slow-dashboard',
    ...overrides,
  };
}

export const TRY_FAMILY = makeChallenge();
export const LIFT_SKILL = makeChallenge({
  id: 'lift-a-skill',
  title: 'Lift a skill by a point',
  detail: 'Your lowest recent average at Starter is Clarity, 2.5.',
  reward: '15 points',
  progress: { current: 0, target: 1 },
  scenarioId: 'locked-out',
  difficulty: 'starter',
});
export const PRACTISE_AGAIN = makeChallenge({
  id: 'practise-again',
  title: 'Practise on another day',
  detail: 'A missed day never counts against you.',
  reward: 'Toward Consistency Streak',
  progress: { current: 3, target: 3 },
  status: 'completed',
  scenarioId: null,
});
export const CHALLENGES: ChallengeDTO[] = [TRY_FAMILY, LIFT_SKILL, PRACTISE_AGAIN];

export function makeEntry(index: number, overrides: Partial<LedgerEntryDTO> = {}): LedgerEntryDTO {
  return {
    id: `entry-${index}`,
    ruleId: 'complete-scenario',
    points: 50,
    at: new Date(Date.UTC(2026, 10, 20, 12) - index * 3_600_000).toISOString(),
    sessionId: `call-${index}`,
    scenarioTitle: `Scenario ${index}`,
    title: `Completed a full scenario ${index}`,
    reason: `You finished a full call in scenario ${index}.`,
    evidence: null,
    ...overrides,
  };
}

/** A learner at Practitioner with two badges, some practice and a short history. */
export function makeRewards(overrides: Partial<RewardsDTO> = {}): RewardsDTO {
  return {
    points: 555,
    level: PRACTITIONER,
    nextLevel: { ...CONFIDENT, pointsToGo: 245, familiesToGo: 1 },
    levels: LEVELS,
    families: {
      practised: ['sign-in-access', 'service-outage', 'how-to', 'data-missing'],
      total: 7,
    },
    streak: { current: 2, best: 3, activeDays: 4, practisedToday: false },
    badges: BADGES,
    challenges: CHALLENGES,
    ledger: [
      makeEntry(1, {
        ruleId: 'hidden-fact',
        points: 10,
        title: 'Uncovered a hidden fact',
        reason: 'Your question brought out the time the problem started.',
        evidence: { turnIndex: 4, quote: 'When did this start, and did anything change?' },
      }),
      makeEntry(2),
    ],
    rules: RULES,
    note: 'Rewards are private to this browser profile. They are encouragement for practising, not an assessment, and they are never compared with anyone else.',
    ...overrides,
  };
}

/** A brand-new learner: nothing earned, nothing started. */
export function makeEmptyRewards(): RewardsDTO {
  return makeRewards({
    points: 0,
    level: FOUNDATION,
    nextLevel: { ...BUILDER, pointsToGo: 150, familiesToGo: 2 },
    families: { practised: [], total: 7 },
    streak: { current: 0, best: 0, activeDays: 0, practisedToday: false },
    badges: BADGES.map((badge) =>
      makeBadge({
        ...badge,
        earned: false,
        earnedAt: null,
        earnedInSessionId: null,
        progress: { ...badge.progress, current: 0 },
      }),
    ),
    challenges: CHALLENGES.filter((c) => c.status === 'active').map((c) => ({
      ...c,
      progress: { ...c.progress, current: 0 },
    })),
    ledger: [],
  });
}
