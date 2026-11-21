import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pulseWorld, routePose, useWorldPose } from './useWorldPose.ts';
import {
  NEUTRAL_POSE,
  addPoseLayer,
  emitPulse,
  getPose,
  getPoseVersion,
  normalizePose,
  resetWorldStore,
  setBasePose,
  setPulseSink,
  subscribePose,
} from './world-store.ts';

beforeEach(resetWorldStore);
afterEach(resetWorldStore);

describe('the pose store', () => {
  it('starts as the calm room', () => {
    expect(getPose()).toEqual(NEUTRAL_POSE);
  });

  it('takes the route as its base and lets pages lay their own pose on top, key by key', () => {
    setBasePose(routePose('/calls/x'));
    const page = addPoseLayer();
    // A page that only says how the customer feels keeps the route's presence.
    page.set({ tension: 0.8, open: 0.36, warmth: 0.86, energy: 0.66 });
    expect(getPose()).toMatchObject({ tension: 0.8, open: 0.36, intensity: 1 });
    // A layer's request is replaced as a whole when it changes: what it no longer asks for falls back.
    page.set({ intensity: 0.4 });
    expect(getPose()).toMatchObject({ tension: 0.08, open: 1, intensity: 0.4 });
  });

  it('lets the last layer win, and brings the one below back when it goes', () => {
    const first = addPoseLayer();
    const second = addPoseLayer();
    first.set({ tension: 0.3 });
    second.set({ tension: 0.9 });
    expect(getPose().tension).toBe(0.9);
    second.remove();
    expect(getPose().tension).toBe(0.3);
    first.remove();
    expect(getPose().tension).toBe(NEUTRAL_POSE.tension);
  });

  it('removes a layer once, even if asked twice, and not the wrong one', () => {
    const first = addPoseLayer();
    const second = addPoseLayer();
    first.set({ tension: 0.3 });
    second.set({ open: 0.5 });
    second.remove();
    second.remove();
    expect(getPose()).toMatchObject({ tension: 0.3, open: NEUTRAL_POSE.open });
  });

  it('makes every number safe: out-of-range values are clamped, and bad ones ask for nothing', () => {
    // The chamber's route is the one with presence 1: a bad number must let that show through,
    // not fall back to some other room.
    setBasePose(routePose('/calls/x'));
    const page = addPoseLayer();
    page.set({
      tension: 4,
      open: -2,
      warmth: Number.NaN,
      energy: Number.POSITIVE_INFINITY,
      intensity: '0.5' as unknown as number,
    });
    expect(getPose()).toMatchObject({
      tension: 1,
      open: 0,
      warmth: NEUTRAL_POSE.warmth,
      energy: routePose('/calls/x').energy,
      intensity: 1,
    });
    expect(normalizePose({ focus: { x: 3, y: Number.NaN } }, NEUTRAL_POSE).focus).toBeNull();
    expect(normalizePose({ focus: { x: 3, y: -1 } }, NEUTRAL_POSE).focus).toEqual({ x: 1, y: 0 });
  });

  it('tells subscribers about each change, and stops after they unsubscribe', () => {
    const heard = vi.fn();
    const stop = subscribePose(heard);
    const before = getPoseVersion();
    setBasePose(routePose('/home'));
    addPoseLayer().set({ tension: 0.5 });
    expect(heard).toHaveBeenCalledTimes(2);
    expect(getPoseVersion()).toBe(before + 2);
    stop();
    setBasePose(routePose('/settings'));
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it('shows a pulse only while a field is animating, and drops it otherwise', () => {
    const shown = vi.fn();
    pulseWorld('discovery', { x: 0.4, y: 0.6 });
    const detach = setPulseSink(shown);
    pulseWorld('discovery', { x: 0.4, y: 0.6 });
    emitPulse('curveball');
    expect(shown.mock.calls).toEqual([
      ['discovery', { x: 0.4, y: 0.6 }],
      ['curveball', undefined],
    ]);
    detach();
    pulseWorld('curveball');
    expect(shown).toHaveBeenCalledTimes(2);
  });
});

describe('useWorldPose', () => {
  it('sets the pose while the page is mounted and restores the route default when it leaves', () => {
    setBasePose(routePose('/calls/x'));
    const { rerender, unmount } = renderHook(
      ({ tension }) => useWorldPose({ tension, recovering: true }),
      { initialProps: { tension: 0.56 } },
    );
    expect(getPose()).toMatchObject({ tension: 0.56, recovering: true, intensity: 1 });
    rerender({ tension: 0.3 });
    expect(getPose().tension).toBe(0.3);
    unmount();
    expect(getPose()).toMatchObject({ tension: 0.08, recovering: false, intensity: 1 });
  });

  it('does not send the pose again when a new object carries the same numbers', () => {
    const heard = vi.fn();
    const { rerender } = renderHook(() =>
      useWorldPose({ tension: 0.5, focus: { x: 0.2, y: 0.4 } }),
    );
    subscribePose(heard);
    rerender();
    rerender();
    expect(heard).not.toHaveBeenCalled();
  });

  it('lets the most recent page win, and the earlier one return when it leaves', () => {
    const outer = renderHook(() => useWorldPose({ tension: 0.3 }));
    const inner = renderHook(() => useWorldPose({ tension: 0.9 }));
    expect(getPose().tension).toBe(0.9);
    inner.unmount();
    expect(getPose().tension).toBe(0.3);
    outer.unmount();
    expect(getPose().tension).toBe(NEUTRAL_POSE.tension);
  });

  it('asks for nothing with null, and can clear a lean without touching anything else', () => {
    const { rerender } = renderHook(({ pose }) => useWorldPose(pose), {
      initialProps: {
        pose: { tension: 0.7, focus: { x: 0.3, y: 0.3 } } as Parameters<typeof useWorldPose>[0],
      },
    });
    expect(getPose().focus).toEqual({ x: 0.3, y: 0.3 });
    rerender({ pose: { tension: 0.7, focus: null } });
    expect(getPose()).toMatchObject({ tension: 0.7, focus: null });
    rerender({ pose: null });
    expect(getPose().tension).toBe(NEUTRAL_POSE.tension);
  });
});
