import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import type { ScenarioOverrides } from '#shared/domain/scenario.ts';
import { loadDraft, saveDraft } from '../../lib/draft.ts';
import { setupPath } from '../scenario/paths.ts';

/**
 * Saves the call setup as the current draft, then opens the setup page for that scenario, where it
 * can be adjusted and started. If the browser refuses to store the draft the user is told instead
 * of arriving at a setup page that has lost the choices.
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
      navigate(setupPath(scenarioId), { viewTransition: true });
    },
    [navigate],
  );

  return { start, error };
}
