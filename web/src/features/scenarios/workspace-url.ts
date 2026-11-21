import {
  serializeConfig,
  toSearch,
  type CallConfig,
  type ConfigScenario,
} from './config-params.ts';
import { writeFilters, type Filters } from './catalogue.ts';

/** The scenario on show and how its call is configured. */
export interface Selection {
  scenarioId: string;
  scenario: ConfigScenario;
  config: CallConfig;
}

/**
 * The workspace's whole query in one fixed order: the filters, then the chosen scenario, then its
 * configuration. Reading it back and writing it again gives the same text, so the address can be
 * tidied without ever changing what it means.
 */
export function workspaceSearch(filters: Filters, selection: Selection | null): string {
  const params = new URLSearchParams();
  writeFilters(filters, params);
  if (selection) {
    params.set('scenario', selection.scenarioId);
    for (const [key, value] of serializeConfig(selection.config, selection.scenario)) {
      params.set(key, value);
    }
  }
  return toSearch(params);
}

/** A query string written the same way as `workspaceSearch`, for comparing the two. */
export function normaliseSearch(search: string): string {
  return toSearch(new URLSearchParams(search));
}
