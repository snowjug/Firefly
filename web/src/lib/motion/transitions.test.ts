import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installViewTransitionSkip } from './transitions.ts';

// Vitest does not process stylesheets, so `?raw` would be empty: read the file itself.
const transitionStyles = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../styles/transitions.css'),
  'utf8',
);

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

  it('does not let a skipped transition leave unhandled rejections behind', async () => {
    const unhandled: unknown[] = [];
    const record = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', record);

    const abort = () => Promise.reject(new DOMException('Transition was skipped', 'AbortError'));
    const transition = {
      ...fakeTransition(),
      ready: abort(),
      updateCallbackDone: abort(),
    };
    doc.startViewTransition = vi.fn(() => transition);
    const uninstall = installViewTransitionSkip(document);
    (document as unknown as { startViewTransition: () => unknown }).startViewTransition();

    await new Promise((resolve) => setTimeout(resolve, 20));
    process.off('unhandledRejection', record);
    uninstall();
    expect(unhandled).toEqual([]);
  });
});

describe('a click that begins while a transition runs', () => {
  const start = () =>
    (document as unknown as { startViewTransition: () => unknown }).startViewTransition();

  /** A button on the page and a pointer over it; frames are immediate. */
  function setup() {
    const transition = fakeTransition();
    doc.startViewTransition = vi.fn(() => transition);
    const uninstall = installViewTransitionSkip(document);
    const button = document.createElement('button');
    const pressed = vi.fn();
    button.addEventListener('click', pressed);
    document.body.append(button);
    // jsdom has no layout: the pointer is "over" the button.
    (document as unknown as { elementFromPoint: () => Element | null }).elementFromPoint = () =>
      button;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    const cleanup = () => {
      uninstall();
      button.remove();
      delete (document as unknown as { elementFromPoint?: unknown }).elementFromPoint;
      vi.unstubAllGlobals();
    };
    return { transition, button, pressed, cleanup };
  }

  it('is handed to the control under the pointer when the browser sent it to <html>', () => {
    const { pressed, cleanup } = setup();
    start();
    document.dispatchEvent(new Event('pointerdown'));
    document.documentElement.dispatchEvent(
      new MouseEvent('click', { bubbles: true, clientX: 12, clientY: 34 }),
    );
    expect(pressed).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('is not repeated when the page heard the click itself', () => {
    const { button, pressed, cleanup } = setup();
    start();
    document.dispatchEvent(new Event('pointerdown'));
    button.click();
    expect(pressed).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('is left alone when no transition was running at the press', () => {
    const { pressed, cleanup } = setup();
    document.dispatchEvent(new Event('pointerdown'));
    document.documentElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(pressed).not.toHaveBeenCalled();
    cleanup();
  });

  it('does not press a control that is disabled', () => {
    const { button, pressed, cleanup } = setup();
    button.disabled = true;
    start();
    document.dispatchEvent(new Event('pointerdown'));
    document.documentElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(pressed).not.toHaveBeenCalled();
    cleanup();
  });
});

describe('the transition styles', () => {
  const css = transitionStyles.replace(/\/\*[\s\S]*?\*\//g, '');

  it('never names the field behind the page: a named group is painted above the page snapshot', () => {
    expect(css).not.toMatch(/firefly-world/);
    expect(css).not.toMatch(/data-vt-persist=['"]world['"]/);
  });

  it('dissolves the old and new page with one duration and one easing, so the field stays steady', () => {
    const rule = (selector: string) =>
      css.match(new RegExp(`${selector.replace(/[()]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
    const animation = (selector: string) =>
      rule(selector).match(/animation:\s*vt-fade-(?:in|out)\s+([^;]+?)\s+both;/)?.[1];
    const oldRoot = animation('::view-transition-old(root)');
    const newRoot = animation('::view-transition-new(root)');
    expect(oldRoot).toBeDefined();
    expect(oldRoot).toBe(newRoot);
  });
});
