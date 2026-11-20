import { Icon } from '../Icon.tsx';

/** Reads one customer message aloud with the browser's voice. It works with or without a voice call. */
export function ListenButton({
  text,
  who,
  time,
  onListen,
}: {
  text: string;
  /** Who said it, so each button has its own name for a screen reader. */
  who: string;
  time: string;
  onListen(text: string): void;
}) {
  return (
    <button
      type="button"
      className="ch-listen"
      aria-label={`Listen to ${who}'s message from ${time}`}
      onClick={() => onListen(text)}
    >
      <Icon name="volume" size={14} />
      Listen
    </button>
  );
}
