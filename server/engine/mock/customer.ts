import type { TurnClassification } from '#shared/domain/classification.ts';
import type { EffectiveScenario } from '#shared/domain/config.ts';
import type { HiddenFact } from '#shared/domain/scenario.ts';
import type { CurveballTurnResult } from '../curveballs.ts';
import type { DiscoveryTurnResult, TellItem } from '../discovery.ts';
import { pick, pickFresh, type Rng } from '../rng.ts';
import { expandContractions, firstSentenceOf, joinSentences, wordCount } from '../textutil.ts';
import type { EngineRuntime } from '../types.ts';
import * as P from './phrasebank.ts';
import { toneOf, type Bank } from './phrasebank.ts';

// Demo-mode customer. It does not read a script: it turns the engine's decisions (what the
// trainee did, which facts may be shared, the customer's current state, any curveball) into a
// reply whose length, vocabulary and tone follow the scenario's communication style, proficiency
// and the customer's temperature. Live mode replaces only this step with a model.

export interface ComposeInput {
  scenario: EffectiveScenario;
  runtime: EngineRuntime; // after this turn's state updates
  c: TurnClassification;
  discovery: DiscoveryTurnResult;
  curveball: CurveballTurnResult;
  traineeTurnNumber: number;
  rng: Rng;
}

export interface ComposeResult {
  text: string;
  used: string[]; // fillers used, to avoid repeating them next turn
  toldIds: string[];
  hintIds: string[];
  voicedAssumptions: string[];
  timelineAsked: boolean;
  followUpGiven: boolean;
}

interface Segment {
  text: string;
  mandatory?: boolean;
}

function statementFor(fact: HiddenFact, mode: 'full' | 'partial', style: string): string {
  if (mode === 'partial') return fact.partialStatement ?? firstSentenceOf(fact.statement);
  if (style === 'terse') return fact.statementTerse ?? firstSentenceOf(fact.statement);
  if (style === 'non-native') return fact.statementSimple ?? fact.statement;
  return fact.statement;
}

function tellText(item: TellItem, style: string): string {
  if (style === 'terse') return firstSentenceOf(item.text);
  if (style === 'non-native') return item.simple ?? item.text;
  if (style === 'talkative' && item.elaboration) return `${item.text} ${item.elaboration}`;
  return item.text;
}

