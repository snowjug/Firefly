import { useState } from 'react';

/**
 * How many cards arrive one after another. A further new card is simply there: it is out of sight
 * (the row shows four or five), and an animation on every card of a long row is work for nothing.
 */
export const ARRIVAL_STEPS = 8;

/**
 * The step a card arrives on (0 first), or null when it is past the last step and does not animate.
 * Something that is not a place counts as the first.
 */
export function arrivalStep(index: number): number | null {
  const place = Number.isFinite(index) ? Math.max(Math.trunc(index), 0) : 0;
  return place < ARRIVAL_STEPS ? place : null;
}

interface Seen {
  signature: string;
  ids: readonly string[];
  arrivals: ReadonlyMap<string, number>;
}

const NOTHING: ReadonlyMap<string, number> = new Map();

/**
 * Which of the cards shown are new to the row since the last change, and in what order they arrive
 * (0 for the first new one). A card that was already there is not in the answer, so it stays put and
 * only the cards a filter brings in fade and rise; a card that goes is simply gone. The first time
 * there are cards, they all arrive. The answer only changes when the set of cards does, so choosing
 * one of them, or any other re-render, never starts the movement again.
 */
export function useArrivals(ids: readonly string[]): ReadonlyMap<string, number> {
  const signature = ids.join('|');
  const [seen, setSeen] = useState<Seen>({ signature: '', ids: [], arrivals: NOTHING });
  if (seen.signature === signature) return seen.arrivals;
  // The set changed: work out what is new against the set before it, and keep that until the next change.
  const before = new Set(seen.ids);
  const arrivals = new Map<string, number>();
  for (const id of ids) if (!before.has(id)) arrivals.set(id, arrivals.size);
  setSeen({ signature, ids, arrivals });
  return arrivals;
}
