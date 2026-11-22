import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mergeRefs } from './merge-refs.ts';
import { useOnScreen } from './use-in-view.ts';
import { useTilt } from './use-tilt.ts';
import { layOut, pointer, send, stubMedia, stubRaf } from './test-utils.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('mergeRefs', () => {
  it('gives every object ref the element, and takes it away on unmount', () => {
    const first = createRef<HTMLDivElement>();
    const second = createRef<HTMLDivElement>();
    const { unmount } = render(<div ref={mergeRefs(first, second)} data-testid="el" />);
    expect(first.current).toBe(screen.getByTestId('el'));
    expect(second.current).toBe(screen.getByTestId('el'));
    unmount();
    expect(first.current).toBeNull();
    expect(second.current).toBeNull();
  });

  it('calls a callback ref with the element and then with null', () => {
    const callback = vi.fn();
    const { unmount } = render(<div ref={mergeRefs(callback)} />);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0]?.[0]).toBeInstanceOf(HTMLDivElement);
    unmount();
    expect(callback).toHaveBeenLastCalledWith(null);
  });

  it('runs the cleanup a callback ref returns instead of passing it null', () => {
    const cleanup = vi.fn();
    const callback = vi.fn(() => cleanup);
    const { unmount } = render(<div ref={mergeRefs(callback)} />);
    unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('skips refs that are missing', () => {
    const ref = createRef<HTMLDivElement>();
    render(<div ref={mergeRefs(undefined, null, ref)} data-testid="el" />);
    expect(ref.current).toBe(screen.getByTestId('el'));
  });
});

describe('two interaction hooks on one element', () => {
  class FakeObserver {
    static all: FakeObserver[] = [];
    callback: IntersectionObserverCallback;
    disconnected = false;
    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback;
      FakeObserver.all.push(this);
    }
    observe() {}
    unobserve() {}
    disconnect() {
      this.disconnected = true;
    }
  }

  function Card({ tick }: { tick: number }) {
    const tilt = useTilt<HTMLDivElement>();
    const [screenRef, onScreen] = useOnScreen<HTMLDivElement>();
    return (
      <div
        ref={mergeRefs(tilt, screenRef)}
        data-testid="card"
        data-tick={tick}
        data-on-screen={String(onScreen)}
      />
    );
  }

  it('both keep working, and neither is torn down when the component renders again', () => {
    FakeObserver.all = [];
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    stubMedia();
    const raf = stubRaf();
    const { rerender } = render(<Card tick={0} />);
    layOut(screen.getByTestId('card'), { width: 200, height: 100 });
    rerender(<Card tick={1} />);
    rerender(<Card tick={2} />);

    expect(FakeObserver.all).toHaveLength(1);
    expect(FakeObserver.all[0]?.disconnected).toBe(false);
    send(screen.getByTestId('card'), pointer('pointermove', { clientX: 20, clientY: 20 }));
    raf.frame(16);
    expect(screen.getByTestId('card').style.getPropertyValue('--glow-x')).toBe('10%');
  });
});
