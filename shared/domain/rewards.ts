import type {
  BadgeDTO,
  BadgeId,
  ChallengeDTO,
  LedgerEntryDTO,
  PublicScenarioDTO,
  RewardLevelDTO,
  RewardRuleDTO,
  RewardsDTO,
} from './api.ts';
import { deriveAchievements } from './achievements.ts';
import { scenarioForSkill } from './recommend.ts';
import type { CoachingReport } from './report.ts';
import { DIFFICULTY_PROFILES } from './state.ts';
import {
  DIFFICULTY_RANK,
  DIMENSION_IDS,
  DIMENSIONS,
  ISSUE_TYPE_LABELS,
  ISSUE_TYPES,
  type Difficulty,
  type DimensionId,
  type IssueType,
} from './vocab.ts';

// Rewards are worked out from the saved practice history and nothing else, every time they are
// asked for. There is no stored ledger, so asking again can never pay out twice, and deleting a call
// takes back exactly what that call earned.
//
// They encourage repeating practice, trying different kinds of call and improving. They never rank
// or compare people, never pay for speed or volume, and never take anything away for a retry or a
// missed day. Every entry says why it was awarded and, where there is one, points at the quote.

const POINTS = {
  fullCall: 50,
  repeatCall: 10,
  hiddenFact: 10,
  ownerAndUpdate: 10,
  skillImprovement: 15,
  newFamily: 20,
  practiceDay: 5,
  mentorConfirmed: 25,
} as const;

/** Completions of one scenario that earn the full amount; later repeats earn the smaller one. */
const FULL_VALUE_COMPLETIONS = 2;
const OWNERSHIP_MIN_SCORE = 4;
/** A skill is compared with the mean of up to this many earlier calls at the same difficulty. */
const SKILL_WINDOW = 3;
const SKILL_MIN_HISTORY = 2;
const SKILL_MIN_SCORE = 3;
const SKILL_MIN_GAIN = 1;
const MENTOR_TOLERANCE = 1;
/** Active days this far apart or closer belong to one streak, so one missed day is forgiven. */
const STREAK_MAX_GAP_DAYS = 2;
const LEDGER_LIMIT = 200;
const MAX_TZ_OFFSET_MINUTES = 840;

const BADGE_TARGET = {
  firstPractice: 1,
  scopeDetective: 3,
  deEscalator: 1,
  ownershipBuilder: 3,
  scenarioExplorer: 4,
  consistencyStreak: 3,
} as const;

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const REWARDS_NOTE =
  'Rewards are private to this browser profile. They are encouragement for practising, not an assessment, and they are never compared with anyone else.';

// ---- The rules, as shown to the learner --------------------------------------------------------

export const REWARD_RULES: readonly RewardRuleDTO[] = [
  {
    id: 'complete-scenario',
    title: 'Complete a full scenario',
    points: POINTS.fullCall,
    detail: 'You take a call all the way to a close, with enough said for real coaching.',
    safeguard: `The first two completions of a scenario earn ${POINTS.fullCall}; repeats earn ${POINTS.repeatCall}. A call that ends early earns nothing.`,
  },
  {
    id: 'hidden-fact',
    title: 'Uncover a hidden fact',
    points: POINTS.hiddenFact,
    detail: 'A question of yours brought out something the customer had not volunteered.',
    safeguard:
      'Each fact pays once, ever, however many times you find it. A fact that was only partly uncovered earns nothing.',
  },
  {
    id: 'owner-and-update',
    title: 'Give a clear owner and update',
    points: POINTS.ownerAndUpdate,
    detail:
      'You named who owns the issue, what happens next and when the customer will hear back, and the report quotes you doing it.',
    safeguard:
      'Needs a score of 4 or more on Ownership & Next Steps, enough evidence and a quoted moment. Once per call.',
  },
  {
    id: 'skill-improvement',
    title: 'Lift a skill',
    points: POINTS.skillImprovement,
    detail:
      'One skill scored at least a point above your own recent average at the same difficulty.',
    safeguard:
      'Compared only with your own last three calls at that difficulty (you need two), never with other people. Once per call.',
  },
  {
    id: 'new-scenario-family',
    title: 'Try a new scenario family',
    points: POINTS.newFamily,
    detail: 'Your first full call in a kind of customer issue you have not practised before.',
    safeguard: 'Once per family, so trying something different earns more than doing more.',
  },
  {
    id: 'practice-day',
    title: 'Practise on a day',
    points: POINTS.practiceDay,
    detail: 'At least one full call on a calendar day, in your own time zone.',
    safeguard:
      'One award per day however many calls you make, and a missed day never costs you anything.',
  },
  {
    id: 'mentor-confirmed',
    title: 'A mentor confirms the result',
    points: POINTS.mentorConfirmed,
    detail:
      'A mentor reviewed the call and scored every skill within one point of the rubric result.',
    safeguard:
      'Needs a real mentor review, not a sample one. Once per call, and it is not taken back if another mentor sees the call differently.',
  },
];

