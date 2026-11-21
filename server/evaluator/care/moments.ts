import type { EvidenceBehaviour } from '#shared/domain/classification.ts';
import { fold } from '#shared/domain/text.ts';
import type { DiscoveryIntent } from '#shared/domain/vocab.ts';
import { hasJargon } from '../phrasing.ts';
import { hits, type CareContext, type Hit, type SentenceView, type TurnView } from './context.ts';
import { isHousekeeping, sentenceIntents } from './intents.ts';
import {
  APOLOGY,
  CADENCE,
  CHECK_BACK,
  COMMIT_HEDGE,
  contentWords,
  EMPATHY,
  FIRST_PERSON_COMMIT,
  HISTORY,
  norm,
  OWNS_ACTION,
  OWNS_OUTCOME,
  overlap,
  SUMMARY_FRAME,
  THIRD_PARTY,
  TIME_REF,
  UPDATE_ACTION,
  VAGUE_TIME,
  WE_COMMIT,
} from './lexicon.ts';

// Readings of the call that more than one behaviour needs, worked out once per call: what each
// question asked about, where empathy was offered and whether anything useful followed it, who said
// they would do what, how a summary compares with what had been said, and where jargon went
// unexplained.

export interface IntentHit extends Hit {
  intents: DiscoveryIntent[];
}

export type EmpathyKind = 'specific' | 'with-action' | 'bare';
export interface EmpathyMoment {
  hit: Hit;
  kind: EmpathyKind;
  /** The stock phrase that carried the empathy ("i understand"), for spotting a repeated one. */
  lead: string;
  folded: string;
  apology: boolean;
}

export type OwnershipKind = 'clear' | 'partly' | 'third-party';
export interface OwnershipMoment {
  hit: Hit;
  kind: OwnershipKind;
}

export interface SummaryMoment {
  hit: Hit;
  /** The recap holds at least two things that were said earlier in the call. */
  grounded: boolean;
  /** The customer's very next reply pushed back on it. */
  corrected: boolean;
  /** Counts or days in the recap that nobody had said before. */
  ungrounded: string[];
  commitments: number;
}

export interface Commitment {
  hit: Hit;
  self: boolean;
  we: boolean;
  action: boolean;
  outcome: boolean;
  update: boolean;
  timed: boolean;
  vagueTime: boolean;
  cadence: boolean;
  hedged: boolean;
}

export interface JargonMoment {
  hit: Hit;
  explained: boolean;
}

export interface Analyses {
  intents: IntentHit[];
  empathy: EmpathyMoment[];
  ownership: OwnershipMoment[];
  summaries: SummaryMoment[];
  commitments: Commitment[];
  jargon: JargonMoment[];
}

const cache = new WeakMap<CareContext, Analyses>();

export function analyses(ctx: CareContext): Analyses {
  let found = cache.get(ctx);
  if (!found) {
    found = {
      intents: intentHits(ctx),
      empathy: empathyMoments(ctx),
      ownership: ownershipMoments(ctx),
      summaries: summaryMoments(ctx),
      commitments: commitments(ctx),
      jargon: jargonMoments(ctx),
    };
    cache.set(ctx, found);
  }
  return found;
}

/** Hits whose question asked about any of these topics. */
export const askedAbout = (a: Analyses, ...topics: DiscoveryIntent[]): IntentHit[] =>
  a.intents.filter((h) => h.intents.some((i) => topics.includes(i)));

// ---------------------------------------------------------------------------------------
// What each question asked about

function intentHits(ctx: CareContext): IntentHit[] {
  const out: IntentHit[] = [];
  for (const view of ctx.turns) {
    const matched = new Set<DiscoveryIntent>();
    for (const sentence of view.sentences) {
      const intents = sentenceIntents(sentence.text, sentence.question);
      if (intents.length === 0) continue;
      intents.forEach((i) => matched.add(i));
      out.push({ view, sentence, intents });
    }
    // The classification names topics that no sentence of ours matched (a model may read a question
    // more generously than the patterns do): the first question of the turn stands for them.
    const unmatched = view.turn.cls.discoveryIntents.filter((i) => !matched.has(i));
    const stand = view.sentences.find((s) => s.question) ?? view.sentences[0];
    if (unmatched.length > 0 && stand) out.push({ view, sentence: stand, intents: unmatched });
  }
  return out;
}

