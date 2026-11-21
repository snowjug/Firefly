import { describe, expect, it } from 'vitest';
import type { PublicStateDTO } from '#shared/domain/api.ts';
import { wordCount } from '#shared/domain/scenario.ts';
import { TEMPERATURE_BANDS, type TemperatureBandId } from '#shared/domain/vocab.ts';
import {
  CALL_STAGES,
  type CallProblem,
  type CallStatePoint,
  type CallTurn,
} from '../call/contract.ts';
import { describeProblem, PROBLEM_CODES } from '../call/problems.ts';
import { voiceError } from '../voice/errors.ts';
import { VOICE_STATE_TEXT } from '../voice/states.ts';
import {
  adviceIsLong,
  briefPathFor,
  clock,
  clockSince,
  composerGate,
  describeCase,
  describeConnection,
  describeControls,
  describeCustomerState,
  describeStatus,
  isEndFailure,
  latestCustomerTurn,
  preferredLanguage,
  providerDescription,
  recoveryOptions,
  SHORT_CALL_TURNS,
  stateChangeSentence,
  timeMarks,
  traineeTurnCount,
  unsavedMessage,
  type ControlsInput,
  type StatusInput,
} from './call-model.ts';
import { FIXTURES, SCENARIO } from './call-fixtures.ts';

const publicState = (
  band: TemperatureBandId,
  trend: PublicStateDTO['trend'] = 'steady',
): PublicStateDTO => ({
  band: { id: band, label: TEMPERATURE_BANDS.find((candidate) => candidate.id === band)!.label },
  trend,
  discoveredCount: 0,
  silent: false,
  shifts: 0,
});

const point = (band: TemperatureBandId, turnIndex = 1): CallStatePoint => ({
  turnIndex,
  band,
  label: band,
});

