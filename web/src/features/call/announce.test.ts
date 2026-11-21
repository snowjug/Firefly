import { describe, expect, it } from 'vitest';
import { announcementFor } from './announce.ts';
import { initialState, reduce, type MachineEvent, type MachineState } from './machine.ts';

const run = (state: MachineState, ...events: MachineEvent[]) => events.reduce(reduce, state);

const LOADED: MachineEvent = {
  type: 'loaded',
  lastCustomerIndex: 1,
  awaiting: null,
  limitReached: false,
  sessionEnded: false,
};

const fire = (state: MachineState) => reduce(state, { type: 'timeout', id: state.timer?.id ?? -1 });

const connected = (canSpeak = false) =>
  run(
    initialState(),
    LOADED,
    { type: 'begin', voice: true, canSpeak, opening: canSpeak ? 1 : null },
    { type: 'permission-granted' },
  );

/** What a screen reader is told as each event happens, ignoring silence. */
function told(start: MachineState, ...events: MachineEvent[]): string[] {
  const out: string[] = [];
  let state = start;
  for (const event of events) {
    const next = reduce(state, event);
    const said = announcementFor(state, next);
    if (said) out.push(said);
    state = next;
  }
  return out;
}

describe('announcementFor', () => {
  it('announces the turn-taking of a hands-free call as whole sentences, one per change', () => {
    const start = run(initialState(), LOADED);
    expect(
      told(
        start,
        { type: 'begin', voice: true, canSpeak: true, opening: 1 },
        { type: 'permission-granted' },
        { type: 'speak-start', token: 1, estimateMs: 3000 },
        { type: 'speak-end', token: 1 },
      ),
    ).toEqual(['Asking for the microphone.', 'The customer is speaking.']);
    const before = run(
      start,
      { type: 'begin', voice: true, canSpeak: false, opening: null },
      { type: 'permission-granted' },
    );
    expect(announcementFor(before, fire(before))).toBe('Listening.');
  });

  it('says "Your turn." only when the microphone will not open by itself', () => {
    const talking = run(
      connected(true),
      { type: 'set-hands-free', on: false },
      { type: 'speak-start', token: 1, estimateMs: 100 },
    );
    expect(announcementFor(talking, reduce(talking, { type: 'speak-end', token: 1 }))).toBe(
      'Your turn.',
    );
    const handsFree = connected(true);
    const started = reduce(handsFree, { type: 'speak-start', token: 1, estimateMs: 100 });
    expect(announcementFor(started, reduce(started, { type: 'speak-end', token: 1 }))).toBeNull();
  });

  it('announces sending, mute, pause and the end of the call', () => {
    const listening = fire(connected());
    expect(
      told(
        listening,
        { type: 'toggle-mute' },
        { type: 'toggle-mute' },
        { type: 'toggle-pause' },
        { type: 'toggle-pause' },
        { type: 'end-requested' },
        { type: 'end-done' },
      ),
    ).toEqual([
      'Muted.',
      'Microphone on.',
      'Call paused.',
      'Call resumed.',
      'Ending the call.',
      'The call has ended.',
    ]);
    expect(
      told(connected(), { type: 'send-text', id: 'message-id-0001', text: 'hi', createdAt: 'now' }),
    ).toEqual(['Message sent. Waiting for the customer to reply.']);
  });

  it('puts what the trainee did before the phase it caused: muting while listening says "Muted."', () => {
    const listening = fire(connected());
    const muted = reduce(listening, { type: 'toggle-mute' });
    expect(muted.phase).toBe('ready-for-next-turn');
    expect(announcementFor(listening, muted)).toBe('Muted.');
  });

  it('says a blocking problem with what to do, and a degraded one briefly', () => {
    const asking = run(initialState(), LOADED, {
      type: 'begin',
      voice: true,
      canSpeak: false,
      opening: null,
    });
    const denied = reduce(asking, { type: 'permission-denied', reason: 'denied' });
    expect(announcementFor(asking, denied)).toMatch(
      /^Problem: The microphone is blocked for this site\. .*Try again/,
    );
    const speaking = run(connected(true), { type: 'speak-start', token: 1, estimateMs: 100 });
    const failed = reduce(speaking, { type: 'speak-failed', token: 1, reason: 'generation' });
    expect(announcementFor(speaking, failed)).toBe(
      "Problem: The customer's voice could not be made this time.",
    );
  });

  it('puts a problem before a hint, and a hint before a switch', () => {
    const listening = fire(connected());
    const quiet = reduce(listening, { type: 'nothing-heard' });
    expect(announcementFor(listening, quiet)).toMatch(/^Nothing was heard\./);
    const muted = reduce(quiet, { type: 'toggle-mute' });
    expect(announcementFor(quiet, muted)).toBe('Muted.');
  });

  it('says nothing when nothing the trainee needs to know has changed', () => {
    const state = connected();
    expect(announcementFor(state, state)).toBeNull();
    expect(announcementFor(state, reduce(state, { type: 'set-hands-free', on: false }))).toBeNull();
    const listening = fire(state);
    expect(announcementFor(listening, reduce(listening, { type: 'speech-start' }))).toBeNull();
  });

  it('never includes anything the customer or the trainee said', () => {
    const state = run(
      connected(),
      { type: 'send-text', id: 'message-id-0001', text: 'my secret words', createdAt: 'now' },
      {
        type: 'send-done',
        id: 'message-id-0001',
        attempt: 1,
        customerIndex: 3,
        turnsRemaining: 5,
        redactions: ['email'],
      },
    );
    const said = announcementFor(
      reduce(connected(), {
        type: 'send-text',
        id: 'message-id-0001',
        text: 'my secret words',
        createdAt: 'now',
      }),
      state,
    );
    expect(said).not.toContain('secret');
  });
});
