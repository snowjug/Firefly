import { useId } from 'react';
import type { Hint } from './hints.ts';

/**
 * Guided practice only: a few starter phrases above the line, set as quiet links. Choosing one
 * puts the words in the box for you to change; nothing is sent, and the phrases never say anything
 * about the scenario.
 */
export function HintLinks({ hints, onPick }: { hints: Hint[]; onPick(hint: Hint): void }) {
  const noteId = useId();
  if (hints.length === 0) return null;
  return (
    <div
      className="ch-ideas"
      role="group"
      aria-label="Ideas for what to say"
      aria-describedby={noteId}
    >
      <p id={noteId} className="sr-only">
        Choosing an idea adds a starter phrase to your reply. Nothing is sent until you press Send.
      </p>
      <span className="ch-ideas__label" aria-hidden="true">
        Ideas
      </span>
      <ul role="list" className="ch-ideas__list">
        {hints.map((hint) => (
          <li key={hint.id}>
            <button type="button" className="ch-idea" onClick={() => onPick(hint)}>
              {hint.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
