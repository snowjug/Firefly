import type { TurnClassification } from '#shared/domain/classification.ts';
import type { EffectiveScenario } from '#shared/domain/config.ts';
import { expects } from './expectation.ts';
import {
  ACKNOWLEDGES_HISTORY,
  ASKS_AGREEMENT,
  CADENCE,
  CONFIRMS_RESOLUTION,
  EXPLAINS_CAUSE,
  EXPLAINS_ESCALATION,
  FROM_SCRATCH,
  GIVES_UPDATE,
  PRIOR_CONTEXT,
  prep,
  splitSentences,
} from './lexicon.ts';
import { overlap, questionWords } from './textutil.ts';
import type { Pressing } from './pressing.ts';
import type { Effect } from './state.ts';
import type { EngineRuntime } from './types.ts';

// What each call stage expects of the engineer (brief section 23). A first contact expects an
// introduction, scoping, an impact check and clear ownership, which the general rules in state.ts
// already reward. The other three stages add expectations of their own, handled here:
//
//   follow-up   awareness of the earlier contact, a progress update, no needless repetition
//   escalated   the earlier experience acknowledged, the escalation explained, an update cadence
//   closure     the fix confirmed, agreement to close checked, what changed explained
//
// Each expectation counts once. The customer notices the ones that are missing and, at the right
// moment, asks for them.

export interface StageSignals {
  priorContext: boolean; // shows they know about the earlier case
  acknowledgesHistory: boolean; // acknowledges what the customer has already been through
  givesUpdate: boolean; // a progress update
  explainsEscalation: boolean;
  cadence: boolean; // how often the customer will hear back
  confirmsResolution: boolean;
  asksAgreement: boolean; // checks the customer agrees the case can be closed
  explainsCause: boolean; // what changed or what caused it
  fromScratch: boolean; // asks the customer to tell the whole story again
  repeatsPrior: string | null; // something already tried before the call, suggested again
  asksPriorAttempts: boolean; // asks what has been tried so far
  asksPreviousContact: boolean; // asks whether the customer has been in touch before
}

export function noStageSignals(): StageSignals {
  return {
    priorContext: false,
    acknowledgesHistory: false,
    givesUpdate: false,
    explainsEscalation: false,
    cadence: false,
    confirmsResolution: false,
    asksAgreement: false,
    explainsCause: false,
    fromScratch: false,
    repeatsPrior: null,
    asksPriorAttempts: false,
    asksPreviousContact: false,
  };
}

// Words that name an action. One of them in common with something already tried is enough to say
// the engineer is suggesting it again; other words need two.
const ACTION_STEMS = new Set(
  'restart reboot reset reinstall clear updat repair delet remov disabl enabl rebuild refresh retry'.split(
    ' ',
  ),
);

function priorAttempt(scenario: EffectiveScenario, text: string): string | null {
  const wanted = questionWords(text);
  for (const entry of scenario.previousTroubleshooting) {
    const words = questionWords(entry);
    const shared = words.filter((w) => wanted.includes(w));
    if (shared.length >= 2 || (shared.length === 1 && ACTION_STEMS.has(shared[0] as string))) {
      return entry;
    }
    if (overlap(words, wanted) >= 0.5) return entry;
  }
  return null;
}

export function stageSignals(
  text: string,
  c: TurnClassification,
  scenario: EffectiveScenario,
): StageSignals {
  const lower = prep(text);
  // What shows the engineer knows the case is something they say, not something they ask:
  // "Have you contacted us before?" is the opposite of having read the case.
  const said = prep(
    splitSentences(text)
      .filter((s) => !s.trim().endsWith('?'))
      .join(' '),
  );
  const suggests = c.troubleshooting || c.discoveryIntents.includes('already_tried');
  return {
    priorContext: PRIOR_CONTEXT.test(said),
    acknowledgesHistory: ACKNOWLEDGES_HISTORY.test(said),
    givesUpdate: GIVES_UPDATE.test(said),
    explainsEscalation: EXPLAINS_ESCALATION.test(said),
    cadence: CADENCE.test(said),
    confirmsResolution: CONFIRMS_RESOLUTION.test(lower),
    asksAgreement: ASKS_AGREEMENT.test(lower),
    explainsCause: EXPLAINS_CAUSE.test(said),
    fromScratch: FROM_SCRATCH.test(lower),
    repeatsPrior: suggests ? priorAttempt(scenario, text) : null,
    asksPriorAttempts: c.discoveryIntents.includes('already_tried'),
    asksPreviousContact: c.discoveryIntents.includes('previous_contact'),
  };
}

