import type { TurnClassification } from '#shared/domain/classification.ts';
import type { EffectiveScenario } from '#shared/domain/config.ts';
import type { CommunicationStyle } from '#shared/domain/vocab.ts';
import type { HiddenFact } from '#shared/domain/scenario.ts';
import { sentences } from '#shared/domain/text.ts';
import { IN_RECORD_IDS, type TellItem, type WithholdReason } from './discovery.ts';
import { expects } from './expectation.ts';
import type { TurnAnalysis } from './memory.ts';
import { urgencyWarrantsImpact } from './opening.ts';
import type { CustomerGenerationContext } from './pipeline.ts';
import { rngFor } from './rng.ts';
import { mayAsk, pressingOf, type Pressing } from './pressing.ts';
import { stagePush, type StagePush } from './stage.ts';
import { bestSentenceFor, firstSentenceOf } from './textutil.ts';
import { toneOf, type Tone } from './tone.ts';
import type { Commitment } from './types.ts';

// What the customer does in one reply, decided once from the engine's results, for both ways of
// writing it. The demo composer (mock/customer.ts) turns a plan into words from phrase banks and
// the authored lines; the live prompt (prompts/) turns the same plan into guidance for a model. So
// demo and live customers obey the same scenario: they say the same facts, react to the same
// things and ask for the same things, and differ only in how they put it.
//
// A plan is a pure function of the generation context (it draws its own seeded random numbers), so
// it can be asked for as often as needed and always gives the same answer.

/** What the customer remembers having said when they asked the engineer if they need anything. */
export const OFFER_HELP = 'offer-help';

/** How the customer reacts to what the engineer just did, strongest first. */
export type Reaction =
  | 'blamed'
  | 'dismissed'
  | 'confused' // a novice does not follow a term
  | 'asks-to-repeat' // a non-native speaker asks for a simpler version
  | 'repeated' // the engineer asked something the customer had already answered
  | 'already-tried' // suggested something the customer had already done
  | 'in-record' // asked for what the case already records: "as I told you before"
  | 'from-scratch' // asked the customer to tell the whole story again, on a case that has it
  | 'premature-fix'
  | 'basics' // an expert hears the obvious
  | 'unsupported-promise'
  | 'conflicting-commitment' // a time that is not the one given earlier
  | 'vague-commitment'
  | 'summary-wrong'
  | 'echo' // says the engineer's commitment back, as a question
  | 'ownership'
  | 'next-steps'
  | 'knows-case' // the engineer knows about the earlier contact
  | 'update-given'
  | 'escalation-explained'
  | 'cadence'
  | 'resolution' // the engineer checked that it works
  | 'agreement' // the engineer checked that the case can be closed
  | 'cause' // the engineer explained what changed
  | 'empathy-specific'
  | 'empathy-generic'
  | 'impact-acknowledged'
  | 'summary-right'
  | 'confirmed' // a request to confirm, answered
  | 'plan-accepted' // a clear commitment taken in briefly, with its time
  | 'echo-confirmed' // the engineer said yes to "so you'll do that?"
  | 'offer-answered' // the engineer answered "is there anything you need from our side?"
  | 'assumption-accepted'
  | 'assumption-challenged'
  | 'follow-up' // the same topic again, asked a new way: answered without irritation
  | 'self-correction' // the engineer put something right
  | 'instruction' // the engineer asked the customer to do something
  | 'closing';

/** A line of personality that is not a reply to the last message. At most one per reply. */
export type Flavour =
  | 'timeline-worry' // anxious: how long will this take?
  | 'impact-worry' // anxious: what will this do to us?
  | 'urgency' // anxious: says again how urgent it is
  | 'no-progress' // frustrated: cites the lack of progress
  | 'wants-owner' // frustrated: who is going to own this?
  | 'challenge' // angry or demanding: will not accept a vague answer
  | 'escalate' // angry: wants it escalated
  | 'plan' // demanding: wants a plan and a time
  | 'assurance'; // closure, anxious or demanding: wants to be sure it will not come back

export type PlanPush = 'timeline' | StagePush;

export type SayKind =
  | 'detail' // a personal detail the engineer asked for
  | 'reason' // why the customer called
  | 'impact' // what is at stake
  | 'full'
  | 'partial'
  | 'known'
  | 'hint'
  | 'vague'
  | 'vague-firm'
  | 'checkable'
  | 'unknown'
  | 'irrelevant'
  | 'assumption'
  | 'record' // what the case already records, said again ("as I told you before")
  | 'reminder' // a short reminder of something already said
  | 'addition'; // something already said that the engineer's recap left out

