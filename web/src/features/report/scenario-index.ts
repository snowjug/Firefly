import { useEffect, useState } from 'react';
import type { Difficulty } from '#shared/domain/vocab.ts';
import { isAbort } from '../../lib/api.ts';

/** What the report needs to know about a scenario that exists now. `api.scenarios()` returns more. */
export interface ScenarioRef {
  id: string;
  title: string;
  difficulty: Difficulty;
  product?: { name: string } | null;
}

/** Which scenarios exist now, so a link to a retired one is never offered. */
export type ScenarioIndex =
  | { state: 'loading' }
  | { state: 'unavailable' }
  | { state: 'ready'; byId: ReadonlyMap<string, ScenarioRef> };

const LOADING: ScenarioIndex = { state: 'loading' };
const UNAVAILABLE: ScenarioIndex = { state: 'unavailable' };

/** What the index is asked from: the report client's `scenarios`, when it has one. */
export type LoadScenarios = (signal?: AbortSignal) => Promise<readonly ScenarioRef[]>;

/**
 * Asks once which scenarios exist, and cancels the request if the page is left. A call saved before
 * the Microsoft scenarios names a scenario that is gone; this is how the page finds out, so that
 * "Repeat scenario" can fall back to the scenario list instead of a page that is not there. While
 * the answer is on its way, or if it never comes, the page decides without it.
 */
export function useScenarioIndex(load: LoadScenarios | undefined): ScenarioIndex {
  const [index, setIndex] = useState<ScenarioIndex>(load ? LOADING : UNAVAILABLE);
  useEffect(() => {
    if (!load) return;
    const controller = new AbortController();
    load(controller.signal)
      .then((list) => {
        if (controller.signal.aborted) return;
        setIndex({ state: 'ready', byId: new Map(list.map((s) => [s.id, s] as const)) });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbort(error)) return;
        setIndex(UNAVAILABLE);
      });
    return () => controller.abort();
  }, [load]);
  return index;
}
