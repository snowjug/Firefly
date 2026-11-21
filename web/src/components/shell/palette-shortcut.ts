import { useEffect, useRef } from 'react';

const TEXT_INPUT_TYPES = new Set([
  'text',
  'search',
  'email',
  'url',
  'tel',
  'password',
  'number',
  'date',
  'datetime-local',
  'month',
  'time',
  'week',
]);

/** True while the keyboard is typing text: a field, a text area or an editable region. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(target.type);
  const role = target.getAttribute('role');
  return role === 'textbox' || role === 'searchbox' || role === 'combobox';
}

/**
 * Ctrl+K or Cmd+K, anywhere, toggles the palette. A field where someone is typing keeps the key
 * (the call's reply box, a search box) unless it opts in with `data-allow-palette`. Nothing happens
 * while another modal dialog is open, which already owns the keyboard.
 */
export function usePaletteShortcut(toggle: () => void): void {
  const latest = useRef(toggle);
  useEffect(() => {
    latest.current = toggle;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || event.altKey || event.shiftKey || event.isComposing) {
        return;
      }
      if (!(event.ctrlKey || event.metaKey) || event.defaultPrevented) return;
      const target = event.target;
      if (isTyping(target) && !(target as HTMLElement).closest('[data-allow-palette]')) return;
      if (document.querySelector('[aria-modal="true"]:not([data-palette])')) return;
      event.preventDefault();
      latest.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
}
