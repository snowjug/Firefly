import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Ledger } from '../components/frame/Ledger.tsx';
import { Icon } from '../components/Icon.tsx';
import { PublicColophon } from '../components/entry/PublicColophon.tsx';
import { ProfileForm } from '../components/settings/ProfileForm.tsx';
import { useDocumentTitle } from '../lib/hooks.ts';
import { clearProfile, firstName, useProfile } from '../lib/profile.ts';
import '../styles/public.css';

/** Only addresses inside this app are honoured, so a crafted link cannot send someone elsewhere. */
function safeNext(value: string | null): string {
  return value && /^\/(?!\/)[\w\-./?=&%#]*$/.test(value) ? value : '/home';
}

const NO_NAME = 'Enter a name so Firefly can greet you. A first name is enough.';

// Where things live, said once and plainly. Organisation sign-in is listed as what it is: not
// there yet.
const WHERE = [
  { label: 'Your profile', value: 'Stays in this browser' },
  { label: 'Your data', value: 'Fictional practice only' },
  {
    label: 'Organisation sign-in',
    value: 'Not available yet',
    note: 'A local profile is all Firefly needs for now.',
  },
  { label: 'Our promise', value: 'Coaching, not assessment' },
] as const;

export default function SignIn() {
  useDocumentTitle('Sign in');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const profile = useProfile();

  const [switching, setSwitching] = useState(false);
  const returning = Boolean(profile) && !switching;

  // When the page changes what it shows (a different name, a sign-out), the heading is where a
  // keyboard or screen-reader user should land, unless the form has just opened with its own focus.
  const heading = useRef<HTMLHeadingElement>(null);
  const shown = useRef(returning);
  useEffect(() => {
    if (shown.current === returning) return;
    shown.current = returning;
    if (returning || !switching) heading.current?.focus();
  }, [returning, switching]);

  return (
    <>
      <main id="main" tabIndex={-1} className="entry">
        <div className="entry__frame">
          <div className="entry__intro">
            <p className="entry__eyebrow type-label">Sign in, on this device</p>
            <h1 className="entry__title" tabIndex={-1} ref={heading}>
              {returning && profile ? (
                <>
                  Welcome back, <em>{firstName(profile.name)}</em>
                </>
              ) : (
                'Create your practice profile'
              )}
            </h1>
            <p className="entry__lead type-lead">
              {returning
                ? 'Your profile is saved in this browser. There is no password and no account.'
                : 'Your profile stays in this browser. There is no password and no account.'}
            </p>
          </div>

          <div className="entry__panel">
            {returning ? (
              <div className="action-row entry__actions">
                <Link to={next} className="action" viewTransition>
                  Continue
                  <Icon name="arrow-right" size={18} />
                </Link>
                <button type="button" className="text-link" onClick={() => setSwitching(true)}>
                  Use a different name
                </button>
              </div>
            ) : (
              <ProfileForm
                key={switching ? 'another' : 'new'}
                submitLabel="Create profile"
                note={null}
                missingName={NO_NAME}
                nameAutoComplete="given-name"
                autoFocusName={switching}
                onSaved={() => void navigate(next, { replace: true })}
              >
                {profile ? (
                  <button type="button" className="text-link" onClick={() => setSwitching(false)}>
                    Keep using {profile.name}
                  </button>
                ) : (
                  <Link to={next} className="text-link">
                    Continue without a profile
                  </Link>
                )}
              </ProfileForm>
            )}
          </div>

          <div className="entry__facts">
            <Ledger rows={WHERE} />
            {profile && !switching ? (
              <div className="entry__block">
                <button
                  type="button"
                  className="text-link entry__signout"
                  onClick={() => {
                    clearProfile();
                    setSwitching(false);
                  }}
                >
                  Sign out of this device
                </button>
                <p className="entry__note">
                  Signing out forgets the profile here. Your saved practice calls are kept.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </main>
      <PublicColophon />
    </>
  );
}
