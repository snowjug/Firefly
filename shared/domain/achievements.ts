import type { CoachingReport } from './report.ts';
import {
  CURVEBALL_LABELS,
  DIMENSIONS,
  temperatureBand,
  type DimensionId,
  type Proficiency,
} from './vocab.ts';

// Achievements are awarded from the stored coaching report and nothing else. Each one needs real
// evidence from the conversation (a quoted turn), so a call that does not show the behaviour earns
// nothing. A call that ended early, or whose evidence was too thin to score, earns nothing either.

export const ACHIEVEMENT_IDS = [
  'found-the-signal',
  'steady-the-call',
  'clear-ownership',
  'plain-language',
  'complete-the-loop',
  'handled-the-turn',
] as const;
export type AchievementId = (typeof ACHIEVEMENT_IDS)[number];

export interface AchievementDefinition {
  id: AchievementId;
  title: string;
  /** What it takes, in plain words. Shown before and after it is earned. */
  criteria: string;
  dimension: DimensionId | null;
}

export const ACHIEVEMENTS: Record<AchievementId, AchievementDefinition> = {
  'found-the-signal': {
    id: 'found-the-signal',
    title: 'Found the Signal',
    criteria: 'Uncovered a critical hidden fact because you asked a question that led to it.',
    dimension: 'scoping-discovery',
  },
  'steady-the-call': {
    id: 'steady-the-call',
    title: 'Steady the Call',
    criteria:
      'The customer reached frustrated or worse, and by the end they were at least 20 points calmer.',
    dimension: 'empathy-deescalation',
  },
  'clear-ownership': {
    id: 'clear-ownership',
    title: 'Clear Ownership',
    criteria:
      'Scored 5 on Ownership & Next Steps: a plan, an owner and a time for the next contact.',
    dimension: 'ownership-next-steps',
  },
  'plain-language': {
    id: 'plain-language',
    title: 'Plain Language',
    criteria: 'Scored 4 or more on Clarity with a customer who is new to the technology.',
    dimension: 'clarity',
  },
  'complete-the-loop': {
    id: 'complete-the-loop',
    title: 'Complete the Loop',
    criteria: 'Scored 4 or more on Closing: agreement confirmed and the call closed properly.',
    dimension: 'closing',
  },
  'handled-the-turn': {
    id: 'handled-the-turn',
    title: 'Handled the Turn',
    criteria: 'A curveball changed the conversation and you resolved it.',
    dimension: null,
  },
};

export interface AchievementProof {
  /** The turn that shows it, when one exists. */
  turnIndex: number | null;
  /** The words from the call that support it. */
  quote: string | null;
  /** One short sentence on why this counts. */
  detail: string;
}

export interface EarnedAchievement extends AchievementDefinition {
  proof: AchievementProof;
}

export interface AchievementContext {
  /** How technical the customer was in this call. */
  proficiency: Proficiency;
}

const MIN_RECOVERY = 20;
const ESCALATION_FLOOR = 41; // the lower edge of the "frustrated" band

function dimension(report: CoachingReport, id: DimensionId) {
  return report.dimensions.find((d) => d.id === id);
}

function steadied(report: CoachingReport): AchievementProof | null {
  const points = report.journey.points;
  if (points.length < 2) return null;
  let peakIndex = 0;
  for (let i = 1; i < points.length; i += 1) {
    if ((points[i]?.temperature ?? 0) > (points[peakIndex]?.temperature ?? 0)) peakIndex = i;
  }
  const peak = points[peakIndex];
  const end = points[points.length - 1];
  if (!peak || !end || peakIndex >= points.length - 1) return null;
  if (peak.temperature < ESCALATION_FLOOR) return null;
  if (peak.temperature - end.temperature < MIN_RECOVERY) return null;

  // Point to the moment after the peak where the customer cooled the most.
  let best: (typeof points)[number] | null = null;
  for (const point of points.slice(peakIndex + 1)) {
    if (point.delta < 0 && point.quote && (best === null || point.delta < best.delta)) best = point;
  }
  if (!best) return null;
  return {
    turnIndex: best.turnIndex,
    quote: best.quote,
    detail: `The customer went from ${temperatureBand(peak.temperature).label.toLowerCase()} to ${temperatureBand(end.temperature).label.toLowerCase()}.`,
  };
}

function fromDimension(
  report: CoachingReport,
  id: DimensionId,
  minScore: number,
  detail: string,
): AchievementProof | null {
  const result = dimension(report, id);
  if (!result || result.score < minScore || result.sufficiency !== 'sufficient') return null;
  const evidence = result.evidence[0];
  if (!evidence) return null;
  return { turnIndex: evidence.turnIndex, quote: evidence.quote, detail };
}

/** The achievements this call earned, each with the evidence that supports it. */
export function deriveAchievements(
  report: CoachingReport,
  context: AchievementContext,
): EarnedAchievement[] {
  if (report.completion.status !== 'completed' || report.completion.evidence === 'insufficient') {
    return [];
  }
  const earned: EarnedAchievement[] = [];
  const add = (id: AchievementId, proof: AchievementProof | null) => {
    if (proof) earned.push({ ...ACHIEVEMENTS[id], proof });
  };

  const signal = report.discovery.results.find(
    (fact) =>
      fact.importance === 'critical' &&
      fact.status === 'discovered' &&
      fact.revealedAtTurn !== null &&
      fact.revealingQuestion,
  );
  add(
    'found-the-signal',
    signal
      ? {
          turnIndex: signal.revealedAtTurn,
          quote: signal.revealingQuestion,
          detail: `This question uncovered: ${signal.label}.`,
        }
      : null,
  );

  add('steady-the-call', steadied(report));

  add(
    'clear-ownership',
    fromDimension(
      report,
      'ownership-next-steps',
      5,
      `${DIMENSIONS['ownership-next-steps'].label} scored 5 of 5.`,
    ),
  );

  add(
    'plain-language',
    context.proficiency === 'novice'
      ? fromDimension(report, 'clarity', 4, 'The customer was new to the technology.')
      : null,
  );

  add(
    'complete-the-loop',
    fromDimension(report, 'closing', 4, `${DIMENSIONS.closing.label} scored 4 or more.`),
  );

  const curveball = report.curveball;
  add(
    'handled-the-turn',
    curveball && curveball.status === 'resolved'
      ? {
          turnIndex: curveball.firedAtTurn,
          quote: null,
          detail: `The curveball "${CURVEBALL_LABELS[curveball.type].label}" arrived at turn ${curveball.firedAtTurn} and was resolved.`,
        }
      : null,
  );

  return earned;
}
