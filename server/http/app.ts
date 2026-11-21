import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { z, ZodError } from 'zod';
import type {
  AppConfigDTO,
  ApiErrorBody,
  CreateSessionRequest,
  SendMessageRequest,
} from '#shared/domain/api.ts';
import {
  DEFAULT_SPEECH_LANGUAGE,
  SPEECH_LANGUAGES,
  SPEECH_RESPONSE_HEADERS,
  type TranscribeResponse,
} from '#shared/domain/speech.ts';
import { VOICE_IDS } from '#shared/domain/voices.ts';
import { LATEST_SCHEMA_VERSION } from '../db/database.ts';
import { AppError, isAbortError } from '../errors.ts';
import { FAILURE_TARGETS, type FailureHooks } from '../hooks.ts';
import type { AppConfig } from '../config.ts';
import type { Logger } from '../log.ts';
import { shortId } from '../log.ts';
import type { ModelProvider } from '../providers/types.ts';
import type { Repository } from '../db/repository.ts';
import {
  CreateSessionSchema,
  EndSessionSchema,
  LIMITS,
  SendMessageSchema,
  toAppError,
  type SessionService,
} from '../services/sessions.ts';
import { SPEECH_LIMITS } from '../speech/types.ts';
import type { SpeechProvider, SynthesizeResult } from '../speech/types.ts';
import { previewVoice, requireSpeech, speakLine, transcribeRecording } from '../speech/service.ts';
import { validateWav } from '../speech/wav.ts';
import {
  assertSameOrigin,
  assertSmallBody,
  createRateLimiter,
  readAudioBody,
  readJsonBody,
  resolveProfile,
  securityHeaders,
  type RateLimitName,
} from './security.ts';
import { serveStatic } from './static.ts';

export interface AppDeps {
  config: AppConfig;
  service: SessionService;
  provider: ModelProvider;
  speech: SpeechProvider;
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
  requestId: string;
  signal: AbortSignal;
  body: () => Promise<unknown>;
}

/** A handler returns this instead of JSON to send bytes (spoken audio). */
const BINARY = Symbol('binary reply');
interface BinaryReply {
  [BINARY]: true;
  status: number;
  headers: Record<string, string>;
  body: Buffer;
}
const isBinaryReply = (value: unknown): value is BinaryReply =>
  typeof value === 'object' && value !== null && BINARY in value;

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

const sendBinary = (res: ServerResponse, reply: BinaryReply) => {
  res.statusCode = reply.status;
  for (const [name, value] of Object.entries(reply.headers)) res.setHeader(name, value);
  res.setHeader('Content-Length', reply.body.length);
  res.end(reply.body);
};

/** A header value that can never break the response: printable ASCII only. */
const headerText = (value: string): string => value.replace(/[^\x20-\x7e]/g, '').slice(0, 200);

/** The language of a spoken request: recognition and the customer's voice both follow it. */
const TranscribeQuerySchema = z.object({
  lang: z.enum(SPEECH_LANGUAGES).default(DEFAULT_SPEECH_LANGUAGE),
});

/** A customer turn is spoken in the voice the trainee chose; with none named, the old pairing is used. */
const TurnSpeechQuerySchema = TranscribeQuerySchema.extend({
  voice: z.enum(VOICE_IDS).optional(),
});

/** The voice preview must say which voice to try. */
const PreviewQuerySchema = TranscribeQuerySchema.extend({ voice: z.enum(VOICE_IDS) });

/** Zeroes a recording's bytes once they have been used, so they do not linger in memory. */
const scrub = (buffer: Buffer): void => void buffer.fill(0);