describe('the status of the call', () => {
  const status = (overrides: Partial<StatusInput> = {}) =>
    describeStatus({
      stage: 'ready',
      mode: 'voice',
      phase: 'ready-for-next-turn',
      speechDetected: false,
      microphone: 'granted',
      problem: null,
      ...overrides,
    }).id;

  const problem = (code: Parameters<typeof describeProblem>[0], context = {}) =>
    describeProblem(code, context);

  it('maps every machine stage to a status, and the end of the call always wins', () => {
    for (const stage of CALL_STAGES) {
      const result = describeStatus({
        stage,
        mode: 'voice',
        phase: 'ready-for-next-turn',
        speechDetected: false,
        microphone: 'granted',
      });
      expect(result.stage, stage).toBe(stage);
      expect(wordCount(result.label), result.label).toBeLessThanOrEqual(3);
    }
    for (const stage of ['ending', 'evaluating', 'completed'] as const) {
      const ended = status({ stage, online: false, problem: problem('offline') });
      expect(ended).toBe(stage === 'completed' ? 'completed' : stage);
    }
  });

  it('says Microphone ready on the trainee’s turn and Connecting while the opening line is made', () => {
    expect(status()).toBe('mic-ready');
    expect(status({ phase: 'ready' })).toBe('connecting');
    expect(status({ mode: 'text' })).toBe('text-fallback');
    expect(status({ mode: 'text', phase: 'ready' })).toBe('text-fallback');
  });

  it('tells apart hearing nothing yet, hearing the trainee, and finishing the sentence', () => {
    expect(status({ stage: 'listening' })).toBe('listening');
    expect(status({ stage: 'listening', speechDetected: true })).toBe('speech-detected');
    expect(status({ stage: 'endpointing', speechDetected: true })).toBe('processing-speech');
    expect(status({ stage: 'transcribing' })).toBe('processing-speech');
    expect(status({ stage: 'processing' })).toBe('generating-reply');
    expect(status({ stage: 'customer-speaking' })).toBe('customer-speaking');
  });

  it('does not say Listening until the microphone is really open', () => {
    expect(status({ stage: 'listening', micOpen: false })).toBe('mic-ready');
    // Said "not open" and speech detected cannot both be true: the microphone heard it.
    expect(status({ stage: 'listening', micOpen: true })).toBe('listening');
    expect(status({ stage: 'listening', micOpen: true, speechDetected: true })).toBe(
      'speech-detected',
    );
    // Only listening is held back: nothing else depends on it.
    expect(status({ stage: 'transcribing', micOpen: false })).toBe('processing-speech');
  });

  it('says each state in the voice layer’s own words', () => {
    const label = (input: Partial<StatusInput>) =>
      describeStatus({
        stage: 'ready',
        mode: 'voice',
        phase: 'ready-for-next-turn',
        speechDetected: false,
        microphone: 'granted',
        ...input,
      }).label;
    expect(label({})).toBe(VOICE_STATE_TEXT['microphone-ready'].label);
    expect(label({ stage: 'listening' })).toBe(VOICE_STATE_TEXT.listening.label);
    expect(label({ stage: 'listening', speechDetected: true })).toBe(
      VOICE_STATE_TEXT['speech-detected'].label,
    );
    expect(label({ stage: 'transcribing' })).toBe(VOICE_STATE_TEXT['processing-speech'].label);
    expect(label({ stage: 'processing' })).toBe(
      VOICE_STATE_TEXT['generating-customer-reply'].label,
    );
    expect(label({ stage: 'customer-speaking' })).toBe(VOICE_STATE_TEXT['customer-speaking'].label);
    expect(label({ stage: 'paused' })).toBe(VOICE_STATE_TEXT.paused.label);
    expect(label({ stage: 'muted' })).toBe(VOICE_STATE_TEXT.muted.label);
    expect(label({ mode: 'text' })).toBe(VOICE_STATE_TEXT['text-fallback'].label);
    expect(label({ stage: 'ending', phase: 'ending' })).toBe(VOICE_STATE_TEXT['ending-call'].label);
    expect(label({ stage: 'evaluating', phase: 'ending' })).toBe(VOICE_STATE_TEXT.evaluating.label);
    expect(label({ stage: 'completed', phase: 'completed' })).toBe(
      VOICE_STATE_TEXT.completed.label,
    );
    // The states the voice layer has no word for keep ours.
    expect(label({ stage: 'retrying' })).toBe('Retrying');
    expect(label({ stage: 'ready', online: false })).toBe('Offline');
  });

  it('puts being offline above a pause, and a pause above a problem, so it never lies about whose turn it is', () => {
    expect(status({ stage: 'paused', online: false })).toBe('offline');
    expect(status({ stage: 'paused', problem: problem('reply-failed') })).toBe('paused');
    expect(status({ stage: 'ready', online: false })).toBe('offline');
    expect(status({ stage: 'muted', online: false })).toBe('offline');
  });

  it('shows a failed message as Try again instead of Microphone ready or Muted', () => {
    for (const stage of ['ready', 'muted', 'offline'] as const) {
      expect(status({ stage, problem: problem('reply-failed') }), stage).toBe('retry-required');
    }
    expect(status({ stage: 'offline', problem: problem('offline') })).toBe('retry-required');
  });

  it('says Message limit for a full call, and Call ended for a call another tab closed', () => {
    expect(status({ problem: problem('turn-limit') })).toBe('limit-reached');
    expect(status({ problem: problem('session-ended') })).toBe('completed');
  });

  it('does not stop a call that lost its microphone: it carries on in text, or as it was', () => {
    expect(status({ mode: 'text', problem: problem('microphone-missing') })).toBe('text-fallback');
    expect(status({ problem: problem('microphone-busy') })).toBe('mic-ready');
  });

  it('says Try again, as the voice layer does, when speech or the customer’s voice failed on the trainee’s turn', () => {
    for (const code of [
      'transcription-failed',
      'voice-generation-failed',
      'playback-blocked',
      'playback-failed',
    ] as const) {
      expect(status({ problem: problem(code) }), code).toBe('retry-required');
    }
    expect(status({ problem: problem('rate-limited', { during: 'transcribe' }) })).toBe(
      'retry-required',
    );
    // A typed call stays typing, and an open microphone is listening: neither is waiting for a retry.
    expect(status({ mode: 'text', problem: problem('voice-generation-failed') })).toBe(
      'text-fallback',
    );
    expect(status({ stage: 'listening', problem: problem('voice-generation-failed') })).toBe(
      'listening',
    );
  });

  it('does not let a degraded problem that is not a voice step change the status (the card says it instead)', () => {
    expect(status({ problem: problem('end-failed') })).toBe('mic-ready');
    expect(status({ problem: problem('offline', { during: 'end' }) })).toBe('mic-ready');
  });

  it('says Retrying while a retry works', () => {
    expect(status({ stage: 'retrying' })).toBe('retrying');
  });

  it('describes the microphone row before the call from what the browser said', () => {
    const before = { stage: 'idle', phase: 'idle', microphone: 'unknown' } as const;
    expect(status({ ...before })).toBe('mic-not-requested');
    expect(status({ ...before, stage: 'mic-permission', phase: 'requesting-microphone' })).toBe(
      'requesting-permission',
    );
    expect(status({ ...before, problem: problem('microphone-denied', { beforeCall: true }) })).toBe(
      'permission-denied',
    );
    for (const code of [
      'microphone-missing',
      'microphone-busy',
      'microphone-unsupported',
    ] as const) {
      expect(status({ ...before, problem: problem(code, { beforeCall: true }) }), code).toBe(
        'mic-unavailable',
      );
    }
  });

  it('gives each of the four stages of a turn its own label and icon', () => {
    const turn = [
      describeStatus({
        stage: 'listening',
        mode: 'voice',
        phase: 'listening',
        speechDetected: false,
        microphone: 'granted',
      }),
      describeStatus({
        stage: 'transcribing',
        mode: 'voice',
        phase: 'transcribing',
        speechDetected: false,
        microphone: 'granted',
      }),
      describeStatus({
        stage: 'processing',
        mode: 'voice',
        phase: 'processing',
        speechDetected: false,
        microphone: 'granted',
      }),
      describeStatus({
        stage: 'customer-speaking',
        mode: 'voice',
        phase: 'customer-speaking',
        speechDetected: false,
        microphone: 'granted',
      }),
    ];
    expect(new Set(turn.map((item) => item.label)).size).toBe(4);
    expect(new Set(turn.map((item) => item.icon)).size).toBe(4);
  });
});

