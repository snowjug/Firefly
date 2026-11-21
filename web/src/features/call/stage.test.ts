import { describe, expect, it } from 'vitest';
import { CALL_STAGES, type CallStage } from './contract.ts';
import { initialState, reduce, type MachineEvent, type MachineState } from './machine.ts';
import { stageOf } from './stage.ts';

// The brief's fifteen states (section 19), and which machine state each one is. The same table is
// in contract.ts (`CALL_STAGES`) and in the call workspace's documentation.

const run = (state: MachineState, ...events: MachineEvent[]) => events.reduce(reduce, state);

const LOADED: MachineEvent = {
  type: 'loaded',
  lastCustomerIndex: 1,
  awaiting: null,
  limitReached: false,
  sessionEnded: false,
};
const fire = (state: MachineState) => reduce(state, { type: 'timeout', id: state.timer?.id ?? -1 });
const loaded = () => run(initialState(), LOADED);
const connected = (canSpeak = false) =>
  run(
    loaded(),
    { type: 'begin', voice: true, canSpeak, opening: canSpeak ? 1 : null },
    { type: 'permission-granted' },
  );
const listening = () => fire(connected());
const sending = () =>
  run(connected(), { type: 'send-text', id: 'm1', text: 'hello', createdAt: 't' });
const failed = () =>
  reduce(sending(), {
    type: 'send-failed',
    id: 'm1',
    attempt: 1,
    failure: { kind: 'provider', saved: false },
  });

const CASES: Array<[CallStage, string, () => MachineState]> = [
  ['idle', 'nothing started, and a refused microphone', loaded],
  [
    'mic-permission',
    'the browser prompt is open',
    () => run(loaded(), { type: 'begin', voice: true, canSpeak: true, opening: 1 }),
  ],
  [
    'mic-permission',
    'the microphone is asked for again on the way back from typing',
    () =>
      run(
        connected(),
        { type: 'use-text' },
        { type: 'begin', voice: true, canSpeak: true, opening: null },
      ),
  ],
  [
    'ready',
    'the opening line is being prepared',
    () =>
      run(
        loaded(),
        { type: 'begin', voice: true, canSpeak: true, opening: 1 },
        { type: 'permission-granted' },
      ),
  ],
  ['ready', "the trainee's turn, the microphone not open yet", connected],
  [
    'ready',
    'a typed call waiting for a message',
    () => run(loaded(), { type: 'begin', voice: false, canSpeak: true, opening: null }),
  ],
  ['listening', 'the microphone is open', listening],
  [
    'listening',
    'speech detected (the label says Hearing you; the machine is still listening)',
    () => run(listening(), { type: 'speech-start' }),
  ],
  [
    'endpointing',
    'the utterance is being finished',
    () => run(listening(), { type: 'stop-talking' }),
  ],
  [
    'transcribing',
    'the utterance is being turned into text',
    () =>
      run(
        listening(),
        { type: 'speech-start' },
        { type: 'speech-end', id: 'u1', createdAt: 't', reason: 'silence' },
      ),
  ],
  ['processing', 'the reply is being made', sending],
  [
    'customer-speaking',
    'the voice plays',
    () =>
      run(
        connected(true),
        { type: 'speak-start', token: 1, estimateMs: 2000 },
        { type: 'speak-end', token: 1 },
        { type: 'send-text', id: 'm2', text: 'hi', createdAt: 't' },
        {
          type: 'send-done',
          id: 'm2',
          attempt: 1,
          customerIndex: 3,
          turnsRemaining: 5,
          redactions: [],
        },
        { type: 'speak-start', token: 2, estimateMs: 2000 },
      ),
  ],
  ['paused', 'the voice loop is paused', () => run(connected(), { type: 'toggle-pause' })],
  ['muted', 'muted while waiting for the trainee', () => run(connected(), { type: 'toggle-mute' })],
  ['retrying', 'a failed message is being sent again', () => run(failed(), { type: 'retry-send' })],
  [
    'offline',
    'the last step failed because the network was gone',
    () =>
      reduce(sending(), {
        type: 'send-failed',
        id: 'm1',
        attempt: 1,
        failure: { kind: 'offline', saved: false },
      }),
  ],
  [
    'ending',
    'a message in flight is finished before the call closes',
    () => run(sending(), { type: 'end-requested' }),
  ],
  [
    'evaluating',
    'the call is being closed and the review prepared',
    () => run(connected(), { type: 'end-requested' }),
  ],
  [
    'completed',
    'the call is closed',
    () => run(connected(), { type: 'end-requested' }, { type: 'end-done' }),
  ],
];

describe('stageOf', () => {
  it.each(CASES)('is %s when %s', (stage, _why, build) => {
    expect(stageOf(build())).toBe(stage);
  });

  it('covers every one of the fifteen stages', () => {
    expect([...new Set(CASES.map(([stage]) => stage))].sort()).toEqual([...CALL_STAGES].sort());
    expect(CALL_STAGES).toHaveLength(15);
  });

  it('lets a pause win over a problem, and a problem over the quiet phases', () => {
    const paused = run(failed(), { type: 'toggle-pause' });
    expect(stageOf(paused)).toBe('paused');
    expect(stageOf(failed())).toBe('ready');
  });

  it('keeps ending and completed above everything else', () => {
    const ending = run(listening(), { type: 'toggle-pause' }, { type: 'end-requested' });
    expect(stageOf(ending)).toBe('evaluating');
    const typed = run(loaded(), { type: 'begin', voice: false, canSpeak: false, opening: null });
    expect(stageOf(run(typed, { type: 'end-requested' }, { type: 'end-done' }))).toBe('completed');
  });
});
