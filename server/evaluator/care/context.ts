import type { EvidenceBehaviour } from '#shared/domain/classification.ts';
import type { Evidence } from '#shared/domain/report.ts';
import type { CustomerState } from '#shared/domain/state.ts';
import type { CallStage, Proficiency } from '#shared/domain/vocab.ts';
import {
  curveballState,
  evidenceLevel,
  quoteFor,
  temperatureSeries,
  verifiedQuote,
  type CallView,
  type Sufficiency,
  type TempRow,
  type TraineeTurn,
} from '../parts.ts';
import { contentWords, isQuestionSentence, norm, splitSentences, STAKES_WORDS } from './lexicon.ts';

// What the CARE detectors read: the call, turn by turn and sentence by sentence, with the words the
// customer used so that "reflecting what the customer said" can be checked against what they said.

export interface SentenceView {
  text: string; // verbatim, so it can be quoted
  lower: string;
  question: boolean;
}

export interface TurnView {
  turn: TraineeTurn;
  sentences: SentenceView[];
  /** The distinctive words of the customer's reply just before this turn. */
  previousCustomer: Set<string>;
  /** The distinctive words of everything the customer said before this turn. */
  customerSoFar: Set<string>;
}

export interface CareContext {
  call: CallView;
  stage: CallStage;
  proficiency: Proficiency;
  turns: TurnView[];
  /** What the customer said, in call order, with each turn's index. */
  customer: { index: number; text: string; words: Set<string> }[];
  evidence: Sufficiency;
  curveball: CustomerState['curveball'];
  rows: TempRow[];
  /** Words that name what is at stake in this scenario (its impact, deadline and objective). */
  situation: Set<string>;
  endedEarly: boolean;
}

/** One sentence of one trainee turn. */
export interface Hit {
  view: TurnView;
  sentence: SentenceView;
}

export function buildCareContext(call: CallView): CareContext {
  const { scenario } = call;
  const customer = call.input.turns
    .filter((t) => t.role === 'customer')
    .sort((a, b) => a.index - b.index)
    .map((t) => ({ index: t.index, text: t.text, words: contentWords(t.text) }));

  const turns = call.turns.map((turn): TurnView => {
    const before = customer.filter((c) => c.index < turn.index);
    const last = before[before.length - 1];
    const soFar = new Set<string>();
    for (const c of before) for (const w of c.words) soFar.add(w);
    return {
      turn,
      sentences: splitSentences(turn.text).map((text) => ({
        text,
        lower: norm(text),
        question: isQuestionSentence(text),
      })),
      previousCustomer: last?.words ?? new Set<string>(),
      customerSoFar: soFar,
    };
  });

  const situation = contentWords(
    [
      scenario.impactVariant.summary,
      scenario.impactVariant.detail,
      scenario.impactVariant.deadline ?? '',
      scenario.customerObjective,
    ].join(' '),
  );
  for (const w of STAKES_WORDS) situation.add(w);

  return {
    call,
    stage: scenario.config.callStage,
    proficiency: scenario.config.proficiency,
    turns,
    customer,
    evidence: evidenceLevel(call.turns.length),
    curveball: curveballState(call),
    rows: temperatureSeries(call),
    situation,
    endedEarly: call.input.endedEarly,
  };
}

// ---------------------------------------------------------------------------------------
// Finding moments in the call

/** Every sentence (in call order) that passes `test`, optionally within some turns only. */
export function hits(
  ctx: CareContext,
  test: (sentence: SentenceView, view: TurnView) => boolean,
  within: TurnView[] = ctx.turns,
): Hit[] {
  const out: Hit[] = [];
  for (const view of within) {
    for (const sentence of view.sentences) if (test(sentence, view)) out.push({ view, sentence });
  }
  return out;
}

export const firstTurns = (ctx: CareContext, n: number): TurnView[] => ctx.turns.slice(0, n);
export const lastTurns = (ctx: CareContext, n: number): TurnView[] =>
  ctx.turns.slice(Math.max(0, ctx.turns.length - n));

/** A short, verbatim quote of a sentence of the turn, or null when it cannot be verified. */
export function evidenceOf(hit: Hit): Evidence | null {
  const quote = verifiedQuote(hit.view.turn.text, hit.sentence.text);
  return quote ? { turnIndex: hit.view.turn.index, quote } : null;
}

/** Up to `max` pieces of evidence from these hits, no quote twice, in call order. */
export function evidenceFrom(found: Hit[], max = 2): Evidence[] {
  const out: Evidence[] = [];
  for (const hit of found) {
    const item = evidenceOf(hit);
    if (!item) continue;
    if (out.some((e) => e.turnIndex === item.turnIndex && e.quote === item.quote)) continue;
    out.push(item);
    if (out.length >= max) break;
  }
  return out.sort((a, b) => a.turnIndex - b.turnIndex);
}

/** The quote the classifier recorded for the turn (or the best matching sentence), as evidence. */
export function recordedEvidence(
  view: TurnView,
  ...behaviours: EvidenceBehaviour[]
): Evidence | null {
  const quote = quoteFor(view.turn, ...behaviours);
  return quote ? { turnIndex: view.turn.index, quote } : null;
}

/** Adds evidence unless the same quote at the same turn is there already, up to `max` items. */
export function pushEvidence(list: Evidence[], item: Evidence | null, max = 2): void {
  if (!item || list.length >= max) return;
  if (list.some((e) => e.turnIndex === item.turnIndex && e.quote === item.quote)) return;
  list.push(item);
}