describe('the connection badge', () => {
  it('says Live when the browser is online, and Offline above everything else', () => {
    expect(describeConnection({ online: true })).toMatchObject({ key: 'live', label: 'Live' });
    expect(describeConnection({ online: false })).toMatchObject({
      key: 'offline',
      label: 'Offline',
    });
    expect(describeConnection({ online: false, reconnecting: true }).key).toBe('offline');
  });

  it('says Reconnecting while a step that failed has not been sent again', () => {
    expect(describeConnection({ online: true, reconnecting: true })).toMatchObject({
      key: 'reconnecting',
      label: 'Reconnecting',
    });
  });

  it('never relies on colour: each state has its own icon', () => {
    const icons = [
      describeConnection({ online: true }).icon,
      describeConnection({ online: true, reconnecting: true }).icon,
      describeConnection({ online: false }).icon,
    ];
    expect(new Set(icons).size).toBe(3);
  });
});

describe('the customer’s state', () => {
  it('is nothing before the customer has a state', () => {
    expect(describeCustomerState(null, [])).toBeNull();
  });

  it('is "Recovering" only when the customer is easing after being hotter earlier', () => {
    const easing = publicState('frustrated', 'falling');
    expect(
      describeCustomerState(easing, [point('calm'), point('angry'), point('frustrated')]),
    ).toMatchObject({
      label: 'Recovering',
      tone: 'recovering',
      recovering: true,
      trendWord: 'easing',
    });
    // Easing, but never hotter than now: that is just a customer calming down.
    expect(describeCustomerState(easing, [point('calm'), point('concerned')])).toMatchObject({
      label: 'Frustrated',
      recovering: false,
    });
    // A calm customer is never "recovering".
    expect(describeCustomerState(publicState('calm', 'falling'), [point('angry')])).toMatchObject({
      label: 'Calm',
      recovering: false,
    });
    // Hotter now is not recovering.
    expect(describeCustomerState(publicState('angry', 'rising'), [point('calm')])?.recovering).toBe(
      false,
    );
  });

  it('names the trend in words and gives it an icon', () => {
    const rising = describeCustomerState(publicState('concerned', 'rising'), []);
    expect(rising).toMatchObject({ trendWord: 'rising', trendIcon: 'trend-up' });
    expect(describeCustomerState(publicState('concerned', 'steady'), [])).toMatchObject({
      trendWord: 'steady',
      trendIcon: 'trend-flat',
    });
  });

  it('says a change in one sentence, with no number and never why', () => {
    const angry = describeCustomerState(publicState('angry'), [])!;
    expect(stateChangeSentence(angry)).toBe('The customer now seems angry.');
    const recovering = describeCustomerState(publicState('frustrated', 'falling'), [
      point('angry'),
    ])!;
    expect(stateChangeSentence(recovering)).toBe('The customer seems to be recovering.');
  });
});

