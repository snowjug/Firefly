import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { z, ZodError } from 'zod';
import type {
  AppConfigDTO,
  ApiErrorBody,
  CreateSessionRequest,
  MentorScoreRequest,
  SendMessageRequest,
} from '#shared/domain/api.ts';
import { DIFFICULTIES, SESSION_STATUSES } from '#shared/domain/vocab.ts';
import { LATEST_SCHEMA_VERSION } from '../db/database.ts';
import { AppError } from '../errors.ts';
import type { FailureHooks, FailureTarget } from '../hooks.ts';
import type { AppConfig } from '../config.ts';
import type { Logger } from '../log.ts';
import { shortId } from '../log.ts';
import type { ModelProvider } from '../providers/types.ts';
import type { Repository } from '../db/repository.ts';
import type { DemoService } from '../services/demo.ts';
import type { InsightsService } from '../services/insights.ts';
import {
  CreateSessionSchema,
  EndSessionSchema,
  LIMITS,
  MentorScoreSchema,
  SendMessageSchema,
  toAppError,
  type SessionService,
} from '../services/sessions.ts';
import {
  assertSameOrigin,
  createRateLimiter,
  readJsonBody,
  resolveProfile,
  securityHeaders,
  type RateLimitName,
} from './security.ts';
import { serveStatic } from './static.ts';

export interface AppDeps {
  config: AppConfig;
  service: SessionService;
  insights: InsightsService;
  demo: DemoService;
  provider: ModelProvider;
  repo: Repository;
  hooks: FailureHooks;
  log: Logger;
}

interface Ctx {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  params: Record<string, string>;
  profileId: string;
  signal: AbortSignal;
  body: () => Promise<unknown>;
}

type Handler = (ctx: Ctx) => Promise<unknown> | unknown;

interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
  limit?: RateLimitName;
  status?: number;
}

function route(
  method: string,
  path: string,
  handler: Handler,
  options: { limit?: RateLimitName; status?: number } = {},
): Route {
  const keys: string[] = [];
  const source = path.replace(/:([A-Za-z]+)/g, (_m, key: string) => {
    keys.push(key);
    return '([^/]+)';
  });
  return { method, pattern: new RegExp(`^${source}$`), keys, handler, ...options };
}

const sendJson = (res: ServerResponse, status: number, body: unknown) => {
  const text = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', Buffer.byteLength(text));
  res.end(text);
};

const ListFilters = z.object({
  status: z.enum(SESSION_STATUSES).optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
  scenarioId: z.string().max(64).optional(),
  includeSamples: z.enum(['0', '1']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).max(10_000).optional(),
});

