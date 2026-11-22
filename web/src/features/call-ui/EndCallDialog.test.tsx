import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { describeProblem } from '../call/problems.ts';
import type { CallSnapshot } from '../call/contract.ts';
import { clock, traineeTurnCount } from './call-model.ts';
import { closingCheckLoader, FIXTURES } from './call-fixtures.ts';
import { clearViewport, renderCall, WIDTH } from './test-utils.tsx';

afterEach(() => {
  cleanup();
  clearViewport();
});

const question = () => screen.getByRole('dialog', { name: 'End the call?' });
const inQuestion = () => within(question());

/** A promise the test settles by hand, to hold a step half way. */
function deferred<T>() {
  let settle!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });
  return { promise, settle };
}

describe('the question', () => {
  it('states the call’s real length, message count and customer state, and nothing it has to guess', () => {
    const { snapshot } = FIXTURES['end-confirm'];
    renderCall('end-confirm');
    const fact = (label: string) => inQuestion().getByText(label).nextElementSibling;
    expect(fact('Call length')).toHaveTextContent(clock(snapshot.elapsedSeconds));
    expect(fact('Messages')).toHaveTextContent(String(traineeTurnCount(snapshot.turns)));
    expect(fact('Customer state')).toHaveTextContent('Concerned');
  });

  it('starts the keyboard on Continue call, so a stray Enter ends nothing', async () => {
    const user = userEvent.setup();
    const { actions } = renderCall('end-confirm');
    expect(inQuestion().getByRole('button', { name: 'Continue call' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(actions.endCall).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'End the call?' })).toBeNull();
  });

  it('closes on Escape and gives the keyboard back to End call', async () => {
    const user = userEvent.setup();
    renderCall('mic-ready');
    const end = within(document.querySelector('header') as HTMLElement).getByRole('button', {
      name: 'End call',
    });
    await user.click(end);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'End the call?' })).toBeNull();
    expect(end).toHaveFocus();
  });

  it('says a short call rests on limited evidence, and says nothing of the kind for a longer one', () => {
    renderCall('end-confirm-short');
    expect(inQuestion().getByText(/rests on limited evidence/)).toBeInTheDocument();
    cleanup();
    renderCall('end-confirm');
    expect(inQuestion().queryByText(/limited evidence/)).toBeNull();
  });

  it('warns when the last message never reached the server, so the review will not have it', () => {
    renderCall('end-unsaved');
    expect(inQuestion().getByText(/Your last message was not sent/)).toBeInTheDocument();
    cleanup();
    renderCall('end-confirm');
    expect(inQuestion().queryByText(/was not sent/)).toBeNull();
  });
});

describe('ending the call', () => {
  it('asks the engine once, shows it working, refuses a second press and a dismissal, then opens the report', async () => {
    const user = userEvent.setup();
    const onEnded = vi.fn();
    const { actions } = renderCall('end-confirm', { onEnded });
    const wait = deferred<{ sessionId: string } | null>();
    actions.endCall.mockReturnValueOnce(wait.promise);

    const confirm = inQuestion().getByRole('button', { name: 'End and review' });
    await user.click(confirm);
    expect(actions.endCall).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveAttribute('aria-busy', 'true');
    // Said inside the dialog, which has its own announcer because everything behind it is inert.
    expect(question().querySelector('[role="status"]')).toHaveTextContent('Ending the call.');

    await user.click(confirm);
    expect(actions.endCall).toHaveBeenCalledTimes(1);
    expect(inQuestion().getByRole('button', { name: 'Continue call' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'End the call?' })).toBeInTheDocument();
    expect(onEnded).not.toHaveBeenCalled();

    await act(async () => wait.settle({ sessionId: 'ses_fixture_priya' }));
    expect(onEnded).toHaveBeenCalledExactlyOnceWith('ses_fixture_priya');
  });

  it('does not open the report when the call was not ended', async () => {
    const onEnded = vi.fn();
    const { actions } = renderCall('end-confirm', { onEnded });
    actions.endCall.mockResolvedValueOnce(null);
    await act(async () => {
      fireEvent.click(inQuestion().getByRole('button', { name: 'End and review' }));
    });
    expect(onEnded).not.toHaveBeenCalled();
    expect(inQuestion().getByRole('button', { name: 'End and review' })).not.toHaveAttribute(
      'aria-busy',
    );
  });

  it('becomes "Ending and preparing your review" with progress that has no percentage', () => {
    renderCall('ending');
    const dialog = screen.getByRole('dialog', { name: 'Ending and preparing your review' });
    const progress = within(dialog).getByRole('progressbar', { name: 'Ending call' });
    expect(progress).not.toHaveAttribute('aria-valuenow');
    expect(dialog.textContent).not.toMatch(/\d\s?%/);
    expect(within(dialog).queryAllByRole('button')).toHaveLength(0);
    expect(dialog.querySelector('.cw-end__heading')).toHaveFocus();
    cleanup();

    renderCall('evaluating');
    expect(
      within(screen.getByRole('dialog', { name: 'Ending and preparing your review' })).getByRole(
        'progressbar',
        { name: 'Preparing your review' },
      ),
    ).toBeInTheDocument();
  });

  it('cannot be dismissed while it ends: no close button, Escape and the backdrop do nothing', async () => {
    const user = userEvent.setup();
    renderCall('ending');
    const dialog = screen.getByRole('dialog', { name: 'Ending and preparing your review' });
    expect(within(dialog).queryByRole('button', { name: 'Close' })).toBeNull();
    await user.keyboard('{Escape}');
    await user.click(dialog);
    expect(
      screen.getByRole('dialog', { name: 'Ending and preparing your review' }),
    ).toBeInTheDocument();
  });

  it('moves from the question to the progress, with the heading taking the keyboard', () => {
    const { update } = renderCall('end-confirm');
    expect(inQuestion().getByRole('button', { name: 'Continue call' })).toHaveFocus();
    update(FIXTURES.ending.snapshot);
    const dialog = screen.getByRole('dialog', { name: 'Ending and preparing your review' });
    expect(dialog.querySelector('.cw-end__heading')).toHaveFocus();
    update(FIXTURES.evaluating.snapshot);
    expect(
      within(dialog).getByRole('progressbar', { name: 'Preparing your review' }),
    ).toBeInTheDocument();
  });

  it('is not left on a heading that is gone when ending does not work: the question comes back, focused', () => {
    const { update } = renderCall('end-confirm');
    update(FIXTURES.ending.snapshot);
    update(FIXTURES['end-failed'].snapshot);
    expect(inQuestion().getByRole('button', { name: 'Continue call' })).toHaveFocus();
    expect(inQuestion().getByText('We could not end the call.')).toBeInTheDocument();
  });
});