describe('times and counts', () => {
  it('writes minutes and seconds, and never goes below zero or to NaN', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(5)).toBe('0:05');
    expect(clock(65.9)).toBe('1:05');
    expect(clock(3600)).toBe('60:00');
    expect(clock(-4)).toBe('0:00');
    expect(clock(Number.NaN)).toBe('0:00');
    expect(clock(Number.POSITIVE_INFINITY)).toBe('0:00');
  });

  it('measures a turn from the start of the call, and says nothing for a date it cannot read', () => {
    expect(clockSince('2026-11-21T09:00:00.000Z', '2026-11-21T09:03:07.000Z')).toBe('3:07');
    expect(clockSince('2026-11-21T09:00:00.000Z', 'later')).toBe('');
    expect(clockSince('', '2026-11-21T09:03:07.000Z')).toBe('');
  });

  const turnAt = (key: string, seconds: number): CallTurn => ({
    key,
    index: 1,
    role: 'customer',
    text: key,
    inputMode: 'text',
    createdAt: new Date(Date.parse('2026-11-21T09:00:00.000Z') + seconds * 1000).toISOString(),
    status: 'sent',
    clientMessageId: null,
    interrupted: false,
  });

  it('stamps the first turn and then one every minute, counted from the last stamp', () => {
    const turns = [
      turnAt('a', 0),
      turnAt('b', 20),
      turnAt('c', 59),
      turnAt('d', 60),
      turnAt('e', 100),
      turnAt('f', 121),
    ];
    expect([...timeMarks(turns, '2026-11-21T09:00:00.000Z')]).toEqual([
      ['a', '0:00'],
      ['d', '1:00'],
      ['f', '2:01'],
    ]);
  });

  it('skips a turn whose time cannot be read, and has no marks without turns', () => {
    const broken = { ...turnAt('x', 0), createdAt: 'nonsense' };
    expect([...timeMarks([broken, turnAt('y', 5)], '2026-11-21T09:00:00.000Z').keys()]).toEqual([
      'y',
    ]);
    expect(timeMarks([], '2026-11-21T09:00:00.000Z').size).toBe(0);
  });

  it('counts only the trainee’s turns the server holds, and spots a message that was never saved', () => {
    const trainee = (status: CallTurn['status'], index: number | null): CallTurn => ({
      ...turnAt(`t${status}${index}`, 1),
      role: 'trainee',
      status,
      index,
    });
    const turns = [
      turnAt('c', 0),
      trainee('sent', 2),
      trainee('sending', null),
      trainee('failed', null),
    ];
    expect(traineeTurnCount(turns)).toBe(1);
    expect(unsavedMessage(turns)).toBe(true);
    // A failed turn the server already has (a failed reply, not a failed save) is not unsaved.
    expect(unsavedMessage([turnAt('c', 0), trainee('failed', 4)])).toBe(false);
    expect(unsavedMessage([turnAt('c', 0), trainee('sent', 2)])).toBe(false);
  });

  it('finds the customer’s latest turn', () => {
    expect(latestCustomerTurn([turnAt('a', 0), turnAt('b', 5)])?.key).toBe('b');
    expect(latestCustomerTurn([])).toBeUndefined();
    expect(SHORT_CALL_TURNS).toBeGreaterThan(0);
  });
});

