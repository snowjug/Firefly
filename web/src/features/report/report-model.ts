import type { CoachingReport, DimensionResult, DiscoveryResult } from '#shared/domain/report.ts';
import { DIMENSION_IDS, type DimensionId } from '#shared/domain/vocab.ts';

// Small decisions about the report's data, kept out of the components so they can be tested.

/** The six skills in the order the rubric lists them, whatever order the evaluator sent them in. */
export function orderedDimensions(report: CoachingReport): DimensionResult[] {
  return DIMENSION_IDS.map((id) => report.dimensions.find((d) => d.id === id)).filter(
    (d): d is DimensionResult => d !== undefined,
  );
}

/**
 * The skill to open first: the lowest-scored. Where several share the lowest score, the one the
 * report recommends practising next, else the first in rubric order.
 */
export function lowestSkill(report: CoachingReport): DimensionId | null {
  const dimensions = orderedDimensions(report);
  const lowest = Math.min(...dimensions.map((d) => d.score));
  const tied = dimensions.filter((d) => d.score === lowest);
  return (tied.find((d) => d.id === report.nextPractice.dimension) ?? tied[0])?.id ?? null;
}

/** True when the report should say it rests on limited evidence. */
export function restsOnLimitedEvidence(report: CoachingReport): boolean {
  return report.completion.evidence !== 'sufficient' || report.completion.status === 'ended-early';
}

export interface DiscoveryGroup {
  status: DiscoveryResult['status'];
  title: string;
  results: DiscoveryResult[];
}

const GROUP_TITLES: Record<DiscoveryResult['status'], string> = {
  discovered: 'Found',
  partial: 'Partly found',
  missed: 'Missed',
};

/** Found, partly found and missed, each in the order the report lists its facts. Empty groups are left out. */
export function discoveryGroups(discovery: CoachingReport['discovery']): DiscoveryGroup[] {
  return (['discovered', 'partial', 'missed'] as const)
    .map((status) => ({
      status,
      title: GROUP_TITLES[status],
      results: discovery.results.filter((r) => r.status === status),
    }))
    .filter((group) => group.results.length > 0);
}
