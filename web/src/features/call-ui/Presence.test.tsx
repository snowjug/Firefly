import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { PresenceMode } from './call-model.ts';
import { Presence } from './Presence.tsx';

afterEach(cleanup);

const ring = (container: HTMLElement) => container.querySelector('.cw-presence') as HTMLElement;
const level = (container: HTMLElement) => ring(container).style.getPropertyValue('--cw-level');

/**
 * The end of the ripple's animation, as the browser reports it. jsdom has no animation events, and
 * React listens for whichever spelling the browser's style object suggests, so both are sent.
 */
function rippleEnds(container: HTMLElement, name = 'cw-ripple') {
  const ripple = container.querySelector('.cw-presence__ripple') as HTMLElement;
  act(() => {
    for (const type of ['animationend', 'webkitAnimationEnd']) {
      const event = new Event(type, { bubbles: true });
      Object.defineProperty(event, 'animationName', { value: name });
      ripple.dispatchEvent(event);
    }
  });
}

describe('the customer’s presence', () => {
  it('is the avatar’s initials in a ring that says the mode, and says nothing to assistive technology', () => {
    const { container } = render(
      <Presence name="Priya Raman" mode="listening" reducedMotion={false} />,
    );
    expect(ring(container)).toHaveAttribute('data-presence', 'listening');
    expect(ring(container)).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.ff-avatar__initials')).toHaveTextContent('PR');
    expect(container.querySelector('.cw-presence__halo')).not.toBeNull();
    expect(container.querySelector('.cw-presence__arc')).not.toBeNull();
    expect(container.textContent).toBe('PR');
  });

  it('follows the trainee’s voice while it is heard, in steps, and nothing else', () => {
    const { container, rerender } = render(
      <Presence name="Priya Raman" mode="hearing" level={0.5} reducedMotion={false} />,
    );
    expect(level(container)).toBe('0.5');
    // A level that moves a little is drawn at the nearest step, so the ring is not restyled for nothing.
    rerender(<Presence name="Priya Raman" mode="hearing" level={0.52} reducedMotion={false} />);
    expect(level(container)).toBe('0.5');
    rerender(<Presence name="Priya Raman" mode="hearing" level={0.9} reducedMotion={false} />);
    expect(level(container)).toBe('0.9');
    // Out of range is held to the range.
    rerender(<Presence name="Priya Raman" mode="hearing" level={4} reducedMotion={false} />);
    expect(level(container)).toBe('1');
    rerender(<Presence name="Priya Raman" mode="hearing" level={-1} reducedMotion={false} />);
    expect(level(container)).toBe('0');
    // While the microphone only waits, a breath is all there is: the level is not followed.
    rerender(<Presence name="Priya Raman" mode="listening" level={0.9} reducedMotion={false} />);
    expect(level(container)).toBe('0');
  });

  it('follows the customer’s voice only where it was measured, and keeps still on a shaped one', () => {
    const { container, rerender } = render(
      <Presence name="Priya Raman" mode="speaking" level={0.7} measured reducedMotion={false} />,
    );
    expect(level(container)).toBe('0.7');
    expect(ring(container)).toHaveAttribute('data-measured', 'true');
    rerender(
      <Presence
        name="Priya Raman"
        mode="speaking"
        level={0.7}
        measured={false}
        reducedMotion={false}
      />,
    );
    expect(level(container)).toBe('0');
    expect(ring(container)).toHaveAttribute('data-measured', 'false');
  });

  it('is right with no level at all: it rests at its own size and still says the mode', () => {
    for (const mode of ['hearing', 'speaking', 'listening', 'working', 'held', 'still'] as const) {
      const { container, unmount } = render(
        <Presence name="Priya Raman" mode={mode} reducedMotion={false} />,
      );
      expect(level(container), mode).toBe('0');
      expect(ring(container), mode).toHaveAttribute('data-presence', mode);
      unmount();
    }
  });

  it('never follows the level under reduced motion: the ring is its still form', () => {
    const { container } = render(
      <Presence name="Priya Raman" mode="hearing" level={0.9} reducedMotion />,
    );
    expect(level(container)).toBe('0');
    expect(ring(container)).toHaveAttribute('data-presence', 'hearing');
  });

  it('draws the avatar’s own ring only while the customer’s voice plays', () => {
    const { container, rerender } = render(
      <Presence name="Priya Raman" mode="speaking" speaking reducedMotion={false} />,
    );
    expect(container.querySelector('.ff-avatar--speaking')).not.toBeNull();
    rerender(<Presence name="Priya Raman" mode="listening" reducedMotion={false} />);
    expect(container.querySelector('.ff-avatar--speaking')).toBeNull();
  });
});

