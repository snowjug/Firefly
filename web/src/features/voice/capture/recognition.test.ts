import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createRecognitionCapture,
  mapRecognitionError,
  RESULT_WAIT_MS,
  type RecognitionCapture,
} from './recognition.ts';
import type { CaptureHandlers } from './types.ts';
import { installFakes, type FakeEnv } from '../testing/fakes.ts';

let env: FakeEnv;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  env.uninstall();
  vi.useRealTimers();
});

function recorder() {
  const log: string[] = [];
  const handlers: CaptureHandlers = {
    onSpeechStart: () => log.push('start'),
    onSpeechEnd: ({ reason }) => log.push(`end:${reason}`),
    onSpeechDropped: () => log.push('dropped'),
    onInterim: (text) => log.push(`interim:${text}`),
    onAudio: () => log.push('audio'),
    onText: (text) => log.push(`text:${text}`),
    onNothing: () => log.push('nothing'),
    onFailure: (failure) => log.push(`failure:${failure.kind}:${failure.reason}`),
  };
  return { log, handlers };
}

function setup(options: Parameters<typeof installFakes>[0] = {}, language = 'en-GB') {
  env = installFakes({ recognition: true, ...options });
  const modes: string[] = [];
  const capture: RecognitionCapture = createRecognitionCapture({
    language: () => language,
    onModeChange: (mode) => modes.push(mode),
  });
  return { capture, modes };
}

describe('mapRecognitionError', () => {
  it('turns each browser error code into what the call can act on', () => {
    env = installFakes();
    expect(mapRecognitionError('not-allowed')).toEqual({ kind: 'microphone', reason: 'denied' });
    expect(mapRecognitionError('service-not-allowed')).toEqual({
      kind: 'microphone',
      reason: 'denied',
    });
    expect(mapRecognitionError('audio-capture')).toEqual({ kind: 'microphone', reason: 'missing' });
    expect(mapRecognitionError('network')).toEqual({ kind: 'service', reason: 'network' });
    expect(mapRecognitionError('no-speech')).toBe('no-speech');
    expect(mapRecognitionError('aborted')).toBe('aborted');
    expect(mapRecognitionError('language-not-supported')).toEqual({
      kind: 'service',
      reason: 'language',
    });
    expect(mapRecognitionError('bad-grammar')).toEqual({ kind: 'service', reason: 'unknown' });
    expect(mapRecognitionError('something-new')).toEqual({ kind: 'service', reason: 'unknown' });
    expect(mapRecognitionError(undefined)).toEqual({ kind: 'service', reason: 'unknown' });
  });
});