/** Something the customer may say in this reply, and nothing else about the problem. */
export interface Sayable {
  kind: SayKind;
  /** The fact id, or the id of what the customer has now said (see `toldKnownFacts`). */
  id: string;
  text: string;
  /** A shorter way to say it, for a reply with room for only a sentence of it. */
  short?: string;
  /** Said first, then `text`: "Give me a moment." */
  checking?: string;
  /** Optional extra colour for a talkative customer. */
  colour?: string;
  /** An unknown fact: who would know. */
  whoKnows?: string;
  detail?: 'name' | 'organisation' | 'role' | 'case-reference';
  /** A detail the customer does not have (no case number to hand). */
  missing?: boolean;
}

export interface ReplyPlan {
  /** `silent`, `off-role` and `low-effort` replies are short and share no facts. */
  mode: 'normal' | 'silent' | 'off-role' | 'low-effort';
  /** `reason`: the engineer has answered the greeting, so the customer says why they called. */
  beat: 'reason' | 'normal';
  /** The engineer started without a greeting or introduction. */
  notice: boolean;
  reactions: Reaction[];
  say: Sayable[];
  /** Why the customer holds something back (trust or impact not yet acknowledged). */
  holds: WithholdReason[];
  /** The engineer asked something the customer has no information on. */
  notKnown: boolean;
  push: PlanPush | null;
  flavour: Flavour | null;
  /** A commitment to say back to the engineer as a question. */
  echo: Commitment | null;
  /**
   * A clear commitment to take in briefly, naming its time ("Okay. Three o'clock, then."), for a
   * customer who would not say it back. Never together with `echo`.
   */
  accept: Commitment | null;
  /**
   * The customer asks for a time after a vague commitment. It is the one ask the reaction makes, so
   * it is remembered with the other asks (see pressing.ts).
   */
  presses: boolean;
  /** How the engineer is closing the call, when they are. */
  close: CloseKind | null;
  /** The customer, being cooperative, asks once whether the engineer needs anything from them. */
  asksOffer: boolean;
  /** Who the customer can ask, from what they have already said, if the engineer asks what they can do. */
  offer: string | null;
  /** The customer's own offer to check with someone, to mention again when the call closes. */
  customerCheck: Commitment | null;
  /** The engineer's latest clear commitment, to mention when the call closes. */
  closingCommitment: Commitment | null;
  /** The term a novice asks about, when there is one. */
  term: string | null;
  tone: Tone;
  maxSentences: number;
}

const MAX_REACTIONS = 4;

// Reactions that are themselves a request to the engineer. A reply that has one does not also ask
// for something else: "Can you put that in everyday words? And who is taking this on?"
const ASKS_THE_ENGINEER: ReadonlySet<Reaction> = new Set<Reaction>([
  'confused',
  'asks-to-repeat',
  'vague-commitment',
  'conflicting-commitment',
  'echo',
]);

export function isSilent(ctx: CustomerGenerationContext): boolean {
  return ctx.curveball.fired?.type === 'go-silent' || ctx.runtime.customer.silentUntilEngaged;
}

/** How the engineer is ending the call: asking if that is all, wrapping up, or saying goodbye. */
export type CloseKind = 'asks-more' | 'wraps-up' | 'farewell';

/**
 * Whether the engineer is ending the call, as far as the customer can tell, and how. A recap that
 * ends by asking whether it is right is a question to answer, not a goodbye: the customer says it
 * is right and the call goes on. Saying goodbye is the end, even with a promise in the same breath.
 */
export function closeKindOf(
  c: Pick<TurnClassification, 'wrapsUp' | 'asksAnythingElse' | 'summarises' | 'askedQuestion'>,
  analysis?: Pick<TurnAnalysis, 'farewell' | 'asksCustomerSide'> &
    Partial<Pick<TurnAnalysis, 'anythingElseAboutCase'>>,
): CloseKind | null {
  if (analysis?.farewell) return 'farewell';
  // "Did you change anything else?" is counted as asking for anything else, and is not the end.
  const asksMore = c.asksAnythingElse && !analysis?.anythingElseAboutCase;
  if (asksMore || analysis?.asksCustomerSide) return 'asks-more';
  if (c.wrapsUp && !(c.summarises && c.askedQuestion)) return 'wraps-up';
  return null;
}

/** Whether the engineer is ending the call (see `closeKindOf`). */
export function closesCall(
  c: Pick<TurnClassification, 'wrapsUp' | 'asksAnythingElse' | 'summarises' | 'askedQuestion'>,
  analysis?: Pick<TurnAnalysis, 'farewell' | 'asksCustomerSide'> &
    Partial<Pick<TurnAnalysis, 'anythingElseAboutCase'>>,
): boolean {
  return closeKindOf(c, analysis) !== null;
}

// ---------------------------------------------------------------------------------------
// What may be said

export function fullStatement(fact: HiddenFact, style: CommunicationStyle): string {
  if (style === 'terse') return fact.statementTerse ?? firstSentenceOf(fact.statement);
  if (style === 'non-native') return fact.statementSimple ?? fact.statement;
  return fact.statement;
}

