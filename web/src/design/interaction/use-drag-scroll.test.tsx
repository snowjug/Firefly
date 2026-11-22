import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  decideSwipe,
  useDragScroll,
  type DragScrollOptions,
  type DragScrollRelease,
} from './use-drag-scroll.ts';
import { DESKTOP_MOUSE, layOut, pointer, scrollBox, send, stubMedia } from './test-utils.ts';

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

afterEach(async () => {
  // A drag that just ended swallows the next click for one tick: let that pass between tests.
  await tick();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function Track({
  options,
  version = 0,
  onPick,
}: {
  options?: DragScrollOptions;
  version?: number;
  onPick?: () => void;
}) {
  const ref = useDragScroll<HTMLDivElement>(options);
  return (
    <div key={version} ref={ref} data-testid="track" style={{ scrollSnapType: 'x mandatory' }}>
      <button type="button" onClick={onPick}>
        Card
      </button>
    </div>
  );
}

const track = () => screen.getByTestId('track');
const card = () => screen.getByRole('button', { name: 'Card' });
const clickEvent = () => new MouseEvent('click', { bubbles: true, cancelable: true });

type Extra = PointerEventInit & { timeStamp?: number };
const down = (x: number, extra: Extra = {}, target: Element = card()) =>
  send(target, pointer('pointerdown', { clientX: x, clientY: 10, ...extra }));
const move = (x: number, extra: Extra = {}) =>
  send(card(), pointer('pointermove', { clientX: x, clientY: 10, ...extra }));
const up = (x: number, extra: Extra = {}) =>
  send(card(), pointer('pointerup', { clientX: x, clientY: 10, ...extra }));

function setUp(extra: DragScrollOptions = {}) {
  const onDragChange = vi.fn<(dragging: boolean) => void>();
  const onRelease = vi.fn<(release: DragScrollRelease) => void>();
  const onPick = vi.fn();
  const options = { onDragChange, onRelease, ...extra };
  const view = render(<Track options={options} onPick={onPick} />);
  scrollBox(track(), { scrollWidth: 1000, clientWidth: 300 });
  return {
    onDragChange,
    onRelease,
    onPick,
    unmount: view.unmount,
    /** Renders again with another version, which gives the track a new element. */
    replace: (version: number) => {
      view.rerender(<Track options={options} version={version} onPick={onPick} />);
      scrollBox(track(), { scrollWidth: 1000, clientWidth: 300 });
    },
  };
}

describe('useDragScroll: click or drag', () => {
  it('treats a small movement as a click: no drag, and the click goes through', () => {
    const { onDragChange, onRelease, onPick } = setUp();
    down(200);
    move(197);
    expect(track()).not.toHaveAttribute('data-dragging');
    up(197);
    expect(send(card(), clickEvent())).toBe(true);
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onDragChange).not.toHaveBeenCalled();
    expect(onRelease).not.toHaveBeenCalled();
    expect(track().scrollLeft).toBe(0);
  });

  it('begins a drag at the threshold: the track follows the pointer and says so', () => {
    const { onDragChange } = setUp();
    down(200);
    move(195);
    expect(onDragChange).not.toHaveBeenCalled();
    move(194);
    expect(track()).toHaveAttribute('data-dragging', 'true');
    expect(onDragChange).toHaveBeenCalledExactlyOnceWith(true);
    expect(track().scrollLeft).toBe(6);
    move(150);
    expect(track().scrollLeft).toBe(50);
    move(210);
    expect(track().scrollLeft).toBe(0);
  });

  it('starts from the scroll position the press found', () => {
    setUp();
    track().scrollLeft = 120;
    down(300);
    move(250);
    expect(track().scrollLeft).toBe(170);
  });

  it('swallows the click that ends a drag, so a drag never selects a card, and only that one', () => {
    const { onPick } = setUp();
    down(200);
    move(150);
    up(150);
    expect(send(card(), clickEvent())).toBe(false);
    expect(onPick).not.toHaveBeenCalled();
    expect(send(card(), clickEvent())).toBe(true);
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it('stops watching for that click after one tick if none comes', async () => {
    const { onPick } = setUp();
    down(200);
    move(150);
    up(150);
    await tick();
    send(card(), clickEvent());
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it('uses the threshold it is given', () => {
    const { onDragChange } = setUp({ thresholdPx: 20 });
    down(200);
    move(185);
    expect(onDragChange).not.toHaveBeenCalled();
    move(180);
    expect(onDragChange).toHaveBeenCalledWith(true);
  });

  it('does not start a drag from a mostly vertical gesture, but can still start when it turns sideways', () => {
    const { onDragChange } = setUp();
    down(200, { clientY: 100 });
    move(190, { clientY: 160 });
    move(150, { clientY: 165 });
    expect(onDragChange).not.toHaveBeenCalled();
    move(100, { clientY: 165 });
    expect(onDragChange).toHaveBeenCalledWith(true);
  });

  it('never cancels pointerdown, so focus and text selection keep working', () => {
    setUp();
    expect(down(200)).toBe(true);
  });

  it('clears a text selection made inside the track as the drag begins', () => {
    setUp();
    const selection = window.getSelection();
    if (!selection) throw new Error('jsdom should have a selection');
    selection.selectAllChildren(card());
    expect(selection.rangeCount).toBe(1);
    down(200);
    move(150);
    expect(selection.rangeCount).toBe(0);
  });
});

describe('useDragScroll: only the mouse drags', () => {
  it.each(['touch', 'pen'])('leaves %s to the browser', (pointerType) => {
    const { onDragChange } = setUp();
    down(200, { pointerType });
    move(100, { pointerType });
    up(100, { pointerType });
    expect(onDragChange).not.toHaveBeenCalled();
    expect(track().scrollLeft).toBe(0);
    expect(track()).not.toHaveAttribute('data-dragging');
  });

  it.each([1, 2])('ignores mouse button %i', (button) => {
    const { onDragChange } = setUp();
    down(200, { button });
    move(100);
    expect(onDragChange).not.toHaveBeenCalled();
  });

  it('ignores a touch pointer moving while the mouse is down', () => {
    setUp();
    down(200);
    move(100, { pointerType: 'touch' });
    expect(track()).not.toHaveAttribute('data-dragging');
  });

  it('leaves a press on its own scrollbar to the browser', () => {
    const { onDragChange } = setUp();
    layOut(track(), { left: 0, top: 0, width: 320, height: 100 });
    Object.defineProperty(track(), 'clientHeight', { configurable: true, value: 100 });
    down(310, { clientY: 50 }, track());
    move(200, { clientY: 50 });
    expect(onDragChange).not.toHaveBeenCalled();
    send(track(), pointer('pointerup', { clientX: 200, clientY: 50 }));
    down(100, { clientY: 50 }, track());
    move(20, { clientY: 50 });
    expect(onDragChange).toHaveBeenCalledWith(true);
  });

  it('stops the browser starting its own drag of a link or an image while the mouse is down', () => {
    setUp();
    const start = () => send(card(), new Event('dragstart', { bubbles: true, cancelable: true }));
    expect(start()).toBe(true);
    down(200);
    expect(start()).toBe(false);
    up(200);
    expect(start()).toBe(true);
  });
});

describe('useDragScroll: while it is dragging', () => {
  it('turns off snapping, smooth scrolling and text selection, and puts back what was there', () => {
    setUp();
    track().style.scrollBehavior = 'smooth';
    down(200);
    move(150);
    expect(track().style.scrollSnapType).toBe('none');
    expect(track().style.scrollBehavior).toBe('auto');
    expect(track().style.userSelect).toBe('none');
    up(150);
    expect(track().style.scrollSnapType).toBe('x mandatory');
    expect(track().style.scrollBehavior).toBe('smooth');
    expect(track().style.userSelect).toBe('');
    expect(track()).not.toHaveAttribute('data-dragging');
  });

  it('keeps the scroll inside the content, however far the pointer goes', () => {
    setUp();
    down(200);
    move(-5000);
    expect(track().scrollLeft).toBe(700);
    move(9000);
    expect(track().scrollLeft).toBe(0);
  });

  it('captures the pointer when the drag begins, not before, and lets go at the end', () => {
    setUp();
    const capture = vi.fn();
    const release = vi.fn();
    Object.assign(track(), {
      setPointerCapture: capture,
      releasePointerCapture: release,
      hasPointerCapture: () => true,
    });
    down(200, { pointerId: 7 });
    move(197, { pointerId: 7 });
    expect(capture).not.toHaveBeenCalled();
    move(150, { pointerId: 7 });
    expect(capture).toHaveBeenCalledWith(7);
    up(150, { pointerId: 7 });
    expect(release).toHaveBeenCalledWith(7);
  });

  it('still drags when the browser will not capture the pointer', () => {
    setUp();
    track().setPointerCapture = () => {
      throw new DOMException('That pointer is gone', 'NotFoundError');
    };
    down(200);
    move(150);
    expect(track()).toHaveAttribute('data-dragging', 'true');
    expect(track().scrollLeft).toBe(50);
  });

  it('keeps following a pointer that has left the track', () => {
    setUp();
    down(200);
    move(150);
    send(document.body, pointer('pointermove', { clientX: 100, clientY: 900 }));
    expect(track().scrollLeft).toBe(100);
  });
});

describe('useDragScroll: stretching at the ends', () => {
  const overscroll = () => track().style.getPropertyValue('--drag-overscroll');

  it('shows a third of the movement past either end, at most 48px, and clears it on release', () => {
    stubMedia();
    setUp();
    down(200);
    move(110);
    expect(overscroll()).toBe('0px');
    move(290);
    expect(overscroll()).toBe('-30px');
    move(500);
    expect(overscroll()).toBe('-48px');
    up(500);
    expect(overscroll()).toBe('');

    track().scrollLeft = 700;
    down(200);
    move(140);
    expect(overscroll()).toBe('20px');
    move(0);
    expect(overscroll()).toBe('48px');
    up(0);
    expect(overscroll()).toBe('');
  });

  it.each([
    ['reduced motion', { ...DESKTOP_MOUSE, '(prefers-reduced-motion: reduce)': true }],
    ['a touch-first device', { '(hover: none)': true, '(pointer: coarse)': true }],
  ])('leaves the stretch out for %s, and still drags', (_name, answers) => {
    stubMedia(answers);
    setUp();
    down(200);
    move(500);
    expect(overscroll()).toBe('');
    expect(track()).toHaveAttribute('data-dragging', 'true');
    move(-100);
    expect(track().scrollLeft).toBe(300);
  });
});

describe('useDragScroll: how it ends', () => {
  it('reports the offset and the speed at the release, positive toward the start of the content', () => {
    const { onRelease, onDragChange } = setUp();
    down(300, { timeStamp: 0 });
    move(250, { timeStamp: 100 });
    move(230, { timeStamp: 120 });
    move(210, { timeStamp: 140 });
    up(200, { timeStamp: 150 });
    expect(onRelease).toHaveBeenCalledExactlyOnceWith({ offset: 100, velocity: 1 });
    expect(onDragChange.mock.calls).toEqual([[true], [false]]);
  });

  it('reports a negative offset and speed for a drag toward the end', () => {
    const { onRelease } = setUp();
    down(100, { timeStamp: 0 });
    move(150, { timeStamp: 100 });
    up(170, { timeStamp: 120 });
    const [release] = onRelease.mock.calls[0] ?? [];
    expect(release?.offset).toBe(-70);
    expect(release?.velocity).toBeCloseTo(-1);
  });

  it('reports no speed when the pointer rested before the release', () => {
    const { onRelease } = setUp();
    down(300, { timeStamp: 0 });
    move(200, { timeStamp: 50 });
    up(200, { timeStamp: 500 });
    expect(onRelease).toHaveBeenCalledWith({ offset: 100, velocity: 0 });
  });

  it('ends a cancelled drag without a release, a swallowed click or a decision', () => {
    const { onDragChange, onRelease, onPick } = setUp();
    down(200);
    move(150);
    send(card(), pointer('pointercancel'));
    expect(onDragChange.mock.calls).toEqual([[true], [false]]);
    expect(onRelease).not.toHaveBeenCalled();
    expect(track()).not.toHaveAttribute('data-dragging');
    expect(track().style.scrollSnapType).toBe('x mandatory');
    send(card(), clickEvent());
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it('lets go cleanly when it unmounts mid-drag', () => {
    const { onDragChange, onRelease, unmount } = setUp();
    const element = track();
    down(200);
    move(150);
    unmount();
    expect(onDragChange.mock.calls).toEqual([[true], [false]]);
    expect(element).not.toHaveAttribute('data-dragging');
    expect(element.style.scrollSnapType).toBe('x mandatory');
    send(document.body, pointer('pointermove', { clientX: 100 }));
    send(document.body, pointer('pointerup', { clientX: 100 }));
    expect(onRelease).not.toHaveBeenCalled();
    expect(onDragChange).toHaveBeenCalledTimes(2);
  });

  it('ends a drag on an element that is replaced, and works on the new one', () => {
    const { onDragChange, replace } = setUp();
    const first = track();
    down(200);
    move(150);
    replace(1);
    expect(track()).not.toBe(first);
    expect(first).not.toHaveAttribute('data-dragging');
    expect(onDragChange.mock.calls).toEqual([[true], [false]]);
    send(document.body, pointer('pointerup', { clientX: 150 }));
    expect(onDragChange).toHaveBeenCalledTimes(2);

    down(200);
    move(120);
    expect(track()).toHaveAttribute('data-dragging', 'true');
    expect(track().scrollLeft).toBe(80);
  });

  it('uses the callbacks of the latest render', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Track options={{ onRelease: first }} />);
    scrollBox(track(), { scrollWidth: 1000, clientWidth: 300 });
    down(200);
    move(150);
    rerender(<Track options={{ onRelease: second }} />);
    up(150);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('lets go cleanly even when the app callback that starts the drag throws', () => {
    const reported = vi.fn((event: ErrorEvent) => event.preventDefault());
    window.addEventListener('error', reported);
    setUp({
      onDragChange: (dragging) => {
        if (dragging) throw new Error('A bug in the app, not in the drag');
      },
    });
    down(200);
    move(150);
    expect(reported).toHaveBeenCalledTimes(1);
    up(150);
    window.removeEventListener('error', reported);
    expect(track()).not.toHaveAttribute('data-dragging');
    expect(track().style.scrollSnapType).toBe('x mandatory');
    expect(track().style.userSelect).toBe('');
  });

  it('works under StrictMode, where effects run twice: one drag, one release, one swallowed click', () => {
    const onDragChange = vi.fn<(dragging: boolean) => void>();
    const onPick = vi.fn();
    render(
      <StrictMode>
        <Track options={{ onDragChange }} onPick={onPick} />
      </StrictMode>,
    );
    scrollBox(track(), { scrollWidth: 1000, clientWidth: 300 });
    down(200);
    move(150);
    up(150);
    expect(onDragChange.mock.calls).toEqual([[true], [false]]);
    expect(send(card(), clickEvent())).toBe(false);
    expect(onPick).not.toHaveBeenCalled();
  });
});

describe('decideSwipe', () => {
  it.each<[string, DragScrollRelease, ReturnType<typeof decideSwipe>]>([
    ['a long slow drag toward the start (offset alone)', { offset: 60, velocity: 0 }, 'next'],
    ['a long slow drag toward the end', { offset: -60, velocity: 0 }, 'previous'],
    ['exactly the offset threshold', { offset: 48, velocity: 0 }, 'next'],
    ['just short of it, and slow', { offset: 47, velocity: 0.3 }, 'none'],
    ['speed alone: fast but hardly moved', { offset: 3, velocity: 5 }, 'none'],
    ['speed alone: no movement at all', { offset: 0, velocity: 5 }, 'none'],
    ['speed alone, the other way', { offset: -3, velocity: -5 }, 'none'],
    ['both: a short, fast flick toward the start', { offset: 20, velocity: 0.5 }, 'next'],
    ['both: a short, fast flick toward the end', { offset: -20, velocity: -0.5 }, 'previous'],
    ['a flick too short to count', { offset: 15, velocity: 2 }, 'none'],
    ['a short drag that is too slow', { offset: 20, velocity: 0.2 }, 'none'],
    ['exactly the speed threshold', { offset: 20, velocity: 0.35 }, 'next'],
    ['a drag flung back the other way as it was released', { offset: 80, velocity: -1 }, 'none'],
    ['a gentle drift back is not a fling', { offset: 80, velocity: -0.1 }, 'next'],
  ])('%s', (_name, release, expected) => {
    expect(decideSwipe(release)).toBe(expected);
  });

  it('takes its thresholds from the caller', () => {
    expect(decideSwipe({ offset: 30, velocity: 0 }, { offsetPx: 25 })).toBe('next');
    expect(decideSwipe({ offset: 30, velocity: 0 }, { offsetPx: 100 })).toBe('none');
    expect(decideSwipe({ offset: 30, velocity: 0.2 }, { velocity: 0.1, offsetPx: 60 })).toBe(
      'next',
    );
    expect(decideSwipe({ offset: 30, velocity: 0.2 }, { velocity: 0.5, offsetPx: 60 })).toBe(
      'none',
    );
    expect(decideSwipe({ offset: 10, velocity: 1 }, { flickOffsetPx: 8, offsetPx: 100 })).toBe(
      'next',
    );
  });

  it('decides nothing from numbers that are not numbers', () => {
    expect(decideSwipe({ offset: Number.NaN, velocity: 1 })).toBe('none');
    expect(decideSwipe({ offset: 100, velocity: Number.POSITIVE_INFINITY })).toBe('none');
  });
});
