import { createContext } from 'react';
import type { TurnDTO } from '#shared/domain/api.ts';

/**
 * The call's turns, provided by the report so any quote can open the moment it came from without
 * leaving the page. Components outside a report (and tests) simply do not get the extra control.
 */
export const ReportTurnsContext = createContext<readonly TurnDTO[] | null>(null);

/** The turns around `turn`: up to two before and two after, oldest first. */
export function segmentAround(
  turns: readonly TurnDTO[],
  turn: number,
  radius = 2,
): readonly TurnDTO[] {
  return turns
    .filter((candidate) => Math.abs(candidate.index - turn) <= radius)
    .sort((a, b) => a.index - b.index);
}
