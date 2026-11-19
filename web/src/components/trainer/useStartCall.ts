import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import type { ScenarioOverrides } from '#shared/domain/scenario.ts';
import { loadDraft, saveDraft } from '../../lib/draft.ts';

/**
 * Saves the call setup as the current draft, then opens the pre-call brief. If the browser refuses
 * to store the draft the user is told instead of arriving at a brief that has no setup.
 */
export function useStartCall() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(
    (scenarioId: string, overrides: ScenarioOverrides) => {
      saveDraft({ scenarioId, overrides });
      if (loadDraft()?.scenarioId !== scenarioId) {
        setError(
          'This browser would not store the call setup. Open the scenario from the library instead.',
        );
        return;
      }
      setError(null);
      navigate(`/scenarios/${encodeURIComponent(scenarioId)}/brief`, { viewTransition: true });
    },
    [navigate],
  );

  return { start, error };
}
