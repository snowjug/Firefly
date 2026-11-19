import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONNECT_AFTER_MS, HOLD_OPEN_MS, LaunchSequence } from './LaunchSequence.tsx';

const persona = { name: 'Maya Okafor', role: 'IT administrator', organisation: 'Northwind Foods' };

function renderSequence(ready: boolean, onDone = vi.fn()) {
  const view = render(
    <div id="root">
      <LaunchSequence
        title="Team cannot open the workspace"
        persona={persona}
        mood="frustrated"
        ready={ready}
        onDone={onDone}
      />
    </div>,
  );
  const again = (nextReady: boolean) =>
    view.rerender(
      <div id="root">
        <LaunchSequence
          title="Team cannot open the workspace"
          persona={persona}
          mood="frustrated"
          ready={nextReady}
          onDone={onDone}
        />
      </div>,
    );
  return { onDone, again, ...view };
}

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe('LaunchSequence', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('locks the scenario, connects the customer, then opens the line, and only then shows the call', () => {
    const { onDone } = renderSequence(true);
    const dialog = screen.getByRole('dialog', { name: 'Starting your call' });
    expect(dialog).toHaveTextContent('Scenario locked');
    expect(dialog).toHaveTextContent('Team cannot open the workspace');
    expect(dialog).not.toHaveTextContent('Customer connected');

    advance(CONNECT_AFTER_MS);
    expect(dialog).toHaveTextContent('Customer connected');
    expect(dialog).toHaveTextContent('Maya Okafor');
    expect(dialog).toHaveTextContent('A fictional customer');
    expect(dialog).toHaveTextContent('Line open');
    expect(onDone).not.toHaveBeenCalled();

    advance(HOLD_OPEN_MS);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('is tied to the real call: it never says the line is open until the call exists', () => {
    const { onDone, again } = renderSequence(false);
    advance(CONNECT_AFTER_MS + 5000);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Customer connected');
    expect(dialog).not.toHaveTextContent('Line open');
    expect(onDone).not.toHaveBeenCalled();

    again(true);
    expect(dialog).toHaveTextContent('Line open');
    advance(HOLD_OPEN_MS);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('can be skipped with Escape, a click or the button, once the call exists', () => {
    for (const skip of [
      () => fireEvent.keyDown(document, { key: 'Escape' }),
      () => fireEvent.click(screen.getByRole('dialog')),
      () => fireEvent.click(screen.getByRole('button', { name: 'Skip' })),
    ]) {
      const { onDone, unmount } = renderSequence(true);
      skip();
      advance(0);
      expect(onDone).toHaveBeenCalledTimes(1);
      advance(HOLD_OPEN_MS * 2);
      expect(onDone).toHaveBeenCalledTimes(1);
      unmount();
    }
  });

  it('waits for the call when skipped early, then goes straight in', () => {
    const { onDone, again } = renderSequence(false);
    fireEvent.keyDown(document, { key: 'Escape' });
    advance(1000);
    expect(onDone).not.toHaveBeenCalled();
    again(true);
    advance(0);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('owns the screen while it runs and gives it back afterwards', () => {
    const { unmount } = renderSequence(false);
    expect(document.getElementById('root')).toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('hidden');
    expect(screen.getByRole('button', { name: 'Skip' })).toHaveFocus();
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('announces each real step politely', () => {
    renderSequence(true);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Scenario locked.');
    advance(CONNECT_AFTER_MS);
    expect(status).toHaveTextContent('Line open.');
  });
});
