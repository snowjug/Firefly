import { act, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReveal } from './use-reveal.ts';
import type { InViewOptions } from './use-in-view.ts';

class FakeObserver {
  static latest: FakeObserver | null = null;
  private readonly callback: IntersectionObserverCallback;
  private target: Element | null = null;
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    FakeObserver.latest = this;
  }
  observe(element: Element) {
    this.target = element;
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
  enter() {
    const target = this.target;
    if (!target) throw new Error('Nothing was observed');
    act(() => {
      this.callback([{ isIntersecting: true, target } as IntersectionObserverEntry], this as never);
    });
  }
}

function Block({ options }: { options?: InViewOptions }) {
  const [ref, reveal] = useReveal<HTMLElement>(options);
  return (
    <section ref={ref} {...reveal} data-testid="block">
      Block
    </section>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  FakeObserver.latest = null;
});

/** jsdom has no layout: say where the revealed block is (its top, in px from the top of the window). */
function placeAt(top: number) {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, top, 400, 120),
  );
}

describe('useReveal', () => {
  describe('with IntersectionObserver', () => {
    beforeEach(() => vi.stubGlobal('IntersectionObserver', FakeObserver));

    it('marks the element as waiting, and as revealed once it has scrolled into view', () => {
      render(<Block />);
      expect(screen.getByTestId('block')).toHaveAttribute('data-reveal', '');
      expect(screen.getByTestId('block')).not.toHaveAttribute('data-revealed');
      FakeObserver.latest?.enter();
      expect(screen.getByTestId('block')).toHaveAttribute('data-revealed', '');
    });

    it('waits when it arrives below the fold, and is revealed (with its rise) when it is scrolled to', () => {
      placeAt(window.innerHeight + 400);
      render(<Block />);
      expect(screen.getByTestId('block')).not.toHaveAttribute('data-revealed');
      FakeObserver.latest?.enter();
      expect(screen.getByTestId('block')).toHaveAttribute('data-revealed', '');
    });

    it('is there at once when it arrives inside the window: never hidden, and no wait for the observer', () => {
      placeAt(120);
      render(<Block />);
      expect(screen.getByTestId('block')).toHaveAttribute('data-revealed', 'now');
    });

    it('counts a block that is already above the window (a restored scroll position) as there too', () => {
      placeAt(-900);
      render(<Block />);
      expect(screen.getByTestId('block')).toHaveAttribute('data-revealed', 'now');
    });

    it('does not take the shortcut when it was asked to be well inside the window before it counts', () => {
      placeAt(120);
      render(<Block options={{ rootMargin: '0px 0px -10% 0px' }} />);
      expect(screen.getByTestId('block')).not.toHaveAttribute('data-revealed');
      FakeObserver.latest?.enter();
      expect(screen.getByTestId('block')).toHaveAttribute('data-revealed', '');
    });
  });

  it('never leaves the element waiting when the browser cannot report visibility', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<Block />);
    expect(screen.getByTestId('block')).toHaveAttribute('data-revealed');
  });

  describe('the stylesheet', () => {
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'layout.css'),
      'utf8',
    );
    const before = (rule: string) => {
      const start = css.indexOf(rule);
      expect(start, `${rule} is in layout.css`).toBeGreaterThan(-1);
      const head = css.slice(0, start);
      return head.slice(head.lastIndexOf('@media'), start);
    };

    it('hides nothing without motion or on paper: the waiting state sits in a screen, motion-allowed query', () => {
      expect(before('[data-reveal]:not([data-revealed]) {')).toContain(
        '@media screen and (prefers-reduced-motion: no-preference)',
      );
      expect(before("[data-reveal][data-revealed=''] {")).toContain(
        '@media screen and (prefers-reduced-motion: no-preference)',
      );
    });

    it('moves the block with an animation, so that it keeps no transition, delay or transform afterwards, and only a block that was scrolled to', () => {
      const start = css.indexOf("[data-reveal][data-revealed=''] {");
      const rule = css.slice(start, css.indexOf('}', start));
      expect(rule).toMatch(/animation:\s*ff-reveal/);
      expect(rule).toMatch(
        /animation-delay:\s*calc\(var\(--reveal-i, 0\) \* var\(--dur-stagger\)\)/,
      );
      expect(css).not.toMatch(/\[data-reveal\][^{]*\{[^}]*transition/);
      expect(css).not.toMatch(/data-revealed='now'/);
    });
  });
});
