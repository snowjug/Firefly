import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { resetProfileForTests, saveProfile } from '../lib/profile.ts';
import NotFound from './NotFound.tsx';

afterEach(() => {
  localStorage.clear();
  resetProfileForTests();
});

describe('NotFound', () => {
  it('says what happened and offers one way back, with a title that says so', () => {
    render(
      <MemoryRouter initialEntries={['/no-such-page']}>
        <NotFound />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole('heading', { level: 1, name: 'That page does not exist' }),
    ).toBeVisible();
    expect(screen.getByText(/The link may be out of date/)).toBeVisible();
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Back to the start' })).toHaveAttribute('href', '/');
    expect(document.title).toBe('Page not found · Firefly');
  });

  it('takes someone who is signed in back to Home, not to the front door', () => {
    saveProfile({ name: 'Sam Rivera' });
    render(
      <MemoryRouter initialEntries={['/no-such-page']}>
        <NotFound />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/home');
    expect(screen.queryByRole('link', { name: 'Back to the start' })).not.toBeInTheDocument();
  });
});
