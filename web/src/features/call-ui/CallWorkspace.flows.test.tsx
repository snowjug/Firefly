import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FIXTURES } from './call-fixtures.ts';
import { clearViewport, renderCall, WIDTH } from './test-utils.tsx';

afterEach(() => {
  cleanup();
  clearViewport();
  vi.useRealTimers();
});

const controls = () => screen.getByRole('group', { name: 'Call controls' });
const control = (name: string | RegExp) => within(controls()).getByRole('button', { name });
const bar = () => document.querySelector('header') as HTMLElement;

/** The same moments with hands-free off: Talk, then Done speaking, one control as it always was. */
const PUSH_TO_TALK = {
  listening: { ...FIXTURES.listening.snapshot, handsFree: false, autoListening: false },
  hearing: { ...FIXTURES['speech-detected'].snapshot, handsFree: false, autoListening: false },
};

describe.each([
  ['wide', WIDTH.wide],
  ['narrow', WIDTH.narrow],
] as const)('the call controls at %s width', (_name, width) => {
  it('Talk opens the microphone once, and Done speaking finishes the sentence once', async () => {
    const user = userEvent.setup();
    const { actions } = renderCall('mic-ready', { width });
    await user.click(control('Talk'));
    expect(actions.talk).toHaveBeenCalledTimes(1);
    expect(actions.stopTalking).not.toHaveBeenCalled();
    cleanup();

    const listening = renderCall(PUSH_TO_TALK.listening, { width });
    await user.click(control('Done speaking'));
    expect(listening.actions.stopTalking).toHaveBeenCalledTimes(1);
    expect(listening.actions.talk).not.toHaveBeenCalled();
  });

  it('takes the trainee back to voice from a typed call with one press', async () => {
    const { actions } = renderCall('text-fallback', { width });
    await userEvent.setup().click(control('Return to voice'));
    expect(actions.begin).toHaveBeenCalledExactlyOnceWith({ voice: true });
  });

  it('stops the customer’s audio only while there is audio to stop', async () => {
    const user = userEvent.setup();
    const speaking = renderCall('customer-speaking', { width });
    await user.click(control('Stop customer audio'));
    expect(speaking.actions.interrupt).toHaveBeenCalledTimes(1);
    cleanup();

    const quiet = renderCall('mic-ready', { width });
    const stop = control('Stop customer audio');
    expect(stop).toHaveAttribute('aria-disabled', 'true');
    await user.click(stop);
    expect(quiet.actions.interrupt).not.toHaveBeenCalled();
  });

  it('mutes and unmutes, and says which it is', async () => {
    const user = userEvent.setup();
    const { actions } = renderCall('mic-ready', { width });
    expect(control('Mute')).toHaveAttribute('aria-pressed', 'false');
    await user.click(control('Mute'));
    expect(actions.toggleMute).toHaveBeenCalledTimes(1);
    cleanup();

    renderCall('muted', { width });
    expect(control('Mute')).toHaveAttribute('aria-pressed', 'true');
  });

  it('switches to text, pauses and replays', async () => {
    const user = userEvent.setup();
    const { actions } = renderCall('mic-ready', { width });
    await user.click(control('Text'));
    await user.click(control('Pause'));
    await user.click(control('Replay'));
    expect(actions.useText).toHaveBeenCalledTimes(1);
    expect(actions.togglePause).toHaveBeenCalledTimes(1);
    expect(actions.replay).toHaveBeenCalledTimes(1);
  });

  it('turns Pause into Resume and switches Replay off while paused', async () => {
    const user = userEvent.setup();
    const { actions } = renderCall('paused', { width });
    expect(control('Replay')).toHaveAttribute('aria-disabled', 'true');
    await user.click(control('Resume'));
    expect(actions.togglePause).toHaveBeenCalledTimes(1);
    expect(within(controls()).queryByRole('button', { name: 'Pause' })).toBeNull();
  });

  it('keeps a control that cannot be used in the tab order, explains it by the status, and does nothing', async () => {
    const user = userEvent.setup();
    const { actions } = renderCall('customer-speaking', { width });
    const talk = control('Talk');
    expect(talk).toHaveAttribute('aria-disabled', 'true');
    expect(talk).not.toHaveAttribute('disabled');
    talk.focus();
    expect(talk).toHaveFocus();
    await user.click(talk);
    await user.keyboard('{Enter} ');
    expect(actions.talk).not.toHaveBeenCalled();
    const status = document.getElementById(talk.getAttribute('aria-describedby') ?? '');
    expect(status).toHaveTextContent('Customer speaking');
  });

  it('keeps Talk working, and says Microphone ready, until the microphone is really open', async () => {
    const user = userEvent.setup();
    const { actions, update } = renderCall('mic-opening', { width });
    const talk = control('Talk');
    expect(talk).toHaveAttribute('aria-busy', 'true');
    expect(talk).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('region', { name: 'Customer' })).toHaveTextContent('Microphone ready');
    expect(screen.queryByText('Listening to you')).toBeNull();
    await user.click(talk);
    expect(actions.talk).not.toHaveBeenCalled();
    expect(actions.stopTalking).not.toHaveBeenCalled();

    // Only then is it Listening, and the control becomes the one that finishes the sentence.
    update(PUSH_TO_TALK.listening);
    expect(control('Done speaking')).not.toHaveAttribute('aria-busy');
    expect(screen.getByRole('region', { name: 'Customer' })).toHaveTextContent('Listening to you');
  });
});

