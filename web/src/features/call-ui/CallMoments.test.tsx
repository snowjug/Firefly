import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CallSnapshot } from '../call/contract.ts';
import { clock } from './call-model.ts';
import { FIXTURES } from './call-fixtures.ts';
import { clearViewport, renderCall, WIDTH } from './test-utils.tsx';

// The moments of a call, on the whole screen: connecting and connected, what the captions say, and the
// call-ended moment, which is read before the report opens.

afterEach(() => {
  cleanup();
  clearViewport();
  vi.useRealTimers();
});

const presence = () => document.querySelector('.cw-presence') as HTMLElement;
const captions = () => document.querySelector('.cw-captions') as HTMLElement | null;

describe('connecting, then connected', () => {
  it('turns a ring round the customer while the call connects, and says so in words', () => {
    renderCall('hands-free-connecting', { reducedMotion: false });
    expect(presence()).toHaveAttribute('data-presence', 'connecting');
    expect(screen.getByRole('region', { name: 'Customer' })).toHaveTextContent('Connecting');
    expect(document.querySelector('.cw-presence__ripple')).toBeNull();
  });

  it('settles with one ripple the instant the customer starts to speak, and not before', () => {
    const { update } = renderCall('hands-free-connecting', { reducedMotion: false });
    update(FIXTURES['hands-free-customer-speaking'].snapshot);
    expect(presence()).toHaveAttribute('data-presence', 'speaking');
    expect(presence()).toHaveAttribute('data-arrival', 'true');
    expect(document.querySelectorAll('.cw-presence__ripple')).toHaveLength(1);
  });

  it('is the ring shown still under reduced motion: no ripple, no growth', () => {
    const { update } = renderCall('hands-free-connecting', { reducedMotion: true });
    expect(presence()).toHaveAttribute('data-presence', 'connecting');
    update(FIXTURES['hands-free-customer-speaking'].snapshot);
    expect(presence()).toHaveAttribute('data-presence', 'speaking');
    expect(document.querySelector('.cw-presence__ripple')).toBeNull();
    expect(presence()).not.toHaveAttribute('data-arrival');
  });

  it('does not make a moment of a call that was already live when the screen opened', () => {
    renderCall('hands-free-customer-speaking', { reducedMotion: false });
    expect(document.querySelector('.cw-presence__ripple')).toBeNull();
  });
});

describe('the live captions on the call screen', () => {
  it('show the customer’s line while they speak, under their name, and the transcript keeps the record', () => {
    const { snapshot } = FIXTURES['hands-free-customer-speaking'];
    renderCall('hands-free-customer-speaking');
    const reply = snapshot.turns.at(-1)!.text;
    expect(captions()).toHaveAttribute('data-live', 'true');
    expect(captions()).toHaveAttribute('data-who', 'customer');
    expect(captions()).toHaveTextContent('Priya Raman');
    expect(captions()?.querySelector('.cw-captions__text')?.textContent?.trim()).toBe(reply);
    // The same words, once, in the log that is the record and the only place they are announced.
    expect(
      within(screen.getByRole('log', { name: 'Call transcript' })).getAllByText(reply),
    ).toHaveLength(1);
  });

  it('show the trainee’s own words as they are heard, and fade away between turns', () => {
    const { update } = renderCall('speech-detected');
    expect(captions()).toHaveAttribute('data-live', 'true');
    expect(captions()).toHaveAttribute('data-who', 'you');
    expect(captions()?.querySelector('.cw-captions__text')?.textContent?.trim()).toBe(
      FIXTURES['speech-detected'].snapshot.interim,
    );

    update(FIXTURES['hands-free-processing'].snapshot);
    expect(captions()).toHaveAttribute('data-live', 'false');
  });

  it('have a place of their own when nothing is said, so the screen never moves for them', () => {
    renderCall('listening');
    expect(captions()).not.toBeNull();
    expect(captions()).toHaveAttribute('data-live', 'false');
  });

  it('are hidden from assistive technology, which hears the finished turns once, from the transcript', () => {
    renderCall('hands-free-customer-speaking');
    expect(captions()).toHaveAttribute('aria-hidden', 'true');
    expect(captions()?.closest('[aria-live], [role="status"], [role="log"]')).toBeNull();
    expect(screen.getAllByRole('log')).toHaveLength(1);
  });

  it('are left out on a narrow screen, where the transcript beside them has the same words', () => {
    renderCall('hands-free-customer-speaking', { width: WIDTH.narrow });
    expect(captions()).toBeNull();
    // The words are still there to read: the current turn in the transcript is marked.
    expect(document.querySelector('[aria-current="true"]')).not.toBeNull();
  });
});

