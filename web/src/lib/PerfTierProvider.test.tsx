import { act, render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PerfTierProvider, useEffectBudget, usePerfTier } from './PerfTierProvider.tsx';
import type { PerfTier } from './perf-tier.ts';

function Probe() {
  const tier = usePerfTier();
  const budget = useEffectBudget();
  return <p data-testid="probe">{`${tier} motes=${budget.motes} shader=${budget.shader}`}</p>;
}

const probe = () => screen.getByTestId('probe').textContent;
const rootTier = () => document.documentElement.getAttribute('data-perf');

// jsdom reports the real machine's core count, so every test says what the device is.
const stubbed: { target: object; key: string }[] = [];
function stub(target: object, key: string, value: unknown) {
  Object.defineProperty(target, key, { value, configurable: true, writable: true });
  stubbed.push({ target, key });
}
function device(options: { cores?: number; memory?: number; saveData?: boolean; touch?: boolean }) {
  stub(window.navigator, 'hardwareConcurrency', options.cores ?? 8);
  if (options.memory !== undefined) stub(window.navigator, 'deviceMemory', options.memory);
  if (options.saveData) stub(window.navigator, 'connection', { saveData: true });
  if (options.touch) {
    stub(window, 'matchMedia', (query: string) => ({ matches: query === '(pointer: coarse)' }));
  }
}

afterEach(() => {
  for (const { target, key } of stubbed.splice(0)) {
    delete (target as Record<string, unknown>)[key];
  }
  window.history.replaceState({}, '', '/');
  vi.restoreAllMocks();
});

/** Takes over the animation frame clock, so a test can say how long each frame took. */
function fakeFrames() {
  let time = 5000;
  let nextId = 0;
  const pending = new Map<number, FrameRequestCallback>();
  vi.spyOn(globalThis.performance, 'now').mockImplementation(() => time);
  const request = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    nextId += 1;
    pending.set(nextId, callback);
    return nextId;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    pending.delete(id);
  });
  return {
    requested: () => request.mock.calls.length,
    pending: () => pending.size,
    run(ms: number, duration: number) {
      for (let spent = 0; spent < duration; spent += ms) {
        time += ms;
        const callbacks = [...pending.values()];
        pending.clear();
        for (const callback of callbacks) callback(time);
      }
    },
  };
}

describe('the tier a device starts at', () => {
  it.each([
    ['a capable desktop', { cores: 8, memory: 8 }, 'high motes=120 shader=true'],
    ['a desktop that does not report its memory', { cores: 12 }, 'high motes=120 shader=true'],
    ['a four-core laptop', { cores: 4 }, 'medium motes=70 shader=true'],
    [
      'a phone with a touch screen',
      { cores: 8, memory: 8, touch: true },
      'medium motes=70 shader=true',
    ],
    ['a two-core machine', { cores: 2 }, 'low motes=24 shader=false'],
    ['a device with 2 GB', { cores: 8, memory: 2 }, 'low motes=24 shader=false'],
    ['data saver on', { cores: 16, saveData: true }, 'low motes=24 shader=false'],
  ] as const)('is read from %s', (_name, options, expected) => {
    device(options);
    render(
      <PerfTierProvider monitor={false}>
        <Probe />
      </PerfTierProvider>,
    );
    expect(probe()).toBe(expected);
    expect(rootTier()).toBe(expected.split(' ')[0]);
  });

  it('is the best tier for a bare jsdom that reports only its cores', () => {
    device({ cores: 8 });
    expect('connection' in window.navigator).toBe(false);
    expect(typeof window.matchMedia).not.toBe('function');
    render(
      <PerfTierProvider>
        <Probe />
      </PerfTierProvider>,
    );
    expect(probe()).toBe('high motes=120 shader=true');
  });

  it('marks the root element for CSS, and clears the mark when it goes', () => {
    device({ cores: 2 });
    const { unmount } = render(
      <PerfTierProvider monitor={false}>
        <Probe />
      </PerfTierProvider>,
    );
    expect(rootTier()).toBe('low');
    unmount();
    expect(rootTier()).toBeNull();
  });
});

