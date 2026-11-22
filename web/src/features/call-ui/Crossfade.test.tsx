import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Crossfade } from './Crossfade.tsx';

afterEach(() => {
  vi.useRealTimers();
});

const layers = (container: HTMLElement) => ({
  incoming: container.querySelector('.cw-fade__in'),
  leaving: [...container.querySelectorAll('.cw-fade__out')],
});

// jsdom has no AnimationEvent, so React listens for the prefixed name there; a browser sends the plain one.
const endAnimation = (element: Element) =>
  act(() => {
    for (const type of ['animationend', 'webkitAnimationEnd']) {
      element.dispatchEvent(new Event(type, { bubbles: true }));
    }
  });

describe('the crossfade', () => {
  it('draws the first content as it is, without a fade', () => {
    const { container } = render(<Crossfade id="calm">Calm</Crossfade>);
    const { incoming, leaving } = layers(container);
    expect(incoming).toHaveTextContent('Calm');
    expect(incoming).not.toHaveClass('cw-fade__in--enter');
    expect(leaving).toHaveLength(0);
  });

  it('keeps the old words under the new for one fade, hidden from a screen reader', () => {
    const { container, rerender } = render(<Crossfade id="calm">Calm</Crossfade>);
    rerender(<Crossfade id="concerned">Concerned</Crossfade>);
    const { incoming, leaving } = layers(container);
    expect(incoming).toHaveTextContent('Concerned');
    expect(incoming).toHaveClass('cw-fade__in--enter');
    expect(leaving).toHaveLength(1);
    expect(leaving[0]).toHaveTextContent('Calm');
    expect(leaving[0]).toHaveAttribute('aria-hidden', 'true');
    // Only the new word can be found by name.
    expect(screen.getByText('Concerned')).toBeVisible();
  });

  it('removes the old words when their fade ends', () => {
    const { container, rerender } = render(<Crossfade id="calm">Calm</Crossfade>);
    rerender(<Crossfade id="concerned">Concerned</Crossfade>);
    const out = layers(container).leaving[0] as HTMLElement;
    endAnimation(out);
    expect(layers(container).leaving).toHaveLength(0);
    expect(layers(container).incoming).toHaveTextContent('Concerned');
  });

  it('removes them anyway where no animation runs, so they never stay behind', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<Crossfade id="calm">Calm</Crossfade>);
    rerender(<Crossfade id="concerned">Concerned</Crossfade>);
    expect(layers(container).leaving).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(layers(container).leaving).toHaveLength(0);
  });

  it('keeps the new content as the same element when only its words change under the same name', () => {
    const { container, rerender } = render(<Crossfade id="calm">Calm</Crossfade>);
    const before = layers(container).incoming;
    rerender(<Crossfade id="calm">Calm and steady</Crossfade>);
    expect(layers(container).incoming).toBe(before);
    expect(layers(container).leaving).toHaveLength(0);
    expect(before).toHaveTextContent('Calm and steady');
  });

  it('fades out what was last drawn, not what it began as, when words grow under one name', () => {
    const { container, rerender } = render(<Crossfade id="line">Which</Crossfade>);
    rerender(<Crossfade id="line">Which headset</Crossfade>);
    rerender(<Crossfade id="line">Which headset and version</Crossfade>);
    rerender(<Crossfade id="next">Thank you</Crossfade>);
    const { incoming, leaving } = layers(container);
    expect(leaving).toHaveLength(1);
    expect(leaving[0]).toHaveTextContent('Which headset and version');
    expect(incoming).toHaveTextContent('Thank you');
  });

  it('does not replay the entrance of the word that was already there when a third one arrives', () => {
    const { container, rerender } = render(<Crossfade id="calm">Calm</Crossfade>);
    rerender(<Crossfade id="concerned">Concerned</Crossfade>);
    const concerned = layers(container).incoming;
    rerender(<Crossfade id="angry">Angry</Crossfade>);
    const { incoming, leaving } = layers(container);
    expect(incoming).toHaveTextContent('Angry');
    // The word that is leaving is the element that was incoming: it fades out, it does not start over.
    expect(leaving.some((layer) => layer === concerned)).toBe(true);
  });
});
