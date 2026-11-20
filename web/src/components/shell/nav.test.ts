import { describe, expect, it } from 'vitest';
import { activeNavItem, DOCK_ITEMS, HELP_ITEM } from './nav.ts';

describe('dock destinations', () => {
  it('numbers six destinations in the order of the ruler', () => {
    expect(DOCK_ITEMS.map((item) => [item.label, item.to])).toEqual([
      ['Home', '/home'],
      ['Missions', '/scenarios'],
      ['History', '/history'],
      ['Progress', '/progress'],
      ['Studio', '/trainer'],
      ['Settings', '/settings'],
    ]);
  });

  it('lights the destination that owns an address', () => {
    expect(activeNavItem('/home')?.label).toBe('Home');
    expect(activeNavItem('/scenarios')?.label).toBe('Missions');
    expect(activeNavItem('/progress')?.label).toBe('Progress');
    expect(activeNavItem('/settings')?.label).toBe('Settings');
    expect(activeNavItem('/trainer')?.label).toBe('Studio');
  });

  it('files rewards under Progress and calibration under Studio', () => {
    expect(activeNavItem('/rewards')?.label).toBe('Progress');
    expect(activeNavItem('/calibration')?.label).toBe('Studio');
  });

  it('keeps Missions lit for the whole practice journey', () => {
    for (const path of [
      '/practice',
      '/scenarios/team-workspace/setup',
      '/calls/call-1',
      '/sessions/s1/report',
    ]) {
      expect(activeNavItem(path)?.label).toBe('Missions');
    }
  });

  it('files a transcript under History and the library only on its own address', () => {
    expect(activeNavItem('/history')?.label).toBe('History');
    expect(activeNavItem('/sessions/s1/transcript')?.label).toBe('History');
    expect(activeNavItem('/scenarios/team-workspace')).toBeUndefined();
  });

  it('lights at most one destination for any address', () => {
    for (const path of [
      '/home',
      '/practice',
      '/scenarios',
      '/calls/x',
      '/sessions/x/report',
      '/sessions/x/transcript',
      '/rewards',
      '/calibration',
    ]) {
      expect(DOCK_ITEMS.filter((item) => item.match(path))).toHaveLength(1);
    }
  });

  it('has nothing lit on the landing, sign-in, help and unknown pages', () => {
    for (const path of ['/', '/sign-in', '/help', '/nowhere', '']) {
      expect(activeNavItem(path)).toBeUndefined();
    }
    expect(HELP_ITEM.to).toBe('/help');
    expect(DOCK_ITEMS.some((item) => item.match('/help'))).toBe(false);
  });

  it('ignores a trailing slash', () => {
    expect(activeNavItem('/history/')?.label).toBe('History');
    expect(activeNavItem('/sessions/s1/report/')?.label).toBe('Missions');
  });
});
