import { describe, expect, it } from 'vitest';
import { activeNavItem, ALL_NAV } from './nav.ts';

describe('sidebar destinations', () => {
  it('lights the destination that owns an address', () => {
    expect(activeNavItem('/home')?.label).toBe('Home');
    expect(activeNavItem('/scenarios')?.label).toBe('Scenarios');
    expect(activeNavItem('/progress')?.label).toBe('My Progress');
    expect(activeNavItem('/rewards')?.label).toBe('Rewards');
    expect(activeNavItem('/settings')?.label).toBe('Settings');
    expect(activeNavItem('/help')?.label).toBe('Help');
    expect(activeNavItem('/calibration')?.label).toBe('Calibration');
    expect(activeNavItem('/trainer')?.label).toBe('Trainer');
  });

  it('keeps Practice lit for the whole practice journey', () => {
    for (const path of [
      '/practice',
      '/scenarios/team-workspace/setup',
      '/calls/call-1',
      '/sessions/s1/report',
    ]) {
      expect(activeNavItem(path)?.label).toBe('Practice');
    }
  });

  it('files a transcript under History and the library under Scenarios only on its own address', () => {
    expect(activeNavItem('/history')?.label).toBe('History');
    expect(activeNavItem('/sessions/s1/transcript')?.label).toBe('History');
    expect(activeNavItem('/scenarios/team-workspace')).toBeUndefined();
  });

  it('lights at most one destination for any address', () => {
    for (const path of ['/home', '/practice', '/scenarios', '/calls/x', '/sessions/x/report']) {
      expect(ALL_NAV.filter((item) => item.match(path))).toHaveLength(1);
    }
  });

  it('has nothing lit on the landing and sign-in pages', () => {
    expect(activeNavItem('/')).toBeUndefined();
    expect(activeNavItem('/sign-in')).toBeUndefined();
  });
});
