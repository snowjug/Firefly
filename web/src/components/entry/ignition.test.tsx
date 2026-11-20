import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PerfTierProvider, type PerfTierProviderProps } from '../../lib/PerfTierProvider.tsx';
import { ThemeProvider } from '../../lib/theme.tsx';
import {
  IGNITION_KEY,
  IGNITION_MS,
  ignitionAvailable,
  markIgnitionSeen,
  resetIgnition,
  useIgnition,
} from './ignition.ts';

function Probe() {
  const { playing, skipped } = useIgnition();
  return <p data-testid="state">{playing ? 'playing' : skipped ? 'skipped' : 'rest'}</p>;
}

function renderProbe(tier: PerfTierProviderProps['tier'] = 'high', extra?: ReactNode) {
  return render(
    <ThemeProvider>
      <PerfTierProvider tier={tier}>
        <Probe />
        {extra}
      </PerfTierProvider>
    </ThemeProvider>,
  );
}

const state = () => screen.getByTestId('state').textContent;
const stored = () => localStorage.getItem(IGNITION_KEY);
// One frame at 60 Hz, which is when fake timers run a requestAnimationFrame callback.
const FRAME = 16;

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('the front door introduction', () => {
  it('is there to play until it has been seen, and can be made to play again', () => {
    expect(ignitionAvailable()).toBe(true);
    markIgnitionSeen();
    expect(ignitionAvailable()).toBe(false);
    resetIgnition();
    expect(ignitionAvailable()).toBe(true);
  });

  it('plays on the first visit, is marked as seen at once and ends by itself', () => {
    renderProbe();
    expect(state()).toBe('playing');
    // Marked as it starts, so a reload part-way through does not play it a second time.
    expect(stored()).toBe('"seen"');

    // Its time counts from the first frame.
    act(() => vi.advanceTimersByTime(FRAME));
    act(() => vi.advanceTimersByTime(IGNITION_MS - 1));
    expect(state()).toBe('playing');
    act(() => vi.advanceTimersByTime(2));
    expect(state()).toBe('rest');
  });

  it('does not run out before anything has been drawn', () => {
    // A page that is slow to start has not had a frame yet: nothing counts down.
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
    renderProbe();
    act(() => vi.advanceTimersByTime(IGNITION_MS * 3));
    expect(state()).toBe('playing');
    raf.mockRestore();
  });

  it('does not play again on a device that has seen it', () => {
    markIgnitionSeen();
    renderProbe();
    expect(state()).toBe('rest');
  });

  it('ends at once on any key or any press, and says it was skipped', () => {
    const first = renderProbe();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
    });
    expect(state()).toBe('skipped');
    first.unmount();

    localStorage.clear();
    renderProbe();
    expect(state()).toBe('playing');
    act(() => {
      window.dispatchEvent(new Event('pointerdown'));
    });
    expect(state()).toBe('skipped');
  });

  it('never plays with reduced motion, and leaves the flag alone so it is not used up', () => {
    localStorage.setItem('firefly.motion', JSON.stringify('reduce'));
    renderProbe();
    expect(state()).toBe('rest');
    expect(stored()).toBeNull();
  });

  it('never plays on the cheapest effects tier', () => {
    renderProbe('low');
    expect(state()).toBe('rest');
    expect(stored()).toBeNull();
  });

  it('does not play where nothing can be remembered, rather than playing on every visit', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(ignitionAvailable()).toBe(false);
    renderProbe();
    expect(state()).toBe('rest');
  });

  it('stops listening once it has ended', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    renderProbe();
    act(() => vi.advanceTimersByTime(FRAME + IGNITION_MS + 1));
    expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function), true);
    expect(remove).toHaveBeenCalledWith('pointerdown', expect.any(Function), true);
  });
});
