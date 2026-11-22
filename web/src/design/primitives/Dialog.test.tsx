import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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

// jsdom has no animations, so every test above closes a dialog with nothing to fade out, as a browser
// does when it cannot animate. These stand in for a browser that can (it has getAnimations, and the
// dialog has a box), to see what is left on screen while the exit plays.
describe('Dialog: its exit', () => {
  /** Says that the browser can animate, and where the dialog is. */
  function canAnimate() {
    Object.defineProperty(HTMLElement.prototype, 'getAnimations', {
      configurable: true,
      value: () => [],
    });
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(100, 80, 400, 300),
    );
  }
  const picture = () => document.querySelector<HTMLElement>('dialog[data-picture]');
  const scrim = () => document.querySelector('.ff-dialog-scrim');

  afterEach(() => {
    // The picture belongs to the page, not to the test's container: take away what a test left.
    document
      .querySelectorAll('dialog[data-picture], .ff-dialog-scrim')
      .forEach((node) => node.remove());
    Reflect.deleteProperty(HTMLElement.prototype, 'getAnimations');
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function Owner({
    open,
    onClose = () => undefined,
  }: {
    open: boolean;
    onClose?: DialogProps['onClose'];
  }) {
    return (
      <>
        <button type="button">Opener</button>
        <Dialog open={open} onClose={onClose} title="Practice settings">
          <button type="button" id="inside-the-dialog">
            Inside
          </button>
        </Dialog>
      </>
    );
  }

  it('goes at once when the owner closes it, focus is back on its opener, and a hidden picture of it fades out in its place', () => {
    canAnimate();
    const { rerender } = render(<Owner open={false} />);
    const opener = screen.getByRole('button', { name: 'Opener' });
    opener.focus();
    rerender(<Owner open />);
    expect(picture()).toBeNull();

    rerender(<Owner open={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    const shown = picture() as HTMLElement;
    expect(shown).not.toBeNull();
    expect(shown).toHaveAttribute('aria-hidden', 'true');
    expect(shown).toHaveAttribute('inert');
    expect(shown).toHaveTextContent('Practice settings');
    expect(shown.style.left).toBe('100px');
    expect(shown.style.top).toBe('80px');
    expect(shown.style.width).toBe('400px');
    expect(scrim()).toHaveAttribute('aria-hidden', 'true');
  });

  it('takes the picture away when its animation ends, and nothing else with it', () => {
    canAnimate();
    const { rerender } = render(<Owner open />);
    rerender(<Owner open={false} />);
    fireEvent.animationEnd(screen.getByText('Opener'));
    expect(picture(), 'an animation that ended elsewhere is not its end').not.toBeNull();
    fireEvent.animationEnd(picture() as HTMLElement);
    expect(picture()).toBeNull();
    expect(scrim()).toBeNull();
  });

  it('can never stay: the picture is taken away within a bound even if its animation never ends', () => {
    vi.useFakeTimers();
    canAnimate();
    const { rerender } = render(<Owner open />);
    rerender(<Owner open={false} />);
    expect(picture()).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(picture()).toBeNull();
    expect(scrim()).toBeNull();
  });

  it('draws no picture for someone who asked for less motion, or where the browser cannot animate', () => {
    canAnimate();
    vi.stubGlobal('matchMedia', (query: string) => ({
      media: query,
      matches: /reduce/.test(query),
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    const quiet = render(<Owner open />);
    quiet.rerender(<Owner open={false} />);
    expect(picture()).toBeNull();
    quiet.unmount();

    vi.unstubAllGlobals();
    Reflect.deleteProperty(HTMLElement.prototype, 'getAnimations');
    const plain = render(<Owner open />);
    plain.rerender(<Owner open={false} />);
    expect(picture()).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not hold the page back: a new dialog can open while the picture of the old one fades', () => {
    canAnimate();
    const { rerender } = render(<Owner open />);
    rerender(<Owner open={false} />);
    rerender(<Owner open />);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog')).toHaveAttribute('open');
    expect(screen.getByRole('dialog')).not.toHaveAttribute('inert');
    expect(picture()).not.toBeNull();
    const ids = [...document.querySelectorAll('[id]')].map((node) => node.id);
    expect(new Set(ids).size, 'the picture repeats no id of the dialog that is open again').toBe(
      ids.length,
    );
  });

  it('draws nothing when its owner takes it away without closing it', () => {
    canAnimate();
    const { unmount } = render(<Owner open />);
    unmount();
    expect(picture()).toBeNull();
    expect(document.querySelector('dialog')).toBeNull();
  });
});