describe('the controls', () => {
  const controls = (overrides: Partial<ControlsInput> = {}) =>
    describeControls({
      phase: 'ready-for-next-turn',
      stage: 'ready',
      mode: 'voice',
      muted: false,
      paused: false,
      audio: 'on',
      canReplay: true,
      blocked: false,
      limitReached: false,
      ...overrides,
    });

  it('is Talk on the trainee’s turn, with everything else in its place', () => {
    const view = controls();
    expect(view.talk).toMatchObject({ kind: 'talk', label: 'Talk', disabled: false });
    expect(view.mute).toEqual({ visible: true, pressed: false, disabled: false });
    expect(view.stopAudio).toEqual({ visible: true, disabled: true });
    expect(view.text).toEqual({ visible: true, disabled: false });
    expect(view.pause).toEqual({ visible: true, resume: false, disabled: false });
    expect(view.replay).toEqual({ visible: true, disabled: false });
  });

  it('waits for the customer’s voice: Talk is off, and Stop customer audio is the way to take the turn', () => {
    const speaking = controls({ phase: 'customer-speaking', stage: 'customer-speaking' });
    expect(speaking.talk.disabled).toBe(true);
    expect(speaking.stopAudio.disabled).toBe(false);
    // The opening line has not started yet, but it is about to: it can be skipped too.
    const opening = controls({ phase: 'ready', stage: 'ready' });
    expect(opening.talk.disabled).toBe(true);
    expect(opening.stopAudio.disabled).toBe(false);
  });

  it('becomes Done speaking while the microphone is open, off while the sentence is being finished', () => {
    expect(controls({ phase: 'listening', stage: 'listening' }).talk).toMatchObject({
      kind: 'done',
      label: 'Done speaking',
      disabled: false,
      busy: false,
    });
    expect(controls({ phase: 'listening', stage: 'endpointing' }).talk).toMatchObject({
      kind: 'done',
      disabled: true,
    });
  });

  it('keeps Talk, working, until the microphone is really open, and only then offers Done speaking', () => {
    const opening = controls({ phase: 'listening', stage: 'listening', micOpen: false });
    expect(opening.talk).toMatchObject({ kind: 'talk', label: 'Talk', disabled: true, busy: true });
    const open = controls({ phase: 'listening', stage: 'listening', micOpen: true });
    expect(open.talk).toMatchObject({ kind: 'done', busy: false });
    // Nothing else waits for it.
    expect(controls({ micOpen: false }).talk).toMatchObject({ kind: 'talk', busy: false });
    expect(controls({ mode: 'text', micOpen: false }).talk.busy).toBe(false);
  });

  it('turns Talk off for a mute, a pause, a problem and a full call, never removing it', () => {
    expect(controls({ muted: true, stage: 'muted' }).talk).toMatchObject({
      kind: 'talk',
      disabled: true,
    });
    expect(controls({ paused: true, stage: 'paused' }).talk.disabled).toBe(true);
    expect(controls({ blocked: true }).talk.disabled).toBe(true);
    expect(controls({ limitReached: true }).talk.disabled).toBe(true);
    for (const phase of ['processing', 'transcribing', 'ending', 'completed'] as const) {
      expect(controls({ phase }).talk.disabled, phase).toBe(true);
    }
  });

  it('shows Mute as a toggle that reports itself, and Resume once paused', () => {
    expect(controls({ muted: true, stage: 'muted' }).mute.pressed).toBe(true);
    expect(controls({ paused: true, stage: 'paused' }).pause.resume).toBe(true);
    expect(controls({ paused: true, stage: 'paused' }).replay.disabled).toBe(true);
  });

  it('keeps Mute and Pause off before the call has begun and once it is closing', () => {
    for (const phase of ['idle', 'requesting-microphone', 'ending', 'completed'] as const) {
      const view = controls({ phase });
      expect(view.mute.disabled, phase).toBe(true);
      expect(view.pause.disabled, phase).toBe(true);
    }
    expect(controls({ phase: 'processing' }).text.disabled).toBe(true);
  });

  it('hides Replay when there is no customer audio, and turns it off when there is nothing to replay', () => {
    expect(controls({ audio: 'off' }).replay.visible).toBe(false);
    expect(controls({ audio: 'none' }).replay.visible).toBe(false);
    expect(controls({ canReplay: false }).replay).toEqual({ visible: true, disabled: true });
    expect(controls({ phase: 'processing' }).replay.disabled).toBe(true);
  });

  it('is only Return to voice in a typed call: no dead voice buttons', () => {
    const view = controls({ mode: 'text' });
    expect(view.talk).toMatchObject({ kind: 'voice', label: 'Return to voice', disabled: false });
    expect(view.mute.visible).toBe(false);
    expect(view.stopAudio.visible).toBe(false);
    expect(view.text.visible).toBe(false);
    expect(view.pause.visible).toBe(false);
    expect(view.replay.visible).toBe(false);
    // Going back to voice waits for the customer's reply, and for a full call.
    expect(controls({ mode: 'text', phase: 'processing' }).talk.disabled).toBe(true);
    expect(controls({ mode: 'text', limitReached: true }).talk.disabled).toBe(true);
  });

  it('keeps every label to three words or fewer', () => {
    const labels = [
      controls().talk.label,
      controls({ stage: 'listening', phase: 'listening' }).talk.label,
      controls({ mode: 'text' }).talk.label,
    ];
    for (const label of labels) expect(wordCount(label), label).toBeLessThanOrEqual(3);
  });
});

