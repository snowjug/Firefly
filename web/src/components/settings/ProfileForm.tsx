import { useId, useRef, useState, type FormEvent } from 'react';
import { saveProfile, type Profile } from '../../lib/profile.ts';

export const PROFILE_PRIVACY_NOTE =
  'This stays in this browser. Use your first name; never enter customer information.';

/**
 * Name (required), role and location (optional). Saving writes the profile on this device only;
 * there is no account and nothing is sent anywhere.
 */
export function ProfileForm({
  initial,
  submitLabel,
  onSaved,
  onCancel,
}: {
  initial?: Pick<Profile, 'name' | 'role' | 'location'> | null;
  submitLabel: string;
  onSaved(profile: Profile): void;
  onCancel?(): void;
}) {
  const uid = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initial?.name ?? '');
  const [role, setRole] = useState(initial?.role ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [problem, setProblem] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const saved = saveProfile({ name, role, location });
    if (!saved) {
      setProblem('Enter your name to continue.');
      nameRef.current?.focus();
      return;
    }
    onSaved(saved);
  };

  return (
    <form className="stack st-form" onSubmit={submit} noValidate>
      <p className="t-small t-muted" id={`${uid}-note`}>
        {PROFILE_PRIVACY_NOTE}
      </p>
      <div className="field">
        <label className="label" htmlFor={`${uid}-name`}>
          Name
        </label>
        <input
          ref={nameRef}
          id={`${uid}-name`}
          className="input"
          value={name}
          maxLength={60}
          autoComplete="name"
          data-autofocus=""
          aria-required="true"
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? `${uid}-problem` : undefined}
          onChange={(event) => {
            setName(event.target.value);
            if (problem) setProblem('');
          }}
        />
        {problem ? (
          <p id={`${uid}-problem`} className="field-error" role="alert">
            {problem}
          </p>
        ) : null}
      </div>
      <div className="field">
        <label className="label" htmlFor={`${uid}-role`}>
          Role (optional)
        </label>
        <input
          id={`${uid}-role`}
          className="input"
          value={role}
          maxLength={80}
          placeholder="For example, support apprentice"
          onChange={(event) => setRole(event.target.value)}
        />
      </div>
      <div className="field">
        <label className="label" htmlFor={`${uid}-location`}>
          Location (optional)
        </label>
        <input
          id={`${uid}-location`}
          className="input"
          value={location}
          maxLength={80}
          placeholder="For example, Leeds, UK"
          onChange={(event) => setLocation(event.target.value)}
        />
      </div>
      <div className="cluster st-form-actions">
        <button type="submit" className="btn btn-primary">
          {submitLabel}
        </button>
        {onCancel ? (
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
