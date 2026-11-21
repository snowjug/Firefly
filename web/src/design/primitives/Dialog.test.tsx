import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act, useState, type ReactNode } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { installDialogShim } from '../dialog-shim.ts';
import { Button, Dialog, useAnnouncer, type DialogProps } from '../index.ts';

beforeAll(installDialogShim);
// Vitest globals are off, so Testing Library does not clean up between tests on its own.
afterEach(cleanup);

function Harness({
  initiallyOpen = false,
  onClosed,
  body = <p>Calls that are already saved are not affected.</p>,
  ...props
}: Partial<Omit<DialogProps, 'children'>> & {
  initiallyOpen?: boolean;
  onClosed?: (reason: string) => void;
  body?: ReactNode;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <>
      <main id="main" tabIndex={-1}>
        <Button onClick={() => setOpen(true)}>Open settings</Button>
      </main>
      <Dialog
        title="Practice settings"
        description="Changes apply to your next call."
        {...props}
        open={open}
        onClose={(reason) => {
          onClosed?.(reason);
          setOpen(false);
        }}
        actions={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button appearance="primary" onClick={() => setOpen(false)}>
              Save
            </Button>
          </>
        }
      >
        {body}
      </Dialog>
    </>
  );
}

const open = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Open settings' }));

describe('Dialog', () => {
  it('is a named and described modal, and nothing until it is opened', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await open(user);
    const dialog = screen.getByRole('dialog', { name: 'Practice settings' });
    expect(dialog).toHaveAccessibleDescription('Changes apply to your next call.');
    expect(
      within(dialog).getByRole('heading', { level: 2, name: 'Practice settings' }),
    ).toBeVisible();
  });

  it('puts focus inside on opening, on the first control unless one is marked data-autofocus', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness />);
    await open(user);
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    unmount();

    render(<Harness body={<Button data-autofocus>Keep this one</Button>} />);
    await open(userEvent.setup());
    expect(screen.getByRole('button', { name: 'Keep this one' })).toHaveFocus();
  });

  it('closes on Escape and gives focus back to what opened it', async () => {
    const user = userEvent.setup();
    const onClosed = vi.fn();
    render(<Harness onClosed={onClosed} />);
    await open(user);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onClosed).toHaveBeenCalledWith('escape');
    expect(screen.getByRole('button', { name: 'Open settings' })).toHaveFocus();
  });

  it('closes from the Close button too, and returns focus there as well', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await open(user);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open settings' })).toHaveFocus();
  });

  it('closes on a click on the backdrop, not on a click inside', async () => {
    const user = userEvent.setup();
    const onClosed = vi.fn();
    render(<Harness onClosed={onClosed} />);
    await open(user);
    await user.click(screen.getByText('Calls that are already saved are not affected.'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('dialog'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onClosed).toHaveBeenCalledWith('backdrop');
  });

  it('has to be answered when it is not dismissible: no Close button, and Escape does nothing', async () => {
    const user = userEvent.setup();
    render(<Harness dismissible={false} />);
    await open(user);
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('dialog'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens again if the browser closes it while the owner still wants it open', async () => {
    const user = userEvent.setup();
    render(<Harness dismissible={false} />);
    await open(user);
    const dialog = screen.getByRole('dialog') as HTMLDialogElement;
    act(() => dialog.close());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect((screen.getByRole('dialog') as HTMLDialogElement).open).toBe(true);
  });

  it('works when it is already open on the first render', () => {
    render(<Harness initiallyOpen />);
    const dialog = screen.getByRole('dialog', { name: 'Practice settings' });
    expect(dialog).toBeVisible();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it('keeps its own polite region, because everything outside a modal dialog is silent', async () => {
    function Speaker() {
      const announce = useAnnouncer();
      return <Button onClick={() => announce('Ending the call.')}>Say it</Button>;
    }
    const user = userEvent.setup();
    render(
      <Dialog open onClose={() => undefined} title="End the call?">
        <Speaker />
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Say it' }));
    expect(within(dialog).getByRole('status')).toHaveTextContent('Ending the call.');
  });
});