export function createApp(deps: AppDeps) {
  const { config, service, provider, speech, hooks, log } = deps;
  const limiter = createRateLimiter();

  const publicConfig = (): AppConfigDTO => ({
    app: { name: 'Firefly', version: config.version },
    provider: {
      kind: provider.kind,
      label: provider.label,
      demo: provider.demo,
      notice: config.provider.problem,
    },
    speech: speech.capabilities(),
    limits: { maxMessageChars: LIMITS.maxMessageChars, maxTraineeTurns: LIMITS.maxTraineeTurns },
    features: { devDiagnostics: config.devDiagnostics, testHooks: hooks.enabled },
  });

  // Speech failures are logged without the audio, the words or anything the provider said.
  const speechFailed = (
    c: Ctx,
    op: 'transcribe' | 'speak' | 'preview',
    started: number,
    error: unknown,
  ) => {
    if (!isAbortError(error)) {
      log.warn('speech.failed', {
        requestId: c.requestId,
        op,
        provider: speech.kind,
        code: toAppError(error).code,
        ms: Date.now() - started,
      });
    }
  };

  // Spoken audio as a response, with headers that say what was really used.
  const spokenReply = (spoken: SynthesizeResult): BinaryReply => ({
    [BINARY]: true,
    status: 200,
    headers: {
      'Content-Type': headerText(spoken.contentType),
      'Cache-Control': 'no-store',
      [SPEECH_RESPONSE_HEADERS.provider]: speech.kind,
      [SPEECH_RESPONSE_HEADERS.voice]: headerText(spoken.voice),
      [SPEECH_RESPONSE_HEADERS.style]: headerText(spoken.style),
      [SPEECH_RESPONSE_HEADERS.voiceId]: spoken.voiceId ?? 'none',
    },
    body: spoken.audio,
  });

  const routes: Route[] = [
    route('GET', '/api/health', () => ({
      status: 'ok',
      app: 'Firefly',
      version: config.version,
      schemaVersion: LATEST_SCHEMA_VERSION,
      provider: { kind: provider.kind, demo: provider.demo },
      speech: { kind: speech.kind },
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
    route('GET', '/api/sessions/:id', (c) => ({
      session: service.getSession(c.profileId, c.params.id as string),
    })),
    // The conversation and nothing else: no report, scores or analysis markers.
    route('GET', '/api/sessions/:id/transcript', (c) => ({
      transcript: service.getTranscript(c.profileId, c.params.id as string),
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

    // ---- speech ----------------------------------------------------------------------------
    // The trainee's recording in, text out. The audio is held in memory for this request only:
    // it is never written to disk, never logged and never kept by Firefly, and its bytes are zeroed
    // as soon as the provider has finished with them, whatever the outcome.
    route(
      'POST',
      '/api/speech/transcribe',
      async (c): Promise<TranscribeResponse> => {
        const { lang } = TranscribeQuerySchema.parse(Object.fromEntries(c.url.searchParams));
        requireSpeech(speech, 'transcribe');
        const upload = await readAudioBody(c.req, SPEECH_LIMITS.maxAudioBytes);
        const recording = validateWav(upload);
        try {
          if (!recording.ok) throw new AppError(400, 'validation_failed', recording.message);
          const started = Date.now();
          try {
            hooks.maybeFail('transcribe');
            const result = await transcribeRecording(
              speech,
              { audio: recording.wav, language: lang, durationMs: recording.durationMs },
              c.signal,
            );
            log.info('speech.transcribed', {
              requestId: c.requestId,
              provider: speech.kind,
              bytes: upload.length,
              audioMs: recording.durationMs,
              status: result.status,
              ms: Date.now() - started,
            });
            return { status: result.status, text: result.text, durationMs: result.durationMs };
          } catch (error) {
            speechFailed(c, 'transcribe', started, error);
            throw error;
          }
        } finally {
          scrub(upload);
          if (recording.ok) scrub(recording.wav);
        }
      },
      { limit: 'speech' },
    ),
    // One stored customer turn spoken aloud. The words come from the call itself, never from the
    // request, so this cannot be used to speak anything else. The request body is not read. The
    // voice is the one the trainee chose (`voice`, one of voice-a to voice-d); with none named, the
    // persona's old pairing is used, so calls saved before voices could be chosen sound as they did.
    route(
      'POST',
      '/api/sessions/:id/turns/:index/speech',
      async (c): Promise<BinaryReply> => {
        assertSmallBody(c.req);
        const { lang, voice } = TurnSpeechQuerySchema.parse(Object.fromEntries(c.url.searchParams));
        const index = c.params.index as string;
        // Anything but a whole number cannot name a turn, so it finds none.
        const turnIndex = /^\d{1,5}$/.test(index) ? Number(index) : 0;
        const line = service.getSpeakableTurn(c.profileId, c.params.id as string, turnIndex);
        requireSpeech(speech, 'synthesize');
        // Whether the customer is cooling down is worked out with the mood, in the session service.
        const recovering = (line as typeof line & { recovering?: boolean }).recovering === true;
        const started = Date.now();
        try {
          hooks.maybeFail('synthesize');
          const spoken = await speakLine(
            speech,
            { text: line.text, speaker: line.speaker, mood: line.mood, recovering },
            { language: lang, voice },
            c.signal,
          );
          log.info('speech.spoken', {
            requestId: c.requestId,
            provider: speech.kind,
            bytes: spoken.audio.length,
            ms: Date.now() - started,
          });
          return spokenReply(spoken);
        } catch (error) {
          speechFailed(c, 'speak', started, error);
          throw error;
        }
      },
      { limit: 'speech' },
    ),
    // "Test voice": one fixed, neutral sentence in the chosen voice. The words are fixed on the
    // server, so this cannot be used to speak anything else. It needs no call, is one request, and
    // counts against the same speech limits as every other speech request.
    route(
      'POST',
      '/api/speech/preview',
      async (c): Promise<BinaryReply> => {
        assertSmallBody(c.req);
        const { lang, voice } = PreviewQuerySchema.parse(Object.fromEntries(c.url.searchParams));
        requireSpeech(speech, 'synthesize');
        const started = Date.now();
        try {
          const spoken = await previewVoice(speech, { language: lang, voice }, c.signal);
          log.info('speech.previewed', {
            requestId: c.requestId,
            provider: speech.kind,
            voice,
            bytes: spoken.audio.length,
            ms: Date.now() - started,
          });
          return spokenReply(spoken);
        } catch (error) {
          speechFailed(c, 'preview', started, error);
          throw error;
        }
      },
      { limit: 'speech' },
    ),
  ];

  if (hooks.enabled) {
    routes.push(
      route('POST', '/api/test/fail-next', async (c) => {
        const body = z
          .object({
            target: z.enum(FAILURE_TARGETS),
            count: z.number().int().min(0).max(5).default(1),
          })
          .parse(await c.body());
        hooks.setNext(body.target, body.count);
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
    // Logged for a request that fails before a route matches. The raw path is never used: it can
    // hold a whole session id.
    let routeLabel = 'unmatched';

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
        try {
          r.keys.forEach((key, i) => (params[key] = decodeURIComponent(m[i + 1] as string)));
        } catch {
          // A malformed percent-escape cannot name anything.
          throw new AppError(404, 'not_found', 'That endpoint does not exist.');
        }
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
      // Speech reaches a metered service, and a caller without a cookie always has a fresh
      // per-profile allowance, so every speech request also counts against one server-wide bucket.
      if (matched.route.limit === 'speech') limiter.take('all', 'speech-all');

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
        requestId,
        signal: controller.signal,
        body: () => (cached ??= readJsonBody(req)),
      });
      if (isBinaryReply(result)) {
        status = result.status;
        sendBinary(res, result);
      } else {
        status = matched.route.status ?? 200;
        sendJson(res, status, result);
      }
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
