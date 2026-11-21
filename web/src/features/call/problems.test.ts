import { describe, expect, it } from 'vitest';
import { voiceError, type VoiceErrorCode } from '../voice/errors.ts';
import type { CallProblem, CallProblemCode } from './contract.ts';
import { describeProblem, PROBLEM_CODES, type ProblemContext } from './problems.ts';

// Every code in the contract, written out so that adding one without copy fails here.
const CONTRACT_CODES: Record<CallProblemCode, true> = {
  'microphone-denied': true,
  'microphone-missing': true,
  'microphone-busy': true,
  'microphone-unsupported': true,
  'transcription-failed': true,
  'speech-service-unavailable': true,
  'reply-failed': true,
  'reply-timeout': true,
  'voice-generation-failed': true,
  'playback-blocked': true,
  'playback-failed': true,
  offline: true,
  'session-unavailable': true,
  'session-ended': true,
  'save-failed': true,
  'turn-limit': true,
  'rate-limited': true,
  'end-failed': true,
};

const CONTEXTS: ProblemContext[] = [
  {},
  { browser: 'edge', beforeCall: true },
  { browser: 'chrome' },
  { browser: 'firefox', beforeCall: true, timedOut: true },
  { saved: true },
  { during: 'send' },
  { during: 'transcribe' },
  { during: 'speak' },
  { during: 'end' },
  { during: 'load' },
  { during: 'microphone' },
  { retryAfterSeconds: 1 },
  { retryAfterSeconds: 7, during: 'transcribe' },
  { nothingToReview: true },
  { notFound: true, during: 'load' },
];

const SENTENCES = /[.!?](?=\s|$)/g;

function everyCopy(): Array<{ code: CallProblemCode; context: ProblemContext; copy: CallProblem }> {
  return PROBLEM_CODES.flatMap((code) =>
    CONTEXTS.map((context) => ({ code, context, copy: describeProblem(code, context) })),
  );
}

