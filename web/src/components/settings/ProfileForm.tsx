import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { saveProfile, type Profile } from '../../lib/profile.ts';
import { Icon } from '../Icon.tsx';
import { Field, TextInput } from '../frame/Field.tsx';
import '../../styles/profile-form.css';

export const PROFILE_PRIVACY_NOTE =
  'This stays in this browser. Use your first name; never enter customer information.';

export const MISSING_NAME = 'Enter your name to continue.';

/**
 * Name (required), role and location (optional). Saving writes the profile on this device only;
 * there is no account and nothing is sent anywhere. It is the one form for a profile: Settings
 * uses it to create and to edit, and the sign-in page uses it with its own wording.
 */
export function ProfileForm({
  initial,
  submitLabel,
  onSaved,
  onCancel,
  note = PROFILE_PRIVACY_NOTE,
  missingName = MISSING_NAME,
  nameAutoComplete = 'name',
  autoFocusName = false,
  children,
}: {
  initial?: Pick<Profile, 'name' | 'role' | 'location'> | null;
  submitLabel: string;
  onSaved(profile: Profile): void;
  onCancel?(): void;
  /** Said above the fields; `null` for none. */
  note?: ReactNode | null;
  /** Said when the name is missing. */
  missingName?: string;
  nameAutoComplete?: 'name' | 'given-name';
  /** Put the cursor in the name when the form appears (because someone just asked for it). */
  autoFocusName?: boolean;
  /** More actions after the buttons (a link to carry on without a profile, say). */
  children?: ReactNode;
}) {
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initial?.name ?? '');
  const [role, setRole] = useState(initial?.role ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [problem, setProblem] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const saved = saveProfile({ name, role, location });
    if (!saved) {
      setProblem(missingName);
      nameRef.current?.focus();
      return;
    }
    onSaved(saved);
  };

  return (
    <form className="pf-form" onSubmit={submit} noValidate>
      {note ? <p className="pf-form__note">{note}</p> : null}
      <Field label="Name" error={problem || undefined}>
        <TextInput
          ref={nameRef}
          value={name}
          maxLength={60}
          counter={false}
          autoComplete={nameAutoComplete}
          // eslint-disable-next-line jsx-a11y/no-autofocus -- only when someone has just asked for the form
          autoFocus={autoFocusName}
          data-autofocus=""
          required
          onChange={(event) => {
            setName(event.target.value);
            if (problem) setProblem('');
          }}
        />
      </Field>
      <Field label="Role (optional)">
        <TextInput
          value={role}
          maxLength={80}
          counter={false}
          placeholder="For example, support apprentice"
          autoComplete="organization-title"
          onChange={(event) => setRole(event.target.value)}
        />
      </Field>
      <Field label="Location (optional)">
        <TextInput
          value={location}
          maxLength={80}
          counter={false}
          placeholder="For example, Leeds, UK"
          autoComplete="address-level2"
          onChange={(event) => setLocation(event.target.value)}
        />
      </Field>
      <div className="action-row pf-form__actions">
        <button type="submit" className="action">
          {submitLabel}
          <Icon name="arrow-right" size={18} />
        </button>
        {onCancel ? (
          <button type="button" className="text-link" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        {children}
      </div>
    </form>
  );
}
