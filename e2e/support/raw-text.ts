import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

// Words that must never reach a person: the server's own error text, error codes, stack traces and
// the signs of a value that was never filled in. Used after the journeys that provoke failures, to
// check that the page explains what happened in its own words.

export type RawFailureKind =
  | 'the mock failure message'
  | 'an API error code'
  | 'an exception name'
  | 'a browser network error'
  | 'a stack frame'
  | 'an HTTP status'
  | 'an unfilled value';

const RAW_FAILURE_TEXT: ReadonlyArray<[RawFailureKind, RegExp]> = [
  ['the mock failure message', /simulated failure/i],
  ['an API error code', /\b(?:speech|provider|evaluation|validation)_[a-z_]+\b/],
  [
    'an exception name',
    /\b(?:TypeError|ReferenceError|SyntaxError|RangeError|AbortError|NotAllowedError|NotFoundError)\b/,
  ],
  ['a browser network error', /Failed to fetch|NetworkError|Unexpected token|ERR_[A-Z_]+/],
  ['a stack frame', /\bat [\w$.<>]+ \(/],
  ['an HTTP status', /\bHTTP \d{3}\b/],
  ['an unfilled value', /\bundefined\b|\[object Object\]|\bNaN\b|\bnull\b/],
];

/**
 * Fails if the page shows raw failure text, or a value that was never filled in. `except` names a
 * kind that is expected: the report page shows the server's own sentence about why an evaluation
 * failed, and the test hook's sentence ends in "(simulated failure)".
 */
export async function expectNoRawFailureText(
  page: Page,
  options: { except?: readonly RawFailureKind[] } = {},
): Promise<void> {
  const text = await page.locator('body').innerText();
  const found = RAW_FAILURE_TEXT.filter(
    ([name, pattern]) => !options.except?.includes(name) && pattern.test(text),
  ).map(([name]) => name);
  expect(found, `The page shows raw failure text (${found.join(', ')})`).toEqual([]);
}
