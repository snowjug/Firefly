import { describe, expect, it } from 'vitest';
import type { PublicStateDTO } from '#shared/domain/api.ts';
import type { CallPhase, CallProblem, CallStatePoint, CallTurn } from '../call/contract.ts';
import {
  briefPathFor,
  clock,
  clockSince,
  composerGate,
  describeConnection,
  describeCustomerState,
  describeStatus,
  describeTalkControl,
  preferredLanguage,
  providerDescription,
  stateChangeSentence,
  traceSummary,
  tracePoints,
  traineeTurnCount,
  type StatusInput,
} from './call-model.ts';
import { FIXTURES } from './call-fixtures.ts';

const status = (overrides: Partial<StatusInput> = {}) =>
  describeStatus({
    phase: 'ready-for-next-turn',
    mode: 'voice',
    muted: false,
    paused: false,
    speechDetected: false,
    handsFree: false,
    ...overrides,
  });

const state = (
  band: PublicStateDTO['band']['id'],
  trend: PublicStateDTO['trend'],
): PublicStateDTO => ({
  band: { id: band, label: band.charAt(0).toUpperCase() + band.slice(1) },
  trend,
  discoveredCount: 0,
  silent: false,
  shifts: 0,
});

const points = (...bands: CallStatePoint['band'][]): CallStatePoint[] =>
  bands.map((band, index) => ({ turnIndex: index * 2 + 1, band, label: band }));

const problem = (overrides: Partial<CallProblem>): CallProblem => ({
  code: 'offline',
  title: 'Title.',
  preserved: 'Kept.',
  advice: 'Do this.',
  retry: null,
  textFallback: false,
  severity: 'blocking',
  ...overrides,
});

describe('the status line', () => {
  it('says what is happening in each stage of a turn', () => {
    expect(status({ phase: 'idle' }).label).toBe('Connecting');
    expect(status({ phase: 'ready' }).label).toBe('Connecting');
    expect(status({ phase: 'listening' }).label).toBe('Listening');
    expect(status({ phase: 'listening', speechDetected: true }).label).toBe('Hearing you');
    expect(status({ phase: 'transcribing' }).label).toBe('Transcribing what you said');
    expect(status({ phase: 'processing' }).label).toBe('The customer is thinking');
    expect(status({ phase: 'customer-speaking' }).label).toBe('The customer is speaking');
    expect(status({ phase: 'ready-for-next-turn' }).label).toBe('Your turn');
  });

  it('gives the four stages their own icon, colour and waveform', () => {
    const stages = [
      status({ phase: 'listening', speechDetected: true }),
      status({ phase: 'transcribing' }),
      status({ phase: 'processing' }),
      status({ phase: 'customer-speaking' }),
    ];
    expect(new Set(stages.map((entry) => entry.icon)).size).toBe(4);
    expect(new Set(stages.map((entry) => entry.label)).size).toBe(4);
    expect(stages.map((entry) => entry.wave)).toEqual([
      'trainee',
      'transcribing',
      'thinking',
      'customer',
    ]);
    expect(stages.map((entry) => entry.who)).toEqual([
      'trainee',
      'trainee',
      'customer',
      'customer',
    ]);
  });

  it('lets mute speak only while the microphone would otherwise be waiting', () => {
    expect(status({ phase: 'ready-for-next-turn', muted: true }).label).toBe('Microphone muted');
    expect(status({ phase: 'listening', muted: true }).label).toBe('Microphone muted');
    expect(status({ phase: 'transcribing', muted: true }).label).toBe('Transcribing what you said');
    expect(status({ phase: 'customer-speaking', muted: true }).label).toBe(
      'The customer is speaking',
    );
  });

  it('lets a pause win over everything but the end of the call', () => {
    expect(status({ phase: 'processing', paused: true }).label).toBe('Call paused');
    expect(status({ phase: 'listening', paused: true, muted: true }).label).toBe('Call paused');
    expect(status({ phase: 'ending', paused: true }).label).toBe('Ending the call');
  });

  it('does not promise that hands-free will reopen the microphone once nothing was heard', () => {
    const quiet = status({ handsFree: true });
    expect(quiet.detail).toMatch(/^Hands-free opens the microphone by itself/);
    const afterSilence = status({
      handsFree: true,
      hint: 'Nothing was heard. Check that the right microphone is selected, then speak again, or type your reply.',
    });
    expect(afterSilence.label).toBe('Your turn');
    expect(afterSilence.detail).toBe('Press Talk and speak, or type a reply.');
  });

  it('describes a typed call', () => {
    expect(status({ mode: 'text' }).label).toBe('Text-only call. Type your reply.');
    expect(status({ mode: 'text', phase: 'processing' }).label).toBe('The customer is thinking');
  });

  it('never claims it is the trainee’s turn while a problem stops the call', () => {
    const limit = status({ problem: problem({ code: 'turn-limit' }) });
    expect(limit.label).toBe('Message limit reached');
    expect(limit.who).toBe('alert');
    expect(status({ problem: problem({ code: 'offline' }) }).label).toBe('You are offline');
    expect(status({ problem: problem({ code: 'reply-failed' }) }).label).toBe(
      'The customer has not replied',
    );
    expect(
      status({ problem: problem({ code: 'microphone-missing', textFallback: true }) }).label,
    ).toBe('Microphone unavailable');
    // A problem the call can carry on through leaves the status alone.
    expect(
      status({ problem: problem({ code: 'transcription-failed', severity: 'degraded' }) }).label,
    ).toBe('Your turn');
  });
});

