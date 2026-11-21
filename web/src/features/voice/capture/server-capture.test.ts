import { afterEach, describe, expect, it, vi } from 'vitest';
import { acquireMicrophone, type MicrophoneHandle } from './microphone.ts';
import { createServerCapture } from './server-capture.ts';
import type { Capture, CaptureHandlers } from './types.ts';
import { installFakes, type FakeEnv } from '../testing/fakes.ts';
import { sine } from '../testing/signals.ts';

let env: FakeEnv;
afterEach(() => env.uninstall());

function recorder() {
  const log: string[] = [];
  const audio: Array<{ blob: Blob; durationMs: number }> = [];
  const handlers: CaptureHandlers = {
    onSpeechStart: () => log.push('start'),
    onSpeechEnd: ({ reason }) => log.push(`end:${reason}`),
    onSpeechDropped: () => log.push('dropped'),
    onInterim: (text) => log.push(`interim:${text}`),
    onAudio: (blob, info) => {
      log.push('audio');
      audio.push({ blob, durationMs: info.durationMs });
    },
    onText: (text) => log.push(`text:${text}`),
    onNothing: () => log.push('nothing'),
    onFailure: (failure) => log.push(`failure:${JSON.stringify(failure)}`),
  };
  return { log, audio, handlers };
}

async function setup(options: { maxUtteranceMs?: number } = {}) {
  env = installFakes();
  const microphone = await acquireMicrophone({ worklet: true });
  const capture = createServerCapture({ microphone, ...options });
  return { microphone, capture };
}

