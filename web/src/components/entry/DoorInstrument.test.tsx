import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PerfTierProvider } from '../../lib/PerfTierProvider.tsx';
import { ThemeProvider } from '../../lib/theme.tsx';
import { DoorInstrument } from './DoorInstrument.tsx';
import { IGNITION_KEY, IGNITION_MS, markIgnitionSeen } from './ignition.ts';

function renderDoor(tier: 'high' | 'low' = 'high') {
  return render(
    <ThemeProvider>
      <PerfTierProvider tier={tier}>
        <DoorInstrument />
      </PerfTierProvider>
    </ThemeProvider>,
  );
}

const door = (container: HTMLElement) => container.querySelector('.door-instrument') as HTMLElement;

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('DoorInstrument', () => {
  it('is an image with a name, and its decoration stays out of the accessibility tree', () => {
    const { container } = renderDoor();
    expect(screen.getByRole('img', { name: /signal instrument/i })).toBeVisible();
    expect(container.querySelector('.door-instrument__bloom')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(container.querySelector('.sig-marks')).toHaveAttribute('aria-hidden', 'true');
  });

  it('is lit on the first visit: it plays, then rests, and the core is told not to enter on its own after', () => {
    const { container } = renderDoor();
    expect(door(container)).toHaveAttribute('data-ignition', 'playing');
    expect(door(container)).not.toHaveAttribute('data-no-enter');
    expect(localStorage.getItem(IGNITION_KEY)).toBe('"seen"');

    act(() => vi.advanceTimersByTime(IGNITION_MS + 40));
    expect(door(container)).toHaveAttribute('data-ignition', 'rest');
    expect(door(container)).toHaveAttribute('data-no-enter');
  });

  it('is simply there on every later visit: nothing plays and nothing is engraved', () => {
    markIgnitionSeen();
    const { container } = renderDoor();
    expect(door(container)).toHaveAttribute('data-ignition', 'rest');
    expect(door(container)).toHaveAttribute('data-no-enter');
  });

  it('skips to rest on a key press, and starts the instrument again at rest', () => {
    const { container } = renderDoor();
    const before = container.querySelector('.sig-core');
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(door(container)).toHaveAttribute('data-ignition', 'rest');
    expect(container.querySelector('.sig-core')).not.toBe(before);
    expect(door(container)).toHaveAttribute('data-no-enter');
  });

  it('does not play with reduced motion or on the cheapest effects tier', () => {
    localStorage.setItem('firefly.motion', JSON.stringify('reduce'));
    const reduced = renderDoor();
    expect(door(reduced.container)).toHaveAttribute('data-ignition', 'rest');
    reduced.unmount();

    localStorage.clear();
    const low = renderDoor('low');
    expect(door(low.container)).toHaveAttribute('data-ignition', 'rest');
    expect(localStorage.getItem(IGNITION_KEY)).toBeNull();
  });
});