describe('describeProblem', () => {
  it('has copy for every code in the contract, and nothing else', () => {
    expect([...PROBLEM_CODES].sort()).toEqual(Object.keys(CONTRACT_CODES).sort());
  });

  it('sets every field for every code in every context', () => {
    for (const { code, context, copy } of everyCopy()) {
      const label = `${code} ${JSON.stringify(context)}`;
      expect(copy.code, label).toBe(code);
      for (const field of ['title', 'preserved', 'advice'] as const) {
        expect(typeof copy[field], `${label} ${field}`).toBe('string');
        expect(copy[field].trim().length, `${label} ${field}`).toBeGreaterThan(8);
        expect(copy[field], `${label} ${field}`).toMatch(/[.]$/);
      }
      expect(['microphone', 'transcribe', 'send', 'speak', 'load', 'end', null]).toContain(
        copy.retry,
      );
      expect(typeof copy.textFallback, label).toBe('boolean');
      expect(['blocking', 'degraded'], label).toContain(copy.severity);
    }
  });

  it('says what happened in one short sentence', () => {
    for (const { code, context, copy } of everyCopy()) {
      const label = `${code} ${JSON.stringify(context)}: ${copy.title}`;
      expect(copy.title.length, label).toBeLessThanOrEqual(70);
      expect(copy.title.match(SENTENCES)?.length, label).toBe(1);
    }
  });

  it('is plain British English: no raw provider text, codes, jargon, exclamations or blame', () => {
    const banned = [
      /error code/i,
      /exception/i,
      /stack/i,
      /\bundefined\b/,
      /\bnull\b/,
      /\bHTTP\b/,
      /\bAPI\b/,
      /\bstatus\b/i,
      /\b[45]\d\d\b/,
      /!/,
      /\p{Extended_Pictographic}/u,
      // Never blames the trainee.
      /\byou (?:failed|did not|didn't|forgot|should have|must have|need to learn)\b/i,
      /\byour (?:fault|mistake)\b/i,
      /\binvalid\b/i,
      // American spellings.
      /\b(?:color|recognize|organize|behavior|center|favorite|authorize|analyze)\b/i,
    ];
    for (const { code, copy } of everyCopy()) {
      const text = `${copy.title} ${copy.preserved} ${copy.advice}`;
      for (const pattern of banned) expect(text, `${code}: ${pattern}`).not.toMatch(pattern);
    }
  });

  it('is consistent: a retry only where one can help, and typing only where it still works', () => {
    for (const { code, copy } of everyCopy()) {
      // Where there is something to retry, the advice names how: Retry, Try again, or Replay for a voice.
      if (copy.retry === 'speak') expect(copy.advice, code).toMatch(/Replay|try again/i);
      else if (copy.retry !== null) expect(copy.advice, code).toMatch(/retry|try again/i);
      if (copy.retry === null) expect(copy.advice, code).not.toMatch(/retry|try again/i);
      if (copy.textFallback) {
        // A problem that leaves typing working never says it stops everything.
        expect(copy.advice + copy.preserved, code).not.toMatch(/cannot continue|can't continue/i);
      }
    }
    // The ones that stop the conversation until handled cannot be typed past.
    for (const code of [
      'reply-failed',
      'reply-timeout',
      'save-failed',
      'turn-limit',
      'session-ended',
    ] as const) {
      expect(describeProblem(code).textFallback, code).toBe(false);
      expect(describeProblem(code).severity, code).toBe('blocking');
    }
    // The ones that lose only a voice feature keep the call usable.
    for (const code of [
      'transcription-failed',
      'speech-service-unavailable',
      'voice-generation-failed',
      'playback-blocked',
      'playback-failed',
    ] as const) {
      expect(describeProblem(code).textFallback, code).toBe(true);
      expect(describeProblem(code).severity, code).toBe('degraded');
    }
  });

  it('keeps every line short, because the buttons say what can be done', () => {
    const words = (text: string) => text.split(/\s+/).filter(Boolean).length;
    for (const { code, context, copy } of everyCopy()) {
      const label = `${code} ${JSON.stringify(context)}`;
      expect(words(copy.title), `${label} title`).toBeLessThanOrEqual(12);
      expect(words(copy.preserved), `${label} preserved`).toBeLessThanOrEqual(10);
      // Allowing a blocked microphone is the one piece of advice with real steps in it.
      const limit = code === 'microphone-denied' ? 26 : 16;
      expect(words(copy.advice), `${label} advice`).toBeLessThanOrEqual(limit);
    }
  });

  it('tells the trainee how to allow a blocked microphone in their browser', () => {
    const edge = describeProblem('microphone-denied', { browser: 'edge' });
    expect(edge.advice).toMatch(/lock icon in the address bar/);
    expect(edge.advice).toMatch(/Permissions for this site/);
    expect(edge.advice).toMatch(/Microphone to Allow/);
    const chrome = describeProblem('microphone-denied', { browser: 'chrome' });
    expect(chrome.advice).toMatch(/left of the address bar/);
    expect(chrome.advice).toMatch(/turn on Microphone/);
    for (const copy of [edge, chrome]) expect(copy.advice).toMatch(/choose Retry/);
    // Any other browser gets the voice layer's own sentence: the steps depend on the browser.
    const other = describeProblem('microphone-denied', { browser: 'safari' });
    expect(other.advice).toBe(voiceError('microphone-denied').advice);
    for (const copy of [edge, chrome, other]) {
      expect(copy.retry).toBe('microphone');
      expect(copy.textFallback).toBe(true);
    }
  });

  it('says what happened in the voice layer’s own words, so a failure reads the same everywhere', () => {
    const same: Array<[CallProblemCode, VoiceErrorCode, ProblemContext?]> = [
      ['microphone-denied', 'microphone-denied'],
      ['microphone-missing', 'microphone-missing'],
      ['microphone-busy', 'microphone-busy'],
      ['microphone-unsupported', 'microphone-unsupported'],
      ['transcription-failed', 'transcription-failed'],
      ['transcription-failed', 'transcription-timeout', { timedOut: true }],
      ['speech-service-unavailable', 'speech-unavailable'],
      ['voice-generation-failed', 'voice-failed'],
      ['voice-generation-failed', 'voice-timeout', { timedOut: true }],
      ['playback-blocked', 'playback-blocked'],
      ['playback-failed', 'playback-failed'],
      ['offline', 'offline', { during: 'transcribe' }],
    ];
    for (const [code, voice, context = {}] of same) {
      const copy = describeProblem(code, { browser: 'firefox', ...context });
      const error = voiceError(voice);
      expect(copy.title, `${code}/${voice}`).toBe(error.message);
      expect(copy.preserved, `${code}/${voice}`).toBe(error.kept);
      expect(copy.advice, `${code}/${voice}`).toBe(error.advice);
    }
    // The customer's voice, not speech to text, lost the network.
    const spoken = describeProblem('offline', { during: 'speak' });
    expect(spoken.title).toBe(voiceError('offline', { stage: 'voice' }).message);
    expect(spoken).toMatchObject({ retry: 'speak', textFallback: true, severity: 'degraded' });
    // Too many speech requests: the voice layer's sentence, with the wait added by this screen.
    const limited = describeProblem('rate-limited', { during: 'transcribe', retryAfterSeconds: 4 });
    expect(limited.title).toBe(voiceError('rate-limited', { stage: 'transcription' }).message);
    expect(limited.preserved).toBe(voiceError('rate-limited', { stage: 'transcription' }).kept);
    expect(limited.advice).toBe('Wait 4 seconds, then choose Retry, or type your reply.');
    expect(limited).toMatchObject({
      retry: 'transcribe',
      textFallback: true,
      severity: 'degraded',
    });
  });

  it('offers what the voice layer offers: Retry only where trying again can help, and typing always', () => {
    const offers: Array<[CallProblemCode, VoiceErrorCode]> = [
      ['microphone-denied', 'microphone-denied'],
      ['microphone-unsupported', 'microphone-unsupported'],
      ['transcription-failed', 'transcription-failed'],
      ['speech-service-unavailable', 'speech-unavailable'],
      ['voice-generation-failed', 'voice-failed'],
      ['playback-blocked', 'playback-blocked'],
    ];
    for (const [code, voice] of offers) {
      const copy = describeProblem(code);
      const error = voiceError(voice);
      expect(copy.retry !== null, code).toBe(error.retryable);
      expect(copy.textFallback, code).toBe(error.textFallback);
    }
  });

  it('is said assertively only when it stops the trainee being heard: the microphone', () => {
    for (const code of PROBLEM_CODES) {
      const expected = code.startsWith('microphone-') ? 'assertive' : 'polite';
      expect(describeProblem(code).announce, code).toBe(expected);
    }
  });

  it('changes what was kept, and what Retry does, with where the problem happened', () => {
    expect(describeProblem('microphone-missing', { beforeCall: true }).preserved).toBe(
      'Nothing was recorded.',
    );
    expect(describeProblem('microphone-missing').preserved).toBe(
      'Your call and its transcript are safe.',
    );
    expect(describeProblem('reply-failed', { saved: true }).preserved).toBe(
      'Your message was saved.',
    );
    expect(describeProblem('reply-failed').preserved).toBe('Your message is kept.');

    const send = describeProblem('offline', { during: 'send' });
    expect(send).toMatchObject({ retry: 'send' });
    expect(send.advice).toMatch(/never twice/);
    expect(describeProblem('offline', { during: 'transcribe' })).toMatchObject({
      retry: 'transcribe',
    });
    expect(describeProblem('offline', { during: 'load' })).toMatchObject({ retry: 'load' });
    expect(describeProblem('offline', { during: 'end' })).toMatchObject({ retry: 'end' });
    expect(describeProblem('offline', { during: 'speak' })).toMatchObject({ retry: 'speak' });
    expect(describeProblem('offline')).toMatchObject({ retry: 'send' });
    // A call that could not be ended is still open, so being offline there does not block it.
    expect(describeProblem('offline', { during: 'end' }).severity).toBe('degraded');
    expect(describeProblem('offline', { during: 'send' }).severity).toBe('blocking');

    expect(describeProblem('transcription-failed', { timedOut: true }).title).toMatch(
      /took too long/,
    );
    expect(describeProblem('microphone-busy', { timedOut: true }).title).toMatch(/did not respond/);
  });

  it('says how long to wait when the server said so', () => {
    expect(describeProblem('rate-limited', { retryAfterSeconds: 1 }).advice).toMatch(
      /Wait 1 second,/,
    );
    expect(describeProblem('rate-limited', { retryAfterSeconds: 4.2 }).advice).toMatch(
      /Wait 5 seconds,/,
    );
    expect(describeProblem('rate-limited').advice).toMatch(/Wait a moment,/);
    expect(describeProblem('rate-limited', { during: 'transcribe' })).toMatchObject({
      retry: 'transcribe',
      severity: 'degraded',
      textFallback: true,
    });
    expect(
      describeProblem('rate-limited', { during: 'transcribe', retryAfterSeconds: 2 }).advice,
    ).toMatch(/Wait 2 seconds, then choose Retry/);
    expect(describeProblem('rate-limited')).toMatchObject({ retry: 'send', severity: 'blocking' });
  });

  it('explains ending a call that has nothing to review, with no Try again', () => {
    const copy = describeProblem('end-failed', { nothingToReview: true });
    expect(copy.title).toBe('There is nothing to review yet.');
    expect(copy.retry).toBeNull();
    const failed = describeProblem('end-failed');
    expect(failed.retry).toBe('end');
    expect(failed.preserved).toMatch(/still open/);
  });
});
