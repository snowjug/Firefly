import { act, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PerfTierProvider } from '../../lib/PerfTierProvider.tsx';
import type { PerfTier } from '../../lib/perf-tier.ts';
import { ThemeProvider } from '../../lib/theme.tsx';
import { SignalPresence } from './SignalPresence.tsx';
import { room } from './signal.fixtures.ts';
import type { PresenceProps } from './types.ts';

const BASE: PresenceProps = { atmosphere: room('calm'), discovered: 0, shifts: 0 };

interface Options {
  tier?: PerfTier;
  reduce?: boolean;
}

function mount(
  first: Partial<PresenceProps> = {},
  { tier = 'high', reduce = false }: Options = {},
) {
  if (reduce) localStorage.setItem('firefly.motion', JSON.stringify('reduce'));
  let current: PresenceProps = { ...BASE, ...first };
  const ui = (): ReactElement => (
    <ThemeProvider>
      <PerfTierProvider tier={tier}>
        <SignalPresence {...current} />
      </PerfTierProvider>
    </ThemeProvider>
  );
  const view = render(ui());
  return {
    view,
    update(next: Partial<PresenceProps>) {
      current = { ...current, ...next };
      view.rerender(ui());
    },
    root: () => view.container.querySelector('[data-sig="presence"]') as HTMLElement,
    edge: () => view.container.querySelector('.sig-edge-ring')?.getAttribute('d') ?? '',
  };
}

const frozenEdge = (props: Partial<PresenceProps>) => {
  const { container } = render(<SignalPresence {...BASE} {...props} frozen />);
  return container.querySelector('.sig-edge-ring')?.getAttribute('d') ?? '';
};

afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLElement.prototype, 'animate');
});

