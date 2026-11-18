import { randomUUID } from 'node:crypto';
import type { DemoStatusDTO } from '#shared/domain/api.ts';
import { DIMENSION_IDS, type DimensionId } from '#shared/domain/vocab.ts';
import type { Repository } from '../db/repository.ts';
import type { Logger } from '../log.ts';
import type { ModelProvider } from '../providers/types.ts';
import type { InsightsService } from './insights.ts';
import { SAMPLE_SCRIPTS } from './sample-scripts.ts';
import type { SessionService } from './sessions.ts';

// Trainer and demo support: loading labelled sample sessions and resetting practice data.
// Sample sessions run through the real engine and evaluator in demo mode, so they are honest
// examples of what the product produces, not hand-written reports.

export interface DemoService {
  status(profileId: string): DemoStatusDTO;
  loadSamples(profileId: string): Promise<{ created: number; skipped: number }>;
  reset(profileId: string, scope: 'practice' | 'samples' | 'all'): number;
}

export function createDemoService(deps: {
  repo: Repository;
  /** A session service wired to demo mode, so samples never call a live model. */
  sampleService: SessionService;
  insights: InsightsService;
  provider: ModelProvider;
  spotlightScenarioId: string | null;
  scenarioExists: (id: string) => boolean;
  log: Logger;
}): DemoService {
  const { repo, sampleService, insights, provider, log } = deps;

  return {
    status(profileId) {
      const counts = repo.countSessions(profileId);
      return {
        spotlightScenarioId: deps.spotlightScenarioId,
        practiceSessions: counts.practice,
        sampleSessions: counts.samples,
        provider: { kind: provider.kind, label: provider.label, demo: provider.demo },
      };
    },

    async loadSamples(profileId) {
      if (repo.countSessions(profileId).samples > 0)
        return { created: 0, skipped: SAMPLE_SCRIPTS.length };
      let created = 0;
      let skipped = 0;
      for (const script of SAMPLE_SCRIPTS) {
        if (!deps.scenarioExists(script.scenarioId)) {
          skipped += 1;
          continue;
        }
        const startedAt = new Date(Date.now() - script.daysAgo * 86_400_000).toISOString();
        const session = sampleService.createSession(
          profileId,
          { scenarioId: script.scenarioId, overrides: script.overrides },
          { isSample: true, startedAt },
        );
        for (const line of script.lines) {
          await sampleService.sendMessage(profileId, session.id, {
            text: line,
            clientMessageId: randomUUID(),
          });
        }
        await sampleService.endSession(profileId, session.id);
        await sampleService.settle(session.id);
        const endedAt = new Date(
          Date.parse(startedAt) + script.durationMinutes * 60_000,
        ).toISOString();
        repo.setSessionTimes(session.id, startedAt, endedAt);

        const scores = Object.fromEntries(
          DIMENSION_IDS.map((d, i) => [d, script.mentorScores[i] as number]),
        ) as Record<DimensionId, number>;
        try {
          insights.mentorScore(
            profileId,
            session.id,
            { reviewer: 'Sample mentor', scores, notes: 'Synthetic sample review.' },
            'sample',
          );
        } catch (error) {
          log.warn('demo.sample_review_skipped', {
            key: script.key,
            error: String((error as Error).message).slice(0, 120),
          });
        }
        created += 1;
      }
      log.info('demo.samples_loaded', { created, skipped });
      return { created, skipped };
    },

    reset(profileId, scope) {
      return repo.deleteSessions(profileId, scope);
    },
  };
}
