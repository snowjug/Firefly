import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { ThemeProvider } from '../theme.tsx';
import { AmbientProvider, useAmbient, useAmbientPaused } from './ambient.tsx';

function Probe() {
  const { paused, forced, preference, toggle } = useAmbient();
  return (
    <button type="button" onClick={toggle}>
      {`preference=${preference} paused=${paused} forced=${forced}`}
    </button>
  );
}

const root = () => document.documentElement;

afterEach(() => {
  localStorage.clear();
  root().removeAttribute('data-ambient');
  root().removeAttribute('data-motion');
});

describe('ambient motion preference', () => {
  it('is on by default and leaves the page unmarked', () => {
    render(
      <ThemeProvider>
        <AmbientProvider>
          <Probe />
        </AmbientProvider>
      </ThemeProvider>,
    );
    expect(screen.getByRole('button')).toHaveTextContent('preference=on paused=false forced=false');
    expect(root().hasAttribute('data-ambient')).toBe(false);
  });

  it('pauses on request, marks the page, and remembers the choice', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <AmbientProvider>
          <Probe />
        </AmbientProvider>
      </ThemeProvider>,
    );
    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent('preference=paused paused=true');
    expect(root().getAttribute('data-ambient')).toBe('paused');
    expect(JSON.parse(localStorage.getItem('firefly.ambient') ?? 'null')).toBe('paused');

    await user.click(screen.getByRole('button'));
    expect(root().hasAttribute('data-ambient')).toBe(false);
    expect(JSON.parse(localStorage.getItem('firefly.ambient') ?? 'null')).toBe('on');
  });

  it('starts paused when it was paused last time', () => {
    localStorage.setItem('firefly.ambient', JSON.stringify('paused'));
    render(
      <ThemeProvider>
        <AmbientProvider>
          <Probe />
        </AmbientProvider>
      </ThemeProvider>,
    );
    expect(root().getAttribute('data-ambient')).toBe('paused');
  });

  it('is forced off by reduced motion without changing what was chosen', () => {
    localStorage.setItem('firefly.motion', JSON.stringify('reduce'));
    render(
      <ThemeProvider>
        <AmbientProvider>
          <Probe />
        </AmbientProvider>
      </ThemeProvider>,
    );
    expect(screen.getByRole('button')).toHaveTextContent('preference=on paused=true forced=true');
    expect(root().getAttribute('data-ambient')).toBe('paused');
    expect(JSON.parse(localStorage.getItem('firefly.ambient') ?? 'null')).toBeNull();
  });

  it('ignores a stored value it does not know', () => {
    localStorage.setItem('firefly.ambient', JSON.stringify('loud'));
    render(
      <ThemeProvider>
        <AmbientProvider>
          <Probe />
        </AmbientProvider>
      </ThemeProvider>,
    );
    expect(screen.getByRole('button')).toHaveTextContent('preference=on');
  });

  it('reads as not paused outside the provider, and as paused when reduced motion is on', () => {
    function Bare() {
      return <p>{String(useAmbientPaused())}</p>;
    }
    const { unmount } = render(<Bare />);
    expect(screen.getByText('false')).toBeInTheDocument();
    unmount();

    localStorage.setItem('firefly.motion', JSON.stringify('reduce'));
    act(() => {});
    render(
      <ThemeProvider>
        <Bare />
      </ThemeProvider>,
    );
    expect(screen.getByText('true')).toBeInTheDocument();
  });
});