describe('SignalPresence: what it is', () => {
  it('is decoration: the chamber says the same things in words', () => {
    const { root } = mount();
    expect(root()).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('needs no ids and draws a small number of elements', () => {
    const { root } = mount({ atmosphere: room('escalating'), discovered: 7 });
    expect(root().querySelectorAll('[id]')).toHaveLength(0);
    expect(root().querySelectorAll('*').length).toBeLessThan(120);
  });

  it('carries the mood and the trend for styling, under its own names', () => {
    const { root, update } = mount({ atmosphere: room('angry', { trend: 'rising' }) });
    expect(root()).toHaveAttribute('data-sig-mood', 'angry');
    expect(root()).toHaveAttribute('data-sig-trend', 'rising');
    expect(root()).not.toHaveAttribute('data-mood');
    update({ atmosphere: room('calm') });
    expect(root()).toHaveAttribute('data-sig-mood', 'calm');
  });

  it('is the size it is asked for', () => {
    const { root } = mount({ size: 180 });
    expect(root().style.width).toBe('180px');
    expect(root().style.height).toBe('180px');
  });

  it('shows the neutral room when cues are off, and the edge is the calm one', () => {
    const neutral = room('calm', { mood: 'neutral' });
    const { root } = mount({ atmosphere: neutral });
    expect(root()).toHaveAttribute('data-sig-mood', 'neutral');
    expect(root()).toHaveAttribute('data-sig-jitter', '0');
  });

  it('has the tremor of the room: none when calm, more when tense, never past level three', () => {
    const level = (mood: Parameters<typeof room>[0]) =>
      mount({ atmosphere: room(mood) })
        .root()
        .getAttribute('data-sig-jitter');
    expect([
      level('calm'),
      level('concerned'),
      level('frustrated'),
      level('angry'),
      level('escalating'),
    ]).toEqual(['0', '0', '1', '2', '3']);
  });
});

describe('SignalPresence: the dormant dots', () => {
  const dots = (root: HTMLElement) => ({
    all: root.querySelectorAll('.sig-dot').length,
    lit: root.querySelectorAll('.sig-dot.is-lit').length,
  });

  it('has a fixed pool of seven by default, and lights as many as were found', () => {
    expect(dots(mount().root())).toEqual({ all: 7, lit: 0 });
    expect(dots(mount({ discovered: 3 }).root())).toEqual({ all: 7, lit: 3 });
  });

  it('never shows more lit than there are dots, and never reveals a total', () => {
    expect(dots(mount({ discovered: 99 }).root())).toEqual({ all: 7, lit: 7 });
    expect(dots(mount({ pool: 5, discovered: 2 }).root())).toEqual({ all: 5, lit: 2 });
    expect(dots(mount({ discovered: -4 }).root())).toEqual({ all: 7, lit: 0 });
    expect(mount({ discovered: 2 }).root().textContent).toBe('');
  });

  it('pulses the dot that was just found, not the ones already found when it appeared', () => {
    const { root, update } = mount({ discovered: 2 });
    expect(root().querySelector('.sig-dot__pulse')).toBeNull();
    update({ discovered: 3 });
    expect(root().querySelectorAll('.sig-dot__pulse')).toHaveLength(1);
    expect(root().querySelectorAll('.sig-dot.is-new')).toHaveLength(1);
    expect(root().querySelectorAll('.sig-dot.is-lit')).toHaveLength(3);
    update({ discovered: 4 });
    expect(root().querySelectorAll('.sig-dot__pulse')).toHaveLength(1);
    expect(root().querySelectorAll('.sig-dot.is-lit')).toHaveLength(4);
  });

  it('lights the dot at once with no pulse when motion is reduced, frozen, or the tier is low', () => {
    for (const options of [{ reduce: true }, { tier: 'low' as const }]) {
      const { root, update } = mount({}, options);
      update({ discovered: 1 });
      expect(root().querySelectorAll('.sig-dot.is-lit')).toHaveLength(1);
      expect(root().querySelector('.sig-dot__pulse')).toBeNull();
    }
    const { container } = render(<SignalPresence {...BASE} discovered={2} frozen />);
    expect(container.querySelectorAll('.sig-dot.is-lit')).toHaveLength(2);
    expect(container.querySelector('.sig-dot__pulse')).toBeNull();
  });
});

describe('SignalPresence: states', () => {
  it('wobbles the heart while the customer types, and stills it when they stop', () => {
    const { root, update } = mount({ typing: true });
    expect(root()).toHaveAttribute('data-typing');
    update({ typing: false });
    expect(root()).not.toHaveAttribute('data-typing');
  });

  it('marks a silent customer so the rings dim and stop', () => {
    const { root } = mount({ atmosphere: room('frustrated', { silent: true }) });
    expect(root()).toHaveAttribute('data-silent');
    expect(root().style.getPropertyValue('--sig-dim')).toBe('1.000');
  });

  it('is still (no animation, no timer) when frozen, when motion is reduced and at the low tier', () => {
    expect(mount({ frozen: true }).root()).toHaveAttribute('data-frozen');
    expect(mount({ frozen: true }).root()).toHaveAttribute('data-still');
    expect(mount({}, { reduce: true }).root()).toHaveAttribute('data-still');
    expect(mount({}, { tier: 'low' }).root()).toHaveAttribute('data-still');
    localStorage.clear();
    expect(mount({}).root()).not.toHaveAttribute('data-still');
  });
});

describe('SignalPresence: the kink', () => {
  let animate: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    animate = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true });
  });

  it('jolts the rings when the conversation changes, and not when it first appears', () => {
    const { update } = mount({ shifts: 2 });
    expect(animate).not.toHaveBeenCalled();
    update({ shifts: 3 });
    expect(animate).toHaveBeenCalledTimes(2);
    const keyframes = animate.mock.calls[0]?.[0] as unknown[];
    const options = animate.mock.calls[0]?.[1] as { duration: number };
    expect(keyframes.length).toBeGreaterThanOrEqual(3);
    expect(options.duration).toBeLessThanOrEqual(900);
  });

  it('does not repeat for the same count, nor when the count falls', () => {
    const { update } = mount({ shifts: 1 });
    update({ shifts: 2 });
    animate.mockClear();
    update({ shifts: 2, discovered: 1 });
    update({ shifts: 0 });
    expect(animate).not.toHaveBeenCalled();
  });

  it('only changes the pose, with no animation, when motion is reduced or the presence is frozen', () => {
    const reduced = mount({ shifts: 0 }, { reduce: true });
    reduced.update({ shifts: 1 });
    const frozen = mount({ shifts: 0, frozen: true });
    frozen.update({ shifts: 1 });
    expect(animate).not.toHaveBeenCalled();
  });
});