export interface StageEffects {
  effects: Effect[];
  /** Expectations met for the first time in this turn. */
  met: string[];
}

export function stageEffects(args: {
  scenario: EffectiveScenario;
  runtime: EngineRuntime;
  signals: StageSignals;
  c: TurnClassification;
  /** The engineer's turn number, not counting a first exchange that was only a greeting. */
  effectiveTurn: number;
  /** The customer answered from what the case already records, and nothing more. */
  fromRecordOnly: boolean;
  /** A real repeat, which is charged for already. */
  repeated: boolean;
}): StageEffects {
  const { scenario, runtime, signals: s, c, effectiveTurn, fromRecordOnly, repeated } = args;
  const stage = scenario.config.callStage;
  const effects: Effect[] = [];
  const met: string[] = [];
  const first = (id: string, when: boolean, effect: Effect) => {
    if (!when || runtime.stageMet.includes(id) || met.includes(id)) return;
    met.push(id);
    effects.push(effect);
  };

  if (stage === 'follow-up') {
    first('prior-context', s.priorContext || s.acknowledgesHistory, {
      category: 'rapport',
      reason: 'Showed they knew about the earlier case',
      temperature: -5,
      trust: 5,
    });
    first('update', s.givesUpdate, {
      category: 'next-steps',
      reason: 'Gave a progress update on the case',
      temperature: -5,
      trust: 4,
      confidence: 5,
    });
  } else if (stage === 'escalated') {
    first('history-acknowledged', s.acknowledgesHistory, {
      category: 'empathy',
      reason: 'Acknowledged what the customer had already been through',
      temperature: -7,
      trust: 6,
      patience: 4,
    });
    first('prior-context', s.priorContext && !s.acknowledgesHistory, {
      category: 'rapport',
      reason: 'Showed they knew about the earlier contacts',
      temperature: -3,
      trust: 3,
    });
    first('escalation-explained', s.explainsEscalation, {
      category: 'ownership',
      reason: 'Explained what the escalation means',
      temperature: -4,
      trust: 4,
      confidence: 6,
    });
    first('cadence', s.cadence, {
      category: 'next-steps',
      reason: 'Gave a specific update cadence',
      temperature: -5,
      trust: 4,
      ownershipConfidence: 8,
    });
  } else if (stage === 'closure') {
    first('resolution-confirmed', s.confirmsResolution, {
      category: 'closing',
      reason: 'Confirmed that the issue was resolved',
      temperature: -4,
      trust: 4,
    });
    first('agreement-checked', s.asksAgreement, {
      category: 'closing',
      reason: 'Checked that the customer agreed to close the case',
      temperature: -3,
      trust: 4,
    });
    first('cause-explained', s.explainsCause, {
      category: 'closing',
      reason: 'Explained what changed',
      temperature: -4,
      trust: 4,
      clarification: 8,
    });
    const closing = c.wrapsUp || c.asksAnythingElse;
    const covered = [...runtime.stageMet, ...met];
    if (
      closing &&
      effectiveTurn <= 3 &&
      !covered.includes('resolution-confirmed') &&
      !covered.includes('cause-explained')
    ) {
      effects.push({
        category: 'closing',
        reason: 'Tried to close before confirming it works or explaining what changed',
        temperature: 3,
        trust: -2,
        patience: -3,
      });
    }
  }

  // A call back has the earlier contact and what was tried on the case. Asking for it again, or
  // suggesting what has been done already, tells the customer the case was not read.
  if (stage !== 'first-contact') {
    if (s.repeatsPrior) {
      effects.push({
        category: 'repetition',
        reason: 'Suggested something the customer had already tried',
        temperature: 4,
        trust: -3,
        patience: -4,
      });
    } else if (s.asksPriorAttempts && fromRecordOnly && !repeated) {
      effects.push({
        category: 'repetition',
        reason: 'Asked what had been tried, which was already on the case',
        temperature: 2,
        trust: -2,
        patience: -2,
      });
    }
    if (s.asksPreviousContact && !repeated) {
      effects.push({
        category: 'repetition',
        reason: 'Asked about earlier contact that was already on the case',
        temperature: 3,
        trust: -3,
        patience: -3,
      });
    }
    if (s.fromScratch) {
      effects.push({
        category: 'repetition',
        reason: 'Asked the customer to tell the whole story again',
        temperature: 5,
        trust: -4,
        patience: -5,
      });
    }
  }
  return { effects, met };
}

