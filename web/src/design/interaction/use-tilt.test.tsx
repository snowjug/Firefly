import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { tiltFor, useTilt } from './use-tilt.ts';
import { DESKTOP_MOUSE, layOut, pointer, send, stubMedia, stubRaf } from './test-utils.ts';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('tiltFor', () => {
  const rect = { left: 100, top: 50, width: 200, height: 100 };
  const at = (x: number, y: number, maxDeg = 2) => tiltFor({ x, y }, rect, maxDeg);

  it('is flat at the centre, with plain zeros (never -0)', () => {
    const centre = at(200, 100);
    expect(centre).toEqual({ rx: 0, ry: 0, gx: 50, gy: 50 });
    expect(Object.is(centre.rx, 0)).toBe(true);
  });

  it('presses away the edge the pointer is near', () => {
    expect(at(300, 100)).toMatchObject({ ry: 2, rx: 0, gx: 100 });
    expect(at(100, 100)).toMatchObject({ ry: -2, gx: 0 });
    expect(at(200, 50)).toMatchObject({ rx: 2, ry: 0, gy: 0 });
    expect(at(200, 150)).toMatchObject({ rx: -2, gy: 100 });
  });

  it('grows with the distance from the centre and reports where the pointer is', () => {
    const quarter = at(250, 75, 1.6);
    expect(quarter.ry).toBeCloseTo(0.8);
    expect(quarter.rx).toBeCloseTo(0.8);
    expect(quarter.gx).toBeCloseTo(75);
    expect(quarter.gy).toBeCloseTo(25);
  });

  it('never exceeds the limit, even for a pointer outside the rectangle', () => {
    const outside = at(9999, -9999, 1.5);
    expect(outside).toEqual({ rx: 1.5, ry: 1.5, gx: 100, gy: 0 });
  });

  it('holds any limit to the 2 degrees the design system allows, and a bad limit to none', () => {
    expect(at(300, 100, 10).ry).toBe(2);
    expect(at(300, 100, -3).ry).toBe(0);
    expect(at(300, 100, Number.NaN).ry).toBe(0);
  });

  it('treats a rectangle with no size (a collapsed element, jsdom) as centred, never NaN', () => {
    const flat = tiltFor({ x: 40, y: 40 }, { left: 0, top: 0, width: 0, height: 0 }, 2);
    expect(flat).toEqual({ rx: 0, ry: 0, gx: 50, gy: 50 });
    expect(tiltFor({ x: Number.NaN, y: 10 }, rect, 2).ry).toBe(0);
  });
});

function Card({ maxDeg, version = 0 }: { maxDeg?: number; version?: number }) {
  const ref = useTilt<HTMLDivElement>({ maxDeg });
  return (
    <div key={version} ref={ref} data-testid="card">
      Card
    </div>
  );
}

const card = () => screen.getByTestId('card');
const read = (name: string) => card().style.getPropertyValue(name);

/** The event types `element` has had listeners added for, in the order they were added. */
function listenedOn(spy: { mock: { calls: unknown[][]; contexts: unknown[] } }, element: Element) {
  return spy.mock.calls
    .filter((_call, index) => spy.mock.contexts[index] === element)
    .map((call) => call[0]);
}