export const REWARD_LEVELS: readonly RewardLevelDTO[] = [
  { id: 'foundation', index: 1, name: 'Foundation', minPoints: 0, minFamilies: 0 },
  { id: 'builder', index: 2, name: 'Builder', minPoints: 150, minFamilies: 2 },
  { id: 'practitioner', index: 3, name: 'Practitioner', minPoints: 400, minFamilies: 4 },
  { id: 'confident-handler', index: 4, name: 'Confident Handler', minPoints: 800, minFamilies: 6 },
];

export interface BadgeDefinition {
  id: BadgeId;
  title: string;
  /** What it takes, in plain words. Shown before and after it is earned. */
  criteria: string;
  target: number;
  unit: string;
}

export const BADGE_DEFINITIONS: readonly BadgeDefinition[] = [
  {
    id: 'first-practice',
    title: 'First Practice',
    criteria: 'Complete your first full scenario. A call that ends early does not count.',
    target: BADGE_TARGET.firstPractice,
    unit: 'scenarios',
  },
  {
    id: 'scope-detective',
    title: 'Scope Detective',
    criteria: 'Find every hidden fact in three different scenarios.',
    target: BADGE_TARGET.scopeDetective,
    unit: 'scenarios',
  },
  {
    id: 'de-escalator',
    title: 'De-escalator',
    criteria:
      'Bring a tense customer back down: they reached frustrated or worse and ended at least 20 points calmer, backed by a quoted turn.',
    target: BADGE_TARGET.deEscalator,
    unit: 'calls',
  },
  {
    id: 'ownership-builder',
    title: 'Ownership Builder',
    criteria:
      'Give a clear owner, action and next-update time in three calls, each backed by a quoted turn.',
    target: BADGE_TARGET.ownershipBuilder,
    unit: 'calls',
  },
  {
    id: 'scenario-explorer',
    title: 'Scenario Explorer',
    criteria: 'Complete full calls across four different families of customer issue.',
    target: BADGE_TARGET.scenarioExplorer,
    unit: 'families',
  },
  {
    id: 'consistency-streak',
    title: 'Consistency Streak',
    criteria:
      'Build a streak of three practice days. One missed day in between is forgiven, so Monday, Wednesday and Thursday count.',
    target: BADGE_TARGET.consistencyStreak,
    unit: 'days',
  },
];

// ---- Input -------------------------------------------------------------------------------------

export interface RewardMentorReview {
  /** Only a person's review counts. A bundled sample review never earns anything. */
  source: 'mentor' | 'sample';
  /** When the review was saved (ISO 8601). */
  at: string;
  scores: Partial<Record<DimensionId, number>>;
}

/** One saved call with a stored coaching report. Whether it earns anything is decided here. */
export interface RewardCall {
  sessionId: string;
  scenarioId: string;
  scenarioTitle: string;
  issueType: IssueType;
  /** The difficulty the call was actually played at. */
  difficulty: Difficulty;
  startedAt: string;
  endedAt: string | null;
  /** Sample calls are for demonstration and never earn anything. */
  isSample: boolean;
  report: CoachingReport;
  mentorReviews?: readonly RewardMentorReview[];
}

export interface RewardInput {
  calls: readonly RewardCall[];
}

export interface RewardOptions {
  /** Minutes, UTC minus local time: the sign `Date.getTimezoneOffset()` uses. */
  tzOffsetMinutes: number;
  /** Decides whether a streak is still alive. Nothing else depends on the clock. */
  now: Date | number;
  /** The scenarios on offer, used only to suggest what to practise next. */
  scenarios: readonly PublicScenarioDTO[];
}

// ---- Helpers -----------------------------------------------------------------------------------

interface Prepared {
  call: RewardCall;
  at: string;
  ms: number;
  /** The learner-local calendar day, as days since 1970-01-01. */
  day: number;
  scores: Partial<Record<DimensionId, number>>;
}

