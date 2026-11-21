import { act, cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AmbientProvider } from '../../lib/motion/ambient.tsx';
import { PerfTierProvider } from '../../lib/PerfTierProvider.tsx';
import { ThemeProvider } from '../../lib/theme.tsx';
import type { PerfTier } from '../../lib/perf-tier.ts';
import { pulseWorld, useWorldPose } from './useWorldPose.ts';
import WorldField from './WorldField.tsx';
import { WorldLayer } from './WorldLayer.tsx';
import { resetEngineFloor } from './world-engine.ts';
import { getPose, resetWorldStore } from './world-store.ts';

// A drawing context that records what it is asked to do, and a frame clock the test turns by hand.
let strokes = 0;
let clears = 0;
let composite: string[] = [];
const frames = new Map<number, FrameRequestCallback>();
let frameId = 0;
let now = 1000;

function fakeContext(canvas: HTMLCanvasElement) {
  const state: Record<string, unknown> = { canvas };
  return new Proxy(state, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      if (prop === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (prop === 'stroke') return () => void (strokes += 1);
      if (prop === 'clearRect') return () => void (clears += 1);
      return () => {};
    },
    set(target, prop: string, value) {
      target[prop] = value;
      if (prop === 'globalCompositeOperation') composite.push(String(value));
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

/** Runs animation frames for `ms` of fake time at 60 per second. */
function advance(ms: number) {
  act(() => {
    for (let spent = 0; spent < ms; spent += 16) {
      now += 16;
      const due = [...frames.entries()];
      frames.clear();
      for (const [, callback] of due) callback(now);
    }
  });
}

const settle = async () => {
  // Let the lazy chunk resolve and the idle callback fire.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
};

function mount(
  options: { tier?: PerfTier; route?: string; reduce?: boolean; children?: React.ReactNode } = {},
) {
  if (options.reduce) localStorage.setItem('firefly.motion', JSON.stringify('reduce'));
  return render(
    <ThemeProvider>
      <AmbientProvider>
        <PerfTierProvider tier={options.tier ?? 'high'} monitor={false}>
          <MemoryRouter initialEntries={[options.route ?? '/calls/abc']}>
            <WorldLayer />
            {options.children}
          </MemoryRouter>
        </PerfTierProvider>
      </AmbientProvider>
    </ThemeProvider>,
  );
}
const canvasOf = (container: HTMLElement) => container.querySelector('canvas');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  strokes = clears = 0;
  composite = [];
  frames.clear();
  frameId = 0;
  now = 1000;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frameId += 1;
    frames.set(frameId, callback);
    return frameId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => void frames.delete(id));
  vi.stubGlobal('requestIdleCallback', (callback: () => void) => window.setTimeout(callback, 0));
  vi.stubGlobal('cancelIdleCallback', (id: number) => window.clearTimeout(id));
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    return fakeContext(this);
  } as never);
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => 1280,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => 720,
  });
});

afterEach(() => {
  // Unmount first: leaving the page cancels frames and observers through the stubs set up above.
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight;
  localStorage.clear();
  document.documentElement.removeAttribute('data-ambient');
  document.documentElement.removeAttribute('data-motion');
  resetWorldStore();
  resetEngineFloor();
});

describe('WorldLayer', () => {
  it('is the still gradient at first, with no canvas until the browser is idle', () => {
    const { container } = mount();
    const layer = container.querySelector('.world');
    expect(layer).toHaveAttribute('aria-hidden', 'true');
    // A named view-transition group paints above the page's own snapshot, so the field must stay
    // part of the root snapshot (see styles/transitions.css).
    expect(layer).not.toHaveAttribute('data-vt-persist');
    expect(canvasOf(container)).toBeNull();
  });

  it('puts the animated field on top once the code has arrived, hidden from assistive technology', async () => {
    const { container } = mount();
    await settle();
    const canvas = canvasOf(container);
    expect(canvas).not.toBeNull();
    expect(canvas).toHaveAttribute('aria-hidden', 'true');
    expect(canvas).toHaveClass('world__canvas');
  });

  it('never loads the field at the lowest effects tier', async () => {
    const { container } = mount({ tier: 'low' });
    await settle();
    expect(canvasOf(container)).toBeNull();
    expect(strokes).toBe(0);
  });

  it('takes the route as the base pose, and follows the address', async () => {
    mount({ route: '/settings' });
    expect(getPose().intensity).toBe(0.15);
    resetWorldStore();
    mount({ route: '/calls/abc' });
    expect(getPose().intensity).toBe(1);
  });

  it('renders nothing where 2D drawing is unavailable, leaving the gradient as the whole field', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const { container } = mount();
    await settle();
    expect(canvasOf(container)).toBeNull();
    expect(container.querySelector('.world')).not.toBeNull();
  });
});

