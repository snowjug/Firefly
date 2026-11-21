import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { ThemeProvider } from '../../lib/theme.tsx';
import type { ShellMode } from './shell-mode.ts';
import { Wordmark } from './Wordmark.tsx';

function mount(mode: ShellMode) {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <Wordmark mode={mode} />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

describe('the wordmark', () => {
  it('links home from the app, and to the front door from the front door', () => {
    const app = mount('app');
    expect(screen.getByRole('link', { name: 'Firefly, home' })).toHaveAttribute('href', '/home');
    app.unmount();
    mount('public');
    expect(screen.getByRole('link', { name: 'Firefly, home' })).toHaveAttribute('href', '/');
  });

  it('is only a quiet signature during a call, with nothing to press', () => {
    const { container } = mount('call');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('writes the i without a dot of its own, so the amber one can sit on it', () => {
    const { container } = mount('app');
    expect(container.querySelector('.wordmark__i')).toHaveTextContent('\u0131');
    expect(container.querySelector('.wordmark__i i')).toBeInTheDocument();
  });

  it('draws the mark the first time in a session, and not again', () => {
    const first = mount('app');
    expect(first.container.querySelector('.mark')).toHaveAttribute('data-ignite', 'true');
    first.unmount();
    const second = mount('app');
    expect(second.container.querySelector('.mark')).not.toHaveAttribute('data-ignite');
  });

  it('does not draw it at all when motion is reduced', () => {
    localStorage.setItem('firefly.motion', JSON.stringify('reduce'));
    const { container } = mount('app');
    expect(container.querySelector('.mark')).not.toHaveAttribute('data-ignite');
  });
});
