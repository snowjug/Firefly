import { useEffect, type RefObject } from 'react';

/**
 * Dismisses a disclosure panel the way people expect: Escape closes it and returns focus to the
 * button that opened it, and so does moving focus out of the container. Listens only while open.
 */
export function useDismiss(
  container: RefObject<HTMLElement | null>,
  button: RefObject<HTMLElement | null>,
  open: boolean,
  close: () => void,
) {
  useEffect(() => {
    const element = container.current;
    if (!open || !element) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      close();
      button.current?.focus();
    };
    const onFocusOut = (event: FocusEvent) => {
      if (!element.contains(event.relatedTarget as Node | null)) close();
    };
    element.addEventListener('keydown', onKeyDown);
    element.addEventListener('focusout', onFocusOut);
    return () => {
      element.removeEventListener('keydown', onKeyDown);
      element.removeEventListener('focusout', onFocusOut);
    };
  }, [container, button, open, close]);
}
