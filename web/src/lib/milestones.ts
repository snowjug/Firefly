import {
  deriveAchievements,
  tallyAchievements,
  type AchievementCall,
  type AchievementTally,
} from '#shared/domain/achievements.ts';
import type { SessionSummaryDTO } from '#shared/domain/api.ts';
import { api } from './api.ts';
import { useApi, type AsyncState } from './hooks.ts';

/** Milestones are looked for in the latest few completed calls, so the page stays quick to open. */
export const MILESTONE_LOOKBACK = 8;

/** The completed calls to look inside: newest first, no more than the look-back allows. */
export function callsToInspect(
  sessions: readonly SessionSummaryDTO[],
  includeSamples: boolean,
  limit: number = MILESTONE_LOOKBACK,
): SessionSummaryDTO[] {
  return sessions
    .filter(
      (s) =>
        s.status === 'completed' && s.completion === 'completed' && (includeSamples || !s.isSample),
    )
    .sort((a, b) => ((a.endedAt ?? a.startedAt) < (b.endedAt ?? b.startedAt) ? 1 : -1))
    .slice(0, limit);
}

export interface Milestones {
  tally: AchievementTally[];
  /** How many calls were looked at. */
  inspected: number;
  /** Calls whose report could not be read right now. They are left out, never guessed at. */
  unavailable: number;
}

/**
 * Which milestones the latest completed calls earned. Each report is read from the saved session
 * (the same endpoint the report page uses) and judged by the same rules as the report itself, so
 * nothing here can disagree with a report.
 */
export function useMilestones(calls: readonly SessionSummaryDTO[]): AsyncState<Milestones> {
  // The list is rebuilt on every render, so the request is keyed on the calls it names.
  const key = calls.map((c) => c.id).join(',');
  return useApi(
    async (signal) => {
      const results = await Promise.allSettled(calls.map((c) => api.getSession(c.id, signal)));
      const inspected: AchievementCall[] = [];
      let unavailable = 0;
      for (const result of results) {
        if (result.status !== 'fulfilled') {
          unavailable += 1;
          continue;
        }
        const session = result.value;
        const report = session.report;
        if (!report) {
          unavailable += 1;
          continue;
        }
        inspected.push({
          sessionId: session.id,
          scenarioTitle: session.scenarioTitle,
          at: session.endedAt ?? session.startedAt,
          earned: deriveAchievements(report, { proficiency: session.scenario.config.proficiency }),
        });
      }
      return { tally: tallyAchievements(inspected), inspected: inspected.length, unavailable };
    },
    [key],
  );
}
