import { cleanup, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubMedia } from './test-utils.ts';
import { useSelectionSlide } from './use-selection-slide.ts';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// A row of three options, a, b and c, each 100 px wide with 20 px between them. Where each one is
// comes from this table, because jsdom has no layout.
const BOXES: Record<string, DOMRect> = {
  a: new DOMRect(0, 0, 100, 40),
  b: new DOMRect(120, 0, 160, 40),
  c: new DOMRect(300, 50, 100, 40),
};

function layOut() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return BOXES[this.getAttribute('data-testid') ?? ''] ?? new DOMRect();
  });
}

function Row({
  selected,
  selector = '[data-selected]',
}: {
  selected: string;
  selector?: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useSelectionSlide(ref, selector, selected);
  return (
    <div ref={ref}>
      {['a', 'b', 'c'].map((id) => (
        <span key={id} data-testid={id} data-selected={id === selected ? '' : undefined} />
      ))}
    </div>
  );
}

const option = (id: string) => screen.getByTestId(id);

describe('useSelectionSlide', () => {
  it('says where the old option was, as seen from the new one, and marks the new one to play', () => {
    layOut();
    const { rerender } = render(<Row selected="a" />);
    expect(option('a')).not.toHaveAttribute('data-sliding');
    rerender(<Row selected="b" />);
    const b = option('b');
    expect(b).toHaveAttribute('data-sliding');
    // a started 120 px to the left of b, and was 100 of b's 160 px wide, on the same row.
    expect(b.style.getPropertyValue('--slide-dx')).toBe('-120px');
    expect(b.style.getPropertyValue('--slide-dy')).toBe('0px');
    expect(Number(b.style.getPropertyValue('--slide-sx'))).toBeCloseTo(100 / 160);
    expect(Number(b.style.getPropertyValue('--slide-sy'))).toBe(1);
    expect(option('a')).not.toHaveAttribute('data-sliding');
  });

  it('follows a move to another row too', () => {
    layOut();
    const { rerender } = render(<Row selected="a" />);
    rerender(<Row selected="c" />);
    expect(option('c').style.getPropertyValue('--slide-dx')).toBe('-300px');
    expect(option('c').style.getPropertyValue('--slide-dy')).toBe('-50px');
  });

  it('lets an option play again when it is chosen a second time', () => {
    layOut();
    const { rerender } = render(<Row selected="a" />);
    rerender(<Row selected="b" />);
    rerender(<Row selected="a" />);
    expect(option('a')).toHaveAttribute('data-sliding');
    expect(option('a').style.getPropertyValue('--slide-dx')).toBe('120px');
  });

  it('does nothing for the first selection, or where nothing is displayed', () => {
    const { rerender } = render(<Row selected="a" />);
    expect(option('a')).not.toHaveAttribute('data-sliding');
    // No layout (jsdom's own zero boxes): there is nothing to glide between.
    rerender(<Row selected="b" />);
    expect(document.querySelector('[data-sliding]')).toBeNull();
  });

  it('does nothing under reduced motion, or when it is switched off', () => {
    layOut();
    stubMedia({ '(prefers-reduced-motion: reduce)': true });
    const { rerender } = render(<Row selected="a" />);
    rerender(<Row selected="b" />);
    expect(document.querySelector('[data-sliding]')).toBeNull();
    cleanup();

    vi.unstubAllGlobals();
    const switchedOff = render(<Row selected="a" selector={null} />);
    switchedOff.rerender(<Row selected="b" selector={null} />);
    expect(document.querySelector('[data-sliding]')).toBeNull();
  });
});
