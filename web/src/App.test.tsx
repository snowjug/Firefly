import { describe, expect, it } from 'vitest';
import { pageFor, preloadPage } from './App.tsx';

const ADDRESSES = [
  '/',
  '/scenarios',
  '/scenarios/team-workspace/setup',
  '/scenarios/team-workspace/brief',
  '/calls/call-1',
  '/sessions/session-1/report',
  '/sessions/session-1/transcript',
  '/history',
  '/progress',
  '/calibration',
  '/trainer',
  '/about',
  '/settings',
];

describe('pageFor', () => {
  it('finds a page for every address the app serves, each its own, whatever the id', () => {
    const pages = ADDRESSES.map((address) => pageFor(address));
    expect(pages.every((page) => page !== null)).toBe(true);
    expect(new Set(pages).size).toBe(ADDRESSES.length);
    expect(pageFor('/scenarios/another-one/setup')).toBe(
      pageFor('/scenarios/team-workspace/setup'),
    );
  });

  it('finds nothing to fetch for an address that is not a page', () => {
    expect(pageFor('/nowhere')).toBeNull();
    expect(pageFor('/scenarios/team-workspace')).toBeNull();
  });
});

describe('preloadPage', () => {
  it('fetches the page and settles, and settles at once when there is nothing to fetch', async () => {
    await expect(preloadPage('/about')).resolves.toBeUndefined();
    await expect(preloadPage('/nowhere')).resolves.toBeUndefined();
  });
});
