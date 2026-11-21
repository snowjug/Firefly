import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Toggle } from './index.ts';

function Demo({
  onChange,
  ...rest
}: {
  onChange?: (next: boolean) => void;
  hint?: string;
  disabled?: boolean;
}) {
  const [on, setOn] = useState(false);
  return (
    <Toggle
      label="Show hints"
      checked={on}
      onChange={(next) => {
        setOn(next);
        onChange?.(next);
      }}
      {...rest}
    />
  );
}

describe('Toggle', () => {
  it('is a switch named by its label and says its state', async () => {
    const user = userEvent.setup();
    render(<Demo />);
    const toggle = screen.getByRole('switch', { name: 'Show hints' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(toggle).toHaveTextContent('Off');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(toggle).toHaveTextContent('On');
  });

  it('keeps the visible On and Off out of its name, so screen readers hear the state once', () => {
    render(<Toggle label="Sound" checked onChange={() => undefined} />);
    expect(screen.getByRole('switch', { name: 'Sound' })).toBeInTheDocument();
  });

  it('toggles from the label', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Demo onChange={onChange} />);
    await user.click(screen.getByText('Show hints'));
    expect(onChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('toggles from the keyboard with Space and Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Demo onChange={onChange} />);
    await user.tab();
    expect(screen.getByRole('switch')).toHaveFocus();
    await user.keyboard(' ');
    expect(onChange).toHaveBeenLastCalledWith(true);
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('is described by its hint', () => {
    render(<Demo hint="Hints only fill the reply box." />);
    expect(screen.getByRole('switch', { name: 'Show hints' })).toHaveAccessibleDescription(
      'Hints only fill the reply box.',
    );
  });

  it('does nothing when disabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Demo onChange={onChange} disabled />);
    const toggle = screen.getByRole('switch');
    expect(toggle).toBeDisabled();
    await user.click(toggle);
    await user.click(screen.getByText('Show hints'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('uses the id it is given, so other text can point at it', () => {
    render(
      <>
        <Toggle id="reduce" label="Reduce motion" checked={false} onChange={() => undefined} />
        <label htmlFor="reduce">Same switch, another label</label>
      </>,
    );
    expect(document.getElementById('reduce')).toHaveAttribute('role', 'switch');
  });
});
