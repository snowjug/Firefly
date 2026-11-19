import {
  DIMENSIONS,
  IMPACT_LABELS,
  type BusinessImpact,
  type CallStage,
  type CurveballType,
  type DimensionId,
  type Proficiency,
} from '#shared/domain/vocab.ts';
import { truncate } from '#shared/domain/text.ts';

// The wording library for coaching. Everything the report says that is not a number or a quote
// comes from here: improvement templates with slots (customer first name, impact wording, deadline,
// the scenario's own better questions), strength explanations, dimension guidance and the
// next-practice recommendations. Templates never state what the customer did or felt; the report
// adds that from recorded state events.

export type StretchKind =
  | 'stretch-scoping'
  | 'stretch-empathy'
  | 'stretch-clarity'
  | 'stretch-ownership'
  | 'stretch-closing';

export type ImprovementKind =
  | 'no-introduction'
  | 'blame'
  | 'dismissive'
  | 'jargon'
  | 'unverified-promise'
  | 'premature-troubleshooting'
  | 'repeated-question'
  | 'no-ownership'
  | 'vague-ownership'
  | 'no-next-steps'
  | 'vague-next-steps'
  | 'no-impact-ack'
  | 'no-empathy'
  | 'missed-fact'
  | 'no-summary'
  | 'no-closing'
  | 'no-open-question'
  | 'few-topics'
  | 'unclear'
  | 'no-next-contact'
  | 'no-anything-else'
  | StretchKind;

export const IMPROVEMENT_DIMENSION: Record<ImprovementKind, DimensionId> = {
  'no-introduction': 'opening-rapport',
  blame: 'empathy-deescalation',
  dismissive: 'empathy-deescalation',
  jargon: 'clarity',
  'unverified-promise': 'ownership-next-steps',
  'premature-troubleshooting': 'scoping-discovery',
  'repeated-question': 'scoping-discovery',
  'no-ownership': 'ownership-next-steps',
  'vague-ownership': 'ownership-next-steps',
  'no-next-steps': 'ownership-next-steps',
  'vague-next-steps': 'ownership-next-steps',
  'no-impact-ack': 'empathy-deescalation',
  'no-empathy': 'empathy-deescalation',
  'missed-fact': 'scoping-discovery',
  'no-summary': 'closing',
  'no-closing': 'closing',
  'no-open-question': 'opening-rapport',
  'few-topics': 'scoping-discovery',
  unclear: 'clarity',
  'no-next-contact': 'ownership-next-steps',
  'no-anything-else': 'closing',
  'stretch-scoping': 'scoping-discovery',
  'stretch-empathy': 'empathy-deescalation',
  'stretch-clarity': 'clarity',
  'stretch-ownership': 'ownership-next-steps',
  'stretch-closing': 'closing',
};

/** A stretch builds on something that went well; it is not a fault. */
export const isStretch = (kind: ImprovementKind): kind is StretchKind =>
  kind.startsWith('stretch-');

export type StrengthKind =
  | 'discovery'
  | 'ownership-clear'
  | 'impact-acknowledged'
  | 'empathy-specific'
  | 'summary'
  | 'recap'
  | 'next-steps-specific'
  | 'corrects-assumption'
  | 'jargon-explained'
  | 'introduction'
  | 'promise-realistic'
  | 'next-contact'
  | 'anything-else';

export const STRENGTH_DIMENSION: Record<StrengthKind, DimensionId> = {
  discovery: 'scoping-discovery',
  'ownership-clear': 'ownership-next-steps',
  'impact-acknowledged': 'empathy-deescalation',
  'empathy-specific': 'empathy-deescalation',
  summary: 'clarity',
  recap: 'closing',
  'next-steps-specific': 'ownership-next-steps',
  'corrects-assumption': 'clarity',
  'jargon-explained': 'clarity',
  introduction: 'opening-rapport',
  'promise-realistic': 'ownership-next-steps',
  'next-contact': 'closing',
  'anything-else': 'closing',
};

export interface PhraseContext {
  name: string; // customer first name
  product: string;
  stage: CallStage;
  proficiency: Proficiency;
  impact: BusinessImpact;
  // The customer's own words about the impact or deadline, set only when they really appear in the
  // transcript, so a suggested line never claims the customer said something they did not.
  impactQuote: string | null;
  deadlineQuote: string | null;
  // A good question the trainee had not yet found an answer to (from the scenario's hidden facts).
  nextQuestion: string | null;
  // Something the customer said that the scenario knows to be mistaken (only if they really said it).
  assumption: string | null;
}

export interface FactSlots {
  label: string;
  importance: string;
  betterQuestion: string;
  revealWhen: string;
  missedConsequence: string;
  partial: boolean;
}

export interface ImprovementSlots {
  quote: string | null;
  fact?: FactSlots;
  upset?: boolean; // for "no empathy": the customer was already upset when the trainee replied
}

export interface ImprovementText {
  title: string;
  risk: string; // the standing reason; the report adds recorded state changes
  betterPhrasing: string;
  whyItWorks: string;
  advice: string; // the opportunity as behaviour, finishing "The biggest opportunity is to ..."
}

// ---------------------------------------------------------------------------------------
// Small helpers

export const quoted = (text: string): string => `\u201c${text}\u201d`;