interface Entry {
  dto: LedgerEntryDTO;
  ms: number;
  seq: number;
  dimension: DimensionId | null;
}

const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const round = (value: number, places: number) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};
const mean = (values: readonly number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;
const nth = (items: Iterable<Prepared>, position: number): Prepared | null =>
  [...items][position - 1] ?? null;

const dayNumber = (ms: number, tzOffsetMinutes: number) =>
  Math.floor((ms - tzOffsetMinutes * MINUTE_MS) / DAY_MS);
const dayKey = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);
const dayLabel = (day: number) => {
  const date = new Date(day * DAY_MS);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
};

/** An eligible call is a finished practice call, taken to a close, with enough evidence to score. */
function prepare(calls: readonly RewardCall[], tzOffsetMinutes: number): Prepared[] {
  const eligible: Prepared[] = [];
  for (const call of calls) {
    const { completion } = call.report;
    if (call.isSample) continue;
    if (completion.status !== 'completed' || completion.evidence === 'insufficient') continue;
    const at = call.endedAt ?? call.startedAt;
    const ms = Date.parse(at);
    if (!Number.isFinite(ms)) continue;
    const scores: Partial<Record<DimensionId, number>> = {};
    for (const result of call.report.dimensions) scores[result.id] = result.score;
    eligible.push({ call, at, ms, day: dayNumber(ms, tzOffsetMinutes), scores });
  }
  eligible.sort((a, b) => a.ms - b.ms || compareText(a.call.sessionId, b.call.sessionId));
  // A call can only ever pay once, even if the same one were passed in twice.
  const seen = new Set<string>();
  return eligible.filter((p) => {
    if (seen.has(p.call.sessionId)) return false;
    seen.add(p.call.sessionId);
    return true;
  });
}

function ownerAndUpdate(
  report: CoachingReport,
): { score: number; turnIndex: number; quote: string } | null {
  const result = report.dimensions.find((d) => d.id === 'ownership-next-steps');
  if (!result || result.score < OWNERSHIP_MIN_SCORE || result.sufficiency !== 'sufficient') {
    return null;
  }
  const quoted = result.evidence.find((e) => e.quote.trim() !== '');
  return quoted ? { score: result.score, turnIndex: quoted.turnIndex, quote: quoted.quote } : null;
}

interface SkillGain {
  dimension: DimensionId;
  score: number;
  baseline: number;
  gain: number;
}

/** The skill that rose furthest above the mean of the previous calls at the same difficulty. */
function skillGain(current: Prepared, earlier: readonly Prepared[]): SkillGain | null {
  const window = earlier.slice(-SKILL_WINDOW);
  if (window.length < SKILL_MIN_HISTORY) return null;
  let best: SkillGain | null = null;
  for (const dimension of DIMENSION_IDS) {
    const score = current.scores[dimension];
    if (score === undefined || score < SKILL_MIN_SCORE) continue;
    const before = window.flatMap((p) => p.scores[dimension] ?? []);
    if (before.length < SKILL_MIN_HISTORY) continue;
    const baseline = mean(before);
    // Rounded so that two gains that are equal on paper are never split by floating point noise.
    const gain = round(score - baseline, 6);
    if (gain >= SKILL_MIN_GAIN && (best === null || gain > best.gain)) {
      best = { dimension, score, baseline, gain };
    }
  }
  return best;
}

const timeOf = (iso: string) => {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
};

/** The earliest human review whose six scores all sit within a point of the rubric result. */
function confirmingReview(p: Prepared): RewardMentorReview | null {
  const human = (p.call.mentorReviews ?? []).filter((review) => review.source === 'mentor');
  const earliestFirst = [...human].sort((a, b) => {
    const left = timeOf(a.at);
    const right = timeOf(b.at);
    return left < right ? -1 : left > right ? 1 : 0;
  });
  return (
    earliestFirst.find((review) =>
      DIMENSION_IDS.every((id) => {
        const mentor = review.scores[id];
        const evaluator = p.scores[id];
        return (
          typeof mentor === 'number' &&
          typeof evaluator === 'number' &&
          Math.abs(mentor - evaluator) <= MENTOR_TOLERANCE
        );
      }),
    ) ?? null
  );
}

