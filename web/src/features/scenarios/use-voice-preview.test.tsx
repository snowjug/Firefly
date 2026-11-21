import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VOICE_PREVIEW_TEXT } from '#shared/domain/voices.ts';
import { fakeVoice, installFakes, type FakeEnv } from '../voice/testing/fakes.ts';
import { previewFailureText, useVoicePreview } from './use-voice-preview.ts';

let env: FakeEnv | null = null;

afterEach(() => {
  cleanup();
  env?.uninstall();
  env = null;
  vi.unstubAllGlobals();
});

const FOUR_VOICES = [1, 2, 3, 4].map((n) => fakeVoice(`English voice ${n}`, 'en-GB'));
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('the sample, spoken by the browser', () => {
  it('says the fixed sentence in the voice that was chosen, and reports its start and end', async () => {
    env = installFakes({ synthesis: FOUR_VOICES });
    const { result } = renderHook(() => useVoicePreview('browser-synthesis', 'en-GB'));
    expect(result.current.support).toEqual({ available: true });

    act(() => result.current.play('voice-c'));
    await waitFor(() => expect(env?.speech.spoken).toHaveLength(1));
    const utterance = env.speech.latest();
    expect(utterance.text).toBe(VOICE_PREVIEW_TEXT);
    expect(utterance.lang).toBe('en-GB');
    // The choice reaches the browser's own voice: the third choice is given the third voice.
    expect((utterance.voice as SpeechSynthesisVoice).name).toBe('English voice 3');
    expect(result.current.state).toBe('playing');

    act(() => {
      env?.speech.finishLatest();
    });
    expect(result.current.state).toBe('idle');
    expect(result.current.error).toBeNull();
  });

  it('can be stopped, and says nothing more after that', async () => {
    env = installFakes({ synthesis: FOUR_VOICES });
    const { result } = renderHook(() => useVoicePreview('browser-synthesis', 'en-GB'));
    act(() => result.current.play('voice-a'));
    await waitFor(() => expect(env?.speech.spoken).toHaveLength(1));
    act(() => {
      env?.speech.startLatest();
    });
    act(() => result.current.stop());
    await act(() => pause(50));
    expect(result.current.state).toBe('idle');
    expect(env.speech.cancels).toBeGreaterThan(0);
  });

  it('lets go of the voice when the page is left', async () => {
    env = installFakes({ synthesis: FOUR_VOICES });
    const { result, unmount } = renderHook(() => useVoicePreview('browser-synthesis', 'en-GB'));
    act(() => result.current.play('voice-b'));
    await waitFor(() => expect(env?.speech.spoken).toHaveLength(1));
    const before = env.speech.cancels;
    unmount();
    expect(env.speech.cancels).toBeGreaterThan(before);
  });

  it('says it could not play, and that the choice is kept, when the browser has no speech at all', async () => {
    env = installFakes({ synthesis: false });
    const { result } = renderHook(() => useVoicePreview('browser-synthesis', 'en-GB'));
    act(() => result.current.play('voice-d'));
    await waitFor(() => expect(result.current.state).toBe('failed'));
    expect(result.current.error?.code).toBe('preview-unavailable');
    expect(previewFailureText(result.current.error!)).toBe(
      'The voice preview could not play. Your choice is kept. You can test again or start the call.',
    );
  });

  it('does nothing while it is not known how the customer will be spoken', async () => {
    env = installFakes({ synthesis: FOUR_VOICES });
    const { result } = renderHook(() => useVoicePreview(null, 'en-GB'));
    expect(result.current.support).toEqual({
      available: false,
      reason: 'Checking what this browser can play.',
    });
    act(() => result.current.play('voice-a'));
    await act(() => pause(20));
    expect(env.speech.spoken).toHaveLength(0);
    expect(result.current.state).toBe('idle');
  });
});

describe('the sample, spoken by the speech service', () => {
  const audio = () =>
    new Response(new Blob(['sound'], { type: 'audio/wav' }), {
      status: 200,
      headers: { 'content-type': 'audio/wav', 'x-firefly-speech-voice-id': 'voice-c' },
    });

  it('asks for the chosen voice in the call\u2019s language, with no words of the browser\u2019s own', async () => {
    env = installFakes();
    const fetchMock = vi.fn().mockResolvedValue(audio());
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useVoicePreview('server-speech', 'en-US'));

    act(() => result.current.play('voice-c'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/speech/preview?lang=en-US&voice=voice-c');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{}');
    expect(env.speech.spoken).toHaveLength(0);
  });

  it('plays what came back, shows that it is playing, and ends when the audio does', async () => {
    env = installFakes();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(audio()));
    const { result } = renderHook(() => useVoicePreview('server-speech', 'en-GB'));

    act(() => result.current.play('voice-b'));
    await waitFor(() => expect(env?.element.latest().plays).toHaveLength(1));
    expect(result.current.state).toBe('playing');

    act(() => {
      env?.element.latest().finish();
    });
    expect(result.current.state).toBe('idle');
  });

  it('says what went wrong, and that the choice is kept, when the service cannot be reached', async () => {
    env = installFakes();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const { result } = renderHook(() => useVoicePreview('server-speech', 'en-GB'));

    act(() => result.current.play('voice-a'));
    await waitFor(() => expect(result.current.state).toBe('failed'));
    const failure = result.current.error;
    expect(failure?.message).toMatch(/\.$/);
    expect(previewFailureText(failure!)).toContain('Your choice is kept.');
  });

  it('starts again after a failure, clearing the old one', async () => {
    env = installFakes();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockImplementation(() => Promise.resolve(audio()));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useVoicePreview('server-speech', 'en-GB'));

    act(() => result.current.play('voice-a'));
    await waitFor(() => expect(result.current.state).toBe('failed'));
    act(() => result.current.play('voice-a'));
    expect(result.current.error).toBeNull();
    await waitFor(() => expect(result.current.state).toBe('playing'));
  });
});
