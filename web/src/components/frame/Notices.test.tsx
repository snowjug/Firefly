import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/api.ts';
import { EmptyNotice, ErrorNotice, LoadingNotice, NotFoundNotice } from './index.ts';

describe('EmptyNotice', () => {
  it('says one sentence and offers at most one action', () => {
    render(
      <EmptyNotice title="No calls yet" action={<a href="/scenarios">Start practice</a>}>
        Your history starts with your first call.
      </EmptyNotice>,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'No calls yet' })).toBeInTheDocument();
    expect(screen.getByText('Your history starts with your first call.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start practice' })).toBeInTheDocument();
  });

  it('is the page heading when it is the whole page, and needs no body or action', () => {
    const { container } = render(<EmptyNotice level={1} title="Nothing here" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Nothing here' })).toBeInTheDocument();
    expect(container.querySelector('.ff-notice__text, .ff-notice__action')).toBeNull();
  });
});

describe('ErrorNotice', () => {
  it('is an alert with what happened, in words that are safe to show', () => {
    render(
      <ErrorNotice error={new ApiError(404, 'not_found', 'That call no longer exists.', false)} />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent("We couldn't load this");
    expect(alert).toHaveTextContent('That call no longer exists.');
  });

  it('offers Try again only when trying again can help', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const { rerender } = render(
      <ErrorNotice
        error={new ApiError(0, 'network', "Can't reach Firefly right now.", true)}
        onRetry={onRetry}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(<ErrorNotice error={new Error('boom')} onRetry={onRetry} />);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');

    rerender(
      <ErrorNotice error={new ApiError(404, 'not_found', 'Gone.', false)} onRetry={onRetry} />,
    );
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();

    rerender(<ErrorNotice error={new Error('boom')} />);
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('takes its own title and heading level', () => {
    render(<ErrorNotice error={new Error('x')} title="We could not open this call" level={1} />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'We could not open this call' }),
    ).toBeInTheDocument();
  });
});

describe('LoadingNotice', () => {
  it('is a named status, with hairlines drawn where text will be', () => {
    const { container } = render(<LoadingNotice label="Loading scenarios" lines={4} />);
    const status = screen.getByRole('status', { name: 'Loading scenarios' });
    expect(status).toHaveTextContent('Loading scenarios…');
    expect(container.querySelectorAll('.ff-loading__line')).toHaveLength(4);
    expect(container.querySelector('.ff-loading__line')).toHaveAttribute('aria-hidden', 'true');
  });

  it('keeps the number of lines sensible', () => {
    const { container, rerender } = render(<LoadingNotice lines={0} />);
    expect(container.querySelectorAll('.ff-loading__line')).toHaveLength(1);
    rerender(<LoadingNotice lines={99} />);
    expect(container.querySelectorAll('.ff-loading__line')).toHaveLength(12);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });
});

describe('NotFoundNotice', () => {
  it('says the page does not exist and the way back', () => {
    render(
      <MemoryRouter>
        <NotFoundNotice />
      </MemoryRouter>,
    );
    expect(document.title).toBe('Page not found · Firefly');
    expect(
      screen.getByRole('heading', { level: 1, name: 'That page does not exist' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the start' })).toHaveAttribute('href', '/');
  });
});
