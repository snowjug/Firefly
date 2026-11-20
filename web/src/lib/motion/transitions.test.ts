import { afterEach, describe, expect, it, vi } from 'vitest';
import { installViewTransitionSkip } from './transitions.ts';

type Fake = { startViewTransition?: unknown };

function fakeTransition() {
  let finish: () => void = () => {};
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  return { skipTransition: vi.fn(), finished, finish };
}

const doc = document as unknown as Fake;

afterEach(() => {
  delete doc.startViewTransition;
});

describe('skipping view transitions on input', () => {
  it('leaves browsers without view transitions alone', () => {
    delete doc.startViewTransition;
    const uninstall = installViewTransitionSkip(document);
    expect(doc.startViewTransition).toBeUndefined();
    expect(() => uninstall()).not.toThrow();
  });

  it('skips a running transition on the first pointerdown, once', () => {
    const transition = fakeTransition();
    doc.startViewTransition = vi.fn(() => transition);
    const uninstall = installViewTransitionSkip(document);

    (document as unknown as { startViewTransition: () => unknown }).startViewTransition();
    document.dispatchEvent(new Event('pointerdown'));
    document.dispatchEvent(new Event('pointerdown'));
    expect(transition.skipTransition).toHaveBeenCalledTimes(1);
    uninstall();
  });

  it('skips on a key press too, and not at all once the transition has finished', async () => {
    const transition = fakeTransition();
    const starter = vi.fn(() => transition);
    doc.startViewTransition = starter;
    const uninstall = installViewTransitionSkip(document);
    const start = () =>
      (document as unknown as { startViewTransition: () => unknown }).startViewTransition();

    start();
    document.dispatchEvent(new Event('keydown'));
    expect(transition.skipTransition).toHaveBeenCalledTimes(1);

    const done = fakeTransition();
    starter.mockReturnValue(done);
    start();
    done.finish();
    await done.finished;
    await Promise.resolve();
    document.dispatchEvent(new Event('pointerdown'));
    expect(done.skipTransition).not.toHaveBeenCalled();
    uninstall();
  });

  it('passes the update callback through and restores the original when uninstalled', () => {
    const original = vi.fn(() => fakeTransition());
    doc.startViewTransition = original;
    const uninstall = installViewTransitionSkip(document);
    const update = vi.fn();
    (
      document as unknown as { startViewTransition: (cb: () => void) => unknown }
    ).startViewTransition(update);
    expect(original).toHaveBeenCalledWith(update);

    uninstall();
    expect(doc.startViewTransition).toBe(original);
  });
});