describe('the call-ended moment', () => {
  const ending = FIXTURES.evaluating.snapshot;
  const over = (): CallSnapshot => ({
    ...FIXTURES.completed.snapshot,
    session: { ...FIXTURES.completed.snapshot.session!, status: 'completing' },
  });
  const dialog = () => screen.getByRole('dialog', { name: 'Ending and preparing your review' });

  it('shows Call ended, how long the call was and the progress, in the dialog that is named as it always was', () => {
    renderCall('evaluating');
    expect(within(dialog()).getByText('Call ended')).toBeInTheDocument();
    expect(dialog()).toHaveTextContent(clock(ending.elapsedSeconds));
    expect(within(dialog()).getByText('Call length')).toBeInTheDocument();
    expect(
      within(dialog()).getByRole('progressbar', { name: 'Preparing your review' }),
    ).toBeInTheDocument();
    // The customer's initials are the ring's centre, and the ring is for the eye alone.
    expect(dialog().querySelector('.cw-ended__ring .ff-avatar__initials')).toHaveTextContent('PR');
    expect(dialog().querySelector('.cw-ended__ring')).not.toHaveAttribute('role');
    // The keyboard is on the heading, which assistive technology reads.
    expect(dialog().querySelector('.cw-end__heading')).toHaveFocus();
  });

  it('follows the real work: Ending call, then Preparing your review, then Call complete', () => {
    const { update } = renderCall('ending');
    expect(within(dialog()).getByRole('progressbar', { name: 'Ending call' })).toBeInTheDocument();
    update(FIXTURES.evaluating.snapshot);
    expect(
      within(dialog()).getByRole('progressbar', { name: 'Preparing your review' }),
    ).toBeInTheDocument();
    update(FIXTURES.completed.snapshot);
    expect(
      within(dialog()).getByRole('progressbar', { name: 'Call complete' }),
    ).toBeInTheDocument();
  });

  const press = () => {
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'End the call?' })).getByRole('button', {
        name: 'End and review',
      }),
    );
  };
  const advance = (ms: number) =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });

  it('is read before the report opens: a short beat counted from the press, and never more than a second', async () => {
    vi.useFakeTimers();
    const onEnded = vi.fn();
    const onEndingChange = vi.fn();
    const { actions, update } = renderCall('end-confirm', {
      reducedMotion: false,
      onEnded,
      onEndingChange,
    });
    actions.endCall.mockResolvedValue({ sessionId: 'ses_fixture_priya' });
    press();
    await advance(0);
    expect(onEndingChange).toHaveBeenCalledExactlyOnceWith(true);

    // The engine is quick: the call is closed, and the page would be showing "Opening your review".
    update(ending);
    update(over());
    expect(dialog()).toHaveTextContent('Call ended');
    expect(screen.queryByRole('heading', { name: 'Opening your review' })).toBeNull();
    await advance(700);
    expect(onEnded).not.toHaveBeenCalled();
    await advance(150);
    expect(onEnded).toHaveBeenCalledExactlyOnceWith('ses_fixture_priya');
    expect(onEndingChange).toHaveBeenCalledTimes(1);
  });

  it('takes only what is left of the beat after the real work: slow work adds nothing', async () => {
    vi.useFakeTimers();
    const onEnded = vi.fn();
    const { actions, update } = renderCall('end-confirm', { reducedMotion: false, onEnded });
    actions.endCall.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ sessionId: 'ses_fixture_priya' }), 2000);
        }),
    );
    press();
    update(ending);
    await advance(1900);
    expect(onEnded).not.toHaveBeenCalled();
    update(over());
    await advance(150);
    expect(onEnded).toHaveBeenCalledExactlyOnceWith('ses_fixture_priya');
  });

  it('is not waited for at all under reduced motion: it is the still frame, and the report opens at once', async () => {
    vi.useFakeTimers();
    const onEnded = vi.fn();
    const { actions } = renderCall('end-confirm', { reducedMotion: true, onEnded });
    actions.endCall.mockResolvedValue({ sessionId: 'ses_fixture_priya' });
    press();
    await advance(0);
    expect(onEnded).toHaveBeenCalledExactlyOnceWith('ses_fixture_priya');
  });

  it('gives the page its way back when ending did not work, and never opens the report', async () => {
    vi.useFakeTimers();
    const onEnded = vi.fn();
    const onEndingChange = vi.fn();
    const { actions } = renderCall('end-confirm', {
      reducedMotion: false,
      onEnded,
      onEndingChange,
    });
    actions.endCall.mockResolvedValue(null);
    press();
    await advance(2000);
    expect(onEndingChange.mock.calls).toEqual([[true], [false]]);
    expect(onEnded).not.toHaveBeenCalled();
  });

  it('opens nothing once the screen is gone: someone who has gone back is not taken to the report', async () => {
    vi.useFakeTimers();
    const onEnded = vi.fn();
    const { actions, unmount } = renderCall('end-confirm', { reducedMotion: false, onEnded });
    actions.endCall.mockResolvedValue({ sessionId: 'ses_fixture_priya' });
    press();
    await advance(100);
    unmount();
    await advance(2000);
    expect(onEnded).not.toHaveBeenCalled();
  });

  it('does not stand in the way of a call that was already over when the page opened', () => {
    renderCall(over());
    expect(screen.getByRole('heading', { name: 'Opening your review' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
