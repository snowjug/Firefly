import { afterEach, describe, expect, it, vi } from 'vitest';
import { durationToken, motionAllowed, slidePip } from './motion.ts';

function element(left: number, bottom: number, width = 60): HTMLElement {
  const node = document.createElement('span');
  document.body.appendChild(node);
  node.getBoundingClientRect = () =>
    ({
      left,
      right: left + width,
      width,
      top: bottom - 30,
      bottom,
      height: 30,
      x: left,
      y: bottom - 30,
      toJSON: () => ({}),
    }) as DOMRect;
  return node;
}

function animating(node: HTMLElement) {
  const animate = vi.fn();
  Object.defineProperty(node, 'animate', { value: animate, configurable: true });
  return animate;
}

afterEach(() => {
  document.documentElement.removeAttribute('data-motion');
  document.documentElement.removeAttribute('style');
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('motionAllowed', () => {
  it('is on unless the user chose Reduce motion or the system asks for less', () => {
    expect(motionAllowed()).toBe(true);
    document.documentElement.setAttribute('data-motion', 'reduce');
    expect(motionAllowed()).toBe(false);
    document.documentElement.removeAttribute('data-motion');
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({ matches: query.includes('reduce') }),
    });
    try {
      expect(motionAllowed()).toBe(false);
    } finally {
      delete (window as { matchMedia?: unknown }).matchMedia;
    }
  });
});

describe('durationToken', () => {
  it('reads a duration from the tokens and falls back when it is missing', () => {
    expect(durationToken('--dur-component', 260)).toBe(260);
    document.documentElement.style.setProperty('--dur-component', '300ms');
    expect(durationToken('--dur-component', 260)).toBe(300);
  });
});

describe('slidePip', () => {
  it('starts the new pip over the old one and settles it, on the pseudo-element', () => {
    const from = element(100, 200);
    const to = element(400, 200);
    const animate = animating(to);
    slidePip(from, to);
    expect(animate).toHaveBeenCalledTimes(1);
    const [keyframes, options] = animate.mock.calls[0] as [Keyframe[], KeyframeAnimationOptions];
    expect(keyframes[0]?.transform).toBe('translate(-300px, 0px) scale(1)');
    expect(keyframes[1]?.transform).toBe('translate(0, 0) scale(1)');
    expect(options.pseudoElement).toBe('::after');
    expect(options.duration).toBe(260);
  });

  it('measures from the centres and the bottoms, so a pip can move to another row', () => {
    const from = element(100, 200, 40);
    const to = element(100, 260, 100);
    const animate = animating(to);
    slidePip(from, to);
    const [keyframes] = animate.mock.calls[0] as [Keyframe[]];
    expect(keyframes[0]?.transform).toBe('translate(-30px, -60px) scale(1)');
  });

  it('does nothing when there is nowhere to move from, or nowhere to go', () => {
    const to = element(100, 200);
    const animate = animating(to);
    slidePip(null, to);
    slidePip(undefined, to);
    slidePip(to, to);
    slidePip(element(100, 200), to);
    slidePip(element(100.4, 200), to);
    const gone = element(0, 0);
    gone.remove();
    slidePip(gone, to);
    expect(animate).not.toHaveBeenCalled();
  });

  it('does nothing when motion is not wanted, or the browser cannot animate', () => {
    const from = element(0, 100);
    const to = element(300, 100);
    const animate = animating(to);
    document.documentElement.setAttribute('data-motion', 'reduce');
    slidePip(from, to);
    expect(animate).not.toHaveBeenCalled();
    document.documentElement.removeAttribute('data-motion');

    const plain = element(300, 100);
    expect(() => slidePip(from, plain)).not.toThrow();
  });

  it('lets the pip simply appear when the browser rejects the animation', () => {
    const from = element(0, 100);
    const to = element(300, 100);
    Object.defineProperty(to, 'animate', {
      value: () => {
        throw new TypeError('unsupported easing');
      },
      configurable: true,
    });
    expect(() => slidePip(from, to)).not.toThrow();
  });
});
