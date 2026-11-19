import { useCallback, useReducer } from 'react';
import type {
  PublicStateDTO,
  SendMessageResponse,
  SessionDTO,
  TurnDTO,
} from '#shared/domain/api.ts';
import type { RedactionKind } from '#shared/domain/text.ts';
import { api, isApiError } from '../../lib/api.ts';

// Conversation state for an active call. Messages are shown immediately, then confirmed by the
// server. A message that fails keeps its client id, so retrying can never create a duplicate.

export interface ChatTurn {
  key: string;
  index: number | null;
  role: 'customer' | 'trainee';
  text: string;
  createdAt: string;
  status: 'sent' | 'sending' | 'failed';
  clientMessageId?: string;
  /** The message is stored on the server; only the customer's reply is missing. */
  saved?: boolean;
  error?: string;
}

export interface ChatShift {
  /** The customer turn after which this change appeared. */
  afterKey: string;
  kind: 'band' | 'silent';
  /** For a band change: the customer's mood before and after. */
  from?: { id: PublicStateDTO['band']['id']; label: string };
  to?: { id: PublicStateDTO['band']['id']; label: string };
  direction?: 'tenser' | 'calmer';
}

export interface CallState {
  turns: ChatTurn[];
  state: PublicStateDTO;
  turnsRemaining: number | null;
  pending: boolean;
  announcement: string;
  limitReached: boolean;
  /** How many customer replies have arrived since the call was opened. Drives a gentle pulse. */
  replies: number;
  /** How many times a new signal was found since the call was opened. */
  discoveries: number;
  /** Customer turns whose reply brought a signal to light. Used in guided practice only. */
  signalKeys: string[];
  /** Changes in the customer's mood or silence, in order. Used in guided practice only. */
  shifts: ChatShift[];
}

export type CallAction =
  | { type: 'sending'; turn: ChatTurn }
  | { type: 'retrying'; key: string }
  | { type: 'sent'; key: string; response: SendMessageResponse; announcement: string }
  | { type: 'failed'; key: string; error: string; saved: boolean }
  | { type: 'limit'; key: string };

const fromServer = (turn: TurnDTO): ChatTurn => ({
  key: `t${turn.index}`,
  index: turn.index,
  role: turn.role,
  text: turn.text,
  createdAt: turn.createdAt,
  status: 'sent',
});

export const AWAITING_REPLY_MESSAGE =
  'Your last message was saved, but the customer has not replied yet.';

export function initialCallState(session: SessionDTO, maxTurns: number | null): CallState {
  const turns = session.turns.map(fromServer);
  const awaiting = session.awaitingReply;
  if (awaiting) {
    const at = turns.findIndex((t) => t.index === awaiting.turnIndex);
    const turn = turns[at];
    if (turn) {
      turns[at] = {
        ...turn,
        key: awaiting.clientMessageId,
        status: 'failed',
        saved: true,
        clientMessageId: awaiting.clientMessageId,
        error: AWAITING_REPLY_MESSAGE,
      };
    }
  }
  return {
    turns,
    state: session.state,
    turnsRemaining: maxTurns === null ? null : Math.max(0, maxTurns - session.traineeTurns),
    pending: false,
    announcement: '',
    limitReached: maxTurns !== null && session.traineeTurns >= maxTurns,
    replies: 0,
    discoveries: 0,
    signalKeys: [],
    shifts: [],
  };
}

const BAND_ORDER = ['calm', 'concerned', 'frustrated', 'angry', 'escalating'] as const;

/** What changed in the customer's visible state between two replies. */
function shiftsBetween(
  before: PublicStateDTO,
  after: PublicStateDTO,
  afterKey: string,
): ChatShift[] {
  const shifts: ChatShift[] = [];
  if (before.band.id !== after.band.id) {
    shifts.push({
      afterKey,
      kind: 'band',
      from: before.band,
      to: after.band,
      direction:
        BAND_ORDER.indexOf(after.band.id) > BAND_ORDER.indexOf(before.band.id)
          ? 'tenser'
          : 'calmer',
    });
  }
  if (!before.silent && after.silent) shifts.push({ afterKey, kind: 'silent' });
  return shifts;
}

