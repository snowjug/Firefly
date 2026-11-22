import type { Ref, RefCallback } from 'react';

/**
 * One `ref` for an element that needs several: `useTilt` and `useOnScreen` on the same card, say.
 * Object refs get the element and then null; a callback ref is called the same way, or, if it
 * returns a cleanup function (React 19), that function is called instead of passing null.
 */
export function mergeRefs<T>(...refs: Array<Ref<T> | undefined>): RefCallback<T> {
  return (node) => {
    const cleanups: Array<() => void> = [];
    for (const ref of refs) {
      if (typeof ref === 'function') {
        const cleanup = ref(node);
        cleanups.push(typeof cleanup === 'function' ? cleanup : () => ref(null));
      } else if (ref) {
        ref.current = node;
        cleanups.push(() => {
          ref.current = null;
        });
      }
    }
    return () => cleanups.forEach((cleanup) => cleanup());
  };
}
