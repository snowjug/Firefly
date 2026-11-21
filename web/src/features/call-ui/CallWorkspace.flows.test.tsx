import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CallSnapshot, CallTurn } from '../call/contract.ts';
import { FIXTURES } from './call-fixtures.ts';
import {
  clearViewport,
  fakeActions,
  renderCall,
  snapshotOf,
  WIDTH,
  type FakeActions,
} from './test-utils.tsx';

afterEach(() => {
  cleanup();
  clearViewport();
  vi.useRealTimers();
});

const wide = { width: WIDTH.wide };
const textbox = () => screen.getByRole('textbox', { name: 'Type a reply' });
const sendButton = () => screen.getByRole('button', { name: 'Send' });

// ---- The voice controls -----------------------------------------------------------------------

describe('the large round control', () => {
  it('starts push-to-talk on the trainee’s turn', async () => {
    const { actions } = renderCall('ready-for-next-turn', wide);
    const talk = screen.getByRole('button', { name: 'Talk' });
    expect(talk).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(talk);
    expect(actions.talk).toHaveBeenCalledTimes(1);
  });

  it('is the stop control while the microphone is open, and says it is pressed', async () => {
    const { actions } = renderCall('listening', wide);
    const stop = screen.getByRole('button', { name: 'Stop talking' });
    expect(stop).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(stop);
    expect(actions.stopTalking).toHaveBeenCalledTimes(1);
    expect(actions.talk).not.toHaveBeenCalled();
  });

  it('becomes Interrupt while the customer’s voice plays', async () => {
    const { actions } = renderCall('customer-speaking', wide);
    await userEvent.click(screen.getByRole('button', { name: 'Interrupt' }));
    expect(actions.interrupt).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Talk' })).not.toBeInTheDocument();
  });

  it.each([
    ['transcribing', /Turning your speech into text/],
    ['processing', /Waiting for the customer to reply/],
    ['paused', /Call paused/],
    ['muted', /Turn off mute to talk/],
  ] as const)('is disabled, with its reason in words, during %s', async (name, reason) => {
    const { actions } = renderCall(name, wide);
    const talk = screen.getByRole('button', { name: 'Talk' });
    expect(talk).toHaveAttribute('aria-disabled', 'true');
    expect(talk).toHaveAccessibleDescription(reason);
    await userEvent.click(talk);
    expect(actions.talk).not.toHaveBeenCalled();
  });

  it('keeps the keyboard on the control as the stage changes, so focus is never lost', () => {
    const { update } = renderCall('ready-for-next-turn', wide);
    const talk = screen.getByRole('button', { name: 'Talk' });
    talk.focus();
    update(snapshotOf('listening'));
    expect(talk).toHaveFocus();
    expect(talk).toHaveAccessibleName('Stop talking');
    update(snapshotOf('transcribing'));
    expect(talk).toHaveFocus();
    expect(talk).toHaveAttribute('aria-disabled', 'true');
    update(snapshotOf('customer-speaking'));
    expect(talk).toHaveFocus();
    expect(talk).toHaveAccessibleName('Interrupt');
  });
});

