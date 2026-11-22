import { useEffect, useRef, type RefObject } from 'react';

interface Attachment<T> {
  element: T;
  deps: readonly unknown[];
  detach: () => void;
}

function sameDeps(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
}

/**
 * A ref that follows its element. `attach` runs when the ref points at an element, again when the
 * element is replaced (a keyed remount, a list that swaps its container) and when `deps` change. It
 * returns its own cleanup, which runs before the next attach and on unmount. Hooks that put listeners
 * on an element use this, so a replaced element never quietly loses them. Internal to the interaction
 * hooks: it is not exported from the barrel.
 */
export function useAttachedRef<T extends Element>(
  attach: (element: T) => () => void,
  deps: readonly unknown[],
): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const attachment = useRef<Attachment<T> | null>(null);

  // No dependency list on purpose: comparing the element is the only way to notice that the ref now
  // points somewhere else, and it costs one comparison per render.
  useEffect(() => {
    const element = ref.current;
    const previous = attachment.current;
    if (previous && previous.element === element && sameDeps(previous.deps, deps)) return;
    previous?.detach();
    attachment.current = element ? { element, deps, detach: attach(element) } : null;
  });

  useEffect(
    () => () => {
      attachment.current?.detach();
      attachment.current = null;
    },
    [],
  );

  return ref;
}
