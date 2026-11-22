import type {
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
import { plainUnexpectedTurn } from './copy.ts';
import { isVerifiedQuote, type TurnLookup } from './evidence-model.ts';

// What the CARE review shows for each principle besides its sentence: one quote that holds up and
// one next action. The report carries neither a "strongest quote" nor a next action, so both are
// worked out here from what it does carry, with the rule written down.

export interface NextAction {
  /** The skill whose guidance this is: the weakest of the skills that feed the principle. */
  dimension: DimensionId;
  text: string;
}

/** The skills that feed a CARE principle, in rubric order (`DIMENSIONS[id].care` says which). */
export function skillsFor(principle: CareBehaviour): DimensionId[] {
  return DIMENSION_IDS.filter((id) => DIMENSIONS[id].care.includes(principle));
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
  return { dimension: weakest.id, text: plainUnexpectedTurn(weakest.guidance.trim()) };
}

export interface CareQuote {
  turnIndex: number;
  quote: string;
  /** The behaviour it shows, for example "Introduced themselves". */
  behaviour: string;
}

const STATUS_RANK = { shown: 2, partly: 1, 'not-shown': 0 } as const;

/**
 * The strongest quote for a principle that the transcript confirms: from a behaviour that was shown
 * before one that was partly shown, then the fuller quote (more words, up to thirty), then the
 * earlier turn. Null when no behaviour has a quote the transcript backs.
 */
export function careQuote(principle: CarePrincipleResult, turns: TurnLookup): CareQuote | null {
  let best: { rank: number; words: number; item: CareQuote } | null = null;
  for (const behaviour of principle.behaviours) {
    const rank = STATUS_RANK[behaviour.status];
    if (rank === 0) continue;
    for (const evidence of behaviour.evidence) {
      if (!isVerifiedQuote(turns, evidence.turnIndex, evidence.quote)) continue;
      const words = Math.min(30, evidence.quote.trim().split(/\s+/).length);
      const better =
        best === null ||
        rank > best.rank ||
        (rank === best.rank &&
          (words > best.words ||
            (words === best.words && evidence.turnIndex < best.item.turnIndex)));
      if (better) {
        best = {
          rank,
          words,
          item: {
            turnIndex: evidence.turnIndex,
            quote: evidence.quote,
            behaviour: behaviour.label,
          },
        };
      }
    }
  }
  return best?.item ?? null;
}
