import { describe, expect, it } from 'vitest';
import { pageFor, preloadPage } from './App.tsx';

const ADDRESSES = [
  '/',
  '/sign-in',
  '/home',
  '/practice',
  '/scenarios',
  '/calls/call-1',
  '/sessions/session-1/report',
  '/sessions/session-1/transcript',
  '/history',
  '/rewards',
  '/progress',
  '/calibration',
  '/trainer',
  '/help',
  '/settings',
];

describe('pageFor', () => {
  it('finds a page for every address the app serves, each its own, whatever the id', () => {
    const pages = ADDRESSES.map((address) => pageFor(address));
    expect(pages.every((page) => page !== null)).toBe(true);
    // The setup page serves two addresses (the generic one and one for a chosen scenario).
    expect(new Set(pages).size).toBe(ADDRESSES.length);
    expect(pageFor('/scenarios/another-one/setup')).toBe(
      pageFor('/scenarios/team-workspace/setup'),
    );
    expect(pageFor('/scenarios/team-workspace/setup')).toBe(pageFor('/practice'));
  });

  it('finds nothing to fetch for an address that is not a page or only redirects', () => {
    expect(pageFor('/nowhere')).toBeNull();
    expect(pageFor('/scenarios/team-workspace')).toBeNull();
    expect(pageFor('/about')).toBeNull();
    expect(pageFor('/scenarios/team-workspace/brief')).toBeNull();
  });
});

describe('preloadPage', () => {
  it('fetches the page and settles, and settles at once when there is nothing to fetch', async () => {
    await expect(preloadPage('/help')).resolves.toBeUndefined();
    await expect(preloadPage('/nowhere')).resolves.toBeUndefined();
  });
});
