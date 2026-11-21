import { z } from 'zod';
import { MAX_MESSAGE_CHARS } from '#shared/domain/text.ts';
import {
  NOTHING_TO_SPEAK_MESSAGE,
  SPEECH_LIMITS,
  SpeechError,
  type SpeechConfig,
  type SpeechProvider,
  type SynthesizeRequest,
  type SynthesizeResult,
  type TranscribeRequest,
  type TranscribeResult,
} from './types.ts';
import {
  cleanText,
  describeVoices,
  moodStylesAvailable,
  planSpeech,
  voiceOptions,
} from './voices.ts';

// Azure AI Speech over its REST APIs: short-audio speech to text and text to speech.
//
// Safety rules for this file: every thrown message is a fixed sentence. Errors never contain the
// key, the address, the provider's own wording, request or response bodies, audio, or any line of
// the conversation. Response bodies are read only for the fields named below. Nothing is logged.
// Redirects are never followed, so the key cannot be forwarded to another host. Recognition asks
// for the plain `simple` result only: no pronunciation assessment, no scores, nothing about how the
// trainee sounds. Firefly never asks the service to keep audio or transcripts.

export type AzureSpeechConfig = Extract<SpeechConfig, { kind: 'azure-speech' }>;

export type Sleep = (ms: number, signal?: AbortSignal) => Promise<void>;

export interface AzureSpeechOptions {
  /** Replaces the real wait before the one retry (tests). */
  sleep?: Sleep;
  /** Shown as the notice in the capabilities, for a configuration that works but was adjusted. */
  notice?: string | null;
  /**
   * The audio format asked of text to speech. Calls always use the one mp3 format; only the live
   * smoke test asks for WAV, because speech to text cannot read an mp3.
   */
  outputFormat?: AzureOutputFormat;
}

export const AZURE_SPEECH_LABEL = 'Azure AI Speech';
/** The one audio format asked for: mono mp3 at 24 kHz, 48 kbit/s, which every browser plays. */
export const AZURE_OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';
/** The format of a recording as speech to text accepts it: used to bring a spoken line back as text in the smoke test. */
export const AZURE_WAV_OUTPUT_FORMAT = 'riff-16khz-16bit-mono-pcm';
export type AzureOutputFormat = typeof AZURE_OUTPUT_FORMAT | typeof AZURE_WAV_OUTPUT_FORMAT;
export const AZURE_STT_CONTENT_TYPE = 'audio/wav; codecs=audio/pcm; samplerate=16000';
const USER_AGENT = 'Firefly';

/** Longest wait honoured from a Retry-After header. */
export const MAX_RETRY_AFTER_MS = 2000;
const BACKOFF_MS = 300;
/** Requests that fail with 429, a server error or a network error are tried once more, no more. */
const MAX_RETRIES = 1;
const MAX_RECOGNITION_RESPONSE_BYTES = 64 * 1024;
const MAX_AUDIO_RESPONSE_BYTES = 8 * 1024 * 1024;
const MIN_AUDIO_RESPONSE_BYTES = 32;

export const SPEECH_MESSAGES = {
  notConfigured:
    'Speech is not configured correctly on this server, so spoken calls are unavailable. Ask whoever runs Firefly to check the speech settings.',
  rateLimited: 'The speech service is busy right now. Please try again in a moment.',
  timeout: 'The speech service took too long to respond. Please try again.',
  failed: 'The speech service could not complete that request. Please try again.',
  unreachable: 'Could not reach the speech service. Please try again in a moment.',
  rejected: 'The speech service did not accept that request.',
  badOutput: 'The speech service returned something Firefly could not use. Please try again.',
  nothingToSpeak: NOTHING_TO_SPEAK_MESSAGE,
} as const;

const abortError = () => new DOMException('The request was cancelled.', 'AbortError');
const badOutput = () => new SpeechError('speech_failed', SPEECH_MESSAGES.badOutput, true);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// ---------------------------------------------------------------------------------------
// One HTTP exchange

type Exchange =
  | { kind: 'response'; status: number; body: Buffer; retryAfterMs: number | null }
  | { kind: 'oversize' }
  | { kind: 'timeout' }
  | { kind: 'network'; code: string | null };