function fullCallReason(completion: number, title: string): string {
  if (completion === 1) return `Finished a full call in "${title}".`;
  if (completion <= FULL_VALUE_COMPLETIONS) return `Finished another full call in "${title}".`;
  return `Finished another full call in "${title}"; repeats earn ${POINTS.repeatCall} points.`;
}

function levelFor(points: number, families: number): RewardLevelDTO {
  let level = REWARD_LEVELS[0] as RewardLevelDTO;
  for (const candidate of REWARD_LEVELS) {
    if (points >= candidate.minPoints && families >= candidate.minFamilies) level = candidate;
  }
  return level;
}

/** Gentlest first: the easiest difficulty, then the shortest call, then a stable tie-break. */
function gentlest(scenarios: readonly PublicScenarioDTO[]): PublicScenarioDTO | null {
  const sorted = [...scenarios].sort(
    (a, b) =>
      DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty] ||
      a.estimatedMinutes - b.estimatedMinutes ||
      compareText(a.id, b.id),
  );
  return sorted[0] ?? null;
}

type PracticeHistory = Parameters<typeof scenarioForSkill>[1];

/**
 * Lift a skill by a point. It targets the skill with the lowest recent average at the difficulty
 * the learner has practised most recently (with at least two calls), because that average is exactly
 * what the next call at that difficulty is compared with.
 */
function liftSkillChallenge(
  calls: readonly Prepared[],
  latestEntries: readonly Entry[],
  scenarios: readonly PublicScenarioDTO[],
): ChallengeDTO | null {
  const byDifficulty = new Map<Difficulty, Prepared[]>();
  for (const p of calls) {
    const group = byDifficulty.get(p.call.difficulty) ?? [];
    group.push(p);
    byDifficulty.set(p.call.difficulty, group);
  }
  const difficulty = [...calls]
    .reverse()
    .map((p) => p.call.difficulty)
    .find((d) => (byDifficulty.get(d)?.length ?? 0) >= SKILL_MIN_HISTORY);
  if (!difficulty) return null;
  const recent = (byDifficulty.get(difficulty) ?? []).slice(-SKILL_WINDOW);

  let target: { dimension: DimensionId; average: number } | null = null;
  for (const dimension of DIMENSION_IDS) {
    const values = recent.flatMap((p) => p.scores[dimension] ?? []);
    if (values.length === 0) continue;
    const average = round(mean(values), 6);
    if (target === null || average < target.average) target = { dimension, average };
  }
  // A skill already averaging above 4 cannot rise by a whole point, so there is nothing to ask for.
  if (target === null || 5 - target.average < SKILL_MIN_GAIN) return null;

  const { dimension, average } = target;
  const skill = DIMENSIONS[dimension].label;
  const level = DIFFICULTY_PROFILES[difficulty].label;
  const lifted = latestEntries.some(
    (e) => e.dto.ruleId === 'skill-improvement' && e.dimension === dimension,
  );
  const aim = Math.max(SKILL_MIN_SCORE, Math.ceil(round(average + SKILL_MIN_GAIN, 6)));
  const history: PracticeHistory = calls.map((p) => ({
    scenarioId: p.call.scenarioId,
    status: 'completed',
    completion: 'completed',
    isSample: false,
    overallScore: p.call.report.summary.overallScore,
    difficulty: p.call.difficulty,
    startedAt: p.call.startedAt,
    endedAt: p.call.endedAt,
  }));
  return {
    id: 'lift-a-skill',
    title: 'Lift a skill by a point',
    detail: lifted
      ? `In your latest call, ${skill} rose a point above your recent ${level} average. Well done.`
      : `Your recent ${level} average for ${skill} is ${average.toFixed(1)} of 5. Score ${aim} or more on it in your next ${level} call to earn ${POINTS.skillImprovement} points.`,
    reward: `${POINTS.skillImprovement} points`,
    progress: { current: lifted ? 1 : 0, target: 1 },
    status: lifted ? 'completed' : 'active',
    scenarioId: scenarioForSkill(scenarios, history, dimension)?.id ?? null,
    difficulty,
  };
}

// ---- The rewards -------------------------------------------------------------------------------

/**
 * Everything a learner has earned, worked out from their saved calls. Calls are taken in the order
 * they ended, so each decision (a repeat, a fact already found, a baseline) only looks backwards and
 * a later call can never change what an earlier one earned.
 */
