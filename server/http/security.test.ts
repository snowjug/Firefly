import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { AppError } from '../errors.ts';
import { createRateLimiter, RATE_LIMITS, readAudioBody, securityHeaders } from './security.ts';

/** A request with these headers whose body arrives in these chunks. Nothing is read until asked. */
const upload = (chunks: Buffer[], headers: Record<string, string>) =>
  Object.assign(Readable.from(chunks), { headers }) as unknown as IncomingMessage & {
    readableDidRead: boolean;
  };

async function refusal(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    return error as AppError;
  }
  throw new Error('expected the upload to be refused');
}

describe('readAudioBody', () => {
  it('returns the bytes of a WAV upload, whichever way the type is written', async () => {
    for (const type of [
      'audio/wav',
      'audio/x-wav',
      'AUDIO/WAV',
      'audio/wav; codecs=audio/pcm; samplerate=16000',
    ]) {
      const req = upload([Buffer.from('ab'), Buffer.from('cd')], { 'content-type': type });
      expect((await readAudioBody(req, 100)).toString()).toBe('abcd');
    }
  });

  it('refuses any other media type, or none, with 415 and reads nothing', async () => {
    for (const type of [
      'application/json',
      'text/plain',
      'audio/mpeg',
      'audio/webm',
      'audio/wave',
      'multipart/form-data; boundary=x',
      '',
    ]) {
      const req = upload([Buffer.from('data')], type ? { 'content-type': type } : {});
      const error = await refusal(readAudioBody(req, 100));
      expect(error).toMatchObject({ status: 415, code: 'unsupported_media' });
      expect(req.readableDidRead, type).toBe(false);
    }
  });

  it('refuses an upload that says it is too large with 413 and reads nothing', async () => {
    const req = upload([Buffer.alloc(10)], {
      'content-type': 'audio/wav',
      'content-length': '101',
    });
    const error = await refusal(readAudioBody(req, 100));
    expect(error).toMatchObject({ status: 413, code: 'payload_too_large' });
    expect(req.readableDidRead).toBe(false);
  });

  it('accepts an upload of exactly the limit', async () => {
    const req = upload([Buffer.alloc(100)], {
      'content-type': 'audio/wav',
      'content-length': '100',
    });
    expect(await readAudioBody(req, 100)).toHaveLength(100);
  });

  it('stops an upload with no declared size once it passes the limit, however it is chunked', async () => {
    const small = Array.from({ length: 11 }, () => Buffer.alloc(10));
    const error = await refusal(readAudioBody(upload(small, { 'content-type': 'audio/wav' }), 100));
    expect(error).toMatchObject({ status: 413, code: 'payload_too_large' });

    const exact = Array.from({ length: 10 }, () => Buffer.alloc(10));
    expect(await readAudioBody(upload(exact, { 'content-type': 'audio/wav' }), 100)).toHaveLength(
      100,
    );
  });

  it('returns nothing for an empty upload, which the WAV check then refuses', async () => {
    expect(await readAudioBody(upload([], { 'content-type': 'audio/wav' }), 100)).toHaveLength(0);
  });
});

describe('securityHeaders', () => {
  const headersFor = (isApi: boolean) => {
    const headers = new Map<string, string>();
    securityHeaders(
      {
        setHeader: (name: string, value: string) => headers.set(name, value),
      } as unknown as ServerResponse,
      isApi,
    );
    return headers;
  };
  const policy = (isApi = true) =>
    Object.fromEntries(
      (headersFor(isApi).get('Content-Security-Policy') ?? '').split('; ').map((part) => {
        const [name, ...sources] = part.split(' ');
        return [name, sources];
      }),
    ) as Record<string, string[]>;

  it('lets audio play from the page itself and from blob URLs, and nowhere else', () => {
    expect(policy()['media-src']).toEqual(["'self'", 'blob:']);
    expect(policy(false)['media-src']).toEqual(["'self'", 'blob:']);
  });

  it('keeps everything else strict: no inline script or style, no outside sources, no framing', () => {
    expect(policy()).toMatchObject({
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'"],
      'img-src': ["'self'", 'data:'],
      'font-src': ["'self'"],
      'connect-src': ["'self'"],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
    });
    const text = headersFor(true).get('Content-Security-Policy') ?? '';
    expect(text).not.toMatch(/unsafe-inline|unsafe-eval|https?:|\*/);
  });

  it('lets only its own pages use the microphone', () => {
    const permissions = headersFor(true).get('Permissions-Policy') ?? '';
    expect(permissions).toContain('microphone=(self)');
    expect(permissions).toContain('camera=()');
    expect(permissions).toContain('geolocation=()');
    expect(permissions).toContain('payment=()');
  });
});

