import type { EvidenceBehaviour } from '#shared/domain/classification.ts';
import type { Evidence } from '#shared/domain/report.ts';
import type { StateCategory } from '#shared/domain/state.ts';
import { fold } from '#shared/domain/text.ts';
import { verifiedQuote } from '../parts.ts';
import {
  evidenceOf,
  hits,
  pushEvidence,
  recordedEvidence,
  type CareContext,
  type Hit,
  type TurnView,
} from './context.ts';
import {
  BLAME,
  DISMISSIVE,
  HEDGED,
  IMPATIENT,
  isUnsupportedPromise,
  promisesOnlyToCheck,
} from './lexicon.ts';
import { isHousekeeping } from './intents.ts';

// Where the trainee said something harmful: blame, dismissal, impatience, a promise nobody could
// back, a question asked twice. Each is found three ways, so a gap in one way of looking does not
// hide it: the words of the turn, what the classification recorded, and what the customer's state
// engine recorded in reaction. The evidence is always a verified quote of the turn.

function fromEvents(
  ctx: CareContext,
  categories: StateCategory[],
  behaviours: EvidenceBehaviour[],
  accept: (reason: string) => boolean = () => true,
): Evidence[] {
  const out: Evidence[] = [];
  for (const event of ctx.call.events) {
    if (!categories.includes(event.category) || !accept(event.reason)) continue;
    const view = ctx.turns.find((v) => v.turn.index === event.turnIndex);
    if (!view) continue;
    const quote = verifiedQuote(view.turn.text, event.evidenceQuote);
    pushEvidence(
      out,
      quote ? { turnIndex: view.turn.index, quote } : recordedEvidence(view, ...behaviours),
      4,
    );
  }
  return out;
}

function fromFlags(
  ctx: CareContext,
  flagged: (view: TurnView) => boolean,
  behaviour: EvidenceBehaviour,
): Evidence[] {
  const out: Evidence[] = [];
  for (const view of ctx.turns)
    if (flagged(view)) pushEvidence(out, recordedEvidence(view, behaviour), 4);
  return out;
}

function fromWords(
  ctx: CareContext,
  test: (lower: string, question: boolean) => boolean,
): Evidence[] {
  const out: Evidence[] = [];
  const found: Hit[] = hits(ctx, (s) => test(s.lower, s.question));
  for (const hit of found) pushEvidence(out, evidenceOf(hit), 4);
  return out;
}

/** Unique evidence (one quote per turn at most) in call order, at most two items. */
function merge(...lists: Evidence[][]): Evidence[] {
  const out: Evidence[] = [];
  for (const item of lists.flat()) {
    if (out.some((e) => e.turnIndex === item.turnIndex)) continue;
    out.push(item);
  }
  return out.sort((a, b) => a.turnIndex - b.turnIndex).slice(0, 2);
}

export function blameEvidence(ctx: CareContext): Evidence[] {
  return merge(
    fromWords(ctx, (lower, question) => !question && BLAME.test(lower) && !HEDGED.test(lower)),
    fromFlags(ctx, (v) => v.turn.cls.blame, 'blame'),
    fromEvents(ctx, ['blame'], ['blame']),
  );
}

export function dismissiveEvidence(ctx: CareContext): Evidence[] {
  return merge(
    fromWords(ctx, (lower, question) => !question && DISMISSIVE.test(lower)),
    fromFlags(ctx, (v) => v.turn.cls.dismissive, 'dismissive'),
    fromEvents(ctx, ['dismissal'], ['dismissive']),
  );
}

export function impatientEvidence(ctx: CareContext): Evidence[] {
  return merge(fromWords(ctx, (lower) => IMPATIENT.test(lower)));
}

export function promiseEvidence(ctx: CareContext): Evidence[] {
  const notJustACheck = (list: Evidence[]): Evidence[] =>
    list.filter((e) => !promisesOnlyToCheck(e.quote));
  return merge(
    fromWords(ctx, (lower) => isUnsupportedPromise(lower)),
    notJustACheck(fromFlags(ctx, (v) => v.turn.cls.promise === 'unverified', 'promise-unverified')),
    notJustACheck(
      fromEvents(ctx, ['promise'], ['promise-unverified'], (reason) =>
        reason.startsWith('Promised an outcome'),
      ),
    ),
  );
}

/** A question asked again after the customer had answered it, as the engine recorded it or as it reads. */
export function repeatEvidence(ctx: CareContext): Evidence[] {
  const recorded = fromEvents(ctx, ['repetition'], ['discovery-question']);
  const seen = new Map<string, number>();
  const again: Evidence[] = [];
  for (const view of ctx.turns) {
    for (const sentence of view.sentences) {
      if (!sentence.question || isHousekeeping(sentence.text)) continue;
      const key = fold(sentence.text);
      if (key.length < 12) continue;
      if (seen.has(key) && seen.get(key) !== view.turn.index) {
        pushEvidence(again, evidenceOf({ view, sentence }), 4);
      }
      seen.set(key, view.turn.index);
    }
  }
  return merge(recorded, again);
}
