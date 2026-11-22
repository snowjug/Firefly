import { cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FIXTURE_NAMES, type FixtureName } from './call-fixtures.ts';
import { axeViolations, clearViewport, renderCall, WIDTH } from './test-utils.tsx';

// axe in a test DOM checks the structure of every state of the call: names, roles, ids, labels,
// landmarks and ARIA usage. It cannot see colour or layout, so contrast, reflow and focus
// visibility are checked in the browser run (see the screenshots and the Playwright axe pass).

afterEach(() => {
  cleanup();
  clearViewport();
});

describe('the axe harness', () => {
  it('does find real problems, so a clean run means something', async () => {
    document.body.innerHTML = '<main><button></button><img src="x.png"><input></main>';
    const found = (await axeViolations()).map((line) => line.split(':')[0]);
    expect(found).toEqual(expect.arrayContaining(['button-name', 'image-alt', 'label']));
    document.body.innerHTML = '';
  });
});

describe('axe, at the wide layout', () => {
  it.each(FIXTURE_NAMES)('%s has no violations', async (name) => {
    renderCall(name, { width: WIDTH.wide });
    expect(await axeViolations()).toEqual([]);
  });
});

const NARROW: FixtureName[] = [
  'preflight-voice',
  'permission-denied',
  'mic-ready',
  'listening',
  'customer-speaking',
  'text-fallback',
  'text-thinking',
  'retry-required',
  'offline',
  'problem-voice-generation',
  'state-escalating',
  'long-transcript',
  'end-confirm',
  'end-failed',
  'ending',
  'case-sheet',
  'voice-settings',
  'guided-hints',
  'guided-tips-hidden',
  'guided-customer-speaking',
  'end-ready-to-close',
  'end-ready-to-close-loading',
];

describe('axe, at the narrow layout (one column, controls in a dock, the case in a sheet)', () => {
  it.each(NARROW)('%s has no violations', async (name) => {
    renderCall(name, { width: WIDTH.narrow });
    expect(await axeViolations()).toEqual([]);
  });

  it('has none on a small phone either, where the strip is left out', async () => {
    renderCall('guided-hints', { width: WIDTH.narrow, height: 568 });
    expect(await axeViolations()).toEqual([]);
  });
});

describe('axe, at the medium layout (the case behind a button)', () => {
  it.each(['mic-ready', 'text-fallback', 'case-sheet', 'guided-hints'] as const)(
    '%s has no violations',
    async (name) => {
      renderCall(name, { width: WIDTH.medium });
      expect(await axeViolations()).toEqual([]);
    },
  );
});
