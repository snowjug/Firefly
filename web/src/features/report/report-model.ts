import type {
  CarePrincipleResult,
  CoachingReport,
  DimensionResult,
  DiscoveryResult,
  ImprovementItem,
} from '#shared/domain/report.ts';
import { DIMENSION_IDS, FACT_WEIGHT } from '#shared/domain/vocab.ts';

// Small decisions about the report's data, kept out of the components so they can be tested.

/** The six skills in the order the rubric lists them, whatever order the evaluator sent them in. */
export function orderedDimensions(report: CoachingReport): DimensionResult[] {
  return DIMENSION_IDS.map((id) => report.dimensions.find((d) => d.id === id)).filter(
    (d): d is DimensionResult => d !== undefined,
  );
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

/**
 * The one question to take into the next call: from the fact that mattered most and was not found
 * in full. A missed fact comes before a partly found one of the same importance; ties keep the
 * report's order.
 */
export function suggestedQuestion(discovery: CoachingReport['discovery']): DiscoveryResult | null {
  const open = discovery.results
    .map((result, order) => ({ result, order }))
    .filter(({ result }) => result.status !== 'discovered' && result.betterQuestion.trim() !== '');
  open.sort(
    (a, b) =>
      FACT_WEIGHT[b.result.importance] - FACT_WEIGHT[a.result.importance] ||
      Number(b.result.status === 'missed') - Number(a.result.status === 'missed') ||
      a.order - b.order,
  );
  return open[0]?.result ?? null;
}

export interface BehaviourCounts {
  shown: number;
  partly: number;
  notShown: number;
}

/** How many of a principle's behaviours were shown, partly shown and not shown. */
export function careCounts(principle: CarePrincipleResult): BehaviourCounts {
  const counts: BehaviourCounts = { shown: 0, partly: 0, notShown: 0 };
  for (const behaviour of principle.behaviours) {
    if (behaviour.status === 'shown') counts.shown += 1;
    else if (behaviour.status === 'partly') counts.partly += 1;
    else counts.notShown += 1;
  }
  return counts;
}

export interface WordingPair {
  improvement: ImprovementItem;
  /** What was said, or null for a gap that never happened. */
  original: string | null;
  improved: string;
}

/** One "Original, Improved" pair for each improvement that offers better wording. */
export function wordingPairs(report: CoachingReport): WordingPair[] {
  return report.improvements
    .filter((item) => item.betterPhrasing.trim() !== '')
    .map((item) => ({
      improvement: item,
      original: item.quote && item.quote.trim() !== '' ? item.quote : null,
      improved: item.betterPhrasing,
    }));
}

export interface SectionItem {
  id: string;
  label: string;
}

/** The parts of the report, in page order. A part with nothing behind it is not listed. */
export function reportSections(report: CoachingReport): SectionItem[] {
  return [
    { id: 'summary', label: 'Summary' },
    { id: 'scores', label: 'Scores' },
    ...(report.care ? [{ id: 'care', label: 'CARE summary' }] : []),
    { id: 'journey', label: 'Customer journey' },
    { id: 'strengths', label: 'Strengths' },
    { id: 'improvements', label: 'Improvements' },
    ...(wordingPairs(report).length > 0 ? [{ id: 'wording', label: 'Better wording' }] : []),
    { id: 'discovery', label: 'Discovery' },
    { id: 'next-practice', label: 'Next practice' },
    { id: 'actions', label: 'Actions' },
    { id: 'transcript', label: 'Transcript' },
    { id: 'about', label: 'About this report' },
  ];
}
