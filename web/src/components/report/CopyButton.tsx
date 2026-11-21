import { useEffect, useRef, useState, type RefObject } from 'react';
import { Icon } from '../Icon.tsx';

/** Copies text with the clipboard API and falls back to a hidden textarea. Resolves to success. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path (permission denied or an insecure context).
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    area.style.pointerEvents = 'none';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * A quiet "Copy phrasing" action. Success and failure are announced politely. When copying is not
 * possible the target text is selected, so the reader can copy it with the keyboard.
 */
export function CopyButton({
  text,
  targetRef,
  label = 'Copy phrasing',
  done = 'Phrasing copied to the clipboard.',
}: {
  text: string;
  targetRef?: RefObject<HTMLElement | null>;
  label?: string;
  /** What is announced once the text is on the clipboard. */
  done?: string;
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onClick = async () => {
    const ok = await copyText(text);
    if (!ok && targetRef?.current) window.getSelection()?.selectAllChildren(targetRef.current);
    setState(ok ? 'copied' : 'failed');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), 3000);
  };

  return (
    <span className="rp-copy">
      <button type="button" className="rp-link" onClick={onClick}>
        <Icon name={state === 'copied' ? 'check' : 'copy'} size={16} />
        {state === 'copied' ? 'Copied' : label}
      </button>
      <span role="status" className={state === 'failed' ? 'rp-copy__note' : 'sr-only'}>
        {state === 'copied'
          ? done
          : state === 'failed'
            ? 'Copying is not available here. The text is selected, so press Ctrl+C to copy it.'
            : ''}
      </span>
    </span>
  );
}
