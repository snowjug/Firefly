import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onPointerFrame } from './pointer.ts';

describe('onPointerFrame', () => {
  let frames: FrameRequestCallback[] = [];
  beforeEach(() => {
    frames = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {
      frames = [];
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  const move = (target: EventTarget, x: number, y: number) => {
    const event = new Event('pointermove') as PointerEvent;
    Object.defineProperty(event, 'clientX', { value: x });
    Object.defineProperty(event, 'clientY', { value: y });
    target.dispatchEvent(event);
  };

  it('calls the handler once per frame with the latest position', () => {
    const target = new EventTarget();
    const handler = vi.fn();
    onPointerFrame(target, handler);
    move(target, 1, 1);
    move(target, 2, 2);
    move(target, 30, 40);
    expect(handler).not.toHaveBeenCalled();
    frames.shift()?.(0);
    expect(handler).toHaveBeenCalledExactlyOnceWith(30, 40);
    move(target, 5, 6);
    frames.shift()?.(16);
    expect(handler).toHaveBeenLastCalledWith(5, 6);
  });

  it('stops listening and drops a pending frame when detached', () => {
    const target = new EventTarget();
    const handler = vi.fn();
    const detach = onPointerFrame(target, handler);
    move(target, 3, 3);
    detach();
    move(target, 4, 4);
    expect(frames).toHaveLength(0);
    expect(handler).not.toHaveBeenCalled();
  });
});