function retryAfter(headers: Headers): number | null {
  const value = headers.get('retry-after');
  if (value === null || value.trim() === '') return null;
  if (Number.isFinite(Number(value))) return Math.max(0, Number(value)) * 1000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

// A short, safe description of a network failure: its code (for example ECONNREFUSED), nothing else.
function networkCode(error: unknown): string | null {
  const source = isRecord(error) && isRecord(error.cause) ? error.cause : error;
  return isRecord(source) && typeof source.code === 'string' ? source.code : null;
}

/** Gives up on the rest of a response, whatever state its stream is in. */
const drop = (stream: { cancel(): Promise<void> } | null | undefined): Promise<void> =>
  stream ? stream.cancel().catch(() => undefined) : Promise.resolve();

/** The whole body, or null when it is larger than `max`. */
async function readCapped(response: Response, max: number): Promise<Buffer | null> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > max) {
    await drop(response.body);
    return null;
  }
  const reader = response.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return Buffer.concat(chunks);
    size += value.byteLength;
    if (size > max) {
      await drop(reader);
      return null;
    }
    chunks.push(value);
  }
}

interface Outgoing {
  url: string;
  headers: Record<string, string>;
  body: string | Uint8Array<ArrayBuffer>;
  maxResponseBytes: number;
}

async function exchange(
  out: Outgoing,
  signal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<Exchange> {
  const timeout = AbortSignal.timeout(timeoutMs);
  try {
    const response = await fetch(out.url, {
      method: 'POST',
      headers: out.headers,
      body: out.body,
      redirect: 'manual',
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    const ok = response.status >= 200 && response.status < 300;
    if (!ok) {
      // The body of a failure is never used, so it is dropped unread.
      await drop(response.body);
      return {
        kind: 'response',
        status: response.status,
        body: Buffer.alloc(0),
        retryAfterMs: retryAfter(response.headers),
      };
    }
    const body = await readCapped(response, out.maxResponseBytes);
    return body === null
      ? { kind: 'oversize' }
      : { kind: 'response', status: response.status, body, retryAfterMs: null };
  } catch (error) {
    if (signal?.aborted) throw abortError();
    if (timeout.aborted) return { kind: 'timeout' };
    return { kind: 'network', code: networkCode(error) };
  }
}

const defaultSleep: Sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });

/** How long to wait before the retry, or null when the failure is not worth retrying. */
function retryDelay(result: Exchange): number | null {
  if (result.kind === 'network') return BACKOFF_MS;
  if (result.kind !== 'response') return null;
  if (result.status !== 429 && result.status < 500) return null;
  return result.retryAfterMs === null
    ? BACKOFF_MS
    : Math.min(MAX_RETRY_AFTER_MS, result.retryAfterMs);
}

/** The failure for an exchange that did not succeed. */
function failureFor(result: Exchange): SpeechError {
  if (result.kind === 'timeout') {
    return new SpeechError('speech_timeout', SPEECH_MESSAGES.timeout, true);
  }
  if (result.kind === 'oversize') return badOutput();
  if (result.kind === 'network') {
    return new SpeechError(
      'speech_failed',
      SPEECH_MESSAGES.unreachable,
      true,
      result.code ? new Error(result.code) : undefined,
    );
  }
  const { status } = result;
  // A rejected key, a wrong address or a redirect all mean the settings are wrong, and trying again will not help.
  if (status === 401 || status === 403 || status === 404 || (status >= 300 && status < 400)) {
    return new SpeechError('speech_unavailable', SPEECH_MESSAGES.notConfigured, false);
  }
  if (status === 408) return new SpeechError('speech_timeout', SPEECH_MESSAGES.timeout, true);
  if (status === 429) {
    return new SpeechError('speech_rate_limited', SPEECH_MESSAGES.rateLimited, true);
  }
  if (status >= 500) return new SpeechError('speech_failed', SPEECH_MESSAGES.failed, true);
  return new SpeechError('speech_failed', SPEECH_MESSAGES.rejected, false);
}

// ---------------------------------------------------------------------------------------
// Reading what came back

// The fields of a `simple` short-audio result that are used. Anything else is ignored.
const RecognitionSchema = z.object({
  RecognitionStatus: z.enum([
    'Success',
    'NoMatch',
    'InitialSilenceTimeout',
    'BabbleTimeout',
    'Error',
  ]),
  DisplayText: z.string().optional(),
});

function readRecognition(body: Buffer, durationMs: number): TranscribeResult {
  let json: unknown;
  try {
    json = JSON.parse(body.toString('utf8'));
  } catch {
    throw badOutput();
  }
  const parsed = RecognitionSchema.safeParse(json);
  if (!parsed.success) throw badOutput();
  const { RecognitionStatus: status, DisplayText } = parsed.data;
  if (status === 'Error') throw new SpeechError('speech_failed', SPEECH_MESSAGES.failed, true);
  // Silence, noise, or speech in another language: nothing the trainee said can be used.
  const text = status === 'Success' ? cleanText(DisplayText ?? '').slice(0, MAX_MESSAGE_CHARS) : '';
  return text === ''
    ? { status: 'no-speech', text: '', durationMs }
    : { status: 'recognised', text, durationMs };
}

/** Audio never starts with the first character of a JSON, XML or HTML error page. */
function looksLikeAudio(body: Buffer): boolean {
  if (body.length < MIN_AUDIO_RESPONSE_BYTES) return false;
  const first = body.toString('latin1', 0, 16).trimStart()[0];
  return first !== '{' && first !== '[' && first !== '<';
}

// ---------------------------------------------------------------------------------------

export function createAzureSpeechProvider(
  config: AzureSpeechConfig,
  options: AzureSpeechOptions = {},
): SpeechProvider {
  const sleep = options.sleep ?? defaultSleep;
  const notice = options.notice ?? null;
  const outputFormat = options.outputFormat ?? AZURE_OUTPUT_FORMAT;

  async function perform(out: Outgoing, signal?: AbortSignal): Promise<Buffer> {
    for (let retries = 0; ; retries++) {
      if (signal?.aborted) throw abortError();
      const result = await exchange(out, signal, config.timeoutMs);
      if (result.kind === 'response' && result.status >= 200 && result.status < 300) {
        return result.body;
      }
      const wait = retries < MAX_RETRIES ? retryDelay(result) : null;
      if (wait === null) throw failureFor(result);
      await sleep(wait, signal);
    }
  }

  return {
    kind: 'azure-speech',
    label: AZURE_SPEECH_LABEL,
    demo: false,
    capabilities: () => ({
      provider: 'azure-speech',
      label: AZURE_SPEECH_LABEL,
      demo: false,
      transcribe: true,
      synthesize: true,
      expressiveStyles: moodStylesAvailable(config.voices),
      notice,
      voices: describeVoices(voiceOptions),
      limits: SPEECH_LIMITS,
    }),
    // The four neutral choices are fixed by the catalogue: an administrator's own voice names
    // replace the pairing used when no choice is made, and never a voice the trainee picked.
    listVoices: voiceOptions,

    async transcribe(request: TranscribeRequest, signal?: AbortSignal): Promise<TranscribeResult> {
      // Profanity is kept as spoken (`raw`; the default `masked` would turn it into asterisks and
      // `removed` would delete it), because the report quotes the transcript as evidence.
      const url = new URL(config.sttUrl);
      url.searchParams.set('language', request.language);
      url.searchParams.set('format', 'simple');
      url.searchParams.set('profanity', 'raw');
      const audio = request.audio;
      const body = await perform(
        {
          url: url.toString(),
          headers: {
            'Ocp-Apim-Subscription-Key': config.apiKey,
            'Content-Type': AZURE_STT_CONTENT_TYPE,
            Accept: 'application/json',
            'User-Agent': USER_AGENT,
          },
          body: new Uint8Array(audio.buffer as ArrayBuffer, audio.byteOffset, audio.byteLength),
          maxResponseBytes: MAX_RECOGNITION_RESPONSE_BYTES,
        },
        signal,
      );
      return readRecognition(body, request.durationMs);
    },

    async synthesize(request: SynthesizeRequest, signal?: AbortSignal): Promise<SynthesizeResult> {
      const plan = planSpeech(request.text, request.direction, config.voices);
      if (plan.text === '') {
        throw new SpeechError('speech_failed', SPEECH_MESSAGES.nothingToSpeak, false);
      }
      const audio = await perform(
        {
          url: config.ttsUrl,
          headers: {
            'Ocp-Apim-Subscription-Key': config.apiKey,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': outputFormat,
            'User-Agent': USER_AGENT,
          },
          body: plan.ssml,
          maxResponseBytes: MAX_AUDIO_RESPONSE_BYTES,
        },
        signal,
      );
      if (!looksLikeAudio(audio)) throw badOutput();
      return {
        audio,
        contentType: outputFormat === AZURE_WAV_OUTPUT_FORMAT ? 'audio/wav' : 'audio/mpeg',
        voice: plan.voice,
        style: plan.style,
        ...(plan.voiceId ? { voiceId: plan.voiceId } : {}),
      };
    },
  };
}