describe('recovery', () => {
  const labels = (
    code: Parameters<typeof describeProblem>[0],
    mode: 'voice' | 'text',
    context = {},
  ) => recoveryOptions(describeProblem(code, context), { mode }).map((option) => option.label);

  it('offers a voice that could not be made Retry, one that could not be played Replay, and both a way to carry on without it', () => {
    expect(labels('voice-generation-failed', 'voice'), 'made').toEqual([
      'Retry',
      'Continue without audio',
    ]);
    expect(labels('voice-generation-failed', 'voice', { timedOut: true }), 'timed out').toEqual([
      'Retry',
      'Continue without audio',
    ]);
    for (const code of ['playback-blocked', 'playback-failed'] as const) {
      expect(labels(code, 'voice'), code).toEqual(['Replay', 'Continue without audio']);
    }
    // Losing the network while the voice was being made is the same kind of problem.
    expect(labels('offline', 'voice', { during: 'speak' })).toEqual([
      'Retry',
      'Continue without audio',
    ]);
  });

  it('offers a failed message Retry and End safely, and never Use text (the message is waiting to be sent)', () => {
    for (const code of ['reply-failed', 'reply-timeout', 'save-failed'] as const) {
      expect(labels(code, 'voice'), code).toEqual(['Retry', 'End safely']);
      expect(labels(code, 'text'), code).toEqual(['Retry', 'End safely']);
    }
  });

  it('offers a lost microphone Retry and Use text, and in a typed call only Retry', () => {
    for (const code of ['microphone-denied', 'microphone-missing', 'microphone-busy'] as const) {
      expect(labels(code, 'voice'), code).toEqual(['Retry', 'Use text']);
      expect(labels(code, 'text'), code).toEqual(['Retry']);
    }
    expect(labels('microphone-unsupported', 'voice')).toEqual(['Use text']);
  });

  it('offers failed speech Retry and Use text, and speech that is not available only Use text', () => {
    expect(labels('transcription-failed', 'voice')).toEqual(['Retry', 'Use text']);
    expect(labels('offline', 'voice', { during: 'transcribe' })).toEqual(['Retry', 'Use text']);
    // Trying again cannot help a service that is not there.
    expect(labels('speech-service-unavailable', 'voice')).toEqual(['Use text']);
  });

  it('offers what the voice layer offers for the failures that are its', () => {
    const asLabel = { retry: 'Retry', replay: 'Replay', 'use-text': 'Use text' } as const;
    const pairs: Array<[Parameters<typeof describeProblem>[0], Parameters<typeof voiceError>[0]]> =
      [
        ['microphone-denied', 'microphone-denied'],
        ['microphone-missing', 'microphone-missing'],
        ['microphone-busy', 'microphone-busy'],
        ['microphone-unsupported', 'microphone-unsupported'],
        ['transcription-failed', 'transcription-failed'],
        ['speech-service-unavailable', 'speech-unavailable'],
        ['voice-generation-failed', 'voice-failed'],
        ['playback-blocked', 'playback-blocked'],
        ['playback-failed', 'playback-failed'],
      ];
    for (const [code, voice] of pairs) {
      const offered = labels(code, 'voice');
      for (const action of voiceError(voice).recovery) {
        if (action === 'continue-without-audio') {
          expect(offered, `${code} ${action}`).toContain('Continue without audio');
        } else {
          expect(offered, `${code} ${action}`).toContain(asLabel[action]);
        }
      }
    }
  });

  it('offers Retry only while offline or rate limited, and End call for a full call', () => {
    expect(labels('offline', 'voice', { during: 'send' })).toEqual(['Retry']);
    expect(labels('rate-limited', 'text', { during: 'send' })).toEqual(['Retry']);
    expect(labels('turn-limit', 'text')).toEqual(['End call']);
  });

  it('offers use-text before the call by the call’s own start (the pre-flight is not a mode yet)', () => {
    const options = recoveryOptions(describeProblem('microphone-denied', { beforeCall: true }), {
      mode: 'text',
      begun: false,
    });
    expect(options.map((option) => option.label)).toEqual(['Retry', 'Use text']);
  });

  it('never offers Retry when retrying cannot help, and Use text only where typing works', () => {
    for (const code of PROBLEM_CODES) {
      const problem = describeProblem(code, {});
      for (const mode of ['voice', 'text'] as const) {
        const actions = recoveryOptions(problem, { mode }).map((option) => option.action);
        if (problem.retry === null && !['turn-limit'].includes(code)) {
          expect(actions, `${code} ${mode}`).not.toContain('retry');
        }
        if (!problem.textFallback) expect(actions, `${code} ${mode}`).not.toContain('use-text');
        if (mode === 'text') expect(actions, `${code} ${mode}`).not.toContain('use-text');
      }
    }
  });

  it('gives every problem a way forward, except the ones where the page moves on by itself', () => {
    const none: string[] = [];
    for (const code of PROBLEM_CODES) {
      if (
        recoveryOptions(describeProblem(code, { notFound: true }), { mode: 'voice' }).length === 0
      ) {
        none.push(code);
      }
    }
    // The call has already ended (the report opens), or it does not exist (the page says so, with a way back).
    expect(none.sort()).toEqual(['session-ended', 'session-unavailable']);
  });

  it('labels every action with one to three words', () => {
    for (const code of PROBLEM_CODES) {
      for (const option of recoveryOptions(describeProblem(code, {}), { mode: 'voice' })) {
        expect(wordCount(option.label), option.label).toBeLessThanOrEqual(3);
      }
    }
  });

  it('puts long advice behind "How to fix" and keeps short advice in the card', () => {
    expect(adviceIsLong(describeProblem('microphone-denied', { browser: 'edge' }).advice)).toBe(
      true,
    );
    expect(adviceIsLong(describeProblem('microphone-denied', { browser: 'chrome' }).advice)).toBe(
      false,
    );
    expect(adviceIsLong(describeProblem('reply-failed').advice)).toBe(false);
    expect(
      adviceIsLong(
        'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen',
      ),
    ).toBe(false);
    expect(
      adviceIsLong(
        'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen',
      ),
    ).toBe(true);
  });

  it('knows a failure to end the call, even one that happened offline, and nothing else', () => {
    expect(isEndFailure(describeProblem('end-failed'))).toBe(true);
    expect(isEndFailure(describeProblem('end-failed', { nothingToReview: true }))).toBe(true);
    expect(isEndFailure(describeProblem('offline', { during: 'end' }))).toBe(true);
    expect(isEndFailure(describeProblem('offline', { during: 'send' }))).toBe(false);
    expect(isEndFailure(describeProblem('reply-failed'))).toBe(false);
    expect(isEndFailure(null)).toBe(false);
  });
});

