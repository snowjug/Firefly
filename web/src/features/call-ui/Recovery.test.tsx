import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CallSnapshot } from '../call/contract.ts';
import { describeProblem } from '../call/problems.ts';
import { FIXTURES } from './call-fixtures.ts';
import { CONFIRMATION_MS } from './Recovery.tsx';
import { announced, clearViewport, renderCall, type RenderedCall } from './test-utils.tsx';

afterEach(() => {
  cleanup();
  clearViewport();
  vi.useRealTimers();
});

const card = () => document.querySelector<HTMLElement>('.cw-recovery');
const confirmation = () => document.querySelector<HTMLElement>('.ff-message--success');
const button = (name: string) => screen.getByRole('button', { name });
const inCard = (name: string) => within(card() as HTMLElement).getByRole('button', { name });
const settle = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

/** Everything the page's announcer says, in order, while time passes: what a screen reader would read. */
function listen(forMs = 8000): string[] {
  const heard: string[] = [];
  for (let spent = 0; spent <= forMs; spent += 50) {
    const now = announced();
    if (now && heard[heard.length - 1] !== now) heard.push(now);
    settle(50);
  }
  return heard;
}

describe('a message that could not be sent', () => {
  it('says what happened and what was kept, in one card, with the message still in the transcript', () => {
    renderCall('retry-required');
    expect(card()).toHaveTextContent('The customer could not reply.');
    expect(card()).toHaveTextContent('Your message is kept.');
    const log = screen.getByRole('log', { name: 'Call transcript' });
    expect(within(log).getByText('Take your time, I will stay on the line.')).toBeInTheDocument();
    expect(within(log).getByText('Not sent')).toBeInTheDocument();
  });

  it('offers one Retry, in the card, first and as the main action, and End safely after it', () => {
    renderCall('retry-required');
    const retries = screen.getAllByRole('button', { name: 'Retry' });
    expect(retries).toHaveLength(1);
    expect(card()).toContainElement(retries[0]!);
    expect(retries[0]).toHaveClass('ff-button--primary');
    const labels = within(card() as HTMLElement)
      .getAllByRole('button')
      .map((item) => item.textContent);
    expect(labels).toEqual(['Retry', 'End safely']);
  });

  it('never puts an action inside the transcript, so a failed message has no second Retry', () => {
    renderCall('retry-required');
    const log = screen.getByRole('log', { name: 'Call transcript' });
    expect(within(log).queryAllByRole('button')).toHaveLength(0);
  });

  it('is said once, aloud, by the page’s announcer and not twice by the card as well', () => {
    renderCall('retry-required');
    expect(announced()).toBe('Problem: The customer could not reply. Your message is kept.');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('puts long advice behind "How to fix" instead of filling the card', () => {
    const snapshot: CallSnapshot = {
      ...FIXTURES['mic-ready'].snapshot,
      microphone: 'denied',
      problem: describeProblem('microphone-denied', { browser: 'edge' }),
    };
    renderCall(snapshot);
    const toggle = within(card() as HTMLElement).getByRole('button', { name: 'How to fix' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(within(card() as HTMLElement).getByText(/Permissions for this site/)).not.toBeVisible();
    fireEvent.click(toggle);
    expect(within(card() as HTMLElement).getByText(/Permissions for this site/)).toBeVisible();
  });

  it('keeps the actions of each problem to the ones that can work', () => {
    const labelsFor = (name: Parameters<typeof renderCall>[0]) => {
      renderCall(name);
      const labels = [...(card()?.querySelectorAll('button') ?? [])]
        .map((item) => item.textContent)
        .filter((text) => text !== 'How to fix');
      cleanup();
      return labels;
    };
    expect(labelsFor('problem-voice-generation')).toEqual(['Retry', 'Continue without audio']);
    expect(labelsFor('problem-voice-timeout')).toEqual(['Retry', 'Continue without audio']);
    expect(labelsFor('problem-voice-offline')).toEqual(['Retry', 'Continue without audio']);
    expect(labelsFor('problem-playback-blocked')).toEqual(['Replay', 'Continue without audio']);
    expect(labelsFor('problem-playback-failed')).toEqual(['Replay', 'Continue without audio']);
    expect(labelsFor('problem-transcription-failed')).toEqual(['Retry', 'Use text']);
    expect(labelsFor('problem-transcription-timeout')).toEqual(['Retry', 'Use text']);
    // Trying again cannot help a server with no speech service, so it is not offered.
    expect(labelsFor('problem-speech-unavailable')).toEqual(['Use text']);
    expect(labelsFor('problem-save-failed')).toEqual(['Retry', 'End safely']);
    expect(labelsFor('problem-turn-limit')).toEqual(['End call']);
    expect(labelsFor('text-microphone-lost')).toEqual(['Retry']);
    expect(labelsFor('offline')).toEqual(['Retry']);
  });

  it('says what was kept and what to do in the voice layer’s own words for the failures that are its', () => {
    renderCall('problem-voice-timeout');
    expect(card()).toHaveTextContent("The customer's voice took too long to start.");
    expect(card()).toHaveTextContent("The customer's words are in the transcript.");
    cleanup();
    renderCall('problem-transcription-timeout');
    expect(card()).toHaveTextContent('Turning your speech into text took too long.');
    cleanup();
    renderCall('problem-speech-unavailable');
    expect(card()).toHaveTextContent('Spoken calls are not available on this server right now.');
  });
});

describe('who says a problem aloud', () => {
  it('lets the card say a blocked microphone, as an alert, and keeps the page’s announcer quiet about it', () => {
    renderCall('text-microphone-lost');
    expect(screen.getByRole('alert')).toBe(card());
    expect(card()).toHaveTextContent('No microphone was found.');
    expect(announced()).toBe('');
  });

  it('keeps the card of a customer voice that failed a quiet one: the page’s announcer says it', () => {
    renderCall('problem-voice-generation');
    expect(card()?.getAttribute('role')).not.toBe('alert');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(card()?.getAttribute('aria-live')).toBeNull();
  });
});

describe('pressing the actions of a problem', () => {
  it('Replay plays a blocked reply again, once', () => {
    const { actions } = renderCall('problem-playback-blocked');
    fireEvent.click(inCard('Replay'));
    expect(actions.replay).toHaveBeenCalledTimes(1);
    expect(actions.retry).not.toHaveBeenCalled();
  });

  it('Retry asks for a voice that could not be made again, once', () => {
    const { actions } = renderCall('problem-voice-generation');
    fireEvent.click(inCard('Retry'));
    expect(actions.retry).toHaveBeenCalledTimes(1);
    expect(actions.replay).not.toHaveBeenCalled();
  });

  it('Continue without audio turns the customer’s voice off for the call', () => {
    const { actions } = renderCall('problem-voice-generation');
    fireEvent.click(inCard('Continue without audio'));
    expect(actions.setAudio).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('Use text moves the call to typing', () => {
    const { actions } = renderCall('problem-transcription-failed');
    fireEvent.click(inCard('Use text'));
    expect(actions.useText).toHaveBeenCalledTimes(1);
  });

  it('End safely and End call open the end question instead of ending at once', () => {
    const first = renderCall('problem-save-failed');
    fireEvent.click(inCard('End safely'));
    expect(screen.getByRole('dialog', { name: 'End the call?' })).toBeInTheDocument();
    expect(first.actions.endCall).not.toHaveBeenCalled();
    cleanup();
    const second = renderCall('problem-turn-limit');
    fireEvent.click(inCard('End call'));
    expect(screen.getByRole('dialog', { name: 'End the call?' })).toBeInTheDocument();
    expect(second.actions.endCall).not.toHaveBeenCalled();
  });
});

describe('a retry, from the press to the outcome', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  const retried = (): RenderedCall => {
    const view = renderCall('retry-required');
    fireEvent.click(button('Retry'));
    return view;
  };

  it('asks the engine once, keeps the card with a working Retry, then confirms and goes quiet', () => {
    const { actions, update } = retried();
    expect(actions.retry).toHaveBeenCalledTimes(1);

    // The engine clears the problem the moment the retry starts; the card stays, showing progress.
    update(FIXTURES.retrying.snapshot);
    expect(card()).toHaveTextContent('The customer could not reply.');
    expect(inCard('Retry')).toHaveAttribute('aria-busy', 'true');
    expect(inCard('End safely')).toHaveAttribute('aria-disabled', 'true');
    expect(confirmation()).toBeNull();
    expect(screen.getByText('Retrying')).toBeInTheDocument();

    update(FIXTURES['mic-ready'].snapshot);
    expect(card()).toBeNull();
    expect(confirmation()).toHaveTextContent('Message sent.');
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();

    settle(CONFIRMATION_MS);
    expect(confirmation()).toBeNull();
  });

  it('is heard in order, each sentence once: the problem, Retrying, Message sent, the next turn', () => {
    const { update } = retried();
    update(FIXTURES.retrying.snapshot);
    update(FIXTURES['mic-ready'].snapshot);
    expect(listen()).toEqual([
      'Problem: The customer could not reply. Your message is kept.',
      'Retrying.',
      'Message sent.',
      'Microphone ready.',
    ]);
  });

  it('shows the same message once in the transcript through all of it: nothing is added twice', () => {
    const { update } = retried();
    const rows = () => screen.getAllByText('Take your time, I will stay on the line.');
    expect(rows()).toHaveLength(1);
    update(FIXTURES.retrying.snapshot);
    expect(rows()).toHaveLength(1);
    expect(screen.getByText('Sending')).toBeInTheDocument();
    update({
      ...FIXTURES['mic-ready'].snapshot,
      turns: FIXTURES.retrying.snapshot.turns.map((turn) =>
        turn.status === 'sending' ? { ...turn, status: 'sent' as const } : turn,
      ),
    });
    expect(rows()).toHaveLength(1);
    expect(screen.queryByText('Sending')).toBeNull();
    expect(screen.queryByText('Not sent')).toBeNull();
  });

  it('shows a retry that fails again as the problem, with Retry ready, and confirms nothing', () => {
    const { update } = retried();
    update(FIXTURES.retrying.snapshot);
    update({ ...FIXTURES['retry-required'].snapshot, problem: describeProblem('reply-failed') });
    expect(card()).toHaveTextContent('The customer could not reply.');
    expect(inCard('Retry')).not.toHaveAttribute('aria-busy');
    expect(inCard('End safely')).not.toHaveAttribute('aria-disabled');
    expect(confirmation()).toBeNull();
    settle(CONFIRMATION_MS);
    expect(confirmation()).toBeNull();
  });

  it('can be dismissed, and goes by itself after a few seconds otherwise', () => {
    const { update } = retried();
    update(FIXTURES.retrying.snapshot);
    update(FIXTURES['mic-ready'].snapshot);
    fireEvent.click(button('Dismiss'));
    expect(confirmation()).toBeNull();
  });

  it('does not confirm anything when the engine did not change what was shown', () => {
    const { update } = renderCall('retry-required');
    update(FIXTURES['retry-required'].snapshot);
    expect(confirmation()).toBeNull();
    expect(card()).not.toBeNull();
  });

  it('says "Back online." when what came back was the connection, and shows Reconnecting meanwhile', () => {
    const view = renderCall('reconnecting');
    const bar = () => document.querySelector('header') as HTMLElement;
    expect(within(bar()).getByText('Reconnecting')).toBeInTheDocument();
    fireEvent.click(button('Retry'));
    view.update(FIXTURES.retrying.snapshot);
    expect(within(bar()).getByText('Reconnecting')).toBeInTheDocument();
    view.update(FIXTURES['mic-ready'].snapshot);
    expect(confirmation()).toHaveTextContent('Back online.');
    expect(within(bar()).getByText('Live')).toBeInTheDocument();
  });

  it('says what came back for a lost microphone and for a voice that was made again or replayed', () => {
    const microphone = renderCall('text-microphone-lost');
    fireEvent.click(button('Retry'));
    microphone.update(FIXTURES['text-fallback'].snapshot);
    expect(confirmation()).toHaveTextContent('Microphone ready.');
    cleanup();

    const voice = renderCall('problem-voice-generation');
    fireEvent.click(inCard('Retry'));
    voice.update(FIXTURES['customer-speaking'].snapshot);
    expect(confirmation()).toHaveTextContent('Playing the reply.');
    cleanup();

    const blocked = renderCall('problem-playback-blocked');
    fireEvent.click(inCard('Replay'));
    blocked.update(FIXTURES['customer-speaking'].snapshot);
    expect(confirmation()).toHaveTextContent('Playing the reply.');
  });

  it('says a recording that was kept was sent, and a microphone opened again was listening', () => {
    const resent = renderCall('problem-transcription-failed');
    fireEvent.click(inCard('Retry'));
    resent.update(FIXTURES['processing-speech'].snapshot);
    expect(card()).not.toBeNull();
    expect(inCard('Retry')).toHaveAttribute('aria-busy', 'true');
    resent.update(FIXTURES['customer-speaking'].snapshot);
    expect(confirmation()).toHaveTextContent('Your words were sent.');
    cleanup();

    const again = renderCall('problem-transcription-failed');
    fireEvent.click(inCard('Retry'));
    again.update(FIXTURES.listening.snapshot);
    expect(confirmation()).toHaveTextContent('Listening again.');
  });

  it('keeps what it said while the call moves on, and says it once', () => {
    const { update } = renderCall('problem-transcription-failed');
    fireEvent.click(inCard('Retry'));
    update(FIXTURES['customer-speaking'].snapshot);
    expect(confirmation()).toHaveTextContent('Your words were sent.');
    // The customer finishes and the microphone opens within the few seconds it stays.
    settle(1000);
    update(FIXTURES.listening.snapshot);
    expect(confirmation()).toHaveTextContent('Your words were sent.');
    expect(card()).toBeNull();
    expect(listen(CONFIRMATION_MS).filter((sentence) => /sent\.|again\./.test(sentence))).toEqual([
      'Your words were sent.',
    ]);
  });
});

describe('where the keyboard goes when the card goes', () => {
  it('lands on the call controls when the button that was pressed is replaced by the confirmation', () => {
    vi.useFakeTimers();
    const { update } = renderCall('retry-required');
    const retry = button('Retry');
    retry.focus();
    fireEvent.click(retry);
    update(FIXTURES.retrying.snapshot);
    expect(inCard('Retry')).toHaveFocus();
    update(FIXTURES['mic-ready'].snapshot);
    expect(document.activeElement?.id).toBe('cw-controls');
  });

  it('leaves the keyboard alone when it was somewhere else', () => {
    vi.useFakeTimers();
    const { update } = renderCall('retry-required');
    const mute = within(screen.getByRole('group', { name: 'Call controls' })).getByRole('button', {
      name: 'Mute',
    });
    mute.focus();
    update(FIXTURES['mic-ready'].snapshot);
    expect(mute).toHaveFocus();
  });
});
