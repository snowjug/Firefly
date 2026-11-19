import { afterEach, describe, expect, it, vi } from 'vitest';
import { withTimeout } from './timeout.ts';

afterEach(() => vi.useRealTimers());

/** A request that only ends when it is told to stop. */
const hangs = (signal: AbortSignal) =>
  new Promise<string>((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('stopped', 'AbortError')));
  });

describe('withTimeout', () => {
  it('returns what the request returns, and leaves no timer behind', async () => {
    vi.useFakeTimers();
    await expect(
      withTimeout(
        1000,
        () => Promise.resolve('done'),
        () => new Error('late'),
      ),
    ).resolves.toBe('done');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops a request that takes too long and reports the timeout instead', async () => {
    vi.useFakeTimers();
    let seen: AbortSignal | undefined;
    const result = withTimeout(
      1000,
      (signal) => {
        seen = signal;
        return hangs(signal);
      },
      () => new Error('took too long'),
    );
    const outcome = expect(result).rejects.toThrow('took too long');
    await vi.advanceTimersByTimeAsync(1000);
    await outcome;
    expect(seen?.aborted).toBe(true);
  });

  it('passes any other failure through unchanged', async () => {
    vi.useFakeTimers();
    const failure = new Error('refused');
    await expect(
      withTimeout(
        1000,
        () => Promise.reject(failure),
        () => new Error('late'),
      ),
    ).rejects.toBe(failure);
    expect(vi.getTimerCount()).toBe(0);
  });
});
