import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

// A local stand-in for the Azure AI Speech REST endpoints, for tests only. It answers both the
// short-audio speech-to-text endpoint and the text-to-speech endpoint, in the regional layout
// (/speech/recognition/... and /cognitiveservices/v1) and in the custom-domain layout (the same
// paths under /stt and /tts). It checks requests the way the real service does, records every one,
// and answers from a script so tests can see exactly what Firefly sends and how it copes with slow,
// failing or malformed answers. It also treats profanity as the documentation says each `profanity`
// value does (masked by default), with a few mild words standing in for the service's own lists.
// Nothing here talks to a real service.

export interface RecordedRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  search: string; // the query string as received, without the leading "?"
  headers: Record<string, string>; // lower-case names
  body: Buffer; // the WAV file or the SSML document, exactly as received
  text: string; // the body as UTF-8 (readable for SSML)
  service: 'stt' | 'tts' | 'unknown';
}

export type RecognitionStatus =
  'Success' | 'NoMatch' | 'InitialSilenceTimeout' | 'BabbleTimeout' | 'Error';

export type Step =
  | { recognition: RecognitionStatus; text?: string; delayMs?: number }
  | { audio: Buffer | true; delayMs?: number } // 200 with audio (true: a short silent mp3)
  | {
      status: number;
      json?: unknown;
      text?: string;
      body?: Buffer;
      headers?: Record<string, string>;
      delayMs?: number;
    }
  | { drop: true } // close the connection without answering
  | { hang: true }; // never answer

export type Responder = (request: RecordedRequest) => Step | undefined;

export interface FakeAzureSpeech {
  readonly origin: string;
  /** The key the fake accepts. Any other key is answered with 401, as the real service does. */
  readonly key: string;
  /** The regional layout, for a configuration with a region. */
  readonly sttUrl: string;
  readonly ttsUrl: string;
  /** The custom-domain layout, for a configuration with an endpoint. */
  readonly customBase: string;
  readonly requests: RecordedRequest[];
  /** Scripted answers, used in order, one per valid request. */
  enqueue(...steps: Step[]): void;
  /** Answers every valid request once the queue is empty. Return undefined to answer normally. */
  respondWith(responder: Responder): void;
  /** Forgets recorded requests and scripted answers. */
  reset(): void;
  close(): Promise<void>;
}

export const FAKE_AZURE_KEY = 'test-speech-key-0123';
export const FAKE_RECOGNISED_TEXT = 'Hello, this is the fake recogniser.';
/** What the real service says to a wrong key. Tests use it to prove Firefly never repeats it. */
export const FAKE_PROVIDER_ERROR_TEXT =
  'Access denied due to invalid subscription key or wrong API endpoint. Make sure to provide a valid key for an active subscription and use a correct regional API endpoint for your resource.';

const OUTPUT_FORMATS = new Set([
  'audio-16khz-32kbitrate-mono-mp3',
  'audio-16khz-64kbitrate-mono-mp3',
  'audio-16khz-128kbitrate-mono-mp3',
  'audio-24khz-48kbitrate-mono-mp3',
  'audio-24khz-96kbitrate-mono-mp3',
  'audio-24khz-160kbitrate-mono-mp3',
  'audio-48khz-96kbitrate-mono-mp3',
  'audio-48khz-192kbitrate-mono-mp3',
  'riff-24khz-16bit-mono-pcm',
  'ogg-24khz-16bit-mono-opus',
]);

/** A short stretch of silent mono mp3 (24 kHz, 48 kbit/s): about 24 ms per frame. */
export function fakeMp3(frames = 20): Buffer {
  const frame = Buffer.alloc(144);
  frame.set([0xff, 0xf3, 0x64, 0xc4]);
  return Buffer.concat([
    Buffer.from('ID3\u0004\u0000\u0000\u0000\u0000\u0000\u0000', 'latin1'),
    ...Array<Buffer>(frames).fill(frame),
  ]);
}

const recognitionBody = (status: RecognitionStatus, text: string) =>
  JSON.stringify(
    status === 'Success'
      ? { RecognitionStatus: status, DisplayText: text, Offset: 1_000_000, Duration: 25_000_000 }
      : { RecognitionStatus: status },
  );

const PROFANITY_MODES: readonly string[] = ['masked', 'removed', 'raw'];
const MILD_PROFANITY = /\b(?:damn|bloody|crap)\b/gi;

/**
 * What the `profanity` option does to a transcript: `masked` (the default when the option is absent)
 * replaces profanity with asterisks, `removed` deletes it and `raw` keeps it as spoken.
 */
