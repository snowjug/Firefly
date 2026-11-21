import { describe, expect, it } from 'vitest';
import { ApiError } from '../../lib/api.ts';
import {
  classifyEndError,
  classifyLoadError,
  classifySendError,
  classifyTranscribeError,
  CONFLICT_RETRY_DELAYS_MS,
  isRetryableConflict,
} from './errors.ts';
import { hintText } from './hints.ts';
import type { HintCode } from './machine.ts';

const error = (status: number, code: string, retryable = false, details?: unknown) =>
  new ApiError(status, code, `Server said ${code}`, retryable, details);
const offline = () => new ApiError(0, 'network', 'offline', true);

describe('classifySendError', () => {
  it('maps what the server says onto what the call does about it', () => {
    expect(classifySendError(offline())).toEqual({ kind: 'offline', saved: false });
    expect(classifySendError(error(409, 'conflict', true))).toEqual({
      kind: 'conflict',
      saved: false,
    });
    // A conflict that cannot pass means the call cannot go on.
    expect(classifySendError(error(409, 'conflict', false))).toEqual({ kind: 'session-ended' });
    expect(classifySendError(error(400, 'validation_failed'))).toEqual({ kind: 'validation' });
    expect(classifySendError(error(400, 'bad_request'))).toEqual({ kind: 'validation' });
    expect(classifySendError(error(413, 'payload_too_large'))).toEqual({ kind: 'validation' });
    expect(classifySendError(error(409, 'session_not_active'))).toEqual({ kind: 'session-ended' });
    expect(classifySendError(error(404, 'not_found'))).toEqual({ kind: 'session-ended' });
    expect(classifySendError(error(409, 'turn_limit_reached'))).toEqual({ kind: 'turn-limit' });
    expect(classifySendError(error(500, 'internal', true))).toEqual({
      kind: 'unknown',
      saved: false,
    });
    expect(classifySendError(new Error('weird'))).toEqual({ kind: 'unknown', saved: false });
  });

  it('knows a rate limit and how long to wait, rounding up', () => {
    expect(classifySendError(error(429, 'rate_limited', true, { retryAfterSeconds: 3.2 }))).toEqual(
      { kind: 'rate-limited', saved: false, retryAfterSeconds: 4 },
    );
    expect(classifySendError(error(429, 'rate_limited', true))).toEqual({
      kind: 'rate-limited',
      saved: false,
    });
    expect(
      classifySendError(error(429, 'rate_limited', true, { retryAfterSeconds: 'soon' })),
    ).toEqual({ kind: 'rate-limited', saved: false });
  });

  it('knows when the server saved the message and only the reply failed', () => {
    const saved = { traineeTurn: { index: 2, text: 'hello' } };
    for (const code of ['provider_unavailable', 'provider_timeout', 'provider_bad_output']) {
      expect(classifySendError(error(502, code, true, saved))).toEqual({
        kind: 'provider',
        saved: true,
      });
    }
    expect(classifySendError(error(502, 'provider_unavailable', true))).toEqual({
      kind: 'provider',
      saved: false,
    });
    expect(classifySendError(error(500, 'internal', true, saved))).toEqual({
      kind: 'unknown',
      saved: true,
    });
  });
});

describe('the other classifiers', () => {
  it('classifies transcription failures', () => {
    expect(classifyTranscribeError(offline())).toEqual({ kind: 'offline' });
    expect(classifyTranscribeError(error(503, 'speech_unavailable', true))).toEqual({
      kind: 'service-unavailable',
    });
    expect(classifyTranscribeError(error(503, 'provider_not_configured'))).toEqual({
      kind: 'service-unavailable',
    });
    expect(
      classifyTranscribeError(error(429, 'speech_rate_limited', true, { retryAfterSeconds: 2 })),
    ).toEqual({ kind: 'rate-limited', retryAfterSeconds: 2 });
    expect(classifyTranscribeError(error(429, 'rate_limited', true))).toEqual({
      kind: 'rate-limited',
    });
    for (const code of [
      'speech_failed',
      'speech_timeout',
      'unsupported_media',
      'validation_failed',
    ]) {
      expect(classifyTranscribeError(error(502, code, true))).toEqual({ kind: 'failed' });
    }
    expect(classifyTranscribeError(new Error('weird'))).toEqual({ kind: 'failed' });
  });

  it('classifies ending failures and loading failures', () => {
    expect(classifyEndError(offline())).toEqual({ kind: 'offline' });
    expect(classifyEndError(error(422, 'no_conversation'))).toEqual({ kind: 'nothing-to-review' });
    expect(classifyEndError(error(500, 'internal', true))).toEqual({ kind: 'failed' });
    expect(classifyEndError(new Error('weird'))).toEqual({ kind: 'failed' });
    expect(classifyLoadError(offline())).toBe('offline');
    // A call the server does not know is not something trying again can fix.
    expect(classifyLoadError(error(404, 'not_found'))).toBe('not-found');
    expect(classifyLoadError(error(500, 'internal', true))).toBe('unavailable');
    expect(classifyLoadError(new Error('weird'))).toBe('unavailable');
  });

  it('retries only a conflict that can pass, with growing waits', () => {
    expect(isRetryableConflict(error(409, 'conflict', true))).toBe(true);
    expect(isRetryableConflict(error(409, 'conflict', false))).toBe(false);
    expect(isRetryableConflict(error(502, 'provider_unavailable', true))).toBe(false);
    expect(isRetryableConflict(new Error('x'))).toBe(false);
    expect(CONFLICT_RETRY_DELAYS_MS).toEqual([...CONFLICT_RETRY_DELAYS_MS].sort((a, b) => a - b));
    expect(CONFLICT_RETRY_DELAYS_MS.length).toBeGreaterThanOrEqual(3);
  });
});

describe('hintText', () => {
  const CODES: Record<HintCode, true> = {
    'nothing-heard': true,
    'no-words': true,
    muted: true,
    paused: true,
    'captions-only': true,
    'long-turn': true,
    busy: true,
    'retry-first': true,
    empty: true,
    'too-long': true,
    rejected: true,
    redacted: true,
    'discarded-muted': true,
    'discarded-paused': true,
    'no-voice': true,
    'not-started': true,
  };

  it('has a whole plain sentence for every hint', () => {
    for (const code of Object.keys(CODES) as HintCode[]) {
      const text = hintText({ code });
      expect(text, code).toMatch(/^[A-Z].*[.]$/);
      expect(text, code).not.toMatch(/!|error|undefined|null/i);
    }
  });

  it('names what was removed from a message, in the trainee\u2019s own terms', () => {
    expect(hintText({ code: 'redacted', kinds: ['email'] })).toBe(
      'Firefly removed an email address from your message before saving it. Please never use real customer details.',
    );
    expect(hintText({ code: 'redacted', kinds: ['email', 'phone', 'card'] })).toMatch(
      /an email address, a phone number and a long number/,
    );
    expect(hintText({ code: 'redacted' })).toMatch(/personal details/);
  });
});
