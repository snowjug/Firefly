import { useEffect, useRef, useState } from 'react';
import { clearProfile, useProfile } from '../../lib/profile.ts';
import { useToast } from '../../lib/toast.tsx';
import { Dialog } from '../Dialog.tsx';
import { Ledger } from '../frame/Ledger.tsx';
import { Section } from '../frame/PageFrame.tsx';
import { ProfileForm } from './ProfileForm.tsx';

/**
 * Who this browser belongs to: the name, role and place, with a way to edit them and to sign out of
 * this device. With no profile yet it is the form to create one. There is no account; the profile
 * lives in this browser and "signing out" only forgets it here.
 */
export function ProfilePanel() {
  const profile = useProfile();
  const hasProfile = profile !== null;
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const landOnPanel = useRef(false);

  // Creating a profile or signing out swaps what is shown, so the button that had focus is gone.
  // Land on the panel instead of nowhere.
  useEffect(() => {
    if (!landOnPanel.current) return;
    landOnPanel.current = false;
    panel.current?.focus();
  }, [hasProfile]);

  if (!profile) {
    return (
      <div ref={panel} tabIndex={-1} className="st-panel-body">
        <Section title="Create your profile">
          <div className="st-stack">
            <p className="st-lede">
              Add your name so Firefly can greet you and keep your preferences. There is no account.
            </p>
            <ProfileForm
              submitLabel="Create profile"
              onSaved={() => {
                landOnPanel.current = true;
                toast({ tone: 'positive', title: 'Profile created.' });
              }}
            />
          </div>
        </Section>
      </div>
    );
  }

  const signOut = () => {
    landOnPanel.current = true;
    clearProfile();
    toast({
      tone: 'positive',
      title: 'Signed out of this device.',
      message: 'Your saved practice calls are kept.',
    });
  };

  const details = [
    profile.role ? { label: 'Role', value: profile.role } : null,
    profile.location ? { label: 'Location', value: profile.location } : null,
  ].filter((row) => row !== null);

  return (
    <div ref={panel} tabIndex={-1} className="st-panel-body">
      <section className="st-identity" aria-labelledby="st-profile-name">
        <h2 id="st-profile-name" className="st-name">
          {profile.name}
        </h2>
        {details.length > 0 ? <Ledger rows={details} /> : null}
        <div className="action-row">
          <button type="button" className="action action--quiet" onClick={() => setEditing(true)}>
            Edit profile
          </button>
        </div>
      </section>

      <Section title="This device">
        <div className="st-stack">
          <p className="st-lede">
            Your profile is stored in this browser only. Signing out forgets it here; your saved
            practice calls are kept.
          </p>
          <div className="action-row">
            <button type="button" className="action action--quiet" onClick={signOut}>
              Sign out of this device
            </button>
          </div>
        </div>
      </Section>

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
    </div>
  );
}