describe('the connection badge', () => {
  const base = { mode: 'voice', muted: false, paused: false, problem: null } as const;

  it('says live, muted, paused, typed, reconnecting or offline', () => {
    expect(describeConnection(base, true).label).toBe('Live call');
    expect(describeConnection({ ...base, muted: true }, true).label).toBe('Muted');
    expect(describeConnection({ ...base, paused: true }, true).label).toBe('Paused');
    expect(describeConnection({ ...base, mode: 'text' }, true).label).toBe('Text-only call');
    expect(describeConnection({ ...base, problem: problem({ code: 'offline' }) }, true).label).toBe(
      'Reconnecting',
    );
    expect(describeConnection(base, false).label).toBe('Offline');
  });

  it('gives every state its own icon, so colour is never the only cue', () => {
    const entries = [
      describeConnection(base, true),
      describeConnection({ ...base, muted: true }, true),
      describeConnection({ ...base, paused: true }, true),
      describeConnection({ ...base, mode: 'text' }, true),
      describeConnection({ ...base, problem: problem({ code: 'offline' }) }, true),
      describeConnection(base, false),
    ];
    expect(new Set(entries.map((entry) => entry.icon)).size).toBe(entries.length);
  });
});

describe('the customer’s state', () => {
  it('names the band, the trend and a plain line, never a number', () => {
    const view = describeCustomerState(state('frustrated', 'rising'), points('calm', 'frustrated'));
    expect(view?.label).toBe('Frustrated');
    expect(view?.trendWord).toBe('rising');
    expect(view?.description).toBe('Getting more frustrated');
    expect(JSON.stringify(view)).not.toMatch(/\d/);
  });

  it('uses the words rising, steady and easing', () => {
    expect(describeCustomerState(state('calm', 'steady'), [])?.trendWord).toBe('steady');
    expect(
      describeCustomerState(state('concerned', 'falling'), points('concerned'))?.trendWord,
    ).toBe('easing');
  });

  it('is recovering only when easing after a higher band', () => {
    const recovering = describeCustomerState(
      state('frustrated', 'falling'),
      points('calm', 'angry', 'frustrated'),
    );
    expect(recovering?.recovering).toBe(true);
    expect(recovering?.tone).toBe('recovering');
    expect(recovering?.label).toBe('Recovering');
    expect(recovering?.description).toBe('Still frustrated, but easing');

    // Easing, but never hotter: not recovering.
    expect(
      describeCustomerState(state('frustrated', 'falling'), points('calm', 'frustrated'))
        ?.recovering,
    ).toBe(false);
    // Calm is never "recovering", even after a worse moment.
    expect(
      describeCustomerState(state('calm', 'falling'), points('concerned', 'calm'))?.recovering,
    ).toBe(false);
    // Rising after a higher band is not recovering either.
    expect(
      describeCustomerState(state('frustrated', 'rising'), points('angry', 'frustrated'))
        ?.recovering,
    ).toBe(false);
  });

  it('gives each state its own icon', () => {
    const bands = ['calm', 'concerned', 'frustrated', 'angry', 'escalating'] as const;
    const tones = bands.map((band) => describeCustomerState(state(band, 'steady'), [])?.tone);
    expect(tones).toEqual([...bands]);
  });

  it('has nothing to say before there is a state, and never says why it changed', () => {
    expect(describeCustomerState(null, [])).toBeNull();
    const view = describeCustomerState(state('angry', 'rising'), [])!;
    expect(stateChangeSentence(view)).toBe('The customer now seems angry.');
    expect(stateChangeSentence(view)).not.toMatch(/because|since|after/i);
  });
});

