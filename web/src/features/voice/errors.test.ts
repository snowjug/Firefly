import { describe, expect, it } from 'vitest';
import { ApiError } from '../../lib/api.ts';
import {
  apiError,
  captureError,
  isUsableTranscript,
  microphoneError,
  noSpeechError,
  playbackError,
  poorTranscriptionError,
  VOICE_ERROR_CODES,
  voiceError,
  type VoiceError,
  type VoiceErrorCode,
} from './errors.ts';

const timeout = () => new DOMException('Timed out.', 'TimeoutError');
const api = (status: number, code: string, details?: unknown) =>
  new ApiError(status, code, 'The server said something specific.', status >= 500, details);

// Plain language: no code, no numbers, no technical vocabulary, nothing a provider could have said.
const TECHNICAL =
  /\b(http|https|status|exception|stack|undefined|null|nan|ssml|wav|json|api|token|key|azure|error:)\b|[{}<>`]|\d/i;

describe('voice errors', () => {
  it.each(VOICE_ERROR_CODES)('%s is a plain, complete, recoverable error', (code) => {
    const error = voiceError(code);
    expect(error.code).toBe(code);
    for (const sentence of [error.message, error.kept, error.advice]) {
      expect(sentence).toMatch(/^[A-Z].*[.]$/);
      expect(sentence).not.toMatch(TECHNICAL);
    }
    // Something to offer, always typing, and retry data that agrees with what is offered.
    expect(error.recovery.length).toBeGreaterThan(0);
    expect(error.textFallback).toBe(true);
    const offersRetry = error.recovery.includes('retry') || error.recovery.includes('replay');
    expect(error.retryable).toBe(offersRetry);
    expect(error.retryAction !== null).toBe(offersRetry);
    expect(['assertive', 'polite']).toContain(error.announce);
  });

  it('only ever offers the four recoveries, never duplicated', () => {
    const allowed = new Set(['retry', 'use-text', 'replay', 'continue-without-audio']);
    for (const code of VOICE_ERROR_CODES) {
      const { recovery } = voiceError(code);
      expect(new Set(recovery).size).toBe(recovery.length);
      for (const action of recovery) expect(allowed.has(action)).toBe(true);
    }
  });

  it('offers a way to carry on typed wherever the microphone or the transcription failed', () => {
    for (const code of VOICE_ERROR_CODES) {
      const error = voiceError(code);
      if (error.stage === 'microphone' || error.stage === 'transcription') {
        expect(error.recovery).toContain('use-text');
      }
    }
  });

  it("keeps the customer's words in view when the customer's voice fails", () => {
    for (const code of [
      'voice-timeout',
      'voice-failed',
      'playback-blocked',
      'playback-failed',
    ] as const) {
      const error = voiceError(code);
      expect(error.recovery).toContain('continue-without-audio');
      expect(error.kept).toMatch(/transcript/);
      expect(error.announce).toBe('polite');
    }
  });

  it('announces assertively only what stops the trainee being heard', () => {
    const assertive = VOICE_ERROR_CODES.filter((code) => voiceError(code).announce === 'assertive');
    expect(assertive.sort()).toEqual(
      [
        'microphone-denied',
        'microphone-missing',
        'microphone-busy',
        'microphone-unsupported',
      ].sort(),
    );
  });

  describe('where each failure comes from', () => {
    it('maps every way the microphone fails', () => {
      expect(microphoneError('denied')).toMatchObject({
        code: 'microphone-denied',
        stage: 'microphone',
        recovery: ['retry', 'use-text'],
        retryAction: 'open-microphone',
      });
      expect(microphoneError('missing').code).toBe('microphone-missing');
      expect(microphoneError('busy').code).toBe('microphone-busy');
      // Nothing to retry: the browser cannot do it at all.
      expect(microphoneError('unsupported')).toMatchObject({
        code: 'microphone-unsupported',
        recovery: ['use-text'],
        retryAction: null,
        retryable: false,
      });
    });

    it('maps a failed listening pass by what failed', () => {
      expect(captureError({ kind: 'microphone', reason: 'denied' }).code).toBe('microphone-denied');
      expect(captureError({ kind: 'service', reason: 'network' }).code).toBe('offline');
      expect(captureError({ kind: 'service', reason: 'language' }).code).toBe('speech-unavailable');
      expect(captureError({ kind: 'service', reason: 'unknown' }).code).toBe(
        'transcription-failed',
      );
    });

    it('maps an empty recording and an unusable transcript', () => {
      expect(noSpeechError()).toMatchObject({ code: 'no-speech', retryAction: 'record-again' });
      expect(poorTranscriptionError()).toMatchObject({
        code: 'poor-transcription',
        retryAction: 'record-again',
      });
    });

    it('maps a time-out to the stage that timed out', () => {
      expect(apiError(timeout(), 'transcription')).toMatchObject({
        code: 'transcription-timeout',
        stage: 'transcription',
        retryAction: 'resend-recording',
      });
      expect(apiError(timeout(), 'voice')).toMatchObject({
        code: 'voice-timeout',
        stage: 'voice',
        retryAction: 'regenerate-voice',
      });
      expect(apiError(api(504, 'speech_timeout'), 'voice').code).toBe('voice-timeout');
      expect(apiError(api(504, 'speech_timeout'), 'transcription').code).toBe(
        'transcription-timeout',
      );
    });

    it('maps losing the network in the words of the stage it hit', () => {
      const lost = new ApiError(0, 'network', "Can't reach Firefly right now.", true);
      expect(apiError(lost, 'transcription')).toMatchObject({
        code: 'offline',
        message: 'Firefly could not reach the speech service.',
        recovery: ['retry', 'use-text'],
      });
      expect(apiError(lost, 'voice')).toMatchObject({
        code: 'offline',
        message: "Firefly could not reach the customer's voice.",
        recovery: ['retry', 'continue-without-audio'],
        retryAction: 'regenerate-voice',
      });
    });

    it('maps a speech service that is off or not set up to "not available", with nothing to retry', () => {
      for (const code of ['speech_unavailable', 'provider_not_configured']) {
        const error = apiError(api(503, code), 'transcription');
        expect(error).toMatchObject({
          code: 'speech-unavailable',
          recovery: ['use-text'],
          retryAction: null,
          retryable: false,
        });
      }
      expect(apiError(api(503, 'speech_unavailable'), 'voice').recovery).toEqual([
        'continue-without-audio',
      ]);
    });

    it('maps rate limiting, and carries the wait the server named as a number', () => {
      expect(apiError(api(429, 'rate_limited', { retryAfterSeconds: 3.2 }), 'voice')).toMatchObject(
        {
          code: 'rate-limited',
          retryAfterSeconds: 4,
        },
      );
      const plain = apiError(api(429, 'speech_rate_limited'), 'transcription');
      expect(plain.code).toBe('rate-limited');
      expect(plain.retryAfterSeconds).toBeUndefined();
      // Rubbish in the details is ignored, not shown.
      const odd = apiError(api(429, 'rate_limited', { retryAfterSeconds: 'soon' }), 'voice');
      expect(odd.retryAfterSeconds).toBeUndefined();
      expect(
        apiError(api(429, 'rate_limited', { retryAfterSeconds: -4 }), 'voice'),
      ).not.toHaveProperty('retryAfterSeconds');
    });

    it('maps any other failure to the plain, retryable failure of its stage', () => {
      expect(apiError(api(502, 'speech_failed'), 'transcription').code).toBe(
        'transcription-failed',
      );
      expect(apiError(api(502, 'speech_failed'), 'voice').code).toBe('voice-failed');
      expect(apiError(new Error('boom'), 'transcription').code).toBe('transcription-failed');
      expect(apiError('weird', 'voice').code).toBe('voice-failed');
    });

    it('sends the recording again only while it is still held', () => {
      const failed = api(502, 'speech_failed');
      expect(apiError(failed, 'transcription', { recordingKept: true }).retryAction).toBe(
        'resend-recording',
      );
      // Nothing to send: the trainee speaks again.
      expect(apiError(failed, 'transcription', { recordingKept: false }).retryAction).toBe(
        'record-again',
      );
    });

    it("maps every way the customer's voice fails to playing, not typing", () => {
      expect(playbackError('generation').code).toBe('voice-failed');
      expect(playbackError('playback').code).toBe('playback-failed');
      expect(playbackError('blocked')).toMatchObject({
        code: 'playback-blocked',
        recovery: ['replay', 'continue-without-audio'],
        retryAction: 'replay-voice',
      });
    });
  });

  describe('what an error never carries', () => {
    const everything = (): VoiceError[] => {
      const out: VoiceError[] = VOICE_ERROR_CODES.map((code: VoiceErrorCode) => voiceError(code));
      const poisoned = new ApiError(
        502,
        'speech_failed',
        'Bearer sk-secret-123 said "my password is hunter2" at https://eastus.api.cognitive.microsoft.com',
        true,
        { transcript: 'my card is 4111 1111 1111 1111', retryAfterSeconds: 2 },
      );
      for (const stage of ['transcription', 'voice'] as const) out.push(apiError(poisoned, stage));
      return out;
    };

    it('has no audio, transcript, key, address or provider wording in it', () => {
      for (const error of everything()) {
        const text = JSON.stringify(error);
        expect(text).not.toMatch(/sk-secret|hunter2|4111|bearer|cognitive|https?:|eastus/i);
        for (const value of Object.values(error)) {
          expect(value).not.toBeInstanceOf(Blob);
          expect(value).not.toBeInstanceOf(Float32Array);
          expect(value).not.toBeInstanceOf(ArrayBuffer);
        }
      }
    });

    it('survives being sent as JSON and read back unchanged', () => {
      for (const error of everything()) expect(JSON.parse(JSON.stringify(error))).toEqual(error);
    });
  });
});

describe('isUsableTranscript', () => {
  it.each(['Hello there', 'I can help with that', "can't", 'ok', 'Yes'])('accepts %j', (text) => {
    expect(isUsableTranscript(text)).toBe(true);
  });

  it.each(['', '   ', 'uh', 'Um, er...', 'hmm mm', 'a', '1234', '...'])('rejects %j', (text) => {
    expect(isUsableTranscript(text)).toBe(false);
  });
});