export function computeRewards(input: RewardInput, options: RewardOptions): RewardsDTO {
  const tz =
    Number.isInteger(options.tzOffsetMinutes) &&
    Math.abs(options.tzOffsetMinutes) <= MAX_TZ_OFFSET_MINUTES
      ? options.tzOffsetMinutes
      : 0;
  const nowMs = typeof options.now === 'number' ? options.now : options.now.getTime();
  const today = dayNumber(nowMs, tz);
  const calls = prepare(input.calls, tz);

  const entries: Entry[] = [];
  const entryIds = new Set<string>();
  const add = (dto: LedgerEntryDTO, ms: number, dimension: DimensionId | null = null) => {
    if (entryIds.has(dto.id)) return;
    entryIds.add(dto.id);
    entries.push({ dto, ms, seq: entries.length, dimension });
  };

  const completions = new Map<string, number>();
  const seenFacts = new Set<string>();
  const byDifficulty = new Map<Difficulty, Prepared[]>();
  const firstInFamily = new Map<IssueType, Prepared>();
  const firstOnDay = new Map<number, Prepared>();
  const fullyDiscovered = new Map<string, Prepared>();
  const ownership: Prepared[] = [];
  const steadied: Prepared[] = [];
  let chain = 0;
  let best = 0;
  let lastDay: number | null = null;
  let streakCall: Prepared | null = null;

  for (const p of calls) {
    const { call } = p;
    const { sessionId, scenarioId, scenarioTitle } = call;
    const where = { sessionId, scenarioTitle, at: p.at };

    const completion = (completions.get(scenarioId) ?? 0) + 1;
    completions.set(scenarioId, completion);
    const fullValue = completion <= FULL_VALUE_COMPLETIONS;
    add(
      {
        id: `complete-scenario:${sessionId}`,
        ruleId: 'complete-scenario',
        points: fullValue ? POINTS.fullCall : POINTS.repeatCall,
        ...where,
        title: fullValue ? 'Completed a full scenario' : 'Practised a scenario again',
        reason: fullCallReason(completion, scenarioTitle),
        evidence: null,
      },
      p.ms,
    );

    if (!firstInFamily.has(call.issueType)) {
      firstInFamily.set(call.issueType, p);
      add(
        {
          id: `new-scenario-family:${call.issueType}`,
          ruleId: 'new-scenario-family',
          points: POINTS.newFamily,
          ...where,
          title: `First call in a new family: ${ISSUE_TYPE_LABELS[call.issueType]}`,
          reason: `Your first full call in this family was "${scenarioTitle}".`,
          evidence: null,
        },
        p.ms,
      );
    }

    for (const fact of call.report.discovery.results) {
      const key = `${scenarioId}:${fact.factId}`;
      if (fact.status !== 'discovered' || seenFacts.has(key)) continue;
      seenFacts.add(key);
      add(
        {
          id: `hidden-fact:${key}`,
          ruleId: 'hidden-fact',
          points: POINTS.hiddenFact,
          ...where,
          title: `Found: ${fact.label}`,
          reason: `Your question uncovered this in "${scenarioTitle}".`,
          evidence:
            fact.revealedAtTurn === null && fact.revealingQuestion === null
              ? null
              : { turnIndex: fact.revealedAtTurn, quote: fact.revealingQuestion },
        },
        p.ms,
      );
    }
    const { found, total } = call.report.discovery;
    if (total > 0 && found === total && !fullyDiscovered.has(scenarioId)) {
      fullyDiscovered.set(scenarioId, p);
    }

    const owner = ownerAndUpdate(call.report);
    if (owner) {
      ownership.push(p);
      add(
        {
          id: `owner-and-update:${sessionId}`,
          ruleId: 'owner-and-update',
          points: POINTS.ownerAndUpdate,
          ...where,
          title: 'Clear owner and next update',
          reason: `You gave the customer an owner, a next step and a time for the next update in "${scenarioTitle}".`,
          evidence: { turnIndex: owner.turnIndex, quote: owner.quote },
        },
        p.ms,
      );
    }

    const sameDifficulty = byDifficulty.get(call.difficulty) ?? [];
    const lift = skillGain(p, sameDifficulty);
    if (lift) {
      const skill = DIMENSIONS[lift.dimension].label;
      const quoted = call.report.dimensions
        .find((d) => d.id === lift.dimension)
        ?.evidence.find((e) => e.quote.trim() !== '');
      add(
        {
          id: `skill-improvement:${sessionId}`,
          ruleId: 'skill-improvement',
          points: POINTS.skillImprovement,
          ...where,
          title: `Lifted a skill: ${skill}`,
          reason: `${skill} ${lift.score} vs your recent ${DIFFICULTY_PROFILES[call.difficulty].label} average ${lift.baseline.toFixed(1)}.`,
          evidence: quoted ? { turnIndex: quoted.turnIndex, quote: quoted.quote } : null,
        },
        p.ms,
        lift.dimension,
      );
    }
    sameDifficulty.push(p);
    byDifficulty.set(call.difficulty, sameDifficulty);

    // Only the Plain Language achievement reads the customer's proficiency, so any value will do.
    if (
      deriveAchievements(call.report, { proficiency: 'intermediate' }).some(
        (a) => a.id === 'steady-the-call',
      )
    ) {
      steadied.push(p);
    }

    const review = confirmingReview(p);
    if (review) {
      const reviewedMs = Date.parse(review.at);
      const afterCall = Number.isFinite(reviewedMs) && reviewedMs > p.ms;
      add(
        {
          id: `mentor-confirmed:${sessionId}`,
          ruleId: 'mentor-confirmed',
          points: POINTS.mentorConfirmed,
          ...where,
          at: afterCall ? review.at : p.at,
          title: 'A mentor confirmed the result',
          reason: `A mentor's review of "${scenarioTitle}" agreed with the rubric result on every skill, within one point.`,
          evidence: null,
        },
        afterCall ? reviewedMs : p.ms,
      );
    }

    if (!firstOnDay.has(p.day)) {
      firstOnDay.set(p.day, p);
      chain = lastDay !== null && p.day - lastDay <= STREAK_MAX_GAP_DAYS ? chain + 1 : 1;
      lastDay = p.day;
      best = Math.max(best, chain);
      if (chain >= BADGE_TARGET.consistencyStreak && streakCall === null) streakCall = p;
      const label = dayLabel(p.day);
      add(
        {
          id: `practice-day:${dayKey(p.day)}`,
          ruleId: 'practice-day',
          points: POINTS.practiceDay,
          at: p.at,
          sessionId: null,
          scenarioTitle: null,
          title: `Practised on ${label}`,
          reason: `You completed a full call on ${label} ${dayKey(p.day).slice(0, 4)}.`,
          evidence: null,
        },
        p.ms,
      );
    }
  }

  const points = entries.reduce((sum, e) => sum + e.dto.points, 0);
  const practised = ISSUE_TYPES.filter((type) => firstInFamily.has(type));
  const level = levelFor(points, practised.length);
  const upcoming = REWARD_LEVELS[level.index];
  const streak = {
    current: lastDay !== null && today - lastDay <= STREAK_MAX_GAP_DAYS ? chain : 0,
    best,
    activeDays: firstOnDay.size,
    practisedToday: firstOnDay.has(today),
  };

  const standing: Record<BadgeId, { count: number; completedBy: Prepared | null }> = {
    'first-practice': {
      count: calls.length,
      completedBy: nth(calls, BADGE_TARGET.firstPractice),
    },
    'scope-detective': {
      count: fullyDiscovered.size,
      completedBy: nth(fullyDiscovered.values(), BADGE_TARGET.scopeDetective),
    },
    'de-escalator': {
      count: steadied.length,
      completedBy: nth(steadied, BADGE_TARGET.deEscalator),
    },
    'ownership-builder': {
      count: ownership.length,
      completedBy: nth(ownership, BADGE_TARGET.ownershipBuilder),
    },
    'scenario-explorer': {
      count: firstInFamily.size,
      completedBy: nth(firstInFamily.values(), BADGE_TARGET.scenarioExplorer),
    },
    'consistency-streak': { count: best, completedBy: streakCall },
  };
  const badges: BadgeDTO[] = BADGE_DEFINITIONS.map((definition) => {
    const { count, completedBy } = standing[definition.id];
    const earned = count >= definition.target && completedBy !== null;
    return {
      id: definition.id,
      title: definition.title,
      criteria: definition.criteria,
      earned,
      earnedAt: earned ? completedBy.at : null,
      earnedInSessionId: earned ? completedBy.call.sessionId : null,
      progress: {
        current: Math.min(count, definition.target),
        target: definition.target,
        unit: definition.unit,
      },
    };
  });

  const challenges = buildChallenges({
    calls,
    entries,
    scenarios: options.scenarios,
    practisedFamilies: firstInFamily,
    fullyDiscovered,
    bestStreak: best,
    streakBadgeEarned: badges.some((b) => b.id === 'consistency-streak' && b.earned),
  });

  const newestFirst = [...entries].sort((a, b) => b.ms - a.ms || a.seq - b.seq);
  return {
    points,
    level: { ...level },
    nextLevel: upcoming
      ? {
          ...upcoming,
          pointsToGo: Math.max(0, upcoming.minPoints - points),
          familiesToGo: Math.max(0, upcoming.minFamilies - practised.length),
        }
      : null,
    levels: REWARD_LEVELS.map((l) => ({ ...l })),
    families: { practised, total: ISSUE_TYPES.length },
    streak,
    badges,
    challenges,
    ledger: newestFirst.slice(0, LEDGER_LIMIT).map((e) => e.dto),
    rules: REWARD_RULES.map((rule) => ({ ...rule })),
    note: REWARDS_NOTE,
  };
}

