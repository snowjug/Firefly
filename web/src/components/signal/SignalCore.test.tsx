import { act, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PerfTierProvider } from '../../lib/PerfTierProvider.tsx';
import type { PerfTier } from '../../lib/perf-tier.ts';
import { ThemeProvider } from '../../lib/theme.tsx';
import { coreParams, type CoreParams } from '../atlas/core-params.ts';
import { makeScenario } from '../scenario/scenario-fixtures.ts';
import { defaultChoices, type SetupChoices } from '../scenario/setup-model.ts';
import { SignalCore, type SignalCoreProps } from './SignalCore.tsx';
import { describeCore } from './describe.ts';
import { heartPath } from './geometry.ts';
import { traits } from './signal.fixtures.ts';

const choices = (over: Partial<SetupChoices> = {}): SetupChoices => ({
  ...defaultChoices(makeScenario()),
  ...over,
});
const params = (over: Partial<SetupChoices> = {}): CoreParams => coreParams(choices(over));
const coreTraits = (over: Parameters<typeof traits>[0] = {}) =>
  traits({ stage: 'first-contact', status: 'new', minutes: 10, ...over });

const BASE: SignalCoreProps = { traits: coreTraits(), params: params() };

function mount(
  first: Partial<SignalCoreProps> = {},
  { tier = 'high', reduce = false }: { tier?: PerfTier; reduce?: boolean } = {},
) {
  if (reduce) localStorage.setItem('firefly.motion', JSON.stringify('reduce'));
  let current: SignalCoreProps = { ...BASE, ...first };
  const ui = (): ReactElement => (
    <ThemeProvider>
      <PerfTierProvider tier={tier}>
        <SignalCore {...current} />
      </PerfTierProvider>
    </ThemeProvider>
  );
  const view = render(ui());
  const root = () => view.container.querySelector('[data-sig="core"]') as HTMLElement;
  return {
    view,
    root,
    update(next: Partial<SignalCoreProps>) {
      current = { ...current, ...next };
      view.rerender(ui());
    },
    ring: (index: number) => root().querySelectorAll('.sig-inner-ring')[index],
    edge: () => root().querySelector('.sig-edge-ring')?.getAttribute('d') ?? '',
  };
}

afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLElement.prototype, 'animate');
  Reflect.deleteProperty(SVGElement.prototype, 'animate');
});