describe.each([
  ['wide', WIDTH.wide],
  ['narrow', WIDTH.narrow],
] as const)('a hands-free call at %s width', (_name, width) => {
  const microphone = () =>
    within(controls()).queryByRole('button', { name: /^(Talk|Done speaking|Return to voice)$/ });

  it('has no big microphone control, because the microphone opens by itself', () => {
    renderCall('listening', { width });
    expect(microphone()).toBeNull();
    expect(controls().querySelector('[data-cw-talk]')).toBeNull();
    for (const name of ['Mute', 'Text', 'Pause', 'Replay', 'Settings']) {
      expect(control(name)).toBeInTheDocument();
    }
    // Nothing to stop while nobody is speaking: the customer's control comes with their voice.
    expect(within(controls()).queryByRole('button', { name: 'Stop customer audio' })).toBeNull();
  });

  it('offers Done speaking only once speech has been heard, as a quiet way out that never takes focus', async () => {
    const user = userEvent.setup();
    const { actions, update } = renderCall('listening', { width });
    expect(microphone()).toBeNull();

    update(FIXTURES['speech-detected'].snapshot);
    const done = control('Done speaking');
    expect(done).toHaveClass('ff-button--secondary');
    expect(done).not.toHaveClass('ff-button--primary');
    expect(done).not.toHaveFocus();
    await user.click(done);
    expect(actions.stopTalking).toHaveBeenCalledTimes(1);
    expect(actions.talk).not.toHaveBeenCalled();
  });

  it('takes Done speaking away once the turn is sent, and keeps the keyboard with the controls', async () => {
    const { update } = renderCall('speech-detected', { width });
    const done = control('Done speaking');
    done.focus();
    expect(done).toHaveFocus();

    update(FIXTURES['hands-free-processing'].snapshot);
    expect(microphone()).toBeNull();
    expect(controls()).toHaveFocus();
  });

  it('shows Stop customer audio only while the customer speaks, and it is the only thing in the slot', async () => {
    const user = userEvent.setup();
    const { actions, update } = renderCall('hands-free-customer-speaking', { width });
    expect(controls().querySelector('.cw-ctl__slot')).toContainElement(
      control('Stop customer audio'),
    );
    expect(microphone()).toBeNull();
    await user.click(control('Stop customer audio'));
    expect(actions.interrupt).toHaveBeenCalledTimes(1);

    update(FIXTURES['hands-free-ready'].snapshot);
    expect(within(controls()).queryByRole('button', { name: 'Stop customer audio' })).toBeNull();
  });

  it('puts Resume in the slot of a call that is held, once, and Pause is not drawn beside it', async () => {
    const user = userEvent.setup();
    const { actions, update } = renderCall('hands-free-paused', { width });
    const resume = control('Resume');
    expect(within(controls()).getAllByRole('button', { name: 'Resume' })).toHaveLength(1);
    expect(within(controls()).queryByRole('button', { name: 'Pause' })).toBeNull();
    expect(resume).toHaveClass('ff-button--primary');
    expect(resume.closest('.cw-ctl__slot')).not.toBeNull();
    await user.click(resume);
    expect(actions.togglePause).toHaveBeenCalledTimes(1);

    update(FIXTURES['hands-free-ready'].snapshot);
    expect(control('Pause')).toBeInTheDocument();
    expect(within(controls()).queryByRole('button', { name: 'Resume' })).toBeNull();
  });

  it('says why a call paused itself, beside Resume', () => {
    renderCall('hands-free-idle-paused', { width });
    expect(controls()).toHaveTextContent('Paused after 10 minutes without sound.');
    expect(control('Resume')).toBeInTheDocument();
  });

  it('brings Talk back only where the microphone will not open by itself', async () => {
    const user = userEvent.setup();
    const { actions } = renderCall('hands-free-capped', { width });
    const talk = control('Talk');
    expect(talk).not.toHaveAttribute('aria-disabled', 'true');
    expect(talk).toHaveClass('ff-button--primary');
    await user.click(talk);
    expect(actions.talk).toHaveBeenCalledTimes(1);
    cleanup();

    // A problem card is showing: the microphone waits for the card, so Talk is there beside it.
    const failed = FIXTURES['problem-transcription-failed'].snapshot;
    renderCall({ ...failed, handsFree: true, autoListening: true }, { width });
    expect(control('Talk')).toBeInTheDocument();
  });

  it('gives the soft guidance the slot while there is nothing to press, fading in place', () => {
    const { update } = renderCall('hands-free-still-listening', { width });
    const hint = () => controls().querySelector('.cw-ctl__slot > .cw-ctl__hint') as HTMLElement;
    expect(hint()).toHaveTextContent('Still listening. Speak when you are ready.');
    expect(hint()).toHaveAttribute('data-visible', 'true');
    expect(hint()).not.toHaveAttribute('aria-hidden');

    // Gone from view and from assistive technology, but its place is kept so nothing moves.
    update(FIXTURES.listening.snapshot);
    expect(hint()).toHaveAttribute('data-visible', 'false');
    expect(hint()).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('the keyboard', () => {
  it('walks the controls in the order they are drawn, one tab stop each', async () => {
    const user = userEvent.setup();
    renderCall('mic-ready');
    control('Talk').focus();
    const names: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      await user.tab();
      names.push(document.activeElement?.textContent ?? '');
    }
    expect(names).toEqual(['Stop customer audio', 'Mute', 'Text', 'Pause', 'Replay', 'Settings']);
  });

  it('presses Talk with Space and Enter, the way any button is pressed', async () => {
    const user = userEvent.setup();
    const { actions } = renderCall('mic-ready');
    expect(control('Talk')).toHaveFocus();
    await user.keyboard(' ');
    await user.keyboard('{Enter}');
    expect(actions.talk).toHaveBeenCalledTimes(2);
  });

  it('starts on the microphone control when the call begins, so the keyboard is not at the top of the page', () => {
    renderCall('mic-ready');
    expect(control('Talk')).toHaveFocus();
  });

  it('has the jump links go to the controls, the transcript and the reply box', async () => {
    const user = userEvent.setup();
    renderCall('text-fallback');
    const jump = screen.getByRole('navigation', { name: 'Jump to' });
    await user.click(within(jump).getByRole('link', { name: 'Jump to the transcript' }));
    expect(screen.getByRole('region', { name: 'Transcript' })).toHaveFocus();
    await user.click(within(jump).getByRole('link', { name: 'Jump to the call controls' }));
    expect(control('Return to voice')).toHaveFocus();
    await user.click(within(jump).getByRole('link', { name: 'Jump to the reply box' }));
    expect(screen.getByRole('textbox', { name: 'Your reply' })).toHaveFocus();
  });
});

describe('typing a reply (the text fallback)', () => {
  const box = () => screen.getByRole('textbox', { name: 'Your reply' });

  it('is a form of the call, with the reply box in focus and no voice controls to get wrong', () => {
    renderCall('text-fallback');
    expect(box()).toHaveFocus();
    expect(screen.getByRole('form', { name: 'Reply' })).toBeInTheDocument();
    for (const name of ['Mute', 'Stop customer audio', 'Pause', 'Replay', 'Text']) {
      expect(within(controls()).queryByRole('button', { name })).toBeNull();
    }
    expect(within(controls()).getByRole('button', { name: 'Return to voice' })).toBeInTheDocument();
  });

  it('offers the way back to voice as a quiet button, not a second main one beside Send', () => {
    renderCall('text-fallback');
    const back = within(controls()).getByRole('button', { name: 'Return to voice' });
    expect(back).toHaveClass('ff-button--outline');
    expect(back).not.toHaveClass('ff-button--large');
    expect(screen.getByRole('button', { name: 'Send' })).toHaveClass('ff-button--primary');
  });

  it('is not in a spoken call', () => {
    renderCall('mic-ready');
    expect(screen.queryByRole('textbox', { name: 'Your reply' })).toBeNull();
  });

  it('sends on Enter exactly what was typed, then clears the box and keeps the keyboard in it', async () => {
    const user = userEvent.setup();
    const { actions } = renderCall('text-fallback');
    await user.type(box(), 'Hello there{Enter}');
    expect(actions.sendText).toHaveBeenCalledExactlyOnceWith('Hello there');
    await waitFor(() => expect(box()).toHaveValue(''));
    expect(box()).toHaveFocus();
  });

  it('sends with the Send button too, and with nothing typed there is nothing to send', async () => {
    const user = userEvent.setup();
    const { actions } = renderCall('text-fallback');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    // An empty reply still goes to the engine, which refuses it; the screen sends what is there.
    expect(actions.sendText).toHaveBeenCalledTimes(1);
    expect(actions.sendText).toHaveBeenCalledWith('');
    await user.type(box(), 'Hi');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(actions.sendText).toHaveBeenLastCalledWith('Hi');
  });

  it('adds a line on Shift+Enter instead of sending', async () => {
    const user = userEvent.setup();
    const { actions } = renderCall('text-fallback');
    await user.type(box(), 'One{Shift>}{Enter}{/Shift}Two');
    expect(box()).toHaveValue('One\nTwo');
    expect(actions.sendText).not.toHaveBeenCalled();
  });

  it('keeps what was typed when the call did not take it, so nothing is lost', async () => {
    const user = userEvent.setup();
    const { actions } = renderCall('text-fallback');
    actions.sendText.mockResolvedValueOnce(false);
    await user.type(box(), 'Please keep this{Enter}');
    expect(actions.sendText).toHaveBeenCalledTimes(1);
    expect(box()).toHaveValue('Please keep this');
  });

  it('keeps anything typed while the message was on its way', async () => {
    const user = userEvent.setup();
    const { actions } = renderCall('text-fallback');
    let accept!: (accepted: boolean) => void;
    actions.sendText.mockReturnValueOnce(new Promise<boolean>((resolve) => (accept = resolve)));
    await user.type(box(), 'First{Enter}');
    await user.type(box(), ' and more');
    accept(true);
    await waitFor(() => expect(box()).toHaveValue('First and more'));
  });

  it('sends once when Enter is pressed again while the first is still on its way', async () => {
    const user = userEvent.setup();
    const { actions } = renderCall('text-fallback');
    let accept!: (accepted: boolean) => void;
    actions.sendText.mockReturnValueOnce(new Promise<boolean>((resolve) => (accept = resolve)));
    await user.type(box(), 'Once{Enter}{Enter}{Enter}');
    expect(actions.sendText).toHaveBeenCalledTimes(1);
    accept(true);
    await waitFor(() => expect(box()).toHaveValue(''));
  });

  it('waits while the customer replies: the draft stays, the reason is said, nothing is sent', async () => {
    const user = userEvent.setup();
    const { actions } = renderCall('text-thinking');
    expect(box()).toHaveValue('Is the driver version on that PC');
    const send = screen.getByRole('button', { name: 'Send' });
    expect(send).toHaveAttribute('aria-disabled', 'true');
    expect(send).toHaveAccessibleDescription('Waiting for the customer.');
    box().focus();
    await user.keyboard('{Enter}');
    await user.click(send);
    expect(actions.sendText).not.toHaveBeenCalled();
    expect(box()).toHaveValue('Is the driver version on that PC');
  });

  it('shows the sent message read-only while the customer replies, and gives the box back, empty, when the reply is in', async () => {
    const user = userEvent.setup();
    const { actions, update } = renderCall('text-fallback');
    let accept!: (accepted: boolean) => void;
    actions.sendText.mockReturnValueOnce(new Promise<boolean>((resolve) => (accept = resolve)));
    await user.type(box(), 'Hello there{Enter}');
    expect(box()).not.toHaveAttribute('readonly');
    // The call has taken the message and the customer is replying.
    update(FIXTURES['text-thinking'].snapshot);
    expect(box()).toHaveAttribute('readonly');
    expect(box()).toHaveValue('Hello there');
    expect(box()).toHaveAccessibleDescription(/Waiting for the customer\./);
    // It is not editable meanwhile, so what was sent cannot be mistaken for a message still to send.
    await user.type(box(), ' and more');
    expect(box()).toHaveValue('Hello there');
    expect(box()).toHaveFocus();
    // The reply is in: the box is the person's again, and empty.
    accept(true);
    update(FIXTURES['text-fallback'].snapshot);
    await waitFor(() => expect(box()).toHaveValue(''));
    expect(box()).not.toHaveAttribute('readonly');
  });

  it('does not show the count of a message that is waiting for its reply: nothing is being written', () => {
    // 32 characters of a 40 limit: the count would show, were the box open for writing.
    renderCall('text-thinking', { maxMessageChars: 40 });
    expect(box()).toHaveAttribute('readonly');
    expect(screen.queryByText(/ \/ 40/)).toBeNull();
  });

  it('is read-only only while the customer replies: any other wait leaves the box as it was', () => {
    renderCall('problem-save-failed');
    expect(box()).not.toHaveAttribute('readonly');
    cleanup();
    renderCall('text-limit');
    expect(box()).not.toHaveAttribute('readonly');
  });

  it('refuses a message over the limit, says by how much, and allows it again once it fits', async () => {
    const user = userEvent.setup();
    const { actions } = renderCall('text-fallback', { maxMessageChars: 20 });
    await user.type(box(), 'a'.repeat(25));
    expect(box()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('5 over the 20 character limit.')).toBeInTheDocument();
    expect(screen.getByText('25 / 20')).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(actions.sendText).not.toHaveBeenCalled();
    await user.keyboard('{Backspace>5/}');
    expect(box()).not.toHaveAttribute('aria-invalid', 'true');
    await user.keyboard('{Enter}');
    expect(actions.sendText).toHaveBeenCalledExactlyOnceWith('a'.repeat(20));
  });

  it('shows the count only when the limit is near', async () => {
    const user = userEvent.setup();
    renderCall('text-fallback', { maxMessageChars: 100 });
    await user.type(box(), 'a'.repeat(79));
    expect(screen.queryByText(/ \/ 100/)).toBeNull();
    await user.type(box(), 'a');
    expect(screen.getByText('80 / 100')).toBeInTheDocument();
  });

  it('says how many messages are left only when there are few, and says when there are none', () => {
    renderCall('text-limit');
    expect(screen.getByText('No messages left.')).toBeInTheDocument();
    expect(screen.getByText('Message limit reached.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toHaveAttribute('aria-disabled', 'true');
    cleanup();
    renderCall('text-fallback');
    expect(screen.queryByText(/messages? left/)).toBeNull();
  });

  it('says why in words, and not only by dimming, when sending waits for a retry', () => {
    renderCall('problem-save-failed');
    expect(screen.getByRole('button', { name: 'Send' })).toHaveAccessibleDescription(
      'Retry your last message first.',
    );
  });

  it('gives the keyboard to the microphone control when the trainee goes back to voice', () => {
    const { update } = renderCall('text-fallback');
    expect(box()).toHaveFocus();
    update(FIXTURES['mic-ready'].snapshot);
    expect(control('Talk')).toHaveFocus();
  });

  it('describes the keys to a screen reader, once, and shows no help text', () => {
    renderCall('text-fallback');
    expect(box()).toHaveAccessibleDescription(/Enter sends\. Shift and Enter add a line\./);
    expect(screen.queryByText(/press enter/i)).toBeNull();
  });
});

describe('the end of the call from the bar', () => {
  it('opens the question from End call and leaves the call as it was when it is answered "Continue call"', async () => {
    const user = userEvent.setup();
    const { actions } = renderCall('mic-ready');
    const end = within(bar()).getByRole('button', { name: 'End call' });
    await user.click(end);
    const dialog = screen.getByRole('dialog', { name: 'End the call?' });
    expect(within(dialog).getByRole('button', { name: 'Continue call' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Continue call' }));
    expect(screen.queryByRole('dialog', { name: 'End the call?' })).toBeNull();
    expect(actions.endCall).not.toHaveBeenCalled();
    await waitFor(() => expect(end).toHaveFocus());
  });
});

describe('the case', () => {
  it('opens as a sheet from the bar below 80em, and the keyboard goes in and comes back', async () => {
    const user = userEvent.setup();
    renderCall('mic-ready', { width: WIDTH.medium });
    const open = within(bar()).getByRole('button', { name: 'Case' });
    await user.click(open);
    const dialog = screen.getByRole('dialog', { name: 'Case' });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Case' })).toBeNull();
    await waitFor(() => expect(open).toHaveFocus());
  });

  it('keeps private notes when the sheet is closed and opened again, and never sends them anywhere', async () => {
    const user = userEvent.setup();
    const { actions } = renderCall('mic-ready', { width: WIDTH.medium });
    await user.click(within(bar()).getByRole('button', { name: 'Case' }));
    const notes = within(screen.getByRole('dialog', { name: 'Case' })).getByRole('textbox', {
      name: 'Private notes',
    });
    await user.type(notes, 'Ask about the driver');
    await user.keyboard('{Escape}');
    await user.click(within(bar()).getByRole('button', { name: 'Case' }));
    expect(
      within(screen.getByRole('dialog', { name: 'Case' })).getByRole('textbox', {
        name: 'Private notes',
      }),
    ).toHaveValue('Ask about the driver');
    for (const action of Object.values(actions)) expect(action).not.toHaveBeenCalled();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('shows the rest of the brief only when asked', async () => {
    const user = userEvent.setup();
    renderCall('mic-ready');
    const column = screen.getByRole('region', { name: 'Case' });
    const toggle = within(column).getByRole('button', { name: 'More context' });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(within(column).getByText(/shared Windows desktop PCs/)).toBeVisible();
  });

  it('shows the same case in the column as in the sheet', () => {
    renderCall('mic-ready', { width: WIDTH.wide });
    const column = screen.getByRole('region', { name: 'Case' }).textContent;
    cleanup();
    renderCall('case-sheet', { width: WIDTH.medium });
    const sheet = screen.getByRole('dialog', { name: 'Case' }).textContent;
    for (const text of [
      'Microsoft Teams',
      'FX-20418',
      'Synthetic',
      'First contact',
      'Private notes',
    ]) {
      expect(column, text).toContain(text);
      expect(sheet, text).toContain(text);
    }
  });
});

describe('the voice settings', () => {
  it('open from Settings, change nothing by themselves, and give the keyboard back', async () => {
    const user = userEvent.setup();
    const { actions } = renderCall('mic-ready');
    const open = control('Settings');
    await user.click(open);
    const dialog = screen.getByRole('dialog', { name: 'Voice settings' });
    expect(within(dialog).getByRole('button', { name: 'Done' })).toHaveFocus();
    for (const action of Object.values(actions)) expect(action).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(open).toHaveFocus());
  });

  it('turns hands-free, customer audio and the language into engine calls', async () => {
    const user = userEvent.setup();
    const { actions } = renderCall('voice-settings');
    const dialog = within(screen.getByRole('dialog', { name: 'Voice settings' }));
    await user.click(dialog.getByRole('switch', { name: 'Hands-free' }));
    expect(actions.setHandsFree).toHaveBeenCalledExactlyOnceWith(false);
    await user.click(dialog.getByRole('switch', { name: 'Customer audio' }));
    expect(actions.setAudio).toHaveBeenCalledExactlyOnceWith(false);
    await user.selectOptions(dialog.getByRole('combobox', { name: 'Speech language' }), 'en-US');
    expect(actions.setLanguage).toHaveBeenCalledExactlyOnceWith('en-US');
  });
});

describe('the screen as a view of the engine', () => {
  it('does not call the engine when a snapshot changes: it only draws it', () => {
    const { actions, update } = renderCall('mic-ready');
    for (const name of [
      'listening',
      'speech-detected',
      'processing-speech',
      'customer-speaking',
    ] as const) {
      update(FIXTURES[name].snapshot);
    }
    for (const action of Object.values(actions)) expect(action).not.toHaveBeenCalled();
  });
});
