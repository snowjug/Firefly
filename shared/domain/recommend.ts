import type { ProgressDTO, PublicScenarioDTO, SessionSummaryDTO } from './api.ts';
import { DIFFICULTY_PROFILES } from './state.ts';
import {
  DIFFICULTIES,
  DIFFICULTY_RANK,
  DIMENSIONS,
  type Difficulty,
  type DimensionId,
} from './vocab.ts';

// Which scenarios have been practised, and which one to suggest next. Everything here is derived
// from the saved practice history, and every suggestion carries the evidence behind it.

type PracticeSession = Pick<
  SessionSummaryDTO,
  | 'scenarioId'
  | 'status'
  | 'completion'
  | 'isSample'
  | 'overallScore'
  | 'difficulty'
  | 'startedAt'
  | 'endedAt'
>;

export type ScenarioPracticeState = 'new' | 'in-progress' | 'practised';

export interface ScenarioPractice {
  scenarioId: string;
  state: ScenarioPracticeState;
  /** Completed practice calls for this scenario. */
  completed: number;
  best: number | null;
  latest: number | null;
  lastAt: string | null;
}

/** Practice state for every scenario that has any history. Sample calls never count. */
export function summariseScenarioPractice(
  sessions: readonly PracticeSession[],
): Map<string, ScenarioPractice> {
  const result = new Map<string, ScenarioPractice>();
  const ordered = [...sessions]
    .filter((s) => !s.isSample)
    .sort((a, b) => ((a.endedAt ?? a.startedAt) < (b.endedAt ?? b.startedAt) ? -1 : 1));
  for (const session of ordered) {
    const current = result.get(session.scenarioId) ?? {
      scenarioId: session.scenarioId,
      state: 'new' as ScenarioPracticeState,
      completed: 0,
      best: null,
      latest: null,
      lastAt: null,
    };
    if (session.status === 'active' || session.status === 'completing') {
      if (current.state === 'new') current.state = 'in-progress';
    } else if (session.status === 'completed' && session.completion === 'completed') {
      current.completed += 1;
      current.state = 'practised';
      current.latest = session.overallScore;
      current.lastAt = session.endedAt ?? session.startedAt;
      if (session.overallScore !== null) {
        current.best =
          current.best === null
            ? session.overallScore
            : Math.max(current.best, session.overallScore);
      }
    }
    result.set(session.scenarioId, current);
  }
  return result;
}

/**
 * A scenario built to practise one skill: ones not tried yet come first, then the one you scored
 * lowest on, with the gentlest difficulty breaking ties. A call already in progress is never offered.
 */
export function scenarioForSkill(
  scenarios: readonly PublicScenarioDTO[],
  sessions: readonly PracticeSession[],
  dimension: DimensionId,
): PublicScenarioDTO | null {
  const practice = summariseScenarioPractice(sessions);
  const candidates = scenarios.filter(
    (s) => s.coachingFocus.includes(dimension) && practice.get(s.id)?.state !== 'in-progress',
  );
  const rank = (s: PublicScenarioDTO) => {
    const seen = practice.get(s.id);
    const tried = seen !== undefined && seen.completed > 0;
    return [tried ? 1 : 0, tried ? (seen?.best ?? 6) : 0, DIFFICULTY_RANK[s.difficulty]] as const;
  };
  const sorted = [...candidates].sort((a, b) => {
    const left = rank(a);
    const right = rank(b);
    return (
      left[0] - right[0] ||
      left[1] - right[1] ||
      left[2] - right[2] ||
      a.estimatedMinutes - b.estimatedMinutes ||
      a.title.localeCompare(b.title)
    );
  });
  return sorted[0] ?? null;
}

export type RecommendationKind =
  'first-call' | 'build-skill' | 'step-up' | 'ease-back' | 'new-ground' | 'revisit';

export interface MissionRecommendation {
  scenario: PublicScenarioDTO;
  kind: RecommendationKind;
  dimension: DimensionId | null;
  difficulty: Difficulty;
  /** One sentence naming the evidence that led to this suggestion. */
  reason: string;
}

export interface RecommendInput {
  scenarios: readonly PublicScenarioDTO[];
  sessions: readonly PracticeSession[];
  progress: Pick<ProgressDTO, 'focus' | 'dimensionTrends'> | null;
}

const STEP_UP_AT = 4;
const EASE_BACK_AT = 2.5;
const RECENT_CALLS = 3;

function stepped(difficulty: Difficulty, by: number): Difficulty {
  const rank = Math.min(DIFFICULTIES.length - 1, Math.max(0, DIFFICULTY_RANK[difficulty] + by));
  return DIFFICULTIES[rank] ?? difficulty;
}