describe('when ending fails', () => {
  it('says so inside the dialog, once, with what was kept, and a Retry that ends again', () => {
    const { actions } = renderCall('end-failed');
    const title = inQuestion().getByText('We could not end the call.');
    // Said as the dialog's own status, because nothing behind a modal dialog is read.
    expect(title.closest('[role="status"]')).not.toBeNull();
    expect(inQuestion().getByText(/Your call is still open and saved/)).toBeInTheDocument();
    // Not a second time on the page behind.
    expect(screen.getAllByText('We could not end the call.')).toHaveLength(1);
    fireEvent.click(inQuestion().getByRole('button', { name: 'Retry' }));
    expect(actions.endCall).toHaveBeenCalledTimes(1);
  });

  it('lets the trainee carry on, and forgets the failed attempt', () => {
    const { actions } = renderCall('end-failed');
    fireEvent.click(inQuestion().getByRole('button', { name: 'Continue call' }));
    expect(actions.dismissProblem).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: 'End the call?' })).toBeNull();
  });

  it('does not dismiss a problem that is not about ending when the trainee carries on', () => {
    const { actions } = renderCall('end-unsaved');
    fireEvent.click(inQuestion().getByRole('button', { name: 'Continue call' }));
    expect(actions.dismissProblem).not.toHaveBeenCalled();
  });

  it('treats being offline while ending the same way: told in the dialog, Retry, call still open', () => {
    const snapshot = {
      ...FIXTURES['end-failed'].snapshot,
      problem: describeProblem('offline', { during: 'end' }),
    };
    renderCall(snapshot, { initialUi: { endOpen: true }, online: false });
    expect(inQuestion().getByText('You appear to be offline.')).toBeInTheDocument();
    expect(inQuestion().getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.getAllByText('You appear to be offline.')).toHaveLength(1);
  });

  it('offers nothing but a way on when there is nothing to review: carry on, or leave without a report', async () => {
    const onDiscard = vi.fn();
    renderCall('end-nothing-to-review', { onDiscard });
    expect(inQuestion().getByText('There is nothing to review yet.')).toBeInTheDocument();
    expect(inQuestion().queryByRole('button', { name: 'End and review' })).toBeNull();
    expect(inQuestion().queryByRole('button', { name: 'Retry' })).toBeNull();
    const labels = inQuestion()
      .getAllByRole('button')
      .map((item) => item.textContent)
      .filter(Boolean);
    expect(labels).toEqual(['Continue call', 'Leave without a report']);
    await userEvent
      .setup()
      .click(inQuestion().getByRole('button', { name: 'Leave without a report' }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it('shows leaving while it happens, and refuses a second press', async () => {
    const wait = deferred<void>();
    const onDiscard = vi.fn(() => wait.promise);
    renderCall('end-nothing-to-review', { onDiscard });
    const leave = inQuestion().getByRole('button', { name: 'Leave without a report' });
    fireEvent.click(leave);
    expect(leave).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(leave);
    expect(onDiscard).toHaveBeenCalledTimes(1);
    await act(async () => wait.settle());
    expect(leave).not.toHaveAttribute('aria-busy');
  });

  it('has no way to leave without a report where the page does not offer one', () => {
    renderCall('end-nothing-to-review');
    expect(inQuestion().queryByRole('button', { name: 'Leave without a report' })).toBeNull();
    expect(inQuestion().getByRole('button', { name: 'Continue call' })).toBeInTheDocument();
  });
});

describe('the question at every width', () => {
  it.each([WIDTH.narrow, WIDTH.medium, WIDTH.wide])('is the same dialog at %i px', (width) => {
    renderCall('end-confirm', { width });
    expect(
      inQuestion()
        .getAllByRole('button')
        .map((item) => item.textContent),
    ).toEqual(expect.arrayContaining(['Continue call', 'End and review']));
  });
});

describe('in Guided practice: Ready to close?', () => {
  const ready = () => screen.getByRole('dialog', { name: 'Ready to close?' });
  const inReady = () => within(ready());
  const settled = () => act(async () => undefined);

  it('asks "Ready to close?" and lists the four checks, by words, above the facts', async () => {
    renderCall('end-ready-to-close');
    const list = await inReady().findByRole('list', { name: 'Closing check' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((row) => row.textContent),
    ).toEqual([
      'Plan statedDone',
      'Owner statedDone',
      'Update time statedNot yet',
      'Customer agreement confirmedNot yet',
    ]);
    const facts = ready().querySelector('.cw-end__facts') as HTMLElement;
    expect(list.compareDocumentPosition(facts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The usual actions, and what the call has covered, are all still there.
    expect(inReady().getByText('Call length')).toBeInTheDocument();
    expect(inReady().getByRole('button', { name: 'Continue call' })).toBeInTheDocument();
    expect(inReady().getByRole('button', { name: 'End and review' })).toBeInTheDocument();
  });

  it('shows four Done when all four are', async () => {
    renderCall('end-ready-to-close-complete');
    const list = await inReady().findByRole('list', { name: 'Closing check' });
    expect(within(list).getAllByText('Done')).toHaveLength(4);
    expect(within(list).queryByText('Not yet')).toBeNull();
  });

  it('keeps "End the call?" and asks for no check in Assessment practice', async () => {
    const load = vi.fn(() => Promise.reject(new Error('Never asked.')));
    renderCall('end-confirm', { loadClosingCheck: load });
    await settled();
    expect(screen.getByRole('dialog', { name: 'End the call?' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Ready to close?' })).toBeNull();
    expect(load).not.toHaveBeenCalled();
    expect(document.querySelector('.cw-close')).toBeNull();
  });

  it('never makes ending wait: End and review is there at once and ends the call while the check loads', async () => {
    const user = userEvent.setup();
    const { actions } = renderCall('end-ready-to-close-loading');
    const end = inReady().getByRole('button', { name: 'End and review' });
    expect(end).not.toHaveAttribute('aria-disabled');
    expect(end).not.toHaveAttribute('aria-busy');
    expect(ready().querySelector('.cw-close--loading')).not.toBeNull();
    await user.click(end);
    expect(actions.endCall).toHaveBeenCalledTimes(1);
  });

  it('leaves the check out without a word when it fails, and still ends the call', async () => {
    const user = userEvent.setup();
    const { actions } = renderCall('end-ready-to-close-failed');
    await settled();
    expect(ready().querySelector('.cw-close')).toBeNull();
    expect(inReady().queryByRole('alert')).toBeNull();
    expect(inReady().queryByText(/could not|failed|error|try again/i)).toBeNull();
    await user.click(inReady().getByRole('button', { name: 'End and review' }));
    expect(actions.endCall).toHaveBeenCalledTimes(1);
  });

  it('asks again each time the dialog opens, so the check is about the call as it stands', async () => {
    const user = userEvent.setup();
    const load = vi.fn(closingCheckLoader('mixed'));
    renderCall('guided-hints', { loadClosingCheck: load });
    const end = () =>
      within(document.querySelector('header') as HTMLElement).getByRole('button', {
        name: 'End call',
      });
    await user.click(end());
    await inReady().findByRole('list', { name: 'Closing check' });
    expect(load).toHaveBeenCalledTimes(1);
    await user.click(inReady().getByRole('button', { name: 'Continue call' }));
    expect(screen.queryByRole('dialog', { name: 'Ready to close?' })).toBeNull();
    await user.click(end());
    await inReady().findByRole('list', { name: 'Closing check' });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('does not ask for a check when there is nothing to review: carrying on or leaving is all that is offered', async () => {
    const base = FIXTURES['end-nothing-to-review'].snapshot;
    const session = base.session as NonNullable<CallSnapshot['session']>;
    const guided: CallSnapshot = {
      ...base,
      session: {
        ...session,
        scenario: {
          ...session.scenario,
          config: { ...session.scenario.config, mode: 'guided' },
        },
      },
    };
    const load = vi.fn(closingCheckLoader('mixed'));
    renderCall(guided, { initialUi: { endOpen: true }, loadClosingCheck: load });
    await settled();
    expect(load).not.toHaveBeenCalled();
    expect(document.querySelector('.cw-close')).toBeNull();
  });

  it('is the same dialog, with its check, at every width', async () => {
    for (const width of [WIDTH.narrow, WIDTH.medium, WIDTH.wide]) {
      renderCall('end-ready-to-close', { width });
      const list = await inReady().findByRole('list', { name: 'Closing check' });
      expect(within(list).getAllByRole('listitem')).toHaveLength(4);
      cleanup();
    }
  });
});