/** What a customer asks for when the engineer has not offered it. */
export type StagePush =
  'update' | 'history' | 'escalation' | 'cadence' | 'cause' | 'resolution' | 'owner';

const PUSH_GAP = 3; // trainee turns before the customer asks for the same thing again

export function stagePush(args: {
  scenario: EffectiveScenario;
  runtime: EngineRuntime;
  /** What was met in this turn as well as before it. */
  metNow: string[];
  effectiveTurn: number;
  traineeTurnNumber: number;
  hotTone: boolean; // firm or hot: the customer wants an owner sooner
  /** The engineer is wrapping up the call. */
  closing: boolean;
  /** Whether and when the customer asks for anything at all (see pressing.ts). */
  pressing: Pressing;
}): StagePush | null {
  const { scenario, runtime, metNow, effectiveTurn, traineeTurnNumber, hotTone, closing } = args;
  const { pressing } = args;
  const done = new Set([...runtime.stageMet, ...metNow]);
  const due = (id: StagePush) => traineeTurnNumber - (runtime.pushes[id] ?? -PUSH_GAP) >= PUSH_GAP;
  const stage = scenario.config.callStage;
  const ownerOpen = !runtime.customer.ownershipStated;
  // The stage's own expectations, asked for once the customer is free to ask for anything, and
  // never after the engineer has named an owner and given a time. What the customer asks for that
  // the call was not made to ask for (an owner, how often they will hear) waits for a calm
  // customer's later turns.
  const may = pressing.open && !pressing.committed;
  const late = (turn: number) => effectiveTurn >= Math.max(turn, pressing.notBefore);

  if (stage === 'follow-up') {
    if (may && !done.has('update') && effectiveTurn >= 3 && due('update')) return 'update';
    if (may && ownerOpen && late(4) && due('owner')) return 'owner';
  } else if (stage === 'escalated') {
    if (may && !done.has('history-acknowledged') && effectiveTurn >= 2 && due('history')) {
      return 'history';
    }
    if (may && ownerOpen && late(3) && due('owner')) return 'owner';
    if (may && !done.has('escalation-explained') && effectiveTurn >= 4 && due('escalation')) {
      return 'escalation';
    }
    if (may && !done.has('cadence') && late(5) && due('cadence')) return 'cadence';
  } else if (stage === 'closure') {
    // A customer who called to understand what changed does not let the call close without it.
    if (
      !done.has('cause-explained') &&
      (closing || (pressing.open && effectiveTurn >= 3 && due('cause')))
    ) {
      return 'cause';
    }
    if (
      !done.has('resolution-confirmed') &&
      (closing || (pressing.open && effectiveTurn >= 4 && due('resolution')))
    ) {
      return 'resolution';
    }
  } else if (
    may &&
    ownerOpen &&
    late(4) &&
    (hotTone ||
      scenario.config.impact === 'high' ||
      scenario.config.style === 'demanding' ||
      expects(scenario, 'ownership')) &&
    due('owner')
  ) {
    return 'owner';
  }
  return null;
}
