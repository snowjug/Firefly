import { useEffect, useRef, useState } from 'react';
import { clearProfile, initials, useProfile } from '../../lib/profile.ts';
import { useToast } from '../../lib/toast.tsx';
import { Dialog } from '../Dialog.tsx';
import { Icon } from '../Icon.tsx';
import { ProfileForm } from './ProfileForm.tsx';

/**
 * Who this browser belongs to: initials, name, role and place, with a way to edit them and to sign
 * out of this device. With no profile yet it is the form to create one. There is no account; the
 * profile lives in this browser and "signing out" only forgets it here.
 */
export function ProfileCard() {
  const profile = useProfile();
  const hasProfile = profile !== null;
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const card = useRef<HTMLElement>(null);
  const landOnCard = useRef(false);

  // Creating a profile or signing out swaps the card's contents, so the button that had focus is gone.
  // Land on the card instead of nowhere.
  useEffect(() => {
    if (!landOnCard.current) return;
    landOnCard.current = false;
    card.current?.focus();
  }, [hasProfile]);

  if (!profile) {
    return (
      <section
        ref={card}
        tabIndex={-1}
        className="glass card st-profile st-profile-new"
        aria-labelledby="st-profile-title"
      >
        <span className="tone-icon" data-tone="blue" aria-hidden="true">
          <Icon name="user" size={22} />
        </span>
        <h2 id="st-profile-title" className="t-section">
          Create your profile
        </h2>
        <p className="t-small t-muted">
          Add your name so Firefly can greet you and keep your preferences. There is no account: it
          is saved in this browser only.
        </p>
        <ProfileForm
          submitLabel="Create profile"
          onSaved={() => {
            landOnCard.current = true;
            toast({ tone: 'positive', title: 'Profile created.' });
          }}
        />
      </section>
    );
  }

  const signOut = () => {
    landOnCard.current = true;
    clearProfile();
    toast({
      tone: 'positive',
      title: 'Signed out of this device.',
      message: 'Your saved practice calls are kept.',
    });
  };

  return (
    <section
      ref={card}
      tabIndex={-1}
      className="glass card st-profile"
      aria-labelledby="st-profile-title"
    >
      <h2 id="st-profile-title" className="sr-only">
        Your profile
      </h2>
      <span className="avatar-initials avatar-initials-lg" aria-hidden="true">
        {initials(profile.name)}
      </span>
      <div className="st-identity">
        <p className="st-name">{profile.name}</p>
        {profile.role ? <p className="st-role">{profile.role}</p> : null}
        {profile.location ? (
          <p className="st-place">
            <Icon name="map-pin" size={15} />
            <span>{profile.location}</span>
          </p>
        ) : null}
      </div>
      <button type="button" className="btn btn-secondary st-edit" onClick={() => setEditing(true)}>
        <Icon name="edit" size={16} /> Edit profile
      </button>

      <hr className="divider st-divider" />
      <div className="st-signout">
        <button type="button" className="btn btn-ghost" onClick={signOut}>
          <Icon name="log-out" size={16} /> Sign out of this device
        </button>
        <p className="hint">
          Your profile is stored in this browser only. Signing out forgets it here; your saved
          practice calls are kept.
        </p>
      </div>

      <Dialog open={editing} onClose={() => setEditing(false)} title="Edit profile">
        <ProfileForm
          initial={profile}
          submitLabel="Save profile"
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            toast({ tone: 'positive', title: 'Profile saved.' });
          }}
        />
      </Dialog>
    </section>
  );
}
