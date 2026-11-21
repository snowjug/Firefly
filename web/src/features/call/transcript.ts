import type {
  PublicStateDTO,
  SendMessageResponse,
  SessionDTO,
  TurnDTO,
} from '#shared/domain/api.ts';
import type { InputMode } from '#shared/domain/speech.ts';
import type { CallStatePoint, CallTurn } from './contract.ts';
import type { Exchange } from './machine.ts';

// The transcript as the call screen shows it, built from what the server holds (`confirmed` turns)
// plus the one message that is being said, typed or retried (the machine's `exchange`). Pure
// functions. Turns the server holds are only ever added or replaced by index or client message id,
// so the same reply arriving twice can never show a turn twice.

interface TurnOptions {
  key?: string;
  clientMessageId?: string | null;
  inputMode?: InputMode;
}

export function toCallTurn(turn: TurnDTO, options: TurnOptions = {}): CallTurn {
  return {
    key: options.key ?? `t${turn.index}`,
    index: turn.index,
    role: turn.role,
    text: turn.text,
    // An older server may not say how a turn arrived.
    inputMode: (turn.inputMode as InputMode | undefined) ?? options.inputMode ?? 'text',
    createdAt: turn.createdAt,
    status: 'sent',
    clientMessageId: options.clientMessageId ?? null,
    interrupted: false,
  };
}

/**
 * The turns the server holds, without the trainee's message that is still waiting for a reply: that
 * one belongs to the machine, which can retry it.
 */
export function turnsFromSession(session: SessionDTO): CallTurn[] {
  const awaiting = session.awaitingReply?.turnIndex;
  return session.turns.filter((turn) => turn.index !== awaiting).map((turn) => toCallTurn(turn));
}

/** The message in flight as a transcript line. Spoken words show as they are recognised. */
export function exchangeTurn(exchange: Exchange, interim = ''): CallTurn {
  return {
    key: exchange.id,
    index: exchange.index,
    role: 'trainee',
    text: exchange.text || (exchange.status === 'transcribing' ? interim : ''),
    inputMode: exchange.inputMode,
    createdAt: exchange.createdAt,
    status: exchange.status,
    clientMessageId: exchange.id,
    interrupted: false,
  };
}

/**
 * Adds the server's answer to an exchange. The trainee's turn keeps the key it had while it was
 * being sent and shows the text the server stored (with personal details removed); the customer's
 * turn is added once. Applying the same answer again changes nothing.
 */
export function applyReply(
  turns: readonly CallTurn[],
  response: SendMessageResponse,
  exchange: Exchange,
): CallTurn[] {
  const trainee = toCallTurn(response.traineeTurn, {
    key: exchange.id,
    clientMessageId: exchange.id,
    inputMode: exchange.inputMode,
  });
  const customer = toCallTurn(response.customerTurn);
  let next = [...turns];
  const at = next.findIndex(
    (turn) =>
      turn.clientMessageId === exchange.id ||
      (turn.role === 'trainee' && turn.index === trainee.index),
  );
  if (at >= 0) next[at] = trainee;
  else next = [...next, trainee];
  if (!next.some((turn) => turn.role === 'customer' && turn.index === customer.index)) {
    next = [...next, customer];
  }
  return next;
}

/** Marks which customer turns were cut short. Turns that do not change keep their identity. */
export function withInterrupted(
  turns: readonly CallTurn[],
  interrupted: readonly number[],
): CallTurn[] {
  return turns.map((turn) => {
    const cut = turn.role === 'customer' && turn.index !== null && interrupted.includes(turn.index);
    return cut === turn.interrupted ? turn : { ...turn, interrupted: cut };
  });
}

export function statePoint(turnIndex: number, state: PublicStateDTO): CallStatePoint {
  return { turnIndex, band: state.band.id, label: state.band.label };
}

/** The customer's mood now. The server only says how they are now, so that is the whole history. */
export function initialStateHistory(session: SessionDTO): CallStatePoint[] {
  const latest = session.turns.findLast((turn) => turn.role === 'customer');
  return latest ? [statePoint(latest.index, session.state)] : [];
}

export function appendStatePoint(
  history: readonly CallStatePoint[],
  point: CallStatePoint,
): CallStatePoint[] {
  return history.some((existing) => existing.turnIndex === point.turnIndex)
    ? [...history]
    : [...history, point];
}
