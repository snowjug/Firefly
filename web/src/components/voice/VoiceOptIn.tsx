import { useState } from 'react';
import { Link } from 'react-router';
import { updatePreferences, useProfile } from '../../lib/profile.ts';
import { Icon } from '../Icon.tsx';
import { VoiceDisclosureDialog } from './VoiceDisclosureDialog.tsx';

/**
 * Where voice is switched on from the call screen while it is still off. Choosing it explains what
 * voice does and sends audio, in the same words as Settings, and nothing changes until the person
 * agrees. Without a profile there is nowhere to keep the choice, so it says so instead.
 */
export function VoiceOptIn({ onEnabled }: { onEnabled?: () => void }) {
  const profile = useProfile();
  const [open, setOpen] = useState(false);
  const [needsProfile, setNeedsProfile] = useState(false);

  const choose = () => {
    if (profile) setOpen(true);
    else setNeedsProfile(true);
  };
  const accept = () => {
    updatePreferences({ voice: true });
    setOpen(false);
    onEnabled?.();
  };

  return (
    <>
      <button
        type="button"
        className="ch-link vc-optin"
        onClick={choose}
        title="Speak instead of typing and hear the customer answer. Voice is a beta and is off until you turn it on."
      >
        <Icon name="mic" size={14} />
        Voice (Beta)
      </button>
      {needsProfile && !profile ? (
        <span className="vc-needs-profile" role="status">
          <Link to="/sign-in">Create your profile</Link> to use voice.
        </span>
      ) : null}
      <VoiceDisclosureDialog open={open} onAccept={accept} onCancel={() => setOpen(false)} />
    </>
  );
}
