import type { TurnClassification } from '#shared/domain/classification.ts';
import type { CommunicationStyle } from '#shared/domain/vocab.ts';
import type { HiddenFact } from '#shared/domain/scenario.ts';
import { sentences } from '#shared/domain/text.ts';
import { IN_RECORD_IDS, type TellItem, type WithholdReason } from './discovery.ts';
import { expects } from './expectation.ts';
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
  | 'reminder'; // a short reminder of something already said

/** Something the customer may say in this reply, and nothing else about the problem. */
export interface Sayable {
  kind: SayKind;
  /** The fact id, or the id of what the customer has now said (see `toldKnownFacts`). */
  id: string;
  text: string;
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

/**
 * Whether the engineer is ending the call, as far as the customer can tell. A recap that ends by
 * asking whether it is right is a question to answer, not a goodbye: the customer says it is
 * right and the call goes on.
 */
export function closesCall(
  c: Pick<TurnClassification, 'wrapsUp' | 'asksAnythingElse' | 'summarises' | 'askedQuestion'>,
): boolean {
  return c.asksAnythingElse || (c.wrapsUp && !(c.summarises && c.askedQuestion));
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
  const reason = [scenario.stageFrame.opening, scenario.openingCore].filter(Boolean).join(' ');
  const out: Sayable[] = [
    {
      kind: 'reason',
      id: 'reason',
      text: cfg.style === 'terse' ? firstSentenceOf(reason) : reason,
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
  echo: Commitment | null,
  inRecord: Sayable[],
): Reaction[] {
  const { scenario, classification: c, analysis, discovery, stageMetNow } = ctx;
  const cfg = scenario.config;
  const stage = cfg.callStage;
  // The customer only responds to a belief they have voiced; one the engineer put right before
  // they said it is simply never voiced.
  const voiced = analysis.assumption !== null && told(ctx, `assumption-${analysis.assumption.id}`);
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
    [
      analysis.commitment?.clarity === 'vague' &&
        analysis.commitment.supported &&
        !restatesClearCommitment(ctx),
      'vague-commitment',
    ],
    [analysis.summary.verdict === 'inaccurate', 'summary-wrong'],
    // Asked whether a recap is right, the customer says so before anything else.
    [c.summarises && c.askedQuestion && analysis.summary.verdict === 'accurate', 'summary-right'],
    [echo !== null, 'echo'],
    [echo === null && c.ownership === 'clear', 'ownership'],
    [echo === null && c.nextSteps === 'specific' && c.promise !== 'unverified', 'next-steps'],
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
    [closesCall(c), 'closing'],
  ];
  return picks
    .filter(([applies]) => applies)
    .map(([, reaction]) => reaction)
    .slice(0, MAX_REACTIONS);
}

// ---------------------------------------------------------------------------------------
// Moves

function wantsTimeline(ctx: CustomerGenerationContext, pressing: Pressing): boolean {
  const { classification: c, runtime, scenario, effectiveTurn, traineeTurnNumber } = ctx;
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
    !c.wrapsUp &&
    !c.asksAnythingElse
  );
}

function echoOf(ctx: CustomerGenerationContext, tone: Tone): Commitment | null {
  const made = ctx.analysis.commitment;
  if (!made || !made.supported || made.clarity !== 'clear') return null;
  const entry = ctx.runtime.commitments.find(
    (c) => c.by === 'engineer' && c.kind === made.kind && c.action === made.action,
  );
  if (!entry || entry.reflected) return null;
  const { style } = ctx.scenario.config;
  const likelihood =
    style === 'demanding'
      ? 1
      : style === 'terse'
        ? 0.3
        : tone === 'hot' || tone === 'firm'
          ? 0.9
          : tone === 'worried'
            ? 0.8
            : 0.45;
  return rngFor(ctx.scenario.config.seed, ctx.traineeTurnNumber, 11)() < likelihood ? entry : null;
}

function flavourOf(
  ctx: CustomerGenerationContext,
  tone: Tone,
  reactions: Reaction[],
  pressing: Pressing,
): Flavour | null {
  const { scenario, runtime, classification: c, analysis, effectiveTurn, curveball } = ctx;
  const cfg = scenario.config;
  const customer = runtime.customer;
  if (curveball.fired || curveball.followUp || c.wrapsUp || c.asksAnythingElse) return null;
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
    customerCheck: null,
    closingCommitment: null,
    term: null,
    tone,
  };
  const short = (mode: ReplyPlan['mode']): ReplyPlan => ({ ...none, mode, maxSentences: 2 });

  if (c.injectionAttempt) return short('off-role');
  if (isSilent(ctx)) return short('silent');
  if (c.lowEffort) return short('low-effort');

  const closing = closesCall(c);
  // A customer says a commitment back while it is being made, not while the call is closing or
  // while the engineer is reading a recap back for them to confirm.
  const echo = closing || c.summarises ? null : echoOf(ctx, tone);
  const record = recordSayables(ctx);
  const reactions = reactionsOf(ctx, echo, record);

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

  const say = [
    ...details,
    ...(beat === 'reason' ? reasonSayables(ctx) : []),
    ...facts,
    ...record,
    ...(beat === 'reason' ? [] : hintSayables(ctx)),
    ...(beat === 'reason' ? [] : reminderSayables(ctx, record)),
    ...(beat === 'reason' ? [] : assumptionSayable(ctx)),
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

  const pressing = pressingOf(ctx, tone);
  const asksAlready = reactions.some((r) => ASKS_THE_ENGINEER.has(r));
  const stage = stagePush({
    scenario,
    runtime,
    metNow: ctx.stageMetNow,
    effectiveTurn: ctx.effectiveTurn,
    traineeTurnNumber: ctx.traineeTurnNumber,
    hotTone: tone === 'firm' || tone === 'hot',
    closing,
    pressing,
  });
  const push: PlanPush | null =
    curveball.fired || asksAlready
      ? null
      : (stage ?? (wantsTimeline(ctx, pressing) ? 'timeline' : null));

  const plan: ReplyPlan = {
    mode: 'normal',
    beat,
    notice: beat === 'reason' && cfg.callStage === 'first-contact' && !analysis.greets,
    reactions,
    say,
    holds: withheld.filter((r) => r !== 'timing'),
    notKnown,
    push,
    // A terse customer says what was asked and no more: no lines of personality on top.
    flavour:
      push || echo || cfg.style === 'terse' ? null : flavourOf(ctx, tone, reactions, pressing),
    echo,
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
    !closing &&
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