describe('useTilt on a desktop with a mouse', () => {
  function setUp(props: { maxDeg?: number } = {}) {
    stubMedia();
    const raf = stubRaf();
    const view = render(<Card {...props} />);
    layOut(card(), { width: 200, height: 100 });
    return { raf, ...view };
  }

  it('marks the element live and writes nothing until the mouse moves', () => {
    setUp();
    expect(card()).toHaveAttribute('data-fx', 'on');
    expect(read('--tilt-x')).toBe('');
  });

  it('writes the tilt and the highlight as custom properties, one frame after the mouse moves', () => {
    const { raf } = setUp();
    send(card(), pointer('pointermove', { clientX: 180, clientY: 20 }));
    expect(read('--tilt-y')).toBe('');
    raf.frame(16);
    expect(read('--tilt-x')).toBe('0.9deg');
    expect(read('--tilt-y')).toBe('1.2deg');
    expect(read('--glow-x')).toBe('90%');
    expect(read('--glow-y')).toBe('20%');
  });

  it('writes once per frame, from the latest position, however many moves arrive', () => {
    const { raf } = setUp();
    send(card(), pointer('pointermove', { clientX: 10, clientY: 10 }));
    send(card(), pointer('pointermove', { clientX: 20, clientY: 90 }));
    send(card(), pointer('pointermove', { clientX: 100, clientY: 50 }));
    expect(raf.requested()).toBe(1);
    raf.frame(16);
    expect(read('--glow-x')).toBe('50%');
    expect(read('--tilt-y')).toBe('0deg');
    expect(raf.pending()).toBe(0);
  });

  it('puts the element back when the mouse leaves, and stays live for the next visit', () => {
    const { raf } = setUp();
    send(card(), pointer('pointermove', { clientX: 180, clientY: 20 }));
    raf.frame(16);
    send(card(), pointer('pointerleave', { bubbles: false }));
    expect(read('--tilt-x')).toBe('');
    expect(read('--glow-x')).toBe('');
    expect(card()).toHaveAttribute('data-fx', 'on');
    send(card(), pointer('pointermove', { clientX: 20, clientY: 20 }));
    raf.frame(32);
    expect(read('--glow-x')).toBe('10%');
  });

  it('drops a pending write when the mouse leaves before the frame', () => {
    const { raf } = setUp();
    send(card(), pointer('pointermove', { clientX: 180, clientY: 20 }));
    send(card(), pointer('pointercancel'));
    expect(raf.pending()).toBe(0);
    expect(read('--tilt-y')).toBe('');
  });

  it.each(['touch', 'pen'])('ignores a %s pointer', (pointerType) => {
    const { raf } = setUp();
    send(card(), pointer('pointermove', { pointerType, clientX: 180, clientY: 20 }));
    expect(raf.requested()).toBe(0);
    raf.frame(16);
    expect(read('--tilt-y')).toBe('');
  });

  it('keeps the tilt within 1.5 degrees by default and within 2 however much is asked for', () => {
    const { raf, rerender } = setUp();
    send(card(), pointer('pointermove', { clientX: 200, clientY: 50 }));
    raf.frame(16);
    expect(read('--tilt-y')).toBe('1.5deg');
    rerender(<Card maxDeg={9} />);
    send(card(), pointer('pointermove', { clientX: 200, clientY: 50 }));
    raf.frame(32);
    expect(read('--tilt-y')).toBe('2deg');
  });

  it('cancels its pending frame and stops listening when it unmounts', () => {
    const { raf, unmount } = setUp();
    const element = card();
    send(element, pointer('pointermove', { clientX: 180, clientY: 20 }));
    expect(raf.pending()).toBe(1);
    unmount();
    expect(raf.pending()).toBe(0);
    send(element, pointer('pointermove', { clientX: 20, clientY: 20 }));
    expect(raf.requested()).toBe(1);
  });

  it('follows the element when it is replaced', () => {
    const { raf, rerender } = setUp();
    const first = card();
    rerender(<Card version={1} />);
    const second = card();
    expect(second).not.toBe(first);
    expect(second).toHaveAttribute('data-fx', 'on');
    layOut(second, { width: 200, height: 100 });
    send(second, pointer('pointermove', { clientX: 20, clientY: 20 }));
    raf.frame(16);
    expect(second.style.getPropertyValue('--glow-x')).toBe('10%');
    send(first, pointer('pointermove', { clientX: 20, clientY: 20 }));
    expect(raf.pending()).toBe(0);
  });

  it('works under StrictMode, where effects run twice', () => {
    stubMedia();
    const raf = stubRaf();
    render(
      <StrictMode>
        <Card />
      </StrictMode>,
    );
    layOut(card(), { width: 200, height: 100 });
    expect(card()).toHaveAttribute('data-fx', 'on');
    send(card(), pointer('pointermove', { clientX: 20, clientY: 20 }));
    expect(raf.requested()).toBe(1);
    raf.frame(16);
    expect(read('--glow-x')).toBe('10%');
  });
});

describe('useTilt where mouse effects are not allowed', () => {
  it.each([
    ['reduced motion', { ...DESKTOP_MOUSE, '(prefers-reduced-motion: reduce)': true }],
    ['a touch device', { '(hover: none)': true, '(pointer: coarse)': true }],
  ])('listens to nothing and says so on %s', (_name, answers) => {
    stubMedia(answers);
    const raf = stubRaf();
    const added = vi.spyOn(EventTarget.prototype, 'addEventListener');
    render(<Card />);
    expect(card()).toHaveAttribute('data-fx', 'off');
    expect(listenedOn(added, card())).toEqual([]);
    send(card(), pointer('pointermove', { clientX: 180, clientY: 20 }));
    expect(raf.requested()).toBe(0);
    expect(read('--tilt-y')).toBe('');
  });

  it('listens to nothing where there is no matchMedia at all', () => {
    const added = vi.spyOn(EventTarget.prototype, 'addEventListener');
    render(<Card />);
    expect(card()).toHaveAttribute('data-fx', 'off');
    expect(listenedOn(added, card())).toEqual([]);
  });

  it('switches off live, clearing what it wrote, when reduced motion turns on', () => {
    const media = stubMedia();
    const raf = stubRaf();
    render(<Card />);
    layOut(card(), { width: 200, height: 100 });
    send(card(), pointer('pointermove', { clientX: 180, clientY: 20 }));
    raf.frame(16);
    expect(read('--tilt-y')).toBe('1.2deg');
    media.set('(prefers-reduced-motion: reduce)', true);
    expect(card()).toHaveAttribute('data-fx', 'off');
    expect(read('--tilt-y')).toBe('');
    send(card(), pointer('pointermove', { clientX: 20, clientY: 20 }));
    expect(raf.pending()).toBe(0);
    media.set('(prefers-reduced-motion: reduce)', false);
    expect(card()).toHaveAttribute('data-fx', 'on');
  });

  it('adds its three listeners only while the effect is live', () => {
    stubMedia();
    const added = vi.spyOn(EventTarget.prototype, 'addEventListener');
    render(<Card />);
    expect(listenedOn(added, card()).sort()).toEqual([
      'pointercancel',
      'pointerleave',
      'pointermove',
    ]);
  });
});
