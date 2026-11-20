import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { getProfile, resetProfileForTests, saveProfile } from '../lib/profile.ts';
import SignIn from './SignIn.tsx';

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
}

function renderSignIn(entry = '/sign-in') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

const create = () => screen.getByRole('button', { name: 'Create profile' });

beforeEach(() => {
  localStorage.clear();
  resetProfileForTests();
});

describe('SignIn: a local profile', () => {
  it('asks for a name, and says plainly that there is no account', () => {
    renderSignIn();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Create your practice profile' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/no password and no account/)).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeRequired();
    expect(screen.getByLabelText(/Role/)).not.toBeRequired();
    expect(screen.getByLabelText(/Location/)).not.toBeRequired();
    // The page does not start with the cursor in a field: the skip link and the page come first.
    expect(screen.getByLabelText('Name')).not.toHaveFocus();
  });

  it('will not continue without a name, and says why', async () => {
    const user = userEvent.setup();
    renderSignIn();
    await user.type(screen.getByLabelText('Name'), '   ');
    await user.click(create());
    expect(
      screen.getByText('Enter a name so Firefly can greet you. A first name is enough.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveFocus();
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription(/Enter a name/);
    expect(getProfile()).toBeNull();

    // Typing clears the complaint.
    await user.type(screen.getByLabelText('Name'), 'P');
    expect(screen.queryByText(/Enter a name so Firefly/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-invalid');
  });

  it('saves the profile and opens the dashboard', async () => {
    const user = userEvent.setup();
    renderSignIn();
    await user.type(screen.getByLabelText('Name'), '  Priya Raman ');
    await user.type(screen.getByLabelText(/Role/), 'Apprentice support engineer');
    await user.type(screen.getByLabelText(/Location/), 'Pune');
    await user.click(create());
    expect(await screen.findByTestId('where')).toHaveTextContent('/home');
    expect(getProfile()).toMatchObject({
      name: 'Priya Raman',
      role: 'Apprentice support engineer',
      location: 'Pune',
    });
  });

  it('continues to the page that sent you here, but never to another site', async () => {
    const user = userEvent.setup();
    const first = renderSignIn('/sign-in?next=/rewards');
    await user.type(screen.getByLabelText('Name'), 'Priya{Enter}');
    expect(await screen.findByTestId('where')).toHaveTextContent('/rewards');
    first.unmount();

    localStorage.clear();
    resetProfileForTests();
    renderSignIn('/sign-in?next=//evil.example/steal');
    await user.type(screen.getByLabelText('Name'), 'Priya{Enter}');
    expect(await screen.findByTestId('where')).toHaveTextContent('/home');
  });

  it('can carry on without a profile, and keeps nothing', async () => {
    const user = userEvent.setup();
    const { unmount } = renderSignIn('/sign-in?next=/scenarios');
    const link = screen.getByRole('link', { name: 'Continue without a profile' });
    expect(link).toHaveAttribute('href', '/scenarios');
    await user.click(link);
    expect(await screen.findByTestId('where')).toHaveTextContent('/scenarios');
    expect(getProfile()).toBeNull();
    unmount();

    // And a link from somewhere else never leaves the app.
    renderSignIn('/sign-in?next=https://evil.example');
    expect(screen.getByRole('link', { name: 'Continue without a profile' })).toHaveAttribute(
      'href',
      '/home',
    );
  });

  it('welcomes someone back, and lets them switch to another name or keep the current one', async () => {
    saveProfile({ name: 'Priya Raman' });
    const user = userEvent.setup();
    renderSignIn();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome back, Priya');
    expect(screen.getByRole('link', { name: 'Continue' })).toHaveAttribute('href', '/home');
    expect(screen.queryByRole('link', { name: 'Continue without a profile' })).toBeNull();

    // A different name: the form opens empty with the cursor in it.
    await user.click(screen.getByRole('button', { name: 'Use a different name' }));
    expect(screen.getByLabelText('Name')).toHaveValue('');
    expect(screen.getByLabelText('Name')).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Sign out of this device' })).toBeNull();

    // Keeping the current one goes back, and focus lands on the heading.
    await user.click(screen.getByRole('button', { name: 'Keep using Priya Raman' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome back, Priya');
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
    expect(getProfile()?.name).toBe('Priya Raman');

    await user.click(screen.getByRole('button', { name: 'Sign out of this device' }));
    expect(getProfile()).toBeNull();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Create your practice profile' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
  });

  it('replaces the profile when a different name is created', async () => {
    saveProfile({ name: 'Priya Raman', role: 'Support' });
    const user = userEvent.setup();
    renderSignIn();
    await user.click(screen.getByRole('button', { name: 'Use a different name' }));
    await user.type(screen.getByLabelText('Name'), 'Sam Carter');
    await user.click(create());
    expect(await screen.findByTestId('where')).toHaveTextContent('/home');
    expect(getProfile()).toMatchObject({ name: 'Sam Carter', role: '' });
  });
});

describe('SignIn: honesty about organisation sign-in', () => {
  it('shows that organisation sign-in is not available instead of pretending', async () => {
    const user = userEvent.setup();
    renderSignIn();
    const row = screen.getByText('Organisation sign-in').closest('div') as HTMLElement;
    expect(within(row).getByText('Not available yet')).toBeInTheDocument();
    expect(
      within(row).getByText(/A local profile is all Firefly needs for now/),
    ).toBeInTheDocument();
    // Nothing that looks like a way to sign in with an organisation, and no one named.
    expect(screen.queryByRole('button', { name: /organisation/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Microsoft/i)).not.toBeInTheDocument();
    await user.click(row);
    expect(getProfile()).toBeNull();
  });

  it('states what is kept where', () => {
    renderSignIn();
    expect(screen.getByText('Stays in this browser')).toBeInTheDocument();
    expect(screen.getByText('Fictional practice only')).toBeInTheDocument();
    expect(screen.getByText('Coaching, not assessment')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toHaveTextContent(/Firefly is a training aid/);
  });

  it('leaves the banner to the frame', () => {
    renderSignIn();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
  });
});

describe('SignIn: imperfect content', () => {
  it('keeps a very long name to the field limit and still lays out a welcome for it', () => {
    saveProfile({ name: `${'Wolfeschlegelsteinhausenbergerdorff '.repeat(4)}Jr` });
    renderSignIn();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Welcome back, Wolfe/);
    expect(getProfile()?.name.length).toBeLessThanOrEqual(60);
  });
});