function buildChallenges(context: {
  calls: readonly Prepared[];
  entries: readonly Entry[];
  scenarios: readonly PublicScenarioDTO[];
  practisedFamilies: ReadonlyMap<IssueType, Prepared>;
  fullyDiscovered: ReadonlyMap<string, Prepared>;
  bestStreak: number;
  streakBadgeEarned: boolean;
}): ChallengeDTO[] {
  const {
    calls,
    entries,
    scenarios,
    practisedFamilies,
    fullyDiscovered,
    bestStreak,
    streakBadgeEarned,
  } = context;
  const challenges: ChallengeDTO[] = [];

  const familiesDone = practisedFamilies.size >= ISSUE_TYPES.length;
  const newFamily = gentlest(scenarios.filter((s) => !practisedFamilies.has(s.issueType)));
  challenges.push({
    id: 'try-new-family',
    title: 'Try a new scenario family',
    detail: familiesDone
      ? 'You have practised every scenario family.'
      : `You have practised ${practisedFamilies.size} of ${ISSUE_TYPES.length} scenario families. A first full call in a new one earns ${POINTS.newFamily} points.${newFamily ? ` The gentlest way in is "${newFamily.title}".` : ''}`,
    reward: `${POINTS.newFamily} points`,
    progress: { current: practisedFamilies.size, target: ISSUE_TYPES.length },
    status: familiesDone ? 'completed' : 'active',
    scenarioId: familiesDone ? null : (newFamily?.id ?? null),
    difficulty: null,
  });

  const factsTarget = BADGE_TARGET.scopeDetective;
  const factsDone = fullyDiscovered.size >= factsTarget;
  const unfinished = gentlest(scenarios.filter((s) => !fullyDiscovered.has(s.id)));
  challenges.push({
    id: 'find-every-fact',
    title: 'Find every hidden fact in one call',
    detail: factsDone
      ? `You have found every hidden fact in ${factsTarget} different scenarios.`
      : `Uncover every hidden fact in a single call. You have done it in ${fullyDiscovered.size} of ${factsTarget} scenarios so far.${unfinished ? ` Try "${unfinished.title}".` : ''}`,
    reward: 'Toward Scope Detective',
    progress: { current: Math.min(fullyDiscovered.size, factsTarget), target: factsTarget },
    status: factsDone ? 'completed' : 'active',
    scenarioId: factsDone ? null : (unfinished?.id ?? null),
    difficulty: null,
  });

  const latest = calls[calls.length - 1];
  const latestEntries = latest
    ? entries.filter((e) => e.dto.sessionId === latest.call.sessionId)
    : [];
  const lift = liftSkillChallenge(calls, latestEntries, scenarios);
  if (lift) challenges.push(lift);

  const streakTarget = BADGE_TARGET.consistencyStreak;
  challenges.push({
    id: 'practise-again',
    title: 'Practise on another day',
    detail: streakBadgeEarned
      ? `You have built a streak of ${streakTarget} practice days. A missed day never counts against you, so come back whenever it suits you.`
      : `Practise on another day to build a streak: ${Math.min(bestStreak, streakTarget)} of ${streakTarget} days so far. One missed day is forgiven, and a missed day never counts against you.`,
    reward: 'Toward Consistency Streak',
    progress: { current: Math.min(bestStreak, streakTarget), target: streakTarget },
    status: streakBadgeEarned ? 'completed' : 'active',
    scenarioId: null,
    difficulty: null,
  });

  return challenges;
}
