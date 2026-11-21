import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FIXTURES, type FixtureName } from './call-fixtures.ts';
import { announced, clearViewport, renderCall, snapshotOf, WIDTH } from './test-utils.tsx';

afterEach(() => {
  cleanup();
  clearViewport();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const WAITING =
  'Waiting for you to allow the microphone. Look for the prompt near the address bar.';
const PREFLIGHT: FixtureName[] = [
  'preflight-voice',
  'preflight-text',
  'preflight-browser-speech',
  'preflight-unsupported',
  'preflight-resume',
  'requesting-microphone',
  'microphone-denied',
];

const row = (label: string) => {
  const item = screen.getByText(label, { selector: 'span' }).closest('li') as HTMLElement;
  return within(item);
};
const actionButtons = () =>
  screen
    .getAllByRole('button')
    .map((button) => button.textContent)
    .filter(Boolean);

describe('the pre-flight step', () => {
  it('says who the customer is and that they are fictional, and names the scenario', () => {
    renderCall('preflight-voice');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Ready to start the call?' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Maya Okafor')).toBeInTheDocument();
    expect(screen.getByText('Front-desk coordinator, Fabrikam Dental Group')).toBeInTheDocument();
    expect(screen.getByText('Fictional customer')).toBeInTheDocument();
    expect(screen.getByText('Locked out after a password reset')).toBeInTheDocument();
  });

  it('tells the truth about what is ready, row by row', () => {
    renderCall('preflight-voice');
    expect(
      row('Microphone').getByText('Not requested yet. Firefly asks only when you choose to start.'),
    ).toBeInTheDocument();
    expect(row('Speech recognition').getByText('Azure AI Speech')).toBeInTheDocument();
    expect(row('Customer voice').getByText('Azure AI Speech')).toBeInTheDocument();
    expect(
      row('AI customer').getByText("Demo mode: Firefly's built-in rules engine"),
    ).toBeInTheDocument();
  });

  it('names a live model by its own label, never as demo mode', () => {
    renderCall('preflight-browser-speech');
    expect(row('AI customer').getByText('Live model: Azure OpenAI (gpt-4o)')).toBeInTheDocument();
    expect(screen.queryByText(/Demo mode/)).not.toBeInTheDocument();
  });

  it('never presents the browser’s own recognition as reliable', () => {
    renderCall('preflight-browser-speech');
    const recognition = row('Speech recognition');
    expect(
      recognition.getByText(
        'Browser speech recognition (online). It can miss words, so you can always type your reply.',
      ),
    ).toBeInTheDocument();
    // The browser voice has not spoken yet, so it is named as the browser's, nothing more.
    expect(row('Customer voice').getByText('Browser voice')).toBeInTheDocument();
    // The speech service's recognition carries no such caveat.
    cleanup();
    clearViewport();
    renderCall('preflight-voice');
    expect(row('Speech recognition').queryByText(/can miss words/)).not.toBeInTheDocument();
  });

  it('says where speech is processed and that Firefly does not keep audio', () => {
    const { unmount } = renderCall('preflight-voice');
    const privacy = () => screen.getByText(/does not store audio/).closest('p') as HTMLElement;
    expect(privacy()).toHaveTextContent(
      'Firefly opens your microphone only during the call and does not store audio. You can mute or stop it at any time.',
    );
    expect(privacy()).toHaveTextContent(
      "Your speech goes to Firefly's server, which passes it to Azure AI Speech to be turned into text. Firefly does not keep the audio.",
    );
    unmount();
    clearViewport();

    renderCall('preflight-browser-speech');
    expect(privacy()).toHaveTextContent(
      "Your browser's online speech service turns your speech into text, so your audio goes to the browser's vendor. Firefly does not keep it.",
    );
    cleanup();
    clearViewport();

    renderCall('preflight-unsupported');
    expect(privacy()).toHaveTextContent(
      'Speech recognition is not available here, so nothing is recorded and you will type your replies.',
    );
  });

  it('says plainly that the scripted demonstration does not understand audio', () => {
    renderCall('preflight-demo-speech');
    expect(
      row('Speech recognition').getByText(
        'Demo speech (scripted). It does not understand audio and returns scripted text instead of what you say, so it is for trying the call out. You can always type your reply.',
      ),
    ).toBeInTheDocument();
    expect(
      row('Customer voice').getByText(
        "Demo speech (scripted). A placeholder sound stands in for the customer's voice, so read the transcript.",
      ),
    ).toBeInTheDocument();
    const privacy = screen.getByText(/does not store audio/).closest('p') as HTMLElement;
    expect(privacy).toHaveTextContent('scripted demonstration');
    expect(privacy).toHaveTextContent('answers with scripted text instead of what you said');
    expect(privacy).not.toHaveTextContent('to be turned into text');
  });

  it('leads with the spoken call and starts it from a click', async () => {
    const { actions } = renderCall('preflight-voice');
    expect(actionButtons()).toEqual(['Allow microphone and start', 'Start text-only call']);
    await userEvent.click(screen.getByRole('button', { name: 'Allow microphone and start' }));
    expect(actions.begin).toHaveBeenCalledWith({ voice: true });
    await userEvent.click(screen.getByRole('button', { name: 'Start text-only call' }));
    expect(actions.begin).toHaveBeenLastCalledWith({ voice: false });
  });

  it('leads with the typed call when the address asks for it', async () => {
    const { actions } = renderCall('preflight-text');
    expect(actionButtons()).toEqual(['Start text-only call', 'Allow microphone and start']);
    await userEvent.click(screen.getByRole('button', { name: 'Start text-only call' }));
    expect(actions.begin).toHaveBeenCalledWith({ voice: false });
  });

  it('links back to the brief with the choices the call was made with', () => {
    renderCall('preflight-voice');
    const href = screen.getByRole('link', { name: 'Back to brief' }).getAttribute('href')!;
    expect(href.startsWith('/scenarios/locked-out-after-password-reset/brief?')).toBe(true);
    expect(href).toContain('difficulty=starter');
    expect(href).toContain('hints=off');
  });

  it('leaves out the spoken call, and says why, when voice is not available', async () => {
    const { actions } = renderCall('preflight-unsupported');
    expect(screen.getByText('A spoken call is not available here')).toBeInTheDocument();
    expect(
      screen.getByText('This browser cannot use a microphone. You can still type your replies.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Allow microphone/ })).not.toBeInTheDocument();
    expect(row('Microphone').getByText('Not available in this browser')).toBeInTheDocument();
    expect(
      row('Speech recognition').getByText('Not available in this browser'),
    ).toBeInTheDocument();
    expect(row('Customer voice').getByText('Captions only')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Start text-only call' }));
    expect(actions.begin).toHaveBeenCalledWith({ voice: false });
  });

  it('resumes a call that already has turns, with the time so far and the transcript below', () => {
    renderCall('preflight-resume');
    expect(screen.getByRole('heading', { level: 1, name: 'Resume your call' })).toBeInTheDocument();
    expect(screen.getByText(/Time so far: 6:32/)).toBeInTheDocument();
    const transcript = screen
      .getByRole('heading', { name: 'Transcript so far' })
      .closest('section') as HTMLElement;
    expect(within(transcript).getAllByRole('listitem')).toHaveLength(
      FIXTURES['preflight-resume'].snapshot.turns.length,
    );
    expect(screen.getByRole('button', { name: 'Allow microphone and resume' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resume as a text-only call' })).toBeInTheDocument();
  });

  it('shows no transcript on a call that has not begun', () => {
    renderCall('preflight-voice');
    expect(screen.queryByText('Transcript so far')).not.toBeInTheDocument();
    expect(screen.queryByText(/I can't sign in to the staff portal/)).not.toBeInTheDocument();
  });

  it('waits for the browser’s prompt in words, and keeps a typed call open as a way out', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { actions } = renderCall('requesting-microphone');
    expect(screen.getByText(WAITING, { selector: 'p' })).toBeInTheDocument();
    expect(announced()).toBe(WAITING);
    const waiting = screen.getByRole('button', { name: 'Waiting for the microphone' });
    expect(waiting).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(waiting);
    expect(actions.begin).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Start text-only call' }));
    expect(actions.begin).toHaveBeenCalledWith({ voice: false });
  });

  it('moves the keyboard to the notice when the browser’s prompt is declined', () => {
    const { update } = renderCall('requesting-microphone');
    const waiting = screen.getByRole('button', { name: 'Waiting for the microphone' });
    waiting.focus();
    expect(waiting).toHaveFocus();
    update(FIXTURES['microphone-denied'].snapshot);
    // The pressed button is gone, and the first action of the notice about it takes the keyboard.
    expect(screen.getByRole('button', { name: 'Try again' })).toHaveFocus();
  });

  it('shows a blocked microphone with its advice and two ways on', async () => {
    const { actions } = renderCall('microphone-denied');
    expect(screen.getByText('The microphone is blocked for this site.')).toBeInTheDocument();
    expect(screen.getByText('Nothing has been recorded or sent.')).toBeInTheDocument();
    expect(
      screen.getByText(/Select the lock icon at the left of the address bar/),
    ).toBeInTheDocument();
    expect(row('Microphone').getByText('Blocked in this browser')).toBeInTheDocument();
    // The usual two buttons give way to the problem's own.
    expect(
      screen.queryByRole('button', { name: 'Allow microphone and start' }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(actions.retry).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Start a text-only call' }));
    expect(actions.begin).toHaveBeenCalledWith({ voice: false });
  });

  it('can be used from a phone and from a wide screen alike', () => {
    for (const width of [WIDTH.narrow, WIDTH.wide]) {
      const { unmount } = renderCall('preflight-voice', { width });
      expect(
        screen.getByRole('button', { name: 'Allow microphone and start' }),
      ).toBeInTheDocument();
      unmount();
      clearViewport();
    }
  });
});

describe('before the call begins', () => {
  it('never touches the microphone, audio or the speech APIs', () => {
    const getUserMedia = vi.fn();
    const audio = vi.fn();
    const audioContext = vi.fn();
    const recognition = vi.fn();
    const speak = vi.fn();
    vi.stubGlobal('Audio', audio);
    vi.stubGlobal('AudioContext', audioContext);
    vi.stubGlobal('webkitAudioContext', audioContext);
    vi.stubGlobal('SpeechRecognition', recognition);
    vi.stubGlobal('webkitSpeechRecognition', recognition);
    vi.stubGlobal('speechSynthesis', { speak, getVoices: vi.fn(() => []), cancel: vi.fn() });
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia, enumerateDevices: vi.fn() },
      configurable: true,
    });

    for (const name of PREFLIGHT) {
      const { unmount } = renderCall(name, { width: WIDTH.wide });
      unmount();
      clearViewport();
    }

    expect(getUserMedia).not.toHaveBeenCalled();
    expect(audio).not.toHaveBeenCalled();
    expect(audioContext).not.toHaveBeenCalled();
    expect(recognition).not.toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();
    Reflect.deleteProperty(navigator, 'mediaDevices');
  });

  it('only calls begin from a press', async () => {
    const { actions } = renderCall('preflight-voice');
    expect(actions.begin).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Allow microphone and start' }));
    expect(actions.begin).toHaveBeenCalledTimes(1);
  });

  it('keeps a call that is already open out of the pre-flight', () => {
    renderCall(snapshotOf('ready-for-next-turn'));
    expect(
      screen.queryByRole('heading', { name: 'Ready to start the call?' }),
    ).not.toBeInTheDocument();
  });
});
