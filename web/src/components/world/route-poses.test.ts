import { describe, expect, it } from 'vitest';
import { routePose, STILL_BELOW } from './route-poses.ts';

describe('routePose', () => {
  it('gives every route the presence the design asks for', () => {
    const intensity: [string, number][] = [
      ['/', 0.8],
      ['/home', 0.65],
      ['/scenarios', 0.55],
      ['/scenarios/locked-out/setup', 0.5],
      ['/practice', 0.5],
      ['/calls/0f3a', 1],
      ['/sessions/0f3a/report', 0.5],
      ['/history', 0.3],
      ['/progress', 0.3],
      ['/rewards', 0.3],
      ['/trainer', 0.15],
      ['/calibration', 0.15],
      ['/settings', 0.15],
      ['/help', 0.15],
      ['/sign-in', 0.15],
      ['/sessions/0f3a/transcript', 0.2],
      ['/no-such-page', 0.2],
    ];
    for (const [path, expected] of intensity)
      expect(routePose(path).intensity, path).toBe(expected);
  });

  it('reads an address the way a person would: a trailing slash or capitals change nothing', () => {
    expect(routePose('/Settings/').intensity).toBe(routePose('/settings').intensity);
    expect(routePose('/calls/abc/').intensity).toBe(1);
  });

  it('is a calm room everywhere, so that only the page decides the mood', () => {
    for (const path of ['/', '/home', '/calls/x', '/history', '/nowhere']) {
      const { tension, open, recovering, focus } = routePose(path);
      expect([tension, open, recovering, focus], path).toEqual([0.08, 1, false, null]);
    }
  });

  it('leaves the text-heavy routes still (one frame, no loop) and the others moving', () => {
    for (const path of ['/settings', '/help', '/trainer', '/calibration', '/sign-in', '/x']) {
      expect(routePose(path).intensity, path).toBeLessThanOrEqual(STILL_BELOW);
    }
    for (const path of ['/', '/home', '/scenarios', '/calls/x', '/history', '/progress']) {
      expect(routePose(path).intensity, path).toBeGreaterThan(STILL_BELOW);
    }
  });

  it('hands out a copy, so nobody can change a route default by accident', () => {
    const pose = routePose('/home');
    pose.intensity = 0;
    expect(routePose('/home').intensity).toBe(0.65);
  });
});
