import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useScrolled } from './use-scrolled.ts';
import { stubRaf } from './test-utils.ts';

afterEach(() => {
  Reflect.deleteProperty(window, 'scrollY');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Moves the page to a scroll position and tells listeners, as the browser does. */
function scrollTo(y: number) {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
  act(() => {
    window.dispatchEvent(new Event('scroll'));
  });
}

describe('useScrolled', () => {
  it('is false at the top of the page', () => {
    stubRaf();
    const { result } = renderHook(() => useScrolled());
    expect(result.current).toBe(false);
  });

  it('is already true on the first render of a page that was restored part-way down', () => {
    stubRaf();
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 300 });
    const { result } = renderHook(() => useScrolled());
    expect(result.current).toBe(true);
  });

  it('turns true past 8px and false again at the top, one frame after the scroll', () => {
    const raf = stubRaf();
    const { result } = renderHook(() => useScrolled());
    scrollTo(8);
    raf.frame(16);
    expect(result.current).toBe(false);
    scrollTo(9);
    expect(result.current).toBe(false);
    raf.frame(32);
    expect(result.current).toBe(true);
    scrollTo(0);
    raf.frame(48);
    expect(result.current).toBe(false);
  });

  it('uses the threshold it is given', () => {
    const raf = stubRaf();
    const { result } = renderHook(() => useScrolled(100));
    scrollTo(60);
    raf.frame(16);
    expect(result.current).toBe(false);
    scrollTo(101);
    raf.frame(32);
    expect(result.current).toBe(true);
  });

  it('asks for one frame however many scroll events arrive', () => {
    const raf = stubRaf();
    renderHook(() => useScrolled());
    scrollTo(20);
    scrollTo(40);
    scrollTo(60);
    expect(raf.requested()).toBe(1);
  });

  it('renders again only when the answer flips, never on every scroll', () => {
    const raf = stubRaf();
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return useScrolled();
    });
    const before = renders;
    for (const [index, y] of [20, 50, 400, 900, 1200].entries()) {
      scrollTo(y);
      raf.frame(16 * (index + 1));
    }
    expect(renders - before).toBe(1);
    scrollTo(0);
    raf.frame(200);
    expect(renders - before).toBe(2);
  });

  it('cancels its pending frame and stops listening when it unmounts', () => {
    const raf = stubRaf();
    const { unmount } = renderHook(() => useScrolled());
    scrollTo(50);
    expect(raf.pending()).toBe(1);
    unmount();
    expect(raf.pending()).toBe(0);
    scrollTo(0);
    expect(raf.requested()).toBe(1);
  });
});
