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
  /** The reason in a line: whole sentences that fit, and always the first, never cut in the middle. */
  preview: string;
  /** What is left of the reason, for the details; an empty string when the line says all of it. */
  rest: string;
  /** No quote backs the score, so it is a first look and is shown as one. */
  firstLook: boolean;
}

/**
 * The six skills as the rows of the score matrix. A quote the transcript does not confirm is not
 * evidence, so it is neither counted nor shown: with none left the row is a first look.
 */
export function skillRows(report: CoachingReport, turns: TurnLookup): SkillRow[] {
  return orderedDimensions(report).map((dimension) => {
    const quotes = verifiedEvidence(turns, dimension.evidence);
    const { shown, full } = clampWords(plainUnexpectedTurn(dimension.rationale), ROW_REASON_WORDS, {
      whole: true,
    });
    return {
      dimension,
      quotes,
      preview: shown,
      rest: full.slice(shown.length).trim(),
      firstLook: quotes.length === 0,
    };
  });
}

/** True when the report should say it rests on limited evidence. */
export function restsOnLimitedEvidence(report: CoachingReport): boolean {
  return report.completion.evidence !== 'sufficient' || report.completion.status === 'ended-early';
}

/**
 * What a summary already says about how much of the call it rests on. The page does not say the
 * same news again beside it: a summary that says the call was too short, or that it rests on limited
 * evidence, is the one place it is said, and one that says there is no overall score needs no line
 * for the missing signal.
 */
export function summarySays(text: string): { short: boolean; noScore: boolean } {
  return {
    short: /\blimited evidence\b|\btoo few\b|\bto score with confidence\b/i.test(text),
    noScore: /\bno overall (?:score|practice signal)\b/i.test(text),
  };
}

/**
 * The evaluator ends some strengths and risks with a sentence about how the customer's hidden mood
 * moved ("After this, Marcus's temperature eased a little and trust rose a little."). The chart shows
 * bands, not those small movements, and trust is not drawn at all, so a reader cannot see it. The
 * page leaves that sentence out and quotes what the customer said next instead.
 */
export function withoutTrend(text: string): string {
  const kept = text.replace(/\s*After this, [^.]*\.\s*$/i, '').trim();
  return kept === '' ? text : kept;
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

/**
 * Found, partly found and missed, each with its facts in order of how much they mattered (critical
 * before important before helpful; the report's own order among equals). Empty groups are left out.
 */
export function discoveryGroups(discovery: CoachingReport['discovery']): DiscoveryGroup[] {
  return (['discovered', 'partial', 'missed'] as const)
    .map((status) => ({
      status,
      title: GROUP_TITLES[status],
      results: discovery.results
        .map((result, order) => ({ result, order }))
        .filter(({ result }) => result.status === status)
        .sort(
          (a, b) =>
            FACT_WEIGHT[b.result.importance] - FACT_WEIGHT[a.result.importance] ||
            a.order - b.order,
        )
        .map(({ result }) => result),
    }))
    .filter((group) => group.results.length > 0);
}

/**
 * Why a fact that was found mattered. The report starts that sentence with where it was found
 * ("Found at turn 4."); the row already says the turn, so only the reason is kept.
 */
export function whyFound(result: DiscoveryResult): string {
  const reason = result.consequence.replace(/^Found at turn (?:\d+|\?)\.\s*/i, '').trim();
  return reason === '' ? result.consequence : reason;
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