/** The words that reveal a hidden fact in the way this customer would say them. */
export function revealText(
  fact: HiddenFact,
  mode: 'full' | 'partial',
  style: CommunicationStyle,
): string {
  return mode === 'partial' ? (fact.partialStatement ?? '') : fullStatement(fact, style);
}

function tellSayable(item: TellItem, style: CommunicationStyle): Sayable {
  const terse = style === 'terse';
  const base = { id: item.id, text: terse ? firstSentenceOf(item.text) : item.text };
  switch (item.kind) {
    case 'vague':
      return { ...base, kind: item.firm ? 'vague-firm' : 'vague' };
    case 'checkable':
      return { ...base, kind: 'checkable', ...(item.checking ? { checking: item.checking } : {}) };
    case 'unknown':
      return { ...base, kind: 'unknown', ...(item.whoKnows ? { whoKnows: item.whoKnows } : {}) };
    default:
      if (style === 'non-native' && item.simple)
        return { ...base, kind: 'known', text: item.simple };
      if (style === 'talkative' && item.elaboration) {
        return { ...base, kind: 'known', colour: item.elaboration };
      }
      return { ...base, kind: 'known' };
  }
}

function told(ctx: CustomerGenerationContext, id: string): boolean {
  return (ctx.runtime.toldKnownFacts[id] ?? 0) > 0;
}

function detailSayables(ctx: CustomerGenerationContext): Sayable[] {
  const { persona, caseReference } = ctx.scenario;
  const asks = ctx.analysis.asks;
  const out: Sayable[] = [];
  if (asks.name) out.push({ kind: 'detail', id: 'name', detail: 'name', text: persona.name });
  if (asks.organisation) {
    out.push({
      kind: 'detail',
      id: 'organisation',
      detail: 'organisation',
      text: persona.organisation,
    });
  }
  if (asks.role) out.push({ kind: 'detail', id: 'role', detail: 'role', text: persona.role });
  if (asks.caseReference) {
    out.push(
      caseReference
        ? { kind: 'detail', id: 'case-reference', detail: 'case-reference', text: caseReference }
        : {
            kind: 'detail',
            id: 'case-reference',
            detail: 'case-reference',
            text: '',
            missing: true,
          },
    );
  }
  return out;
}

function hintSayables(ctx: CustomerGenerationContext): Sayable[] {
  return ctx.discovery.hints.flatMap((fact) =>
    fact.hint ? [{ kind: 'hint' as const, id: fact.id, text: fact.hint }] : [],
  );
}

/** The reason for the call, given once the engineer has answered the greeting. */
function reasonSayables(ctx: CustomerGenerationContext): Sayable[] {
  const { scenario, runtime } = ctx;
  const cfg = scenario.config;
  const lead = scenario.stageFrame.opening;
  const problem = firstSentenceOf(scenario.openingCore);
  const reason = [lead, scenario.openingCore].filter(Boolean).join(' ');
  // A terse customer says the problem in a sentence. When the scenario gives a lead ("I need this
  // looked at now."), the lead is not the problem, so the problem comes with it.
  const terse = [lead, problem].filter(Boolean).join(' ');
  const out: Sayable[] = [
    {
      kind: 'reason',
      id: 'reason',
      text: cfg.style === 'terse' ? terse : reason,
      short: problem,
    },
  ];
  if (!told(ctx, 'impact') && urgencyWarrantsImpact(scenario, runtime.customer.urgency)) {
    out.push({ kind: 'impact', id: 'impact', text: scenario.impactVariant.summary });
  }
  out.push(...hintSayables(ctx));
  // An expert comes with a diagnosis.
  const belief = scenario.incorrectAssumptions[0];
  if (belief && cfg.proficiency === 'expert' && !told(ctx, `assumption-${belief.id}`)) {
    if (!runtime.assumptionsCorrected.includes(belief.id)) {
      out.push({ kind: 'assumption', id: `assumption-${belief.id}`, text: belief.statement });
    }
  }
  return out;
}

/**
 * A call back already has the earlier contact and what was tried on the case. When the engineer
 * asks for either, the customer says it once more, as something they have already said.
 */
function recordSayables(ctx: CustomerGenerationContext): Sayable[] {
  const { discovery, scenario } = ctx;
  if (!discovery.fromRecord) return [];
  const limit = scenario.config.style === 'terse' ? 1 : 2;
  return discovery.tell
    .filter((t) => t.repeat && IN_RECORD_IDS.has(t.id))
    .map((t) => ({
      kind: 'record' as const,
      id: t.id,
      text: sentences(t.text).slice(0, limit).join(' '),
    }))
    .filter((s) => s.text !== '');
}

