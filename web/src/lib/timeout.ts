/**
 * Runs a request that is abandoned, and fails with `timeoutError()`, if it takes longer than `ms`.
 * Any other failure passes through unchanged. The request is told to stop through its signal.
 */
export async function withTimeout<T>(
  ms: number,
  run: (signal: AbortSignal) => Promise<T>,
  timeoutError: () => Error,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await run(controller.signal);
  } catch (error) {
    throw controller.signal.aborted ? timeoutError() : error;
  } finally {
    clearTimeout(timer);
  }
}