describe('the field loop', () => {
  it('animates on a busy route and draws every frame it runs', async () => {
    const { container } = mount();
    await settle();
    expect(canvasOf(container)).toHaveAttribute('data-live');
    const before = strokes;
    advance(500);
    expect(strokes).toBeGreaterThan(before + 20);
    expect(composite).toContain('lighter');
  });

  it('draws one still frame and stops when ambient motion is paused', async () => {
    localStorage.setItem('firefly.ambient', JSON.stringify('paused'));
    const { container } = mount();
    await settle();
    advance(200); // the one queued still frame
    const drawn = strokes;
    expect(drawn).toBeGreaterThan(0);
    expect(canvasOf(container)).toHaveAttribute('data-live');
    advance(1000);
    expect(strokes).toBe(drawn);
    expect(frames.size).toBe(0);
  });

  it('is a still frame under reduced motion, and the mood still changes at once', async () => {
    function Mood({ tension }: { tension: number }) {
      useWorldPose({ tension });
      return null;
    }
    const { rerender } = mount({ reduce: true, children: <Mood tension={0.1} /> });
    await settle();
    advance(100);
    const first = strokes;
    advance(1000);
    expect(strokes).toBe(first);
    rerender(
      <ThemeProvider>
        <AmbientProvider>
          <PerfTierProvider tier="high" monitor={false}>
            <MemoryRouter initialEntries={['/calls/abc']}>
              <WorldLayer />
              <Mood tension={0.9} />
            </MemoryRouter>
          </PerfTierProvider>
        </AmbientProvider>
      </ThemeProvider>,
    );
    advance(100);
    expect(strokes).toBeGreaterThan(first); // redrawn once for the new pose
    const second = strokes;
    advance(1000);
    expect(strokes).toBe(second);
  });

  it('leaves a quiet route as one frame once it has settled, with no loop running', async () => {
    mount({ route: '/settings' });
    await settle();
    advance(3000);
    const drawn = strokes;
    expect(drawn).toBeGreaterThan(0);
    advance(2000);
    expect(strokes).toBe(drawn);
    expect(frames.size).toBe(0);
  });

  it('draws nothing when a route asks for no presence at all', async () => {
    function Off() {
      useWorldPose({ intensity: 0 });
      return null;
    }
    const { container } = mount({ children: <Off /> });
    await settle();
    advance(300);
    expect(canvasOf(container)).not.toHaveAttribute('data-live');
    expect(strokes).toBe(0);
  });

  it('stops when the tab is hidden and picks up again when it returns', async () => {
    mount();
    await settle();
    advance(200);
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    advance(100);
    const drawn = strokes;
    advance(1000);
    expect(strokes).toBe(drawn);
    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    advance(500);
    expect(strokes).toBeGreaterThan(drawn);
  });

  it('shows a discovery or a curveball only while it animates, and otherwise ignores the call', async () => {
    pulseWorld('discovery', { x: 0.5, y: 0.5 }); // nothing mounted: a quiet no-op
    mount();
    await settle();
    advance(100);
    expect(() => pulseWorld('discovery', { x: 0.5, y: 0.5 })).not.toThrow();
    expect(() => pulseWorld('curveball')).not.toThrow();
    advance(1000);
  });

  it('cleans up after itself: no frame is left running and nothing draws after it leaves', async () => {
    const { unmount } = mount();
    await settle();
    advance(100);
    unmount();
    const drawn = strokes;
    advance(500);
    expect(strokes).toBe(drawn);
    expect(frames.size).toBe(0);
  });
});

describe('WorldField on its own', () => {
  it('draws a still frame without a layer or a router', async () => {
    const { container } = render(
      <ThemeProvider>
        <AmbientProvider>
          <PerfTierProvider tier="medium" monitor={false}>
            <WorldField />
          </PerfTierProvider>
        </AmbientProvider>
      </ThemeProvider>,
    );
    expect(container.querySelector('canvas')).not.toBeNull();
    advance(200);
    expect(clears).toBeGreaterThan(0);
  });
});