describe('the other voice controls', () => {
  it('mute is a toggle that reports its state, and pause turns into resume while the call is paused', async () => {
    const { actions, update } = renderCall('ready-for-next-turn', wide);
    const mute = screen.getByRole('button', { name: 'Mute' });
    const pause = screen.getByRole('button', { name: 'Pause' });
    expect(mute).toHaveAttribute('aria-pressed', 'false');
    expect(pause).not.toHaveAttribute('aria-pressed');
    await userEvent.click(mute);
    await userEvent.click(pause);
    expect(actions.toggleMute).toHaveBeenCalledTimes(1);
    expect(actions.togglePause).toHaveBeenCalledTimes(1);
    update(snapshotOf('muted'));
    expect(screen.getByRole('button', { name: 'Mute' })).toHaveAttribute('aria-pressed', 'true');
    update(snapshotOf('paused'));
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(actions.togglePause).toHaveBeenCalledTimes(2);
  });

  it('shows whether hands-free is on', () => {
    const { unmount } = renderCall('ready-for-next-turn', wide);
    expect(screen.getByText('Push to talk')).toBeInTheDocument();
    unmount();
    clearViewport();
    renderCall('hands-free', wide);
    expect(screen.getByText('Hands-free on')).toBeInTheDocument();
  });

  it('replays the latest reply, unless there is nothing to replay or no voice to replay it in', async () => {
    const base = snapshotOf('ready-for-next-turn');
    const { actions, update } = renderCall(base, wide);
    await userEvent.click(screen.getByRole('button', { name: 'Replay' }));
    expect(actions.replay).toHaveBeenCalledTimes(1);

    update({ ...base, turns: [] });
    expect(screen.getByRole('button', { name: 'Replay' })).toHaveAttribute('aria-disabled', 'true');
    update({
      ...base,
      support: { ...base.support, playback: 'none', playbackLabel: 'Captions only' },
    });
    expect(screen.getByRole('button', { name: 'Replay' })).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Replay' }));
    expect(actions.replay).toHaveBeenCalledTimes(1);
  });

  it('moves the keyboard into the reply box with Type instead', async () => {
    renderCall('ready-for-next-turn', wide);
    expect(screen.queryByRole('textbox', { name: 'Type a reply' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Type instead' }));
    expect(textbox()).toHaveFocus();
  });

  it('has no voice controls on a typed call, only a plain note', () => {
    renderCall('text-only', wide);
    expect(screen.queryByRole('group', { name: 'Voice controls' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Talk' })).not.toBeInTheDocument();
    expect(screen.getByText(/This call is text-only/)).toBeInTheDocument();
    expect(textbox()).toBeInTheDocument();
  });

  it('shows soft guidance beside the controls, in the call’s own words', () => {
    const { unmount } = renderCall('nothing-heard', wide);
    const controls = () => within(screen.getByRole('group', { name: 'Voice controls' }));
    expect(
      controls().getByText(
        'Nothing was heard. Check that the right microphone is selected, then speak again, or type your reply.',
      ),
    ).toBeInTheDocument();
    unmount();
    clearViewport();
    renderCall('no-words', wide);
    expect(
      controls().getByText(
        'Your voice was picked up, but no words could be made out. Speak again, or type your reply.',
      ),
    ).toBeInTheDocument();
  });

  it('says that hands-free waits for the trainee when it keeps hearing nothing', () => {
    renderCall('hands-free', wide);
    expect(
      within(screen.getByRole('group', { name: 'Call status and controls' })).getByText(
        'Hands-free opens the microphone by itself. If it stays closed, press Talk or type a reply.',
      ),
    ).toBeInTheDocument();
  });
});

describe('the voice settings', () => {
  it('offers hands-free and the speech language, and says plainly what is in use', async () => {
    const { actions } = renderCall('ready-for-next-turn', wide);
    await userEvent.click(screen.getByRole('button', { name: 'Voice settings' }));
    const dialog = screen.getByRole('dialog', { name: 'Voice settings' });

    const handsFree = within(dialog).getByRole('switch', { name: 'Hands-free' });
    expect(handsFree).not.toBeChecked();
    expect(handsFree).toHaveAccessibleDescription(/waits for you after three empty tries in a row/);
    await userEvent.click(handsFree);
    expect(actions.setHandsFree).toHaveBeenCalledWith(true);

    const language = within(dialog).getByRole('combobox', { name: 'Speech language' });
    expect(within(language).getAllByRole('option')).toHaveLength(5);
    await userEvent.selectOptions(language, 'en-US');
    expect(actions.setLanguage).toHaveBeenCalledWith('en-US');

    expect(within(dialog).getByText('en-GB-SoniaNeural')).toBeInTheDocument();
    expect(within(dialog).getByText('approximated by pace and pitch')).toBeInTheDocument();
    expect(within(dialog).getByText('Azure AI Speech')).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Voice settings' })).toHaveFocus();
  });

  it('names the browser’s voice with the word Browser, and never claims a style the provider did not apply', async () => {
    renderCall('browser-voice', wide);
    const dialog = screen.getByRole('dialog', { name: 'Voice settings' });
    expect(
      within(dialog).getByText('Browser voice (on this device): Microsoft David, en-US'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('approximated by pace and pitch')).toBeInTheDocument();
    expect(within(dialog).getByText(/Browser speech recognition \(online\)/)).toBeInTheDocument();
  });

  it('never presents the browser’s own recognition as reliable', () => {
    renderCall('browser-voice', wide);
    const dialog = screen.getByRole('dialog', { name: 'Voice settings' });
    expect(
      within(dialog).getByText('It can miss words, so you can always type your reply.'),
    ).toBeInTheDocument();
  });

  it('shows the applied style when the provider really performed one', async () => {
    const base = snapshotOf('ready-for-next-turn');
    renderCall(
      {
        ...base,
        voiceDetails: { voice: 'en-GB-RyanNeural', style: 'unfriendly', language: 'en-GB' },
      },
      wide,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Voice settings' }));
    expect(within(screen.getByRole('dialog')).getByText('unfriendly')).toBeInTheDocument();
  });
});

// ---- The composer -----------------------------------------------------------------------------

describe('the composer', () => {
  it('is a single "Type a reply instead" row on a voice call, and opens on demand', async () => {
    renderCall('ready-for-next-turn', wide);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Type a reply instead' }));
    expect(textbox()).toHaveFocus();
    expect(textbox()).toHaveAccessibleDescription(/Enter to send, Shift\+Enter for a new line/);
    // A spoken call can hide the box again.
    await userEvent.click(screen.getByRole('button', { name: 'Hide the reply box' }));
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('is always open on a typed call, which cannot hide it', () => {
    renderCall('text-only', wide);
    expect(textbox()).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hide the reply box' })).not.toBeInTheDocument();
  });

  it('sends on Enter, adds a line on Shift+Enter, and clears once the call accepted the text', async () => {
    const { actions } = renderCall('text-only', wide);
    const box = textbox();
    await userEvent.type(box, 'Hello Maya{Shift>}{Enter}{/Shift}can you read me the message?');
    expect(actions.sendText).not.toHaveBeenCalled();
    expect(box).toHaveValue('Hello Maya\ncan you read me the message?');
    await userEvent.keyboard('{Enter}');
    expect(actions.sendText).toHaveBeenCalledWith('Hello Maya\ncan you read me the message?');
    await waitFor(() => expect(box).toHaveValue(''));
    expect(box).toHaveFocus();
  });

  it('keeps what was typed when the call did not accept it', async () => {
    const actions = fakeActions({ sendText: vi.fn(async () => false) });
    renderCall('text-only', { ...wide, actions });
    await userEvent.type(textbox(), 'Please hold on{Enter}');
    expect(actions.sendText).toHaveBeenCalledTimes(1);
    expect(textbox()).toHaveValue('Please hold on');
  });

  it('sends with the Send button too', async () => {
    const { actions } = renderCall('text-only', wide);
    await userEvent.type(textbox(), 'Hello');
    await userEvent.click(sendButton());
    expect(actions.sendText).toHaveBeenCalledWith('Hello');
  });

  it('does not send while an input method is composing', () => {
    const { actions } = renderCall('text-only', wide);
    fireEvent.change(textbox(), { target: { value: 'こんにちは' } });
    fireEvent.keyDown(textbox(), { key: 'Enter', isComposing: true });
    expect(actions.sendText).not.toHaveBeenCalled();
  });

  it('shows a counter near the limit and will not send a message that is too long', async () => {
    const { actions } = renderCall('text-only', { ...wide, maxMessageChars: 50 });
    const box = textbox();
    await userEvent.type(box, 'a'.repeat(30));
    expect(screen.queryByText(/ \/ 50/)).not.toBeInTheDocument();
    await userEvent.type(box, 'a'.repeat(15));
    expect(screen.getByText('45 / 50')).toBeInTheDocument();
    await userEvent.type(box, 'a'.repeat(10));
    expect(screen.getByText('55 / 50')).toBeInTheDocument();
    expect(screen.getByText(/5 characters over the limit of 50/)).toBeInTheDocument();
    expect(sendButton()).toHaveAttribute('aria-disabled', 'true');
    await userEvent.keyboard('{Enter}');
    expect(actions.sendText).not.toHaveBeenCalled();
  });

  it('waits while the customer replies, with the reason visible, and keeps the draft', async () => {
    const { actions } = renderCall('text-only-thinking', wide);
    const box = textbox();
    expect(box).toBeEnabled();
    await userEvent.type(box, 'One more thing{Enter}');
    expect(actions.sendText).not.toHaveBeenCalled();
    expect(box).toHaveValue('One more thing');
    expect(sendButton()).toHaveAttribute('aria-disabled', 'true');
    expect(sendButton()).toHaveAccessibleDescription('Waiting for the customer to reply.');
    expect(screen.getAllByText('Waiting for the customer to reply.').length).toBeGreaterThan(0);
  });

  it('lets a typed message interrupt the customer’s voice', async () => {
    const base = snapshotOf('customer-speaking');
    const { actions } = renderCall(base, { ...wide, initialUi: { composerOpen: true } });
    await userEvent.type(textbox(), 'Sorry to interrupt{Enter}');
    expect(actions.sendText).toHaveBeenCalledWith('Sorry to interrupt');
  });

  it('says how many messages are left when there are only a few', () => {
    renderCall({ ...snapshotOf('text-only'), turnsRemaining: 2 }, wide);
    expect(screen.getByText('2 messages left in this call.')).toBeInTheDocument();
  });

  it('is disabled, with its reason, at the end of the call’s message limit', async () => {
    renderCall('turn-limit', wide);
    await userEvent.click(screen.getByRole('button', { name: 'Type a reply instead' }));
    expect(sendButton()).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getAllByText('You have reached the limit for this call.').length).toBeGreaterThan(
      0,
    );
  });
});

// ---- Problems ---------------------------------------------------------------------------------

describe('problems', () => {
  const actionNames = (container: HTMLElement) =>
    within(container)
      .queryAllByRole('button')
      .map((button) => button.getAttribute('aria-label') ?? button.textContent);

  it.each([
    ['problem-voice-generation-failed', ['Try again', 'Continue by typing', 'Dismiss']],
    ['problem-playback-blocked', ['Play customer reply', 'Continue by typing', 'Dismiss']],
    ['problem-transcription-failed', ['Try again', 'Continue by typing', 'Dismiss']],
  ] as const)(
    'shows what happened, what was kept and what to do for %s, with the actions that apply',
    (name, actions) => {
      const { snapshot } = FIXTURES[name];
      renderCall(name, wide);
      const problem = snapshot.problem!;
      const notice = screen.getByText(problem.title).closest('div.ff-message') as HTMLElement;
      expect(within(notice).getByText(problem.preserved)).toBeInTheDocument();
      expect(within(notice).getByText(problem.advice)).toBeInTheDocument();
      expect(actionNames(notice)).toEqual([...actions]);
    },
  );

  it('carries each action out', async () => {
    const { actions, update } = renderCall('problem-voice-generation-failed', wide);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(actions.retry).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(actions.dismissProblem).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Continue by typing' }));
    expect(textbox()).toHaveFocus();

    update(snapshotOf('problem-playback-blocked'));
    await userEvent.click(screen.getByRole('button', { name: 'Play customer reply' }));
    expect(actions.replay).toHaveBeenCalledTimes(1);
  });

  it('opens the reply box by itself when a problem leaves typing as the way on, without taking focus', () => {
    renderCall('problem-transcription-failed', wide);
    expect(textbox()).toBeInTheDocument();
    expect(textbox()).not.toHaveFocus();
  });

  it('never shows a raw code or provider text', () => {
    const base = snapshotOf('problem-voice-generation-failed');
    renderCall(base, wide);
    expect(screen.queryByText(/voice-generation-failed/)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Error:|at \w+\.\w+ \(|500|ECONN/);
  });

  it('keeps a failed message, with its own Try again, in the transcript', async () => {
    const { actions } = renderCall('problem-reply-failed', wide);
    const log = screen.getByRole('log', { name: 'Call transcript' });
    expect(within(log).getByText('Not sent. Your words are kept.')).toBeInTheDocument();
    await userEvent.click(within(log).getByRole('button', { name: 'Try again' }));
    expect(actions.retry).toHaveBeenCalledTimes(1);
  });

  it('replaces the controls with the problem and the way out when it stops the call', async () => {
    const { actions } = renderCall('blocking-reply-failed', wide);
    expect(screen.queryByRole('group', { name: 'Voice controls' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Talk' })).not.toBeInTheDocument();
    const notice = screen
      .getByText('The customer could not reply.')
      .closest('div.ff-message') as HTMLElement;
    expect(within(notice).getByText('Your message is kept here.')).toBeInTheDocument();
    await userEvent.click(within(notice).getByRole('button', { name: 'Try again' }));
    expect(actions.retry).toHaveBeenCalledTimes(1);
    // Nothing can be sent until it is handled.
    await userEvent.click(screen.getByRole('button', { name: 'Type a reply instead' }));
    expect(sendButton()).toHaveAttribute('aria-disabled', 'true');
  });

  it('says a call has reached its limit and puts End call forward', async () => {
    renderCall('turn-limit', wide);
    const notice = screen
      .getByText('You have reached the limit for this call.', { selector: 'p.ff-message__title' })
      .closest('div.ff-message') as HTMLElement;
    expect(within(notice).getByText('End the call to get your report.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Talk' })).not.toBeInTheDocument();
    await userEvent.click(within(notice).getByRole('button', { name: 'End call' }));
    expect(screen.getByRole('dialog', { name: 'End the call?' })).toBeInTheDocument();
  });

  it('shows the microphone problem and offers typing as the way on', () => {
    renderCall('problem-microphone-lost', wide);
    expect(screen.getByText('No microphone was found.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue by typing' })).toBeInTheDocument();
    expect(textbox()).toBeInTheDocument();
  });
});

// ---- The transcript ---------------------------------------------------------------------------

describe('the transcript', () => {
  const log = () => screen.getByRole('log', { name: 'Call transcript' });

  it('is a polite log that only ever gains whole turns', () => {
    renderCall('ready-for-next-turn', wide);
    const element = log();
    expect(element).toHaveAttribute('aria-live', 'polite');
    expect(element).toHaveAttribute('aria-relevant', 'additions');
    const turns = within(element).getAllByRole('listitem');
    expect(turns).toHaveLength(FIXTURES['ready-for-next-turn'].snapshot.turns.length);
    for (const turn of turns) expect(turn.textContent?.length).toBeGreaterThan(10);
    expect(screen.getByRole('heading', { name: 'Transcript' })).toBeInTheDocument();
    expect(
      screen.getByText('Everything the customer says is shown here as it is spoken.'),
    ).toBeInTheDocument();
  });

  it('says who spoke, when, and which turns were spoken', () => {
    renderCall('ready-for-next-turn', wide);
    const turns = within(log()).getAllByRole('listitem');
    expect(turns[0]).toHaveTextContent('Maya Okafor');
    expect(turns[0]).toHaveTextContent('0:00');
    expect(turns[1]).toHaveTextContent('You');
    expect(turns[1]).toHaveTextContent('0:19');
    expect(turns[1]).toHaveTextContent('Spoken');
    // A typed turn is not marked as spoken.
    expect(turns[7]).toHaveTextContent('2:20');
    expect(turns[7]).not.toHaveTextContent('Spoken');
    // Customer turns are never marked as spoken by the trainee.
    expect(turns[0]).not.toHaveTextContent('Spoken');
  });

  it('shows a turn being transcribed or sent, and an interrupted reply', () => {
    const { unmount } = renderCall('transcribing', wide);
    const pending = within(log()).getAllByRole('listitem').at(-1)!;
    expect(pending).toHaveTextContent('Transcribing');
    unmount();
    clearViewport();

    const sending = renderCall('processing', wide);
    expect(within(log()).getAllByRole('listitem').at(-1)).toHaveTextContent('Sending');
    sending.unmount();
    clearViewport();

    renderCall('interrupted', wide);
    expect(
      within(log()).getByText('You interrupted. The full reply is above.'),
    ).toBeInTheDocument();
  });

  it('shows the words being spoken under the log, hidden from assistive technology', () => {
    renderCall('speech-detected', wide);
    const caption = screen.getByText('You are saying').closest('p') as HTMLElement;
    expect(caption).toHaveAttribute('aria-hidden', 'true');
    expect(caption).toHaveTextContent(
      'Okay, I can see the account has been locked because of too many',
    );
    // It is under the log, not part of it.
    expect(log()).not.toContainElement(caption);
    expect(log().compareDocumentPosition(caption) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows no live caption when nobody is speaking', () => {
    renderCall('ready-for-next-turn', wide);
    expect(screen.queryByText('You are saying')).not.toBeInTheDocument();
  });

  it('wraps text, keeps line breaks and lets each turn set its own direction', () => {
    const base = snapshotOf('ready-for-next-turn');
    const turn: CallTurn = {
      ...base.turns[0]!,
      key: 'rtl',
      index: 11,
      text: 'مرحبا\nسطر ثان',
    };
    renderCall({ ...base, turns: [...base.turns, turn] }, wide);
    const paragraph = within(log()).getByText(/مرحبا/);
    expect(paragraph).toHaveAttribute('dir', 'auto');
    expect(paragraph.textContent).toBe('مرحبا\nسطر ثان');
  });

  it('holds sixty turns as sixty whole turns', () => {
    renderCall('long-transcript', wide);
    const turns = within(log()).getAllByRole('listitem');
    expect(turns).toHaveLength(60);
    expect(turns.at(-1)).toHaveTextContent('Bye for now.');
  });

  describe('following the newest turn', () => {
    function withMetrics(region: HTMLElement) {
      const metrics = { scrollHeight: 1000, clientHeight: 300, scrollTop: 700 };
      Object.defineProperties(region, {
        scrollHeight: { get: () => metrics.scrollHeight, configurable: true },
        clientHeight: { get: () => metrics.clientHeight, configurable: true },
        scrollTop: {
          get: () => metrics.scrollTop,
          set: (value: number) => {
            metrics.scrollTop = value;
          },
          configurable: true,
        },
      });
      const scrollTo = vi.fn((options: ScrollToOptions) => {
        metrics.scrollTop = options.top ?? 0;
        fireEvent.scroll(region);
      });
      region.scrollTo = scrollTo as unknown as typeof region.scrollTo;
      return { metrics, scrollTo };
    }
    const newReply = (base: CallSnapshot, index: number): CallSnapshot => ({
      ...base,
      turns: [
        ...base.turns,
        { ...base.turns[0]!, key: `new-${index}`, index, text: `A newer reply, number ${index}.` },
      ],
    });

    it('stays with the newest turn while the person is at the end', () => {
      const base = snapshotOf('ready-for-next-turn');
      const { update } = renderCall(base, wide);
      const region = screen.getByRole('region', { name: 'Transcript' });
      const { scrollTo } = withMetrics(region);
      fireEvent.scroll(region);
      update(newReply(base, 11));
      expect(scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'auto' });
      expect(screen.queryByRole('button', { name: 'Jump to latest' })).not.toBeInTheDocument();
    });

    it('offers "Jump to latest" instead of pulling the person back down, and the button works', async () => {
      const base = snapshotOf('ready-for-next-turn');
      const { update } = renderCall(base, { ...wide, reducedMotion: false });
      const region = screen.getByRole('region', { name: 'Transcript' });
      const { metrics, scrollTo } = withMetrics(region);

      metrics.scrollTop = 0;
      fireEvent.scroll(region);
      const jump = await screen.findByRole('button', { name: 'Jump to latest' });

      scrollTo.mockClear();
      update(newReply(base, 11));
      expect(scrollTo).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Jump to latest' })).toBeInTheDocument();

      await userEvent.click(jump);
      expect(scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'smooth' });
      expect(screen.queryByRole('button', { name: 'Jump to latest' })).not.toBeInTheDocument();
      // The keyboard stays where the transcript is.
      expect(region).toHaveFocus();
    });

    it('jumps instantly under reduced motion', async () => {
      const base = snapshotOf('ready-for-next-turn');
      renderCall(base, { ...wide, reducedMotion: true });
      const region = screen.getByRole('region', { name: 'Transcript' });
      const { metrics, scrollTo } = withMetrics(region);
      metrics.scrollTop = 0;
      fireEvent.scroll(region);
      scrollTo.mockClear();
      await userEvent.click(await screen.findByRole('button', { name: 'Jump to latest' }));
      expect(scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'auto' });
    });
  });
});

// ---- Ending the call --------------------------------------------------------------------------

describe('ending the call', () => {
  const endButton = () =>
    within(screen.getAllByRole('banner')[0]!).getByRole('button', { name: 'End call' });

  it('asks first, with the keyboard on Continue call so a stray Enter ends nothing', async () => {
    const { actions } = renderCall('ready-for-next-turn', wide);
    await userEvent.click(endButton());
    const dialog = screen.getByRole('dialog', { name: 'End the call?' });
    expect(within(dialog).getByRole('button', { name: 'Continue call' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(actions.endCall).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(endButton()).toHaveFocus();
  });

  it('states the call length, how many times the trainee spoke and the customer’s state', async () => {
    renderCall('end-confirm', wide);
    const dialog = screen.getByRole('dialog', { name: 'End the call?' });
    expect(within(dialog).getByText('Call length').nextElementSibling).toHaveTextContent('4:13');
    expect(within(dialog).getByText('You have spoken').nextElementSibling).toHaveTextContent(
      '6 times',
    );
    expect(within(dialog).getByText("Customer's state").nextElementSibling).toHaveTextContent(
      'Calm',
    );
    expect(
      within(dialog)
        .getByText(/What happens next:/)
        .closest('p'),
    ).toHaveTextContent(
      'What happens next: the microphone and any customer audio stop, the transcript is saved and your coaching report is built.',
    );
    expect(within(dialog).queryByText(/This call is short/)).not.toBeInTheDocument();
  });

  it('says a short call rests on limited evidence', () => {
    renderCall('end-confirm-short', wide);
    const dialog = screen.getByRole('dialog', { name: 'End the call?' });
    expect(
      within(dialog).getByText(
        'This call is short, so the report will say its scores rest on limited evidence.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('You have spoken').nextElementSibling).toHaveTextContent(
      'once',
    );
  });

  it('leaves the microphone out of the explanation for a typed call', async () => {
    renderCall('text-only', wide);
    await userEvent.click(endButton());
    const dialog = screen.getByRole('dialog', { name: 'End the call?' });
    expect(within(dialog).queryByText(/microphone/)).not.toBeInTheDocument();
    expect(within(dialog).getByText('You have sent').nextElementSibling).toHaveTextContent(
      '2 messages',
    );
  });

  it('closes on Escape and hands the keyboard back', async () => {
    renderCall('ready-for-next-turn', wide);
    await userEvent.click(endButton());
    fireEvent(
      screen.getByRole('dialog', { name: 'End the call?' }),
      new Event('cancel', { cancelable: true }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(endButton()).toHaveFocus();
  });

  it('ends on "End and review", shows it is working, keeps the dialog, and reports the session', async () => {
    let finish: (value: { sessionId: string } | null) => void = () => undefined;
    const actions = fakeActions({
      endCall: vi.fn(
        () => new Promise<{ sessionId: string } | null>((resolve) => (finish = resolve)),
      ),
    });
    const onEnded = vi.fn();
    renderCall('ready-for-next-turn', { ...wide, actions, onEnded });
    await userEvent.click(endButton());
    const dialog = screen.getByRole('dialog', { name: 'End the call?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'End and review' }));
    expect(actions.endCall).toHaveBeenCalledTimes(1);

    const busy = within(dialog).getByRole('button', { name: 'End and review' });
    expect(busy).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('dialog', { name: 'End the call?' })).toBeInTheDocument();
    // A second press while it works does nothing.
    await userEvent.click(busy);
    expect(actions.endCall).toHaveBeenCalledTimes(1);

    finish({ sessionId: 'ses_done' });
    await waitFor(() => expect(onEnded).toHaveBeenCalledWith('ses_done'));
  });

  it('explains a failure inside the dialog and offers Try again', async () => {
    const calls: Array<{ sessionId: string } | null> = [null];
    const actions = fakeActions({ endCall: vi.fn(async () => calls.shift() ?? null) });
    const base = snapshotOf('ready-for-next-turn');
    const failed = { ...base, problem: FIXTURES['end-failed'].snapshot.problem };
    const { update } = renderCall(base, { ...wide, actions });
    await userEvent.click(endButton());
    await userEvent.click(screen.getByRole('button', { name: 'End and review' }));
    update(failed);
    const dialog = screen.getByRole('dialog', { name: 'End the call?' });
    expect(within(dialog).getByText('We could not end the call.')).toBeInTheDocument();
    expect(
      within(dialog).getByText('Your call is still open and your transcript is saved.'),
    ).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Try again' }));
    expect(actions.endCall).toHaveBeenCalledTimes(2);
  });

  it('clears a failed attempt when the person chooses to carry on', async () => {
    const { actions } = renderCall('end-failed', wide);
    await userEvent.click(screen.getByRole('button', { name: 'Continue call' }));
    expect(actions.dismissProblem).toHaveBeenCalledTimes(1);
  });

  it('becomes the "Ending the call" screen, never blank, once the call is closing', () => {
    renderCall('ending', wide);
    const dialog = screen.getByRole('dialog', { name: 'Ending the call' });
    expect(within(dialog).getByRole('progressbar')).toBeInTheDocument();
    expect(dialog).toHaveAccessibleDescription(
      'We are stopping the microphone, saving the transcript and preparing your report.',
    );
    expect(within(dialog).queryByRole('button')).not.toBeInTheDocument();
    expect(within(dialog).getByText('Ending the call', { selector: 'span' })).toHaveFocus();
  });

  it('moves the keyboard to that heading when the call starts closing under an open dialog', async () => {
    const base = snapshotOf('ready-for-next-turn');
    const { update } = renderCall(base, wide);
    await userEvent.click(endButton());
    update({ ...base, phase: 'ending' });
    const dialog = screen.getByRole('dialog', { name: 'Ending the call' });
    expect(within(dialog).getByText('Ending the call', { selector: 'span' })).toHaveFocus();
    // It cannot be dismissed.
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(screen.getByRole('dialog', { name: 'Ending the call' })).toBeInTheDocument();
  });
});

describe('ending a call with nothing to report', () => {
  it('says there is nothing to review and offers to leave without a report', async () => {
    const onDiscard = vi.fn();
    const { actions } = renderCall('end-nothing-to-review', { ...wide, onDiscard });
    const dialog = screen.getByRole('dialog', { name: 'End the call?' });
    expect(within(dialog).getByText('There is nothing to review yet.')).toBeInTheDocument();
    expect(
      within(dialog).getByText('No message has been sent, so there is no transcript.'),
    ).toBeInTheDocument();
    // Trying again cannot help, so neither Try again nor End and review is offered.
    expect(within(dialog).queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: 'End and review' }),
    ).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Leave without a report' }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(actions.endCall).not.toHaveBeenCalled();
  });

  it('shows that leaving is under way, and does not leave twice', async () => {
    let finish: () => void = () => undefined;
    const onDiscard = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    renderCall('end-nothing-to-review', { ...wide, onDiscard });
    const leave = () => screen.getByRole('button', { name: 'Leave without a report' });
    await userEvent.click(leave());
    expect(leave()).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(leave());
    expect(onDiscard).toHaveBeenCalledTimes(1);
    finish();
    await waitFor(() => expect(leave()).not.toHaveAttribute('aria-busy'));
  });

  it('lets the person carry on instead, which clears the message', async () => {
    const { actions } = renderCall('end-nothing-to-review', { ...wide, onDiscard: vi.fn() });
    await userEvent.click(screen.getByRole('button', { name: 'Continue call' }));
    expect(actions.dismissProblem).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('offers no way to leave where the page has none', () => {
    renderCall('end-nothing-to-review', wide);
    expect(
      screen.queryByRole('button', { name: 'Leave without a report' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue call' })).toBeInTheDocument();
  });

  it('says a spoken call carries on paused after a failed ending, so nothing records by surprise', () => {
    renderCall('end-nothing-to-review', wide);
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
  });
});

export type { FakeActions };