export function composeCustomerReply(input: ComposeInput): ComposeResult {
  const { scenario, runtime, c, discovery, curveball, traineeTurnNumber, rng } = input;
  const customer = runtime.customer;
  const cfg = scenario.config;
  const tone = toneOf(customer.temperature, cfg.startingTemperature);
  const style = cfg.style;
  const simple = style === 'non-native';
  const terse = style === 'terse';
  const used: string[] = [];
  const toldIds: string[] = [];
  const hintIds: string[] = [];
  const voicedAssumptions: string[] = [];
  let timelineAsked = false;
  let followUpGiven = false;

  const say = (bank: Bank, simpleBank?: Bank): string => {
    const lines = simple && simpleBank ? simpleBank[tone] : bank[tone];
    const line = pickFresh(rng, lines, runtime.lastCustomerLines);
    used.push(line);
    return line;
  };
  const finish = (segments: Segment[]): ComposeResult => {
    const cap = terse ? 28 : simple ? 60 : style === 'talkative' ? 130 : 85;
    const kept: Segment[] = [...segments];
    // Drop optional segments from the end until the reply fits the style's length.
    while (kept.length > 1 && wordCount(joinSentences(kept.map((s) => s.text))) > cap) {
      let idx = -1;
      for (let i = kept.length - 1; i >= 0; i--) {
        if (!kept[i]?.mandatory) {
          idx = i;
          break;
        }
      }
      if (idx <= 0) break;
      kept.splice(idx, 1);
    }
    let text = joinSentences(kept.map((s) => s.text));
    if (simple) text = expandContractions(text);
    return { text, used, toldIds, hintIds, voicedAssumptions, timelineAsked, followUpGiven };
  };

  // A curveball that makes the customer go quiet, or an active silence.
  if (curveball.fired?.type === 'go-silent') {
    return finish([{ text: curveball.fired.statement, mandatory: true }]);
  }
  if (customer.silentUntilEngaged) {
    return finish([{ text: say(P.SILENT), mandatory: true }]);
  }

  if (c.injectionAttempt) {
    return finish([{ text: say(P.OFF_ROLE), mandatory: true }]);
  }
  if (c.lowEffort) {
    return finish([{ text: say(P.LOW_EFFORT), mandatory: true }]);
  }

  const segments: Segment[] = [];
  if (
    curveball.statusChange === 'resolved' &&
    curveball.statusChange &&
    runtime.customer.curveball.type === 'go-silent'
  ) {
    segments.push({ text: say(P.RE_ENGAGED) });
  }

  // 1. How the customer reacts to what the trainee did.
  const earlyUnscopedFix =
    c.troubleshooting &&
    traineeTurnNumber <= 2 &&
    !c.acknowledgesImpact &&
    Object.keys(runtime.discovery).length === 0 &&
    discovery.newInfoCount === 0;
  let reaction: string | null = null;
  if (c.blame) reaction = say(P.BLAMED);
  else if (c.dismissive) reaction = say(P.DISMISSED);
  else if (c.jargon === 'unexplained' && cfg.proficiency === 'novice')
    reaction = say(P.CONFUSED, P.CONFUSED_SIMPLE);
  else if (discovery.repeated) reaction = say(P.REPEATED, P.REPEATED_SIMPLE);
  else if (earlyUnscopedFix) reaction = say(P.PREMATURE_FIX);
  else if (c.promise === 'unverified')
    reaction = say(P.PROMISE_SKEPTICAL, P.PROMISE_SKEPTICAL_SIMPLE);
  else if (c.ownership === 'clear') reaction = say(P.OWNERSHIP, P.OWNERSHIP_SIMPLE);
  else if (c.nextSteps === 'specific') reaction = say(P.NEXT_STEPS, P.NEXT_STEPS_SIMPLE);
  else if (c.empathy !== 'none') reaction = say(P.EMPATHY, P.EMPATHY_SIMPLE);
  else if (c.acknowledgesImpact) reaction = say(P.IMPACT_ACK);
  else if (c.summarises) reaction = say(P.SUMMARY);

  // 2. What the customer tells the trainee.
  const facts: string[] = [];
  const broad =
    c.discoveryIntents.length > 0 && c.discoveryIntents.every((i) => i === 'problem_description');
  const vagueNow = style === 'vague' && broad;

  for (const r of discovery.reveal) facts.push(statementFor(r.fact, r.mode, style));
  if (vagueNow) {
    facts.push(pick(rng, P.VAGUE_ANSWERS));
  } else {
    for (const item of discovery.tell) {
      if (item.repeat) continue;
      facts.push(tellText(item, style));
      toldIds.push(item.id);
    }
  }
  for (const hint of discovery.hints) {
    if (hint.hint) {
      facts.push(hint.hint);
      hintIds.push(hint.id);
    }
  }

  const withheld = discovery.withheld[0];
  if (withheld && withheld.reason !== 'timing') {
    facts.push(withheld.reason === 'trust' ? say(P.WITHHOLD_TRUST) : say(P.WITHHOLD_IMPACT));
  } else if (facts.length === 0 && discovery.unanswered.length > 0 && !discovery.repeated) {
    facts.push(
      simple
        ? pickFresh(rng, P.DONT_KNOW_SIMPLE, runtime.lastCustomerLines)
        : pickFresh(rng, P.DONT_KNOW[cfg.proficiency], runtime.lastCustomerLines),
    );
  }

  const assumption = scenario.incorrectAssumptions[0];
  if (
    assumption &&
    cfg.proficiency !== 'expert' &&
    !runtime.toldKnownFacts[`assumption-${assumption.id}`] &&
    traineeTurnNumber === 1 &&
    (style === 'talkative' ||
      style === 'vague' ||
      c.discoveryIntents.includes('problem_description'))
  ) {
    facts.push(assumption.statement);
    voicedAssumptions.push(assumption.id);
  }

  const answerSegments: Segment[] = facts.map((text) => ({ text }));
  if (terse) {
    // A terse customer answers the question and nothing more.
    if (answerSegments.length > 0) segments.push(...answerSegments.slice(0, 2));
    else if (reaction) segments.push({ text: firstSentenceOf(reaction) });
  } else {
    if (reaction && (answerSegments.length === 0 || !isNeutral(reaction)))
      segments.push({ text: reaction });
    segments.push(...answerSegments);
  }

  // 3. Curveballs.
  if (curveball.fired) segments.push({ text: curveball.fired.statement, mandatory: true });
  if (curveball.followUp?.followUp) {
    segments.push({ text: curveball.followUp.followUp, mandatory: true });
    followUpGiven = true;
  }

  // 4. The customer pushes the conversation forward when it needs it.
  const closing = c.wrapsUp || c.asksAnythingElse;
  const wantsTimeline =
    !customer.nextStepsStated &&
    traineeTurnNumber >= 3 &&
    (cfg.impact === 'high' || customer.urgency >= 70 || style === 'demanding') &&
    traineeTurnNumber - runtime.asksForTimelineAtTurn >= 3 &&
    !curveball.fired;
  if (closing) {
    // Do not thank the engineer twice in one reply.
    const thanked = segments.some((s) => /\bthank/i.test(s.text));
    segments.push({
      text: thanked
        ? say(P.CLOSING_CUSTOMER_NO_THANKS, P.CLOSING_CUSTOMER_NO_THANKS_SIMPLE)
        : say(P.CLOSING_CUSTOMER, P.CLOSING_CUSTOMER_SIMPLE),
    });
  } else if (wantsTimeline) {
    segments.push({ text: say(P.TIMELINE, P.TIMELINE_SIMPLE) });
    timelineAsked = true;
  } else if (!terse && !c.askedQuestion && facts.length === 0 && !curveball.fired) {
    segments.push({ text: say(P.PROMPT, P.PROMPT_SIMPLE) });
  } else if (!terse && tone === 'worried' && rng() < 0.25) {
    segments.push({ text: say(P.PROMPT, P.PROMPT_SIMPLE) });
  } else if (
    style === 'demanding' &&
    !customer.ownershipStated &&
    facts.length > 0 &&
    rng() < 0.5
  ) {
    segments.push({ text: say(P.PROMPT, P.PROMPT_SIMPLE) });
  }

  if (style === 'talkative' && !closing && rng() < 0.3) {
    const soFar = wordCount(joinSentences(segments.map((s) => s.text)));
    if (soFar < 45) {
      const line = pickFresh(rng, P.TANGENTS[tone], runtime.lastCustomerLines);
      used.push(line);
      segments.push({ text: line });
    }
  }

  if (segments.length === 0) segments.push({ text: say(P.ACKS, P.ACKS_SIMPLE) });
  return finish(segments);
}

function isNeutral(reaction: string): boolean {
  return (
    P.ACKS.calm.includes(reaction) ||
    P.ACKS.worried.includes(reaction) ||
    P.ACKS.firm.includes(reaction) ||
    P.ACKS.hot.includes(reaction)
  );
}
