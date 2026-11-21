import type { EffectiveScenario } from '#shared/domain/config.ts';
import { fold, sentences } from '#shared/domain/text.ts';
import { conformCustomerReply } from '../conform.ts';
import { describeCommitment } from '../memory.ts';
import type { CustomerGenerationContext } from '../pipeline.ts';
import {
  closesCall,
  planReply,
  type Flavour,
  type PlanPush,
  type Reaction,
  type ReplyPlan,
  type Sayable,
} from '../plan.ts';
import { pick, pickFresh } from '../rng.ts';
import {
  capFirst,
  expandContractions,
  firstSentenceOf,
  joinSentences,
  lowerFirst,
} from '../textutil.ts';
import * as P from './phrasebank.ts';
import type { Bank } from './phrasebank.ts';

// Demo-mode customer. It does not read a script: it turns the engine's plan for this reply (what
// the engineer did, which facts may be shared and how well the customer knows them, what has been
// promised, the customer's state and any curveball) into words, whose length, vocabulary and tone
// follow the scenario's communication style, proficiency and the customer's temperature. Live mode
// replaces only this step with a model that is given the same plan.
//
// A reply is built from segments. Each has a priority: 0 is never dropped (the facts the customer
// is answering with, a curveball), and when the reply is too long for the kind of reply it is, the
// segments with the highest numbers go first. A hidden fact counts as revealed only if the words
// that reveal it are still in the reply once it has been fitted and conformed.

export interface ComposeResult {
  text: string;
  used: string[]; // fillers and lines used, to avoid repeating them next turn
  toldIds: string[];
  hintIds: string[];
  /** Hidden facts whose words are in the reply the customer actually gave. */
  revealedIds: string[];
  voicedAssumptions: string[];
  pushed: PlanPush | null;
  /** The line of personality that was said, if one was (see plan.flavour). */
  flavoured: Flavour | null;
  timelineAsked: boolean;
  followUpGiven: boolean;
  echoed: string | null; // id of the commitment said back
  customerChecks: { id: string; whoKnows: string }[];
  confusedBy: string | null; // the term the customer asked about
  limit: number; // most sentences the reply was allowed to have
}

interface Segment {
  text: string;
  priority: number;
  told?: string[];
  hint?: string;
  reveal?: string; // the hidden fact these words reveal
  assumption?: string;
  check?: { id: string; whoKnows: string };
  push?: PlanPush;
  flavour?: Flavour;
  echo?: string;
  confused?: string;
  reaction?: boolean; // the customer's reaction to what the engineer just did
  followUp?: boolean; // the line that repeats an unresolved concern
}