export function applyProfanity(text: string, mode: string | undefined): string {
  if (mode === 'raw') return text;
  if (mode === 'removed')
    return text
      .replace(MILD_PROFANITY, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  return text.replace(MILD_PROFANITY, (word) => `${word[0]}${'*'.repeat(word.length - 1)}`);
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const serviceOf = (path: string): RecordedRequest['service'] => {
  if (path.endsWith('/speech/recognition/conversation/cognitiveservices/v1')) return 'stt';
  if (path.endsWith('/cognitiveservices/v1')) return 'tts';
  return 'unknown';
};

const rejectKey = (): Step => ({
  status: 401,
  json: { error: { code: '401', message: FAKE_PROVIDER_ERROR_TEXT } },
});
const badRequest = (message: string): Step => ({ status: 400, text: message });

/** What the real service would refuse, or undefined when the request is acceptable. */
function refusal(request: RecordedRequest, key: string): Step | undefined {
  const { headers, query } = request;
  if (request.service === 'unknown') return { status: 404, text: 'Not found' };
  if (request.method !== 'POST') return { status: 405, text: 'Method not allowed' };
  if (headers['ocp-apim-subscription-key'] !== key) return rejectKey();

  if (request.service === 'stt') {
    if (!/^[a-z]{2,3}-[A-Z]{2}$/.test(query.language ?? '')) {
      return badRequest('The language code is missing or not supported.');
    }
    if (query.format !== undefined && !['simple', 'detailed'].includes(query.format)) {
      return badRequest('The format is not valid.');
    }
    if (query.profanity !== undefined && !PROFANITY_MODES.includes(query.profanity)) {
      return badRequest('The profanity option is not valid.');
    }
    if (headers['content-type'] !== 'audio/wav; codecs=audio/pcm; samplerate=16000') {
      return { status: 415, text: 'Unsupported media type' };
    }
    if (request.body.toString('latin1', 0, 4) !== 'RIFF') return badRequest('Invalid audio.');
    return undefined;
  }

  if (headers['content-type'] !== 'application/ssml+xml') {
    return { status: 415, text: 'Unsupported media type' };
  }
  if (!OUTPUT_FORMATS.has(headers['x-microsoft-outputformat'] ?? '')) {
    return badRequest('The output format is missing or not supported.');
  }
  const agent = headers['user-agent'] ?? '';
  if (agent === '' || agent.length >= 255)
    return badRequest('The user agent is missing or too long.');
  if (!/^<speak\b[^>]*\bxml:lang="[^"]+"[^>]*><voice name="[^"]+">/.test(request.text)) {
    return badRequest('The SSML is not valid.');
  }
  return undefined;
}

export async function startFakeAzureSpeech(
  options: { key?: string; recognisedText?: string } = {},
): Promise<FakeAzureSpeech> {
  const key = options.key ?? FAKE_AZURE_KEY;
  const recognisedText = options.recognisedText ?? FAKE_RECOGNISED_TEXT;
  const requests: RecordedRequest[] = [];
  const queue: Step[] = [];
  const timers = new Set<NodeJS.Timeout>();
  let responder: Responder | null = null;

  const write = (
    res: ServerResponse,
    status: number,
    body: Buffer | string,
    headers: Record<string, string> = {},
  ) => {
    res.writeHead(status, headers);
    res.end(body);
  };

  const play = (res: ServerResponse, step: Step, request?: RecordedRequest) => {
    if ('drop' in step) {
      res.socket?.destroy();
      return;
    }
    if ('hang' in step) return;
    const answer = () => {
      if ('recognition' in step) {
        const said = applyProfanity(step.text ?? recognisedText, request?.query.profanity);
        write(res, 200, recognitionBody(step.recognition, said), {
          'content-type': 'application/json; charset=utf-8',
        });
      } else if ('audio' in step) {
        write(res, 200, step.audio === true ? fakeMp3() : step.audio, {
          'content-type': 'audio/mpeg',
        });
      } else if (step.body !== undefined) {
        write(res, step.status, step.body, step.headers);
      } else {
        write(res, step.status, step.text ?? JSON.stringify(step.json ?? {}), {
          'content-type': step.text !== undefined ? 'text/plain' : 'application/json',
          ...step.headers,
        });
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
    void readBody(req).then((body) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const headers: Record<string, string> = {};
      for (const [name, value] of Object.entries(req.headers)) {
        headers[name] = Array.isArray(value) ? value.join(', ') : (value ?? '');
      }
      const request: RecordedRequest = {
        method: req.method ?? 'GET',
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
        search: url.search.replace(/^\?/, ''),
        headers,
        body,
        text: body.toString('utf8'),
        service: serviceOf(url.pathname),
      };
      requests.push(request);

      const refused = refusal(request, key);
      if (refused) {
        play(res, refused);
        return;
      }
      const scripted = queue.shift() ?? responder?.(request);
      if (scripted) {
        play(res, scripted, request);
        return;
      }
      play(
        res,
        request.service === 'stt'
          ? { recognition: 'Success', text: recognisedText }
          : { audio: true },
        request,
      );
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    origin,
    key,
    sttUrl: `${origin}/speech/recognition/conversation/cognitiveservices/v1`,
    ttsUrl: `${origin}/cognitiveservices/v1`,
    customBase: origin,
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
