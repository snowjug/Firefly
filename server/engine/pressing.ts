import type { CustomerGenerationContext } from './pipeline.ts';
import type { Flavour } from './plan.ts';
import type { Tone } from './tone.ts';

// How much the customer asks for in the course of a call: who owns the case, when they will hear
// back, whether anything has happened. A real customer asks, waits for the answer, and asks again
// if it does not come; they do not ask in every reply, and they stop once they have been told. How
// soon and how often depends on their mood: a calm customer rarely asks, an upset one asks more,
// but no one asks in two replies running. A first call does not start asking until the engineer has
// got to grips with the problem.
//
// One place decides this for every kind of ask (a push for an owner, a time or an update, and the
// lines of personality that ask for a plan or a name), so that they cannot add up to a request in
// every reply. What the call is for is exempt: a customer ringing to close a case does not let it
// close without hearing what changed (see stage.ts).

/** Lines of personality that ask for something. The others are worry, urgency or a challenge. */
const ASKING: ReadonlySet<Flavour> = new Set<Flavour>([
  'timeline-worry',
  'wants-owner',
  'no-progress',
  'plan',
  'escalate',
]);

export const isAsking = (flavour: Flavour | null): flavour is Flavour =>
  flavour !== null && ASKING.has(flavour);

interface Spacing {
  /** Trainee turns between one ask and the next. */
  gap: number;
  /** The engineer's turn before which a customer does not ask for what the call is not about. */
  notBefore: number;
}

const SPACING: Record<Tone, Spacing> = {
  calm: { gap: 6, notBefore: 7 },
  worried: { gap: 3, notBefore: 0 },
  firm: { gap: 3, notBefore: 0 },
  hot: { gap: 2, notBefore: 0 },
};

/** What a first call has to have covered before the customer starts asking for things. */
const SCOPING_TOPICS = 3;

export interface Pressing {
  /** The engineer has named an owner and given a time: there is nothing left to ask for. */
  committed: boolean;
  /**
   * The customer may ask for something in this reply: enough turns since they last did (or raised
   * a concern), the engineer has scoped a first call, and no curveball is being raised or repeated.
   */
  open: boolean;
  /** See `Spacing`. */
  notBefore: number;
}

export function pressingOf(ctx: CustomerGenerationContext, tone: Tone): Pressing {
  const { scenario, runtime, curveball, traineeTurnNumber } = ctx;
  const { gap, notBefore } = SPACING[tone];
  const last = Math.max(
    0,
    runtime.asksForTimelineAtTurn,
    runtime.lastCurveballTurn,
    ...Object.values(runtime.pushes),
  );
  const scoped =
    scenario.config.callStage !== 'first-contact' ||
    Object.keys(runtime.askedIntents).length >= SCOPING_TOPICS;
  return {
    committed: runtime.customer.ownershipStated && runtime.customer.nextStepsStated,
    open:
      (last === 0 || traineeTurnNumber - last >= gap) &&
      scoped &&
      !curveball.fired &&
      !curveball.followUp,
    notBefore,
  };
}

/** Whether the customer may ask for something this turn that the call was not made to ask for. */
export const mayAsk = (pressing: Pressing, effectiveTurn: number): boolean =>
  pressing.open && !pressing.committed && effectiveTurn >= pressing.notBefore;
