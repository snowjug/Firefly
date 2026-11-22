import type {
  CareBehaviourResult,
  CarePrincipleResult,
  CoachingReport,
  DimensionResult,
} from '#shared/domain/report.ts';
import {
  DIMENSIONS,
  DIMENSION_IDS,
  type CareBehaviour,
  type DimensionId,
} from '#shared/domain/vocab.ts';
import { plainUnexpectedTurn, splitSentences } from './copy.ts';
import { isVerifiedQuote, type TurnLookup } from './evidence-model.ts';

// What the CARE review shows for each principle besides its sentence: one quote that holds up and
// one next action. The report carries neither a "strongest quote" nor a next action, so both are
// worked out here from what it does carry, with the rule written down.

export interface NextAction {
  /** The skill whose guidance this is: the weakest of the skills that feed the principle. */
  dimension: DimensionId;
  /** All of the guidance. */
  text: string;
  /** The sentence to do next, the one the page sets apart. */
  action: string;
  /** The rest of the guidance (an example, what to keep), or an empty string. */
  more: string;
}

/** The skills that feed a CARE principle, in rubric order (`DIMENSIONS[id].care` says which). */
export function skillsFor(principle: CareBehaviour): DimensionId[] {
  return DIMENSION_IDS.filter((id) => DIMENSIONS[id].care.includes(principle));
}

/**
 * The sentence of some guidance that says what to do next. Guidance for a skill that went well
 * starts by saying so ("Keep this opening. To stretch it, tie ..."), and the next action is the
 * stretch; any other guidance starts with the action. What is left over comes back as `more`.
 */
export function splitNextAction(text: string): { action: string; more: string } {
  const sentences = splitSentences(text);
  const at = sentences.findIndex((s) => /^to (?:stretch|go further|build on)\b/i.test(s));
  const chosen = at >= 0 ? at : 0;
  return {
    action: sentences[chosen] ?? text.trim(),
    more: sentences.filter((_, i) => i !== chosen).join(' '),
  };
}

/**
 * The one thing to do next for a principle: the guidance of the weakest skill that feeds it (the
 * lowest score; the first in rubric order when scores are equal). Null when the report holds no
 * score for any of its skills.
 */
export function careNextAction(
  report: CoachingReport,
  principle: CareBehaviour,
): NextAction | null {
  const scored = skillsFor(principle)
    .map((id) => report.dimensions.find((d) => d.id === id))
    .filter((d): d is DimensionResult => d !== undefined);
  let weakest: DimensionResult | undefined;
  for (const candidate of scored) {
    if (!weakest || candidate.score < weakest.score) weakest = candidate;
  }
  if (!weakest || weakest.guidance.trim() === '') return null;
  const text = plainUnexpectedTurn(weakest.guidance.trim());
  return { dimension: weakest.id, text, ...splitNextAction(text) };
}

type Status = CareBehaviourResult['status'];

/** The ending the rules evaluator gives a principle's sentence when the case named things it needed. */
const CASE_CLAUSE =
  /;\s+it (met what this case needed|did not yet meet what this case needed|met \d+ of \d+ things this case needed)\.?\s*$/;

/**
 * A principle's sentence with the case clause taken off its end ("; it met 1 of 2 things this case
 * needed") and the clause itself, so the page can set it beside the level as one of the things the
 * level rests on instead of leaving it inside the praise. A sentence without the clause comes back
 * as it was, with no clause.
 */
export function splitCaseClause(summary: string): { text: string; fit: string | null } {
  const text = summary.trim();
  const match = CASE_CLAUSE.exec(text);
  const clause = match?.[1];
  if (!match || !clause) return { text, fit: null };
  return {
    text: `${text.slice(0, match.index)}.`,
    fit: `${clause.charAt(0).toUpperCase()}${clause.slice(1)}`,
  };
}

export interface CareQuote {
  turnIndex: number;
  quote: string;
  /** The behaviour the quote is about, for example "Introduced themselves". */
  behaviour: string;
  /** What the report found about that behaviour: the quote is where it was shown, or where it was not. */
  status: Status;
}

/**
 * A behaviour of the kind "avoided ...": it is judged by what was left out of the call, so when it
 * was shown there is nothing to quote, and any moment the report lists for it is borrowed.
 */
const isAbsence = (behaviour: CareBehaviourResult): boolean =>
  /\.no-/.test(behaviour.id) && behaviour.status === 'shown';

const quoteKey = (turnIndex: number, quote: string): string => `${turnIndex}\u0000${quote}`;

const ORDER: readonly Status[] = ['shown', 'partly', 'not-shown'];

/**
 * The quote that stands for a principle: from the first behaviour, in the order the report lists
 * them, that was shown and has a quote the transcript backs, then the first partly shown one, then
 * (when nothing was shown) the moment a behaviour went wrong. A behaviour judged by what was left
 * out has no quote of its own, and a moment already used for another principle (`taken`) is not used
 * again: with nothing left, the answer is null, and the page says "Insufficient evidence".
 */
export function careQuote(
  principle: CarePrincipleResult,
  turns: TurnLookup,
  taken: ReadonlySet<string> = new Set(),
): CareQuote | null {
  for (const status of ORDER) {
    for (const behaviour of principle.behaviours) {
      if (behaviour.status !== status || isAbsence(behaviour)) continue;
      const evidence = behaviour.evidence.find(
        (e) =>
          isVerifiedQuote(turns, e.turnIndex, e.quote) &&
          !taken.has(quoteKey(e.turnIndex, e.quote)),
      );
      if (evidence) {
        return {
          turnIndex: evidence.turnIndex,
          quote: evidence.quote,
          behaviour: behaviour.label,
          status,
        };
      }
    }
  }
  return null;
}

/** The quote for each principle, never the same words under two of them. */
export function careQuotes(
  care: readonly CarePrincipleResult[],
  turns: TurnLookup,
): ReadonlyMap<CareBehaviour, CareQuote | null> {
  const taken = new Set<string>();
  const quotes = new Map<CareBehaviour, CareQuote | null>();
  for (const principle of care) {
    const quote = careQuote(principle, turns, taken);
    if (quote) taken.add(quoteKey(quote.turnIndex, quote.quote));
    quotes.set(principle.id, quote);
  }
  return quotes;
}

/**
 * What stands under one behaviour of the list. A quote, at most one, that the transcript backs; a
 * note that the same words were shown for an earlier behaviour of the principle (they are not
 * repeated); nothing at all for a behaviour judged by what was left out; and "none" when the report
 * found the behaviour but no moment of it holds up.
 */
export type BehaviourEvidence =
  | { kind: 'quote'; turnIndex: number; quote: string }
  | { kind: 'repeat'; turnIndex: number }
  | { kind: 'absence' }
  | { kind: 'none' };

/** The evidence line of each behaviour of a principle, in the order they are listed. */
export function behaviourEvidence(
  principle: CarePrincipleResult,
  turns: TurnLookup,
): BehaviourEvidence[] {
  const shown = new Set<string>();
  return principle.behaviours.map((behaviour): BehaviourEvidence => {
    if (isAbsence(behaviour)) return { kind: 'absence' };
    const evidence = behaviour.evidence.find((e) => isVerifiedQuote(turns, e.turnIndex, e.quote));
    if (!evidence) return { kind: 'none' };
    const key = quoteKey(evidence.turnIndex, evidence.quote);
    if (shown.has(key)) return { kind: 'repeat', turnIndex: evidence.turnIndex };
    shown.add(key);
    return { kind: 'quote', turnIndex: evidence.turnIndex, quote: evidence.quote };
  });
}
