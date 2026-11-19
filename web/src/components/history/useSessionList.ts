import { useState } from 'react';
import type { SessionListDTO, SessionSummaryDTO } from '#shared/domain/api.ts';
import { api } from '../../lib/api.ts';
import { useApi } from '../../lib/hooks.ts';
import { STATUS_FILTERS, type HistoryFilters } from './status.ts';

export const PAGE_SIZE = 12;

interface Overlay {
  /** The first page this overlay belongs to; it is ignored once a newer first page arrives. */
  base: SessionListDTO;
  more: SessionSummaryDTO[];
  removed: string[];
}

/**
 * The history list: the first page comes from the filters (and the previous list stays on screen
 * while a new one loads); "Show more" appends pages; deleted sessions disappear immediately.
 */
export function useSessionList(filters: HistoryFilters) {
  const apiStatus = STATUS_FILTERS.find((f) => f.value === filters.status)?.api;
  const query = {
    difficulty: filters.difficulty || undefined,
    scenarioId: filters.scenarioId || undefined,
    status: apiStatus,
    includeSamples: filters.includeSamples,
  };
  const first = useApi(
    (signal) => api.listSessions({ ...query, limit: PAGE_SIZE, offset: 0 }, signal),
    [filters.difficulty, filters.scenarioId, apiStatus, filters.includeSamples],
  );
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<unknown>(null);

  const base = first.data;
  const live = overlay && overlay.base === base ? overlay : null;
  const removed = live?.removed ?? [];
  const items = base
    ? [...base.sessions, ...(live?.more ?? [])].filter((s) => !removed.includes(s.id))
    : [];
  const total = base ? Math.max(0, base.total - removed.length) : 0;

  const loadMore = async (): Promise<SessionSummaryDTO[]> => {
    if (!base || loadingMore) return [];
    setLoadingMore(true);
    setMoreError(null);
    try {
      const next = await api.listSessions({ ...query, limit: PAGE_SIZE, offset: items.length });
      const known = new Set(items.map((s) => s.id));
      const fresh = next.sessions.filter((s) => !known.has(s.id));
      setOverlay((current) => {
        const own = current && current.base === base ? current : { base, more: [], removed: [] };
        return { ...own, more: [...own.more, ...fresh] };
      });
      return fresh;
    } catch (error) {
      setMoreError(error);
      return [];
    } finally {
      setLoadingMore(false);
    }
  };

  const remove = (id: string) => {
    if (!base) return;
    setOverlay((current) => {
      const own = current && current.base === base ? current : { base, more: [], removed: [] };
      return own.removed.includes(id) ? own : { ...own, removed: [...own.removed, id] };
    });
  };

  return {
    items,
    total,
    hasData: base !== null,
    loading: first.loading,
    error: first.error,
    reload: first.reload,
    hasMore: items.length < total,
    loadMore,
    loadingMore,
    moreError,
    remove,
  };
}
