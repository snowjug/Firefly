import type { ClosingCheckDTO } from '#shared/domain/api.ts';
import type { EvaluationInput } from '#server/engine/types.ts';
import { ACCOUNTABLE } from './care/accountable.ts';
import { buildCareContext, type CareContext, type TurnView } from './care/context.ts';
import { settle } from './care/helpers.ts';
import { isQuestionSentence, norm, splitSentences } from './care/lexicon.ts';
import type { BehaviourId } from './care/types.ts';
import { buildCallView, type CallView } from './parts.ts';

// The neutral completion check shown when the trainee presses End call in guided practice: has a
// plan, an owner and a time for the next update been stated, and did the customer accept them?
//
// It is read from the transcript so far by rules alone. It is not a score, it calls no model and it
// keeps nothing: the same call always gives the same answer. The three statements are judged by the
// evaluator's own accountable behaviours (next action, named owner, next-update time), so the check
// reads the same words the coaching report does. It differs in three deliberate ways: a bare "I'll
// look into it" is set aside, an escalated call is read as a plain one (a time is a time, whatever
// cadence the report asks for), and taking ownership outright ("I'll own this") counts as an owner.
// What it answers is yes or no, never which words did it, because it must not tell a trainee what to say.

export type ClosingChecks = ClosingCheckDTO['checks'];

export interface ClosingCheckResult {
  traineeTurns: number;
  checks: ClosingChecks;
}

// "I'll look into it" commits to nothing in particular, so it is no plan, no owner and no time. The
// sentence has to be only that: "I'll look into the mailbox permissions and call you at three" is
// more than that, and still counts.
const LEAD = String.raw`(?:(?:ok(?:ay)?|right|sure|alright|so|yes|yeah|well|certainly|of course|absolutely),? )*`;
const WILL = String.raw`(?:i(?:'ll| will)|let me|we(?:'ll| will))`;
const FILLER = String.raw`(?:(?:just|now|also|certainly|definitely|personally|gladly|quickly|straight away|right away) )*`;
const LOOK = String.raw`(?:look(?:ing)? (?:into|at)|have a look(?: into| at)?|take a look(?: into| at)?|check(?: into| on)?|investigate|review|see (?:what|if|whether) (?:i|we) can(?: do)?|see about)`;
const GENERIC = String.raw`(?: (?:it|this|that|things|everything|the (?:issue|problem|case)|your (?:issue|problem|case)))?`;
const TAIL = String.raw`(?: (?:for you|now|right now|today|straight away|right away|further|more closely))*`;
const BARE_INVESTIGATION = new RegExp(`^${LEAD}${WILL} ${FILLER}${LOOK}${GENERIC}${TAIL}[.!]*$`);

/**
 * The call as this check reads it. A bare "I'll look into it" is set aside. The stage is made a
 * plain one: an escalated call asks for a regular cadence of updates, which the coaching report
 * weighs, but a trainee who named a time has stated an update time.
 */
function readable(ctx: CareContext): CareContext {
  return {
    ...ctx,
    stage: 'first-contact',
    turns: ctx.turns.map((view) => ({
      ...view,
      sentences: view.sentences.filter((s) => !BARE_INVESTIGATION.test(s.lower)),
    })),
  };
}

function behaviour(id: BehaviourId) {
  const found = ACCOUNTABLE.find((spec) => spec.id === id);
  if (!found) throw new Error(`The CARE catalogue has no behaviour ${id}`);
  return found;
}

/** Whether the evaluator's behaviour was shown in full, with a quote of the call to prove it. */
const isShown = (ctx: CareContext, id: BehaviourId): boolean => {
  const finding = behaviour(id).judge(ctx);
  return finding !== null && settle(finding).status === 'shown';
};

interface Statements {
  plan: boolean;
  owner: boolean;
  updateTime: boolean;
}

function statementsIn(ctx: CareContext): Statements {
  return {
    plan: isShown(ctx, 'accountable.next-action'),
    // Saying who owns the next step, or taking it on outright ("I'll own this").
    owner: isShown(ctx, 'accountable.named-owner') || isShown(ctx, 'accountable.ownership'),
    updateTime: isShown(ctx, 'accountable.update-time'),
  };
}

/** The latest trainee turn that, on its own, stated a plan, an owner or an update time. */
function latestStatement(ctx: CareContext): TurnView | undefined {
  for (let i = ctx.turns.length - 1; i >= 0; i--) {
    const view = ctx.turns[i] as TurnView;
    const here = statementsIn({ ...ctx, turns: [view] });
    if (here.plan || here.owner || here.updateTime) return view;
  }
  return undefined;
}

// ---------------------------------------------------------------------------------------
// What the customer said back. Only wording that clearly accepts counts as agreement: a check that
// guessed would tell a trainee the customer was content when they were not.

type Stance = 'accept' | 'object' | 'ask' | 'none';
export type CustomerStance = Stance;