describe('forcing a tier', () => {
  it.each(['low', 'medium', 'high'] as const)(
    '?perf=%s pins that tier, whatever the device is',
    (tier) => {
      device({ cores: tier === 'high' ? 1 : 16, saveData: tier === 'high' });
      window.history.replaceState({}, '', `/?x=1&perf=${tier}`);
      render(
        <PerfTierProvider monitor={false}>
          <Probe />
        </PerfTierProvider>,
      );
      const motes = { low: 24, medium: 70, high: 120 }[tier];
      expect(probe()).toContain(`${tier} motes=${motes}`);
      expect(rootTier()).toBe(tier);
    },
  );

  it('ignores a value it does not know and falls back to the device', () => {
    device({ cores: 8 });
    window.history.replaceState({}, '', '/?perf=ultra');
    render(
      <PerfTierProvider monitor={false}>
        <Probe />
      </PerfTierProvider>,
    );
    expect(probe()).toContain('high');
  });

  it('can be pinned with the tier prop, which wins over the address', () => {
    device({ cores: 8 });
    window.history.replaceState({}, '', '/?perf=low');
    render(
      <PerfTierProvider tier="medium" monitor={false}>
        <Probe />
      </PerfTierProvider>,
    );
    expect(probe()).toContain('medium');
  });

  it('follows the tier prop when it changes', () => {
    device({ cores: 8 });
    const { rerender } = render(
      <PerfTierProvider tier="low" monitor={false}>
        <Probe />
      </PerfTierProvider>,
    );
    expect(probe()).toContain('low');
    rerender(
      <PerfTierProvider tier="high" monitor={false}>
        <Probe />
      </PerfTierProvider>,
    );
    expect(probe()).toContain('high');
    expect(rootTier()).toBe('high');
  });
});

describe('outside a provider', () => {
  it('reads as the cheapest tier, so a component still works', () => {
    const wrapperless = renderHook(() => ({ tier: usePerfTier(), budget: useEffectBudget() }));
    expect(wrapperless.result.current.tier).toBe('low');
    expect(wrapperless.result.current.budget).toMatchObject({ shader: false, blur: false });
  });

  it('is replaced by the provider around it', () => {
    device({ cores: 8 });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <PerfTierProvider monitor={false}>{children}</PerfTierProvider>
    );
    const { result } = renderHook(() => usePerfTier(), { wrapper });
    expect(result.current).toBe('high');
  });
});

describe('watching the frames', () => {
  const watched = (props: { monitor?: boolean; tier?: PerfTier } = {}) =>
    render(
      <PerfTierProvider {...props}>
        <Probe />
      </PerfTierProvider>,
    );

  it('does not watch under Vitest unless it is asked to', () => {
    device({ cores: 8 });
    const frames = fakeFrames();
    watched();
    expect(frames.requested()).toBe(0);
    watched({ monitor: false });
    expect(frames.requested()).toBe(0);
  });

  it('steps the whole app down when frames run slow, and never back up', () => {
    device({ cores: 8 });
    const frames = fakeFrames();
    watched({ monitor: true });
    expect(probe()).toContain('high');

    act(() => frames.run(30, 1700));
    expect(probe()).toBe('medium motes=70 shader=true');
    expect(rootTier()).toBe('medium');

    act(() => frames.run(8, 3200)); // smooth again, but it never climbs back
    expect(probe()).toContain('medium');

    act(() => frames.run(60, 4500));
    expect(probe()).toBe('low motes=24 shader=false');
    expect(rootTier()).toBe('low');
    expect(frames.pending()).toBe(0);
  });

  it('leaves a smooth page alone', () => {
    device({ cores: 8 });
    const frames = fakeFrames();
    watched({ monitor: true });
    act(() => frames.run(16.7, 10_000));
    expect(probe()).toContain('high');
    expect(frames.pending()).toBe(0); // five steady windows, so it stopped watching
  });

  it('does not watch a pinned tier, so it stays where it was put', () => {
    device({ cores: 8 });
    window.history.replaceState({}, '', '/?perf=high');
    const frames = fakeFrames();
    watched({ monitor: true });
    expect(frames.requested()).toBe(0);
    watched({ monitor: true, tier: 'medium' });
    expect(frames.requested()).toBe(0);
  });

  it('does not start from a device that is already at the cheapest tier', () => {
    device({ cores: 2 });
    const frames = fakeFrames();
    watched({ monitor: true });
    expect(frames.requested()).toBe(0);
  });

  it('stops watching when it is removed', () => {
    device({ cores: 8 });
    const frames = fakeFrames();
    const { unmount } = watched({ monitor: true });
    expect(frames.pending()).toBe(1);
    unmount();
    expect(frames.pending()).toBe(0);
  });
});