function reminderSayables(ctx: CustomerGenerationContext, inRecord: Sayable[]): Sayable[] {
  const { discovery, runtime } = ctx;
  if (discovery.kind !== 'repeat' && discovery.kind !== 'clarification') return [];
  const answeredFromRecord = new Set(inRecord.map((s) => s.id));
  const candidates = discovery.tell.filter((t) => t.repeat && !answeredFromRecord.has(t.id));
  const ranked = discovery.earlier.filter((t) => !answeredFromRecord.has(t.id));
  // The answer to the topic the engineer's words picked out by name, else the answer the customer
  // gave that fits the question best: what they said about it, not another fact on the same topic.
  const earlier = candidates.find((t) => t.specific) ?? ranked[0] ?? candidates[0];
  if (!earlier) return [];
  // The customer said they would ask someone; they have not heard back yet.
  const offered = runtime.commitments.some(
    (c) => c.by === 'customer' && c.id === `u-${earlier.id}`,
  );
  if (earlier.kind === 'unknown' && earlier.whoKnows && offered) {
    return [
      {
        kind: 'reminder',
        id: earlier.id,
        text: `I still need to ask ${earlier.whoKnows} about that.`,
      },
    ];
  }
  const plain =
    ctx.scenario.config.style === 'non-native' && earlier.simple ? earlier.simple : earlier.text;
  const text =
    discovery.kind === 'clarification' && earlier.elaboration
      ? earlier.elaboration
      : bestSentenceFor(plain, ctx.traineeText);
  return [{ kind: 'reminder', id: earlier.id, text }];
}

function assumptionSayable(ctx: CustomerGenerationContext): Sayable[] {
  const { scenario, runtime, classification: c, effectiveTurn } = ctx;
  const belief = scenario.incorrectAssumptions[0];
  const cfg = scenario.config;
  if (!belief || cfg.proficiency === 'expert') return [];
  const id = `assumption-${belief.id}`;
  if (told(ctx, id) || runtime.assumptionsCorrected.includes(belief.id)) return [];
  const chatty = cfg.style === 'talkative' || cfg.style === 'vague';
  if (effectiveTurn <= 2 && (chatty || c.discoveryIntents.includes('problem_description'))) {
    return [{ kind: 'assumption', id, text: belief.statement }];
  }
  return [];
}

function tangentSayable(ctx: CustomerGenerationContext): Sayable[] {
  const { scenario } = ctx;
  if (scenario.config.style !== 'talkative') return [];
  const next = scenario.irrelevantFacts.find((f) => !told(ctx, f.id));
  return next ? [{ kind: 'irrelevant', id: next.id, text: next.text }] : [];
}

// ---------------------------------------------------------------------------------------
// Reactions

function earlyUnscopedFix(ctx: CustomerGenerationContext): boolean {
  const { classification: c, runtime, effectiveTurn, discovery } = ctx;
  return (
    c.troubleshooting &&
    effectiveTurn <= 2 &&
    !c.acknowledgesImpact &&
    Object.keys(runtime.discovery).length === 0 &&
    discovery.newInfoCount === 0
  );
}

/**
 * The engineer said again a commitment the customer already has a time for ("so I'll own this and
 * call you back"). The time still stands, so this is not a vague promise to challenge.
 */
function restatesClearCommitment(ctx: CustomerGenerationContext): boolean {
  const made = ctx.analysis.commitment;
  return (
    made !== null &&
    made.due === null &&
    ctx.runtime.commitments.some(
      (e) =>
        e.by === 'engineer' &&
        e.kind === made.kind &&
        e.action === made.action &&
        e.clarity === 'clear',
    )
  );
}

