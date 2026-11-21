import type { MouseEvent } from 'react';
import './jump-links.css';

const FOCUSABLE =
  'button:not([aria-disabled="true"]):not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]';

/** Puts the keyboard on the first control inside an element, or on the element itself. */
function focusWithin(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  (target.querySelector<HTMLElement>(FOCUSABLE) ?? target).focus();
}

/**
 * "Jump to" links for the places a call keeps its work: the controls, the transcript and, in a
 * typed call, the reply box. They come right after the page's own skip link, show only while
 * focused, and move focus without touching the address bar or the history.
 */
export function JumpLinks({ reply }: { reply: boolean }) {
  const jump = (id: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    focusWithin(id);
  };
  return (
    <nav aria-label="Jump to" className="cw-jump">
      <ul role="list" className="cw-jump__list">
        <li>
          <a className="skip-link" href="#cw-controls" onClick={jump('cw-controls')}>
            Jump to the call controls
          </a>
        </li>
        <li>
          <a className="skip-link" href="#cw-transcript" onClick={jump('cw-transcript')}>
            Jump to the transcript
          </a>
        </li>
        {reply ? (
          <li>
            <a className="skip-link" href="#cw-reply" onClick={jump('cw-reply')}>
              Jump to the reply box
            </a>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
