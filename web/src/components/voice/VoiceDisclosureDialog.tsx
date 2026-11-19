import { Dialog } from '../Dialog.tsx';
import { Icon, type IconName } from '../Icon.tsx';

const POINTS: readonly { icon: IconName; text: string }[] = [
  {
    icon: 'mic',
    text: 'Your browser turns your speech into text. Firefly only receives that text and handles it like typed text, with obvious personal details replaced.',
  },
  {
    icon: 'shield-check',
    text: 'Firefly never records, keeps or uploads audio.',
  },
  {
    icon: 'globe',
    text: 'In Chrome and Edge, speech recognition is normally done by an online speech service run by the browser’s maker, so your audio is sent to that service under its privacy terms. If your browser can recognise speech on your device, Firefly asks it to.',
  },
  {
    icon: 'volume',
    text: 'Some browser voices for the customer are online voices. They send the customer’s (fictional) words to the browser maker’s speech service.',
  },
  {
    icon: 'alert',
    text: 'Speech recognition makes mistakes. Keep an eye on the transcript, and never use real customer information.',
  },
  {
    icon: 'info',
    text: 'Voice is a beta. It works best in Chrome or Edge, and typing always keeps working.',
  },
];

/**
 * What turning voice on means, in plain words. Used by Settings and by the call screen so the
 * wording is the same wherever voice is switched on. Nothing is switched on until `onAccept`.
 */
export function VoiceDisclosureDialog({
  open,
  onAccept,
  onCancel,
}: {
  open: boolean;
  onAccept(): void;
  onCancel(): void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title="Turn on voice (Beta)?"
      description="Voice lets you speak instead of typing and hear the customer answer."
    >
      <ul role="list" className="stack" style={{ ['--stack-gap' as string]: 'var(--sp-3)' }}>
        {POINTS.map((point) => (
          <li key={point.icon} className="row" style={{ alignItems: 'flex-start' }}>
            <span className="tone-icon" style={{ width: 36, height: 36 }}>
              <Icon name={point.icon} size={18} />
            </span>
            <span className="t-small grow">{point.text}</span>
          </li>
        ))}
      </ul>
      <div className="cluster" style={{ justifyContent: 'flex-end', marginTop: 'var(--sp-5)' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={onAccept} data-autofocus>
          Turn on voice
        </button>
      </div>
    </Dialog>
  );
}
