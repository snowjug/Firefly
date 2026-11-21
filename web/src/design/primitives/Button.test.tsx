import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnnouncerProvider, Button, IconButton, LinkButton, ToggleButton } from '../index.ts';

// Vitest globals are off, so Testing Library does not clean up between tests on its own.
afterEach(cleanup);

describe('Button', () => {
  it('is a button that does not submit a form unless it says so', () => {
    render(<Button>Start call</Button>);
    expect(screen.getByRole('button', { name: 'Start call' })).toHaveAttribute('type', 'button');
  });

  it('calls onClick, and not when natively disabled (which also leaves the tab order)', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <>
        <Button onClick={onClick}>Enabled</Button>
        <Button onClick={onClick} disabled>
          Disabled
        </Button>
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Enabled' }));
    await user.click(screen.getByRole('button', { name: 'Disabled' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Enabled' })).toHaveFocus();
    await user.tab();
    expect(document.body).toHaveFocus();
  });

  it('can look disabled and ignore presses while keeping focus (aria-disabled)', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabledFocusable>
        Send
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Send' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps its label and focus while loading, ignores presses, and says it is busy', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(
      <Button onClick={onClick} icon="phone">
        Start call
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Start call' });
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <Button onClick={onClick} icon="phone" loading>
        Start call
      </Button>,
    );
    const loading = screen.getByRole('button', { name: 'Start call' });
    expect(loading).toHaveAttribute('aria-busy', 'true');
    expect(loading).toHaveAttribute('aria-disabled', 'true');
    expect(loading).not.toBeDisabled();
    loading.focus();
    await user.keyboard('{Enter}');
    await user.click(loading);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(loading).toHaveFocus();
  });

  it('announces what it is doing when loading starts', () => {
    const { rerender } = render(
      <AnnouncerProvider>
        <Button>Save</Button>
      </AnnouncerProvider>,
    );
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    rerender(
      <AnnouncerProvider>
        <Button loading loadingLabel="Saving your changes">
          Save
        </Button>
      </AnnouncerProvider>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Saving your changes');
  });
});

describe('IconButton', () => {
  it('is named by its label', () => {
    render(<IconButton icon="x" label="Close" />);
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('cannot be written without a label', () => {
    // The type is the test: tsc fails the build if this line stops being an error.
    const unnamed = () => (
      // @ts-expect-error an icon-only button must say what it does
      <IconButton icon="x" />
    );
    expect(unnamed).toBeTypeOf('function');
  });
});

describe('ToggleButton', () => {
  it('reports pressed or not and asks to flip', async () => {
    const user = userEvent.setup();
    const onPressedChange = vi.fn();
    const { rerender } = render(
      <ToggleButton pressed={false} onPressedChange={onPressedChange}>
        Captions
      </ToggleButton>,
    );
    expect(screen.getByRole('button', { name: 'Captions', pressed: false })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Captions' }));
    expect(onPressedChange).toHaveBeenCalledWith(true);
    rerender(
      <ToggleButton pressed onPressedChange={onPressedChange}>
        Captions
      </ToggleButton>,
    );
    expect(screen.getByRole('button', { name: 'Captions', pressed: true })).toBeInTheDocument();
  });

  it('can be icon-only, and then it needs a label', () => {
    render(
      <ToggleButton
        pressed
        icon="microphone-off"
        label="Mute microphone"
        onPressedChange={() => undefined}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Mute microphone', pressed: true }),
    ).toBeInTheDocument();
  });
});

describe('LinkButton', () => {
  it('is a real link to a place in Firefly', () => {
    render(
      <MemoryRouter>
        <LinkButton to="/scenarios" appearance="primary">
          Start call
        </LinkButton>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Start call' })).toHaveAttribute('href', '/scenarios');
  });

  it('opens an address elsewhere in a new tab, safely, and says so', () => {
    render(
      <MemoryRouter>
        <LinkButton href="https://github.com/snowjug/Firefly" external>
          Source on GitHub
        </LinkButton>
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: /Source on GitHub/ });
    expect(link).toHaveAccessibleName('Source on GitHub, opens in a new tab');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
