import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInViewOnce, useOnScreen, type InViewOptions } from './use-in-view.ts';

class FakeObserver {
  static all: FakeObserver[] = [];
  readonly callback: IntersectionObserverCallback;
  readonly options: IntersectionObserverInit | undefined;
  readonly observed = new Set<Element>();
  private target: Element | null = null;
  disconnected = false;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    FakeObserver.all.push(this);
  }
  observe(element: Element) {
    this.observed.add(element);
    this.target = element;
  }
  unobserve(element: Element) {
    this.observed.delete(element);
  }
  disconnect() {
    this.observed.clear();
    this.disconnected = true;
  }
  takeRecords() {
    return [];
  }
  /** Tells the hook that its element has entered or left the window. */
  report(isIntersecting: boolean) {
    const target = this.target;
    if (!target) throw new Error('Nothing was observed');
    act(() => {
      this.callback([{ isIntersecting, target } as IntersectionObserverEntry], this as never);
    });
  }
}

beforeEach(() => {
  FakeObserver.all = [];
  vi.stubGlobal('IntersectionObserver', FakeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const latest = () => {
  const observer = FakeObserver.all.at(-1);
  if (!observer) throw new Error('No observer was created');
  return observer;
};

function Once({ options, version = 0 }: { options?: InViewOptions; version?: number }) {
  const [ref, seen] = useInViewOnce<HTMLElement>(options);
  return (
    <section key={version} ref={ref} data-testid="target" data-seen={String(seen)}>
      Section
    </section>
  );
}

function Live({ options, version = 0 }: { options?: InViewOptions; version?: number }) {
  const [ref, onScreen] = useOnScreen<HTMLElement>(options);
  return (
    <section key={version} ref={ref} data-testid="target" data-on-screen={String(onScreen)}>
      Section
    </section>
  );
}

const target = () => screen.getByTestId('target');

describe('useInViewOnce', () => {
  it('is false until the element has been seen, then true for good', () => {
    render(<Once />);
    expect(target()).toHaveAttribute('data-seen', 'false');
    latest().report(false);
    expect(target()).toHaveAttribute('data-seen', 'false');
    latest().report(true);
    expect(target()).toHaveAttribute('data-seen', 'true');
    latest().report(false);
    expect(target()).toHaveAttribute('data-seen', 'true');
  });

  it('observes the element it is attached to, and stops once it has been seen', () => {
    render(<Once />);
    expect([...latest().observed]).toEqual([target()]);
    latest().report(true);
    expect(latest().disconnected).toBe(true);
  });

  it('counts any part of the element as seen by default, so tall elements and one at the end of a page count too', () => {
    render(<Once />);
    expect(latest().options).toEqual({ threshold: 0, rootMargin: '0px' });
  });

  it('passes on the options it is given', () => {
    render(<Once options={{ threshold: 0.5, rootMargin: '20px' }} />);
    expect(latest().options).toEqual({ threshold: 0.5, rootMargin: '20px' });
  });

  it('disconnects when it unmounts before the element was seen', () => {
    const { unmount } = render(<Once />);
    unmount();
    expect(latest().disconnected).toBe(true);
  });

  it('does not make a new observer on every render', () => {
    const { rerender } = render(<Once />);
    rerender(<Once />);
    rerender(<Once options={{ threshold: 0, rootMargin: '0px' }} />);
    expect(FakeObserver.all).toHaveLength(1);
  });

  it('is true at once where there is no IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<Once />);
    expect(target()).toHaveAttribute('data-seen', 'true');
    expect(FakeObserver.all).toHaveLength(0);
  });
});

describe('useOnScreen', () => {
  it('is false until the browser reports, then follows the element in and out of the window', () => {
    render(<Live />);
    expect(target()).toHaveAttribute('data-on-screen', 'false');
    latest().report(true);
    expect(target()).toHaveAttribute('data-on-screen', 'true');
    latest().report(false);
    expect(target()).toHaveAttribute('data-on-screen', 'false');
    latest().report(true);
    expect(target()).toHaveAttribute('data-on-screen', 'true');
  });

  it('counts any part of the element as on screen by default', () => {
    render(<Live />);
    expect(latest().options).toEqual({ threshold: 0, rootMargin: '0px' });
  });

  it('is true where there is no IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<Live />);
    expect(target()).toHaveAttribute('data-on-screen', 'true');
  });

  it('observes a replaced element and lets go of the old one', () => {
    const { rerender } = render(<Live />);
    const first = target();
    const firstObserver = latest();
    rerender(<Live version={1} />);
    expect(target()).not.toBe(first);
    expect(firstObserver.disconnected).toBe(true);
    expect([...latest().observed]).toEqual([target()]);
  });

  it('disconnects when it unmounts', () => {
    const { unmount } = render(<Live />);
    unmount();
    expect(latest().disconnected).toBe(true);
  });

  it('makes a new observer when the options change, and only then', () => {
    const { rerender } = render(<Live options={{ threshold: 0.2 }} />);
    rerender(<Live options={{ threshold: 0.2 }} />);
    expect(FakeObserver.all).toHaveLength(1);
    rerender(<Live options={{ threshold: 0.6 }} />);
    expect(FakeObserver.all).toHaveLength(2);
    expect(FakeObserver.all[0]?.disconnected).toBe(true);
    expect(latest().options?.threshold).toBe(0.6);
  });
});
