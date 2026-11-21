// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/api.ts';
import type { VoiceFeatures } from '../voice/support.ts';
import { describeCustomer, describeSpeechSetup } from './speech-setup.ts';
import { describeStartFailure } from './start-failure.ts';
import { AZURE_SPEECH, DEMO_SPEECH, NO_SPEECH } from './testing/fixtures.ts';
import { newRequestId, timeOfDayFor } from './use-start-call.ts';

afterEach(() => vi.unstubAllGlobals());

const BROWSER: VoiceFeatures = {
  secureContext: true,
  microphone: true,
  audioContext: true,
  worklet: true,
  recognition: true,
  synthesis: true,
  audioElement: true,
};

describe('describeSpeechSetup', () => {
  it('uses the server for speech to text and for the customer\u2019s voice when it can', () => {
    expect(describeSpeechSetup(AZURE_SPEECH, BROWSER)).toEqual({
      capture: 'server-speech',
      playback: 'server-speech',
      canSpeak: true,
      typedBecause: null,
      notice: null,
    });
  });

  it('falls back to the browser for both when the server does neither', () => {
    expect(describeSpeechSetup(NO_SPEECH, BROWSER)).toMatchObject({
      capture: 'browser-recognition',
      playback: 'browser-synthesis',
      canSpeak: true,
    });
  });

  it('listens with the browser when the server can transcribe but this browser cannot record for it', () => {
    expect(describeSpeechSetup(AZURE_SPEECH, { ...BROWSER, worklet: false })).toMatchObject({
      capture: 'browser-recognition',
      playback: 'server-speech',
    });
  });

  it('is typed only when nothing can listen, and the customer is read on screen when nothing can speak', () => {
    expect(
      describeSpeechSetup(NO_SPEECH, { ...BROWSER, recognition: false, synthesis: false }),
    ).toMatchObject({
      canSpeak: false,
      capture: 'none',
      playback: 'none',
      typedBecause: 'unsupported',
    });
  });

  it('says that a page which is not secure is why there is no voice', () => {
    expect(describeSpeechSetup(AZURE_SPEECH, { ...BROWSER, secureContext: false })).toMatchObject({
      canSpeak: false,
      typedBecause: 'insecure',
    });
  });

  it('treats the demo speech service as one that listens and plays through the server', () => {
    expect(describeSpeechSetup(DEMO_SPEECH, BROWSER)).toMatchObject({
      capture: 'server-speech',
      playback: 'server-speech',
    });
  });

  it('passes on what the server says is wrong', () => {
    expect(
      describeSpeechSetup({ ...NO_SPEECH, notice: 'Not fully configured.' }, BROWSER).notice,
    ).toBe('Not fully configured.');
    expect(describeSpeechSetup(NO_SPEECH, BROWSER).notice).toBeNull();
  });
});

describe('describeCustomer', () => {
  it('names the built-in rules engine in demo mode, and the model when it is live', () => {
    expect(describeCustomer({ kind: 'mock', label: 'x', demo: true, notice: null })).toBe(
      "Demo mode: the customer is played by Firefly's built-in rules engine.",
    );
    expect(
      describeCustomer({
        kind: 'azure-openai',
        label: 'Azure OpenAI (gpt-4.1)',
        demo: false,
        notice: null,
      }),
    ).toContain('Live model: Azure OpenAI (gpt-4.1).');
  });
});

describe('describeStartFailure', () => {
  const api = (status: number, code: string, retryable = true) =>
    new ApiError(status, code, 'Server words.', retryable);

  it('says what happened, that nothing was started, and what to do', () => {
    for (const error of [
      api(0, 'network'),
      api(429, 'rate_limited'),
      api(404, 'not_found', false),
      api(400, 'validation_failed', false),
      api(500, 'internal'),
      new Error('boom'),
    ]) {
      const failure = describeStartFailure(error, true);
      expect(failure.title).toMatch(/\.$/);
      expect(failure.detail).toMatch(/Nothing was started\./);
    }
  });

  it('puts being offline first, and always allows a retry', () => {
    const failure = describeStartFailure(api(0, 'network'), false);
    expect(failure.title).toBe('You are offline.');
    expect(failure.retryable).toBe(true);
  });

  it('promises that a retry cannot start two calls after a timeout', () => {
    const failure = describeStartFailure(api(0, 'timeout'), true);
    expect(failure.detail).toContain('will not create a second call');
    expect(failure.retryable).toBe(true);
  });

  it('does not offer a retry for a scenario that is gone or settings that were refused', () => {
    expect(describeStartFailure(api(404, 'not_found', false), true).retryable).toBe(false);
    expect(describeStartFailure(api(400, 'validation_failed', false), true).retryable).toBe(false);
  });

  it('keeps the server\u2019s own safe message for anything else', () => {
    expect(describeStartFailure(api(503, 'provider_unavailable'), true).detail).toContain(
      'Server words.',
    );
  });
});

describe('timeOfDayFor', () => {
  const at = (hour: number, minute = 0) => timeOfDayFor(new Date(2026, 10, 21, hour, minute));

  it('is morning before 12:00, afternoon from 12:00 to 17:59 and evening from 18:00', () => {
    expect([at(0), at(5, 30), at(11, 59)]).toEqual(['morning', 'morning', 'morning']);
    expect([at(12), at(15, 45), at(17, 59)]).toEqual(['afternoon', 'afternoon', 'afternoon']);
    expect([at(18), at(21, 10), at(23, 59)]).toEqual(['evening', 'evening', 'evening']);
  });

  it('reads the clock it is given, not the machine\u2019s locale', () => {
    expect(timeOfDayFor(new Date(2026, 0, 1, 9))).toBe('morning');
  });
});

describe('newRequestId', () => {
  const pattern = /^[A-Za-z0-9_-]{8,64}$/;

  it('makes an id the server accepts, and a different one each time', () => {
    const ids = new Set(Array.from({ length: 20 }, () => newRequestId()));
    expect(ids.size).toBe(20);
    for (const id of ids) expect(id).toMatch(pattern);
  });

  it('still works where randomUUID is missing (a page that is not secure)', () => {
    vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => bytes.fill(171) });
    expect(newRequestId()).toMatch(pattern);
  });

  it('and where there is no crypto at all', () => {
    vi.stubGlobal('crypto', undefined);
    expect(newRequestId()).toMatch(pattern);
  });
});