function reactionsOf(
  ctx: CustomerGenerationContext,
  moves: {
    echo: Commitment | null;
    accept: Commitment | null;
    presses: boolean;
    close: CloseKind | null;
  },
  inRecord: Sayable[],
): Reaction[] {
  const { scenario, runtime, classification: c, analysis, discovery, stageMetNow } = ctx;
  const { echo, accept, presses, close } = moves;
  const cfg = scenario.config;
  const stage = cfg.callStage;
  // The customer only responds to a belief they have voiced; one the engineer put right before
  // they said it is simply never voiced.
  const voiced = analysis.assumption !== null && told(ctx, `assumption-${analysis.assumption.id}`);
  // Said when the call is not being closed: the closing line takes the place of a thank you for
  // what was promised, so a customer does not thank the engineer twice.
  const settled = echo === null && accept === null && close === null;
  const picks: [boolean, Reaction][] = [
    [c.blame, 'blamed'],
    [c.dismissive, 'dismissed'],
    [
      cfg.proficiency === 'novice' && (c.jargon === 'unexplained' || analysis.term !== null),
      'confused',
    ],
    [
      cfg.style === 'non-native' && c.clarity === 'unclear' && cfg.proficiency !== 'novice',
      'asks-to-repeat',
    ],
    [discovery.repeated, 'repeated'],
    [analysis.stage.repeatsPrior !== null && stage !== 'first-contact', 'already-tried'],
    [inRecord.length > 0, 'in-record'],
    [analysis.stage.fromScratch && stage !== 'first-contact', 'from-scratch'],
    [earlyUnscopedFix(ctx), 'premature-fix'],
    [cfg.proficiency === 'expert' && analysis.basics && c.troubleshooting, 'basics'],
    [c.promise === 'unverified', 'unsupported-promise'],
    [analysis.conflict !== null, 'conflicting-commitment'],
    [presses, 'vague-commitment'],
    [analysis.summary.verdict === 'inaccurate', 'summary-wrong'],
    // Asked whether a recap is right, the customer says so before anything else.
    [c.summarises && c.askedQuestion && analysis.summary.verdict === 'accurate', 'summary-right'],
    [echo !== null, 'echo'],
    [accept !== null, 'plan-accepted'],
    [analysis.confirmsEcho, 'echo-confirmed'],
    [settled && c.ownership === 'clear', 'ownership'],
    [settled && c.nextSteps === 'specific' && c.promise !== 'unverified', 'next-steps'],
    [
      stageMetNow.includes('prior-context') || stageMetNow.includes('history-acknowledged'),
      'knows-case',
    ],
    [stageMetNow.includes('update'), 'update-given'],
    [stageMetNow.includes('escalation-explained'), 'escalation-explained'],
    [stageMetNow.includes('cadence'), 'cadence'],
    [stageMetNow.includes('resolution-confirmed'), 'resolution'],
    [stageMetNow.includes('agreement-checked'), 'agreement'],
    [stageMetNow.includes('cause-explained'), 'cause'],
    [c.empathy === 'specific', 'empathy-specific'],
    [c.empathy === 'generic', 'empathy-generic'],
    [c.acknowledgesImpact, 'impact-acknowledged'],
    [c.summarises && !c.askedQuestion && analysis.summary.verdict === 'accurate', 'summary-right'],
    [
      analysis.wording === 'confirmation' &&
        analysis.summary.verdict !== 'inaccurate' &&
        !c.summarises,
      'confirmed',
    ],
    [voiced && analysis.assumption?.established === true, 'assumption-accepted'],
    [voiced && analysis.assumption?.established === false, 'assumption-challenged'],
    [discovery.kind === 'clarification' && analysis.wording === null, 'follow-up'],
    [analysis.wording === 'correction', 'self-correction'],
    [
      c.troubleshooting && !earlyUnscopedFix(ctx) && analysis.stage.repeatsPrior === null,
      'instruction',
    ],
    // The customer asked whether the engineer needs anything from them, and this is the answer.
    [runtime.lastToldIds.includes(OFFER_HELP) && close === null, 'offer-answered'],
    [close !== null, 'closing'],
  ];
  return picks
    .filter(([applies]) => applies)
    .map(([, reaction]) => reaction)
    .slice(0, MAX_REACTIONS);
}

// ---------------------------------------------------------------------------------------
// Moves

function wantsTimeline(
  ctx: CustomerGenerationContext,
  pressing: Pressing,
  close: CloseKind | null,
): boolean {
  const { runtime, scenario, effectiveTurn, traineeTurnNumber } = ctx;
  const customer = runtime.customer;
  return (
    mayAsk(pressing, effectiveTurn) &&
    !customer.nextStepsStated &&
    effectiveTurn >= 3 &&
    (scenario.config.impact === 'high' ||
      customer.urgency >= 70 ||
      scenario.config.style === 'demanding' ||
      (effectiveTurn >= 4 && expects(scenario, 'next-update'))) &&
    traineeTurnNumber - runtime.asksForTimelineAtTurn >= 3 &&
    close === null
  );
}

/**
 * Whether a customer says a commitment back in their own words ("So you'll own this and call me
 * by 3pm, correct?") or takes it in briefly ("Okay. Three o'clock, then."). An anxious, demanding,
 * talkative, upset or non-expert customer wants to be sure they have it. A terse customer, or a
 * calm one, has it and says so.
 */
function confirmsBack(cfg: EffectiveScenario['config']): boolean {
  if (cfg.style === 'terse') return false;
  if (cfg.style === 'demanding' || cfg.style === 'talkative' || cfg.style === 'non-native') {
    return true;
  }
  return cfg.proficiency === 'novice' || cfg.startingTemperature !== 'calm';
}

/**
 * What the customer does with a clear commitment the engineer has just made: say it back as a
 * question, or take it in. Not while the call is being closed (the closing line does that), and
 * not for one they have already said back or taken in.
 */
