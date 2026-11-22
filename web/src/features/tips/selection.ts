import type { Tip, TipPhase } from './tips.ts';

// Which tip comes up, from public things only: the stage the call was set to (the person chose it in
// the brief) and how many messages the trainee has sent. Never a hidden fact, the customer's mood, how
// much has been found out, when a complication is due or which product it is: a tip chosen from any of
// those would be a hint. This file takes plain values and imports no scenario or state.

/** The call stage as the brief names it. Declared here so this folder imports no scenario vocabulary. */
export type TipCallStage = 'first-contact' | 'follow-up' | 'escalated' | 'closure';

/**
 * From which message count each phase is the one a call is likely to need, for each stage. A first
 * call opens, scopes, steadies the customer, makes things clear, takes ownership and closes; a call
 * that has been escalated steadies the customer sooner; a call to close a case gets to clarity and
 * closing quickly.
 */
const PLAN: Record<TipCallStage, ReadonlyArray<readonly [fromMessage: number, phase: TipPhase]>> = {
  'first-contact': [
    [0, 'opening'],
    [1, 'scoping'],
    [4, 'empathy'],
    [6, 'clarity'],
    [9, 'ownership'],
    [12, 'closing'],
  ],
  'follow-up': [
    [0, 'opening'],
    [1, 'ownership'],
    [3, 'scoping'],
    [6, 'clarity'],
    [8, 'closing'],
  ],
  escalated: [
    [0, 'opening'],
    [1, 'empathy'],
    [4, 'ownership'],
    [7, 'clarity'],
    [9, 'closing'],
  ],
  closure: [
    [0, 'opening'],
    [1, 'clarity'],
    [3, 'ownership'],
    [5, 'closing'],
  ],
};

/** The phase of a call at this point: the last one whose message count has been reached. */
export function phaseFor(stage: TipCallStage, traineeTurns: number): TipPhase {
  const plan = PLAN[stage] ?? PLAN['first-contact'];
  const sent = Number.isFinite(traineeTurns) ? Math.max(0, Math.floor(traineeTurns)) : 0;
  let phase = plan[0][1];
  for (const [from, next] of plan) if (sent >= from) phase = next;
  return phase;
}

export interface TipContext {
  stage: TipCallStage;
  /** How many of the trainee's messages the server holds. */
  traineeTurns: number;
}

/** The first tip of the phase the call is in: where the deck starts, and where a resumed call picks up. */
export function startingTip(tips: readonly Tip[], context: TipContext): number {
  const phase = phaseFor(context.stage, context.traineeTurns);
  const found = tips.findIndex((tip) => tip.phase === phase);
  return found === -1 ? 0 : found;
}

/**
 * The tip that comes up when a customer turn has finished: the first one in the phase the call is in
 * that has not been shown yet, and once the phase has been shown, the tip after the current one. It
 * is never the current tip when there is another, and it is the same every time for the same call.
 */
export function nextTip(
  tips: readonly Tip[],
  context: TipContext & { current: number; seen: ReadonlySet<number> },
): number {
  if (tips.length === 0) return 0;
  const phase = phaseFor(context.stage, context.traineeTurns);
  const fresh = tips.findIndex(
    (tip, index) => tip.phase === phase && !context.seen.has(index) && index !== context.current,
  );
  if (fresh !== -1) return fresh;
  return (context.current + 1) % tips.length;
}