// Pushing back, doubting, or holding the trainee to something.
const OBJECTS =
  /\b(?:not (?:good enough|specific|acceptable|helpful|enough|very (?:specific|helpful|good))|that'?s not (?:good|enough|what|right|acceptable|specific|helpful|ok|okay)|isn'?t (?:a time|good enough|enough|acceptable)|(?:need|want) more than that|(?:can'?t|cannot|can not) (?:promise|know|say|guarantee)|you (?:don'?t|do not|cannot|can'?t) know|don'?t (?:just )?tell me what i want|make up your mind|hold on|hang on|too (?:late|long|slow|vague)|not until|unacceptable|not (?:happy|ok|okay|convinced|satisfied|comfortable) (?:with|about)|(?:doesn'?t|does not|won'?t|will not|wouldn'?t|would not) (?:work|do|be (?:ok|okay|good|enough))|i (?:really |do )?hope\b|let'?s hope|i (?:thought|though) you said|you said\b[^.?!]{0,40}\b(?:earlier|before|ago)|now it'?s|(?:like|want|need) to (?:understand|know|see|check|be sure)\b[^.?!]{0,50}\bfirst\b)\b/;

// Asking again for what the trainee has just said: who, when, how often, or "so you'll ...?".
const ASKS =
  /\b(?:so you(?:'ll| will)|is that (?:definitely |really |all )?(?:right|correct)|(?:when|what time) (?:exactly |will |do |should |can |could |am |would |might |i )|by when|how (?:long|often)\b|(?:give|tell) me (?:a|an|the|any) (?:time|date|time ?frame|name|schedule)|i need (?:a|an|the|one) (?:time|name|schedule|time ?frame|actual time)|who(?:'s| is| will| are| do| should| exactly| actually)|which is it|was it\b[^.?!]{0,40}\bor\b|can you (?:confirm|promise|guarantee)|will you (?:definitely|really)|is it\b[^.?!]{0,20}\bnow)\b/;
const REQUEST_OPENING = /^(?:i need|give me|tell me|please (?:tell|give))\b/;

// Saying it will do, or that there is nothing more.
const ACCEPTS =
  /\b(?:that works|works for me|works for us|(?<!\bif )that'?s (?:fine|ok|okay|good|great|perfect|clear|helpful|reassuring|a relief|good to know|what i (?:wanted|needed)(?: to hear)?)|that would be (?:great|fine|good|helpful|perfect|appreciated)|sounds (?:good|great|fine|perfect|reasonable|right)|(?:i'?m|i am|we'?re|we are) (?:happy|fine|ok|okay|glad|relieved|comfortable|content) (?:with (?:that|this|it)|to (?:wait|go with that|close it)|about that)|(?:i|we)(?:'ll| will) (?:wait|expect|look out|be waiting|hear from you|hold you to)|i (?:feel|am feeling) better|i appreciate (?:that|it|you)|(?:glad|relieved) (?:someone|you)|thank you for taking (?:this|it) on|that(?:'s| is) (?:everything|all|about it)|nothing (?:else|more)|please do|understood|agreed|fine to close|happy to close)\b/;
const OPENS_WITH_YES =
  /^(?:ok(?:ay)?|alright|all right|fine|sure|great|good|perfect|yes|yeah|yep|right|thanks?|thank you|cheers|excellent|wonderful)\b/;

/** How a customer's reply reads: they accept, push back, ask again for it, or say nothing about it. */
export function customerStance(reply: string): Stance {
  const sentences = splitSentences(reply);
  const lower = sentences.map(norm);
  if (lower.some((s) => OBJECTS.test(s))) return 'object';
  const asksAgain = sentences.some(
    (sentence, i) =>
      (isQuestionSentence(sentence) || REQUEST_OPENING.test(lower[i] as string)) &&
      ASKS.test(lower[i] as string),
  );
  if (asksAgain) return 'ask';
  if (lower.some((s) => ACCEPTS.test(s)) || OPENS_WITH_YES.test(lower[0] ?? '')) return 'accept';
  return 'none';
}

/**
 * Whether the customer agreed to what the trainee last stated. The customer's first reply must not
 * push back, and the last thing they said about it must accept: asking for it to be repeated ("So
 * you'll ... ?") and then accepting it counts, asking again and stopping there does not.
 */
function customerAgreed(call: CallView, statement: TurnView): boolean {
  const stances = call.input.turns
    .filter((t) => t.role === 'customer' && t.index > statement.turn.index)
    .sort((a, b) => a.index - b.index)
    .map((t) => customerStance(t.text));
  if (stances.length === 0 || stances[0] === 'object') return false;
  return [...stances].reverse().find((stance) => stance !== 'none') === 'accept';
}

/** Reads the call so far. Pure: no model, no storage, the same answer every time. */
export function closingCheck(input: EvaluationInput): ClosingCheckResult {
  const call = buildCallView(input);
  const traineeTurns = call.turns.length;
  if (traineeTurns === 0) {
    return {
      traineeTurns,
      checks: { plan: false, owner: false, updateTime: false, agreement: false },
    };
  }
  const ctx = readable(buildCareContext(call));
  const stated = statementsIn(ctx);
  // Nothing was stated in the whole call, so there is no latest statement to look for.
  const latest =
    stated.plan || stated.owner || stated.updateTime ? latestStatement(ctx) : undefined;
  return {
    traineeTurns,
    checks: { ...stated, agreement: latest ? customerAgreed(call, latest) : false },
  };
}
