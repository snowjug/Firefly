import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useRescueFocus } from './use-rescue-focus.ts';

afterEach(cleanup);

const find = () => document.getElementById('landing');

/** A button that removes itself when pressed, and one that removes the other one. */
function Harness() {
  const [removed, setRemoved] = useState(false);
  useRescueFocus(removed, find);
  return (
    <div>
      <button id="landing" type="button">
        Landing
      </button>
      {removed ? null : (
        <button type="button" onClick={() => setRemoved(true)}>
          Remove this
        </button>
      )}
      <button type="button" onClick={() => setRemoved(true)}>
        Remove the other
      </button>
    </div>
  );
}

describe('useRescueFocus', () => {
  it('leaves the first render alone', () => {
    render(<Harness />);
    expect(document.body).toHaveFocus();
  });

  it('moves the keyboard to the landing place when the control that was pressed is removed', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove this' }));
    expect(screen.queryByRole('button', { name: 'Remove this' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Landing' })).toHaveFocus();
  });

  it('never takes focus from a control that still has it', async () => {
    render(<Harness />);
    const other = screen.getByRole('button', { name: 'Remove the other' });
    await userEvent.click(other);
    expect(screen.queryByRole('button', { name: 'Remove this' })).not.toBeInTheDocument();
    expect(other).toHaveFocus();
  });
});
