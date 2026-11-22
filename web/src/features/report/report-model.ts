import type {
  CarePrincipleResult,
  CoachingReport,
  DimensionResult,
  DiscoveryResult,
  Evidence,
  ImprovementItem,
} from '#shared/domain/report.ts';
import { DIMENSION_IDS, FACT_WEIGHT } from '#shared/domain/vocab.ts';
import { clampWords, plainUnexpectedTurn } from './copy.ts';
import {
  customerReplyTo,
  isVerifiedQuote,
  verifiedEvidence,
  type EvidenceTurn,
  type TurnLookup,
} from './evidence-model.ts';

// Small decisions about the report's data, kept out of the components so they can be tested.

/** The six skills in the order the rubric lists them, whatever order the evaluator sent them in. */
export function orderedDimensions(report: CoachingReport): DimensionResult[] {
  return DIMENSION_IDS.map((id) => report.dimensions.find((d) => d.id === id)).filter(
    (d): d is DimensionResult => d !== undefined,
  );
}

/** How many words of the reason for a score show on the row; the whole reason is in its details. */
export const ROW_REASON_WORDS = 20;

export interface SkillRow {
  dimension: DimensionResult;
  /** The quotes the transcript confirms, in the order the report gave them. */
  quotes: Evidence[];
  /** The reason in a line: its first words, ending where a sentence ends when one is near. */
  preview: string;
}

/**
 * The six skills as the rows of the score matrix. A quote the transcript does not confirm is not
 * evidence, so it is neither counted nor shown: with none left the row says "Insufficient evidence".
 */
export function skillRows(report: CoachingReport, turns: TurnLookup): SkillRow[] {
  return orderedDimensions(report).map((dimension) => ({
    dimension,
    quotes: verifiedEvidence(turns, dimension.evidence),
    preview: clampWords(plainUnexpectedTurn(dimension.rationale), ROW_REASON_WORDS).shown,
  }));
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

export type OriginalState = 'said' | 'omitted' | 'unverified';

export interface Wording {
  /** What was said, when the transcript confirms it. */
  original: string | null;
  /**
   * `said`: the original is a quote the transcript backs. `omitted`: nothing was said (the gap is
   * something that never happened). `unverified`: the report quotes words that the turn does not say,
   * so they are not shown.
   */
  state: OriginalState;
  improved: string;
}

/** The better wording for an improvement, or null when the evaluator offered none. */
export function wordingFor(item: ImprovementItem, turns: TurnLookup): Wording | null {
  const improved = item.betterPhrasing.trim();
  if (improved === '') return null;
  if (item.turnIndex === null) return { original: null, state: 'omitted', improved };
  const quote = item.quote?.trim() ?? '';
  return quote !== '' && isVerifiedQuote(turns, item.turnIndex, quote)
    ? { original: quote, state: 'said', improved }
    : { original: null, state: 'unverified', improved };
}

export interface FactView {
  result: DiscoveryResult;
  /** The trainee's question that found the fact, when the transcript confirms it. */
  question: string | null;
  /** The customer's reply to that question, exactly as it was said. */
  answer: EvidenceTurn | null;
}

/** A fact with the question that found it and the customer's answer, both from the transcript. */
export function factView(result: DiscoveryResult, turns: TurnLookup): FactView {
  if (result.status === 'missed' || result.revealedAtTurn === null) {
    return { result, question: null, answer: null };
  }
  return {
    result,
    question: isVerifiedQuote(turns, result.revealedAtTurn, result.revealingQuestion)
      ? result.revealingQuestion
      : null,
    answer: customerReplyTo(turns, result.revealedAtTurn),
  };
}

export interface SectionItem {
  id: string;
  label: string;
}

/**
 * The parts of the report, in page order. A part with nothing behind it is not listed: CARE for a
 * report saved before it was read from the call, and the call journey when no moment can be shown.
 */
export function reportSections(
  report: CoachingReport,
  options: { timeline?: boolean } = {},
): SectionItem[] {
  const { timeline = true } = options;
  return [
    { id: 'summary', label: 'Summary' },
    ...(timeline ? [{ id: 'journey', label: 'Call journey' }] : []),
    { id: 'scores', label: 'Scores' },
    ...(report.care ? [{ id: 'care', label: 'CARE review' }] : []),
    { id: 'experience', label: 'Customer experience' },
    { id: 'discovery', label: 'Discovery review' },
    { id: 'strengths', label: 'Strengths' },
    { id: 'improvements', label: 'Improvement opportunities' },
    { id: 'next-practice', label: 'Next practice' },
    { id: 'actions', label: 'Actions' },
    { id: 'transcript', label: 'Transcript' },
    { id: 'about', label: 'About this report' },
  ];
}
