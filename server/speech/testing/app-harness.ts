import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { TemperatureBandId } from '#shared/domain/vocab.ts';
import type { AppConfig } from '../../config.ts';
import type { Repository } from '../../db/repository.ts';
import { badRequest, notFound } from '../../errors.ts';
import { createFailureHooks, type FailureHooks } from '../../hooks.ts';
import { createApp } from '../../http/app.ts';
import { silentLogger, type Logger } from '../../log.ts';
import type { ModelProvider } from '../../providers/types.ts';
import type { SessionService } from '../../services/sessions.ts';
import { createNoneSpeechProvider } from '../index.ts';
import type { SpeechProvider } from '../types.ts';
import type { Speaker } from '../voices.ts';

// The real HTTP app with the speech routes, on an ephemeral port, in front of in-memory stand-ins for
// the other two things the app is built from: the session service (the speech routes ask it for one
// thing only, the stored words of a customer turn) and the customer-response model (never used by a
// speech route). It holds no scenario and no model, so these tests depend on neither the scenario
// library and its schema nor the simulation engine's mock.

/** The third port, as a stand-in that fails loudly if anything ever asks it for a reply. */
const unusedModel: ModelProvider = {
  kind: 'mock',
  label: 'Unused test model',
  demo: true,
  prompts: { customer: 'test', classifier: 'test', evaluator: 'test' },
  classifyTurn: () => Promise.reject(new Error('A speech test asked the model to classify.')),
  generateCustomer: () => Promise.reject(new Error('A speech test asked the model for a reply.')),
};

export interface FakeTurn {
  index: number;
  role: 'customer' | 'trainee';
  text: string;
  /** How hot the customer was when they said it (customer turns). */
  mood?: TemperatureBandId;
  /** The customer was cooling down when they said it. */
  recovering?: boolean;
}

export interface FakeCall {
  id: string;
  profileId: string;
  /** The persona's old speaker pairing, used when no voice is chosen. */
  speaker: Speaker;
  turns: FakeTurn[];
}

export interface NewFakeCall {
  speaker?: Speaker;
  turns?: FakeTurn[];
  opening?: string;
  mood?: TemperatureBandId;
}

/** The part of the session service the speech routes use, with the same answers for the same mistakes. */
export class FakeCalls {
  private readonly calls = new Map<string, FakeCall>();
  private counter = 0;

  add(profileId: string, options: NewFakeCall = {}): FakeCall {
    const call: FakeCall = {
      id: `call-${String(++this.counter).padStart(8, '0')}`,
      profileId,
      speaker: options.speaker ?? 'female',
      turns: options.turns ?? [
        {
          index: 1,
          role: 'customer',
          text: options.opening ?? 'Hello, I cannot sign in to my account and I need it today.',
          mood: options.mood ?? 'calm',
        },
      ],
    };
    this.calls.set(call.id, call);
    return call;
  }

  get(id: string): FakeCall {
    const call = this.calls.get(id);
    if (!call) throw new Error(`No fake call ${id}.`);
    return call;
  }

  /** Answers as `SessionService.getSpeakableTurn` does. */
  getSpeakableTurn(profileId: string, sessionId: string, turnIndex: number) {
    const call = this.calls.get(sessionId);
    if (!call || call.profileId !== profileId) throw notFound('That session');
    const turn = call.turns.find((candidate) => candidate.index === turnIndex);
    if (!turn) throw notFound('That turn');
    if (turn.role !== 'customer') throw badRequest("Only the customer's turns can be spoken.");
    return {
      text: turn.text,
      speaker: call.speaker,
      mood: turn.mood ?? ('calm' as TemperatureBandId),
      recovering: turn.recovering === true,
    };
  }
}

export interface SpeechTestResponse {
  status: number;
  headers: Headers;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
}

export interface SpeechTestClient {
  /** The browser profile this client is (its cookie), so a call can be given to it. */
  profileId(): Promise<string>;
  get(path: string): Promise<SpeechTestResponse>;
  post(path: string, body?: unknown, headers?: Record<string, string>): Promise<SpeechTestResponse>;
  raw(path: string, init?: RequestInit): Promise<Response>;
}

export interface SpeechTestApp {
  baseUrl: string;
  hooks: FailureHooks;
  calls: FakeCalls;
  client(): SpeechTestClient;
  /** A call owned by this client's profile. */
  startCall(
    client: SpeechTestClient,
    options?: NewFakeCall,
  ): Promise<{ id: string; opening: string }>;
  close(): Promise<void>;
}

export async function createSpeechTestApp(
  options: { speech?: SpeechProvider; testHooks?: boolean; log?: Logger } = {},
): Promise<SpeechTestApp> {
  const speech = options.speech ?? createNoneSpeechProvider();
  const hooks = createFailureHooks(options.testHooks ?? true);
  const log = options.log ?? silentLogger;
  const provider = unusedModel;
  const calls = new FakeCalls();
  const config: AppConfig = {
    port: 0,
    host: '127.0.0.1',
    dbPath: ':memory:',
    webDir: '/nonexistent-web-dir',
    version: 'test',
    logLevel: 'silent',
    devDiagnostics: false,
    testHooks: options.testHooks ?? true,
    provider: { config: { kind: 'mock', mockDelayMs: 0 }, problem: null },
    speech: { config: { kind: 'none' }, problem: null },
  };
  const app = createApp({
    config,
    // Only the one method the speech routes call is real; the rest is never reached.
    service: calls as unknown as SessionService,
    provider,
    speech,
    repo: {} as Repository,
    hooks,
    log,
  });
  const server: Server = createServer((req, res) => {
    void app.handler(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const client = (): SpeechTestClient => {
    let cookie = '';
    const raw = async (path: string, init: RequestInit = {}): Promise<Response> => {
      const headers = new Headers(init.headers);
      if (cookie) headers.set('cookie', cookie);
      const res = await fetch(baseUrl + path, { ...init, headers });
      const set = res.headers.get('set-cookie');
      if (set) cookie = set.split(';')[0] as string;
      return res;
    };
    const parse = async (res: Response): Promise<SpeechTestResponse> => {
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
      async profileId() {
        if (!cookie) await raw('/api/health');
        return /firefly_profile=([a-f0-9]{32})/.exec(cookie)?.[1] ?? '';
      },
      get: async (path) => parse(await raw(path)),
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
    hooks,
    calls,
    client,
    async startCall(owner, callOptions) {
      const call = calls.add(await owner.profileId(), callOptions);
      return { id: call.id, opening: call.turns[0]?.text ?? '' };
    },
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
