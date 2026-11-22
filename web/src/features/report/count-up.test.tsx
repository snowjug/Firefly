import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubMedia, stubRaf } from '../../design/interaction/test-utils.ts';
import { CountUp, tokenMs } from './count-up.tsx';
import { stubIntersectionObserver } from './test-utils.tsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('style');
});

const number = (container: HTMLElement) => container.querySelector('.rp-count') as HTMLElement;

describe('a number that counts up', () => {
  it('keeps its real value as its text from the first render to the last, and changes no text while it counts', () => {
    const raf = stubRaf();
    const { container } = render(
      <p>
        Signal <CountUp text="4.2" /> of 5
      </p>,
    );
    const watcher = new MutationObserver(() => undefined);
    watcher.observe(container, { childList: true, characterData: true, subtree: true });

    expect(container).toHaveTextContent('Signal 4.2 of 5');
    expect(number(container)).toHaveAttribute('data-counting');
    for (const at of [1000, 1100, 1250, 1400, 1800]) {
      raf.frame(at);
      expect(container).toHaveTextContent('Signal 4.2 of 5');
    }
    expect(number(container)).not.toHaveAttribute('data-counting');
    expect(container).toHaveTextContent('Signal 4.2 of 5');
    // Only attributes changed: no node was added or removed and no text was written, so nothing was
    // read out by a screen reader's live region.
    expect(watcher.takeRecords().filter((record) => record.type !== 'attributes')).toEqual([]);
    watcher.disconnect();
  });

  it('stands at 0.0, counts up to the value over the duration without passing it, and leaves nothing behind', () => {
    const raf = stubRaf();
    const { container } = render(<CountUp text="4.2" />);
    const el = number(container);
    expect(el).toHaveAttribute('data-shown', '0.0');

    raf.frame(1000);
    expect(el).toHaveAttribute('data-shown', '0.0');
    const seen: number[] = [];
    for (const at of [1050, 1100, 1200, 1300, 1400]) {
      raf.frame(at);
      seen.push(Number(el.getAttribute('data-shown') ?? '4.2'));
    }
    expect(seen[0]).toBeGreaterThan(0);
    // Always rising, and never past the value.
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(Math.max(...seen)).toBeLessThanOrEqual(4.2);
    expect(el).not.toHaveAttribute('data-counting');
    expect(el).not.toHaveAttribute('data-shown');
    expect(raf.pending()).toBe(0);
  });

  it('counts a whole number in whole numbers', () => {
    const raf = stubRaf();
    const { container } = render(<CountUp text="3" />);
    const el = number(container);
    expect(el).toHaveAttribute('data-shown', '0');
    raf.frame(0);
    raf.frame(100);
    expect(el.getAttribute('data-shown')).toMatch(/^\d$/);
    raf.frame(500);
    expect(el).not.toHaveAttribute('data-counting');
  });

  it('begins a step into the stagger, not before', () => {
    const raf = stubRaf();
    const { container } = render(<CountUp text="4" step={4} />);
    const el = number(container);
    raf.frame(0);
    // Four steps of 40 ms are a pause at the start.
    raf.frame(150);
    expect(el).toHaveAttribute('data-shown', '0');
    raf.frame(260);
    expect(Number(el.getAttribute('data-shown'))).toBeGreaterThan(0);
  });

  it('shows the real value and nothing else when motion is reduced', () => {
    stubMedia({ '(prefers-reduced-motion: reduce)': true });
    const raf = stubRaf();
    const { container } = render(<CountUp text="4.2" />);
    expect(number(container)).not.toHaveAttribute('data-counting');
    expect(number(container)).not.toHaveAttribute('data-shown');
    expect(raf.requested()).toBe(0);
    expect(container).toHaveTextContent('4.2');
  });

  it('waits at 0 until it is first seen, and then counts once', () => {
    const observer = stubIntersectionObserver();
    const raf = stubRaf();
    const { container } = render(<CountUp text="4.2" />);
    const el = number(container);
    expect(el).toHaveAttribute('data-shown', '0.0');
    expect(raf.requested()).toBe(0);
    act(() => {
      observer.observer().reportElement(el, true);
    });
    expect(raf.requested()).toBeGreaterThan(0);
    raf.frame(0);
    raf.frame(1000);
    expect(el).not.toHaveAttribute('data-counting');
    observer.restore();
  });

  it('has nothing to count for a value that is not above zero', () => {
    const raf = stubRaf();
    const { container } = render(<CountUp text="0" />);
    expect(number(container)).not.toHaveAttribute('data-counting');
    expect(raf.requested()).toBe(0);
  });

  it('stops counting, without a trace, when it leaves the page', () => {
    const raf = stubRaf();
    const { container, unmount } = render(<CountUp text="4.2" />);
    expect(number(container)).toHaveAttribute('data-counting');
    unmount();
    expect(raf.pending()).toBe(0);
  });
});

describe('reading a duration from a token', () => {
  it('reads seconds and milliseconds, and answers the fallback where there is no stylesheet or no such token', () => {
    expect(tokenMs('--dur-slower', 400)).toBe(400);
    document.documentElement.style.setProperty('--dur-slower', '0.25s');
    expect(tokenMs('--dur-slower', 400)).toBe(250);
    document.documentElement.style.setProperty('--dur-slower', '0.01ms');
    expect(tokenMs('--dur-slower', 400)).toBe(0.01);
    document.documentElement.style.setProperty('--dur-slower', 'soon');
    expect(tokenMs('--dur-slower', 400)).toBe(400);
  });
});