// ---------------------------------------------------------------------------------------
// Empathy: where it was offered, whether it was about something, whether anything followed

const SAME_SENTENCE = (a: SentenceView, b: SentenceView): boolean => a.text === b.text;

function namesConcern(ctx: CareContext, view: TurnView, near: SentenceView[]): boolean {
  const words = contentWords(near.map((s) => s.text).join(' '));
  // Specific means tied to something the customer actually said, or to what is at stake here.
  if (overlap(words, view.previousCustomer) >= 1 || overlap(words, view.customerSoFar) >= 1) {
    return true;
  }
  if (overlap(words, ctx.situation) >= 2) return true;
  const earlier = ctx.stage === 'follow-up' || ctx.stage === 'escalated';
  return earlier && near.some((s) => HISTORY.test(s.lower));
}

function usefulFollow(view: TurnView, empathyAt: Set<number>): boolean {
  const cls = view.turn.cls;
  // "Someone will look" is not something useful: only a commitment, a dated next step, an
  // instruction or a question that moves the case on is.
  if (cls.ownership === 'clear' || cls.nextSteps === 'specific' || cls.troubleshooting) return true;
  if (cls.askedQuestion && cls.discoveryIntents.length > 0) return true;
  return view.sentences.some((s, i) => {
    if (empathyAt.has(i)) return false;
    if (s.question && sentenceIntents(s.text, true).length > 0) return true;
    const commits = FIRST_PERSON_COMMIT.test(s.lower) || WE_COMMIT.test(s.lower);
    return commits && (OWNS_OUTCOME.test(s.lower) || OWNS_ACTION.test(s.lower));
  });
}