/** The next scenario to practise, or null when there are no scenarios at all. */
export function recommendMission(input: RecommendInput): MissionRecommendation | null {
  const { scenarios, sessions, progress } = input;
  if (scenarios.length === 0) return null;

  const practice = summariseScenarioPractice(sessions);
  const completed = sessions
    .filter((s) => !s.isSample && s.status === 'completed' && s.completion === 'completed')
    .sort((a, b) => ((a.endedAt ?? a.startedAt) < (b.endedAt ?? b.startedAt) ? 1 : -1));

  const byEase = (a: PublicScenarioDTO, b: PublicScenarioDTO) =>
    a.estimatedMinutes - b.estimatedMinutes || a.title.localeCompare(b.title);

  if (completed.length === 0) {
    const open = scenarios.filter((s) => practice.get(s.id)?.state !== 'in-progress');
    const pool = open.length > 0 ? open : [...scenarios];
    const starters = pool.filter((s) => s.difficulty === 'starter').sort(byEase);
    const pick = starters[0] ?? [...pool].sort(byEase)[0];
    if (!pick) return null;
    return {
      scenario: pick,
      kind: 'first-call',
      dimension: null,
      difficulty: pick.difficulty,
      reason: `A gentle place to start: a ${DIFFICULTY_PROFILES[pick.difficulty].label} call of about ${pick.estimatedMinutes} minutes.`,
    };
  }

  const recent = completed.slice(0, RECENT_CALLS);
  const scored = recent.flatMap((s) => (s.overallScore === null ? [] : [s.overallScore]));
  const average = scored.length > 0 ? scored.reduce((a, b) => a + b, 0) / scored.length : null;
  const lastDifficulty = completed[0]?.difficulty ?? 'starter';
  let target: Difficulty = lastDifficulty;
  let shift: 'up' | 'down' | null = null;
  if (average !== null && average >= STEP_UP_AT && lastDifficulty !== 'challenge') {
    target = stepped(lastDifficulty, 1);
    shift = 'up';
  } else if (average !== null && average <= EASE_BACK_AT && lastDifficulty !== 'starter') {
    target = stepped(lastDifficulty, -1);
    shift = 'down';
  }

  const focus = progress?.focus ?? null;
  const focusAverage = focus
    ? (progress?.dimensionTrends.find((t) => t.dimension === focus)?.average ?? null)
    : null;

  const ranked = scenarios
    .filter((s) => practice.get(s.id)?.state !== 'in-progress')
    .map((scenario) => {
      const seen = practice.get(scenario.id);
      const unseen = !seen || seen.completed === 0;
      const aimsAtFocus = focus !== null && scenario.coachingFocus.includes(focus);
      const gap = Math.abs(DIFFICULTY_RANK[scenario.difficulty] - DIFFICULTY_RANK[target]);
      const score =
        (unseen ? 3 : 0) + (aimsAtFocus ? 2.5 : 0) + (gap === 0 ? 2 : gap === 1 ? 0.5 : 0);
      return { scenario, unseen, aimsAtFocus, score };
    })
    .sort((a, b) => b.score - a.score || byEase(a.scenario, b.scenario));

  const top = ranked[0];
  if (!top) return null;
  const { scenario } = top;
  const label = DIFFICULTY_PROFILES[scenario.difficulty].label;
  const averageText = average === null ? null : average.toFixed(1);

  if (shift === 'up' && scenario.difficulty === target && averageText) {
    return {
      scenario,
      kind: 'step-up',
      dimension: top.aimsAtFocus ? focus : null,
      difficulty: scenario.difficulty,
      reason: `Your last ${recent.length === 1 ? 'call' : `${recent.length} calls`} averaged ${averageText} of 5. A ${label} call is the next step.`,
    };
  }
  if (shift === 'down' && scenario.difficulty === target && averageText) {
    return {
      scenario,
      kind: 'ease-back',
      dimension: top.aimsAtFocus ? focus : null,
      difficulty: scenario.difficulty,
      reason: `Your last ${recent.length === 1 ? 'call' : `${recent.length} calls`} averaged ${averageText} of 5. A ${label} call lets you build on those skills with a little less pressure.`,
    };
  }
  if (top.aimsAtFocus && focus) {
    const tail = focusAverage === null ? '' : ` (average ${focusAverage.toFixed(1)} of 5)`;
    return {
      scenario,
      kind: 'build-skill',
      dimension: focus,
      difficulty: scenario.difficulty,
      reason: `${DIMENSIONS[focus].label} is your lowest skill so far${tail}. This ${label} call is built to practise it.`,
    };
  }
  if (top.unseen) {
    return {
      scenario,
      kind: 'new-ground',
      dimension: null,
      difficulty: scenario.difficulty,
      reason: 'You have not tried this scenario yet, and it adds variety to your practice.',
    };
  }
  const before = practice.get(scenario.id)?.latest;
  return {
    scenario,
    kind: 'revisit',
    dimension: null,
    difficulty: scenario.difficulty,
    reason:
      before === null || before === undefined
        ? 'You have practised this one before. A second attempt shows what has changed.'
        : `You scored ${before} of 5 here before. A second attempt shows what has changed.`,
  };
}
