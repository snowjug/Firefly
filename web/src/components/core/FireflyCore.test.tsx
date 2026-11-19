import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../../lib/theme.tsx';
import { FireflyCore } from './FireflyCore.tsx';

beforeAll(async () => {
  await import('./CoreCanvas.tsx');
});

afterEach(() => vi.restoreAllMocks());

describe('FireflyCore', () => {
  it('shows the glow at once with the same attributes, then hands over to the canvas', async () => {
    const context = { setTransform: vi.fn(), clearRect: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    );
    localStorage.setItem('firefly.motion', JSON.stringify('reduce'));
    const { container } = render(
      <ThemeProvider>
        <FireflyCore mood="frustrated" label="Customer presence" className="hero-core" />
      </ThemeProvider>,
    );

    // Before the drawing code has loaded: the same box, class, mood and description.
    const first = container.querySelector('.core');
    expect(first).toHaveClass('hero-core');
    expect(first).toHaveAttribute('data-mood', 'frustrated');
    expect(first).toHaveAttribute('role', 'img');
    expect(first).toHaveAttribute('aria-label', 'Customer presence');

    // Then the canvas takes over in the same place.
    await waitFor(() =>
      expect(container.querySelector('.core')).toHaveAttribute('data-canvas', 'on'),
    );
    expect(container.querySelectorAll('.core')).toHaveLength(1);
    expect(container.querySelector('.core')).toHaveAttribute('data-mood', 'frustrated');
  });

  it('is decorative unless it is given a label', () => {
    const { container } = render(
      <ThemeProvider>
        <FireflyCore />
      </ThemeProvider>,
    );
    expect(container.querySelector('.core')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.core')).not.toHaveAttribute('role');
  });
});
