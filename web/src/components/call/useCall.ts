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

export interface CallState {
  turns: ChatTurn[];
  state: PublicStateDTO;
  turnsRemaining: number | null;
  pending: boolean;
  announcement: string;
  limitReached: boolean;
}

type Action =
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
  };
}

function reducer(current: CallState, action: Action): CallState {
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
      return {
        turns: [...turns, fromServer(response.customerTurn)],
        state: response.state,
        turnsRemaining: response.turnsRemaining,
        pending: false,
        announcement: action.announcement,
        limitReached: response.turnsRemaining <= 0,
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
  const [chat, dispatch] = useReducer(reducer, undefined, () =>
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
