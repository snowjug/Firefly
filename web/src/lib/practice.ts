import type { ProgressDTO, PublicScenarioDTO, SessionListDTO } from '#shared/domain/api.ts';
import { api } from './api.ts';
import { useApi, type AsyncState } from './hooks.ts';

export interface PracticeData {
  scenarios: AsyncState<PublicScenarioDTO[]>;
  /** The latest practice calls (sample calls are never included), newest first. */
  sessions: AsyncState<SessionListDTO>;
  progress: AsyncState<ProgressDTO>;
}

/**
 * Everything the "where am I and what next" views need: the scenario library, the saved practice
 * calls and the progress summary. It reads the same endpoints the rest of the app already uses.
 */
export function usePractice(): PracticeData {
  const scenarios = useApi((signal) => api.scenarios(signal), []);
  const sessions = useApi(
    (signal) => api.listSessions({ limit: 100, includeSamples: false }, signal),
    [],
  );
  const progress = useApi((signal) => api.progress(false, signal), []);
  return { scenarios, sessions, progress };
}
