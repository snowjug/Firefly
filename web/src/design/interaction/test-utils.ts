import { act, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

// Helpers for the interaction hooks' tests. jsdom has no media queries, no layout, no pointer capture
// and no animation frames of its own that a test can step, so each is stood in for here.

/** What a mouse on an ordinary desktop answers; add `'(prefers-reduced-motion: reduce)': true` and so on to take effects away. */
export const DESKTOP_MOUSE = { '(hover: hover)': true, '(pointer: fine)': true } as const;

export interface MediaStub {
  /** Changes what a query answers and tells everyone listening to it, as a browser would. */
  set(query: string, matches: boolean): void;
  /** How many change listeners are attached right now, over all queries. */
  listeners(): number;
}

/** Replaces `matchMedia` with a table of answers (anything not listed does not match). */
export function stubMedia(initial: Record<string, boolean> = DESKTOP_MOUSE): MediaStub {
  const answers = new Map(Object.entries(initial));
  const attached = new Map<string, Set<() => void>>();
  const listenersFor = (query: string) => {
    let set = attached.get(query);
    if (!set) attached.set(query, (set = new Set()));
    return set;
  };
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    get matches() {
      return answers.get(query) ?? false;
    },
    addEventListener: (_type: string, listener: () => void) => listenersFor(query).add(listener),
    removeEventListener: (_type: string, listener: () => void) =>
      listenersFor(query).delete(listener),
  }));
  return {
    set(query, matches) {
      answers.set(query, matches);
      act(() => {
        for (const listener of [...listenersFor(query)]) listener();
      });
    },
    listeners: () => [...attached.values()].reduce((sum, set) => sum + set.size, 0),
  };
}

export interface FakeRaf {
  /** Runs the frames requested so far as one frame at this timestamp (ms). Frames they request wait for the next call. */
  frame(timestamp: number): void;
  /** How many requested frames have not run or been cancelled. */
  pending(): number;
  /** How many frames have been requested in all. */
  requested(): number;
}

/** Replaces requestAnimationFrame with a queue the test steps by hand. */
export function stubRaf(): FakeRaf {
  let nextId = 1;
  let requests = 0;
  const queue = new Map<number, FrameRequestCallback>();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    requests += 1;
    queue.set(nextId, callback);
    return nextId++;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    queue.delete(id);
  });
  return {
    frame(timestamp) {
      const due = [...queue.values()];
      queue.clear();
      act(() => {
        for (const callback of due) callback(timestamp);
      });
    },
    pending: () => queue.size,
    requested: () => requests,
  };
}

/** A pointer event for a mouse by default. `timeStamp` overrides the clock, so a test can set how fast a drag was. */
export function pointer(
  type: string,
  init: PointerEventInit & { timeStamp?: number } = {},
): PointerEvent {
  const { timeStamp, ...rest } = init;
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerType: 'mouse',
    pointerId: 1,
    button: 0,
    ...rest,
  });
  if (timeStamp !== undefined) Object.defineProperty(event, 'timeStamp', { value: timeStamp });
  return event;
}

/** Dispatches inside act and says whether the event went uncancelled. */
export function send(target: Element | Document | Window, event: Event): boolean {
  return fireEvent(target, event);
}

/** jsdom has no layout: give an element a rectangle. */
export function layOut(
  element: Element,
  box: { left?: number; top?: number; width: number; height: number },
): void {
  element.getBoundingClientRect = () =>
    new DOMRect(box.left ?? 0, box.top ?? 0, box.width, box.height);
}

/** jsdom has no layout: give a scroller its content width and visible width. */
export function scrollBox(
  element: HTMLElement,
  box: { scrollWidth: number; clientWidth: number },
): void {
  Object.defineProperty(element, 'scrollWidth', { configurable: true, value: box.scrollWidth });
  Object.defineProperty(element, 'clientWidth', { configurable: true, value: box.clientWidth });
}
