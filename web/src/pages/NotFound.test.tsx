import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import NotFound from './NotFound.tsx';

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
});
