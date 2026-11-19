import type { StateEvent } from '#shared/domain/state.ts';
import { sentences } from '#shared/domain/text.ts';
import { temperatureBand } from '#shared/domain/vocab.ts';

// How the report talks about the simulated customer's reactions. The engine keeps temperature,
// trust, patience and confidence on a 0-100 scale. Those numbers are internal and mean nothing to
// a trainee, so they never appear in report text: the report uses the five band names and the
// size and direction of a change, and says nothing about a change too small to matter.

export type MoodKey = 'temperature' | 'trust' | 'patience' | 'confidence' | 'ownershipConfidence';

const SUBJECT: Record<MoodKey, string> = {
  temperature: 'temperature',
  trust: 'trust',
  patience: 'patience',
  confidence: 'confidence that support can help',
  ownershipConfidence: 'confidence that someone owns the problem',
};

export const isMoodKey = (key: string): key is MoodKey => key in SUBJECT;

/** A change of this many points or fewer is noise, not something to tell the trainee about. */
export const TRIVIAL_CHANGE = 4;

/** How the temperature moved ("eased a little", "rose sharply"), or null when too small to mention. */
export function temperatureMove(delta: number): string | null {
  const size = Math.abs(delta);
  if (size <= TRIVIAL_CHANGE) return null;
  if (delta < 0)
    return size >= 20 ? 'eased a lot' : size >= 10 ? 'eased noticeably' : 'eased a little';
  return size >= 10 ? 'rose sharply' : 'rose a little';
}

/** How trust, patience or confidence moved, or null when too small to mention. */
export function measureMove(delta: number): string | null {
  const size = Math.abs(delta);
  if (size <= TRIVIAL_CHANGE) return null;
  if (delta > 0)
    return size >= 20 ? 'rose a lot' : size >= 10 ? 'rose noticeably' : 'rose a little';
  return size >= 10 ? 'fell sharply' : 'fell a little';
}

export interface MoodMove {
  key: MoodKey;
  delta: number; // net change, signed
  from: number;
  to: number;
}

/** The net change per measure across these events, in the order the measures first moved. */
export function netMoves(events: StateEvent[]): MoodMove[] {
  const moves = new Map<MoodKey, MoodMove>();
  for (const e of events) {
    if (!isMoodKey(e.key)) continue;
    const seen = moves.get(e.key);
    if (seen) {
      seen.delta += e.delta;
      seen.to = e.next;
    } else {
      moves.set(e.key, { key: e.key, delta: e.delta, from: e.previous, to: e.next });
    }
  }
  return [...moves.values()];
}

/** True when the move is bad news for the trainee: the temperature rose or trust, patience or confidence fell. */
export const isHarm = (move: MoodMove): boolean =>
  move.key === 'temperature' ? move.delta > 0 : move.delta < 0;

function moveText(move: MoodMove): string | null {
  if (move.key !== 'temperature') {
    const text = measureMove(move.delta);
    return text ? `${SUBJECT[move.key]} ${text}` : null;
  }
  const text = temperatureMove(move.delta);
  if (!text) return null;
  const before = temperatureBand(move.from);
  const after = temperatureBand(move.to);
  return `temperature ${text}${before.id === after.id ? '' : ` (${before.label} to ${after.label})`}`;
}

/**
 * The customer's reaction in words: the biggest temperature move and the biggest move in any
 * other measure ("Maya's temperature rose sharply (Frustrated to Angry) and trust fell a little"),
 * or null when there is nothing worth saying. `brief` keeps only the first of the two.
 */
export function describeMoves(name: string, moves: MoodMove[], brief = false): string | null {
  const biggest = (list: MoodMove[]) =>
    list.reduce<MoodMove | undefined>(
      (best, m) => (!best || Math.abs(m.delta) > Math.abs(best.delta) ? m : best),
      undefined,
    );
  const chosen = [
    biggest(moves.filter((m) => m.key === 'temperature')),
    biggest(moves.filter((m) => m.key !== 'temperature')),
  ];
  const parts = chosen
    .map((m) => (m ? moveText(m) : null))
    .filter((text): text is string => text !== null)
    .slice(0, brief ? 1 : 2);
  if (parts.length === 0) return null;
  const [first, ...rest] = parts as [string, ...string[]];
  return [`${name}'s ${first}`, ...rest].join(' and ');
}

/** One change of temperature in words ("Declan's temperature eased noticeably (Angry to Frustrated)"), or null. */
export function describeTemperatureChange(name: string, from: number, to: number): string | null {
  return describeMoves(name, [{ key: 'temperature', delta: to - from, from, to }]);
}

/** What went wrong for the customer in these events, or null (a trivial change is not mentioned). */
export function describeHarm(name: string, events: StateEvent[], brief = false): string | null {
  return describeMoves(name, netMoves(events).filter(isHarm), brief);
}

/** What went right for the customer in these events, or null (a trivial change is not mentioned). */
export function describeHelp(name: string, events: StateEvent[], brief = false): string | null {
  return describeMoves(
    name,
    netMoves(events).filter((m) => !isHarm(m) && m.delta !== 0),
    brief,
  );
}

/** The whole call in one phrase: "Declan's temperature eased a lot, from Angry at the start to Concerned at the end". */
export function describeCall(name: string, start: number, end: number): string {
  const first = temperatureBand(start);
  const last = temperatureBand(end);
  const move = temperatureMove(end - start);
  if (!move) return `${name}'s temperature held steady at ${last.label}`;
  const bands =
    first.id === last.id
      ? `, staying ${first.label}`
      : `, from ${first.label} at the start to ${last.label} at the end`;
  return `${name}'s temperature ${move}${bands}`;
}

// The same pattern the regression test scans for: a measure's name followed, in the same sentence,
// by a two- or three-digit number.
const RAW_NUMBER = /\b(?:temperature|trust|confidence|patience|urgency)\b[^.]*\b\d{2,3}\b/i;

export const printsRawMoodNumber = (text: string): boolean => RAW_NUMBER.test(text);

/** Drops any sentence that prints a raw 0-100 value of the customer's state (model-written text). */
export function withoutRawMoodNumbers(text: string): string {
  return sentences(text)
    .filter((sentence) => !RAW_NUMBER.test(sentence))
    .join(' ');
}