/** Lower-cases the first letter unless the first word is "I" or an acronym. */
export function lcfirst(text: string): string {
  const word = text.split(/\s/)[0] ?? '';
  if (/^I(?:['\u2019](?:m|d|ll|ve))?$/.test(word) || /^[A-Z]{2,}/.test(word)) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

const ALWAYS_CAPITAL =
  /^(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|june|july|august|september|october|november|december)$/i;

/** A hidden fact's label as it reads inside a sentence: lower-cased, except names and days. */
export function lowerLabel(label: string, names: string[] = []): string {
  const word = (label.split(/\s/)[0] ?? '').replace(/[^A-Za-z]/g, '');
  if (ALWAYS_CAPITAL.test(word) || names.includes(word)) return label;
  return lcfirst(label);
}

/** A label after the colon of a title: a colon inside the label would read as "found: the new hire: who". */
const inTitle = (label: string): string => label.replace(/:\s+/g, ' \u2013 ');

const stripEnd = (text: string): string => text.trim().replace(/[.!?]+$/, '');

export function article(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

/** The first variant that fits, or the last one cut to size. */
export function firstFitting(max: number, variants: (string | null)[]): string {
  const usable = variants.filter((v): v is string => typeof v === 'string' && v.length > 0);
  return usable.find((v) => v.length <= max) ?? truncate(usable[usable.length - 1] ?? '', max);
}

const STAGE_CLAUSE: Record<CallStage, (name: string) => string> = {
  'first-contact': (name) => `${name} was explaining the problem for the first time`,
  'follow-up': (name) => `${name} was following up on a case that was already open`,
  escalated: (name) => `${name}'s case had already been escalated`,
  closure: (name) => `${name} expected a wrap-up`,
};

/** What the call stage means for how a mistake lands (from the stage definitions), or ''. */
export function stageLead(stage: CallStage, name: string): string {
  if (stage === 'follow-up') {
    return `This was a follow-up on an open case, where ${name} expected progress.`;
  }
  if (stage === 'escalated') {
    return 'This was an escalated case: earlier contacts had not resolved it, and trust was already strained.';
  }
  return '';
}

// ---------------------------------------------------------------------------------------
// Plain-language rewrites for jargon (so the suggested line restates the SAME sentence)

const PLAIN_WORDS: [RegExp, string][] = [
  [/\bcached (?:credentials|passwords?)\b/gi, 'saved sign-in details'],
  [/\blockout policy\b/gi, 'rule that locks an account after too many wrong tries'],
  [/\bgroup policy\b/gi, 'company-wide settings'],
  [/\bactive directory\b/gi, 'company list of accounts'],
  [/\bload balancer\b/gi, 'system that shares out the traffic'],
  [/\bip address\b/gi, 'network address'],
  [/\bstack trace\b/gi, 'error log'],
  [/\broot cause\b/gi, 'underlying cause'],
  [/\bconfiguration drift\b/gi, 'settings that slowly changed'],
  [/\bserver-side\b/gi, 'on our servers'],
  [/\bclient-side\b/gi, 'on your device'],
  [/\bcredentials?\b/gi, 'sign-in details'],
  [/\bcach(?:e|es|ing)\b/gi, 'saved page data'],
  [/\bcached\b/gi, 'saved'],
  [/\bauthentication\b/gi, 'sign-in'],
  [/\bauthenticated\b/gi, 'signed in'],
  [/\bauthenticating\b/gi, 'signing in'],
  [/\bauthenticate\b/gi, 'sign in'],
  [/\bauthori[sz]ation\b/gi, 'permission'],
  [/\bauthori[sz]ed\b/gi, 'allowed'],
  [/\btokens?\b/gi, 'sign-in pass'],
  [/\bdns\b/gi, 'internet address lookup'],
  [/\b(?:tls|ssl)\b/gi, 'secure connection'],
  [/\bapi\b/gi, 'link between the two systems'],
  [/\btenants?\b/gi, 'company account'],
  [/\bpropagat(?:e|es|ed)\b/gi, 'spread'],
  [/\bpropagat(?:ing|ion)\b/gi, 'spreading'],
  [/\breplicat(?:e|es|ed)\b/gi, 'copy'],
  [/\breplicat(?:ing|ion)\b/gi, 'copying'],
  [/\bprovisioning\b/gi, 'setting up'],
  [/\bprovision(?:ed)?\b/gi, 'set up'],
  [/\bsso\b/gi, 'single sign-in'],
  [/\b(?:mfa|2fa)\b/gi, 'extra sign-in check'],
  [/\bcname\b/gi, 'domain alias'],
  [/\bregistry\b/gi, 'settings store'],
  [/\bpayloads?\b/gi, 'data that was sent'],
  [/\bendpoints?\b/gi, 'connection point'],
  [/\bregressions?\b/gi, 'fault that came back after an update'],
  [/\btelemetry\b/gi, 'usage and error data'],
  [/\bback-?end\b/gi, 'system behind the screen'],
  [/\bfront-?end\b/gi, 'what you see on screen'],
  [/\b(?:ldap|saml|oauth|kerberos)\b/gi, 'sign-in system'],
  [/\bhandshake\b/gi, 'start-up check between the two systems'],
  [/\bpackets?\b/gi, 'small pieces of data'],
  [/\bbandwidth\b/gi, 'connection capacity'],
  [/\bfirewall\b/gi, 'security barrier'],
  [/\bproxy\b/gi, 'go-between server'],
  [/\bsubnets?\b/gi, 'network section'],
  [/\blatency\b/gi, 'delay'],
  [/\bthrottling\b/gi, 'slowing things down'],
  [/\bthrottl(?:ed|e)\b/gi, 'slowed down'],
  [/\bschema\b/gi, 'structure'],
  [/\bsql\b/gi, 'database'],
  [/\bqueries\b/gi, 'requests'],
  [/\bquery\b/gi, 'request'],
  [/\btimeouts?\b/gi, 'wait before giving up'],
  [/\bcdn\b/gi, 'delivery network'],
  [/\bthreads?\b/gi, 'process'],
  [/\bwebhooks?\b/gi, 'automatic notification'],
  [/\bsdk\b/gi, 'toolkit'],
  [/\bcli\b/gi, 'command-line tool'],
  [/\bdaemon\b/gi, 'background service'],
  [/\bcron\b/gi, 'scheduled task'],
  [/\brollback\b/gi, 'return to the previous version'],
  [/\bhotfix\b/gi, 'quick fix'],
  [/\bsla\b/gi, 'agreed response time'],
  [/\brca\b/gi, 'cause report'],
  [/\bdb\b/gi, 'database'],
  [/\bvm\b/gi, 'virtual computer'],
];

export function hasJargon(sentence: string): boolean {
  return PLAIN_WORDS.some(([pattern]) => sentence.search(pattern) !== -1);
}

/** Restates a sentence with common technical terms swapped for everyday words, or null. */
export function plainVersion(sentence: string): { text: string; terms: string[] } | null {
  const terms: string[] = [];
  let text = sentence;
  for (const [pattern, plain] of PLAIN_WORDS) {
    text = text.replace(pattern, (match) => {
      terms.push(match);
      return plain;
    });
  }
  if (terms.length === 0) return null;
  if (/^[A-Z]/.test(sentence)) text = text.charAt(0).toUpperCase() + text.slice(1);
  return { text, terms };
}

// ---------------------------------------------------------------------------------------
// Improvements

const NEXT_UPDATE = 'in 20 minutes';

function jargonText(ctx: PhraseContext, slots: ImprovementSlots): ImprovementText {
  const { name } = ctx;
  const plain = slots.quote ? plainVersion(slots.quote) : null;
  const check = `Does that make sense so far, ${name}?`;
  const betterPhrasing = plain
    ? firstFitting(500, [`${stripEnd(plain.text)}. ${check}`])
    : `Say it in everyday words first, then check it landed: ${quoted(`In simple terms, [what it means for ${name}]. ${check}`)}`;
  const audience =
    ctx.proficiency === 'novice'
      ? `${name} is set up as a novice customer: everyday vocabulary, so unexplained terms cause confusion.`
      : `${name} is set up as an intermediate customer, so a run of unexplained terms is hard to follow.`;
  return {
    title: 'Used a technical term without explaining it',
    risk: audience,
    betterPhrasing,
    whyItWorks: `Everyday words let ${name} follow and act on the point, and the check question tells you whether it landed.`,
    advice: `put technical terms into everyday words the first time you use them, then check that ${name} followed`,
  };
}

function blameText(ctx: PhraseContext, slots: ImprovementSlots): ImprovementText {
  const { name } = ctx;
  const aimedAtCustomer = !slots.quote || /\byou(?:r)?\b/i.test(slots.quote);
  if (aimedAtCustomer) {
    return {
      title: 'Blamed the customer for what happened',
      risk: 'Telling a customer what they should have done makes them defensive and less willing to share detail.',
      betterPhrasing: `Thanks for explaining that, ${name}. Let's work out what happened together: what did you see when it stopped working?`,
      whyItWorks:
        'It moves the conversation from who caused the problem to what happened, so the customer keeps helping you find the cause.',
      advice: `keep blame out of the call: describe what you see and ask ${name} what happened instead`,
    };
  }
  return {
    title: 'Pointed at someone else instead of owning the next step',
    risk: 'Blaming another team gives the customer nothing to act on and sounds as if nobody here owns the problem.',
    betterPhrasing: `I can see why that's frustrating, ${name}. I'll find out what happened and tell you what I learn.`,
    whyItWorks:
      'It takes responsibility for finding the answer instead of pointing elsewhere, which the customer cannot do anything about.',
    advice: 'own the next step instead of pointing at another team',
  };
}

function dismissiveText(ctx: PhraseContext): ImprovementText {
  const { name, impactQuote } = ctx;
  return {
    title: "Played down the customer's concern",
    risk: 'Telling a customer their concern is small or not a problem makes them feel unheard, which usually raises the temperature and cuts trust.',
    betterPhrasing: firstFitting(500, [
      impactQuote
        ? `I hear you, ${name}: ${quoted(impactQuote)} That matters, so let's get it sorted. Can you tell me what you see when you try?`
        : null,
      `I hear you, ${name}, and I can see why this matters. Let's get it sorted: can you tell me what you see when you try?`,
    ]),
    whyItWorks:
      "Repeating the customer's own words shows the concern registered, and moving straight to a question shows you will act on it.",
    advice: `take ${name}'s concern seriously instead of playing it down: say that it matters, then ask what ${name} sees`,
  };
}

function promiseText(ctx: PhraseContext): ImprovementText {
  const { name, deadlineQuote } = ctx;
  const commit = `I can't promise a fix time until I know the cause, ${name}. What I can promise is that I'll look into it now and update you ${NEXT_UPDATE}, even if I don't have an answer yet.`;
  return {
    title: 'Promised an outcome or time that could not be verified',
    risk: 'A promise you cannot yet verify becomes a broken promise if the cause takes longer, and the customer remembers it.',
    betterPhrasing: firstFitting(500, [
      deadlineQuote ? `You said ${quoted(deadlineQuote)} ${commit}` : null,
      commit,
    ]),
    whyItWorks:
      'It commits to what you control, the action and the time of the next update, so the promise can be kept.',
    advice:
      'promise what you control, an action and a time for the next update, instead of an outcome you cannot verify yet',
  };
}

function troubleshootingText(ctx: PhraseContext): ImprovementText {
  const { name, nextQuestion } = ctx;
  return {
    title: 'Went to fixes before understanding the problem',
    risk: 'Instructions before scoping can send the customer down the wrong path and make the call feel scripted.',
    betterPhrasing: nextQuestion
      ? `Before we try anything, ${name}, ${lcfirst(nextQuestion)}`
      : `Before we try anything, ${name}, can you tell me what you see on screen and what changed just before this started?`,
    whyItWorks:
      'Asking first shows you are working from facts, and the answer tells you which fix is worth trying.',
    advice: 'ask what is happening and when it started before you suggest any fix',
  };
}

function repeatedText(ctx: PhraseContext): ImprovementText {
  const { name, nextQuestion } = ctx;
  return {
    title: `Asked something ${name} had already answered`,
    risk: 'Asking again what the customer has already said tells them they were not listened to, and it costs patience.',
    betterPhrasing: nextQuestion
      ? `Thanks ${name}, I have that already. Next, ${lcfirst(nextQuestion)}`
      : `Thanks ${name}, I have that already. Let me ask about something new: what changed just before this started?`,
    whyItWorks:
      'Showing you kept the answer and moving to a new topic keeps the call moving and shows you were listening.',
    advice: `check what ${name} has already told you before you ask again`,
  };
}

function ownershipText(ctx: PhraseContext, vague: boolean): ImprovementText {
  const { name, stage } = ctx;
  const history =
    stage === 'escalated' || stage === 'follow-up'
      ? ` On a case that is ${stage === 'escalated' ? 'already escalated' : 'already open'}, that repeats what has gone wrong before.`
      : '';
  return {
    title: vague ? 'Ownership stayed vague' : 'Never said who would own the problem',
    risk: `Without a clear "I will", ${name} cannot tell who is responsible for what happens next.${history}`,
    betterPhrasing: `I'm going to take this on, ${name}. I'll look into it now and call you back ${NEXT_UPDATE} with what I've found, even if I don't have the answer yet.`,
    whyItWorks: `"I'll" plus an action and a time tells ${name} exactly who owns the problem and when to expect to hear back.`,
    advice: `${vague ? 'make ownership explicit' : 'say who owns the problem'}, with an "I will" and one concrete action`,
  };
}

function nextStepsText(ctx: PhraseContext, vague: boolean): ImprovementText {
  const { name, product } = ctx;
  return {
    title: vague ? 'Next steps were vague' : 'No specific next step with a time',
    risk: vague
      ? `Phrases like "soon" or "get back to you" leave ${name} guessing and likely to chase.`
      : `Without a next step and a time, ${name} has nothing to hold on to after the call.`,
    betterPhrasing: `Here's what happens next, ${name}: I'll check the problem with ${product} now and call you back ${NEXT_UPDATE} with what I find. If anything changes before then, tell me and I'll add it.`,
    whyItWorks:
      'A named action and a time give the customer something to hold you to, so they do not have to chase.',
    advice: vague
      ? 'swap "soon" and "get back to you" for one specific next step with a time'
      : 'agree one specific next step with a time',
  };
}

function impactText(ctx: PhraseContext): ImprovementText {
  const { name, impactQuote, impact } = ctx;
  const act = `I'll treat it as urgent and start with the quickest way to get you moving again.`;
  return {
    title: `Did not acknowledge what this meant for ${name}`,
    risk: `The impact in this call was ${IMPACT_LABELS[impact].label.toLowerCase()}, and none of your replies acknowledged it.`,
    betterPhrasing: firstFitting(500, [
      impactQuote
        ? `${name}, I can hear how much is riding on this: ${quoted(impactQuote)} ${act}`
        : null,
      `${name}, I can hear how much is riding on this. ${act}`,
    ]),
    whyItWorks:
      "Using the customer's own words shows the impact registered, and saying what you will do about it turns sympathy into action.",
    advice: `acknowledge what the problem means for ${name} before you move on`,
  };
}

function empathyText(ctx: PhraseContext, upset: boolean): ImprovementText {
  const { name, impactQuote } = ctx;
  return {
    title: upset ? `No empathy while ${name} was upset` : 'No empathy shown during the call',
    risk: `None of your replies acknowledged how ${name} was feeling.`,
    betterPhrasing: firstFitting(500, [
      impactQuote
        ? `I'm sorry this is happening, ${name}. ${quoted(impactQuote)} I can see why that's stressful. Let me see what I can do to put it right.`
        : null,
      `I'm sorry this is happening, ${name}. I can see why it's stressful, and I want to put it right for you.`,
    ]),
    whyItWorks:
      'Naming the feeling and tying it to what the customer said shows you understood their situation, not only their words.',
    advice: `show early that you understand how ${name} feels, in a sentence tied to what ${name} said`,
  };
}

/**
 * What an "Asks ..." trigger describes, without the leading verb. A second alternative ("or asks her
 * to send the logs again") is dropped, because it can make poor advice.
 */
function firstAsk(revealWhen: string): string | null {
  if (!/^asks?\s/i.test(revealWhen)) return null;
  const first = stripEnd(revealWhen)
    .replace(/^asks?\s+/i, '')
    .split(/,?\s+or\s+asks?\b/i)[0];
  return first ? first.trim() : null;
}

/** What to ask, as advice ("ask whether every customer is affected"), from the scenario's own trigger. */
export function askAdvice(fact: Pick<FactSlots, 'revealWhen' | 'betterQuestion'>): string {
  const first = firstAsk(fact.revealWhen);
  return first ? `ask ${first}` : `ask a question like ${quoted(fact.betterQuestion)}`;
}

function missedFactText(fact: FactSlots): ImprovementText {
  const first = firstAsk(fact.revealWhen);
  const reveals = first
    ? `It works because it asks ${first}.`
    : `It works because it goes straight to the missing detail: ${lcfirst(fact.label)}.`;
  const ask = askAdvice(fact);
  return {
    title: fact.partial
      ? `Only part found: ${inTitle(fact.label)}`
      : `Did not find out: ${inTitle(fact.label)}`,
    risk: fact.partial
      ? `Only part of this came out. ${fact.missedConsequence}`
      : fact.missedConsequence,
    betterPhrasing: fact.betterQuestion,
    whyItWorks: reveals,
    advice: fact.partial ? `follow up on the part you did not get: ${ask}` : ask,
  };
}

function summaryText(ctx: PhraseContext, wholeClose: boolean): ImprovementText {
  const { name } = ctx;
  if (wholeClose) {
    return {
      title: 'The call ended without a recap or a next step',
      risk: `Without a recap, ${name} cannot be sure what was agreed or when to expect to hear back.`,
      betterPhrasing: `Let me recap, ${name}: I'll look into this now and call you back ${NEXT_UPDATE} with an update. Is there anything else I can help with before we finish?`,
      whyItWorks:
        'A short recap, a time for the next contact and a check for anything else leave no doubt about what was agreed, and they end the call on a clear, polite note.',
      advice:
        'close the call with a recap, the time of the next contact and a check for anything else',
    };
  }
  return {
    title: 'Did not recap what was agreed',
    risk: `Without a recap, ${name} has to rely on memory for what happens next.`,
    betterPhrasing: `Just to make sure we're agreed, ${name}: I'll look into this now and call you back ${NEXT_UPDATE}, and if anything changes before then, tell me. Does that work for you?`,
    whyItWorks:
      'Saying the agreement out loud lets the customer correct anything you got wrong while there is still time.',
    advice: 'recap what was agreed before the call ends',
  };
}

function introductionText(ctx: PhraseContext): ImprovementText {
  const { name, product, stage } = ctx;
  return {
    title: 'Opened without a greeting or introduction',
    risk: `${STAGE_CLAUSE[stage](name)}, and with no greeting or introduction there was no sign of who was on the call.`,
    betterPhrasing: `Hello ${name}, this is [your name] from the support team. I'm here to help with ${product}. What's been happening?`,
    whyItWorks: `A greeting, your name and an open question tell ${name} who is on the call and invite the whole story before you ask anything specific.`,
    advice: 'open with a greeting and your name before anything else',
  };
}

function openQuestionText(ctx: PhraseContext): ImprovementText {
  const { name } = ctx;
  return {
    title: 'Did not invite the story at the start',
    risk: `Without an open invitation in your first turns, ${name} is never asked to explain the problem in their own words, and you start from your own guess about what is wrong.`,
    betterPhrasing: `Thanks for calling, ${name}. Could you walk me through what's been happening, from the start?`,
    whyItWorks:
      'An open invitation lets the customer tell the whole story first, and it often brings out details you would not have known to ask about.',
    advice: 'invite the customer to tell the story in their own words early on',
  };
}

function fewTopicsText(ctx: PhraseContext): ImprovementText {
  const { name, nextQuestion } = ctx;
  return {
    title: 'Asked about only a few areas before moving on',
    risk: 'Covering what happened, when it started, what changed and who is affected is what turns up the facts behind a problem. With fewer areas covered, the details that explain it stay hidden.',
    betterPhrasing: nextQuestion
      ? `Let me make sure I have the full picture, ${name}. ${nextQuestion}`
      : `Let me make sure I have the full picture, ${name}: when did it start, what changed just before, and who else is affected?`,
    whyItWorks:
      'Asking across several areas shows a pattern sooner than digging into one, and it stops an early guess from steering the call.',
    advice:
      'cover what happens, when it started, what changed and who is affected before you suggest anything',
  };
}

function unclearText(ctx: PhraseContext): ImprovementText {
  const { name } = ctx;
  return {
    title: 'A reply that was hard to follow',
    risk: `Long or tangled replies make ${name} work to find the point, and the next step can get lost along the way.`,
    betterPhrasing: `Let me put that in two steps, ${name}. First, [the main point in one sentence]. Second, [what you will do next]. Does that make sense?`,
    whyItWorks:
      'One idea per sentence, with a check at the end, lets the customer follow and tells you at once if they did not.',
    advice: 'keep each reply to one idea and one question',
  };
}

function nextContactText(ctx: PhraseContext): ImprovementText {
  const { name } = ctx;
  return {
    title: `Did not say when ${name} would hear from you next`,
    risk: `Without a time for the next contact, ${name} has to chase or guess, and an update that never comes costs trust.`,
    betterPhrasing: `I'll call you back ${NEXT_UPDATE}, ${name}, even if I don't have an answer yet, so you're not left waiting.`,
    whyItWorks:
      'A named time for the next contact means the customer does not have to chase, and it gives you a deadline to keep.',
    advice: `say when ${name} will next hear from you`,
  };
}

function anythingElseText(ctx: PhraseContext): ImprovementText {
  const { name } = ctx;
  return {
    title: 'Did not check whether anything else was needed',
    risk: `Ending without asking leaves ${name} no last chance to raise something, and it can come back as a second call.`,
    betterPhrasing: `Is there anything else I can help with before we finish, ${name}?`,
    whyItWorks:
      'It gives the customer a last, easy chance to mention what they forgot, and it ends the call on a service note.',
    advice: 'ask whether there is anything else before you end the call',
  };
}

// A stretch builds on something that went well. Nothing was wrong, so the risk says so.
function stretchText(kind: StretchKind, ctx: PhraseContext): ImprovementText {
  const { name, impactQuote } = ctx;
  switch (kind) {
    case 'stretch-empathy':
      return {
        title: 'Stretch: keep the empathy going',
        risk: `Nothing went wrong here. You showed specific empathy once, and a customer's feelings can come back several times in a call, so each time is another chance to show you noticed.`,
        betterPhrasing: firstFitting(500, [
          impactQuote
            ? `I know ${quoted(impactQuote)} is weighing on you, ${name}, and I'm still treating it as a priority. Here's what I'm doing about it next: [action].`
            : null,
          `I know this has been stressful, ${name}, and I'm still treating it as a priority. Here's what I'm doing about it next: [action].`,
        ]),
        whyItWorks:
          'Repeating the acknowledgement, and tying it to an action, shows it was not a one-off line.',
        advice: `keep the empathy going: name how ${name} feels again whenever the concern comes back, and follow it with an action`,
      };
    case 'stretch-clarity':
      return {
        title: 'Stretch: check understanding as you go',
        risk: 'Nothing went wrong here. You played the situation back once; checking after each key point catches a misunderstanding while it is still small.',
        betterPhrasing: `So far I understand [the point you just covered]. Have I got that right, ${name}?`,
        whyItWorks:
          'A short check after each point lets the customer correct you early, instead of at the end.',
        advice: 'check understanding after each key point, not only once',
      };
    case 'stretch-ownership':
      return {
        title: 'Stretch: say what happens if the next step slips',
        risk: 'Nothing went wrong here. You named an action and a time; a customer under pressure also wants to know what happens if that time passes without news.',
        betterPhrasing: `I'll update you ${NEXT_UPDATE}. If I'm delayed, I'll tell you before then, and you can reach me on [how to reach you], ${name}.`,
        whyItWorks:
          'A fallback shows the commitment is firm, and it keeps the customer from having to chase.',
        advice:
          'say what happens if the next step slips, so the commitment holds even when plans change',
      };
    case 'stretch-closing':
      return {
        title: `Stretch: ask ${name} to say back what was agreed`,
        risk: 'Nothing went wrong here. A recap you give can still be misheard; hearing it back confirms that it landed.',
        betterPhrasing: `So we're on the same page, ${name}, could you tell me what you expect to happen next?`,
        whyItWorks:
          "Hearing the plan in the customer's own words shows whether it landed while there is still time to fix it.",
        advice: `ask ${name} to say back what happens next before you end the call`,
      };
    case 'stretch-scoping':
      return {
        title: `Stretch: test what ${name} assumed`,
        risk: `Nothing went wrong here. ${name} said ${quoted(ctx.assumption ?? 'something the facts do not support')} and the call moved on without testing it, so it stayed a belief rather than a fact.`,
        betterPhrasing: `That's useful to know, ${name}. What makes you think so? Let's check that before we change anything.`,
        whyItWorks:
          'Asking what leads to a belief tests it without arguing, and the answer often points at the real cause.',
        advice: `test what ${name} assumed by asking what makes ${name} think so, without arguing`,
      };
  }
}

/** The title, standing risk and suggested line for one improvement type. */
export function improvementText(
  kind: ImprovementKind,
  ctx: PhraseContext,
  slots: ImprovementSlots,
): ImprovementText {
  switch (kind) {
    case 'no-introduction':
      return introductionText(ctx);
    case 'blame':
      return blameText(ctx, slots);
    case 'dismissive':
      return dismissiveText(ctx);
    case 'jargon':
      return jargonText(ctx, slots);
    case 'unverified-promise':
      return promiseText(ctx);
    case 'premature-troubleshooting':
      return troubleshootingText(ctx);
    case 'repeated-question':
      return repeatedText(ctx);
    case 'no-ownership':
      return ownershipText(ctx, false);
    case 'vague-ownership':
      return ownershipText(ctx, true);
    case 'no-next-steps':
      return nextStepsText(ctx, false);
    case 'vague-next-steps':
      return nextStepsText(ctx, true);
    case 'no-impact-ack':
      return impactText(ctx);
    case 'no-empathy':
      return empathyText(ctx, slots.upset ?? true);
    case 'missed-fact':
      return missedFactText(slots.fact as FactSlots);
    case 'no-summary':
      return summaryText(ctx, false);
    case 'no-closing':
      return summaryText(ctx, true);
    case 'no-open-question':
      return openQuestionText(ctx);
    case 'few-topics':
      return fewTopicsText(ctx);
    case 'unclear':
      return unclearText(ctx);
    case 'no-next-contact':
      return nextContactText(ctx);
    case 'no-anything-else':
      return anythingElseText(ctx);
    case 'stretch-scoping':
    case 'stretch-empathy':
    case 'stretch-clarity':
    case 'stretch-ownership':
    case 'stretch-closing':
      return stretchText(kind, ctx);
  }
}

// ---------------------------------------------------------------------------------------
// Strengths

export interface StrengthText {
  title: string;
  because: string; // why the behaviour helps, stated without any customer reaction
}

export function strengthText(
  kind: StrengthKind,
  ctx: { name: string; factLabel?: string; importance?: string },
): StrengthText {
  const { name } = ctx;
  const importance = ctx.importance ?? 'important';
  switch (kind) {
    case 'discovery':
      return {
        title: `Uncovered ${article(importance)} ${importance} fact${ctx.factLabel ? `: ${inTitle(ctx.factLabel)}` : ''}`,
        // The title already names the fact, so this says why finding it matters instead.
        because:
          importance === 'critical'
            ? `Asking about this directly brought out the detail that mattered most in this case, so the rest of the call could work from facts instead of guesses.`
            : `Asking about this directly gave the call a clearer picture of what was happening, so the next questions could be better aimed.`,
      };
    case 'ownership-clear':
      return {
        title: 'Took clear ownership',
        because: 'Saying plainly what you will do tells the customer who owns the next step.',
      };
    case 'impact-acknowledged':
      return {
        title: `Acknowledged what this meant for ${name}`,
        because:
          'Putting the impact into words shows the customer that it registered before you move on to solving it.',
      };
    case 'empathy-specific':
      return {
        title: `Empathy that fitted ${name}'s situation`,
        because: `Tying empathy to what ${name} had actually said lands better than a general apology.`,
      };
    case 'summary':
      return {
        title: 'Played the situation back to check understanding',
        because: 'Summarising lets the customer correct anything you misunderstood.',
      };
    case 'recap':
      return {
        title: 'Recapped what was agreed',
        because: 'A recap at the end leaves no doubt about what was agreed.',
      };
    case 'next-steps-specific':
      return {
        title: 'Gave a specific next step with a time',
        because: 'A named action with a time gives the customer something concrete to rely on.',
      };
    case 'corrects-assumption':
      return {
        title: 'Tested a belief gently instead of arguing',
        because: 'Checking a belief, rather than contradicting it, keeps the customer on side.',
      };
    case 'jargon-explained':
      return {
        title: 'Explained a technical term in plain words',
        because: 'Putting the term in everyday words lets the customer follow the explanation.',
      };
    case 'introduction':
      return {
        title: 'Opened with a greeting and an introduction',
        because: 'Saying who you are and offering help tells the customer the call is in hand.',
      };
    case 'promise-realistic':
      return {
        title: 'Stayed honest about what could be promised',
        because:
          'Committing to actions and an update time, rather than an outcome, is a promise that can be kept.',
      };
    case 'next-contact':
      return {
        title: 'Confirmed when the next contact would be',
        because: 'A named time for the next contact means the customer does not have to chase.',
      };
    case 'anything-else':
      return {
        title: 'Checked whether anything else was needed',
        because: 'Asking gives the customer a last chance to raise something before the call ends.',
      };
  }
}

/** Generic titles for items a model judged without any rules finding behind them. */
export function modelStrengthTitle(dimension: DimensionId): string {
  return `Worked well: ${DIMENSIONS[dimension].short.toLowerCase()}`;
}

export function modelImprovementTitle(dimension: DimensionId, hasQuote: boolean): string {
  const label = DIMENSIONS[dimension].short.toLowerCase();
  return hasQuote ? `A moment to rework: ${label}` : `Something missing: ${label}`;
}

// ---------------------------------------------------------------------------------------
// Dimension guidance and next-practice recommendations

export type Gap = string;

export interface GuidanceContext extends PhraseContext {
  fact?: { betterQuestion: string };
}

export function dimensionGuidance(id: DimensionId, gap: Gap, ctx: GuidanceContext): string {
  const { name, product } = ctx;
  switch (`${id}:${gap}`) {
    case 'opening-rapport:straight-to-fix':
      return `Open with a greeting and your name before any instruction, then ask for the story: "Hello ${name}, this is [your name] from support. What's been happening?"`;
    case 'opening-rapport:blame':
      return `Keep your first turn about the problem, not who caused it: greet ${name}, say who you are and ask what is happening.`;
    case 'opening-rapport:no-greeting':
      return `Start with a greeting and your name so ${name} knows who is on the call: "Hello ${name}, this is [your name] from the support team."`;
    case 'opening-rapport:no-introduction':
      return `After the greeting, say your name and role and offer help, for example: "This is [your name] from support, and I'm here to help with ${product}."`;
    case 'opening-rapport:no-open-question':
      return `Invite ${name} to tell it in their own words before you ask specific questions, for example: "Tell me what you're seeing, from the start."`;
    case 'opening-rapport:no-empathy':
      return ctx.stage === 'closure'
        ? `Confirm the purpose of the call early: "You're calling to check this is sorted so we can close it, is that right?"`
        : ctx.stage === 'first-contact'
          ? `By your second turn, add one sentence that shows you understood how this affects ${name}.`
          : `Acknowledge the history or the wait in your first two turns, for example: "I'm sorry you've had to chase this. I have the case notes in front of me."`;
    case 'opening-rapport:none':
      return `Keep this opening. To stretch it, tie your first sentence of empathy to something ${name} actually said.`;

    case 'scoping-discovery:missed-fact':
      return ctx.fact
        ? `Look for the fact that changes the fix before you offer one. On this call the question was: ${quoted(ctx.fact.betterQuestion)}`
        : 'Look for the fact that changes the fix before you offer one: ask about other devices, recent changes and the exact message.';
    case 'scoping-discovery:few-topics':
      return 'Cover at least three areas before you suggest anything: what exactly happens, when it started, what changed, who is affected and what it is costing them.';
    case 'scoping-discovery:repeats':
      return 'Before you ask, check what the customer has already told you. Note answers as they come, so a repeat becomes a follow-up question instead.';
    case 'scoping-discovery:premature':
      return 'Hold fixes until you can say what is happening, since when and who is affected. Ask first, then suggest.';
    case 'scoping-discovery:partial':
      return 'When an answer is only partly there, follow up on it directly: ask for the exact wording, the exact time or the exact device.';
    case 'scoping-discovery:none':
      return 'Keep asking about different things (what, when, what changed, who) and check each answer before moving on. To stretch, test one assumption the customer has stated.';

    case 'empathy-deescalation:blame':
    case 'empathy-deescalation:dismissive':
      return `Take blame and dismissal out entirely: describe what you see, ask what ${name} saw, and name how the problem affects ${name}.`;
    case 'empathy-deescalation:no-impact':
      return `Say what the problem means for ${name} in their own words, then say what you will do about it.`;
    case 'empathy-deescalation:no-empathy':
      return `Add one specific sentence of empathy early, linked to something ${name} said, before your next question.`;
    case 'empathy-deescalation:curveball':
      return 'When the customer raises something new (a deadline, a manager, a cancellation), acknowledge it first, then say what you will do and when.';
    case 'empathy-deescalation:temperature':
      return `${name} ended the call hotter than it began. After each reply, check whether you named how ${name} feels before moving on to the next task.`;
    case 'empathy-deescalation:none':
      return 'Keep tying empathy to specifics. To stretch, follow it with an action: what you will do about the thing you just acknowledged.';

    case 'clarity:jargon':
      return ctx.proficiency === 'novice'
        ? `${name} is a novice, so put each technical term in everyday words the first time, then check it landed: "Does that make sense so far?"`
        : `Explain a technical term the first time it comes up, then check it landed with "Does that make sense so far?"`;
    case 'clarity:unclear':
      return 'Keep each message to one idea and one question. A long run of connected points is easier to follow when it is split in two.';
    case 'clarity:no-summary':
      return `Finish your explanation with a one-sentence summary in your own words, then check it: "So the plan is [plan]. Is that right, ${name}?"`;
    case 'clarity:none':
      return 'Your explanations were clear. To stretch, check understanding after each key point, not only at the end.';

    case 'ownership-next-steps:unverified-promise':
      return `Promise what you control instead of an outcome: "I'll look into it now and update you ${NEXT_UPDATE}, even if I don't have an answer yet."`;
    case 'ownership-next-steps:no-ownership':
    case 'ownership-next-steps:vague-ownership':
      return `Say "I will" with one concrete action: "I'm going to take this on, ${name}. I'll look into it now and call you back ${NEXT_UPDATE}."`;
    case 'ownership-next-steps:no-next-steps':
    case 'ownership-next-steps:vague-next-steps':
      return `Replace "soon" and "get back to you" with an action and a time: "I'll check this now and call you back ${NEXT_UPDATE}."`;
    case 'ownership-next-steps:no-next-contact':
      return `Name when ${name} will next hear from you, and say what happens if you have no news by then.`;
    case 'ownership-next-steps:none':
      return 'Keep naming who does what by when. To stretch, say what the customer should do if the next step does not happen on time.';

    case 'closing:no-summary':
      return `Recap what was agreed before you end: "Just to make sure we're agreed, ${name}: ..." and ask whether it is right.`;
    case 'closing:no-next-contact':
      return `Confirm when the next contact will be, with a time: "I'll call you back ${NEXT_UPDATE} either way."`;
    case 'closing:no-anything-else':
      return `Ask "Is there anything else I can help with before we finish?" so ${name} has a last chance to raise something.`;
    case 'closing:no-thanks':
      return `Finish politely: thank ${name} and say goodbye.`;
    case 'closing:none':
      return 'Keep closing with a recap, a time and a check. To stretch, ask the customer to say back what happens next.';
  }
  return DIMENSIONS[id].description;
}

export function practiceRecommendation(
  dimension: DimensionId,
  fact?: { betterQuestion: string },
  stretch = false,
): string {
  if (stretch) return stretchRecommendation(dimension);
  switch (dimension) {
    case 'opening-rapport':
      return 'In your next call, use your first turn for three things: a greeting, your name and role, and one open question. Add one sentence of empathy by your second turn.';
    case 'scoping-discovery':
      return `In your next call, ask about three different areas before you suggest any fix (what exactly happens, when it started, what changed), then ask what the customer has already tried.${
        fact ? ` From this call, a question worth practising: ${quoted(fact.betterQuestion)}` : ''
      }`;
    case 'empathy-deescalation':
      return 'In your next call, say what the problem means for the customer, in their own words, within your first three turns, and follow it with what you will do about it.';
    case 'clarity':
      return 'In your next call, put each technical term in everyday words the first time you use it, and finish your explanation with a one-sentence summary and a check: "Does that make sense so far?"';
    case 'ownership-next-steps':
      return `In your next call, say "I will" with one concrete action and a time for the next update, and do not promise when it will be fixed until you have verified it.`;
    case 'closing':
      return 'In your next call, use your last two turns for four things: a recap of what was agreed, the time of the next contact, "is there anything else?" and a thank-you.';
  }
}

/** When the weakest area still scored 5, the next step is a stretch rather than a repair. */
function stretchRecommendation(dimension: DimensionId): string {
  switch (dimension) {
    case 'opening-rapport':
      return 'Every area scored well, so stretch the opening: in your next call, link your first sentence of empathy to something the customer actually said, and say what you will cover before you start asking questions.';
    case 'scoping-discovery':
      return 'Every area scored well, so stretch your discovery: in your next call, test one assumption the customer states, by asking what makes them think so, instead of only collecting facts.';
    case 'empathy-deescalation':
      return 'Every area scored well, so stretch your empathy: in your next call, follow every acknowledgement with an action, saying what you will do about the thing you just acknowledged.';
    case 'clarity':
      return 'Every area scored well, so stretch your clarity: in your next call, check understanding after each key point, not only at the end.';
    case 'ownership-next-steps':
      return 'Every area scored well, so stretch your ownership: in your next call, say what the customer should do if your next step does not happen on time.';
    case 'closing':
      return 'Every area scored well, so stretch your close: in your next call, ask the customer to say back what happens next before you end the call.';
  }
}

export const CURVEBALL_PHRASES: Record<CurveballType, string> = {
  'ask-manager': 'asked for a manager',
  'threaten-cancel': 'raised the possibility of cancelling',
  deadline: 'introduced a hard deadline',
  'change-issue': 'raised a second problem',
  'go-silent': 'went quiet',
  'previous-bad-experience': 'brought up a poor earlier support experience',
  'unsupported-guarantee': 'asked for a guarantee',
  'challenge-credibility': 'questioned how experienced you were',
};
