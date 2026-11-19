import type { SessionSummaryDTO } from './api.ts';
import { DIFFICULTY_RANK, DIMENSION_IDS, type Difficulty, type DimensionId } from './vocab.ts';

// Mastery is how the practice history shows up as light. It is computed from completed practice
// calls only, never from time spent or the number of messages, and every tier says exactly what is
// still needed for the next one. There are no points, streaks or comparisons with other people.

export const MASTERY_TIERS = ['dormant', 'kindling', 'glowing', 'radiant', 'beacon'] as const;
export type MasteryTier = (typeof MASTERY_TIERS)[number];

export const MASTERY_TIER_LABELS: Record<MasteryTier, { label: string; meaning: string }> = {
  dormant: { label: 'Dormant', meaning: 'No completed practice for this skill yet.' },
  kindling: { label: 'Kindling', meaning: 'First evidence: you have practised this skill.' },
  glowing: { label: 'Glowing', meaning: 'Steady: a few calls with a solid average.' },
  radiant: {
    label: 'Radiant',
    meaning: 'Consistent across different scenarios, including a harder call.',
  },
  beacon: { label: 'Beacon', meaning: 'Consistently strong, including on a Challenge call.' },
};

/** One constellation per coaching dimension. The names are for orientation only. */
export const CONSTELLATIONS: Record<DimensionId, { name: string; blurb: string }> = {
  'opening-rapport': { name: 'Listener', blurb: 'Opening the call so the customer feels heard.' },
  'scoping-discovery': {
    name: 'Investigator',
    blurb: 'Finding out what is really going on, and what it affects.',
  },
  'empathy-deescalation': {
    name: 'Stabiliser',
    blurb: 'Acknowledging feelings and settling a tense call.',
  },
  clarity: { name: 'Guide', blurb: 'Explaining in words the customer can use.' },
  'ownership-next-steps': {
    name: 'Owner',
    blurb: 'Taking responsibility and agreeing what happens next.',
  },
  closing: { name: 'Finisher', blurb: 'Confirming the plan and closing the loop.' },
};

/** The calls that count: finished practice calls with a score for the skill, newest first. */
export type MasterySession = Pick<
  SessionSummaryDTO,
  | 'id'
  | 'scenarioId'
  | 'difficulty'
  | 'completion'
  | 'isSample'
  | 'startedAt'
  | 'endedAt'
  | 'dimensionScores'
>;

export interface DimensionMastery {
  dimension: DimensionId;
  tier: MasteryTier;
  tierIndex: number;
  /** Completed calls that scored this skill. */
  calls: number;
  /** Distinct scenarios among those calls. */
  scenarios: number;
  /** Average of the latest calls that count (up to five). */
  recentAverage: number | null;
  /** The highest score so far. */
  best: number | null;
  /** The score from the most recent call. */
  latest: number | null;
  next: { tier: MasteryTier; needs: string[] } | null;
}

export const RECENT_WINDOW = 5;

interface TierRule {
  tier: Exclude<MasteryTier, 'dormant'>;
  minCalls: number;
  minScenarios: number;
  minAverage: number;
  /** A call at this difficulty or harder, scoring at least this much, within the recent window. */
  harder: { rank: number; score: number; label: string } | null;
}

const RULES: readonly TierRule[] = [
  { tier: 'kindling', minCalls: 1, minScenarios: 1, minAverage: 0, harder: null },
  { tier: 'glowing', minCalls: 2, minScenarios: 1, minAverage: 3, harder: null },
  {
    tier: 'radiant',
    minCalls: 3,
    minScenarios: 2,
    minAverage: 3.8,
    harder: { rank: DIFFICULTY_RANK.standard, score: 4, label: 'a Standard or Challenge call' },
  },
  {
    tier: 'beacon',
    minCalls: 4,
    minScenarios: 3,
    minAverage: 4.4,
    harder: { rank: DIFFICULTY_RANK.challenge, score: 4, label: 'a Challenge call' },
  },
];

interface Scored {
  scenarioId: string;
  difficulty: Difficulty;
  score: number;
  at: string;
}