// Words a sentence may start with and still be joined onto a lead ("I'm calling because ...",
// "Well, ..."): the first letter can then be lower-cased without breaking a name or a product.
const SAFE_START =
  /^(?:I|I'm|I've|I'd|I'll|It|It's|We|We've|We're|My|Our|The|This|These|Those|That|That's|There|There's|Yes|No|Not|Just|Still|Since|After|Last|Everything|Nothing|Maybe|Probably|Several|Some|Everyone|Nobody|People)\b/;

const aOrAn = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a');

const YES_START = /^(?:yes|yeah|yep|right|exactly|correct|that's (?:right|correct))\b/i;

// What the customer says in answer to a question, as opposed to why they called or an aside.
const ANSWER_KINDS: ReadonlySet<string> = new Set([
  'known',
  'vague',
  'vague-firm',
  'checkable',
  'unknown',
  'full',
  'partial',
]);

/** A lead-in and what follows it: "Well, it's..." continues the sentence, "Sure." starts a new one. */
const afterLead = (lead: string, text: string): string =>
  /[,:;]$/.test(lead) ? `${lead} ${lowerFirst(text)}` : `${lead} ${text}`;

// Reactions to something the engineer did that the customer has to answer in the reply itself, so
// they are not cut when the reply runs long.
const MUST_REACT: ReadonlySet<Reaction> = new Set<Reaction>([
  'blamed',
  'dismissed',
  'confused',
  'asks-to-repeat',
  'repeated',
  'already-tried',
  'in-record',
  'from-scratch',
  'unsupported-promise',
  'conflicting-commitment',
  'summary-wrong',
  'echo',
]);

const fill = (template: string, values: Record<string, string>): string =>
  template.replace(/\{(\w+)\}/g, (_m, key: string) => values[key] ?? '');

function channelOf(scenario: EffectiveScenario): string {
  const product = scenario.product?.id;
  if (product === 'azure') return 'Azure support';
  if (product === 'dynamics-365') return 'Dynamics 365 support';
  return 'Microsoft support';
}

/** How likely a light filler ("Well,", "Um,") is at the start of a reply. Often is too often. */
function fillerChance(
  style: EffectiveScenario['config']['style'],
  tone: ReplyPlan['tone'],
): number {
  if (style === 'terse' || style === 'demanding' || style === 'non-native') return 0;
  if (tone === 'hot') return 0.04;
  if (style === 'vague') return 0.35;
  if (style === 'talkative') return 0.28;
  return tone === 'worried' ? 0.2 : 0.1;
}

export function composeCustomerReply(ctx: CustomerGenerationContext): ComposeResult {
  const plan = planReply(ctx);
  const { scenario, runtime, classification: c, analysis, curveball, rng } = ctx;
  const cfg = scenario.config;
  const tone = plan.tone;
  const style = cfg.style;
  const simple = style === 'non-native';
  const terse = style === 'terse';
  const used: string[] = [];

  const say = (bank: Bank, simpleBank?: Bank): string => {
    const lines = simple && simpleBank ? simpleBank[tone] : bank[tone];
    const line = pickFresh(rng, lines, runtime.lastCustomerLines);
    used.push(line);
    return line;
  };

  const result = (segments: Segment[], cap: number): ComposeResult => {
    // The words the customer is answering with are never cut, so a reply may run past the usual
    // length for the facts it has to carry rather than lose one.
    const mustSay = segments.filter((s) => s.priority === 0);
    const limit = Math.max(cap, sentences(joinSentences(mustSay.map((s) => s.text))).length);
    const kept = fit(segments, limit);
    let text = joinSentences(kept.map((s) => s.text));
    // A filler goes on the front of a plain statement now and then, and never twice running.
    const recent = runtime.lastCustomerLines.slice(-2);
    const first = kept[0];
    if (
      first &&
      !first.reaction &&
      SAFE_START.test(first.text) &&
      !first.text.trim().endsWith('?') &&
      !recent.some((l) => P.FILLERS.includes(l)) &&
      rng() < fillerChance(style, tone)
    ) {
      const filler = pick(rng, P.FILLERS);
      used.push(filler);
      text = filler.endsWith('.') ? `${filler} ${text}` : `${filler} ${lowerFirst(text)}`;
    }
    if (simple) text = expandContractions(text);
    const said = conformCustomerReply(text, { maxSentences: limit }).text || text;
    // Record a hidden fact only if the words that reveal it are in what was actually said.
    const spoken = fold(said);
    const survives = (s: Segment) =>
      spoken.includes(fold(simple ? expandContractions(s.text) : s.text));
    return {
      text: said,
      used,
      toldIds: kept.flatMap((s) => s.told ?? []),
      hintIds: kept.flatMap((s) => (s.hint ? [s.hint] : [])),
      revealedIds: kept.flatMap((s) => (s.reveal && survives(s) ? [s.reveal] : [])),
      voicedAssumptions: kept.flatMap((s) =>
        s.assumption ? [s.assumption.replace(/^assumption-/, '')] : [],
      ),
      pushed: kept.find((s) => s.push)?.push ?? null,
      flavoured: kept.find((s) => s.flavour)?.flavour ?? null,
      timelineAsked: kept.some((s) => s.push === 'timeline'),
      followUpGiven: kept.some((s) => s.followUp),
      echoed: kept.find((s) => s.echo)?.echo ?? null,
      customerChecks: kept.flatMap((s) => (s.check ? [s.check] : [])),
      confusedBy: kept.find((s) => s.confused !== undefined)?.confused ?? null,
      limit,
    };
  };

  // A curveball that makes the customer go quiet, or an active silence.
  if (curveball.fired?.type === 'go-silent') {
    return result([{ text: curveball.fired.statement, priority: 0 }], plan.maxSentences);
  }
  if (plan.mode === 'silent') {
    return result([{ text: say(P.SILENT), priority: 0 }], plan.maxSentences);
  }
  if (plan.mode === 'off-role') {
    return result([{ text: say(P.OFF_ROLE), priority: 0 }], plan.maxSentences);
  }
  if (plan.mode === 'low-effort') {
    return result([{ text: say(P.LOW_EFFORT), priority: 0 }], plan.maxSentences);
  }

  const segments: Segment[] = [];
  const add = (text: string | null | undefined, priority: number, extra: Partial<Segment> = {}) => {
    if (text && text.trim() !== '') segments.push({ text, priority, ...extra });
  };

  if (curveball.statusChange === 'resolved' && runtime.customer.curveball.type === 'go-silent') {
    add(say(P.RE_ENGAGED), 1);
  }

  // -- The first exchange: the customer answers the greeting, then says why they called.
  if (plan.beat === 'reason') {
    if (plan.notice) {
      add(fill(say(P.NOTICE_NO_GREETING), { channel: channelOf(scenario) }), 0);
    } else if (!terse) {
      const named = analysis.introducedName && rng() < 0.4;
      add(
        named
          ? fill(say(P.ACK_GREETING_NAMED), { name: analysis.introducedName ?? '' })
          : say(P.ACK_GREETING, P.ACK_GREETING_SIMPLE),
        3,
      );
    }
  }

  // -- How the customer reacts to what the engineer did.
  // What the customer restates when the engineer got it wrong. A call back never restates the
  // opening problem statement as if nothing had happened: it uses its own purpose line.
  const restate = () =>
    analysis.summary.fault === 'count'
      ? firstSentenceOf(scenario.impactVariant.detail)
      : firstSentenceOf(
          cfg.callStage === 'first-contact' ? scenario.openingCore : scenario.stageFrame.opening,
        );
  const reminder = plan.say.find((s) => s.kind === 'reminder');
  const record = plan.say.filter((s) => s.kind === 'record');
  let reminderUsed = false;
  const reactionLine = (
    reaction: Reaction,
  ): { text: string; extra?: Partial<Segment>; priority?: number } | null => {
    switch (reaction) {
      case 'blamed':
        return { text: say(P.BLAMED) };
      case 'dismissed':
        return { text: say(P.DISMISSED) };
      case 'confused': {
        const term = plan.term ?? '';
        return {
          text: term
            ? fill(say(P.CONFUSED_TERM, P.CONFUSED_TERM_SIMPLE), { term })
            : say(P.CONFUSED, P.CONFUSED_SIMPLE),
          extra: { confused: term },
        };
      }
      case 'asks-to-repeat':
        return { text: say(P.ASK_REPEAT) };
      case 'repeated': {
        const lead = say(P.REPEATED, P.REPEATED_SIMPLE);
        reminderUsed = reminder !== undefined;
        return {
          text: reminder ? `${lead} ${pick(rng, P.AS_I_SAID)} ${lowerFirst(reminder.text)}` : lead,
        };
      }
      case 'in-record': {
        // The answer is what the case already says; the lead is the customer's reaction to being
        // asked. The answer is part of the same sentence, so it is never cut apart from the lead.
        const answer = joinSentences(record.map((s) => s.text));
        if (answer === '') return null;
        const lead = say(P.IN_RECORD, P.IN_RECORD_SIMPLE);
        const joins = SAFE_START.test(answer);
        return {
          text: `${joins ? lead : lead.replace(/,$/, '.')} ${joins ? lowerFirst(answer) : answer}`,
          extra: { told: record.map((s) => s.id) },
          priority: 0,
        };
      }
      case 'already-tried':
        return { text: say(P.ALREADY_TRIED) };
      case 'from-scratch':
        return { text: say(P.FROM_SCRATCH) };
      case 'premature-fix':
        return { text: say(P.PREMATURE_FIX) };
      case 'basics':
        return { text: say(P.BASICS) };
      case 'unsupported-promise':
        return { text: say(P.PROMISE_SKEPTICAL, P.PROMISE_SKEPTICAL_SIMPLE) };
      case 'conflicting-commitment':
        return {
          text: fill(say(P.CONFLICT), {
            old: analysis.conflict?.due ?? 'earlier',
            new: analysis.commitment?.due ?? 'later',
          }),
        };
      case 'vague-commitment':
        return { text: say(P.VAGUE_COMMITMENT, P.VAGUE_COMMITMENT_SIMPLE) };
      case 'summary-wrong':
        return { text: `${say(P.SUMMARY_WRONG)} ${restate()}` };
      case 'echo':
        return plan.echo
          ? {
              text: fill(say(P.ECHO, P.ECHO_SIMPLE), { x: describeCommitment(plan.echo) }),
              extra: { echo: plan.echo.id },
            }
          : null;
      case 'ownership':
        return { text: say(P.OWNERSHIP, P.OWNERSHIP_SIMPLE) };
      case 'next-steps':
        return { text: say(P.NEXT_STEPS, P.NEXT_STEPS_SIMPLE) };
      case 'knows-case':
        return { text: say(P.KNOWS_CASE) };
      case 'update-given':
        return { text: say(P.UPDATE_GIVEN) };
      case 'escalation-explained':
        return { text: say(P.ESCALATION_EXPLAINED) };
      case 'cadence':
        return { text: say(P.CADENCE) };
      case 'resolution':
        return { text: say(P.RESOLUTION) };
      case 'agreement':
        return {
          text: runtime.stageMet.includes('cause-explained')
            ? say(P.AGREEMENT_READY)
            : say(P.AGREEMENT_WAITING),
        };
      case 'cause':
        return { text: say(P.CAUSE) };
      case 'empathy-specific':
      case 'empathy-generic':
        return { text: say(P.EMPATHY, P.EMPATHY_SIMPLE) };
      case 'impact-acknowledged':
        return { text: say(P.IMPACT_ACK) };
      case 'summary-right':
      case 'confirmed':
        return { text: say(P.SUMMARY) };
      case 'assumption-accepted':
        return { text: say(P.ASSUMPTION_ACCEPTED) };
      case 'assumption-challenged':
        return { text: say(P.ASSUMPTION_CHALLENGED) };
      case 'follow-up':
        reminderUsed = reminder !== undefined;
        return reminder
          ? { text: afterLead(say(P.FOLLOW_UP), reminder.text) }
          : { text: say(P.NOTHING_MORE) };
      case 'self-correction':
        return { text: say(P.SELF_CORRECTION) };
      case 'instruction':
        return { text: say(P.INSTRUCTION, P.INSTRUCTION_SIMPLE) };
      case 'closing':
        return null;
    }
  };
  const primary = plan.reactions.find((r) => r !== 'closing');
  let reaction = primary ? reactionLine(primary) : null;
  // What the engineer did that the customer has to answer is never cut for length; the other
  // reactions go first when a reply is too long.
  const reactionPriority = reaction && primary && MUST_REACT.has(primary) ? 0 : 1;

  // -- What the customer tells the engineer.
  const facts: Segment[] = [];
  const broad =
    c.discoveryIntents.length > 0 && c.discoveryIntents.every((i) => i === 'problem_description');
  const vagueNow = style === 'vague' && broad && plan.beat === 'normal';
  let vagueUsed = false;

  const details = plan.say.filter((s) => s.kind === 'detail');
  const detail = detailLine(details, { simple, terse, rng });
  if (detail) facts.push({ text: detail.text, priority: 0, told: detail.ids });

  // When the engineer opens with a question instead of waiting to hear why the customer called,
  // the customer gives the reason in a sentence and answers the question: the answer is not cut.
  // The same goes for a customer who first has to ask who they are speaking to.
  const reasonBeat = plan.beat === 'reason';
  const answering = reasonBeat && plan.say.some((s) => ANSWER_KINDS.has(s.kind));
  const shortReason = answering || plan.notice;
  // The first reply keeps to the length of an opening. After the reason, a notice and whatever the
  // engineer has earned, only as many plain answers as still fit are kept whatever the length, and
  // at least one when nothing else answers what was asked.
  const earned =
    (details.length > 0 ? 1 : 0) +
    plan.say.filter((s) => ['full', 'partial', 'checkable', 'unknown'].includes(s.kind)).length;
  const room = reasonBeat
    ? Math.max(earned > 0 ? 0 : 1, plan.maxSentences - (plan.notice ? 1 : 0) - 1 - earned)
    : 0;
  let answersKept = 0;
  const answerPriority = () => (reasonBeat && answersKept++ < room ? 0 : 1);

  for (const item of plan.say) {
    switch (item.kind) {
      case 'detail':
      case 'reminder':
      case 'record': // said inside the reaction to being asked for it
        break;
      case 'reason': {
        const line = reasonLine(item, { style, rng });
        facts.push({
          text: shortReason ? firstSentenceOf(line) : line,
          priority: 0,
          told: ['reason'],
        });
        break;
      }
      case 'impact':
        facts.push({ text: item.text, priority: 2, told: ['impact'] });
        break;
      case 'full':
        facts.push({
          text: item.checking ? `${item.checking} ${item.text}` : item.text,
          priority: 0,
          reveal: item.id,
        });
        break;
      case 'partial':
        facts.push({ text: item.text, priority: 0, reveal: item.id });
        break;
      case 'known':
        if (vagueNow) {
          if (!vagueUsed) {
            facts.push({ text: pick(rng, P.VAGUE_ANSWERS), priority: 1 });
            vagueUsed = true;
          }
          break;
        }
        facts.push({ text: item.text, priority: answerPriority(), told: [item.id] });
        if (item.colour) facts.push({ text: item.colour, priority: 4 });
        break;
      case 'hint':
        // A starter's clue comes with the reason for the call, and is the first thing kept after it.
        facts.push({ text: item.text, priority: reasonBeat ? 2 : 3, hint: item.id });
        break;
      case 'vague':
      case 'vague-firm':
        facts.push({ text: item.text, priority: answerPriority(), told: [item.id] });
        break;
      case 'checkable':
        facts.push({
          text: item.checking ? `${item.checking} ${item.text}` : item.text,
          priority: 0,
          told: [item.id],
        });
        break;
      case 'unknown': {
        // An unknown fact points at who would know, and offers to ask them: the offer is what the
        // customer remembers promising, and says again when the topic comes back or the call ends.
        const who = item.whoKnows;
        const mentions = who ? item.text.toLowerCase().includes(who.toLowerCase()) : false;
        const pointer = who && !mentions ? `${capFirst(who)} would know.` : '';
        const authoredOffer =
          /\b(?:i(?:'ll| will| can| could)? (?:ask|check with|find out)|let me (?:ask|check)|i'd have to ask)\b/i.test(
            item.text,
          );
        const offer = who && !authoredOffer && !terse ? 'I can ask them and let you know.' : '';
        facts.push({
          text: [item.text, pointer, offer].filter(Boolean).join(' '),
          priority: 0,
          told: [item.id],
          ...(who && (offer || authoredOffer) ? { check: { id: item.id, whoKnows: who } } : {}),
        });
        break;
      }
      case 'irrelevant':
        facts.push({ text: item.text, priority: 5, told: [item.id] });
        break;
      case 'assumption':
        facts.push({ text: item.text, priority: 3, told: [item.id], assumption: item.id });
        break;
    }
  }

  // Something held back, or something the customer simply does not have.
  const holds = plan.holds[0];
  if (holds) {
    facts.push({
      text: holds === 'trust' ? say(P.WITHHOLD_TRUST) : say(P.WITHHOLD_IMPACT),
      priority: 1,
    });
  } else if (plan.notKnown) {
    facts.push({
      text: simple
        ? pickFresh(rng, P.DONT_KNOW_SIMPLE, runtime.lastCustomerLines)
        : pickFresh(rng, P.DONT_KNOW[cfg.proficiency], runtime.lastCustomerLines),
      priority: 1,
    });
  }

  // A clarification that no reaction line carried still gets its answer.
  if (reminder && !reminderUsed && !(terse && facts.some((s) => s.priority === 0))) {
    facts.push({ text: afterLead(say(P.FOLLOW_UP), reminder.text), priority: 1 });
  }

  // Do not say yes twice: "Yes, exactly. Yes, I've just had another look and it's the newer one."
  if (
    reaction &&
    (primary === 'confirmed' || primary === 'summary-right') &&
    facts.some((s) => YES_START.test(s.text))
  ) {
    reaction = null;
  }

  if (terse) {
    // A terse customer answers the question and nothing more: what has to be said, then the first
    // other answer, up to two sentences' worth of answers in all. What the engineer did that the
    // customer has to answer ("You should have read the instructions") still gets a few words.
    const answersBack = reaction !== null && primary !== undefined && MUST_REACT.has(primary);
    let room = Math.max(
      0,
      2 - facts.filter((s) => s.priority === 0).length - (answersBack ? 1 : 0),
    );
    const answers = facts.filter((s) => {
      if (s.priority === 0) return true;
      if (s.priority <= 2 && room > 0) {
        room -= 1;
        return true;
      }
      return false;
    });
    if (reaction && (answersBack || answers.length === 0)) {
      add(firstSentenceOf(reaction.text), reaction.priority ?? reactionPriority, {
        ...reaction.extra,
        reaction: true,
      });
    }
    segments.push(...answers);
  } else {
    if (reaction) {
      add(reaction.text, reaction.priority ?? reactionPriority, {
        ...reaction.extra,
        reaction: true,
      });
    }
    segments.push(...facts);
  }

  // -- A curveball, and what the customer asks for.
  if (curveball.fired) add(curveball.fired.statement, 0);
  // Repeating an unresolved concern comes after the reaction and the answers: it is the first thing
  // to go when the reply is too long, and it is only counted as given when it was said.
  if (curveball.followUp?.followUp) add(curveball.followUp.followUp, 2, { followUp: true });

  const closing = closesCall(c);
  if (plan.push) {
    add(pushLine(plan.push, say, simple, terse), 2, { push: plan.push });
  } else if (closing) {
    // Do not thank the engineer twice in one reply.
    const thanked = segments.some((s) => /\bthank/i.test(s.text));
    const commitment = plan.closingCommitment;
    let line: string;
    if (commitment?.due && !terse) {
      const template = pickFresh(rng, P.CLOSING_WITH_COMMITMENT[tone], runtime.lastCustomerLines);
      line = fill(template, { x: describeCommitment(commitment) });
      used.push(template);
    } else {
      line = thanked
        ? say(P.CLOSING_CUSTOMER_NO_THANKS, P.CLOSING_CUSTOMER_NO_THANKS_SIMPLE)
        : say(P.CLOSING_CUSTOMER, P.CLOSING_CUSTOMER_SIMPLE);
    }
    add(line, 1);
    const offer = plan.customerCheck;
    if (offer && !terse) {
      add(fill(P.CLOSING_CUSTOMER_CHECK, { who: offer.action.replace(/^ask /, '') }), 2);
    }
  } else if (!terse && !c.askedQuestion && facts.length === 0 && !curveball.fired && !reaction) {
    add(say(P.PROMPT, P.PROMPT_SIMPLE), 2);
  }
  if (plan.flavour && !terse) {
    add(flavourLine(plan.flavour, say, scenario), 4, { flavour: plan.flavour });
  }

  // A talkative customer with nothing to tangent on in the scenario falls back to general chat.
  if (
    style === 'talkative' &&
    !closing &&
    scenario.irrelevantFacts.length === 0 &&
    plan.beat === 'normal' &&
    segments.length < 3 &&
    rng() < 0.3
  ) {
    const line = pickFresh(rng, P.TANGENTS[tone], runtime.lastCustomerLines);
    used.push(line);
    add(line, 5);
  }

  if (segments.length === 0) add(say(P.ACKS, P.ACKS_SIMPLE), 1);
  return result(segments, plan.maxSentences);
}

/**
 * Cuts the reply down until it is short enough for what kind of reply it is: the least important
 * segments go first. An answer is cut to its first sentence before it is given up altogether, so
 * that a customer who has something else to say still answers what was asked.
 */
function fit(segments: Segment[], limit: number): Segment[] {
  const kept = [...segments];
  const count = () => sentences(joinSentences(kept.map((s) => s.text))).length;
  while (kept.length > 1 && count() > limit) {
    let drop = -1;
    let worst = 0;
    kept.forEach((s, i) => {
      if (s.priority > 0 && s.priority >= worst) {
        worst = s.priority;
        drop = i;
      }
    });
    if (drop < 0) break;
    const segment = kept[drop] as Segment;
    const first = firstSentenceOf(segment.text);
    if (segment.told && segment.priority <= 2 && first !== '' && first !== segment.text.trim()) {
      kept[drop] = { ...segment, text: first };
    } else {
      kept.splice(drop, 1);
    }
  }
  return kept;
}

function detailLine(
  items: Sayable[],
  how: { simple: boolean; terse: boolean; rng: () => number },
): { text: string; ids: string[] } | null {
  const text = (kind: NonNullable<Sayable['detail']>) => items.find((i) => i.detail === kind);
  const name = text('name')?.text;
  const organisation = text('organisation')?.text;
  const role = text('role')?.text;
  const reference = text('case-reference');
  const parts: string[] = [];
  const ids: string[] = [];
  if (name) {
    ids.push('name');
    const who = how.terse
      ? name
      : how.simple
        ? `My name is ${name}`
        : pick(how.rng as never, [`It's ${name}`, `My name's ${name}`]);
    parts.push(
      organisation && !how.terse
        ? `${who}, from ${organisation}`
        : how.terse && organisation
          ? `${name}, ${organisation}`
          : who,
    );
    if (organisation) ids.push('organisation');
  } else if (organisation) {
    ids.push('organisation');
    parts.push(how.terse ? organisation : `I'm with ${organisation}`);
  }
  if (role) {
    ids.push('role');
    const where =
      organisation && !name
        ? ''
        : organisation && !ids.includes('organisation')
          ? ` at ${organisation}`
          : '';
    parts.push(how.terse ? role : `I'm ${aOrAn(role)} ${lowerFirst(role)}${where}`);
  }
  if (reference) {
    ids.push('case-reference');
    parts.push(
      reference.missing
        ? "I don't have the case number to hand"
        : how.terse
          ? reference.text
          : `The case number is ${reference.text}`,
    );
  }
  return parts.length > 0 ? { text: joinSentences(parts), ids } : null;
}

function reasonLine(
  item: Sayable,
  how: { style: EffectiveScenario['config']['style']; rng: () => number },
): string {
  if (how.style === 'terse') return item.text;
  if (how.style === 'vague') return `${pick(how.rng as never, P.VAGUE_LEADS)} ${item.text}`;
  const callingAlready = /^(?:i'?m calling|i am calling|the reason i)/i.test(item.text);
  if (callingAlready || !SAFE_START.test(item.text)) return item.text;
  return `${pick(how.rng as never, P.REASON_LEAD)} ${lowerFirst(item.text)}`;
}

function pushLine(
  push: PlanPush,
  say: (bank: Bank, simpleBank?: Bank) => string,
  simple: boolean,
  terse: boolean,
): string {
  // A terse customer asks in a few words, whatever their mood.
  if (terse) {
    const lines = P.PUSH_SHORT[push];
    return say({ calm: lines, worried: lines, firm: lines, hot: lines });
  }
  switch (push) {
    case 'timeline':
      return say(P.TIMELINE, P.TIMELINE_SIMPLE);
    case 'update':
      return say(P.PUSH_UPDATE);
    case 'history':
      return say(P.PUSH_HISTORY);
    case 'escalation':
      return say(P.PUSH_ESCALATION);
    case 'cadence':
      return say(P.PUSH_CADENCE);
    case 'cause':
      return say(P.PUSH_CAUSE);
    case 'resolution':
      return say(P.PUSH_RESOLUTION);
    case 'owner':
      return simple ? say(P.PUSH_OWNER) : say(P.PUSH_OWNER);
  }
}

function flavourLine(
  flavour: Flavour,
  say: (bank: Bank, simpleBank?: Bank) => string,
  scenario: EffectiveScenario,
): string {
  switch (flavour) {
    case 'timeline-worry':
      return say(P.FLAVOUR_TIMELINE_WORRY);
    case 'impact-worry':
      return say(P.FLAVOUR_IMPACT_WORRY);
    case 'urgency': {
      const stakes = firstSentenceOf(
        scenario.impactVariant.deadline ?? scenario.impactVariant.summary,
      );
      return `${say(P.FLAVOUR_URGENCY)} ${stakes}`;
    }
    case 'no-progress':
      return say(P.FLAVOUR_NO_PROGRESS);
    case 'wants-owner':
      return say(P.PUSH_OWNER);
    case 'challenge':
      return say(P.FLAVOUR_CHALLENGE);
    case 'escalate':
      return say(P.FLAVOUR_ESCALATE);
    case 'plan':
      return say(P.FLAVOUR_PLAN);
    case 'assurance':
      return say(P.FLAVOUR_ASSURANCE);
  }
}