describe('the temperature trace', () => {
  it('lists the points in order and names them', () => {
    const list = tracePoints(points('calm', 'concerned', 'angry'), null);
    expect(list.map((entry) => entry.after)).toEqual(['Opening line', 'Reply 2', 'Reply 3']);
  });

  it('starts from the current state when there is no history', () => {
    expect(tracePoints([], state('concerned', 'steady'))).toHaveLength(1);
    expect(tracePoints([], null)).toEqual([]);
  });

  it('summarises where the customer started, where they are and which way', () => {
    const list = tracePoints(points('calm', 'concerned', 'frustrated'), null);
    const view = describeCustomerState(state('frustrated', 'rising'), points('calm', 'frustrated'));
    expect(traceSummary(list, view)).toBe(
      'Customer temperature over 3 points: started calm, now frustrated, rising.',
    );
    expect(traceSummary([], null)).toMatch(/no points/);
  });
});

describe('times and counts', () => {
  it('formats m:ss and guards bad input', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(65.9)).toBe('1:05');
    expect(clock(3600)).toBe('60:00');
    expect(clock(-4)).toBe('0:00');
    expect(clock(Number.NaN)).toBe('0:00');
  });

  it('measures a turn from the start of the call', () => {
    expect(clockSince('2026-11-21T09:00:00.000Z', '2026-11-21T09:02:05.000Z')).toBe('2:05');
    expect(clockSince('2026-11-21T09:00:10.000Z', '2026-11-21T09:00:00.000Z')).toBe('0:00');
    expect(clockSince('not a date', '2026-11-21T09:02:05.000Z')).toBe('');
  });

  it('counts only the trainee’s turns that the server holds', () => {
    const turn = (role: CallTurn['role'], status: CallTurn['status']): CallTurn => ({
      key: `${role}-${status}`,
      index: 1,
      role,
      text: 'x',
      inputMode: 'text',
      createdAt: '2026-11-21T09:00:00.000Z',
      status,
      clientMessageId: null,
      interrupted: false,
    });
    expect(
      traineeTurnCount([
        turn('customer', 'sent'),
        turn('trainee', 'sent'),
        turn('trainee', 'sending'),
        turn('trainee', 'failed'),
        turn('trainee', 'transcribing'),
        turn('trainee', 'sent'),
      ]),
    ).toBe(2);
  });
});

