import { api } from '../../lib/api.ts';
import { useApi } from '../../lib/hooks.ts';
import { STATUS_FILTERS, type HistoryFilters, type StatusFilter } from './status.ts';

export type StatusCounts = Record<StatusFilter, number>;

/**
 * How many calls each status filter would show, under the other filters. The list endpoint only
 * says how many calls match the filter it was asked for, so each count is one small request (a
 * page of one). A count that cannot be had is simply not shown: it never blocks the list.
 */
export function useStatusCounts(
  filters: Pick<HistoryFilters, 'difficulty' | 'scenarioId' | 'includeSamples'>,
) {
  return useApi(
    async (signal) => {
      const base = {
        difficulty: filters.difficulty || undefined,
        scenarioId: filters.scenarioId || undefined,
        includeSamples: filters.includeSamples,
        limit: 1,
        offset: 0,
      };
      const totals = await Promise.all(
        STATUS_FILTERS.map((filter) =>
          api.listSessions({ ...base, status: filter.api }, signal).then((page) => page.total),
        ),
      );
      return Object.fromEntries(
        STATUS_FILTERS.map((filter, index) => [filter.value, totals[index] ?? 0]),
      ) as StatusCounts;
    },
    [filters.difficulty, filters.scenarioId, filters.includeSamples],
  );
}
