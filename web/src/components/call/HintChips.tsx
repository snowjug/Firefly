import { useId } from 'react';
import type { Hint } from './hints.ts';

/**
 * Guided practice only: a few starter phrases above the message box. Choosing one puts the words in
 * the box for you to change; nothing is sent, and the phrases never say anything about the scenario.
 */
export function HintChips({ hints, onPick }: { hints: Hint[]; onPick(hint: Hint): void }) {
  const noteId = useId();
  if (hints.length === 0) return null;
  return (
    <div
      className="call-hints"
      role="group"
      aria-label="Ideas for what to say"
      aria-describedby={noteId}
    >
      <p id={noteId} className="sr-only">
        Choosing an idea adds a starter phrase to your reply. Nothing is sent until you press Send.
      </p>
      <ul role="list" className="call-hints-list">
        {hints.map((hint) => (
          <li key={hint.id}>
            <button type="button" className="call-hint" onClick={() => onPick(hint)}>
              {hint.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