describe('the large round control', () => {
  const talk = (phase: CallPhase, extra: Partial<Parameters<typeof describeTalkControl>[0]> = {}) =>
    describeTalkControl({ phase, muted: false, paused: false, limitReached: false, ...extra });

  it('is Talk on the trainee’s turn, Stop talking while listening and Interrupt while the customer speaks', () => {
    expect(talk('ready-for-next-turn')).toMatchObject({
      kind: 'talk',
      label: 'Talk',
      disabled: false,
    });
    expect(talk('listening')).toMatchObject({
      kind: 'stop',
      label: 'Stop talking',
      disabled: false,
      pressed: true,
    });
    expect(talk('customer-speaking')).toMatchObject({ kind: 'interrupt', label: 'Interrupt' });
  });

  it('is disabled, with its reason in words, while the call is busy', () => {
    expect(talk('transcribing')).toMatchObject({ disabled: true });
    expect(talk('transcribing').reason).toMatch(/speech into text/);
    expect(talk('processing').reason).toMatch(/customer to reply/);
    expect(talk('ready-for-next-turn', { muted: true }).reason).toMatch(/muted/);
    expect(talk('ready-for-next-turn', { paused: true }).reason).toMatch(/paused/);
    expect(talk('ready-for-next-turn', { limitReached: true }).reason).toMatch(/limit/);
    expect(talk('ending').reason).toMatch(/ending/);
  });

  it('is never pressed unless the microphone is open', () => {
    expect(talk('ready-for-next-turn').pressed).toBe(false);
    expect(talk('customer-speaking').pressed).toBeUndefined();
  });
});

describe('when the composer must wait', () => {
  it('waits only while the customer replies, at the limit, while ending, or on a problem', () => {
    expect(composerGate({ phase: 'ready-for-next-turn', problem: null })).toEqual({
      canSend: true,
      reason: null,
    });
    expect(composerGate({ phase: 'listening', problem: null }).canSend).toBe(true);
    expect(composerGate({ phase: 'customer-speaking', problem: null }).canSend).toBe(true);
    expect(composerGate({ phase: 'processing', problem: null }).reason).toMatch(
      /customer to reply/,
    );
    expect(composerGate({ phase: 'ending', problem: null }).canSend).toBe(false);
    expect(
      composerGate({ phase: 'ready-for-next-turn', problem: problem({ code: 'turn-limit' }) })
        .reason,
    ).toMatch(/limit/);
  });

  it('says why a blocking problem stops sending, and lets typing carry on when it can', () => {
    const offline = composerGate({
      phase: 'ready-for-next-turn',
      problem: problem({ code: 'offline' }),
    });
    expect(offline.canSend).toBe(false);
    expect(offline.reason).toMatch(/offline/);
    expect(
      composerGate({
        phase: 'ready-for-next-turn',
        problem: problem({ code: 'reply-failed', retry: 'send' }),
      }).reason,
    ).toMatch(/Try again/);
    expect(
      composerGate({
        phase: 'ready-for-next-turn',
        problem: problem({ code: 'microphone-denied', textFallback: true }),
      }).canSend,
    ).toBe(true);
    expect(
      composerGate({
        phase: 'ready-for-next-turn',
        problem: problem({ code: 'voice-generation-failed', severity: 'degraded' }),
      }).canSend,
    ).toBe(true);
  });
});

describe('who writes the replies, the language and the way back', () => {
  it('labels demo mode as the built-in rules engine and a live model with its own name', () => {
    expect(providerDescription({ demo: true, label: 'Demo mode (built-in rules engine)' })).toBe(
      "Demo mode: Firefly's built-in rules engine",
    );
    expect(providerDescription({ demo: false, label: 'Azure OpenAI (gpt-4o)' })).toBe(
      'Live model: Azure OpenAI (gpt-4o)',
    );
  });

  it('picks the first browser language that speech supports', () => {
    expect(preferredLanguage(['fr-FR', 'en-us', 'en-GB'])).toBe('en-US');
    expect(preferredLanguage(['de-DE'])).toBeUndefined();
    expect(preferredLanguage([])).toBeUndefined();
  });

  it('builds the brief address with the choices the call was made with', () => {
    const session = FIXTURES['preflight-voice'].snapshot.session!;
    const path = briefPathFor(session);
    expect(path.startsWith('/scenarios/locked-out-after-password-reset/brief?')).toBe(true);
    const query = new URLSearchParams(path.split('?')[1]);
    expect(Object.fromEntries(query)).toEqual({
      difficulty: 'starter',
      impact: 'low',
      temperature: 'calm',
      proficiency: 'novice',
      style: 'talkative',
      stage: 'first-contact',
      hints: 'off',
    });
  });
});
