import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderBadge } from './ProviderBadge.tsx';

const state = vi.hoisted(() => ({
  value: { config: null, loading: true, error: null } as {
    config: { provider: { demo: boolean; label: string } } | null;
    loading: boolean;
    error: unknown;
  },
}));

vi.mock('../lib/config.tsx', () => ({ useAppConfig: () => state.value }));

describe('ProviderBadge', () => {
  beforeEach(() => {
    state.value = { config: null, loading: true, error: null };
  });

  it('says nothing while the answer is on its way', () => {
    const { container } = render(<ProviderBadge />);
    expect(container).toBeEmptyDOMElement();
  });

  it('says plainly that the server is offline, as a status', () => {
    state.value = { config: null, loading: false, error: new Error('down') };
    render(<ProviderBadge />);
    expect(screen.getByRole('status')).toHaveTextContent('Server offline');
  });

  it('never disguises demo mode: short in the masthead, fuller where there is room', () => {
    state.value = {
      config: { provider: { demo: true, label: 'Built-in' } },
      loading: false,
      error: null,
    };
    const { rerender } = render(<ProviderBadge compact />);
    expect(screen.getByText('Demo mode')).toHaveAttribute('data-mode', 'demo');
    expect(screen.getByText('Demo mode')).toHaveAttribute(
      'title',
      expect.stringContaining('not an AI model'),
    );
    rerender(<ProviderBadge />);
    expect(screen.getByText(/built-in simulated customer/)).toBeInTheDocument();
  });

  it('names a live model by its label', () => {
    state.value = {
      config: { provider: { demo: false, label: 'Gemini (model "x")' } },
      loading: false,
      error: null,
    };
    render(<ProviderBadge />);
    expect(screen.getByText('Gemini (model "x")')).toHaveAttribute('data-mode', 'live');
    render(<ProviderBadge compact />);
    expect(screen.getByText('Live model')).toBeInTheDocument();
  });
});
