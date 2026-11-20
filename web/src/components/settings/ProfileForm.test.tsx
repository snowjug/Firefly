import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getProfile, resetProfileForTests } from '../../lib/profile.ts';
import { MISSING_NAME, PROFILE_PRIVACY_NOTE, ProfileForm } from './ProfileForm.tsx';

beforeEach(() => {
  localStorage.clear();
  resetProfileForTests();
});

describe('ProfileForm', () => {
  it('says first that nothing leaves the browser, and keeps role and place optional', () => {
    render(<ProfileForm submitLabel="Create profile" onSaved={vi.fn()} />);
    expect(screen.getByText(PROFILE_PRIVACY_NOTE)).toBeVisible();
    expect(screen.getByLabelText('Name')).toBeRequired();
    expect(screen.getByLabelText('Role (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Location (optional)')).not.toBeRequired();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it('can leave the note to the page around it, and use its own words for a missing name', async () => {
    const onSaved = vi.fn();
    render(
      <ProfileForm
        submitLabel="Create profile"
        note={null}
        missingName="A name, please."
        onSaved={onSaved}
      />,
    );
    expect(screen.queryByText(PROFILE_PRIVACY_NOTE)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Create profile' }));
    expect(screen.getByText('A name, please.')).toBeVisible();
    expect(screen.queryByText(MISSING_NAME)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveFocus();
    expect(onSaved).not.toHaveBeenCalled();
    expect(getProfile()).toBeNull();
  });

  it('saves trimmed details on this device and hands the profile on', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<ProfileForm submitLabel="Save profile" onSaved={onSaved} />);
    await user.type(screen.getByLabelText('Name'), '  Sam Carter  ');
    await user.type(screen.getByLabelText('Location (optional)'), ' Leeds, UK ');
    await user.click(screen.getByRole('button', { name: 'Save profile' }));
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Sam Carter', role: '', location: 'Leeds, UK' }),
    );
    expect(getProfile()).toMatchObject({ name: 'Sam Carter', location: 'Leeds, UK' });
  });

  it('starts from the details it is given, offers Cancel when it can be cancelled, and puts the cursor in the name on request', async () => {
    const onCancel = vi.fn();
    const { rerender } = render(
      <ProfileForm
        initial={{ name: 'Sam', role: 'Support', location: '' }}
        submitLabel="Save profile"
        onSaved={vi.fn()}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByLabelText('Name')).toHaveValue('Sam');
    expect(screen.getByLabelText('Name')).not.toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    rerender(
      <ProfileForm key="again" submitLabel="Save profile" onSaved={vi.fn()} autoFocusName />,
    );
    expect(screen.getByLabelText('Name')).toHaveFocus();
  });

  it('puts extra actions after the buttons, so a page can offer another way on', () => {
    render(
      <ProfileForm submitLabel="Create profile" onSaved={vi.fn()}>
        <a href="/home">Continue without a profile</a>
      </ProfileForm>,
    );
    const link = screen.getByRole('link', { name: 'Continue without a profile' });
    const button = screen.getByRole('button', { name: 'Create profile' });
    expect(button.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps a name to the limit the profile keeps, so what is typed is what is saved', async () => {
    const user = userEvent.setup();
    render(<ProfileForm submitLabel="Create profile" onSaved={vi.fn()} />);
    const name = screen.getByLabelText('Name');
    expect(name).toHaveAttribute('maxlength', '60');
    await user.type(name, 'x'.repeat(80));
    expect(name).toHaveValue('x'.repeat(60));
  });
});
