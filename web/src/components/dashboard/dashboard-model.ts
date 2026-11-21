import type { PublicScenarioDTO, SessionSummaryDTO } from '#shared/domain/api.ts';
import {
  summariseScenarioPractice,
  type MissionRecommendation,
  type ScenarioPractice,
} from '#shared/domain/recommend.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import { IMPACT_LABELS, ISSUE_TYPE_LABELS, type IssueType } from '#shared/domain/vocab.ts';
import type { AtlasMission } from '../atlas/atlas-model.ts';
import { STAGE_WORDS } from '../signal/describe.ts';
import type { GlyphTraits } from '../signal/types.ts';

// What the home page shows, worked out from the saved practice calls. Sample calls are demonstration
// data, so none of these numbers ever count them.

/** What is shown instead of a number when there is nothing to average yet. */
export const NONE = '\u2014';

/** A call that ran through to a close. A call that ended early is practice, but not a completion. */
export function isFullCall(session: SessionSummaryDTO): boolean {
  return !session.isSample && session.status === 'completed' && session.completion === 'completed';
}

export interface PracticeStats {
  /** Full calls: finished, taken to a close, not samples. */
  completed: number;
  /** The mean overall score of those calls, or null when none has a score. */
  averageScore: number | null;
  /** Time spent on every finished practice call, including ones that ended early. */
  practiceSeconds: number;
}

export function practiceStats(sessions: readonly SessionSummaryDTO[]): PracticeStats {
  let completed = 0;
  let scored = 0;
  let scoreTotal = 0;
  let practiceSeconds = 0;
  for (const session of sessions) {
    if (session.isSample) continue;
    if (session.durationSeconds !== null) practiceSeconds += Math.max(0, session.durationSeconds);
    if (!isFullCall(session)) continue;
    completed += 1;
    if (session.overallScore !== null) {
      scored += 1;
      scoreTotal += session.overallScore;
    }
  }
  return {
    completed,
    averageScore: scored > 0 ? scoreTotal / scored : null,
    practiceSeconds,
  };
}

/** "45 min" below an hour, then hours with one decimal ("1.5 h"), and whole hours from ten up. */
export function formatPracticeTime(seconds: number): string {
  if (!(seconds > 0)) return '0 min';
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  const text = hours < 10 ? hours.toFixed(1).replace(/\.0$/, '') : String(Math.round(hours));
  return `${text} h`;
}

const finishedAt = (session: SessionSummaryDTO) => Date.parse(session.endedAt ?? session.startedAt);

/** The call that can be picked up again (newest first), if there is one. */
export function activeCall(sessions: readonly SessionSummaryDTO[]): SessionSummaryDTO | null {
  const open = sessions.filter((s) => !s.isSample && s.status === 'active');
  open.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  return open[0] ?? null;
}

/** The latest finished calls, newest first. */
export function recentCalls(
  sessions: readonly SessionSummaryDTO[],
  count = 3,
): SessionSummaryDTO[] {
  return sessions
    .filter((s) => !s.isSample && s.status === 'completed')
    .sort((a, b) => finishedAt(b) - finishedAt(a))
    .slice(0, count);
}

export interface ScenarioPick {
  scenario: PublicScenarioDTO;
  /** One plain sentence on why it is on the list. */
  reason: string;
  /** True for the engine's own recommendation, which is always the first card. */
  recommended: boolean;
}

function reasonFor(
  scenario: PublicScenarioDTO,
  practice: ScenarioPractice | undefined,
  practisedTypes: ReadonlySet<IssueType>,
): string {
  if (practice && practice.completed > 0) {
    return practice.latest === null
      ? 'You have practised this one before. A second try shows what has changed.'
      : `You scored ${practice.latest} of 5 here before. A second try shows what has changed.`;
  }
  if (!practisedTypes.has(scenario.issueType)) {
    return `A new kind of call for you: ${ISSUE_TYPE_LABELS[scenario.issueType].toLowerCase()}.`;
  }
  return 'You have not tried this scenario yet.';
}

const byEase = (a: PublicScenarioDTO, b: PublicScenarioDTO) =>
  a.estimatedMinutes - b.estimatedMinutes ||
  a.title.localeCompare(b.title) ||
  a.id.localeCompare(b.id);

