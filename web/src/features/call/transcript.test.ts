import { describe, expect, it } from 'vitest';
import type { SendMessageResponse, TurnDTO } from '#shared/domain/api.ts';
import type { CallTurn } from './contract.ts';
import type { Exchange } from './machine.ts';
import { FakeServer, publicState } from './testing.ts';
import {
  appendStatePoint,
  applyReply,
  exchangeTurn,
  initialStateHistory,
  statePoint,
  toCallTurn,
  turnsFromSession,
  withInterrupted,
} from './transcript.ts';

const exchange = (over: Partial<Exchange> = {}): Exchange => ({
  id: 'message-id-0001',
  text: 'Hello there',
  inputMode: 'text',
  createdAt: '2026-03-02T10:00:40.000Z',
  status: 'sending',
  attempt: 1,
  saved: false,
  index: null,
  ...over,
});

const turn = (over: Partial<TurnDTO> = {}): TurnDTO => ({
  index: 2,
  role: 'trainee',
  text: 'Hello there',
  createdAt: '2026-03-02T10:00:41.000Z',
  source: 'trainee',
  inputMode: 'text',
  ...over,
});

const response = (over: Partial<SendMessageResponse> = {}): SendMessageResponse => ({
  traineeTurn: turn(),
  customerTurn: turn({ index: 3, role: 'customer', text: 'Hi', source: 'live' }),
  state: publicState('concerned'),
  redactions: [],
  turnsRemaining: 10,
  ...over,
});

describe('turnsFromSession', () => {
  it('turns the server\u2019s turns into transcript lines with stable keys', () => {
    const turns = turnsFromSession(new FakeServer({ traineeTurns: 1 }).session());
    expect(turns.map((line) => [line.key, line.index, line.role, line.status])).toEqual([
      ['t1', 1, 'customer', 'sent'],
      ['t2', 2, 'trainee', 'sent'],
      ['t3', 3, 'customer', 'sent'],
    ]);
    expect(turns.every((line) => line.clientMessageId === null && !line.interrupted)).toBe(true);
  });

  it('leaves out the message that is waiting for a reply: the machine owns that one', () => {
    const server = new FakeServer();
    server.leaveAwaiting('Where is my order', 'client-message-0001');
    const session = server.session();
    expect(session.awaitingReply?.turnIndex).toBe(2);
    expect(turnsFromSession(session).map((line) => line.index)).toEqual([1]);
  });

  it('copes with a server that does not say how a turn arrived', () => {
    const old = { ...turn() } as Partial<TurnDTO>;
    delete old.inputMode;
    expect(toCallTurn(old as TurnDTO).inputMode).toBe('text');
    expect(toCallTurn(old as TurnDTO, { inputMode: 'voice' }).inputMode).toBe('voice');
    expect(toCallTurn(turn({ inputMode: 'voice' })).inputMode).toBe('voice');
  });
});

describe('exchangeTurn', () => {
  it('shows a message in flight with the id it will be stored under', () => {
    expect(exchangeTurn(exchange())).toEqual({
      key: 'message-id-0001',
      index: null,
      role: 'trainee',
      text: 'Hello there',
      inputMode: 'text',
      createdAt: '2026-03-02T10:00:40.000Z',
      status: 'sending',
      clientMessageId: 'message-id-0001',
      interrupted: false,
    });
  });

  it('shows the words as they are recognised while a spoken message is still being transcribed', () => {
    const spoken = exchange({ text: '', status: 'transcribing', inputMode: 'voice' });
    expect(exchangeTurn(spoken).text).toBe('');
    expect(exchangeTurn(spoken, 'where is my').text).toBe('where is my');
    expect(exchangeTurn(exchange({ status: 'failed' }), 'ignored').text).toBe('Hello there');
  });

  it('keeps the position of a message the server already holds', () => {
    expect(exchangeTurn(exchange({ status: 'failed', saved: true, index: 4 })).index).toBe(4);
  });
});

describe('applyReply', () => {
  it('replaces the message in flight with what the server stored, keeping its key, and adds the reply', () => {
    const before: CallTurn[] = [
      toCallTurn(turn({ index: 1, role: 'customer', source: 'opening' })),
    ];
    const after = applyReply(
      before,
      response({ traineeTurn: turn({ text: 'Hello there [email removed]' }) }),
      exchange(),
    );
    expect(after.map((line) => [line.key, line.index, line.role])).toEqual([
      ['t1', 1, 'customer'],
      ['message-id-0001', 2, 'trainee'],
      ['t3', 3, 'customer'],
    ]);
    expect(after[1]).toMatchObject({
      text: 'Hello there [email removed]',
      status: 'sent',
      clientMessageId: 'message-id-0001',
    });
    expect(before).toHaveLength(1);
  });

  it('shows how the message arrived when the server does not say', () => {
    const noMode = turn() as Partial<TurnDTO>;
    delete noMode.inputMode;
    const after = applyReply(
      [],
      response({ traineeTurn: noMode as TurnDTO }),
      exchange({ inputMode: 'voice' }),
    );
    expect(after[0]?.inputMode).toBe('voice');
  });

  it('never shows a turn twice, however many times the same answer is applied', () => {
    const once = applyReply([], response(), exchange());
    const twice = applyReply(once, response(), exchange());
    const thrice = applyReply(twice, response(), exchange());
    expect(thrice).toHaveLength(2);
    expect(thrice.map((line) => line.index)).toEqual([2, 3]);
    // A resend of an answered message gets the stored answer back: the same turns, the same keys.
    expect(thrice.map((line) => line.key)).toEqual(['message-id-0001', 't3']);
  });

  it('replaces a retried message by its client id even before it had a position', () => {
    const failed = [exchangeTurn(exchange({ status: 'failed' }))] as CallTurn[];
    const after = applyReply(failed, response(), exchange());
    expect(after.filter((line) => line.role === 'trainee')).toHaveLength(1);
    expect(after[0]).toMatchObject({ index: 2, status: 'sent' });
  });
});

describe('withInterrupted', () => {
  it('marks only customer turns that were cut short, and keeps every other turn as it was', () => {
    const turns = turnsFromSession(new FakeServer({ traineeTurns: 1 }).session());
    const marked = withInterrupted(turns, [3, 2]);
    expect(marked.map((line) => line.interrupted)).toEqual([false, false, true]);
    expect(marked[0]).toBe(turns[0]);
    expect(marked[1]).toBe(turns[1]);
    expect(marked[2]).not.toBe(turns[2]);
    // Clearing the mark gives back an equal turn.
    expect(withInterrupted(marked, [])[2]).toEqual(turns[2]);
  });
});

describe('the mood trace', () => {
  it('starts with how the customer is now, once per customer turn, and never repeats a turn', () => {
    const session = new FakeServer({ traineeTurns: 1 }).session();
    expect(initialStateHistory(session)).toEqual([{ turnIndex: 3, band: 'calm', label: 'Calm' }]);
    expect(initialStateHistory({ ...session, turns: [] })).toEqual([]);

    const point = statePoint(5, publicState('angry'));
    expect(point).toEqual({ turnIndex: 5, band: 'angry', label: 'Angry' });
    const once = appendStatePoint(initialStateHistory(session), point);
    expect(once.map((entry) => entry.turnIndex)).toEqual([3, 5]);
    expect(appendStatePoint(once, point)).toEqual(once);
  });
});
