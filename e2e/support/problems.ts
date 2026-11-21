import type { BrowserContext, ConsoleMessage, Request, Response, WebError } from '@playwright/test';

// Records everything a page does wrong, so that a journey cannot pass while the browser is
// complaining. Every test gets one (see fixtures.ts). At the end of a passing test it fails if the
// browser logged a console error or warning, threw an uncaught error, failed a request or got an
// HTTP error that the test did not say it was provoking.
//
//   problems.allow({ status: 502, url: /speech\/transcribe/ });   // a failure the test injected
//   problems.allowOffline();                                       // the test switched the network off
//
// A request the page cancelled itself (`net::ERR_ABORTED`, for example a poll that is replaced when
// the page changes) is not a failure and is never recorded. Chromium also writes a console error for
// every failed resource ("Failed to load resource: ..."): an allowed failure allows that line too.

export type ProblemKind =
  'console-error' | 'console-warning' | 'page-error' | 'request-failed' | 'http-error';

export interface Problem {
  kind: ProblemKind;
  text: string;
  url: string | null;
  status: number | null;
}

export interface AllowedFailure {
  /** The HTTP status that is expected. */
  status?: number;
  /** The address of the failing request (a substring or a pattern). */
  url?: string | RegExp;
}

const OFFLINE = /ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED|ERR_CONNECTION_/;
const RESOURCE_FAILURE = /^Failed to load resource: the server responded with a status of (\d{3})/;

function matches(pattern: string | RegExp | undefined, value: string | null): boolean {
  if (pattern === undefined) return true;
  if (value === null) return false;
  return typeof pattern === 'string' ? value.includes(pattern) : pattern.test(value);
}

export class ProblemRecorder {
  readonly problems: Problem[] = [];
  private readonly allowed: AllowedFailure[] = [];
  private offlineAllowed = false;
  private readonly listeners: Array<() => void> = [];

  constructor(context: BrowserContext) {
    const onConsole = (message: ConsoleMessage) => {
      const type = message.type();
      if (type !== 'error' && type !== 'warning') return;
      this.problems.push({
        kind: type === 'error' ? 'console-error' : 'console-warning',
        text: message.text(),
        url: message.location().url || null,
        status: null,
      });
    };
    const onWebError = (error: WebError) => {
      this.problems.push({
        kind: 'page-error',
        text: error.error().message,
        url: null,
        status: null,
      });
    };
    const onRequestFailed = (request: Request) => {
      const reason = request.failure()?.errorText ?? 'failed';
      if (reason.includes('ERR_ABORTED')) return;
      this.problems.push({
        kind: 'request-failed',
        text: `${request.method()} ${request.url()}: ${reason}`,
        url: request.url(),
        status: null,
      });
    };
    const onResponse = (response: Response) => {
      if (response.status() < 400) return;
      this.problems.push({
        kind: 'http-error',
        text: `${response.request().method()} ${response.url()}: HTTP ${response.status()}`,
        url: response.url(),
        status: response.status(),
      });
    };
    context.on('console', onConsole);
    context.on('weberror', onWebError);
    context.on('requestfailed', onRequestFailed);
    context.on('response', onResponse);
    this.listeners.push(
      () => context.off('console', onConsole),
      () => context.off('weberror', onWebError),
      () => context.off('requestfailed', onRequestFailed),
      () => context.off('response', onResponse),
    );
  }

  /** Says that a failing request is part of the test: its HTTP error and the console line it causes. */
  allow(failure: AllowedFailure): void {
    this.allowed.push(failure);
  }

  /** Says that the test switches the network off, so requests are expected to fail. */
  allowOffline(): void {
    this.offlineAllowed = true;
  }

  private isAllowed(problem: Problem): boolean {
    if (this.offlineAllowed && OFFLINE.test(problem.text)) return true;
    if (problem.kind === 'http-error') {
      return this.allowed.some(
        (rule) =>
          (rule.status === undefined || rule.status === problem.status) &&
          matches(rule.url, problem.url),
      );
    }
    if (problem.kind === 'console-error') {
      const status = RESOURCE_FAILURE.exec(problem.text)?.[1];
      if (status !== undefined) {
        return this.allowed.some(
          (rule) =>
            (rule.status === undefined || rule.status === Number(status)) &&
            matches(rule.url, problem.url),
        );
      }
    }
    return false;
  }

  /** What the browser complained about that the test did not expect. */
  unexpected(): Problem[] {
    return this.problems.filter((problem) => !this.isAllowed(problem));
  }

  dispose(): void {
    for (const stop of this.listeners.splice(0)) stop();
  }

  /** Throws when anything unexpected was recorded. */
  assertNone(): void {
    const unexpected = this.unexpected();
    if (unexpected.length === 0) return;
    const lines = unexpected.map((problem) => `  [${problem.kind}] ${problem.text}`);
    throw new Error(`The browser reported problems the test did not expect:\n${lines.join('\n')}`);
  }
}
