import type { DatabaseSync } from 'node:sqlite';
import type { ScenarioDefinition } from '#shared/domain/scenario.ts';
import type { AppConfig } from './config.ts';
import { createRepository, type Repository } from './db/repository.ts';
import { openDatabase } from './db/database.ts';
import { EVALUATOR_NAME, EVALUATOR_VERSION, evaluateWithRules } from './evaluator/rules.ts';
import { mergeModelDraft } from './evaluator/merge.ts';
import { createFailureHooks, type FailureHooks } from './hooks.ts';
import { createApp } from './http/app.ts';
import { createLogger, type Logger } from './log.ts';
import { createProvider } from './providers/index.ts';
import type { ModelProvider } from './providers/types.ts';
import { getScenarioLibrary } from './scenarios/index.ts';
import { SessionService, type EvaluatorFns } from './services/sessions.ts';

export interface Runtime {
  handler: ReturnType<typeof createApp>['handler'];
  db: DatabaseSync;
  repo: Repository;
  service: SessionService;
  provider: ModelProvider;
  hooks: FailureHooks;
  close(): void;
}

export const defaultEvaluators: EvaluatorFns = {
  rules: { name: EVALUATOR_NAME, version: EVALUATOR_VERSION, evaluate: evaluateWithRules },
  mergeModelDraft: (draft, input, meta) => mergeModelDraft(draft, input, meta),
};

/** Wires the database, services and HTTP handler together. Tests inject fakes through `options`. */
export function createRuntime(options: {
  config: AppConfig;
  db?: DatabaseSync;
  provider?: ModelProvider;
  log?: Logger;
  library?: ScenarioDefinition[];
  evaluators?: EvaluatorFns;
}): Runtime {
  const { config } = options;
  const log = options.log ?? createLogger();
  const db = options.db ?? openDatabase(config.dbPath);
  const repo = createRepository(db);
  const hooks = createFailureHooks(config.testHooks);
  const provider = options.provider ?? createProvider(config.provider);
  const library = options.library ?? getScenarioLibrary();
  const evaluators = options.evaluators ?? defaultEvaluators;

  const service = new SessionService({ db, repo, provider, library, evaluators, log, hooks });
  const app = createApp({ config, service, provider, repo, hooks, log });
  return {
    handler: app.handler,
    db,
    repo,
    service,
    provider,
    hooks,
    close: () => db.close(),
  };
}