function commitmentMove(
  ctx: CustomerGenerationContext,
  close: CloseKind | null,
): { echo: Commitment | null; accept: Commitment | null } {
  const none = { echo: null, accept: null };
  const made = ctx.analysis.commitment;
  if (close !== null || !made || !made.supported || made.clarity !== 'clear') return none;
  const entry = ctx.runtime.commitments.find(
    (c) => c.by === 'engineer' && c.kind === made.kind && c.action === made.action,
  );
  if (!entry || entry.reflected) return none;
  // A recap the engineer asked about is answered, not said back.
  if (ctx.classification.summarises) return { echo: null, accept: entry };
  return confirmsBack(ctx.scenario.config)
    ? { echo: entry, accept: null }
    : { echo: null, accept: entry };
}

/**
 * The customer asks for a time after a vague commitment ("I'll look into it", "We'll get back to
 * you soon"), once. A customer who will not take a vague answer, an angry or a demanding one,
 * does so every time. The rest ask once, not in two replies running (a calm customer waits
 * longest), and never again once a time has been given. An owner with no time is something only
 * a customer who would ask presses on; the others take it as the good news it is.
 */
function pressesForTime(ctx: CustomerGenerationContext, pressing: Pressing, tone: Tone): boolean {
  const made = ctx.analysis.commitment;
  if (!made || made.clarity !== 'vague' || !made.supported || restatesClearCommitment(ctx)) {
    return false;
  }
  const { scenario, runtime } = ctx;
  const cfg = scenario.config;
  if (cfg.startingTemperature === 'angry' || cfg.style === 'demanding') return true;
  if (runtime.customer.nextStepsStated || !pressing.spaced) return false;
  if (made.kind !== 'ownership') return true;
  return (
    cfg.startingTemperature !== 'calm' ||
    tone !== 'calm' ||
    cfg.impact === 'high' ||
    runtime.customer.urgency >= 70 ||
    expects(scenario, 'next-update')
  );
}

/**
 * Who the customer could ask, if the engineer asks what they can do or provide, from what they have
 * already said: someone they offered to ask, or said would know. Never anything they have not been
 * asked about, so nothing here can give away a hidden fact.
 */
function offerOf(ctx: CustomerGenerationContext): string | null {
  const { scenario, runtime } = ctx;
  const plain = (who: string | undefined): who is string =>
    typeof who === 'string' && who.trim() !== '' && !/\bsupport\b/i.test(who);
  const offered = [...runtime.commitments]
    .reverse()
    .find((k) => k.by === 'customer' && k.kind === 'check');
  const who = offered?.action.replace(/^ask /, '');
  if (plain(who)) return who;
  const said = scenario.unknownFacts.find(
    (f) => (runtime.toldKnownFacts[f.id] ?? 0) > 0 && plain(f.whoKnows),
  );
  return said?.whoKnows ?? null;
}

/**
 * Something the customer already said that the engineer's right recap left out, said in a few
 * words: who is affected, as they gave it. Only what has been said before, so it cannot give
 * anything away.
 */
function additionSayables(ctx: CustomerGenerationContext): Sayable[] {
  const { scenario, runtime, analysis } = ctx;
  if (analysis.summary.verdict !== 'accurate' || !analysis.summary.omitsScope) return [];
  const earned = scenario.hiddenFacts.find(
    (f) => runtime.discovery[f.id]?.status === 'discovered' && f.intents.includes('affected_scope'),
  );
  const text = earned
    ? fullStatement(earned, scenario.config.style)
    : told(ctx, 'impact-detail')
      ? scenario.impactVariant.detail
      : '';
  const first = firstSentenceOf(text);
  if (first === '') return [];
  return [{ kind: 'addition', id: earned ? earned.id : 'impact-detail', text: first }];
}

/**
 * A cooperative customer, having taken in or confirmed a commitment, asks once whether the engineer
 * needs anything from them: "That works for me. Is there anything you need from our side before
 * then?" A terse, demanding, upset or hard-pressed customer does not offer.
 */
function asksOffer(
  ctx: CustomerGenerationContext,
  tone: Tone,
  reactions: Reaction[],
  close: CloseKind | null,
): boolean {
  const { scenario, curveball } = ctx;
  const cfg = scenario.config;
  if (close !== null || curveball.fired || told(ctx, OFFER_HELP)) return false;
  if (!reactions.includes('echo-confirmed') && !reactions.includes('plan-accepted')) return false;
  const cooperative =
    cfg.style !== 'terse' &&
    cfg.style !== 'demanding' &&
    (cfg.startingTemperature === 'calm' || cfg.startingTemperature === 'anxious') &&
    (tone === 'calm' || tone === 'worried') &&
    cfg.difficulty !== 'challenge';
  return cooperative && rngFor(cfg.seed, ctx.traineeTurnNumber, 19)() < 0.7;
}