function empathyMoments(ctx: CareContext): EmpathyMoment[] {
  const out: EmpathyMoment[] = [];
  for (const view of ctx.turns) {
    const at = new Set<number>();
    view.sentences.forEach((s, i) => {
      if (!s.question && EMPATHY.test(s.lower)) at.add(i);
    });
    // Empathy the classification recorded in words the patterns do not know still counts when a
    // sentence of the turn carries it.
    for (const item of view.turn.cls.evidence) {
      if (item.behaviour !== 'empathy-specific' && item.behaviour !== 'empathy-generic') continue;
      const quote = fold(item.quote);
      const i = view.sentences.findIndex((s) => {
        const sentence = fold(s.text);
        return sentence.length > 0 && (sentence.includes(quote) || quote.includes(sentence));
      });
      if (i >= 0) at.add(i);
    }
    const useful = usefulFollow(view, at);
    for (const i of [...at].sort((a, b) => a - b)) {
      const sentence = view.sentences[i] as SentenceView;
      const next = view.sentences[i + 1];
      // What follows can name the concern ("I understand. Three of you are waiting."), but a
      // sentence that commits to an action or asks a question is the action, not the concern.
      const continues =
        next !== undefined &&
        !at.has(i + 1) &&
        !next.question &&
        !FIRST_PERSON_COMMIT.test(next.lower) &&
        !WE_COMMIT.test(next.lower);
      const near = continues ? [sentence, next] : [sentence];
      const kind: EmpathyKind = namesConcern(ctx, view, near)
        ? 'specific'
        : useful
          ? 'with-action'
          : 'bare';
      out.push({
        hit: { view, sentence },
        kind,
        lead: EMPATHY.exec(sentence.lower)?.[0] ?? sentence.lower.slice(0, 20),
        folded: fold(sentence.text),
        apology: APOLOGY.test(sentence.lower),
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------
// Ownership: who says they will do what

export function ownershipKindOf(lower: string): OwnershipKind | null {
  if (lower.endsWith('?')) return null;
  const self = FIRST_PERSON_COMMIT.test(lower);
  const hedged = COMMIT_HEDGE.test(lower);
  const outcome = OWNS_OUTCOME.test(lower);
  const action = OWNS_ACTION.test(lower);
  if (self && outcome && !hedged) return 'clear';
  if (self && (outcome || action)) return 'partly';
  if (WE_COMMIT.test(lower) && (outcome || action)) return 'partly';
  if (THIRD_PARTY.test(lower)) return 'third-party';
  return null;
}

function ownershipMoments(ctx: CareContext): OwnershipMoment[] {
  const out: OwnershipMoment[] = [];
  for (const view of ctx.turns) {
    let found = 0;
    for (const sentence of view.sentences) {
      const kind = ownershipKindOf(sentence.lower);
      if (!kind) continue;
      out.push({ hit: { view, sentence }, kind });
      found += 1;
    }
    // The classification may recognise ownership in words the patterns do not. A sentence that
    // only says someone else will act is never ownership, whatever the flag says.
    if (found === 0 && view.turn.cls.ownership === 'clear') {
      const sentence = sentenceOfRecorded(view, 'ownership-clear');
      const someoneElse =
        sentence !== undefined &&
        THIRD_PARTY.test(sentence.lower) &&
        !FIRST_PERSON_COMMIT.test(sentence.lower);
      if (sentence && !someoneElse) out.push({ hit: { view, sentence }, kind: 'clear' });
    }
  }
  return out;
}

/** The sentence of the turn that holds the quote the classification recorded, else the first one. */
function sentenceOfRecorded(
  view: TurnView,
  behaviour: EvidenceBehaviour,
): SentenceView | undefined {
  const quote = view.turn.cls.evidence.find((e) => e.behaviour === behaviour)?.quote;
  const wanted = quote ? fold(quote) : '';
  const match = wanted
    ? view.sentences.find((s) => {
        const sentence = fold(s.text);
        return sentence.includes(wanted) || wanted.includes(sentence);
      })
    : undefined;
  return match ?? view.sentences[0];
}

// ---------------------------------------------------------------------------------------
// Commitments: what was promised to be done, and when

const HEAR_FROM =
  /\byou(?:'ll| will) (?:hear|get|receive)\b|\bnext update\b|\bexpect (?:an? )?(?:update|call|email)\b/;

function commitments(ctx: CareContext): Commitment[] {
  const out: Commitment[] = [];
  for (const view of ctx.turns) {
    for (const sentence of view.sentences) {
      const lower = sentence.lower;
      if (sentence.question) continue;
      const self = FIRST_PERSON_COMMIT.test(lower);
      const we = WE_COMMIT.test(lower);
      const update = UPDATE_ACTION.test(lower) || HEAR_FROM.test(lower);
      const action = OWNS_ACTION.test(lower);
      const outcome = OWNS_OUTCOME.test(lower);
      const promising = (self || we || HEAR_FROM.test(lower)) && (update || action || outcome);
      if (!promising) continue;
      const timed = TIME_REF.test(lower);
      out.push({
        hit: { view, sentence },
        self,
        we,
        action,
        outcome,
        update,
        timed,
        vagueTime: VAGUE_TIME.test(lower) && !timed,
        cadence: CADENCE.test(lower),
        hedged: COMMIT_HEDGE.test(lower),
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------
// Summaries: do they match what had been said?

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  fifty: 50,
  hundred: 100,
};
const QUANTITY_CLAIM =
  /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|fifty|hundred)\s+(?:of (?:you|us|them|your)\b|(?:[a-z]+ ){0,2}(?:users?|people|staff|colleagues|machines|devices|computers|laptops|sites|offices|locations|accounts|customers|orders|emails|meetings|calls|times|attempts|tries|patients|clients)\b)/g;
const DAY_CLAIM =
  /\b(yesterday|last night|last week|this morning|this afternoon|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/g;
const DAY_GROUP: Record<string, string> = {
  'this morning': 'today',
  'this afternoon': 'today',
  'last night': 'yesterday',
};
const CORRECTION =
  /^(?:(?:um|uh|oh|well|hmm|er)[,.]?\s+)*(?:no,? (?:that'?s not|that isn'?t|that is not|it'?s not|it isn'?t|it was|it is|it wasn'?t|it'?s|i didn'?t|we didn'?t|not quite|not exactly|wait|actually)|not (?:quite|exactly|really|right)|that'?s not (?:right|quite|what|how|it)|that isn'?t|that is not|actually|hang on|wait\b|i didn'?t say|i said\b|that'?s wrong|incorrect)/;

const quantityOf = (token: string): string => String(NUMBER_WORDS[token] ?? token);

/** Counts and days in the sentence, written the same way whatever the spelling ("three" and "3"). */
function claimsIn(lower: string): string[] {
  const claims: string[] = [];
  for (const m of lower.matchAll(QUANTITY_CLAIM)) claims.push(`n:${quantityOf(m[1] as string)}`);
  for (const m of lower.matchAll(DAY_CLAIM)) {
    const day = m[1] as string;
    claims.push(`d:${DAY_GROUP[day] ?? day}`);
  }
  return claims;
}

function summaryMoments(ctx: CareContext): SummaryMoment[] {
  const out: SummaryMoment[] = [];
  const everything = ctx.call.input.turns;
  for (const view of ctx.turns) {
    // A frame like "is that right?" on its own is a check, not a summary: the turn needs the recap.
    const framed = view.sentences.findIndex(
      (s) =>
        SUMMARY_FRAME.test(s.lower) &&
        !(CHECK_BACK.test(s.lower) && s.lower.split(' ').length <= 6),
    );
    const flagged = view.turn.cls.summarises || view.turn.cls.wrapsUp;
    if (framed < 0 && !flagged) continue;
    // A turn with no letters or digits to read (another script, an emoji) has no sentence to quote
    // as a recap, whatever the classification said of it.
    const sentence = view.sentences[framed] ?? view.sentences[0];
    if (!sentence) continue;

    const earlier = everything.filter((t) => t.index < view.turn.index);
    const earlierWords = new Set<string>();
    for (const t of earlier) for (const w of contentWords(t.text)) earlierWords.add(w);
    const grounded = overlap(contentWords(view.turn.text), earlierWords) >= 2;

    const earlierClaims = new Set(claimsIn(norm(earlier.map((t) => t.text).join(' '))));
    const ungrounded = new Set<string>();
    let commits = 0;
    for (const s of view.sentences) {
      if (s.question) continue;
      if (FIRST_PERSON_COMMIT.test(s.lower) || WE_COMMIT.test(s.lower)) {
        commits += 1;
        continue; // a promise about what happens next is not a claim about what was said
      }
      if (/\byou(?:'ll| will) /.test(s.lower)) commits += 1;
      for (const claim of claimsIn(s.lower)) if (!earlierClaims.has(claim)) ungrounded.add(claim);
    }

    const reply = ctx.customer.find((c) => c.index > view.turn.index);
    out.push({
      hit: { view, sentence },
      grounded,
      corrected: reply ? CORRECTION.test(norm(reply.text)) : false,
      ungrounded: [...ungrounded],
      commitments: commits,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------------------
// Jargon: technical terms and whether they were put into plain words

const EXPLAINED =
  /\b(?:meaning|which means|that is|in other words|basically|simply put|essentially|i mean|what that means|think of (?:it|that) as|it'?s like|put simply|in plain (?:english|words)|in simple terms|that just means)\b/;

function jargonMoments(ctx: CareContext): JargonMoment[] {
  const out: JargonMoment[] = [];
  for (const view of ctx.turns) {
    view.sentences.forEach((sentence, i) => {
      if (!hasJargon(sentence.text)) return;
      const next = view.sentences[i + 1];
      const explained =
        EXPLAINED.test(sentence.lower) || (next ? EXPLAINED.test(next.lower) : false);
      out.push({ hit: { view, sentence }, explained });
    });
    // A model may call a term jargon that the word list does not know.
    const known = out.some((m) => m.hit.view === view);
    if (!known && view.turn.cls.jargon !== 'none') {
      const explained = view.turn.cls.jargon === 'explained';
      const sentence = sentenceOfRecorded(
        view,
        explained ? 'jargon-explained' : 'jargon-unexplained',
      );
      if (sentence) out.push({ hit: { view, sentence }, explained });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------
// Small shared checks

/** The question sentences of a turn that ask the customer something (not "does that make sense?"). */
export function askingSentences(view: TurnView): SentenceView[] {
  return view.sentences.filter(
    (s) => s.question && !CHECK_BACK.test(s.lower) && !isHousekeeping(s.text),
  );
}

export function sameSentence(a: Hit, b: Hit): boolean {
  return a.view === b.view && SAME_SENTENCE(a.sentence, b.sentence);
}

/** Hits for sentences that match a pattern and are not questions. */
export const statements = (ctx: CareContext, pattern: RegExp, within?: TurnView[]): Hit[] =>
  hits(ctx, (s) => !s.question && pattern.test(s.lower), within);