export function callReducer(current: CallState, action: CallAction): CallState {
  switch (action.type) {
    case 'sending':
      return { ...current, turns: [...current.turns, action.turn], pending: true };
    case 'retrying':
      return {
        ...current,
        pending: true,
        turns: current.turns.map((t) =>
          t.key === action.key ? { ...t, status: 'sending', error: undefined } : t,
        ),
      };
    case 'sent': {
      const { response } = action;
      const turns = current.turns.map((t) =>
        t.key === action.key
          ? { ...fromServer(response.traineeTurn), key: t.key, clientMessageId: t.clientMessageId }
          : t,
      );
      const customer = fromServer(response.customerTurn);
      const found = response.state.discoveredCount > current.state.discoveredCount;
      return {
        turns: [...turns, customer],
        state: response.state,
        turnsRemaining: response.turnsRemaining,
        pending: false,
        announcement: action.announcement,
        limitReached: response.turnsRemaining <= 0,
        replies: current.replies + 1,
        discoveries: found ? current.discoveries + 1 : current.discoveries,
        signalKeys: found ? [...current.signalKeys, customer.key] : current.signalKeys,
        shifts: [...current.shifts, ...shiftsBetween(current.state, response.state, customer.key)],
      };
    }
    case 'failed':
      return {
        ...current,
        pending: false,
        turns: current.turns.map((t) =>
          t.key === action.key
            ? { ...t, status: 'failed', saved: action.saved, error: action.error }
            : t,
        ),
      };
    case 'limit':
      return {
        ...current,
        pending: false,
        turnsRemaining: 0,
        limitReached: true,
        turns: current.turns.filter((t) => t.key !== action.key),
      };
  }
}

export interface DeliveryResult {
  ok: boolean;
  redactions: RedactionKind[];
}

export function useCall(
  session: SessionDTO,
  options: { maxTurns: number | null; onEnded(): void },
) {
  const { maxTurns, onEnded } = options;
  const [chat, dispatch] = useReducer(callReducer, undefined, () =>
    initialCallState(session, maxTurns),
  );
  const sessionId = session.id;
  const personaName = session.scenario.persona.name;

  const deliver = useCallback(
    async (key: string, clientMessageId: string, text: string): Promise<DeliveryResult> => {
      try {
        const response = await api.sendMessage(sessionId, { text, clientMessageId });
        dispatch({
          type: 'sent',
          key,
          response,
          announcement: `${personaName} replied: ${response.customerTurn.text}`,
        });
        return { ok: true, redactions: response.redactions };
      } catch (error) {
        if (isApiError(error) && error.code === 'turn_limit_reached') {
          dispatch({ type: 'limit', key });
        } else if (isApiError(error) && error.code === 'session_not_active') {
          dispatch({ type: 'failed', key, error: error.message, saved: false });
          onEnded();
        } else {
          const details = isApiError(error)
            ? (error.details as { traineeTurn?: TurnDTO } | undefined)
            : undefined;
          dispatch({
            type: 'failed',
            key,
            error: isApiError(error)
              ? error.message
              : 'Something went wrong. Your message is kept so you can try again.',
            saved: Boolean(details?.traineeTurn),
          });
        }
        return { ok: false, redactions: [] };
      }
    },
    [sessionId, personaName, onEnded],
  );

  const send = useCallback(
    (text: string): Promise<DeliveryResult> => {
      const clientMessageId = crypto.randomUUID();
      dispatch({
        type: 'sending',
        turn: {
          key: clientMessageId,
          index: null,
          role: 'trainee',
          text,
          createdAt: new Date().toISOString(),
          status: 'sending',
          clientMessageId,
        },
      });
      return deliver(clientMessageId, clientMessageId, text);
    },
    [deliver],
  );

  const retry = useCallback(
    (key: string): Promise<DeliveryResult> => {
      const turn = chat.turns.find((t) => t.key === key);
      if (!turn?.clientMessageId) return Promise.resolve({ ok: false, redactions: [] });
      dispatch({ type: 'retrying', key });
      return deliver(key, turn.clientMessageId, turn.text);
    },
    [chat.turns, deliver],
  );

  return { chat, send, retry };
}