function scoredCalls(
  sessions: readonly MasterySession[],
  dimension: DimensionId,
  includeSamples: boolean,
): Scored[] {
  const scored: Scored[] = [];
  for (const session of sessions) {
    if ((session.isSample && !includeSamples) || session.completion !== 'completed') continue;
    const score = session.dimensionScores?.[dimension];
    if (typeof score !== 'number') continue;
    scored.push({
      scenarioId: session.scenarioId,
      difficulty: session.difficulty,
      score,
      at: session.endedAt ?? session.startedAt,
    });
  }
  return scored.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

function unmet(rule: TierRule, all: Scored[], recent: Scored[], average: number): string[] {
  const needs: string[] = [];
  const scenarios = new Set(all.map((call) => call.scenarioId)).size;
  const callsNeeded = Math.max(0, rule.minCalls - all.length);
  const scenariosNeeded = Math.max(0, rule.minScenarios - scenarios);
  if (all.length === 0) {
    needs.push('a completed call that scores this skill');
  } else if (callsNeeded > 0 && scenariosNeeded > 0) {
    const more = Math.max(callsNeeded, scenariosNeeded);
    const calls = `${more} more completed ${more === 1 ? 'call' : 'calls'}`;
    if (more === scenariosNeeded) {
      needs.push(`${calls} in ${more === 1 ? 'a different scenario' : 'different scenarios'}`);
    } else {
      needs.push(
        `${calls}, ${scenariosNeeded} of them in ${scenariosNeeded === 1 ? 'a different scenario' : 'different scenarios'}`,
      );
    }
  } else if (callsNeeded > 0) {
    needs.push(`${callsNeeded} more completed ${callsNeeded === 1 ? 'call' : 'calls'}`);
  } else if (scenariosNeeded > 0) {
    needs.push(
      scenariosNeeded === 1
        ? 'a call in a different scenario'
        : `calls in ${scenariosNeeded} more scenarios`,
    );
  }
  if (recent.length > 0 && average < rule.minAverage) {
    needs.push(
      `a recent average of ${rule.minAverage.toFixed(1)} or more (now ${average.toFixed(1)})`,
    );
  }
  if (
    rule.harder &&
    !recent.some(
      (call) =>
        DIFFICULTY_RANK[call.difficulty] >= (rule.harder?.rank ?? 0) &&
        call.score >= (rule.harder?.score ?? 0),
    )
  ) {
    needs.push(`${rule.harder.label} scoring ${rule.harder.score} or more`);
  }
  return needs;
}

function assessDimension(
  sessions: readonly MasterySession[],
  dimension: DimensionId,
  includeSamples: boolean,
): DimensionMastery {
  const all = scoredCalls(sessions, dimension, includeSamples);
  const recent = all.slice(0, RECENT_WINDOW);
  const average =
    recent.length > 0 ? recent.reduce((sum, call) => sum + call.score, 0) / recent.length : 0;
  const scenarios = new Set(all.map((call) => call.scenarioId)).size;

  let tierIndex = 0;
  for (const rule of RULES) {
    if (unmet(rule, all, recent, average).length === 0)
      tierIndex = MASTERY_TIERS.indexOf(rule.tier);
  }
  const tier = MASTERY_TIERS[tierIndex] ?? 'dormant';
  const nextRule = RULES.find((rule) => MASTERY_TIERS.indexOf(rule.tier) === tierIndex + 1);

  return {
    dimension,
    tier,
    tierIndex,
    calls: all.length,
    scenarios,
    recentAverage: recent.length > 0 ? average : null,
    best: all.length > 0 ? Math.max(...all.map((call) => call.score)) : null,
    latest: all[0]?.score ?? null,
    next: nextRule ? { tier: nextRule.tier, needs: unmet(nextRule, all, recent, average) } : null,
  };
}

export interface MasteryOptions {
  /**
   * Sample calls are built-in demo data, not the person's own practice, so they only count where
   * the person has asked to see them (the Progress page's "Include sample sessions" switch).
   */
  includeSamples?: boolean;
}

/** Mastery for all six coaching dimensions, in rubric order. */
export function assessMastery(
  sessions: readonly MasterySession[],
  options: MasteryOptions = {},
): DimensionMastery[] {
  const includeSamples = options.includeSamples === true;
  return DIMENSION_IDS.map((dimension) => assessDimension(sessions, dimension, includeSamples));
}

/** The constellation with the most light so far, ties broken by rubric order. */
export function brightest(mastery: readonly DimensionMastery[]): DimensionMastery | null {
  const lit = mastery.filter((m) => m.tierIndex > 0);
  if (lit.length === 0) return null;
  return lit.reduce((best, m) => (m.tierIndex > best.tierIndex ? m : best));
}

/**
 * The constellation to light next: the suggested focus while it can still brighten, otherwise the
 * dimmest one that can (ties broken by rubric order). Null once every skill is a Beacon.
 */
export function nextToLight(
  mastery: readonly DimensionMastery[],
  focus: DimensionId | null,
): DimensionMastery | null {
  const open = mastery.filter((m) => m.next !== null);
  if (open.length === 0) return null;
  const preferred = focus ? open.find((m) => m.dimension === focus) : undefined;
  if (preferred) return preferred;
  return open.reduce((dimmest, m) => (m.tierIndex < dimmest.tierIndex ? m : dimmest));
}
