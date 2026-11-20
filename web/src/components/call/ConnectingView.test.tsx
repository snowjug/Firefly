import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConnectingView } from './ConnectingView.tsx';

describe('ConnectingView', () => {
  it('names the customer large once it is known, and says the line is opening', () => {
    const jobTitle = 'Receptionist, Northwind Clinic';
    render(<ConnectingView name="Maya Okafor" role={jobTitle} phase="opening" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Maya Okafor' })).toBeVisible();
    expect(screen.getByText(jobTitle)).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Opening the call.');
  });

  it('is its own heading while nobody is named, so the page still has one and the state is said once', () => {
    render(<ConnectingView name="  " phase="opening" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Opening the call.');
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveClass('sr-only');
  });

  it('says when it is taking longer than usual, in the same place', () => {
    const { rerender } = render(<ConnectingView name="Maya Okafor" phase="opening" />);
    rerender(<ConnectingView name="Maya Okafor" phase="slow" />);
    expect(screen.getByRole('status')).toHaveTextContent('Taking longer than usual.');
  });

  it('tells what went wrong and offers to try again, instead of waiting', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(
      <ConnectingView
        name="Maya Okafor"
        phase="failed"
        error="The server is not answering."
        onRetry={onRetry}
        onSkip={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('The server is not answering.');
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('can be skipped while it waits, and shows no progress of any kind', async () => {
    const onSkip = vi.fn();
    const user = userEvent.setup();
    render(<ConnectingView name="Maya Okafor" phase="opening" onSkip={onSkip} />);
    await user.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});