describe('connecting and connected', () => {
  it('turns while the call connects, with nothing yet to celebrate', () => {
    const { container } = render(
      <Presence name="Priya Raman" mode="connecting" reducedMotion={false} />,
    );
    expect(ring(container)).toHaveAttribute('data-presence', 'connecting');
    expect(ring(container)).not.toHaveAttribute('data-arrival');
    expect(container.querySelector('.cw-presence__ripple')).toBeNull();
  });

  it('settles with one soft ripple, once, the moment it is live', () => {
    const { container, rerender } = render(
      <Presence name="Priya Raman" mode="connecting" reducedMotion={false} />,
    );
    rerender(<Presence name="Priya Raman" mode="speaking" speaking reducedMotion={false} />);
    expect(ring(container)).toHaveAttribute('data-arrival', 'true');
    expect(container.querySelectorAll('.cw-presence__ripple')).toHaveLength(1);

    // It goes when it has played, and another animation ending is not that ripple.
    rippleEnds(container, 'cw-arrive');
    expect(container.querySelector('.cw-presence__ripple')).not.toBeNull();
    rippleEnds(container);
    expect(ring(container)).not.toHaveAttribute('data-arrival');
    expect(container.querySelector('.cw-presence__ripple')).toBeNull();

    // Never again for this call, however often the state changes.
    for (const mode of ['listening', 'working', 'connecting', 'speaking'] as const) {
      rerender(<Presence name="Priya Raman" mode={mode} reducedMotion={false} />);
      expect(container.querySelector('.cw-presence__ripple'), mode).toBeNull();
      expect(ring(container), mode).not.toHaveAttribute('data-arrival');
    }
  });

  it('arrives the same way when the call goes live without a greeting', () => {
    const { container, rerender } = render(
      <Presence name="Priya Raman" mode="connecting" reducedMotion={false} />,
    );
    rerender(<Presence name="Priya Raman" mode="still" reducedMotion={false} />);
    expect(ring(container)).toHaveAttribute('data-arrival', 'true');
  });

  it('has no ripple under reduced motion: the ring is simply shown still', () => {
    const { container, rerender } = render(
      <Presence name="Priya Raman" mode="connecting" reducedMotion />,
    );
    expect(ring(container)).toHaveAttribute('data-presence', 'connecting');
    rerender(<Presence name="Priya Raman" mode="speaking" speaking reducedMotion />);
    expect(container.querySelector('.cw-presence__ripple')).toBeNull();
    expect(ring(container)).not.toHaveAttribute('data-arrival');
  });

  it('does not arrive when the screen opens on a call that is already live', () => {
    for (const mode of ['listening', 'speaking', 'working', 'held', 'still'] as PresenceMode[]) {
      const { container, unmount } = render(
        <Presence name="Priya Raman" mode={mode} reducedMotion={false} />,
      );
      expect(container.querySelector('.cw-presence__ripple'), mode).toBeNull();
      unmount();
    }
  });

  it('says nothing when it is fired for something that is not there', () => {
    const { container } = render(
      <Presence name="Priya Raman" mode="listening" reducedMotion={false} />,
    );
    fireEvent.animationEnd(ring(container));
    expect(ring(container)).toHaveAttribute('data-presence', 'listening');
  });
});