/**
 * The scenarios to offer on the home page. The first is the recommendation with its own honest
 * reason. The rest add variety: scenarios not tried yet come first, then kinds of customer issue
 * and difficulties that are not already on the list. A call that is still open is never offered.
 */
export function pickScenarios(input: {
  scenarios: readonly PublicScenarioDTO[];
  sessions: readonly SessionSummaryDTO[];
  recommendation: MissionRecommendation | null;
  count?: number;
}): ScenarioPick[] {
  const { scenarios, sessions, recommendation, count = 4 } = input;
  const practice = summariseScenarioPractice(sessions);
  const practisedTypes = new Set<IssueType>(sessions.filter(isFullCall).map((s) => s.issueType));

  const picks: ScenarioPick[] = [];
  if (recommendation) {
    picks.push({
      scenario: recommendation.scenario,
      reason: recommendation.reason,
      recommended: true,
    });
  }

  const pool = scenarios.filter(
    (s) => s.id !== recommendation?.scenario.id && practice.get(s.id)?.state !== 'in-progress',
  );

  while (picks.length < count && pool.length > 0) {
    const issueTypes = new Set(picks.map((p) => p.scenario.issueType));
    const difficulties = new Set(picks.map((p) => p.scenario.difficulty));
    const scored = pool.map((scenario) => {
      const seen = practice.get(scenario.id);
      const unseen = !seen || seen.completed === 0;
      const score =
        (unseen ? 4 : 0) +
        (practisedTypes.has(scenario.issueType) ? 0 : 1.5) +
        (issueTypes.has(scenario.issueType) ? 0 : 2) +
        (difficulties.has(scenario.difficulty) ? 0 : 1);
      return { scenario, score };
    });
    scored.sort((a, b) => b.score - a.score || byEase(a.scenario, b.scenario));
    const best = scored[0];
    if (!best) break;
    pool.splice(pool.indexOf(best.scenario), 1);
    picks.push({
      scenario: best.scenario,
      reason: reasonFor(best.scenario, practice.get(best.scenario.id), practisedTypes),
      recommended: false,
    });
  }
  return picks;
}

/** "Medium impact · Standard", the two settings that say how demanding a call is. */
export function demandText(scenario: Pick<PublicScenarioDTO, 'impact' | 'difficulty'>): string {
  return `${IMPACT_LABELS[scenario.impact].label} impact \u00b7 ${DIFFICULTY_PROFILES[scenario.difficulty].label}`;
}

/**
 * The public settings of a mission as short facts for a telemetry line: how demanding it is, how
 * the customer starts, the stage of the call and its length. Never anything about how it is scored.
 */
export function missionFacts(
  mission: Pick<AtlasMission, 'impact' | 'difficulty' | 'start'> &
    Partial<Pick<AtlasMission, 'stage' | 'minutes'>>,
): string[] {
  const facts = [demandText(mission), `Starts ${mission.start}`];
  if (mission.stage) {
    const stage = STAGE_WORDS[mission.stage];
    facts.push(`${stage.charAt(0).toUpperCase()}${stage.slice(1)}`);
  }
  if (mission.minutes !== undefined) {
    facts.push(mission.minutes === 1 ? '1 min' : `${mission.minutes} min`);
  }
  return facts;
}

/** True once there is any finished practice to report on, so "none yet" is never dressed as data. */
export function hasPractised(stats: PracticeStats, recent: readonly SessionSummaryDTO[]): boolean {
  return stats.completed > 0 || stats.practiceSeconds > 0 || recent.length > 0;
}

/** What the hero and the "also suggested" line need of a mission: who, what and how it is drawn. */
export type HeroMission = Pick<AtlasMission, 'id' | 'title' | 'persona'> & GlyphTraits;

/**
 * A scenario as a mission that has not been tried, for when the map's own model leaves it out (it
 * skips an issue type it does not know) but the recommendation still names it.
 */
export function heroMissionOf(scenario: PublicScenarioDTO): HeroMission {
  return {
    id: scenario.id,
    title: scenario.title,
    persona: {
      name: scenario.persona.name,
      role: scenario.persona.role,
      organisation: scenario.persona.organisation,
    },
    difficulty: scenario.difficulty,
    impact: scenario.impact,
    start: scenario.startingTemperature,
    stage: scenario.callStage,
    minutes: scenario.estimatedMinutes,
    status: 'new',
    recommended: true,
  };
}
