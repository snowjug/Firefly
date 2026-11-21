import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TranscribeResponse } from '#shared/domain/speech.ts';
import { ApiError } from '../../lib/api.ts';
import { createTranscriber, TRANSCRIBE_TIMEOUT_MS, type Transcribe } from './transcriber.ts';

// One utterance, turned into words once. The id is made when the trainee stops speaking and stays the
// same through every retry, so asking again can never make a second turn.

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const recording = () => new Blob(['pretend audio']);
const heard = (text: string, durationMs = 1800): TranscribeResponse => ({
  status: 'recognised',
  text,
  durationMs,
});
const failure = (status = 502, code = 'speech_failed', details?: unknown) =>
  new ApiError(status, code, 'The provider said something specific.', status >= 500, details);

function setup(transcribe: Transcribe, timeoutMs?: number) {
  const fn = vi.fn<Transcribe>(transcribe);
  const transcriber = createTranscriber({ transcribe: fn, ...(timeoutMs ? { timeoutMs } : {}) });
  return { fn, transcriber };
}

const never = (_audio: Blob, _language: string, signal?: AbortSignal): Promise<never> =>
  new Promise((_resolve, reject) => {
    signal?.addEventListener('abort', () => reject(signal.reason));
  });

describe('a transcription that works', () => {
  it('returns the words, trimmed, once, and lets go of the recording', async () => {
    const { fn, transcriber } = setup(async () => heard('  My order has not arrived. '));
    const audio = recording();
    const outcome = await transcriber.run('message-1', audio, 'en-GB');
    expect(outcome).toEqual({
      kind: 'transcript',
      id: 'message-1',
      text: 'My order has not arrived.',
      durationMs: 1800,
    });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(audio, 'en-GB', expect.any(AbortSignal));
    expect(transcriber.holds('message-1')).toBe(false);
    // The time-out is not left running.
    expect(vi.getTimerCount()).toBe(0);
  });

  it('shares one request between two askers of the same id while it runs', async () => {
    let answer: (response: TranscribeResponse) => void = () => undefined;
    const { fn, transcriber } = setup(() => new Promise((resolve) => (answer = resolve)));
    const first = transcriber.run('message-1', recording(), 'en-GB');
    const second = transcriber.run('message-1', recording(), 'en-GB');
    answer(heard('Hello there'));
    const [a, b] = await Promise.all([first, second]);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it('gives back the same answer for an id it has already answered, without asking the server again', async () => {
    const { fn, transcriber } = setup(async () => heard('Hello there'));
    const first = await transcriber.run('message-1', recording(), 'en-GB');
    const again = await transcriber.run('message-1', recording(), 'en-GB');
    expect(again).toBe(first);
    expect(await transcriber.retry('message-1')).toBeNull();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('keeps ids apart: another utterance is another request', async () => {
    const { fn, transcriber } = setup(async () => heard('Hello there'));
    await transcriber.run('message-1', recording(), 'en-GB');
    await transcriber.run('message-2', recording(), 'en-GB');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('a transcription that fails', () => {
  it('can be retried with the same recording under the same id, and then makes one turn, not two', async () => {
    let calls = 0;
    const sent: Blob[] = [];
    const { fn, transcriber } = setup(async (audio) => {
      sent.push(audio);
      if (++calls === 1) throw failure();
      return heard('My order has not arrived');
    });
    const audio = recording();
    const first = await transcriber.run('message-1', audio, 'en-GB');
    expect(first).toMatchObject({
      kind: 'failed',
      id: 'message-1',
      error: {
        code: 'transcription-failed',
        retryAction: 'resend-recording',
        recovery: ['retry', 'use-text'],
      },
    });
    // Kept in memory only because Retry can send it again.
    expect(transcriber.holds('message-1')).toBe(true);

    const second = await transcriber.retry('message-1');
    expect(second).toMatchObject({ kind: 'transcript', id: 'message-1' });
    expect(fn).toHaveBeenCalledTimes(2);
    // The very same recording, not a new one.
    expect(sent).toEqual([audio, audio]);
    expect(sent[1]).toBe(audio);
    expect(transcriber.holds('message-1')).toBe(false);

    // Once it has worked it cannot be run or retried into a second answer.
    expect(await transcriber.retry('message-1')).toBeNull();
    expect(await transcriber.run('message-1', recording(), 'en-GB')).toBe(second);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('can be retried more than once, still one request at a time', async () => {
    let calls = 0;
    const { fn, transcriber } = setup(async () => {
      if (++calls < 3) throw failure(504, 'speech_timeout');
      return heard('Hello there');
    });
    expect((await transcriber.run('m', recording(), 'en-GB')).kind).toBe('failed');
    const pending = transcriber.retry('m');
    // A second press while it runs joins it.
    const joined = transcriber.retry('m');
    expect(await pending).toBe(await joined);
    expect(fn).toHaveBeenCalledTimes(2);
    expect((await transcriber.retry('m'))?.kind).toBe('transcript');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('keeps the recording for a failure Retry can fix, and lets go of it for one it cannot', async () => {
    const cases: Array<[ApiError, boolean, string]> = [
      [failure(502, 'speech_failed'), true, 'transcription-failed'],
      [failure(504, 'speech_timeout'), true, 'transcription-timeout'],
      [failure(429, 'rate_limited', { retryAfterSeconds: 3 }), true, 'rate-limited'],
      [new ApiError(0, 'network', 'Cannot reach.', true), true, 'offline'],
      [failure(503, 'speech_unavailable'), false, 'speech-unavailable'],
    ];
    for (const [error, kept, code] of cases) {
      const { transcriber } = setup(async () => {
        throw error;
      });
      const outcome = await transcriber.run('m', recording(), 'en-GB');
      expect(outcome).toMatchObject({ kind: 'failed', error: { code } });
      expect(transcriber.holds('m')).toBe(kept);
      expect(await transcriber.retry('m')).toEqual(kept ? expect.anything() : null);
    }
  });

  it('carries the wait the server named when it is rate limited', async () => {
    const { transcriber } = setup(async () => {
      throw failure(429, 'rate_limited', { retryAfterSeconds: 2.1 });
    });
    const outcome = await transcriber.run('m', recording(), 'en-GB');
    expect(outcome).toMatchObject({ kind: 'failed', error: { retryAfterSeconds: 3 } });
  });

  it('gives up on a request that takes too long, aborts it, and keeps the recording for a retry', async () => {
    let signal: AbortSignal | undefined;
    const { transcriber } = setup((_audio, _language, given) => {
      signal = given;
      return never(_audio, _language, given);
    });
    const pending = transcriber.run('m', recording(), 'en-GB');
    await vi.advanceTimersByTimeAsync(TRANSCRIBE_TIMEOUT_MS - 1);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    expect(await pending).toMatchObject({
      kind: 'failed',
      error: { code: 'transcription-timeout', retryAction: 'resend-recording' },
    });
    expect(signal?.aborted).toBe(true);
    expect(transcriber.holds('m')).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('times out even a request that ignores the abort signal', async () => {
    const { transcriber } = setup(() => new Promise(() => undefined), 1000);
    const pending = transcriber.run('m', recording(), 'en-GB');
    await vi.advanceTimersByTimeAsync(1001);
    expect(await pending).toMatchObject({
      kind: 'failed',
      error: { code: 'transcription-timeout' },
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not let a late answer from a timed-out request make a turn', async () => {
    let answer: (response: TranscribeResponse) => void = () => undefined;
    const { transcriber } = setup(() => new Promise((resolve) => (answer = resolve)), 1000);
    const pending = transcriber.run('m', recording(), 'en-GB');
    await vi.advanceTimersByTimeAsync(1001);
    expect((await pending).kind).toBe('failed');
    answer(heard('Too late'));
    await vi.advanceTimersByTimeAsync(0);
    // Still failed: the late words were dropped, and Retry sends the recording again.
    expect(transcriber.holds('m')).toBe(true);
  });
});

describe('a recording with no words in it', () => {
  it('reports no speech, lets go of the recording, and does not ask the server again for the same id', async () => {
    const { fn, transcriber } = setup(async () => ({
      status: 'no-speech',
      text: '',
      durationMs: 1200,
    }));
    const outcome = await transcriber.run('m', recording(), 'en-GB');
    expect(outcome).toMatchObject({
      kind: 'no-speech',
      id: 'm',
      error: { code: 'no-speech', retryAction: 'record-again', recovery: ['retry', 'use-text'] },
    });
    expect(transcriber.holds('m')).toBe(false);
    expect(await transcriber.run('m', recording(), 'en-GB')).toBe(outcome);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('treats an empty transcript as no speech too', async () => {
    const { transcriber } = setup(async () => heard('   '));
    expect((await transcriber.run('m', recording(), 'en-GB')).kind).toBe('no-speech');
  });

  it('treats filler sounds as a poor transcription, never as a message', async () => {
    for (const text of ['uh', 'Um, er...', 'hmm', 'a']) {
      const { transcriber } = setup(async () => heard(text));
      const outcome = await transcriber.run('m', recording(), 'en-GB');
      expect(outcome).toMatchObject({
        kind: 'failed',
        error: { code: 'poor-transcription', retryAction: 'record-again' },
      });
      expect(transcriber.holds('m')).toBe(false);
    }
  });
});

describe('giving up and leaving', () => {
  it('discards: abandons the request, lets go of the recording, and reports cancelled to the asker', async () => {
    let signal: AbortSignal | undefined;
    const { transcriber } = setup((audio, language, given) => {
      signal = given;
      return never(audio, language, given);
    });
    const pending = transcriber.run('m', recording(), 'en-GB');
    expect(transcriber.holds('m')).toBe(true);
    transcriber.discard('m');
    expect(await pending).toEqual({ kind: 'cancelled', id: 'm' });
    expect(signal?.aborted).toBe(true);
    expect(transcriber.holds('m')).toBe(false);
    expect(await transcriber.retry('m')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('discards a recording that is only being held for a retry', async () => {
    const { fn, transcriber } = setup(async () => {
      throw failure();
    });
    await transcriber.run('m', recording(), 'en-GB');
    expect(transcriber.holds('m')).toBe(true);
    transcriber.discard('m');
    expect(transcriber.holds('m')).toBe(false);
    expect(await transcriber.retry('m')).toBeNull();
    expect(fn).toHaveBeenCalledTimes(1);
    // Safe to say again, or for an id it never saw.
    expect(() => transcriber.discard('m')).not.toThrow();
    expect(() => transcriber.discard('never-seen')).not.toThrow();
  });

  it('disposes: abandons every request, lets go of every recording, and refuses new work', async () => {
    const signals: AbortSignal[] = [];
    const { fn, transcriber } = setup((audio, language, given) => {
      if (given) signals.push(given);
      return never(audio, language, given);
    });
    const first = transcriber.run('a', recording(), 'en-GB');
    const second = transcriber.run('b', recording(), 'en-GB');
    transcriber.dispose();
    expect(await first).toEqual({ kind: 'cancelled', id: 'a' });
    expect(await second).toEqual({ kind: 'cancelled', id: 'b' });
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    expect(transcriber.holds('a') || transcriber.holds('b')).toBe(false);
    expect(await transcriber.run('c', recording(), 'en-GB')).toEqual({
      kind: 'cancelled',
      id: 'c',
    });
    expect(await transcriber.retry('a')).toBeNull();
    expect(fn).toHaveBeenCalledTimes(2);
    expect(() => transcriber.dispose()).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('disposes a recording held for a retry', async () => {
    const { transcriber } = setup(async () => {
      throw failure();
    });
    await transcriber.run('m', recording(), 'en-GB');
    transcriber.dispose();
    expect(transcriber.holds('m')).toBe(false);
  });
});

describe('what a failure carries', () => {
  it('never carries the audio, the words, or anything the provider said', async () => {
    const { transcriber } = setup(async () => {
      throw new ApiError(
        502,
        'speech_failed',
        'Bearer sk-secret-123 at https://eastus.example',
        true,
        {
          transcript: 'my card is 4111 1111 1111 1111',
        },
      );
    });
    const outcome = await transcriber.run('m', recording(), 'en-GB');
    const text = JSON.stringify(outcome);
    expect(text).not.toMatch(/sk-secret|4111|eastus|bearer|pretend audio/i);
    expect(outcome).toMatchObject({ kind: 'failed', error: { textFallback: true } });
  });
});