function flavourOf(
  ctx: CustomerGenerationContext,
  tone: Tone,
  reactions: Reaction[],
  pressing: Pressing,
  close: CloseKind | null,
): Flavour | null {
  const { scenario, runtime, classification: c, analysis, effectiveTurn, curveball } = ctx;
  const cfg = scenario.config;
  const customer = runtime.customer;
  if (curveball.fired || curveball.followUp || close !== null) return null;
  if (reactions.length > 1 || reactions.some((r) => r === 'blamed' || r === 'dismissed'))
    return null;
  const draw = rngFor(cfg.seed, ctx.traineeTurnNumber, 13);
  const vague =
    !restatesClearCommitment(ctx) &&
    (c.ownership === 'vague' ||
      c.nextSteps === 'vague' ||
      analysis.commitment?.clarity === 'vague' ||
      reactions.includes('unsupported-promise'));
  const open = !customer.nextStepsStated;
  // Asking for a plan, an owner or an escalation is held to the same rules as any other ask.
  const may = mayAsk(pressing, effectiveTurn);

  // On a closing call the problem is said to be fixed. The customer is not worried about how long
  // it will take or what it is doing to them; what is left is whether it will come back.
  if (cfg.callStage === 'closure') {
    if ((cfg.startingTemperature === 'angry' || cfg.style === 'demanding') && vague)
      return 'challenge';
    const wary =
      (cfg.startingTemperature === 'anxious' && tone !== 'calm') || cfg.style === 'demanding';
    return wary && effectiveTurn >= 2 && draw() < 0.4 ? 'assurance' : null;
  }

  if ((cfg.startingTemperature === 'angry' || cfg.style === 'demanding') && vague)
    return 'challenge';
  if (cfg.startingTemperature === 'angry' && tone !== 'calm') {
    // An escalated call is already the escalation.
    const hot = customer.temperature >= 78 && customer.trust < 35;
    if (hot && may && cfg.callStage !== 'escalated' && draw() < 0.4) return 'escalate';
    return null;
  }
  if (cfg.style === 'demanding' && open && may && effectiveTurn >= 2 && draw() < 0.5) return 'plan';
  if (cfg.startingTemperature === 'anxious' && tone !== 'calm') {
    if (open && may && effectiveTurn >= 2 && draw() < 0.5) return 'timeline-worry';
    if (cfg.impact !== 'low' && draw() < 0.35) return 'urgency';
    if (draw() < 0.3) return 'impact-worry';
    return null;
  }
  if (cfg.startingTemperature === 'frustrated' && (tone === 'firm' || tone === 'hot')) {
    if (draw() >= 0.45) return null;
    if ((cfg.callStage !== 'first-contact' || effectiveTurn >= 3) && open && may) {
      return 'no-progress';
    }
    if (!customer.ownershipStated && may && effectiveTurn >= 2) return 'wants-owner';
  }
  return null;
}

// ---------------------------------------------------------------------------------------

function sentenceBudget(
  ctx: CustomerGenerationContext,
  plan: Pick<ReplyPlan, 'mode' | 'beat' | 'reactions' | 'tone'>,
): number {
  const { style } = ctx.scenario.config;
  if (plan.mode !== 'normal') return 2;
  if (plan.beat === 'reason') return style === 'terse' ? 2 : 3;
  if (style === 'terse') return 2;
  const heated =
    ctx.curveball.fired !== null ||
    plan.reactions.some((r) => r === 'blamed' || r === 'dismissed' || r === 'repeated') ||
    plan.tone === 'hot';
  if (heated) return 3;
  const clarifying =
    ctx.discovery.kind === 'clarification' || plan.reactions.includes('summary-wrong');
  if (style === 'talkative' || clarifying) return 4;
  return 3;
}

const cache = new WeakMap<CustomerGenerationContext, ReplyPlan>();

export function planReply(ctx: CustomerGenerationContext): ReplyPlan {
  const cached = cache.get(ctx);
  if (cached) return cached;
  const plan = buildPlan(ctx);
  cache.set(ctx, plan);
  return plan;
}

