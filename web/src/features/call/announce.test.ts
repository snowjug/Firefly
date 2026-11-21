import { describe, expect, it } from 'vitest';
import { VOICE_STATE_TEXT } from '../voice/states.ts';
import { announcementFor, listeningAnnouncement, type Announcement } from './announce.ts';
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
function toldWith(start: MachineState, ...events: MachineEvent[]): Announcement[] {
  const out: Announcement[] = [];
  let state = start;
  for (const event of events) {
    const next = reduce(state, event);
    const said = announcementFor(state, next);
    if (said) out.push(said);
    state = next;
  }
  return out;
}

const told = (start: MachineState, ...events: MachineEvent[]): string[] =>
  toldWith(start, ...events).map((said) => said.text);

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
    ).toEqual([
      'Waiting for you to allow the microphone.',
      'The customer is speaking. You can stop the customer audio at any time.',
    ]);
  });

  it('leaves "Listening" to the moment the microphone is really open, never to the machine', () => {
    const before = run(
      initialState(),
      LOADED,
      { type: 'begin', voice: true, canSpeak: false, opening: null },
      { type: 'permission-granted' },
    );
    const listening = fire(before);
    expect(listening.phase).toBe('listening');
    expect(announcementFor(before, listening)).toBeNull();
    expect(listeningAnnouncement()).toEqual({
      text: 'Listening. Speak when you are ready.',
      politeness: 'polite',
    });
  });

  it('says "Microphone ready." only when the microphone will not open by itself in a spoken call', () => {
    const talking = run(
      connected(true),
      { type: 'set-hands-free', on: false },
      { type: 'speak-start', token: 1, estimateMs: 100 },
    );
    expect(announcementFor(talking, reduce(talking, { type: 'speak-end', token: 1 }))).toEqual({
      text: 'Microphone ready.',
      politeness: 'polite',
    });
    const handsFree = connected(true);
    const started = reduce(handsFree, { type: 'speak-start', token: 1, estimateMs: 100 });
    expect(announcementFor(started, reduce(started, { type: 'speak-end', token: 1 }))).toBeNull();
    // A typed call is not told "you are typing" after every reply.
    const typed = run(connected(true), { type: 'use-text' });
    const asked = reduce(typed, {
      type: 'send-text',
      id: 'message-id-0001',
      text: 'hi',
      createdAt: 'now',
    });
    const answered = reduce(asked, {
      type: 'send-done',
      id: 'message-id-0001',
      attempt: 1,
      customerIndex: 3,
      turnsRemaining: 5,
      redactions: [],
    });
    expect(announcementFor(asked, answered)).toBeNull();
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
      'Your microphone is muted.',
      'Microphone on.',
      'The call is paused.',
      'Call resumed.',
      'Preparing your review.',
      'The call is complete.',
    ]);
    expect(
      told(connected(), { type: 'send-text', id: 'message-id-0001', text: 'hi', createdAt: 'now' }),
    ).toEqual(['The customer is preparing a reply.']);
  });

  it('says each step of speaking, transcribing and thinking once, and a retry as a retry', () => {
    expect(
      told(
        fire(connected()),
        { type: 'speech-start' },
        { type: 'speech-end', id: 'u1', createdAt: 'now', reason: 'silence' },
        { type: 'transcribe-done', id: 'u1', text: 'hello' },
        {
          type: 'send-failed',
          id: 'u1',
          attempt: 1,
          failure: { kind: 'provider', saved: false },
        },
        { type: 'retry-send' },
      ),
    ).toEqual([
      'Turning your speech into text.',
      'The customer is preparing a reply.',
      'Problem: The customer could not reply. Your message is kept.',
      'Retrying.',
    ]);
  });

  it('never announces that the trainee is speaking: it would talk over them', () => {
    const listening = fire(connected());
    expect(announcementFor(listening, reduce(listening, { type: 'speech-start' }))).toBeNull();
  });

  it('says text mode, voice mode and the customer audio once, as what the trainee did', () => {
    const speaking = connected(true);
    expect(
      told(
        speaking,
        { type: 'set-audio', on: false, available: true },
        { type: 'set-audio', on: true, available: true },
        { type: 'use-text' },
        { type: 'begin', voice: true, canSpeak: true, opening: null },
      ),
    ).toEqual([
      'Customer audio off.',
      'Customer audio on.',
      'You are typing your replies.',
      'Voice mode.',
    ]);
  });

  it('says the review is next once a message in flight has been finished', () => {
    const sending = reduce(connected(), {
      type: 'send-text',
      id: 'message-id-0001',
      text: 'hi',
      createdAt: 'now',
    });
    expect(
      told(
        sending,
        { type: 'end-requested' },
        {
          type: 'send-done',
          id: 'message-id-0001',
          attempt: 1,
          customerIndex: 3,
          turnsRemaining: 5,
          redactions: [],
        },
      ),
    ).toEqual(['Ending the call.', 'Preparing your review.']);
  });

  it('puts what the trainee did before the phase it caused: muting while listening says it is muted', () => {
    const listening = fire(connected());
    const muted = reduce(listening, { type: 'toggle-mute' });
    expect(muted.phase).toBe('ready-for-next-turn');
    expect(announcementFor(listening, muted)?.text).toBe('Your microphone is muted.');
  });

  it('says only a blocked microphone assertively, in the voice layer’s own sentence', () => {
    const asking = run(initialState(), LOADED, {
      type: 'begin',
      voice: true,
      canSpeak: false,
      opening: null,
    });
    const denied = reduce(asking, { type: 'permission-denied', reason: 'denied' });
    expect(announcementFor(asking, denied)).toEqual({
      text: 'The microphone is blocked. You can type your replies instead.',
      politeness: 'assertive',
    });
    expect(announcementFor(asking, denied)?.text).toBe(
      VOICE_STATE_TEXT['permission-denied'].announcement,
    );
    // A microphone that is missing stops the trainee being heard too, so it is as urgent.
    const missing = reduce(asking, { type: 'permission-denied', reason: 'missing' });
    expect(announcementFor(asking, missing)).toEqual({
      text: 'Problem: No microphone was found. Nothing was recorded.',
      politeness: 'assertive',
    });
  });

  it('says a blocking problem with what was kept, and a degraded one briefly, both politely', () => {
    const sending = reduce(connected(), {
      type: 'send-text',
      id: 'message-id-0001',
      text: 'hi',
      createdAt: 'now',
    });
    const failed = reduce(sending, {
      type: 'send-failed',
      id: 'message-id-0001',
      attempt: 1,
      failure: { kind: 'provider', saved: true },
    });
    expect(announcementFor(sending, failed)).toEqual({
      text: 'Problem: The customer could not reply. Your message was saved.',
      politeness: 'polite',
    });
    const speaking = run(connected(true), { type: 'speak-start', token: 1, estimateMs: 100 });
    const voice = reduce(speaking, { type: 'speak-failed', token: 1, reason: 'generation' });
    expect(announcementFor(speaking, voice)).toEqual({
      text: "Problem: The customer's voice could not be made.",
      politeness: 'polite',
    });
  });

  it('puts a problem before a hint, and a hint before a switch', () => {
    const listening = fire(connected());
    const quiet = reduce(listening, { type: 'nothing-heard' });
    expect(announcementFor(listening, quiet)?.text).toMatch(/^Nothing was heard\./);
    const muted = reduce(quiet, { type: 'toggle-mute' });
    expect(announcementFor(quiet, muted)?.text).toBe('Your microphone is muted.');
  });

  it('says nothing when nothing the trainee needs to know has changed', () => {
    const state = connected();
    expect(announcementFor(state, state)).toBeNull();
    expect(announcementFor(state, reduce(state, { type: 'set-hands-free', on: false }))).toBeNull();
  });

  it('never includes anything the customer or the trainee said', () => {
    const asked = reduce(connected(), {
      type: 'send-text',
      id: 'message-id-0001',
      text: 'my secret words',
      createdAt: 'now',
    });
    const answered = reduce(asked, {
      type: 'send-done',
      id: 'message-id-0001',
      attempt: 1,
      customerIndex: 3,
      turnsRemaining: 5,
      redactions: ['email'],
    });
    expect(announcementFor(asked, answered)?.text ?? '').not.toContain('secret');
    expect(announcementFor(connected(), asked)?.text ?? '').not.toContain('secret');
  });
});