describe('SignalPresence: moving between moods', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  });

  it('costs nothing while nothing changes: no frame loop at all', () => {
    mount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('glides to a new mood over the next frames, then stops its loop', async () => {
    const { edge, update } = mount();
    const calm = edge();
    update({ atmosphere: room('escalating') });
    expect(edge()).toBe(calm);
    expect(vi.getTimerCount()).toBe(1);

    await act(async () => {
      vi.advanceTimersByTime(120);
    });
    const midway = edge();
    expect(midway).not.toBe(calm);
    expect(midway).not.toBe(frozenEdge({ atmosphere: room('escalating') }));

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(edge()).toBe(frozenEdge({ atmosphere: room('escalating') }));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('is slower to ease than to tighten', async () => {
    const tighten = mount();
    tighten.update({ atmosphere: room('angry') });
    const target = frozenEdge({ atmosphere: room('angry') });
    let tightenedAfter = 0;
    for (let t = 0; t < 4000 && tighten.edge() !== target; t += 16) {
      await act(async () => {
        vi.advanceTimersByTime(16);
      });
      tightenedAfter = t;
    }

    const ease = mount({ atmosphere: room('angry') });
    ease.update({ atmosphere: room('calm') });
    const calm = frozenEdge({ atmosphere: room('calm') });
    let easedAfter = 0;
    for (let t = 0; t < 6000 && ease.edge() !== calm; t += 16) {
      await act(async () => {
        vi.advanceTimersByTime(16);
      });
      easedAfter = t;
    }
    expect(easedAfter).toBeGreaterThan(tightenedAfter * 1.4);
  });

  it('retargets in the middle of a move without a jump', async () => {
    const { edge, update } = mount();
    update({ atmosphere: room('angry') });
    await act(async () => {
      vi.advanceTimersByTime(160);
    });
    const midway = edge();
    update({ atmosphere: room('calm') });
    expect(edge()).toBe(midway);
    await act(async () => {
      vi.advanceTimersByTime(4000);
    });
    expect(edge()).toBe(frozenEdge({ atmosphere: room('calm') }));
  });

  it('goes straight to the new mood, with no frame loop, when motion is reduced', () => {
    const { edge, update } = mount({}, { reduce: true });
    update({ atmosphere: room('escalating') });
    expect(edge()).toBe(frozenEdge({ atmosphere: room('escalating') }));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('goes straight to the new mood at the lowest tier too', () => {
    const { edge, update } = mount({}, { tier: 'low' });
    update({ atmosphere: room('angry') });
    expect(edge()).toBe(frozenEdge({ atmosphere: room('angry') }));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not replay a move after the tab was hidden: it jumps to the end', async () => {
    const { edge, update } = mount();
    update({ atmosphere: room('escalating') });
    await act(async () => {
      vi.advanceTimersByTime(16);
    });
    await act(async () => {
      vi.advanceTimersByTime(900);
    });
    expect(edge()).toBe(frozenEdge({ atmosphere: room('escalating') }));
  });
});

describe('SignalPresence: the colour of the room', () => {
  const scope = (root: HTMLElement) => root.querySelector('.sig-drift--outer') as HTMLElement;

  it('moves along the mood colours with the tension, and cools when it eases', () => {
    const hue = (mood: Parameters<typeof room>[0], over = {}) =>
      Number(
        scope(mount({ atmosphere: room(mood, over), frozen: true }).root()).style.getPropertyValue(
          '--sig-hue',
        ),
      );
    expect(hue('calm')).toBe(0);
    expect(hue('concerned')).toBeCloseTo(0.25, 2);
    expect(hue('frustrated')).toBeCloseTo(0.5, 2);
    expect(hue('angry')).toBeCloseTo(0.75, 2);
    expect(hue('escalating')).toBeCloseTo(1, 2);
    expect(hue('angry', { recovering: true })).toBeLessThan(0.2);
    const cool = Number(
      scope(
        mount({ atmosphere: room('angry', { recovering: true }), frozen: true }).root(),
      ).style.getPropertyValue('--sig-cool'),
    );
    expect(cool).toBeGreaterThan(0.5);
  });

  it('keeps the colour numbers off the root: they change every frame of a move', () => {
    const { root } = mount({ atmosphere: room('angry'), frozen: true });
    expect(root().style.getPropertyValue('--sig-hue')).toBe('');
    expect(root().style.getPropertyValue('--sig-glow')).toBe('');
    // Only what draws in the accent carries them: the glow, the edge ring and the heart.
    expect(root().querySelectorAll('.sig-accent')).toHaveLength(3);
    for (const element of root().querySelectorAll<HTMLElement>('.sig-accent')) {
      expect(element.style.getPropertyValue('--sig-hue')).not.toBe('');
    }
  });
});

describe('SignalPresence: where the idle animation lives', () => {
  it('runs it on div wrappers, never on an svg root (a div animation is composited)', () => {
    const { root } = mount();
    expect(root().querySelectorAll('svg[data-ambient]')).toHaveLength(0);
    const ambient = Array.from(root().querySelectorAll('[data-ambient]'));
    expect(ambient.length).toBeGreaterThanOrEqual(3);
    for (const element of ambient) expect(element.tagName).toBe('DIV');
  });
});

describe('SignalPresence: cost', () => {
  it('does no work at all when its parent re-renders with equal props (a keystroke elsewhere)', () => {
    const { root, update } = mount({ discovered: 2 });
    const records: MutationRecord[] = [];
    const observer = new MutationObserver((batch) => records.push(...batch));
    observer.observe(root(), {
      subtree: true,
      attributes: true,
      childList: true,
      characterData: true,
    });
    update({ atmosphere: { ...BASE.atmosphere }, discovered: 2 });
    update({ atmosphere: { ...BASE.atmosphere }, discovered: 2 });
    expect([...records, ...observer.takeRecords()]).toHaveLength(0);
    observer.disconnect();
  });
});
