import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeVoice, installFakes, type FakeEnv } from '../voice/testing/fakes.ts';
import { VOICE_LIST_GRACE_MS, useBrowserVoiceNote } from './use-browser-voices.ts';

let env: FakeEnv | null = null;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  env?.uninstall();
  env = null;
  vi.useRealTimers();
});

const english = (count: number) =>
  Array.from({ length: count }, (_, index) => fakeVoice(`English voice ${index + 1}`, 'en-GB'));

describe('what the four choices come to in this browser', () => {
  it('is said plainly when the browser has one English voice', () => {
    env = installFakes({ synthesis: [...english(1), fakeVoice('Voix', 'fr-FR')] });
    const { result } = renderHook(() => useBrowserVoiceNote(true, 'en-GB'));
    expect(result.current).toBe(
      'This browser has one English voice, so the four choices differ only in pace.',
    );
  });

  it('is said when only some of the four can be told apart', () => {
    env = installFakes({ synthesis: english(2) });
    const { result } = renderHook(() => useBrowserVoiceNote(true, 'en-GB'));
    expect(result.current).toBe(
      'This browser has 2 English voices, so some of the four choices sound alike.',
    );
  });

  it('is nothing when every choice has a voice of its own', () => {
    env = installFakes({ synthesis: english(4) });
    const { result } = renderHook(() => useBrowserVoiceNote(true, 'en-GB'));
    expect(result.current).toBeNull();
  });

  it('is about the language of the call, not another', () => {
    env = installFakes({ synthesis: [...english(1), fakeVoice('American voice', 'en-US')] });
    const { result } = renderHook(() => useBrowserVoiceNote(true, 'en-US'));
    expect(result.current).toContain('one English voice');
  });

  it('says nothing when the browser\u2019s own voices are not the ones in use', () => {
    env = installFakes({ synthesis: english(1) });
    const { result } = renderHook(() => useBrowserVoiceNote(false, 'en-GB'));
    expect(result.current).toBeNull();
  });
});

describe('while the browser lists its voices', () => {
  it('says nothing at first, and that there are none only after the browser has had a moment', () => {
    env = installFakes({ synthesis: [] });
    const { result } = renderHook(() => useBrowserVoiceNote(true, 'en-GB'));
    expect(result.current).toBeNull();

    act(() => {
      vi.advanceTimersByTime(VOICE_LIST_GRACE_MS - 1);
    });
    expect(result.current).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(
      'This browser has no English voice of its own to offer, so it will use its default voice and the four choices differ only in pace.',
    );
  });

  it('follows the browser when it lists its voices, which many browsers do after the page opens', () => {
    env = installFakes({ synthesis: [] });
    const { result } = renderHook(() => useBrowserVoiceNote(true, 'en-GB'));
    expect(result.current).toBeNull();

    act(() => {
      if (env) env.speech.voices = english(1);
      env?.speech.emit('voiceschanged');
    });
    expect(result.current).toContain('one English voice');

    act(() => {
      if (env) env.speech.voices = english(4);
      env?.speech.emit('voiceschanged');
    });
    expect(result.current).toBeNull();
  });

  it('stops listening when the page is left, and starts no timer when it does not apply', () => {
    env = installFakes({ synthesis: [] });
    const listening = renderHook(() => useBrowserVoiceNote(true, 'en-GB'));
    expect(env.speech.listenerCount()).toBeGreaterThan(0);
    listening.unmount();
    expect(env.speech.listenerCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);

    renderHook(() => useBrowserVoiceNote(false, 'en-GB'));
    expect(vi.getTimerCount()).toBe(0);
  });
});
