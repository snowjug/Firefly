import type { SessionDTO } from '#shared/domain/api.ts';
import { fold } from '#shared/domain/text.ts';
import { clockFor, locateQuote } from './transcript-model.ts';

// What the report is allowed to show as evidence. Every quote in a report names a turn, and was
// checked against that turn when the report was saved. The page checks it again against the
// transcript it holds: a quote that the turn does not say is never drawn as evidence, so a damaged
// or edited report cannot put words in the trainee's mouth. Pure functions, so the rule is tested
// on its own.

/** A turn as the evidence views need it: who said it, when, and the words exactly as they were said. */
export interface EvidenceTurn {
  index: number;
  role: 'customer' | 'trainee';
  /** "You", or the customer's name. */
  speaker: string;
  /** Time since the call started, as m:ss. */
  clock: string;
  text: string;
}

export type TurnLookup = ReadonlyMap<number, EvidenceTurn>;

/** Every turn of the call, in order, ready to be looked up by its number. */
export function evidenceTurns(session: SessionDTO): EvidenceTurn[] {
  return session.turns.map((turn) => ({
    index: turn.index,
    role: turn.role,
    speaker: turn.role === 'trainee' ? 'You' : session.scenario.persona.name,
    clock: clockFor(session.startedAt, turn.createdAt),
    text: turn.text,
  }));
}

export function turnLookup(turns: readonly EvidenceTurn[]): TurnLookup {
  return new Map(turns.map((turn) => [turn.index, turn] as const));
}

/**
 * True when `text` says `quote`: the same words, ignoring case, punctuation and spacing, which is how
 * the report was checked when it was made. A quote too short to find inside other words ("OK") only
 * counts when it is the whole turn.
 */
export function quoteMatchesTurn(text: string, quote: string): boolean {
  if (locateQuote(text, quote)) return true;
  const wanted = fold(quote);
  return wanted !== '' && wanted.length < 3 && fold(text) === wanted;
}

/** True when the trainee said `quote` in turn `turnIndex`. A quote with no turn cannot be shown as evidence. */
export function isVerifiedQuote(
  turns: TurnLookup,
  turnIndex: number | null,
  quote: string | null | undefined,
): boolean {
  if (turnIndex === null || !quote) return false;
  const turn = turns.get(turnIndex);
  return turn !== undefined && turn.role === 'trainee' && quoteMatchesTurn(turn.text, quote);
}

/** The evidence that holds up: what the trainee really said in the turn each item names. */
export function verifiedEvidence<T extends { turnIndex: number; quote: string }>(
  turns: TurnLookup,
  items: readonly T[],
): T[] {
  return items.filter((item) => isVerifiedQuote(turns, item.turnIndex, item.quote));
}

export interface TurnContext {
  previous: EvidenceTurn | null;
  turn: EvidenceTurn;
  next: EvidenceTurn | null;
}

/** A turn with the one before it and the one after it, or null when the call has no such turn. */
export function turnContext(turns: TurnLookup, index: number): TurnContext | null {
  const turn = turns.get(index);
  if (!turn) return null;
  return {
    previous: turns.get(index - 1) ?? null,
    turn,
    next: turns.get(index + 1) ?? null,
  };
}

/**
 * What the customer said back: the turn itself when it is the customer's, otherwise the customer's
 * reply straight after it. Null when the call ended on the trainee's turn.
 */
export function customerReplyTo(turns: TurnLookup, index: number): EvidenceTurn | null {
  const turn = turns.get(index);
  if (turn?.role === 'customer') return turn;
  const next = turns.get(index + 1);
  return next?.role === 'customer' ? next : null;
}
