import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from './toast.tsx';

function Trigger({
  tone,
  title = 'Saved',
  message,
  durationMs,
}: {
  tone?: 'info' | 'positive' | 'caution' | 'negative';
  title?: string;
  message?: string;
  durationMs?: number;
}) {
  const { toast } = useToast();
  return (
    <button type="button" onClick={() => toast({ tone, title, message, durationMs })}>
      Say {title}
    </button>
  );
}

describe('toast', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it('is a polite status in the page body, empty until something is said', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { container } = render(
      <ToastProvider>
        <Trigger message="Your name now appears on this device only." />
      </ToastProvider>,
    );
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toBeEmptyDOMElement();
    expect(container.contains(region)).toBe(false);
    expect(region.parentElement).toBe(document.body);

    await user.click(screen.getByRole('button', { name: 'Say Saved' }));
    expect(within(region).getByText('Saved')).toBeInTheDocument();
    expect(
      within(region).getByText('Your name now appears on this device only.'),
    ).toBeInTheDocument();
  });

  it('goes away by itself after five seconds, or after the time it was given', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ToastProvider>
        <Trigger title="Default" />
        <Trigger title="Quick" durationMs={1000} />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Say Default' }));
    await user.click(screen.getByRole('button', { name: 'Say Quick' }));
    expect(screen.getByText('Default', { selector: 'strong' })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(screen.queryByText('Quick', { selector: 'strong' })).not.toBeInTheDocument();
    expect(screen.getByText('Default', { selector: 'strong' })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByText('Default', { selector: 'strong' })).not.toBeInTheDocument();
  });

  it('shows at most three at a time, the newest last', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ToastProvider>
        {['One', 'Two', 'Three', 'Four'].map((title) => (
          <Trigger key={title} title={title} />
        ))}
      </ToastProvider>,
    );
    for (const title of ['One', 'Two', 'Three', 'Four']) {
      await user.click(screen.getByRole('button', { name: `Say ${title}` }));
    }
    const shown = [...document.querySelectorAll('.toast strong')].map((node) => node.textContent);
    expect(shown).toEqual(['Two', 'Three', 'Four']);
  });

  it('carries its tone as a word-free mark and a data attribute, never as colour alone', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ToastProvider>
        <Trigger tone="negative" title="Failed" />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Say Failed' }));
    const toast = document.querySelector('.toast') as HTMLElement;
    expect(toast).toHaveAttribute('data-tone', 'negative');
    expect(toast.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(toast).toHaveTextContent('Failed');
  });

  it('cannot be used outside its provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Trigger />)).toThrow('useToast must be used inside ToastProvider');
  });
});