describe('the reply box', () => {
  const gate = (
    phase: Parameters<typeof composerGate>[0]['phase'],
    problem: CallProblem | null = null,
  ) => composerGate({ phase, problem });

  it('sends on the trainee’s turn and says nothing', () => {
    expect(gate('ready-for-next-turn')).toEqual({ canSend: true, reason: null });
    expect(gate('ready')).toEqual({ canSend: true, reason: null });
  });

  it('waits, in a few words, while the customer replies and while the call closes', () => {
    expect(gate('processing')).toEqual({ canSend: false, reason: 'Waiting for the customer.' });
    expect(gate('ending').reason).toBe('The call is ending.');
    expect(gate('completed').canSend).toBe(false);
  });

  it('waits for a problem that needs handling first, and says which', () => {
    expect(gate('ready-for-next-turn', describeProblem('reply-failed'))).toEqual({
      canSend: false,
      reason: 'Retry your last message first.',
    });
    expect(gate('ready-for-next-turn', describeProblem('offline', { during: 'send' })).reason).toBe(
      'You are offline.',
    );
    expect(gate('ready-for-next-turn', describeProblem('turn-limit')).reason).toBe(
      'Message limit reached.',
    );
    expect(gate('ready-for-next-turn', describeProblem('session-ended')).reason).toBe(
      'This call has ended.',
    );
  });

  it('keeps sending for problems that typing gets around, and for degraded ones', () => {
    expect(gate('ready-for-next-turn', describeProblem('microphone-missing')).canSend).toBe(true);
    expect(gate('ready-for-next-turn', describeProblem('voice-generation-failed')).canSend).toBe(
      true,
    );
    expect(gate('ready-for-next-turn', describeProblem('transcription-failed')).canSend).toBe(true);
  });

  it('keeps every reason to five words or fewer', () => {
    const reasons = [
      gate('processing'),
      gate('ending'),
      gate('ready', describeProblem('reply-failed')),
      gate('ready', describeProblem('offline')),
      gate('ready', describeProblem('turn-limit')),
      gate('ready', describeProblem('session-ended')),
      gate('ready', describeProblem('session-unavailable', { notFound: true })),
    ];
    for (const { reason } of reasons)
      expect(wordCount(reason ?? ''), reason ?? '').toBeLessThanOrEqual(5);
  });
});