describe('server capture', () => {
  it('reports a spoken sentence as start, end and one 16 kHz WAV, then stops listening', async () => {
    const { capture } = await setup();
    const { log, audio, handlers } = recorder();
    capture.listen(handlers);
    expect(env.audio.listeningWorklets()).toHaveLength(1);

    env.audio.speakSentence({ speechMs: 1000 });
    expect(log).toEqual(['start', 'end:silence', 'audio']);
    expect(audio[0]?.blob.type).toBe('audio/wav');
    // 300 ms before + 1 s of speech + 300 ms after, 2 bytes a sample at 16 kHz, plus the header.
    expect(audio[0]?.blob.size).toBe(44 + Math.round((audio[0]?.durationMs ?? 0) * 32));
    expect(audio[0]?.durationMs).toBeGreaterThan(1500);
    // The microphone is no longer being read.
    expect(env.audio.listeningWorklets()).toHaveLength(0);

    // Anything arriving afterwards is ignored.
    env.audio.speakSentence();
    expect(log).toEqual(['start', 'end:silence', 'audio']);
  });

  it('resamples a recording made at the device rate down to 16 kHz', async () => {
    env = installFakes();
    env.audio.supportsFixedRate = false;
    const microphone = await acquireMicrophone({ worklet: true });
    const capture = createServerCapture({ microphone });
    const { audio, handlers } = recorder();
    capture.listen(handlers);
    expect(microphone.sampleRate).toBe(48000);
    env.audio.speakSentence({ speechMs: 1000 });
    const first = audio[0];
    expect(first).toBeDefined();
    expect(first?.blob.size).toBe(44 + Math.round((first?.durationMs ?? 0) * 32));
  });

  it('finishes the utterance on request: stopped, with what was said so far', async () => {
    const { capture } = await setup();
    const { log, handlers } = recorder();
    const pass = capture.listen(handlers);
    env.audio.feed(sine(900, 16000, 0.3));
    expect(log).toEqual(['start']);
    pass.finish();
    expect(log).toEqual(['start', 'end:stopped', 'audio']);
    expect(env.audio.listeningWorklets()).toHaveLength(0);
  });

  it('reports nothing when finished before anything was said, and closes the pass', async () => {
    const { capture } = await setup();
    const { log, handlers } = recorder();
    const pass = capture.listen(handlers);
    pass.finish();
    expect(log).toEqual(['nothing']);
    expect(env.audio.listeningWorklets()).toHaveLength(0);
    pass.finish();
    expect(log).toEqual(['nothing']);
  });

  it('ignores a click or cough and carries on listening for the sentence', async () => {
    const { capture } = await setup();
    const { log, handlers } = recorder();
    capture.listen(handlers);
    env.audio.speakSentence({ speechMs: 250, trailMs: 1500 });
    expect(log).toEqual(['start', 'dropped']);
    expect(env.audio.listeningWorklets()).toHaveLength(1);
    env.audio.speakSentence({ speechMs: 1000 });
    expect(log.slice(2)).toEqual(['start', 'end:silence', 'audio']);
  });

  it('cuts a very long utterance at the limit the server accepts', async () => {
    const { capture } = await setup({ maxUtteranceMs: 5000 });
    const { log, audio, handlers } = recorder();
    capture.listen(handlers);
    env.audio.feed(sine(8000, 16000, 0.3));
    expect(log).toEqual(['start', 'end:limit', 'audio']);
    expect(audio[0]?.durationMs).toBeLessThanOrEqual(5000);
  });

  it('reports nothing at all after a cancel, even if audio keeps arriving', async () => {
    const { capture } = await setup();
    const { log, handlers } = recorder();
    const pass = capture.listen(handlers);
    env.audio.feed(sine(500, 16000, 0.3));
    pass.cancel();
    env.audio.speakSentence();
    expect(log).toEqual(['start']);
    expect(env.audio.listeningWorklets()).toHaveLength(0);
    expect(() => pass.cancel()).not.toThrow();
  });

  describe('says when it is listening', () => {
    it('reports it once, just after the microphone tap is open, and then not again', async () => {
      const { capture } = await setup();
      const { log, handlers } = recorder();
      capture.listen({ ...handlers, onListening: () => log.push('listening') });
      // The tap is open straight away; the report waits for the call to return.
      expect(env.audio.listeningWorklets()).toHaveLength(1);
      expect(log).toEqual([]);
      await Promise.resolve();
      expect(log).toEqual(['listening']);
      env.audio.speakSentence({ speechMs: 1000 });
      expect(log).toEqual(['listening', 'start', 'end:silence', 'audio']);
    });

    it('does not report it for a pass that was ended before the report was due', async () => {
      const { capture } = await setup();
      const { log, handlers } = recorder();
      const pass = capture.listen({ ...handlers, onListening: () => log.push('listening') });
      pass.cancel();
      await Promise.resolve();
      expect(log).toEqual([]);
    });
  });

  it('keeps one pass open at a time: a new pass ends the old one without a word', async () => {
    const { capture } = await setup();
    const first = recorder();
    const second = recorder();
    capture.listen(first.handlers);
    env.audio.feed(sine(500, 16000, 0.3));
    capture.listen(second.handlers);
    expect(env.audio.listeningWorklets()).toHaveLength(1);
    env.audio.speakSentence();
    expect(first.log).toEqual(['start']);
    expect(second.log).toEqual(['start', 'end:silence', 'audio']);
  });

  it('can be used for many passes without growing: one worklet, no stray connections', async () => {
    const { capture, microphone } = await setup();
    const idleEdges = env.edgeCount();
    const listeners = env.listenerCount();
    for (let i = 0; i < 25; i++) {
      const { handlers } = recorder();
      capture.listen(handlers);
      env.audio.speakSentence();
    }
    expect(env.edgeCount()).toBe(idleEdges);
    expect(env.listenerCount()).toBe(listeners);
    expect(env.contexts).toHaveLength(1);
    expect((microphone as MicrophoneHandle).worklet).not.toBeNull();
  });

  it('fails clearly when the worklet could not be loaded', async () => {
    env = installFakes();
    env.audio.workletFails = true;
    const microphone = await acquireMicrophone({ worklet: true });
    const capture: Capture = createServerCapture({ microphone });
    const { log, handlers } = recorder();
    capture.listen(handlers);
    await vi.waitFor(() => expect(log).toHaveLength(1));
    expect(log[0]).toContain('"reason":"unsupported"');
  });

  it('disposes of an open pass', async () => {
    const { capture } = await setup();
    const { log, handlers } = recorder();
    capture.listen(handlers);
    capture.dispose();
    env.audio.speakSentence();
    expect(log).toEqual([]);
    expect(env.audio.listeningWorklets()).toHaveLength(0);
  });
});
