import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { ScenarioDefinitionSchema, type ScenarioDefinition } from '#shared/domain/scenario.ts';
import type { CoachingReport } from '#shared/domain/report.ts';
import { DIMENSION_IDS, scoreLabel, temperatureBand } from '#shared/domain/vocab.ts';
import type { AppConfig } from '../config.ts';
import { createRepository } from '../db/repository.ts';
import { openDatabase } from '../db/database.ts';
import type { EvaluationInput } from '../engine/types.ts';
import { createFailureHooks } from '../hooks.ts';
import { createApp } from '../http/app.ts';
import { silentLogger } from '../log.ts';
import { createMockProvider } from '../providers/mock.ts';
import type { ModelProvider } from '../providers/types.ts';
import exemplar from '../scenarios/library/locked-out-after-password-reset.ts';
import { createDemoService } from '../services/demo.ts';
import { InsightsService } from '../services/insights.ts';
import { SessionService, type EvaluatorFns } from '../services/sessions.ts';

// Test harness: the real services and HTTP app on an in-memory database and an ephemeral port.

export function fakeReport(input: EvaluationInput): CoachingReport {
  const traineeTurns = input.turns.filter((t) => t.role === 'trainee').length;
  const start = input.startState.temperature;
  const end = input.finalState.temperature;
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    evaluator: {
      kind: 'rules',
      name: 'Test evaluator',
      version: 'test-1',
      providerLabel: input.provider.label,
    },
    completion: {
      status: input.endedEarly ? 'ended-early' : 'completed',
      traineeTurns,
      evidence: traineeTurns >= 5 ? 'sufficient' : traineeTurns >= 3 ? 'limited' : 'insufficient',
      note: null,
    },
    summary: {
      overall: 'Test summary.',
      overallScore: 3,
      coachingFocus: input.scenario.coachingFocus,
    },
    dimensions: DIMENSION_IDS.map((id) => ({
      id,
      score: 3,
      label: scoreLabel(3),
      rationale: 'Test rationale.',
      evidence: [],
      sufficiency: 'sufficient' as const,
      guidance: 'Test guidance.',
    })),
    strengths: [],
    improvements: [],
    discovery: {
      results: input.scenario.hiddenFacts.map((f) => ({
        factId: f.id,
        label: f.label,
        importance: f.importance,
        status:
          input.discovery[f.id]?.status === 'discovered'
            ? ('discovered' as const)
            : input.discovery[f.id]
              ? ('partial' as const)
              : ('missed' as const),
        revealedAtTurn: input.discovery[f.id]?.turnIndex ?? null,
        revealingQuestion: input.discovery[f.id]?.question ?? null,
        whatWasHidden: f.statement,
        betterQuestion: f.betterQuestion,
        consequence: f.missedConsequence,
      })),
      found: Object.values(input.discovery).filter((d) => d.status === 'discovered').length,
      partial: Object.values(input.discovery).filter((d) => d.status === 'partial').length,
      missed: input.scenario.hiddenFacts.length - Object.keys(input.discovery).length,
      total: input.scenario.hiddenFacts.length,
    },
    journey: {
      points: [
        {
          turnIndex: 1,
          temperature: start,
          band: temperatureBand(start).label,
          kind: 'start',
          delta: 0,
          reason: null,
          quote: null,
        },
        {
          turnIndex: Math.max(2, input.turns.length),
          temperature: end,
          band: temperatureBand(end).label,
          kind: 'end',
          delta: end - start,
          reason: null,
          quote: null,
        },
      ],
      start,
      end,
      peak: Math.max(start, end),
      lowest: Math.min(start, end),
    },
    curveball: null,
    nextPractice: {
      dimension: 'scoping-discovery',
      recommendation: 'Test recommendation.',
      suggestedDifficulty: 'standard',
      suggestedScenarioId: null,
      suggestedScenarioTitle: null,
    },
    trainingNote: 'Test note.',
  };
}

export const fakeEvaluators: EvaluatorFns = {
  rules: { name: 'Test evaluator', version: 'test-1', evaluate: fakeReport },
  mergeModelDraft: (_draft, input) => ({ report: fakeReport(input), warnings: [] }),
};

export interface TestApp {
  baseUrl: string;
  service: SessionService;
  insights: InsightsService;
  hooks: ReturnType<typeof createFailureHooks>;
  repo: ReturnType<typeof createRepository>;
  close(): Promise<void>;
  /** A fetch-like client that keeps its own cookie jar (each client is a separate profile). */
  client(): TestClient;
}

export interface TestClient {
  get(path: string): Promise<TestResponse>;
  post(path: string, body?: unknown, headers?: Record<string, string>): Promise<TestResponse>;
  del(path: string): Promise<TestResponse>;
  raw(path: string, init?: RequestInit): Promise<Response>;
}

export interface TestResponse {
  status: number;
  headers: Headers;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
}

export async function createTestApp(
  options: {
    provider?: ModelProvider;
    library?: ScenarioDefinition[];
    evaluators?: EvaluatorFns;
    testHooks?: boolean;
    devDiagnostics?: boolean;
  } = {},
): Promise<TestApp> {
  const db = openDatabase(':memory:');
  const repo = createRepository(db);
  const hooks = createFailureHooks(options.testHooks ?? true);
  const provider = options.provider ?? createMockProvider({ delayMs: 0 });
  const library = options.library ?? [ScenarioDefinitionSchema.parse(exemplar)];
  const evaluators = options.evaluators ?? fakeEvaluators;
  const log = silentLogger;

  const service = new SessionService({ db, repo, provider, library, evaluators, log, hooks });
  const insights = new InsightsService(repo);
  const sampleService = new SessionService({
    db,
    repo,
    provider: createMockProvider({ delayMs: 0 }),
    library,
    evaluators,
    log,
    hooks: createFailureHooks(false),
  });
  const demo = createDemoService({
    repo,
    sampleService,
    insights,
    provider,
    spotlightScenarioId: null,
    scenarioExists: (id) => library.some((s) => s.id === id),
    log,
  });
  const config: AppConfig = {
    port: 0,
    host: '127.0.0.1',
    dbPath: ':memory:',
    webDir: '/nonexistent-web-dir',
    version: 'test',
    devDiagnostics: options.devDiagnostics ?? false,
    testHooks: options.testHooks ?? true,
    provider: { config: { kind: 'mock', mockDelayMs: 0 }, problem: null },
  };
  const app = createApp({ config, service, insights, demo, provider, repo, hooks, log });
  const server: Server = createServer((req, res) => {
    void app.handler(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const client = (): TestClient => {
    let cookie = '';
    const raw = async (path: string, init: RequestInit = {}): Promise<Response> => {
      const headers = new Headers(init.headers);
      if (cookie) headers.set('cookie', cookie);
      const res = await fetch(baseUrl + path, { ...init, headers });
      const set = res.headers.get('set-cookie');
      if (set) cookie = set.split(';')[0] as string;
      return res;
    };
    const parse = async (res: Response): Promise<TestResponse> => {
      const text = await res.text();
      let body: unknown = text;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        // leave as text
      }
      return { status: res.status, headers: res.headers, body };
    };
    return {
      raw,
      get: async (path) => parse(await raw(path)),
      del: async (path) => parse(await raw(path, { method: 'DELETE' })),
      post: async (path, body, headers = {}) =>
        parse(
          await raw(path, {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...headers },
            body: body === undefined ? undefined : JSON.stringify(body),
          }),
        ),
    };
  };

  return {
    baseUrl,
    service,
    insights,
    hooks,
    repo,
    client,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      db.close();
    },
  };
}
