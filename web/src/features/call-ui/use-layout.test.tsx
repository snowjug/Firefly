import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useVisualViewportHeight } from './use-layout.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A visual viewport the test can resize and tell the page about, as a browser does with a keyboard. */
function fakeViewport(height: number, scale = 1) {
  const listeners = new Set<() => void>();
  const viewport = {
    height,
    scale,
    offsetTop: 0,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  };
  vi.stubGlobal('visualViewport', viewport);
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
  return {
    resize(next: number) {
      viewport.height = next;
      act(() => listeners.forEach((listener) => listener()));
    },
    listening: () => listeners.size,
  };
}

function Root({ enabled = true }: { enabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useVisualViewportHeight(ref, enabled);
  return <div ref={ref} data-testid="root" />;
}

const root = (container: HTMLElement) =>
  container.querySelector('[data-testid="root"]') as HTMLElement;

describe('the on-screen keyboard', () => {
  it('shortens the page to what is visible and marks the root while it is open, and undoes both when it closes', () => {
    const viewport = fakeViewport(800);
    const { container } = render(<Root />);
    expect(root(container).style.getPropertyValue('--cw-vh')).toBe('');
    expect(root(container)).not.toHaveAttribute('data-keyboard');
    viewport.resize(420);
    expect(root(container).style.getPropertyValue('--cw-vh')).toBe('420px');
    expect(root(container)).toHaveAttribute('data-keyboard', 'open');
    viewport.resize(800);
    expect(root(container).style.getPropertyValue('--cw-vh')).toBe('');
    expect(root(container)).not.toHaveAttribute('data-keyboard');
  });

  it('is not fooled by a pinch zoom or a small change of height', () => {
    const viewport = fakeViewport(800);
    const { container } = render(<Root />);
    viewport.resize(760);
    expect(root(container)).not.toHaveAttribute('data-keyboard');
    // Zoomed in, the visual viewport is smaller than the page without any keyboard.
    const zoomed = fakeViewport(800, 2);
    const again = render(<Root />);
    zoomed.resize(420);
    expect(root(again.container)).not.toHaveAttribute('data-keyboard');
  });

  it('takes nothing on when it is not wanted, and lets go of everything when the screen goes away', () => {
    const viewport = fakeViewport(420);
    const off = render(<Root enabled={false} />);
    expect(root(off.container)).not.toHaveAttribute('data-keyboard');
    expect(viewport.listening()).toBe(0);
    off.unmount();
    const on = render(<Root />);
    expect(root(on.container)).toHaveAttribute('data-keyboard', 'open');
    const element = root(on.container);
    on.unmount();
    expect(viewport.listening()).toBe(0);
    expect(element).not.toHaveAttribute('data-keyboard');
  });
});