describe('recognition capture', () => {
  it('listens for one sentence at a time with interim results, in the chosen language', () => {
    const { capture } = setup({}, 'en-IE');
    capture.listen(recorder().handlers);
    expect(env.recognition.latest()).toMatchObject({
      lang: 'en-IE',
      interimResults: true,
      continuous: false,
      maxAlternatives: 1,
    });
  });

  it('reports speech, live words, the end of speech and then the final text, once', () => {
    const { capture } = setup();
    const { log, handlers } = recorder();
    capture.listen(handlers);
    const rec = env.recognition.latest();
    rec.open();
    rec.speechStart();
    rec.say('my order', false);
    rec.say('my order has not arrived', false);
    rec.speechEnd();
    rec.say('my order has not arrived', true);
    rec.close();
    expect(log).toEqual([
      'start',
      'interim:my order',
      'interim:my order has not arrived',
      'end:silence',
      'text:my order has not arrived',
    ]);
  });

  it('still reports the start and end of speech when the browser skips those events', () => {
    const { capture } = setup();
    const { log, handlers } = recorder();
    capture.listen(handlers);
    const rec = env.recognition.latest();
    rec.open();
    rec.say('hello there', false);
    rec.say('hello there', true);
    expect(log).toEqual(['start', 'interim:hello there', 'end:silence', 'text:hello there']);
  });

  it('delivers words heard when the session ends without marking them final', () => {
    const { capture } = setup();
    const { log, handlers } = recorder();
    capture.listen(handlers);
    const rec = env.recognition.latest();
    rec.say('refund please', false);
    rec.close();
    expect(log).toEqual(['start', 'interim:refund please', 'end:silence', 'text:refund please']);
  });

  it('treats a session that hears nothing as silence, not a failure', () => {
    const { capture } = setup();
    const { log, handlers } = recorder();
    capture.listen(handlers);
    const rec = env.recognition.latest();
    rec.open();
    rec.fail('no-speech');
    rec.close();
    expect(log).toEqual(['nothing']);
  });

  // What real browsers do when they cannot make anything of clean speech, recorded with Edge 158
  // and Chrome 157 (both were given a seven second synthetic utterance through a fake microphone).
  describe('when the browser could not make anything of the speech', () => {
    it('Edge: a single final result with an empty transcript is nothing heard, never an empty message', () => {
      const { capture } = setup();
      const { log, handlers } = recorder();
      capture.listen(handlers);
      const rec = env.recognition.latest();
      // start, audiostart, soundstart, speechstart ... speechend, soundend, audioend, result, end.
      rec.open();
      rec.speechStart();
      rec.speechEnd();
      rec.onaudioend?.();
      rec.say('', true, 1);
      rec.close();
      expect(log).toEqual(['start', 'end:silence', 'nothing']);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('Edge: the empty result ends the pass by itself, without waiting for the session to end', () => {
      const { capture } = setup();
      const { log, handlers } = recorder();
      capture.listen(handlers);
      const rec = env.recognition.latest();
      rec.open();
      rec.speechStart();
      rec.speechEnd();
      rec.say('', true, 1);
      expect(log).toEqual(['start', 'end:silence', 'nothing']);
      expect(rec.aborts).toBe(1);
      // The session end that follows, and any late result, change nothing.
      rec.close();
      rec.say('late', true);
      expect(log).toEqual(['start', 'end:silence', 'nothing']);
      // No wait for words is left running: it would turn into a network failure.
      expect(vi.getTimerCount()).toBe(0);
      vi.advanceTimersByTime(RESULT_WAIT_MS * 2);
      expect(log).toHaveLength(3);
    });

    it('Chrome: a session that ends after the speech with no result and no error is nothing heard', () => {
      const { capture } = setup();
      const { log, handlers } = recorder();
      capture.listen(handlers);
      const rec = env.recognition.latest();
      rec.open();
      rec.speechStart();
      rec.speechEnd();
      rec.onaudioend?.();
      rec.close();
      expect(log).toEqual(['start', 'end:silence', 'nothing']);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('a session that ends right after sound began, with no result, is nothing heard as well', () => {
      const { capture } = setup();
      const { log, handlers } = recorder();
      capture.listen(handlers);
      const rec = env.recognition.latest();
      rec.open();
      rec.speechStart();
      rec.close();
      expect(log).toEqual(['start', 'nothing']);
    });

    it('a result of only spaces, with no alternatives, or with no transcript at all is never text and never a crash', () => {
      const shapes: Array<[string, unknown]> = [
        ['spaces', Object.assign([{ transcript: '  \n ', confidence: 1 }], { isFinal: true })],
        ['no alternatives', Object.assign([], { isFinal: true })],
        ['no transcript', Object.assign([{ confidence: 1 }], { isFinal: true })],
        ['a transcript that is not text', Object.assign([{ transcript: 42 }], { isFinal: true })],
      ];
      for (const [label, result] of shapes) {
        const { capture } = setup();
        const { log, handlers } = recorder();
        capture.listen(handlers);
        const rec = env.recognition.latest();
        rec.open();
        rec.speechStart();
        rec.speechEnd();
        expect(() => rec.onresult?.({ resultIndex: 0, results: [result] }), label).not.toThrow();
        rec.close();
        expect(log, label).toEqual(['start', 'end:silence', 'nothing']);
        env.uninstall();
      }
    });

    it('a missing result list is ignored, and the session end is still nothing heard', () => {
      const { capture } = setup();
      const { log, handlers } = recorder();
      capture.listen(handlers);
      const rec = env.recognition.latest();
      rec.open();
      expect(() => rec.onresult?.({ resultIndex: 0 })).not.toThrow();
      rec.close();
      expect(log).toEqual(['nothing']);
    });

    it('still delivers real words that come after an interim result with nothing in it', () => {
      const { capture } = setup();
      const { log, handlers } = recorder();
      capture.listen(handlers);
      const rec = env.recognition.latest();
      rec.open();
      rec.speechStart();
      rec.say('', false);
      rec.say('hello there', true);
      expect(log).toEqual(['start', 'end:silence', 'text:hello there']);
    });
  });

  it('reports a refusal, a missing microphone and a network failure as failures', () => {
    for (const [code, expected] of [
      ['not-allowed', 'failure:microphone:denied'],
      ['audio-capture', 'failure:microphone:missing'],
      ['network', 'failure:service:network'],
      ['language-not-supported', 'failure:service:language'],
    ] as const) {
      const { capture } = setup();
      const { log, handlers } = recorder();
      capture.listen(handlers);
      const rec = env.recognition.latest();
      rec.open();
      rec.fail(code);
      rec.close();
      expect(log).toEqual([expected]);
      env.uninstall();
    }
  });

  it('finishes early on request: the words so far are delivered when the browser reports them', () => {
    const { capture } = setup();
    const { log, handlers } = recorder();
    const pass = capture.listen(handlers);
    const rec = env.recognition.latest();
    rec.open();
    rec.speechStart();
    rec.say('I will check', false);
    pass.finish();
    expect(rec.stops).toBe(1);
    expect(log).toEqual(['start', 'interim:I will check', 'end:stopped']);
    rec.say('I will check', true);
    expect(log.at(-1)).toBe('text:I will check');
  });

  it('finishes with nothing when nothing was heard, and aborts the browser session', () => {
    const { capture } = setup();
    const { log, handlers } = recorder();
    const pass = capture.listen(handlers);
    const rec = env.recognition.latest();
    pass.finish();
    expect(log).toEqual(['nothing']);
    expect(rec.aborts).toBe(1);
  });

  it('gives up on the words if the browser never delivers them after speech ends', () => {
    const { capture } = setup();
    const { log, handlers } = recorder();
    capture.listen(handlers);
    const rec = env.recognition.latest();
    rec.open();
    rec.speechStart();
    rec.speechEnd();
    expect(log).toEqual(['start', 'end:silence']);
    vi.advanceTimersByTime(RESULT_WAIT_MS - 1);
    expect(log).toHaveLength(2);
    vi.advanceTimersByTime(2);
    expect(log).toEqual(['start', 'end:silence', 'failure:service:network']);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports nothing after a cancel, and detaches from the browser completely', () => {
    const { capture } = setup();
    const { log, handlers } = recorder();
    const pass = capture.listen(handlers);
    const rec = env.recognition.latest();
    rec.open();
    pass.cancel();
    rec.say('late', true);
    rec.fail('network');
    rec.close();
    expect(log).toEqual([]);
    expect(rec.aborts).toBe(1);
    expect(
      [
        rec.onstart,
        rec.onaudiostart,
        rec.onspeechstart,
        rec.onspeechend,
        rec.onresult,
        rec.onerror,
        rec.onend,
      ].every((handler) => handler === null),
    ).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps one pass at a time: a new pass silently ends the old one', () => {
    const { capture } = setup();
    const first = recorder();
    capture.listen(first.handlers);
    const old = env.recognition.latest();
    capture.listen(recorder().handlers);
    old.say('too late', true);
    expect(first.log).toEqual([]);
    expect(env.recognition.instances).toHaveLength(2);
  });

  describe('says when it is listening', () => {
    it('reports it once, when the browser starts to capture audio and not before', () => {
      const { capture } = setup();
      const { log, handlers } = recorder();
      capture.listen({ ...handlers, onListening: () => log.push('listening') });
      expect(log).toEqual([]);
      env.recognition.latest().open();
      env.recognition.latest().open();
      expect(log).toEqual(['listening']);
      env.recognition.latest().speechStart();
      expect(log).toEqual(['listening', 'start']);
    });

    it('reports it before the first words when the browser never says it started', () => {
      const { capture } = setup();
      const { log, handlers } = recorder();
      capture.listen({ ...handlers, onListening: () => log.push('listening') });
      env.recognition.latest().say('hello there', false);
      expect(log.slice(0, 2)).toEqual(['listening', 'start']);
    });

    it('does not report it for a pass that was cancelled, or after the pass ended', () => {
      const { capture } = setup();
      const { log, handlers } = recorder();
      const pass = capture.listen({ ...handlers, onListening: () => log.push('listening') });
      const rec = env.recognition.latest();
      pass.cancel();
      rec.open();
      expect(log).toEqual([]);
    });

    it('is optional: a caller that predates it still works', () => {
      const { capture } = setup();
      const { log, handlers } = recorder();
      capture.listen(handlers);
      env.recognition.latest().open();
      env.recognition.latest().say('hello there', true);
      expect(log).toContain('text:hello there');
    });
  });

  it('is unsupported without the browser feature', async () => {
    env = installFakes();
    const { handlers, log } = recorder();
    createRecognitionCapture({ language: () => 'en-GB' }).listen(handlers);
    await vi.advanceTimersByTimeAsync(0);
    expect(log).toEqual(['failure:microphone:unsupported']);
  });

  it('reports a failure when the browser cannot start a session', async () => {
    const { capture } = setup();
    env.recognition.startThrows = true;
    const { handlers, log } = recorder();
    capture.listen(handlers);
    await vi.advanceTimersByTimeAsync(0);
    expect(log).toEqual(['failure:service:unknown']);
  });
});

describe('on-device recognition', () => {
  it('uses it for a pass that starts after the browser said it is available, and says so', async () => {
    const { capture, modes } = setup();
    env.recognition.setOnDevice('available');
    capture.prepare();
    await vi.advanceTimersByTimeAsync(0);
    capture.listen(recorder().handlers);
    expect(env.recognition.latest().processLocally).toBe(true);
    expect(capture.mode()).toBe('on-device');
    expect(modes).toEqual(['on-device']);
  });

  it('never waits for the check: a pass that starts first uses the default engine', () => {
    const { capture, modes } = setup({ userAgent: 'Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36' });
    env.recognition.setOnDevice('available');
    capture.prepare();
    capture.listen(recorder().handlers);
    expect(env.recognition.latest().processLocally).not.toBe(true);
    expect(capture.mode()).toBe('browser-service');
    expect(modes).toEqual(['browser-service']);
  });

  it('falls back to the default engine, without a failure, when on-device recognition is refused', async () => {
    const { capture } = setup();
    env.recognition.setOnDevice('available');
    capture.prepare();
    await vi.advanceTimersByTimeAsync(0);
    const { log, handlers } = recorder();
    capture.listen(handlers);
    const refused = env.recognition.latest();
    refused.open();
    refused.fail('service-not-allowed');
    expect(log).toEqual([]);
    expect(env.recognition.instances).toHaveLength(2);
    expect(env.recognition.latest().processLocally).not.toBe(true);

    // It remembers: the next pass goes straight to the default engine.
    capture.listen(recorder().handlers);
    expect(env.recognition.latest().processLocally).not.toBe(true);
    expect(env.recognition.instances).toHaveLength(3);
  });
});