export function createApp(deps: AppDeps) {
  const { config, service, insights, demo, provider, hooks, log } = deps;
  const limiter = createRateLimiter();

  const publicConfig = (): AppConfigDTO => ({
    app: { name: 'Firefly', version: config.version },
    provider: {
      kind: provider.kind,
      label: provider.label,
      demo: provider.demo,
      notice: config.provider.problem,
    },
    limits: { maxMessageChars: LIMITS.maxMessageChars, maxTraineeTurns: LIMITS.maxTraineeTurns },
    features: { devDiagnostics: config.devDiagnostics, testHooks: hooks.enabled },
  });

  const routes: Route[] = [
    route('GET', '/api/health', () => ({
      status: 'ok',
      app: 'Firefly',
      version: config.version,
      schemaVersion: LATEST_SCHEMA_VERSION,
      provider: { kind: provider.kind, demo: provider.demo },
    })),
    route('GET', '/api/config', () => publicConfig()),

    route('GET', '/api/scenarios', () => ({ scenarios: service.listScenarios() })),
    route('GET', '/api/scenarios/:id', (c) => ({
      scenario: service.getScenario(c.params.id as string),
    })),

    route(
      'POST',
      '/api/sessions',
      async (c) => ({
        session: service.createSession(
          c.profileId,
          CreateSessionSchema.parse(await c.body()) as CreateSessionRequest,
        ),
      }),
      { limit: 'create', status: 201 },
    ),
    route('GET', '/api/sessions', (c) => {
      const f = ListFilters.parse(Object.fromEntries(c.url.searchParams));
      return service.listSessions(c.profileId, {
        ...(f.status ? { status: f.status } : {}),
        ...(f.difficulty ? { difficulty: f.difficulty } : {}),
        ...(f.scenarioId ? { scenarioId: f.scenarioId } : {}),
        includeSamples: f.includeSamples !== '0',
        ...(f.limit ? { limit: f.limit } : {}),
        ...(f.offset ? { offset: f.offset } : {}),
      });
    }),
    route('GET', '/api/sessions/:id', (c) => ({
      session: service.getSession(c.profileId, c.params.id as string),
    })),
    route('DELETE', '/api/sessions/:id', (c) => {
      service.deleteSession(c.profileId, c.params.id as string);
      return { deleted: true };
    }),
    route(
      'POST',
      '/api/sessions/:id/messages',
      async (c) =>
        service.sendMessage(
          c.profileId,
          c.params.id as string,
          SendMessageSchema.parse(await c.body()) as SendMessageRequest,
          c.signal,
        ),
      { limit: 'message' },
    ),
    route(
      'POST',
      '/api/sessions/:id/end',
      async (c) => ({
        session: await service.endSession(
          c.profileId,
          c.params.id as string,
          EndSessionSchema.parse(await c.body()),
        ),
      }),
      { limit: 'end' },
    ),
    route(
      'POST',
      '/api/sessions/:id/evaluate',
      async (c) => ({ session: await service.retryEvaluation(c.profileId, c.params.id as string) }),
      { limit: 'end' },
    ),
    route('GET', '/api/sessions/:id/report', (c) => ({
      report: service.getReport(c.profileId, c.params.id as string),
    })),
    route('POST', '/api/sessions/:id/mentor-score', async (c) => {
      insights.mentorScore(
        c.profileId,
        c.params.id as string,
        MentorScoreSchema.parse(await c.body()) as MentorScoreRequest,
      );
      return { saved: true };
    }),

    route('GET', '/api/progress', (c) => ({
      progress: insights.progress(c.profileId, c.url.searchParams.get('includeSamples') === '1'),
    })),
    route('GET', '/api/calibration', (c) =>
      insights.calibration(c.profileId, c.url.searchParams.get('includeSamples') === '1'),
    ),

    route('GET', '/api/demo', (c) => demo.status(c.profileId)),
    route('POST', '/api/demo/samples', async (c) => demo.loadSamples(c.profileId), {
      limit: 'create',
    }),
    route('POST', '/api/demo/reset', async (c) => {
      const body = z
        .object({ scope: z.enum(['practice', 'samples', 'all']) })
        .parse(await c.body());
      return { deleted: demo.reset(c.profileId, body.scope) };
    }),
  ];

  if (hooks.enabled) {
    routes.push(
      route('POST', '/api/test/fail-next', async (c) => {
        const body = z
          .object({
            target: z.enum(['customer', 'classifier', 'evaluator']),
            count: z.number().int().min(0).max(5).default(1),
          })
          .parse(await c.body());
        hooks.setNext(body.target as FailureTarget, body.count);
        return { queued: body.count };
      }),
    );
  }
  if (config.devDiagnostics) {
    routes.push(
      route('GET', '/api/dev/sessions/:id/runtime', (c) => {
        const row = deps.repo.getSession(c.params.id as string, c.profileId);
        if (!row) throw new AppError(404, 'not_found', 'That session was not found.');
        return {
          runtime: row.runtime,
          hiddenFacts: row.scenario.hiddenFacts,
          config: row.scenario.config,
        };
      }),
    );
  }

  const respondError = (res: ServerResponse, error: unknown, requestId: string): number => {
    let app: AppError;
    if (error instanceof ZodError) {
      app = new AppError(400, 'validation_failed', 'Some of the values sent were not valid.', {
        details: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    } else {
      app = toAppError(error);
      if (app.code === 'internal')
        log.error('request.error', {
          requestId,
          error: String((error as Error)?.message ?? error).slice(0, 200),
        });
    }
    const body: ApiErrorBody = {
      error: {
        code: app.code,
        message: app.message,
        retryable: app.retryable,
        ...(app.details !== undefined ? { details: app.details } : {}),
      },
    };
    if (!res.headersSent) sendJson(res, app.status, body);
    return app.status;
  };

  const handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const started = Date.now();
    const requestId = randomUUID().slice(0, 8);
    const url = new URL(req.url ?? '/', 'http://localhost');
    const isApi = url.pathname.startsWith('/api/');
    securityHeaders(res, isApi);
    let status = 200;
    let routeLabel = url.pathname;

    try {
      if (!isApi) {
        const served = await serveStatic(req, res, config.webDir, url.pathname);
        if (!served) {
          status = 404;
          res.statusCode = 404;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end(
            req.method === 'GET' && url.pathname === '/'
              ? 'Firefly API is running. The web app has not been built yet: run "npm run build", or use "npm run dev".'
              : 'Not found',
          );
        }
        return;
      }

      assertSameOrigin(req);
      const profileId = resolveProfile(req, res);
      limiter.take(profileId, 'api');

      const method = req.method ?? 'GET';
      let matched: { route: Route; params: Record<string, string> } | null = null;
      let pathExists = false;
      for (const r of routes) {
        const m = r.pattern.exec(url.pathname);
        if (!m) continue;
        pathExists = true;
        if (r.method !== method) continue;
        const params: Record<string, string> = {};
        r.keys.forEach((key, i) => (params[key] = decodeURIComponent(m[i + 1] as string)));
        matched = { route: r, params };
        break;
      }
      if (!matched) {
        throw pathExists
          ? new AppError(405, 'bad_request', 'That method is not allowed here.')
          : new AppError(404, 'not_found', 'That endpoint does not exist.');
      }
      routeLabel = `${method} ${matched.route.pattern.source
        .replace(/\(\[\^\/\]\+\)/g, ':id')
        .replace(/\\\//g, '/')
        .replace(/^\^|\$$/g, '')}`;
      if (matched.route.limit) limiter.take(profileId, matched.route.limit);

      const controller = new AbortController();
      res.on('close', () => {
        if (!res.writableEnded) controller.abort();
      });
      let cached: Promise<unknown> | null = null;
      const result = await matched.route.handler({
        req,
        res,
        url,
        params: matched.params,
        profileId,
        signal: controller.signal,
        body: () => (cached ??= readJsonBody(req)),
      });
      status = matched.route.status ?? 200;
      sendJson(res, status, result);
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') {
        status = 499;
        return;
      }
      status = respondError(res, error, requestId);
    } finally {
      if (isApi) {
        log.info('request', {
          requestId,
          route: routeLabel,
          status,
          ms: Date.now() - started,
          ...(url.pathname.includes('/sessions/')
            ? { sessionId: shortId(url.pathname.split('/')[3] ?? '') }
            : {}),
        });
      }
    }
  };

  return { handler };
}
