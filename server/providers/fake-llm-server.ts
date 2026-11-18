import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

// A local stand-in for an OpenAI-compatible chat-completions server, for tests only. It records every
// request it receives and answers from a script, so tests can check exactly what Firefly sends and how
// it copes with slow, failing or malformed responses. Nothing here talks to a real service.

export interface ChatBody {
  model?: string;
  messages: { role: string; content: string }[];
  temperature?: number;
  max_tokens?: number;
  max_completion_tokens?: number;
  response_format?: { type: string };
  [key: string]: unknown;
}

export interface RecordedRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>; // lower-case names
  text: string; // the raw body
  body: ChatBody | null;
}

export type Step =
  | { reply: string; finishReason?: string; delayMs?: number }
  | {
      status: number;
      json?: unknown;
      text?: string;
      headers?: Record<string, string>;
      delayMs?: number;
    }
  | { drop: true } // close the connection without answering
  | { hang: true }; // never answer

export type Responder = (request: RecordedRequest) => Step;

export interface FakeLlm {
  /** For the Azure endpoint setting: http://127.0.0.1:port */
  readonly origin: string;
  /** For the OpenAI-compatible base URL setting: http://127.0.0.1:port/v1 */
  readonly baseUrl: string;
  readonly requests: RecordedRequest[];
  /** Scripted answers, used in order, one per request. */
  enqueue(...steps: Step[]): void;
  /** Answers every request once the queue is empty. */
  respondWith(responder: Responder): void;
  /** Forgets recorded requests and scripted answers. */
  reset(): void;
  close(): Promise<void>;
}

export const rejection = (
  message: string,
  param: string | null = null,
  code = 'unsupported_parameter',
) =>
  ({
    status: 400,
    json: { error: { message, type: 'invalid_request_error', param, code } },
  }) satisfies Step;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function parseBody(text: string): ChatBody | null {
  try {
    return JSON.parse(text) as ChatBody;
  } catch {
    return null;
  }
}

function envelope(content: string, finishReason: string) {
  return {
    id: 'chatcmpl-fake',
    object: 'chat.completion',
    created: 0,
    model: 'fake-model',
    choices: [{ index: 0, finish_reason: finishReason, message: { role: 'assistant', content } }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  };
}

export async function startFakeLlm(): Promise<FakeLlm> {
  const requests: RecordedRequest[] = [];
  const queue: Step[] = [];
  const timers = new Set<NodeJS.Timeout>();
  let responder: Responder | null = null;

  const write = (res: ServerResponse, status: number, body: string, headers = {}) => {
    res.writeHead(status, { 'content-type': 'application/json', ...headers });
    res.end(body);
  };

  const play = (res: ServerResponse, step: Step) => {
    if ('drop' in step) {
      res.socket?.destroy();
      return;
    }
    if ('hang' in step) return;
    const answer = () => {
      if ('reply' in step) {
        write(res, 200, JSON.stringify(envelope(step.reply, step.finishReason ?? 'stop')));
      } else {
        write(res, step.status, step.text ?? JSON.stringify(step.json ?? {}), step.headers);
      }
    };
    if (!step.delayMs) {
      answer();
      return;
    }
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (!res.destroyed) answer();
    }, step.delayMs);
    timers.add(timer);
    res.on('close', () => {
      clearTimeout(timer);
      timers.delete(timer);
    });
  };

  const server = createServer((req, res) => {
    void readBody(req).then((text) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const headers: Record<string, string> = {};
      for (const [name, value] of Object.entries(req.headers)) {
        headers[name] = Array.isArray(value) ? value.join(', ') : (value ?? '');
      }
      const request: RecordedRequest = {
        method: req.method ?? 'GET',
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
        headers,
        text,
        body: parseBody(text),
      };
      requests.push(request);
      if (!url.pathname.endsWith('/chat/completions')) {
        play(res, { status: 404, json: { error: { message: 'not found' } } });
        return;
      }
      // 418 is deliberately not retryable, so an unscripted request fails loudly instead of looping.
      play(
        res,
        queue.shift() ??
          responder?.(request) ?? {
            status: 418,
            json: { error: { message: 'unscripted request' } },
          },
      );
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    origin,
    baseUrl: `${origin}/v1`,
    requests,
    enqueue: (...steps) => void queue.push(...steps),
    respondWith: (next) => {
      responder = next;
    },
    reset: () => {
      requests.length = 0;
      queue.length = 0;
      responder = null;
    },
    close: () => {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      server.closeAllConnections();
      return new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
