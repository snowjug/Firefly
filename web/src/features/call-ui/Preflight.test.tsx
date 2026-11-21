import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { wordCount } from '#shared/domain/scenario.ts';
import { MICROPHONE_NOTICE, PRIVACY_DETAILS_LABEL } from '../voice/privacy.ts';
import { VOICE_STATE_TEXT } from '../voice/states.ts';
import { FIXTURES, type FixtureName } from './call-fixtures.ts';
import { clock } from './call-model.ts';
import { announced, clearViewport, renderCall, WIDTH } from './test-utils.tsx';

afterEach(() => {
  cleanup();
  clearViewport();
  vi.useRealTimers();
});

const rows = () =>
  Object.fromEntries(
    within(screen.getByRole('list', { name: 'What is ready' }))
      .getAllByRole('listitem')
      .map((item) => [
        item.querySelector('.cw-pre__check-label')?.textContent,
        item.querySelector('.cw-pre__check-value')?.textContent,
      ]),
  );

describe('the step before the call', () => {
  it('introduces the customer, as made-up, by name, role and organisation, with the scenario and product', () => {
    renderCall('preflight-voice');
    expect(screen.getByRole('heading', { level: 1, name: 'Ready to call?' })).toBeInTheDocument();
    expect(screen.getByText('Priya Raman')).toBeInTheDocument();
    expect(screen.getByText('IT coordinator, Harbourline Logistics')).toBeInTheDocument();
    expect(screen.getByText('Synthetic customer')).toBeInTheDocument();
    expect(
      screen.getByText('Microsoft Teams: Meeting audio drops for one team'),
    ).toBeInTheDocument();
  });

  it('leads with the voice call and offers the typed call beside it, and says what each does', async () => {
    const user = userEvent.setup();
    const { actions } = renderCall('preflight-voice');
    const voice = screen.getByRole('button', { name: 'Start voice call' });
    const text = screen.getByRole('button', { name: 'Start text call' });
    expect(voice).toHaveClass('ff-button--primary');
    expect(text).not.toHaveClass('ff-button--primary');
    expect(voice.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(voice);
    expect(actions.begin).toHaveBeenCalledExactlyOnceWith({ voice: true });
    await user.click(text);
    expect(actions.begin).toHaveBeenLastCalledWith({ voice: false });
  });

  it('leads with the typed call when the address asked for one', () => {
    renderCall('preflight-text');
    const text = screen.getByRole('button', { name: 'Start text call' });
    const voice = screen.getByRole('button', { name: 'Start voice call' });
    expect(text).toHaveClass('ff-button--primary');
    expect(voice).not.toHaveClass('ff-button--primary');
    expect(text.compareDocumentPosition(voice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('offers only the typed call where this browser cannot hold a spoken one, and says why', () => {
    renderCall('preflight-unsupported');
    expect(screen.queryByRole('button', { name: /voice call/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Start text call' })).toHaveClass(
      'ff-button--primary',
    );
    expect(screen.getByText('Voice is not available here')).toBeInTheDocument();
    expect(
      screen.getByText('This browser cannot use a microphone. You can still type your replies.'),
    ).toBeInTheDocument();
    expect(rows()).toMatchObject({ Speech: 'Unavailable', 'Customer voice': 'Captions only' });
  });

  it('opens neither the microphone nor any sound until a button is pressed', () => {
    const { actions } = renderCall('preflight-voice');
    for (const action of Object.values(actions)) expect(action).not.toHaveBeenCalled();
  });

  it('goes back to the brief of this scenario, with the choices the call was made with', () => {
    renderCall('preflight-voice');
    const link = screen.getByRole('link', { name: 'Back to brief' });
    const url = new URL(link.getAttribute('href') as string, 'https://firefly.test');
    expect(url.pathname).toBe('/scenarios/fixture-teams-audio-drops/brief');
    expect(url.searchParams.get('difficulty')).toBe('standard');
  });

  it('goes where the page says when it is given a place to go back to', () => {
    renderCall('preflight-voice', { briefTo: '/scenarios/x/brief?hints=on' });
    expect(screen.getByRole('link', { name: 'Back to brief' })).toHaveAttribute(
      'href',
      '/scenarios/x/brief?hints=on',
    );
  });
});

describe('what is ready', () => {
  it('lists the microphone, the customer’s voice, the speech and who writes the replies', () => {
    renderCall('preflight-voice');
    expect(rows()).toEqual({
      Microphone: 'Not requested',
      'Customer voice': 'Azure AI Speech',
      Speech: 'Azure AI Speech',
      'Customer AI': "Demo mode: Firefly's built-in rules engine",
    });
  });

  it('never calls the browser’s own recognition a sure thing, and names a live model as one', () => {
    renderCall('preflight-browser-speech');
    expect(rows()).toMatchObject({
      'Customer voice': 'Browser voice',
      Speech: 'Browser speech recognition (online)',
      'Customer AI': 'Live model: Azure OpenAI (gpt-4o)',
    });
    expect(document.querySelector('.cw-pre__check--info .cw-pre__check-value')).not.toBeNull();
  });

  it('calls scripted speech a demonstration: a placeholder voice and a scripted recogniser', () => {
    renderCall('preflight-demo-speech');
    expect(rows()).toMatchObject({
      'Customer voice': 'Placeholder sound (demo)',
      Speech: 'Demo speech (scripted): scripted',
    });
  });

  it('gives each row a word and an icon as well as a colour', () => {
    renderCall('preflight-voice');
    for (const item of within(screen.getByRole('list', { name: 'What is ready' })).getAllByRole(
      'listitem',
    )) {
      expect(item.querySelector('svg')).not.toBeNull();
      expect(item.querySelector('.cw-pre__check-value')?.textContent).toBeTruthy();
    }
  });
});

describe('what is said about the voice', () => {
  const toggle = () => screen.getByRole('button', { name: PRIVACY_DETAILS_LABEL });
  const items = () =>
    [...document.querySelectorAll('.cw-pre__privacy-item')].map((item) => ({
      label: item.querySelector('.cw-pre__privacy-label')?.textContent,
      text: item.querySelector('.cw-pre__detail')?.textContent,
    }));

  it('says, before the microphone is asked for, what it is for and what not to share, in the voice layer’s own words', () => {
    renderCall('preflight-voice');
    expect(screen.getByText(MICROPHONE_NOTICE)).toBeVisible();
    // Before the buttons, not after: it is read before the choice is made.
    const notice = screen.getByText(MICROPHONE_NOTICE);
    const start = screen.getByRole('button', { name: 'Start voice call' });
    expect(notice.compareDocumentPosition(start) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('says nothing about a microphone where this browser cannot use one', () => {
    renderCall('preflight-unsupported');
    expect(screen.queryByText(MICROPHONE_NOTICE)).toBeNull();
  });

  it('keeps how the voice is handled one step further in, closed until it is asked for', () => {
    renderCall('preflight-voice');
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(items()).toHaveLength(8);
    expect(document.querySelector('.cw-pre__privacy-item')).not.toBeVisible();
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(document.querySelector('.cw-pre__privacy-item')).toBeVisible();
    expect(items()[0]?.label).toBe('Synthetic scenarios only');
  });

  it.each([
    [
      'preflight-voice',
      'Who handles your audio: Azure AI Speech',
      /sent through this Firefly server to Azure AI Speech/,
      /held in memory only until it has been turned into text/,
    ],
    [
      'preflight-demo-speech',
      'Who handles your audio: Demo speech (scripted)',
      /scripted demonstration/,
      /held in memory only/,
    ],
    [
      'preflight-browser-speech',
      'Who handles your audio: Your browser',
      /Firefly never receives the audio[^.]*\. In Edge and Chrome this is normally an online service/,
      /Firefly never receives or keeps your audio on this path/,
    ],
    [
      'preflight-unsupported',
      'Who handles your audio: No speech service',
      /you type your replies and no audio is recorded/,
      /Nothing is recorded/,
    ],
  ] as const)(
    'says only what is true of the speech path in use in %s',
    (name, who, handled, kept) => {
      renderCall(name);
      const list = items();
      const last = list[list.length - 1];
      expect(last?.label).toBe(who);
      expect(last?.text).toMatch(handled);
      expect(list.find((item) => item.label === 'Your recording is discarded')?.text).toMatch(kept);
    },
  );
});

describe('asking for the microphone', () => {
  it('shows the wait on the button and in the row, said once, in the voice layer’s words', () => {
    vi.useFakeTimers();
    renderCall('requesting-permission');
    const button = screen.getByRole('button', {
      name: VOICE_STATE_TEXT['requesting-permission'].label,
    });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(rows().Microphone).toBe('Waiting for permission');
    expect(announced()).toBe(VOICE_STATE_TEXT['requesting-permission'].announcement);
  });

  it('explains a blocked microphone in one card with the way to fix it, and offers Retry and Use text', () => {
    const { actions } = renderCall('permission-denied');
    expect(rows().Microphone).toBe('Blocked');
    const card = document.querySelector('.cw-recovery') as HTMLElement;
    expect(card).toHaveTextContent('The microphone is blocked, so Firefly cannot hear you.');
    expect(card).toHaveTextContent('Nothing was recorded.');
    // The one failure that interrupts: it is an alert, and it is not read a second time.
    expect(card).toHaveAttribute('role', 'alert');
    const fix = within(card).getByRole('button', { name: 'How to fix' });
    expect(fix).toHaveAttribute('aria-expanded', 'false');
    // In the order they are drawn: the advice is part of the text, the actions follow it.
    expect(
      within(card)
        .getAllByRole('button')
        .map((item) => item.textContent?.trim()),
    ).toEqual(['How to fix', 'Retry', 'Use text']);
    // The two start buttons give way to the card: there is one way forward on the screen.
    expect(screen.queryByRole('button', { name: 'Start voice call' })).toBeNull();
    fireEvent.click(within(card).getByRole('button', { name: 'Retry' }));
    expect(actions.retry).toHaveBeenCalledTimes(1);
    fireEvent.click(within(card).getByRole('button', { name: 'Use text' }));
    expect(actions.begin).toHaveBeenCalledExactlyOnceWith({ voice: false });
  });

  it('puts the keyboard on the notice’s first action when the prompt was declined', () => {
    renderCall('permission-denied');
    expect(screen.getByRole('button', { name: 'Retry' })).toHaveFocus();
  });

  it('says a missing microphone in the row and the card', () => {
    renderCall('microphone-unavailable');
    expect(rows().Microphone).toBe('Unavailable');
    expect(screen.getByText('No microphone was found.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use text' })).toBeInTheDocument();
  });
});

describe('a call that is picked up again', () => {
  it('says Resume, shows the time so far and the transcript so far, and the same two ways in', async () => {
    const user = userEvent.setup();
    const { actions } = renderCall('preflight-resume');
    const { snapshot } = FIXTURES['preflight-resume'];
    expect(screen.getByRole('heading', { level: 1, name: 'Resume call' })).toBeInTheDocument();
    expect(screen.getByText('Time so far').parentElement).toHaveTextContent(
      clock(snapshot.elapsedSeconds),
    );
    expect(
      screen.getByRole('heading', { level: 2, name: 'Transcript so far' }),
    ).toBeInTheDocument();
    expect(document.querySelectorAll('.cw-pre__transcript .cw-turn')).toHaveLength(
      snapshot.turns.length,
    );
    await user.click(screen.getByRole('button', { name: 'Resume voice call' }));
    expect(actions.begin).toHaveBeenCalledExactlyOnceWith({ voice: true });
    await user.click(screen.getByRole('button', { name: 'Resume with text' }));
    expect(actions.begin).toHaveBeenLastCalledWith({ voice: false });
  });
});

describe('the step at each width', () => {
  const names: FixtureName[] = ['preflight-voice', 'permission-denied', 'preflight-resume'];
  it.each(
    names.flatMap((name) => [WIDTH.narrow, WIDTH.wide].map((width) => [name, width] as const)),
  )('%s has one heading, one start path and no instructions at %i px', (name, width) => {
    renderCall(name, { width });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(document.querySelectorAll('.cw-pre__actions, .cw-recovery').length).toBeGreaterThan(0);
    for (const paragraph of document.querySelectorAll('.cw-pre__card p')) {
      // The notice is the voice layer's exact sentence; the card and the details have their own copy.
      if (paragraph.closest('.cw-recovery, .ff-disclosure, .cw-pre__notice')) continue;
      expect(
        wordCount(paragraph.textContent ?? ''),
        paragraph.textContent ?? '',
      ).toBeLessThanOrEqual(12);
    }
  });
});
