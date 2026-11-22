import type { EngineRuntime } from './types.ts';

/**
 * Sessions saved before the natural customer conversation hold a runtime without the fields added
 * since. This fills them in with the values that match how those sessions behaved: their opening
 * was a single message that already gave the reason for the call, so they continue as a call that
 * is under way, with nothing remembered about earlier questions or commitments. It never invents
 * content, and a runtime that already has the fields is returned as it is.
 */
export function normaliseRuntime(stored: EngineRuntime): EngineRuntime {
  const old = stored as Partial<EngineRuntime> & EngineRuntime;
  return {
    ...old,
    opening: old.opening ?? 'reason-given',
    greetingTurns: old.greetingTurns ?? 0,
    asked: old.asked ?? [],
    commitments: old.commitments ?? [],
    awaitingConfirmation: old.awaitingConfirmation ?? false,
    stageMet: old.stageMet ?? [],
    pushes: old.pushes ?? {},
    assumptionsCorrected: old.assumptionsCorrected ?? [],
    misunderstandings: old.misunderstandings ?? [],
    lastToldIds: old.lastToldIds ?? [],
    closingAtTurn: old.closingAtTurn ?? 0,
  };
}