function buildPlan(ctx: CustomerGenerationContext): ReplyPlan {
  const { scenario, runtime, classification: c, analysis, discovery, curveball } = ctx;
  const cfg = scenario.config;
  const customer = runtime.customer;
  const tone = toneOf(customer.temperature, cfg.startingTemperature);
  const beat: ReplyPlan['beat'] = runtime.opening === 'awaiting-engineer' ? 'reason' : 'normal';
  const none = {
    beat,
    notice: false,
    reactions: [] as Reaction[],
    say: [] as Sayable[],
    holds: [] as WithholdReason[],
    notKnown: false,
    push: null,
    flavour: null,
    echo: null,
    accept: null,
    presses: false,
    close: null,
    asksOffer: false,
    offer: null,
    customerCheck: null,
    closingCommitment: null,
    term: null,
    tone,
  };
  const short = (mode: ReplyPlan['mode']): ReplyPlan => ({ ...none, mode, maxSentences: 2 });

  if (c.injectionAttempt) return short('off-role');
  if (isSilent(ctx)) return short('silent');
  if (c.lowEffort) return short('low-effort');

  const close = closeKindOf(c, analysis);
  const pressing = pressingOf(ctx, tone);
  // A customer says a commitment back, or takes it in, while it is being made: not while the call
  // is closing (the closing line does that). Asked about a recap, they answer it.
  const { echo, accept } = commitmentMove(ctx, close);
  const presses = pressesForTime(ctx, pressing, tone);
  const record = recordSayables(ctx);
  const reactions = reactionsOf(ctx, { echo, accept, presses, close }, record);

  const details = detailSayables(ctx);
  const facts: Sayable[] = [];
  for (const { fact, mode } of discovery.reveal) {
    if (mode === 'full') {
      facts.push({
        kind: 'full',
        id: fact.id,
        text: fullStatement(fact, cfg.style),
        ...(fact.knowledge === 'after-checking' && fact.checking
          ? { checking: fact.checking }
          : {}),
      });
    } else if (fact.partialStatement) {
      facts.push({ kind: 'partial', id: fact.id, text: fact.partialStatement });
    }
  }
  for (const item of discovery.tell) if (!item.repeat) facts.push(tellSayable(item, cfg.style));

  // A right recap that left out who is affected, which the customer has already said: they add it.
  const adds =
    reactions.includes('summary-right') &&
    rngFor(cfg.seed, ctx.traineeTurnNumber, 23)() < (cfg.style === 'terse' ? 0.5 : 0.7);

  const say = [
    ...details,
    ...(beat === 'reason' ? reasonSayables(ctx) : []),
    ...facts,
    ...record,
    // A clue or a belief is something new to bring up: not as the call closes.
    ...(beat === 'reason' || close !== null ? [] : hintSayables(ctx)),
    ...(beat === 'reason' ? [] : reminderSayables(ctx, record)),
    ...(beat === 'reason' || close !== null ? [] : assumptionSayable(ctx)),
    ...(adds ? additionSayables(ctx) : []),
  ];

  // Something the customer holds back, or has no information on.
  const withheld = [...new Set(discovery.withheld.map((w) => w.reason))];
  const holdsBack = withheld.some((r) => r !== 'timing');
  const nothingToSay = facts.length === 0 && discovery.unanswered.length > 0;
  const notKnown =
    beat === 'normal' &&
    !holdsBack &&
    !discovery.repeated &&
    (withheld.includes('timing') || nothingToSay);

  const asksAlready = reactions.some((r) => ASKS_THE_ENGINEER.has(r));
  const stage = stagePush({
    scenario,
    runtime,
    metNow: ctx.stageMetNow,
    effectiveTurn: ctx.effectiveTurn,
    traineeTurnNumber: ctx.traineeTurnNumber,
    hotTone: tone === 'firm' || tone === 'hot',
    closing: close !== null,
    pressing,
  });
  const push: PlanPush | null =
    curveball.fired || asksAlready
      ? null
      : (stage ?? (wantsTimeline(ctx, pressing, close) ? 'timeline' : null));

  const plan: ReplyPlan = {
    mode: 'normal',
    beat,
    notice: beat === 'reason' && cfg.callStage === 'first-contact' && !analysis.greets,
    reactions,
    say,
    holds: withheld.filter((r) => r !== 'timing'),
    notKnown,
    push,
    // A terse customer says what was asked and no more: no lines of personality on top, and a
    // commitment taken in or said back needs nothing added to it.
    flavour:
      push || echo || accept || cfg.style === 'terse'
        ? null
        : flavourOf(ctx, tone, reactions, pressing, close),
    echo,
    accept,
    presses,
    close,
    asksOffer: asksOffer(ctx, tone, reactions, close),
    offer: close === 'asks-more' ? offerOf(ctx) : null,
    customerCheck: [...runtime.commitments].reverse().find((k) => k.by === 'customer') ?? null,
    closingCommitment:
      [...runtime.commitments]
        .reverse()
        .find((k) => k.by === 'engineer' && k.clarity === 'clear' && k.supported) ?? null,
    term: cfg.proficiency === 'novice' ? analysis.term : null,
    tone,
    maxSentences: 3,
  };
  plan.maxSentences = sentenceBudget(ctx, plan);
  // A talkative customer may add a tangent when there is room for one.
  if (
    cfg.style === 'talkative' &&
    beat === 'normal' &&
    close === null &&
    !curveball.fired &&
    tone !== 'hot' &&
    plan.say.length < 2 &&
    plan.reactions.length === 0 &&
    rngFor(cfg.seed, ctx.traineeTurnNumber, 17)() < 0.3
  ) {
    plan.say.push(...tangentSayable(ctx));
  }
  return plan;
}

/** The facts and details the customer may state in this reply. */
export function sayableThisTurn(ctx: CustomerGenerationContext): Sayable[] {
  return planReply(ctx).say;
}
