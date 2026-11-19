import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Icon } from '../components/Icon.tsx';
import { BuildingArt } from '../components/illustration/index.ts';
import { BrandMark } from '../components/shell/BrandMark.tsx';
import { useDocumentTitle } from '../lib/hooks.ts';
import { clearProfile, firstName, saveProfile, useProfile } from '../lib/profile.ts';
import '../styles/public.css';

/** Only addresses inside this app are honoured, so a crafted link cannot send someone elsewhere. */
function safeNext(value: string | null): string {
  return value && /^\/(?!\/)[\w\-./?=&%#]*$/.test(value) ? value : '/home';
}

export default function SignIn() {
  useDocumentTitle('Sign in');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const profile = useProfile();

  const [switching, setSwitching] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const returning = Boolean(profile) && !switching;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!saveProfile({ name, role, location })) {
      setError('Enter a name so Firefly can greet you. A first name is enough.');
      nameRef.current?.focus();
      return;
    }
    void navigate(next, { replace: true });
  };

  return (
    <main id="main" tabIndex={-1} className="si">
      <section className="si-art" aria-label="Firefly">
        <div className="si-art-visual">
          <BuildingArt />
        </div>
        <span className="si-art-rule" aria-hidden="true" />
        <h2>Practice before it counts.</h2>
        <p>
          A safe place to rehearse difficult customer conversations, with coaching you can trust.
        </p>
      </section>

      <div className="si-panel">
        <div className="glass si-card">
          <Link to="/" className="brand" aria-label="Firefly home">
            <BrandMark />
            <span>Firefly</span>
          </Link>

          {returning && profile ? (
            <>
              <div>
                <h1>Welcome back, {firstName(profile.name)}</h1>
                <p className="t-muted" style={{ marginTop: 'var(--sp-2)' }}>
                  Your profile is saved in this browser. There is no password and no account.
                </p>
              </div>
              <Link to={next} className="btn btn-primary btn-lg">
                Continue <Icon name="arrow-right" size={18} />
              </Link>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setSwitching(true);
                  setName('');
                  setRole('');
                  setLocation('');
                }}
              >
                Use a different name
              </button>
            </>
          ) : (
            <>
              <div>
                <h1>Create your practice profile</h1>
                <p className="t-muted" style={{ marginTop: 'var(--sp-2)' }}>
                  Your profile stays in this browser. There is no password and no account.
                </p>
              </div>
              <form className="stack" noValidate onSubmit={submit}>
                <div className="field">
                  <label className="label" htmlFor="si-name">
                    Name
                  </label>
                  <input
                    id="si-name"
                    ref={nameRef}
                    className="input"
                    value={name}
                    maxLength={60}
                    autoComplete="given-name"
                    required
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? 'si-name-error' : undefined}
                    onChange={(event) => {
                      setName(event.target.value);
                      if (error) setError(null);
                    }}
                  />
                  {error ? (
                    <p id="si-name-error" className="field-error" role="alert">
                      {error}
                    </p>
                  ) : null}
                </div>
                <div className="field">
                  <label className="label" htmlFor="si-role">
                    Role <span className="t-meta">(optional)</span>
                  </label>
                  <input
                    id="si-role"
                    className="input"
                    value={role}
                    maxLength={80}
                    placeholder="For example, apprentice support engineer"
                    autoComplete="organization-title"
                    onChange={(event) => setRole(event.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="label" htmlFor="si-location">
                    Location <span className="t-meta">(optional)</span>
                  </label>
                  <input
                    id="si-location"
                    className="input"
                    value={location}
                    maxLength={80}
                    autoComplete="address-level2"
                    onChange={(event) => setLocation(event.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-lg">
                  Continue <Icon name="arrow-right" size={18} />
                </button>
              </form>
              {profile ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setSwitching(false);
                    setError(null);
                  }}
                >
                  Keep using {profile.name}
                </button>
              ) : null}
            </>
          )}

          <div className="si-or" aria-hidden="true">
            or
          </div>
          <div className="stack" style={{ ['--stack-gap' as string]: 'var(--sp-2)' }}>
            <button
              type="button"
              className="btn btn-secondary"
              aria-disabled="true"
              aria-describedby="si-org-note"
              onClick={(event) => event.preventDefault()}
              style={{ opacity: 0.6, cursor: 'not-allowed' }}
            >
              <Icon name="building" size={18} /> Sign in with your organisation
            </button>
            <p id="si-org-note" className="t-meta">
              Organisation sign-in is not available yet. A local profile is all Firefly needs for
              now.
            </p>
          </div>

          <ul className="si-facts" role="list">
            <li>
              <Icon name="user" size={20} />
              <strong>Your profile</strong>
              Stays in this browser
            </li>
            <li>
              <Icon name="lock" size={20} />
              <strong>Your data</strong>
              Fictional practice only
            </li>
            <li>
              <Icon name="shield-check" size={20} />
              <strong>Our promise</strong>
              Coaching, not assessment
            </li>
          </ul>
          {profile && switching ? null : profile ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                clearProfile();
                setSwitching(false);
              }}
            >
              Sign out of this device
            </button>
          ) : null}
        </div>
      </div>
    </main>
  );
}