describe('the speech rate limit', () => {
  it('allows 60 requests at once and then one more every second, for each browser profile', () => {
    expect(RATE_LIMITS.speech).toEqual({ capacity: 60, refillPerSecond: 1 });
    let now = 1_000_000;
    const limiter = createRateLimiter(() => now);
    for (let i = 0; i < 60; i++) limiter.take('profile-a', 'speech');
    expect(() => limiter.take('profile-a', 'speech')).toThrowError(
      expect.objectContaining({ status: 429, code: 'rate_limited', retryable: true }),
    );
    // Another profile, and another kind of request, are not affected.
    expect(() => limiter.take('profile-b', 'speech')).not.toThrow();
    expect(() => limiter.take('profile-a', 'message')).not.toThrow();
    // One second later, one more request is allowed, and no more.
    now += 1000;
    expect(() => limiter.take('profile-a', 'speech')).not.toThrow();
    expect(() => limiter.take('profile-a', 'speech')).toThrowError(
      expect.objectContaining({ status: 429, details: { retryAfterSeconds: 1 } }),
    );
  });

  it('also keeps one server-wide allowance, which a flood of new profiles cannot refill', () => {
    expect(RATE_LIMITS['speech-all']).toEqual({ capacity: 120, refillPerSecond: 4 });
    const now = 1_000_000;
    const limiter = createRateLimiter(() => now);
    for (let i = 0; i < 120; i++) limiter.take('all', 'speech-all');
    expect(() => limiter.take('all', 'speech-all')).toThrowError(
      expect.objectContaining({ status: 429, code: 'rate_limited' }),
    );
    // Far more profiles than the limiter will hold: the server-wide bucket is not one of the
    // buckets that is forgotten, so it is still empty afterwards.
    for (let i = 0; i < 30_000; i++) limiter.take(`profile-${i}`, 'speech');
    expect(limiter.size()).toBeLessThanOrEqual(20_000);
    expect(() => limiter.take('all', 'speech-all')).toThrowError(
      expect.objectContaining({ status: 429 }),
    );
  });

  it('forgets buckets nobody has used for ten minutes, without rescanning on every request', () => {
    let now = 1_000_000;
    const limiter = createRateLimiter(() => now);
    for (let i = 0; i < 6_000; i++) limiter.take(`old-${i}`, 'api');
    expect(limiter.size()).toBe(6_000);
    now += 11 * 60_000;
    limiter.take('fresh', 'api');
    expect(limiter.size()).toBe(1);
  });
});

describe('an upload the other end gives up on', () => {
  /** A request body that fails part-way with the error Node gives a dropped connection. */
  const dropped = (code: string) => {
    const body = new Readable({
      read() {
        this.push(Buffer.from('abc'));
        this.destroy(Object.assign(new Error('aborted'), { code }));
      },
    });
    return Object.assign(body, {
      headers: { 'content-type': 'audio/wav', 'content-length': '200000' },
    }) as unknown as IncomingMessage;
  };

  it('is a cancelled request, not a server error', async () => {
    for (const code of ['ECONNRESET', 'ERR_STREAM_PREMATURE_CLOSE']) {
      await expect(readAudioBody(dropped(code), 1_000_000)).rejects.toMatchObject({
        name: 'AbortError',
      });
    }
  });
});
