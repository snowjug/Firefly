import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createRecognitionCapture,
  mapRecognitionError,
  type RecognitionCapture,
} from './recognition.ts';
import { CAPTURE_TUNING } from './tuning.ts';
import type { CaptureHandlers } from './types.ts';
import { installFakes, type FakeEnv } from '../testing/fakes.ts';

// The browser's recogniser is faked here, and so are the timers: these tests show what the capture
// does with the events a browser is documented to send (a continuous session's results, speech
// start and end, sessions that end by themselves, errors). They say nothing about how real Chrome or
// Edge recognise real speech, or about the real timing of their sessions.

const ENDPOINT = CAPTURE_TUNING.endpointSilenceMs;
const RESTART = CAPTURE_TUNING.recognitionRestartMs;
const MIN_LIFE = CAPTURE_TUNING.recognitionMinLifeMs;
const MAX_FAILED = CAPTURE_TUNING.recognitionMaxFailedSessions;
const STOP_WAIT = CAPTURE_TUNING.recognitionStopWaitMs;
const LIMIT = CAPTURE_TUNING.maxUtteranceMs;

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
  it('listens continuously, with interim results, in the chosen language', () => {
    const { capture } = setup({}, 'en-IE');
    capture.listen(recorder().handlers);
    expect(env.recognition.latest()).toMatchObject({
      lang: 'en-IE',
      interimResults: true,
      continuous: true,
      maxAlternatives: 1,
    });
  });

  it('reports speech, the words as they grow, and then the whole turn once, after the trainee has been quiet', () => {
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
    // The browser thinks the sentence is over. The turn is not, until the trainee has been quiet.
    expect(log).toEqual(['start', 'interim:my order', 'interim:my order has not arrived']);
    vi.advanceTimersByTime(ENDPOINT - 1);
    expect(log).toHaveLength(3);
    vi.advanceTimersByTime(1);
    expect(log).toEqual([
      'start',
      'interim:my order',
      'interim:my order has not arrived',
      'end:silence',
      'text:my order has not arrived',
    ]);
    expect(rec.aborts).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not split a thought at a pause shorter than the end of a turn: one turn, one text', () => {
    const { capture } = setup();
    const { log, handlers } = recorder();
    capture.listen(handlers);
    const rec = env.recognition.latest();
    rec.open();
    // The recogniser calls the first sentence final at once, and the person goes on after a pause.
    rec.hear(['Yes, this is the account owner.']);
    vi.advanceTimersByTime(ENDPOINT - 100);
    expect(log.filter((line) => line.startsWith('text:'))).toEqual([]);
    rec.hear(['Yes, this is the account owner.'], ['what changed after the reset', false]);
    rec.hear(['Yes, this is the account owner.'], ['what changed after the reset']);
    vi.advanceTimersByTime(ENDPOINT);
    expect(log.filter((line) => line.startsWith('end:'))).toEqual(['end:silence']);
    expect(log.filter((line) => line.startsWith('text:'))).toEqual([
      'text:Yes, this is the account owner. what changed after the reset',
    ]);
  });

  it('starts the wait again when sound begins again, so a thought picked up late is not cut off', () => {
    const { capture } = setup();
    const { log, handlers } = recorder();
    capture.listen(handlers);
    const rec = env.recognition.latest();
    rec.hear(['I want to cancel.']);
    vi.advanceTimersByTime(ENDPOINT - 100);
    // The browser hears them start again, but has no words for it yet.
    rec.speechStart();
    vi.advanceTimersByTime(500);
    expect(log.filter((line) => line.startsWith('text:'))).toEqual([]);
    rec.hear(['I want to cancel.'], ['the plan as well']);
    vi.advanceTimersByTime(ENDPOINT);
    expect(log.at(-1)).toBe('text:I want to cancel. the plan as well');
  });

  it('ends the turn once after a longer pause, and what is heard after that is not part of it', () => {
    const { capture } = setup();
    const { log, handlers } = recorder();
    capture.listen(handlers);
    const rec = env.recognition.latest();
    rec.hear(['Please check my account.']);
    vi.advanceTimersByTime(ENDPOINT);
    expect(log).toEqual([
      'start',
      'interim:Please check my account.',
      'end:silence',
      'text:Please check my account.',
    ]);
    rec.hear(['Please check my account.'], ['and my invoice']);
    vi.advanceTimersByTime(ENDPOINT * 3);
    expect(log).toHaveLength(4);
  });

  it('delivers the finished sentences together with the words still being worked out', () => {
    const { capture } = setup();
    const { log, handlers } = recorder();
    capture.listen(handlers);
    env.recognition.latest().hear(['I have tried that twice.'], ['and it still fails', false]);
    expect(log.at(-1)).toBe('interim:I have tried that twice. and it still fails');
    vi.advanceTimersByTime(ENDPOINT);
    expect(log.slice(-2)).toEqual([
      'end:silence',
      'text:I have tried that twice. and it still fails',
    ]);
  });

  it('does not wait longer because the browser made up its mind about words it had already shown', () => {
    const { capture } = setup();
    const { log, handlers } = recorder();
    capture.listen(handlers);
    const rec = env.recognition.latest();
    rec.say('my order is late', false);
    vi.advanceTimersByTime(900);
    // The same words, now final and with capitals and a full stop: the person did not speak again.
    rec.say('My order is late.', true);
    vi.advanceTimersByTime(ENDPOINT - 900);
    expect(log.slice(-2)).toEqual(['end:silence', 'text:My order is late.']);
  });

  it('does not wait longer because the browser reports the end of the sound after the words stopped', () => {
    const { capture } = setup();
    const { log, handlers } = recorder();
    capture.listen(handlers);
    const rec = env.recognition.latest();
    rec.speechStart();
    rec.say('my order is late', false);
    vi.advanceTimersByTime(900);
    // The browser says the sound ended a moment after the words did. The wait for the end of the
    // turn is already running, and a signal that arrives later does not start it afresh.
    rec.speechEnd();
    vi.advanceTimersByTime(ENDPOINT - 900);
    expect(log.slice(-2)).toEqual(['end:silence', 'text:my order is late']);
  });

  it('still starts the wait again when sound begins again, however long into the wait it does', () => {
    const { capture } = setup();
    const { log, handlers } = recorder();
    capture.listen(handlers);
    const rec = env.recognition.latest();
    rec.speechStart();
    rec.say('my order is late', false);
    vi.advanceTimersByTime(900);
    rec.speechEnd();
    rec.speechStart();
    vi.advanceTimersByTime(ENDPOINT - 900);
    expect(log.some((line) => line.startsWith('text:'))).toBe(false);
    vi.advanceTimersByTime(900);
    expect(log.at(-1)).toBe('text:my order is late');
  });

  it('delivers a number as a turn: browsers write spoken numbers as digits, and a digit is a word', () => {
    for (const spoken of ['4729', '5', 'A1']) {
      const { capture } = setup();
      const { log, handlers } = recorder();
      capture.listen(handlers);
      const rec = env.recognition.latest();
      rec.open();
      rec.speechStart();
      rec.say(spoken, true);
      vi.advanceTimersByTime(ENDPOINT);
      expect(log, spoken).toEqual(['start', `interim:${spoken}`, 'end:silence', `text:${spoken}`]);
      env.uninstall();
    }
  });

  it('still reports the start of speech when the browser skips its own speech events', () => {
    const { capture } = setup();
    const { log, handlers } = recorder();
    capture.listen(handlers);
    const rec = env.recognition.latest();
    rec.open();
    rec.say('hello there', false);
    rec.say('hello there', true);
    vi.advanceTimersByTime(ENDPOINT);
    expect(log).toEqual(['start', 'interim:hello there', 'end:silence', 'text:hello there']);
  });

  // What real browsers did when they could not make anything of clean speech, recorded with Edge 158
  // and Chrome 157 (both were given a seven second synthetic utterance through a fake microphone),
  // when each listened for one sentence at a time. The browser itself gave up on speech it had
  // heard, so this is speech that gave no words: the pass ends, and the call can say so and count it.
  describe('when the browser could not make anything of the speech', () => {
    it('Edge: a single final result with an empty transcript is never an empty message, and ends the pass at once', () => {
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
      expect(log).toEqual(['start', 'end:silence', 'nothing']);
      expect(rec.aborts).toBe(1);
      // The session end that follows, and any late result, change nothing, and no timer is left.
      rec.close();
      rec.say('late', true);
      vi.advanceTimersByTime(ENDPOINT * 2);
      expect(log).toHaveLength(3);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('Chrome: a session that ends after the speech with no result and no error is speech that gave no words', () => {
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
      expect(env.recognition.instances).toHaveLength(1);
    });

    it('a session that ends with no sound at all is not that: it is started again, and nothing is said', () => {
      const { capture } = setup();
      const { log, handlers } = recorder();
      capture.listen(handlers);
      env.recognition.latest().open();
      env.recognition.latest().close();
      vi.advanceTimersByTime(RESTART);
      expect(log).toEqual([]);
      expect(env.recognition.instances).toHaveLength(2);
    });

    it('a session that ends after a sound that was already let go of as not a turn is only started again', () => {
      const { capture } = setup();
      const { log, handlers } = recorder();
      capture.listen(handlers);
      const rec = env.recognition.latest();
      rec.speechStart();
      vi.advanceTimersByTime(ENDPOINT);
      expect(log).toEqual(['start', 'dropped']);
      rec.close();
      vi.advanceTimersByTime(RESTART);
      expect(log).toEqual(['start', 'dropped']);
      expect(env.recognition.latest().running).toBe(true);
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

    it('a missing result list is ignored, and the pass listens on', () => {
      const { capture } = setup();
      const { log, handlers } = recorder();
      capture.listen(handlers);
      const rec = env.recognition.latest();
      rec.open();
      expect(() => rec.onresult?.({ resultIndex: 0 })).not.toThrow();
      vi.advanceTimersByTime(ENDPOINT * 2);
      expect(log).toEqual([]);
      expect(rec.running).toBe(true);
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
      vi.advanceTimersByTime(ENDPOINT);
      expect(log).toEqual(['start', 'interim:hello there', 'end:silence', 'text:hello there']);
    });
  });

  describe('sound that is not a turn', () => {
    it('is dropped when it gave no words: nothing is sent, and the pass listens on for the real turn', () => {
      const { capture } = setup();
      const { log, handlers } = recorder();
      capture.listen(handlers);
      const rec = env.recognition.latest();
      rec.open();
      rec.speechStart();
      rec.speechEnd();
      vi.advanceTimersByTime(ENDPOINT);
      expect(log).toEqual(['start', 'dropped']);
      expect(rec.running).toBe(true);
      // A real turn after it is reported, from the start.
      rec.speechStart();
      rec.say('hello there', false);
      vi.advanceTimersByTime(ENDPOINT);
      expect(log.slice(2)).toEqual([
        'start',
        'interim:hello there',
        'end:silence',
        'text:hello there',
      ]);
    });

    it('is dropped when it was only a "hmm", and does not become the start of the next turn', () => {
      const { capture } = setup();
      const { log, handlers } = recorder();
      capture.listen(handlers);
      const rec = env.recognition.latest();
      rec.hear(['hmm', false]);
      vi.advanceTimersByTime(ENDPOINT);
      // The caption is cleared too, so a word that was not a turn does not stay on the screen.
      expect(log).toEqual(['start', 'interim:hmm', 'interim:', 'dropped']);
      // The browser still lists it in every later report; the turn that follows leaves it out.
      rec.hear(['hmm'], ['I want a refund', false]);
      vi.advanceTimersByTime(ENDPOINT);
      expect(log.at(-1)).toBe('text:I want a refund');
    });

    it('does not swallow the next sentence when the dropped "hmm" was still being worked out and then grows in the same place', () => {
      const { capture } = setup();
      const { log, handlers } = recorder();
      capture.listen(handlers);
      const rec = env.recognition.latest();
      rec.hear(['hmm', false]);
      vi.advanceTimersByTime(ENDPOINT);
      expect(log).toEqual(['start', 'interim:hmm', 'interim:', 'dropped']);
      // The browser goes on with the same result: what comes after the dropped word is the turn.
      rec.hear(['hmm I want a refund please', false]);
      expect(log.slice(4)).toEqual(['start', 'interim:I want a refund please']);
      vi.advanceTimersByTime(ENDPOINT);
      expect(log.slice(-2)).toEqual(['end:silence', 'text:I want a refund please']);
    });

    it('leaves the dropped words off however the browser writes them again: capitals, punctuation, spacing', () => {
      const { capture } = setup();
      const { log, handlers } = recorder();
      capture.listen(handlers);
      const rec = env.recognition.latest();
      rec.hear(['Hmm.', false]);
      vi.advanceTimersByTime(ENDPOINT);
      expect(log.at(-1)).toBe('dropped');
      rec.hear(['hmm,   I want a refund', false]);
      rec.hear(['Hmm, I want a refund.', true]);
      vi.advanceTimersByTime(ENDPOINT);
      expect(log.slice(-2)).toEqual(['end:silence', 'text:I want a refund.']);
    });

    it('keeps everything the browser says when it changes its mind about the words that were dropped', () => {
      const { capture } = setup();
      const { log, handlers } = recorder();
      capture.listen(handlers);
      const rec = env.recognition.latest();
      rec.hear(['hmm', false]);
      vi.advanceTimersByTime(ENDPOINT);
      expect(log.at(-1)).toBe('dropped');
      rec.hear(['him and I want a refund', false]);
      vi.advanceTimersByTime(ENDPOINT);
      expect(log.slice(-2)).toEqual(['end:silence', 'text:him and I want a refund']);
    });

    it('skips a dropped result that was already final by its place, not by its words: the same word said again is kept', () => {
      const { capture } = setup();
      const { log, handlers } = recorder();
      capture.listen(handlers);
      const rec = env.recognition.latest();
      rec.hear(['hmm.']);
      vi.advanceTimersByTime(ENDPOINT);
      expect(log.at(-1)).toBe('dropped');
      rec.hear(['hmm.'], ['hmm that was the plan', false]);
      vi.advanceTimersByTime(ENDPOINT);
      expect(log.slice(-2)).toEqual(['end:silence', 'text:hmm that was the plan']);
    });
  });

  describe('errors', () => {
    it('reports a refusal, a missing microphone, a language it cannot do and an unknown error as failures at once, and lets go', () => {
      for (const [code, expected] of [
        ['not-allowed', 'failure:microphone:denied'],
        ['service-not-allowed', 'failure:microphone:denied'],
        ['audio-capture', 'failure:microphone:missing'],
        ['language-not-supported', 'failure:service:language'],
        ['bad-grammar', 'failure:service:unknown'],
      ] as const) {
        const { capture } = setup();
        const { log, handlers } = recorder();
        capture.listen(handlers);
        const rec = env.recognition.latest();
        rec.open();
        rec.fail(code);
        rec.close();
        expect(log, code).toEqual([expected]);
        expect(rec.aborts, code).toBe(1);
        expect(vi.getTimerCount(), code).toBe(0);
        env.uninstall();
      }
    });

    it('treats one network error as a hiccup: the session is started again and nothing is reported', () => {
      const { capture } = setup();
      const { log, handlers } = recorder();
      capture.listen(handlers);
      env.recognition.latest().open();
      env.recognition.latest().fail('network');
      env.recognition.latest().close();
      vi.advanceTimersByTime(RESTART);
      expect(log).toEqual([]);
      expect(env.recognition.instances).toHaveLength(2);
      expect(env.recognition.latest().running).toBe(true);
    });
  });

  // "Done speaking": the browser is asked to stop, not told to abandon the session, because a stopped
  // session hands back the words it had caught and not yet turned into text (an abandoned one
  // hands back nothing). The turn is delivered once the session answers, or a short wait is over.
  describe('finishing by hand', () => {
    /** The browser has shown "I'd like to cancel my" and has "subscription" caught but not shown. */
    function almostThere() {
      const { capture } = setup();
      const { log, handlers } = recorder();
      const pass = capture.listen(handlers);
      const rec = env.recognition.latest();
      rec.open();
      rec.speechStart();
      rec.say("I'd like to cancel my", false);
      return { pass, rec, log };
    }
    const SHOWN = ['start', "interim:I'd like to cancel my"];
    const turnEnds = (log: string[]) =>
      log.filter((line) => /^(end|text|nothing|failure)/.test(line));

    it('stops the session rather than abandoning it, and keeps the end of the sentence the browser hands back', () => {
      const { pass, rec, log } = almostThere();
      pass.finish();
      expect(rec.stops).toBe(1);
      expect(rec.aborts).toBe(0);
      // Nothing is delivered until the browser has answered: the end of the sentence is on its way.
      expect(log).toEqual(SHOWN);
      rec.say("I'd like to cancel my subscription", true);
      expect(turnEnds(log)).toEqual([]);
      rec.close();
      expect(log).toEqual([
        ...SHOWN,
        "interim:I'd like to cancel my subscription",
        'end:stopped',
        "text:I'd like to cancel my subscription",
      ]);
      // Only then is the finished session let go of, and nothing is left running.
      expect(rec.aborts).toBe(1);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('delivers what it holds, once, if the browser never answers, after a short wait and not before', () => {
      const { pass, rec, log } = almostThere();
      pass.finish();
      vi.advanceTimersByTime(STOP_WAIT - 1);
      expect(turnEnds(log)).toEqual([]);
      vi.advanceTimersByTime(1);
      expect(turnEnds(log)).toEqual(['end:stopped', "text:I'd like to cancel my"]);
      expect(rec.aborts).toBe(1);
      expect(vi.getTimerCount()).toBe(0);
      // A late answer from the browser, and all the time there is, add nothing.
      rec.say("I'd like to cancel my subscription", true);
      rec.close();
      vi.advanceTimersByTime(60_000);
      expect(turnEnds(log)).toHaveLength(2);
    });

    it.each(['no-speech', 'aborted', 'network'])(
      'delivers what it holds when the browser reports "%s" as it stops, and starts no other session',
      (code) => {
        const { pass, rec, log } = almostThere();
        pass.finish();
        rec.fail(code);
        expect(turnEnds(log)).toEqual(['end:stopped', "text:I'd like to cancel my"]);
        rec.close();
        vi.advanceTimersByTime(60_000);
        expect(env.recognition.instances).toHaveLength(1);
        expect(turnEnds(log)).toHaveLength(2);
        expect(vi.getTimerCount()).toBe(0);
      },
    );

    it('starts no other session while it waits, and never delivers twice', () => {
      const { pass, rec, log } = almostThere();
      // The quiet that would have ended the turn is a moment away when Done speaking is pressed.
      vi.advanceTimersByTime(ENDPOINT - 100);
      pass.finish();
      vi.advanceTimersByTime(200);
      expect(turnEnds(log)).toEqual([]);
      rec.close();
      expect(turnEnds(log)).toEqual(['end:stopped', "text:I'd like to cancel my"]);
      vi.advanceTimersByTime(60_000);
      expect(env.recognition.instances).toHaveLength(1);
      expect(turnEnds(log)).toHaveLength(2);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('does not let new sound or new words bring back the wait for quiet: the turn ends with the answer', () => {
      const { pass, rec, log } = almostThere();
      pass.finish();
      vi.advanceTimersByTime(STOP_WAIT - 500);
      rec.speechStart();
      rec.say("I'd like to cancel my subscription", false);
      rec.speechEnd();
      vi.advanceTimersByTime(499);
      expect(turnEnds(log)).toEqual([]);
      vi.advanceTimersByTime(1);
      expect(turnEnds(log)).toEqual(['end:stopped', "text:I'd like to cancel my subscription"]);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('delivers nothing if the pass is cancelled while it waits, whatever the browser says after', () => {
      const { pass, rec, log } = almostThere();
      pass.finish();
      pass.cancel();
      rec.say("I'd like to cancel my subscription", true);
      rec.close();
      vi.advanceTimersByTime(STOP_WAIT * 2);
      expect(log).toEqual(SHOWN);
      expect(rec.aborts).toBe(1);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('stops and delivers once however many times it is asked', () => {
      const { pass, rec, log } = almostThere();
      pass.finish();
      pass.finish();
      expect(rec.stops).toBe(1);
      rec.close();
      pass.finish();
      expect(turnEnds(log)).toEqual(['end:stopped', "text:I'd like to cancel my"]);
    });

    it('delivers what it holds at once between two sessions, when there is nothing to stop', () => {
      const { capture } = setup();
      const { log, handlers } = recorder();
      const pass = capture.listen(handlers);
      const first = env.recognition.latest();
      first.hear(['I will check'], ['my account', false]);
      // The browser's session has ended, and the next one has not started yet.
      first.close();
      expect(env.recognition.instances).toHaveLength(1);
      pass.finish();
      expect(log.slice(-2)).toEqual(['end:stopped', 'text:I will check my account']);
      expect(first.stops).toBe(0);
      vi.advanceTimersByTime(RESTART * 4);
      expect(env.recognition.instances).toHaveLength(1);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('delivers what it holds even when the browser reports a failure as it stops', () => {
      const { pass, rec, log } = almostThere();
      pass.finish();
      rec.fail('audio-capture');
      // The microphone went away as the session stopped: the words it had are still the turn.
      expect(turnEnds(log)).toEqual(['end:stopped', "text:I'd like to cancel my"]);
    });

    it('reports a failure that leaves it with no words at all, so the call can say what went wrong', () => {
      const { capture } = setup();
      const { log, handlers } = recorder();
      const pass = capture.listen(handlers);
      const rec = env.recognition.latest();
      pass.finish();
      rec.fail('audio-capture');
      expect(log).toEqual(['failure:microphone:missing']);
      expect(rec.aborts).toBe(1);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('delivers at once, with what it holds, when the browser refuses to stop', () => {
      const { pass, rec, log } = almostThere();
      vi.spyOn(rec, 'stop').mockImplementation(() => {
        throw new Error('The session is already over.');
      });
      pass.finish();
      expect(turnEnds(log)).toEqual(['end:stopped', "text:I'd like to cancel my"]);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('does not start on-device recognition again when it is refused as it stops', async () => {
      const { capture } = setup();
      env.recognition.setOnDevice('available');
      capture.prepare();
      await vi.advanceTimersByTimeAsync(0);
      const { log, handlers } = recorder();
      const pass = capture.listen(handlers);
      const rec = env.recognition.latest();
      rec.say('I will check', false);
      pass.finish();
      rec.fail('service-not-allowed');
      expect(turnEnds(log)).toEqual(['end:stopped', 'text:I will check']);
      expect(env.recognition.instances).toHaveLength(1);
    });

    it('says nothing was heard when nothing was, once the browser has stopped, and lets go of the session', () => {
      const { capture } = setup();
      const { log, handlers } = recorder();
      const pass = capture.listen(handlers);
      const rec = env.recognition.latest();
      pass.finish();
      expect(rec.stops).toBe(1);
      expect(log).toEqual([]);
      rec.close();
      expect(log).toEqual(['nothing']);
      expect(rec.aborts).toBe(1);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('says the same after the short wait when the browser never answers', () => {
      const { capture } = setup();
      const { log, handlers } = recorder();
      const pass = capture.listen(handlers);
      pass.finish();
      vi.advanceTimersByTime(STOP_WAIT);
      expect(log).toEqual(['nothing']);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('ends the speech and then says nothing was heard when there was sound but no words', () => {
      const { capture } = setup();
      const { log, handlers } = recorder();
      const pass = capture.listen(handlers);
      const rec = env.recognition.latest();
      rec.speechStart();
      pass.finish();
      rec.close();
      expect(log).toEqual(['start', 'end:stopped', 'nothing']);
    });

    it('takes the answer of a browser that could make nothing of the speech as nothing, without waiting for it to end', () => {
      const { capture } = setup();
      const { log, handlers } = recorder();
      const pass = capture.listen(handlers);
      const rec = env.recognition.latest();
      rec.speechStart();
      pass.finish();
      rec.say('', true);
      expect(log).toEqual(['start', 'end:stopped', 'nothing']);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('does not send filler sounds as a message either, whatever the browser hands back', () => {
      const { capture } = setup();
      const { log, handlers } = recorder();
      const pass = capture.listen(handlers);
      const rec = env.recognition.latest();
      rec.say('hmm', false);
      pass.finish();
      rec.say('hmm mm', true);
      rec.close();
      expect(turnEnds(log)).toEqual(['end:stopped', 'nothing']);
    });

    it('sends a number said alone as the turn', () => {
      const { capture } = setup();
      const { log, handlers } = recorder();
      const pass = capture.listen(handlers);
      const rec = env.recognition.latest();
      rec.say('5', false);
      pass.finish();
      rec.close();
      expect(turnEnds(log)).toEqual(['end:stopped', 'text:5']);
    });
  });

  describe('a pass that outlasts the browser session', () => {
    it('starts a session that ended quietly again, and says nothing about it', () => {
      const { capture } = setup();
      const { log, handlers } = recorder();
      capture.listen(handlers);
      const first = env.recognition.latest();
      first.open();
      vi.advanceTimersByTime(8000);
      // Chrome ends a session after some quiet: that is not "nothing heard".
      first.fail('no-speech');
      first.close();
      expect(log).toEqual([]);
      expect(env.recognition.instances).toHaveLength(1);
      vi.advanceTimersByTime(RESTART);
      expect(env.recognition.instances).toHaveLength(2);
      expect(env.recognition.latest()).toMatchObject({ running: true, continuous: true });
      // It is the same pass: what the new session hears is delivered through it.
      env.recognition.latest().say('hello again', true);
      vi.advanceTimersByTime(ENDPOINT);
      expect(log).toEqual(['start', 'interim:hello again', 'end:silence', 'text:hello again']);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('keeps the words heard when a session ends, and carries on in the next one', () => {
      const { capture } = setup();
      const { log, handlers } = recorder();
      capture.listen(handlers);
      env.recognition.latest().hear(['I need to', false]);
      env.recognition.latest().close();
      vi.advanceTimersByTime(RESTART);
      env.recognition.latest().hear(['cancel my order', false]);
      expect(log.at(-1)).toBe('interim:I need to cancel my order');
      vi.advanceTimersByTime(ENDPOINT);
      expect(log.slice(-2)).toEqual(['end:silence', 'text:I need to cancel my order']);
    });

    it('delivers words that were waiting for the end of the turn even while the session is being restarted', () => {
      const { capture } = setup();
      const { log, handlers } = recorder();
      capture.listen(handlers);
      env.recognition.latest().hear(['Please call me back.']);
      env.recognition.latest().close();
      vi.advanceTimersByTime(ENDPOINT);
      expect(log.slice(-2)).toEqual(['end:silence', 'text:Please call me back.']);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('says it is listening once for the whole pass, not again when a session starts again', () => {
      const { capture } = setup();
      const { log, handlers } = recorder();
      capture.listen({ ...handlers, onListening: () => log.push('listening') });
      env.recognition.latest().open();
      env.recognition.latest().close();
      vi.advanceTimersByTime(RESTART);
      env.recognition.latest().open();
      expect(log).toEqual(['listening']);
    });

    it('lets a quiet call go on for as long as it lasts: sessions the browser ends for want of speech, some seconds in, are never a failure', () => {
      const { capture } = setup();
      const { log, handlers } = recorder();
      capture.listen(handlers);
      // About half an hour of an empty room, a session ending by "no speech" every eight seconds.
      for (let session = 1; session <= 200; session++) {
        env.recognition.latest().open();
        vi.advanceTimersByTime(8000);
        env.recognition.latest().fail('no-speech');
        vi.advanceTimersByTime(RESTART);
      }
      expect(log).toEqual([]);
      expect(env.recognition.instances).toHaveLength(201);
      expect(env.recognition.latest().running).toBe(true);
      // And the next thing said is heard as usual.
      env.recognition.latest().say('Hello, are you there?', true);
      vi.advanceTimersByTime(ENDPOINT);
      expect(log.at(-1)).toBe('text:Hello, are you there?');
    });

    it('lets a quiet call go on when the browser simply ends its sessions after some seconds, with no error at all', () => {
      const { capture } = setup();
      const { log, handlers } = recorder();
      capture.listen(handlers);
      for (let session = 1; session <= 200; session++) {
        env.recognition.latest().open();
        vi.advanceTimersByTime(MIN_LIFE + 1000);
        env.recognition.latest().close();
        vi.advanceTimersByTime(RESTART);
      }
      expect(log).toEqual([]);
      expect(env.recognition.instances).toHaveLength(201);
      expect(env.recognition.latest().running).toBe(true);
    });

    describe('when the browser keeps ending sessions without showing that it works', () => {
      const die = (words?: string) => {
        const session = env.recognition.latest();
        if (words !== undefined) session.say(words, false);
        session.close();
        vi.advanceTimersByTime(RESTART);
      };
      const failures = (log: string[]) => log.filter((line) => line.startsWith('failure'));

      it('gives up with a failure after a few sessions in a row that end at once, so it can never restart in a loop', () => {
        const { capture } = setup();
        const { log, handlers } = recorder();
        capture.listen(handlers);
        for (let session = 1; session <= MAX_FAILED; session++) {
          expect(env.recognition.instances).toHaveLength(session);
          expect(log).toEqual([]);
          die();
        }
        expect(log).toEqual(['failure:service:unknown']);
        expect(env.recognition.instances).toHaveLength(MAX_FAILED);
        expect(vi.getTimerCount()).toBe(0);
        vi.advanceTimersByTime(60_000);
        expect(env.recognition.instances).toHaveLength(MAX_FAILED);
      });

      it('says it was the network when that is what kept ending it', () => {
        const { capture } = setup();
        const { log, handlers } = recorder();
        capture.listen(handlers);
        for (let session = 1; session <= MAX_FAILED; session++) {
          env.recognition.latest().fail('network');
          vi.advanceTimersByTime(RESTART);
        }
        expect(log).toEqual(['failure:service:network']);
        expect(vi.getTimerCount()).toBe(0);
      });

      it('gives up just the same when the service fails slowly: an error that takes many seconds to come is still an error', () => {
        const { capture } = setup();
        const { log, handlers } = recorder();
        capture.listen(handlers);
        for (let session = 1; session <= MAX_FAILED; session++) {
          expect(log).toEqual([]);
          env.recognition.latest().open();
          vi.advanceTimersByTime(MIN_LIFE * 4);
          env.recognition.latest().fail('network');
          vi.advanceTimersByTime(RESTART);
        }
        expect(log).toEqual(['failure:service:network']);
        expect(env.recognition.instances).toHaveLength(MAX_FAILED);
        expect(vi.getTimerCount()).toBe(0);
      });

      it('counts a session the browser abandoned the same way, however long it lived', () => {
        const { capture } = setup();
        const { log, handlers } = recorder();
        capture.listen(handlers);
        for (let session = 1; session <= MAX_FAILED; session++) {
          env.recognition.latest().open();
          vi.advanceTimersByTime(60_000);
          env.recognition.latest().fail('aborted');
          vi.advanceTimersByTime(RESTART);
        }
        expect(log).toEqual(['failure:service:unknown']);
        expect(vi.getTimerCount()).toBe(0);
      });

      it('is not fooled by sessions that each answer with an empty result and then end: an answer without words is not a sign that it works', () => {
        const { capture } = setup();
        const { log, handlers } = recorder();
        capture.listen(handlers);
        for (let session = 1; session <= MAX_FAILED; session++) {
          expect(log).toEqual([]);
          env.recognition.latest().say('', session % 2 === 0);
          env.recognition.latest().close();
          vi.advanceTimersByTime(RESTART);
        }
        expect(log).toEqual(['failure:service:unknown']);
        expect(env.recognition.instances).toHaveLength(MAX_FAILED);
        expect(vi.getTimerCount()).toBe(0);
      });

      it('never counts the browser’s own "no speech" against the pass, however soon it comes: a quiet room is not a failure', () => {
        const { capture } = setup();
        const { log, handlers } = recorder();
        capture.listen(handlers);
        for (let session = 1; session <= MAX_FAILED * 10; session++) {
          env.recognition.latest().fail('no-speech');
          vi.advanceTimersByTime(RESTART);
        }
        expect(log).toEqual([]);
        expect(env.recognition.latest().running).toBe(true);
      });

      it('counts only the sessions in a row: one that produced words starts the count again', () => {
        const { capture } = setup();
        const { log, handlers } = recorder();
        capture.listen(handlers);
        for (let session = 1; session < MAX_FAILED; session++) die();
        die('hmm');
        for (let session = 1; session < MAX_FAILED; session++) die();
        expect(failures(log)).toEqual([]);
        die();
        expect(failures(log)).toEqual(['failure:service:unknown']);
      });

      it('counts only the sessions in a row: one that ends with "no speech" starts the count again', () => {
        const { capture } = setup();
        const { log, handlers } = recorder();
        capture.listen(handlers);
        for (let session = 1; session < MAX_FAILED; session++) die();
        env.recognition.latest().fail('no-speech');
        vi.advanceTimersByTime(RESTART);
        for (let session = 1; session < MAX_FAILED; session++) die();
        expect(failures(log)).toEqual([]);
        die();
        expect(failures(log)).toEqual(['failure:service:unknown']);
      });

      it('counts only the sessions in a row: one that lived a while before it ended by itself starts the count again', () => {
        const { capture } = setup();
        const { log, handlers } = recorder();
        capture.listen(handlers);
        for (let session = 1; session < MAX_FAILED; session++) die();
        vi.advanceTimersByTime(MIN_LIFE);
        env.recognition.latest().close();
        vi.advanceTimersByTime(RESTART);
        for (let session = 1; session < MAX_FAILED; session++) die();
        expect(failures(log)).toEqual([]);
        die();
        expect(failures(log)).toEqual(['failure:service:unknown']);
      });

      it('reports a failure when the browser keeps refusing to start a session', () => {
        const { capture } = setup();
        const { log, handlers } = recorder();
        env.recognition.startThrows = true;
        capture.listen(handlers);
        vi.advanceTimersByTime(RESTART * MAX_FAILED);
        expect(log).toEqual(['failure:service:unknown']);
        expect(env.recognition.instances).toHaveLength(MAX_FAILED);
        expect(vi.getTimerCount()).toBe(0);
      });

      it('tries again when a session that is still stopping refuses to start, and carries on once it can', () => {
        const { capture } = setup();
        const { log, handlers } = recorder();
        env.recognition.startThrows = true;
        capture.listen(handlers);
        vi.advanceTimersByTime(RESTART - 1);
        env.recognition.startThrows = false;
        vi.advanceTimersByTime(1);
        expect(env.recognition.latest().running).toBe(true);
        env.recognition.latest().say('hello there', true);
        vi.advanceTimersByTime(ENDPOINT);
        expect(log).toEqual(['start', 'interim:hello there', 'end:silence', 'text:hello there']);
      });

      it('fails at once when the browser refuses to start for any other reason', async () => {
        const { capture } = setup();
        const { log, handlers } = recorder();
        env.recognition.startThrows = 'SecurityError';
        capture.listen(handlers);
        await vi.advanceTimersByTimeAsync(0);
        expect(log).toEqual(['failure:service:unknown']);
        expect(env.recognition.instances).toHaveLength(1);
      });

      it('still delivers what was said when the sessions die after it, and fails only for the next pass', () => {
        const { capture } = setup();
        const { log, handlers } = recorder();
        capture.listen(handlers);
        env.recognition.latest().hear(['Please call me back.']);
        // The session that heard it ends, and then enough sessions in a row end at once to be a loop.
        for (let session = 0; session <= MAX_FAILED; session++) die();
        expect(log.filter((line) => line.startsWith('failure'))).toEqual([]);
        vi.advanceTimersByTime(ENDPOINT);
        expect(log.slice(-2)).toEqual(['end:silence', 'text:Please call me back.']);
        expect(log.filter((line) => line.startsWith('failure'))).toEqual([]);
        expect(vi.getTimerCount()).toBe(0);
      });
    });
  });

  it('cuts a turn that goes on and on at the longest a turn can be, delivers it, and says why', () => {
    const { capture } = setup();
    const { log, handlers } = recorder();
    capture.listen(handlers);
    const rec = env.recognition.latest();
    rec.speechStart();
    // New words every second: the trainee is never quiet, so only the limit can end the turn.
    for (let second = 1; second <= LIMIT / 1000 + 2; second++) {
      rec.say(`word ${second}`, false);
      vi.advanceTimersByTime(1000);
    }
    expect(log.filter((line) => line.startsWith('end:'))).toEqual(['end:limit']);
    expect(log.filter((line) => line.startsWith('text:'))).toEqual([`text:word ${LIMIT / 1000}`]);
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

  it('delivers nothing and leaves no timer when it is cancelled while waiting for the end of a turn', () => {
    const { capture } = setup();
    const { log, handlers } = recorder();
    const pass = capture.listen(handlers);
    env.recognition.latest().hear(['I would like a refund.']);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    pass.cancel();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(ENDPOINT * 3);
    expect(log).toEqual(['start', 'interim:I would like a refund.']);
  });

  it('starts nothing when it is cancelled while a session is waiting to be started again', () => {
    const { capture } = setup();
    const { log, handlers } = recorder();
    const pass = capture.listen(handlers);
    env.recognition.latest().close();
    pass.cancel();
    vi.advanceTimersByTime(RESTART * 4);
    expect(env.recognition.instances).toHaveLength(1);
    expect(log).toEqual([]);
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
      vi.advanceTimersByTime(ENDPOINT);
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

  it('keeps using it when a session of the same pass is started again', async () => {
    const { capture } = setup();
    env.recognition.setOnDevice('available');
    capture.prepare();
    await vi.advanceTimersByTimeAsync(0);
    capture.listen(recorder().handlers);
    env.recognition.latest().close();
    await vi.advanceTimersByTimeAsync(RESTART);
    expect(env.recognition.instances).toHaveLength(2);
    expect(env.recognition.latest().processLocally).toBe(true);
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
