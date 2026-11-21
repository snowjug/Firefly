import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog.tsx';

type Props = Partial<Parameters<typeof Dialog>[0]> & { children?: ReactNode };

function Harness({ children, ...props }: Props) {
  const [open, setOpen] = useState(false);
  const [openerGone, setOpenerGone] = useState(false);
  return (
    <div id="root">
      <main id="main" tabIndex={-1}>
        {openerGone ? null : (
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
        )}
      </main>
      <Dialog title="Practice settings" {...props} open={open} onClose={() => setOpen(false)}>
        {children ?? (
          <>
            <button type="button">Save</button>
            <button type="button" onClick={() => setOpenerGone(true)}>
              Remove the opener
            </button>
          </>
        )}
      </Dialog>
    </div>
  );
}

const open = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Open' }));

// jsdom has no layout, so nothing has an offsetParent; the focus trap only counts what is laid out.
function giveLayout() {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get() {
      return (this as HTMLElement).parentNode;
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  delete (HTMLElement.prototype as { animate?: unknown }).animate;
  delete (HTMLElement.prototype as { offsetParent?: unknown }).offsetParent;
  document.querySelectorAll('.is-leaving').forEach((node) => node.remove());
});

describe('Dialog', () => {
  it('is a labelled, described modal in the page body, and nothing until opened', async () => {
    const user = userEvent.setup();
    render(<Harness eyebrow="Plate II" description="Changes apply to your next call." />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await open(user);
    const dialog = screen.getByRole('dialog', { name: 'Practice settings' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('Changes apply to your next call.');
    expect(dialog).toHaveTextContent('Plate II');
    expect(dialog.closest('#root')).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Practice settings' })).toBeVisible();
  });

  it('moves focus in, to the control marked data-autofocus when there is one', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness />);
    await open(user);
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    unmount();

    render(
      <Harness>
        <button type="button">Cancel</button>
        <button type="button" data-autofocus>
          Save
        </button>
      </Harness>,
    );
    await open(userEvent.setup());
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
  });

  it('keeps Tab and Shift+Tab inside', async () => {
    giveLayout();
    const user = userEvent.setup();
    render(
      <Harness>
        <button type="button">First</button>
        <button type="button">Last</button>
      </Harness>,
    );
    await open(user);
    const close = screen.getByRole('button', { name: 'Close' });
    const last = screen.getByRole('button', { name: 'Last' });
    await user.tab();
    await user.tab();
    expect(last).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(last).toHaveFocus();
  });

  it('closes on Escape and on the close button, and gives focus back to what opened it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await open(user);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();

    await open(user);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
  });

  it('lands on the page content when what opened it has gone', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await open(user);
    await user.click(screen.getByRole('button', { name: 'Remove the opener' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'Open' })).not.toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveFocus();
  });

  it('must be answered when it is not dismissible', async () => {
    const user = userEvent.setup();
    render(
      <Harness dismissible={false}>
        <button type="button" data-autofocus>
          Keep talking
        </button>
      </Harness>,
    );
    await open(user);
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.pointer({
      keys: '[MouseLeft]',
      target: screen.getByRole('dialog').parentElement as HTMLElement,
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes when the scrim is pressed, not when the panel is', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await open(user);
    await user.click(screen.getByRole('dialog'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.pointer({
      keys: '[MouseLeft]',
      target: screen.getByRole('dialog').parentElement as HTMLElement,
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('makes the app inert and stops the page scrolling while open, and undoes both', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    const root = container.querySelector('#root') as HTMLElement;
    await open(user);
    expect(root).toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('hidden');
    await user.keyboard('{Escape}');
    expect(root).not.toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('');
  });

  it('is a glass modal, a sheet from the bottom or a drawer from the edge', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness />);
    await open(user);
    expect(screen.getByRole('dialog')).toHaveClass('dialog', 'glass', 'glass--modal');
    expect(screen.getByRole('dialog').parentElement).toHaveClass('scrim');
    unmount();

    const sheet = render(<Harness variant="sheet" />);
    await open(userEvent.setup());
    expect(screen.getByRole('dialog')).toHaveClass('sheet', 'glass--modal');
    expect(screen.getByRole('dialog').parentElement).toHaveClass('scrim-bottom');
    sheet.unmount();

    render(<Harness variant="drawer" />);
    await open(userEvent.setup());
    expect(screen.getByRole('dialog')).toHaveClass('drawer', 'glass--inspector');
    expect(screen.getByRole('dialog').parentElement).toHaveClass('scrim-start');
  });

  it('fades a copy out where it was, so the dialog itself is gone at once', async () => {
    const finished = new Promise<void>(() => undefined);
    const animate = vi.fn(() => ({ finished }));
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true });
    const user = userEvent.setup();
    render(<Harness />);
    await open(user);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const copy = document.querySelector('.scrim.is-leaving');
    expect(copy).toHaveAttribute('aria-hidden', 'true');
    expect(copy).toHaveAttribute('inert');
    expect(animate).toHaveBeenCalled();
  });

  it('does not animate out under reduced motion', async () => {
    const animate = vi.fn(() => ({ finished: Promise.resolve() }));
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true });
    document.documentElement.setAttribute('data-motion', 'reduce');
    try {
      const user = userEvent.setup();
      render(<Harness />);
      await open(user);
      await user.keyboard('{Escape}');
      expect(document.querySelector('.is-leaving')).toBeNull();
      expect(animate).not.toHaveBeenCalled();
    } finally {
      document.documentElement.removeAttribute('data-motion');
    }
  });
});
