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
  });

  it('will not continue without a name, and says why', async () => {
    const user = userEvent.setup();
    renderSignIn();
    await user.type(screen.getByLabelText('Name'), '   ');
    await user.click(screen.getByRole('button', { name: /Continue/ }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Enter a name/);
    expect(screen.getByLabelText('Name')).toHaveFocus();
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
    expect(getProfile()).toBeNull();
  });

  it('saves the profile and opens the dashboard', async () => {
    const user = userEvent.setup();
    renderSignIn();
    await user.type(screen.getByLabelText('Name'), '  Priya Raman ');
    await user.type(screen.getByLabelText(/Role/), 'Apprentice support engineer');
    await user.type(screen.getByLabelText(/Location/), 'Pune');
    await user.click(screen.getByRole('button', { name: /Continue/ }));
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

  it('welcomes someone back, and lets them switch to another name or keep the current one', async () => {
    saveProfile({ name: 'Priya Raman' });
    const user = userEvent.setup();
    renderSignIn();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome back, Priya');
    expect(screen.getByRole('link', { name: /Continue/ })).toHaveAttribute('href', '/home');

    await user.click(screen.getByRole('button', { name: 'Use a different name' }));
    expect(screen.getByLabelText('Name')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Keep using Priya Raman' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome back, Priya');

    await user.click(screen.getByRole('button', { name: 'Sign out of this device' }));
    expect(getProfile()).toBeNull();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Create your practice profile' }),
    ).toBeInTheDocument();
  });
});

describe('SignIn: honesty about organisation sign-in', () => {
  it('shows that organisation sign-in is not available instead of pretending', async () => {
    const user = userEvent.setup();
    renderSignIn();
    const button = screen.getByRole('button', { name: /Sign in with your organisation/ });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription(/not available yet/);
    await user.click(button);
    expect(getProfile()).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Create your practice profile',
    );
    expect(screen.queryByText(/Microsoft/i)).not.toBeInTheDocument();
  });

  it('states what is kept where', () => {
    renderSignIn();
    const facts = screen.getByRole('list');
    expect(within(facts).getByText('Stays in this browser')).toBeInTheDocument();
    expect(within(facts).getByText('Fictional practice only')).toBeInTheDocument();
    expect(within(facts).getByText('Coaching, not assessment')).toBeInTheDocument();
  });
});