describe('the case', () => {
  it('reads the public brief: product, reference, issue, the impact’s own line, stage and objective', () => {
    const facts = describeCase(SCENARIO);
    expect(facts.product).toEqual({
      name: 'Microsoft Teams',
      area: 'Meetings',
      family: 'Microsoft 365',
    });
    expect(facts.caseReference).toBe('FX-20418');
    expect(facts.issue).toMatch(/Audio cuts out/);
    expect(facts.impact).toEqual({
      label: 'Medium',
      detail: 'The warehouse team cannot hold its daily handover meeting.',
    });
    expect(facts.callStage).toBe('First contact');
    expect(facts.objective).toMatch(/Find what changed/);
    expect(facts.more.map((item) => item.label)).toEqual([
      'Known context',
      'Previous contact',
      'Environment',
    ]);
  });

  it('follows the impact the call was configured with', () => {
    const high = describeCase({ ...SCENARIO, config: { ...SCENARIO.config, impact: 'high' } });
    expect(high.impact.label).toBe('High');
    expect(high.impact.detail).toMatch(/Shift handovers/);
  });

  it('guesses nothing for a call saved before public briefs: older goal, the impact’s description', () => {
    const facts = describeCase({
      ...SCENARIO,
      product: null,
      caseReference: null,
      publicBrief: null,
    });
    expect(facts.product).toBeNull();
    expect(facts.caseReference).toBeNull();
    expect(facts.issue).toBeNull();
    expect(facts.objective).toBe('Find what changed, then agree a next step.');
    expect(facts.impact.detail.length).toBeGreaterThan(0);
    expect(facts.more).toEqual([]);
  });

  it('leaves out the details a brief does not have', () => {
    const facts = describeCase({
      ...SCENARIO,
      publicBrief: { ...SCENARIO.publicBrief!, knownContext: '', environment: '' },
    });
    expect(facts.more.map((item) => item.label)).toEqual(['Previous contact']);
  });
});

describe('where the call goes next', () => {
  const session = FIXTURES['mic-ready'].snapshot.session!;

  it('takes Back to brief to the brief of this scenario with the choices the call was made with', () => {
    const path = briefPathFor(session);
    const url = new URL(path, 'https://firefly.test');
    expect(url.pathname).toBe('/scenarios/fixture-teams-audio-drops/brief');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      difficulty: 'standard',
      impact: 'medium',
      temperature: 'anxious',
      proficiency: 'intermediate',
      style: 'demanding',
      stage: 'first-contact',
      hints: 'off',
    });
  });

  it('carries guided practice and switched-off complications', () => {
    const guided = FIXTURES['guided-hints'].snapshot.session!;
    expect(new URL(briefPathFor(guided), 'https://firefly.test').searchParams.get('hints')).toBe(
      'on',
    );
    const quiet = {
      ...session,
      scenario: {
        ...session.scenario,
        config: { ...session.scenario.config, curveballsEnabled: false },
      },
    };
    expect(
      new URL(briefPathFor(quiet), 'https://firefly.test').searchParams.get('curveballs'),
    ).toBe('none');
  });

  it('escapes a scenario id that is not made of safe characters', () => {
    const odd = { ...session, scenarioId: 'a b/c' };
    expect(briefPathFor(odd)).toContain('/scenarios/a%20b%2Fc/brief?');
  });
});

describe('the speech language and the provider', () => {
  it('uses the first language of the browser that speech supports, whatever its case', () => {
    expect(preferredLanguage(['fr-FR', 'en-us', 'en-GB'])).toBe('en-US');
    expect(preferredLanguage(['de', 'fr'])).toBeUndefined();
    expect(preferredLanguage([])).toBeUndefined();
  });

  it('calls the built-in rules a demo and a model a live model, never the other way round', () => {
    expect(providerDescription({ demo: true, label: 'Anything' })).toMatch(/^Demo mode/);
    expect(providerDescription({ demo: false, label: 'Azure OpenAI (gpt-4o)' })).toBe(
      'Live model: Azure OpenAI (gpt-4o)',
    );
  });
});
