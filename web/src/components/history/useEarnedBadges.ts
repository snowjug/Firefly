import { useMemo } from 'react';
import { api } from '../../lib/api.ts';
import { useApi } from '../../lib/hooks.ts';

/**
 * The badges each call earned, by session id, from the rewards the server works out from saved
 * practice. If rewards cannot be loaded the map is simply empty, so the table never depends on them.
 */
export function useEarnedBadges(): ReadonlyMap<string, readonly string[]> {
  // An async loader turns any failure (offline, an older server without rewards) into "no badges".
  const rewards = useApi(async (signal) => api.rewards(new Date().getTimezoneOffset(), signal), []);
  return useMemo(() => {
    const bySession = new Map<string, string[]>();
    for (const badge of rewards.data?.badges ?? []) {
      if (!badge.earned || !badge.earnedInSessionId) continue;
      const titles = bySession.get(badge.earnedInSessionId) ?? [];
      titles.push(badge.title);
      bySession.set(badge.earnedInSessionId, titles);
    }
    return bySession;
  }, [rewards.data]);
}
