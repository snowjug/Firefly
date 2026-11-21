import { scenarioForSkill } from '#shared/domain/recommend.ts';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import type { DimensionId } from '#shared/domain/vocab.ts';
import { api } from '../../lib/api.ts';
import { useApi } from '../../lib/hooks.ts';

/**
 * The scenarios and the saved calls, used only to point each skill at a scenario built to practise
 * it, so the page is complete without them. Nothing is fetched until there is something to point
 * from (`enabled`). Sample calls are demonstration data, so they never steer what is suggested.
 */
export function usePracticeLookups(enabled: boolean) {
  const scenarios = useApi(
    async (signal) => (enabled ? await api.scenarios(signal) : null),
    [enabled],
  );
  const sessions = useApi(
    async (signal) =>
      enabled ? await api.listSessions({ limit: 100, includeSamples: false }, signal) : null,
    [enabled],
  );
  const waiting = enabled && (scenarios.loading || sessions.loading);
  const library = scenarios.data;
  const calls = sessions.data?.sessions;
  const scenarioFor = (dimension: DimensionId): PublicScenarioDTO | null =>
    library && calls ? scenarioForSkill(library, calls, dimension) : null;
  return { waiting, scenarioFor };
}