describe('SignalCore: what it says', () => {
  it('is one image named by a description built from the same inputs', () => {
    mount({ traits: coreTraits({ minutes: 12 }), params: params({ impact: 'high' }) });
    expect(
      screen.getByRole('img', {
        name: describeCore(coreTraits({ minutes: 12 }), params({ impact: 'high' })),
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('12 of 15 engraved');
  });

  it('lets the page name it instead', () => {
    mount({ label: 'The scenario core for Locked out' });
    expect(
      screen.getByRole('img', { name: 'The scenario core for Locked out' }),
    ).toBeInTheDocument();
  });

  it('follows the parameters in its description when they change', () => {
    const { update } = mount({}, { reduce: true });
    update({ params: params({ difficulty: 'challenge', startingTemperature: 'angry' }) });
    const label = screen.getByRole('img').getAttribute('aria-label') ?? '';
    expect(label).toContain('challenge, 3 rings');
    expect(label).toContain('angry, a serrated edge');
  });

  it('letters its six parts A to F, for the legend', () => {
    const { root } = mount();
    expect(
      Array.from(root().querySelectorAll('.sig-mark')).map((mark) => mark.textContent),
    ).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    expect(root().querySelector('.sig-marks')).toHaveAttribute('aria-hidden', 'true');
  });

  it('is small enough to be cheap: no ids, under 400 elements', () => {
    const { root } = mount({
      params: params({ difficulty: 'challenge' }),
      traits: coreTraits({ minutes: 15 }),
    });
    expect(root().querySelectorAll('[id]')).toHaveLength(0);
    expect(root().querySelectorAll('*').length).toBeLessThan(400);
  });

  it('runs its slow drift on a div, never on an svg root (a div animation is composited)', () => {
    const { root } = mount();
    expect(root().querySelectorAll('svg[data-ambient]')).toHaveLength(0);
    const ambient = Array.from(root().querySelectorAll('[data-ambient]'));
    expect(ambient).toHaveLength(1);
    expect(ambient[0]?.tagName).toBe('DIV');
  });

  it('keeps the colour numbers off the root, on the parts drawn in the accent', () => {
    const { root } = mount();
    expect(root().style.getPropertyValue('--sig-hue')).toBe('');
    expect(root().querySelectorAll('.sig-accent').length).toBe(4);
  });
});

describe('SignalCore: what is engraved', () => {
  it('engraves one tick per minute, the rest as ghosts, and numerals at 5, 10 and 15', () => {
    const { root } = mount({ traits: coreTraits({ minutes: 7 }) });
    const lit = root().querySelector('.sig-minute:not(.sig-minute--off)')?.getAttribute('d') ?? '';
    const ghost = root().querySelector('.sig-minute--off')?.getAttribute('d') ?? '';
    expect(lit.split('M').filter(Boolean)).toHaveLength(7);
    expect(ghost.split('M').filter(Boolean)).toHaveLength(8);
    expect(Array.from(root().querySelectorAll('.sig-numeral')).map((n) => n.textContent)).toEqual([
      '5',
      '10',
      '15',
    ]);
    expect(root().querySelectorAll('.sig-numeral.is-on')).toHaveLength(1);
  });

  it('lights the pressure band by impact: 5, 15 and 24 of 24 segments', () => {
    const lit = (impact: SetupChoices['impact']) => {
      const { root } = mount({ params: params({ impact }) });
      return Array.from(root().querySelectorAll('.sig-band__segment')).filter(
        (segment) => Number(segment.getAttribute('stroke-opacity')) > 0.9,
      ).length;
    };
    expect(root24()).toBe(24);
    expect(lit('low')).toBe(5);
    expect(lit('medium')).toBe(15);
    expect(lit('high')).toBe(24);

    function root24() {
      return mount().root().querySelectorAll('.sig-band__segment').length;
    }
  });

  it('shows the call stage as the heart shape and the status as its fill', () => {
    const heart = (over: Parameters<typeof coreTraits>[0]) => {
      const { root } = mount({ traits: coreTraits(over) });
      const outline = root().querySelector('.sig-heart');
      return {
        d: outline?.getAttribute('d'),
        solid: outline?.classList.contains('is-solid'),
        half: root().querySelector('.sig-heart-half') !== null,
      };
    };
    expect(heart({ stage: 'escalated', status: 'new' })).toEqual({
      d: heartPath('escalated', 16),
      solid: false,
      half: false,
    });
    expect(heart({ stage: 'closure', status: 'attempted' })).toMatchObject({
      solid: false,
      half: true,
    });
    expect(heart({ stage: 'follow-up', status: 'completed' })).toMatchObject({
      solid: true,
      half: false,
    });
  });

  it('shows a fixed pool of dormant dots by difficulty (3, 5, 7) and never a number', () => {
    const present = (difficulty: SetupChoices['difficulty']) => {
      const { root } = mount({ params: params({ difficulty }) });
      return Array.from(root().querySelectorAll('.sig-dot__ring'))
        .map((ring) => Number(ring.parentElement?.getAttribute('opacity')))
        .filter((opacity) => opacity > 0.99).length;
    };
    expect(present('starter')).toBe(3);
    expect(present('standard')).toBe(5);
    expect(present('challenge')).toBe(7);
    const { root } = mount({ params: params({ difficulty: 'challenge' }) });
    expect(root().textContent).not.toMatch(/dormant|hidden|signals/i);
  });

  it('adds rings with the difficulty: the second and third arrive at their own difficulty', () => {
    const rings = (difficulty: SetupChoices['difficulty']) => {
      const { ring } = mount({ params: params({ difficulty }) });
      return [0, 1].map((i) => Number((ring(i) as SVGElement | undefined)?.style.opacity));
    };
    expect(rings('starter')).toEqual([0, 0]);
    expect(rings('standard')).toEqual([1, 0]);
    expect(rings('challenge')).toEqual([1, 1]);
  });

  it('points the needle further round for a more heated start', () => {
    const needle = (startingTemperature: SetupChoices['startingTemperature']) => {
      const { root } = mount({ params: params({ startingTemperature }) });
      const transform =
        root().querySelector('.sig-needle')?.parentElement?.getAttribute('transform') ?? '';
      return Number(/rotate\((-?[\d.]+)\)/.exec(transform)?.[1]);
    };
    expect(needle('calm')).toBe(-60);
    expect(needle('angry')).toBe(60);
    expect(needle('anxious')).toBeGreaterThan(needle('calm'));
    expect(needle('frustrated')).toBeGreaterThan(needle('anxious'));
  });

  it('gives the edge the texture of the start: smooth, round, long-short, serrated', () => {
    const dash = (startingTemperature: SetupChoices['startingTemperature']) => {
      const { root } = mount({ params: params({ startingTemperature }) });
      const edge = root().querySelector('.sig-edge-ring');
      return {
        gap: Number(edge?.getAttribute('stroke-dasharray')?.split(' ')[1]),
        cap: edge?.getAttribute('stroke-linecap'),
      };
    };
    expect(dash('calm').gap).toBe(0);
    expect(dash('anxious').cap).toBe('round');
    expect(dash('frustrated')).toMatchObject({ cap: 'butt' });
    expect(dash('frustrated').gap).toBeGreaterThan(2);
  });
});

describe('SignalCore: following the settings', () => {
  it('goes straight to the new settings, with no timer, when motion is reduced', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    const { edge, update, root } = mount({}, { reduce: true });
    const before = edge();
    update({ params: params({ startingTemperature: 'angry' }) });
    expect(edge()).not.toBe(before);
    expect(vi.getTimerCount()).toBe(0);
    expect(root()).toHaveAttribute('data-still');
  });

  describe('with motion', () => {
    beforeEach(() => {
      vi.useFakeTimers({
        toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'],
      });
    });

    it('costs nothing at rest and says nothing at mount', () => {
      const onSettled = vi.fn();
      mount({ onSettled });
      expect(vi.getTimerCount()).toBe(0);
      expect(onSettled).not.toHaveBeenCalled();
    });

    it('glides to the new settings, then stops its loop and says it has settled once', async () => {
      const onSettled = vi.fn();
      const { edge, update } = mount({ onSettled });
      const first = edge();
      update({ params: params({ startingTemperature: 'angry', difficulty: 'challenge' }) });
      expect(edge()).toBe(first);
      expect(vi.getTimerCount()).toBe(1);
      await act(async () => {
        vi.advanceTimersByTime(150);
      });
      const midway = edge();
      expect(midway).not.toBe(first);
      expect(onSettled).not.toHaveBeenCalled();
      await act(async () => {
        vi.advanceTimersByTime(4000);
      });
      expect(edge()).not.toBe(midway);
      expect(onSettled).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('ends on exactly the pose the settings call for', async () => {
      const direct = mount(
        { params: params({ startingTemperature: 'frustrated', impact: 'high' }) },
        { reduce: true },
      );
      const target = direct.edge();
      localStorage.clear();
      const { edge, update } = mount();
      update({ params: params({ startingTemperature: 'frustrated', impact: 'high' }) });
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
      expect(edge()).toBe(target);
    });
  });

  it('is still at the lowest tier', () => {
    expect(mount({}, { tier: 'low' }).root()).toHaveAttribute('data-still');
    expect(mount({}).root()).not.toHaveAttribute('data-still');
  });

  it('can be quieted for the settle into a call', () => {
    const { root, update } = mount({ quiet: true });
    expect(root()).toHaveAttribute('data-quiet');
    update({ quiet: false });
    expect(root()).not.toHaveAttribute('data-quiet');
  });
});

describe('SignalCore: the entrance', () => {
  let animate: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    animate = vi.fn(() => ({ cancel: vi.fn() }));
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true });
    Object.defineProperty(SVGElement.prototype, 'animate', { value: animate, configurable: true });
  });

  it('writes itself in: lines draw along their length, the rest fades up', () => {
    mount();
    const keyframes = animate.mock.calls.map((call) => JSON.stringify(call[0]));
    expect(keyframes.some((frames) => frames.includes('strokeDashoffset'))).toBe(true);
    expect(keyframes.some((frames) => frames.includes('"opacity":0'))).toBe(true);
    const durations = animate.mock.calls.map(
      (call) => call[1] as { duration: number; delay?: number },
    );
    for (const { duration, delay = 0 } of durations)
      expect(duration + delay).toBeLessThanOrEqual(800);
  });

  it('does not, when the page owns the entrance (data-no-enter on the core or above it)', () => {
    const { container } = render(
      <div data-no-enter="">
        <ThemeProvider>
          <PerfTierProvider tier="high">
            <SignalCore {...BASE} />
          </PerfTierProvider>
        </ThemeProvider>
      </div>,
    );
    expect(container.querySelector('[data-sig="core"]')).not.toBeNull();
    expect(animate).not.toHaveBeenCalled();
  });

  it('does not when motion is reduced or at the lowest tier', () => {
    mount({}, { reduce: true });
    mount({}, { tier: 'low' });
    expect(animate).not.toHaveBeenCalled();
  });

  it('cancels what it started when it goes away', () => {
    const cancel = vi.fn();
    animate.mockImplementation(() => ({ cancel }));
    const { view } = mount();
    view.unmount();
    expect(cancel).toHaveBeenCalled();
  });
});
