import { randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AppError } from '../errors.ts';

// Security helpers for the HTTP layer: headers, cookie-based anonymous profile, same-origin checks,
// body parsing and rate limiting. Firefly has no sign-in; the profile cookie only separates the
// practice data of different browsers on a shared machine.

export const PROFILE_COOKIE = 'firefly_profile';
const PROFILE_PATTERN = /^[a-f0-9]{32}$/;

export function securityHeaders(res: ServerResponse, isApi: boolean): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  // The microphone is allowed for Firefly's own pages only. Browser speech recognition (Voice, Beta)
  // is refused with `not-allowed` when the policy is `microphone=()`, so it cannot be shut off here.
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=(), payment=()');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  );
  if (isApi) res.setHeader('Cache-Control', 'no-store');
}

export function readCookie(req: IncomingMessage, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

/** Returns the caller's profile id, issuing a new cookie the first time. */
export function resolveProfile(req: IncomingMessage, res: ServerResponse): string {
  const existing = readCookie(req, PROFILE_COOKIE);
  if (existing && PROFILE_PATTERN.test(existing)) return existing;
  const id = randomBytes(16).toString('hex');
  const secure =
    (req.socket as { encrypted?: boolean }).encrypted === true ||
    req.headers['x-forwarded-proto'] === 'https';
  res.setHeader(
    'Set-Cookie',
    `${PROFILE_COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure ? '; Secure' : ''}`,
  );
  return id;
}

/** Browsers send Origin on cross-site writes; it must match the Host the request was sent to. */
export function assertSameOrigin(req: IncomingMessage): void {
  const method = req.method ?? 'GET';
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin !== 'null') {
    let host: string;
    try {
      host = new URL(origin).host;
    } catch {
      throw new AppError(403, 'forbidden', 'Cross-site requests are not allowed.');
    }
    if (host !== req.headers.host) {
      throw new AppError(403, 'forbidden', 'Cross-site requests are not allowed.');
    }
  } else if (origin === 'null') {
    throw new AppError(403, 'forbidden', 'Cross-site requests are not allowed.');
  }
}

export async function readJsonBody(req: IncomingMessage, maxBytes = 64 * 1024): Promise<unknown> {
  const type = req.headers['content-type'] ?? '';
  const length = Number(req.headers['content-length'] ?? 0);
  if (length === 0 && !req.headers['transfer-encoding']) return {};
  if (!/^application\/json\b/i.test(type)) {
    throw new AppError(415, 'bad_request', 'Send the request body as application/json.');
  }
  if (length > maxBytes) throw new AppError(413, 'payload_too_large', 'That request is too large.');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    size += buf.length;
    if (size > maxBytes) throw new AppError(413, 'payload_too_large', 'That request is too large.');
    chunks.push(buf);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (text.trim() === '') return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AppError(400, 'bad_request', 'The request body is not valid JSON.');
  }
}

// ---- rate limiting -------------------------------------------------------------------------

export interface BucketSpec {
  capacity: number;
  refillPerSecond: number;
}

export type RateLimitName = 'api' | 'create' | 'message' | 'end';

export const RATE_LIMITS: Record<RateLimitName, BucketSpec> = {
  api: { capacity: 240, refillPerSecond: 4 },
  create: { capacity: 20, refillPerSecond: 20 / 60 },
  message: { capacity: 30, refillPerSecond: 30 / 60 },
  end: { capacity: 10, refillPerSecond: 10 / 60 },
};

export function createRateLimiter(now: () => number = Date.now, specs = RATE_LIMITS) {
  const buckets = new Map<string, { tokens: number; at: number }>();
  return {
    /** Throws a 429 AppError when the caller has used up the bucket. */
    take(key: string, name: RateLimitName): void {
      const spec = specs[name];
      const id = `${name}:${key}`;
      const t = now();
      const bucket = buckets.get(id) ?? { tokens: spec.capacity, at: t };
      bucket.tokens = Math.min(
        spec.capacity,
        bucket.tokens + ((t - bucket.at) / 1000) * spec.refillPerSecond,
      );
      bucket.at = t;
      if (bucket.tokens < 1) {
        buckets.set(id, bucket);
        throw new AppError(
          429,
          'rate_limited',
          'You are going a bit fast. Wait a moment and try again.',
          {
            retryable: true,
            details: { retryAfterSeconds: Math.ceil((1 - bucket.tokens) / spec.refillPerSecond) },
          },
        );
      }
      bucket.tokens -= 1;
      buckets.set(id, bucket);
      if (buckets.size > 5000) {
        for (const [k, b] of buckets) if (t - b.at > 600_000) buckets.delete(k);
      }
    },
  };
}
