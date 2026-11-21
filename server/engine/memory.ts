import type { TurnClassification } from '#shared/domain/classification.ts';
import type { EffectiveScenario } from '#shared/domain/config.ts';
import {
  AFFIRMS,
  ASKS_TO_CHECK,
  BASICS,
  CLARIFICATION,
  CONFIRMATION,
  detailsAsked,
  EXPLAINS_SITUATION,
  isAsking,
  isHousekeepingQuestion,
  isUnverifiedPromise,
  NEXT_STEPS_VAGUE,
  OFFERS_INTERIM,
  OWNERSHIP_ACTION,
  OWNERSHIP_CLEAR,
  OWNERSHIP_VAGUE,
  prep,
  SELF_CORRECTION,
  splitSentences,
  timePhraseIn,
  unfamiliarTerm,
  ACTION_COMMIT,
  CALLBACK_WITH_TIME,
  type DetailRequests,
} from './lexicon.ts';
import { stageSignals, type StageSignals } from './stage.ts';
import { countedIn, numbersIn, questionWords, withoutContactTalk } from './textutil.ts';
import type { Commitment, EngineRuntime, TranscriptTurn } from './types.ts';

// What one engineer turn means for the customer's memory of the call. Everything here is worked out
// from the words of the turn and from what the call already holds, by rules that do not depend on
// whether a model or the rules classifier described the turn: the classification says what kind of
// behaviour it was, and this adds the details the customer will refer back to (what was asked,
// what was promised and for when, whether a summary matched what they had said).

/** What the wording of a turn says about it, apart from the topic: a check, not a fresh question. */
export type Wording = 'summary' | 'confirmation' | 'clarification' | 'correction';

export interface NewCommitment {
  kind: Commitment['kind'];
  action: string;
  due: string | null;
  clarity: Commitment['clarity'];
  supported: boolean;
}

export interface SummaryVerdict {
  verdict: 'none' | 'accurate' | 'inaccurate';
  /** What was wrong: the number of people, or other details the customer never gave. */
  fault: 'count' | 'detail' | null;
}

export interface TurnAnalysis {
  wording: Wording | null;
  asks: DetailRequests;
  /** The engineer greeted, introduced themselves or offered help. */
  greets: boolean;
  /** The name the engineer gave for themselves, when they gave one. */
  introducedName: string | null;
  /**
   * The first turn of a call that only said hello: no question about the problem and nothing to
   * answer for. The customer replies with the reason for the call, and timing rules do not count it.
   */
  greetingOnly: boolean;
  /** A short yes to the customer's "so you'll do that?". */
  confirmsEcho: boolean;
  asksToCheck: boolean;
  summary: SummaryVerdict;
  commitment: NewCommitment | null;
  /** An earlier commitment that this turn's time contradicts. */
  conflict: Commitment | null;
  stage: StageSignals;
  /**
   * The engineer tested a belief the customer holds. `established` is true only when what they said
   * gives the truth behind it, not just doubt: the customer accepts a correction, never a doubt.
   */
  assumption: { id: string; established: boolean } | null;
  /** A term, acronym or technical product name the customer may not know. */
  term: string | null;
  basics: boolean;
  /** The engineer said what is going on, or offered a way to carry on in the meantime. */
  explains: boolean;
  offersInterim: boolean;
  /** The content words of what the engineer asked, to tell a repeat from a follow-up. */
  words: string[];
}

export interface AnalyseArgs {
  scenario: EffectiveScenario;
  runtime: EngineRuntime;
  classification: TurnClassification;
  traineeText: string;
  history: TranscriptTurn[]; // earlier turns, not including this one
}

// ---------------------------------------------------------------------------------------
// Questions

function questionSentences(sentences: string[]): string[] {
  const asked = sentences.filter((s) => isAsking(s) && !isHousekeepingQuestion(prep(s)));
  return asked.length > 0 ? asked : sentences;
}

/**
 * The lower-cased text of what the engineer asked, with talk about how to reach the customer left
 * out. A question must contain one of a fact's cues, and only the asking counts: "your CEO is
 * presenting" in a statement does not reveal a fact about the CEO. Empty when nothing was asked.
 */
export function questionTextOf(text: string): string {
  const sentences = splitSentences(text.replace(/\s+/g, ' ').trim());
  const asked = sentences.filter((s) => isAsking(s) && !isHousekeepingQuestion(prep(s)));
  return withoutContactTalk(asked.map(prep).join(' '));
}

function wordingOf(c: TurnClassification, lower: string): Wording | null {
  if (SELF_CORRECTION.test(lower)) return 'correction';
  if (c.summarises) return 'summary';
  if (CONFIRMATION.test(lower)) return 'confirmation';
  if (CLARIFICATION.test(lower)) return 'clarification';
  return null;
}

// ---------------------------------------------------------------------------------------
// Summaries: does what the engineer played back match what the customer said?

const SUMMARY_TALK = new Set(
  'understand understood confirm summaris summarise summarize recap clarif hear hearing saying said right correct sure make check call back updat thank sorry help support issue problem case customer getting going seem sound basic essential tell told mean something anything still also just'.split(
    ' ',
  ),
);
const FIRST_PERSON_FUTURE = /\b(?:i|we)(?:'ll| will|'m going to| am going to|'ll be)\b/;
// What the engineer found or did is theirs to say, not a claim about what the customer told them.
const ENGINEER_SIDE =
  /\b(?:(?:the )?(?:root )?cause (?:was|is)|(?:i|we)(?:'ve| have)? (?:fixed|found|corrected|resolved|restored|identified|applied|reversed|rolled back|changed|updated|removed|added|reset|worked out|unlocked|escalated|raised)|(?:it|that|this) (?:should(?:n't| not)?|will(?: not|n't)?|won't) (?:come back|happen again|recur|return))\b/;

/** Everything the customer has said or knows, as stemmed words, to check a summary against. */
function customerWords(
  scenario: EffectiveScenario,
  runtime: EngineRuntime,
  history: TranscriptTurn[],
): { words: Set<string>; numbers: Set<number> } {
  const brief = scenario.publicBrief;
  const texts: string[] = [
    scenario.title,
    scenario.openingCore,
    scenario.stageFrame.opening,
    scenario.impactVariant.summary,
    scenario.impactVariant.detail,
    scenario.impactVariant.deadline ?? '',
    scenario.persona.role,
    scenario.persona.organisation,
    scenario.persona.background,
    scenario.affectedUsers.summary,
    brief?.issue ?? '',
    brief?.impact?.[scenario.config.impact] ?? '',
    brief?.knownContext ?? '',
    brief?.previousContact ?? '',
    brief?.environment ?? '',
    ...scenario.environment.details,
    ...scenario.previousTroubleshooting,
    ...scenario.recentChanges,
    ...scenario.priorHistory.map((h) => h.summary),
    ...scenario.knownFacts.flatMap((f) => [f.text, f.elaboration ?? '', f.simple ?? '']),
    ...scenario.vagueFacts.flatMap((f) => [f.text, f.confirmedText ?? '']),
    ...scenario.checkableFacts.map((f) => f.text),
    ...scenario.incorrectAssumptions.map((a) => a.statement),
    ...history.filter((t) => t.role === 'customer').map((t) => t.text),
  ];
  for (const fact of scenario.hiddenFacts) {
    const record = runtime.discovery[fact.id];
    if (record?.status === 'discovered') texts.push(fact.statement);
    else if (record?.status === 'partial' && fact.partialStatement)
      texts.push(fact.partialStatement);
  }
  return {
    words: new Set(texts.flatMap(questionWords)),
    numbers: new Set(texts.flatMap(numbersIn)),
  };
}

// The tag that ends a recap to ask whether it is right: "you have 12 users affected, is that
// right?" What comes before the tag is the claim, and it is judged like any other. A short tag
// ("right?", "isn't it?") has to follow a comma or a dash, so that "Is the date correct?" is still a
// question of its own.
const RECAP_TAG = new RegExp(
  [
    String.raw`\s*[,;:\u2013\u2014-]?\s*\b(?:(?:is|was) that (?:right|correct|accurate|fair|about right|ok(?:ay)?|so|true)|(?:am i|have i got that|did i get that|have i got it|did i get it) (?:right|correct)|have i understood (?:that |this |it )?(?:right|correctly))\s*\?\s*$`,
    String.raw`\s*[,;:\u2013\u2014-]\s*\b(?:right|correct|yes|ok(?:ay)?|(?:isn't|aren't|doesn't|didn't|wasn't|weren't|don't) (?:it|you|that|they))\s*\?\s*$`,
  ].join('|'),
  'i',
);

/** A sentence without the tag that asks whether it is right; a question of its own is left alone. */
function withoutRecapTag(sentence: string): string {
  const trimmed = sentence.trim();
  return trimmed.endsWith('?') ? trimmed.replace(RECAP_TAG, '').trim() : trimmed;
}

function judgeSummary(
  args: AnalyseArgs,
  sentences: string[],
  wording: Wording | null,
): SummaryVerdict {
  const none: SummaryVerdict = { verdict: 'none', fault: null };
  if (wording !== 'summary' && wording !== 'confirmation') return none;
  // A recap of what the engineer will do or found is not a claim about the customer's situation,
  // and neither is the question that ends a recap ("Is that right?"). A recap in one sentence that
  // ends in a tag still makes its claim.
  const claims = sentences
    .map(withoutRecapTag)
    .filter(
      (s) =>
        s !== '' &&
        !isAsking(s) &&
        !FIRST_PERSON_FUTURE.test(prep(s)) &&
        !ENGINEER_SIDE.test(prep(s)),
    );
  const claimText = claims.join(' ');
  const known = customerWords(args.scenario, args.runtime, args.history);

  const claimed = countedIn(claimText);
  const truth = args.scenario.affectedUsers.count;
  if (claimed !== null && truth !== null && claimed !== truth && !known.numbers.has(claimed)) {
    return { verdict: 'inaccurate', fault: 'count' };
  }
  const claimWords = questionWords(claimText).filter((w) => !SUMMARY_TALK.has(w));
  if (claimWords.length < 3) return { verdict: 'accurate', fault: null };
  const unsupported = claimWords.filter((w) => !known.words.has(w));
  return claimWords.length >= 4 && unsupported.length / claimWords.length >= 0.5
    ? { verdict: 'inaccurate', fault: 'detail' }
    : { verdict: 'accurate', fault: null };
}

// ---------------------------------------------------------------------------------------
// Commitments

const ACTION_PHRASES: [RegExp, string][] = [
  [/\bescalat/, 'escalate it'],
  [/\b(?:call|phone|ring)\b/, 'call me back'],
  [
    /\b(?:update|get back|come back|be in touch|report back|check in|touch base|circle back|follow up)\b/,
    'update me',
  ],
  [/\b(?:email|e-mail|message|text)\b/, 'message me'],
  [
    /\b(?:unlock|reset|restore|fix|fixed|resolve|resolved|sort|sorted|reinstate|reactivate|enable)\b/,
    'get it sorted',
  ],
  [/\b(?:look into|investigate|review|look at|dig into|check)\b/, 'look into it'],
  [/\b(?:raise|log|open)\b[^.?!]{0,20}\b(?:case|ticket|incident|request)\b/, 'log it'],
];

function extractCommitment(sentences: string[], c: TurnClassification): NewCommitment | null {
  if (c.ownership === 'none' && c.nextSteps === 'none' && c.promise === 'none') return null;
  let owns = false;
  let follows = false;
  let unverified = false;
  let due: string | null = null;
  const verbs: string[] = [];
  for (const sentence of sentences) {
    if (sentence.trim().endsWith('?')) continue;
    const lower = prep(sentence);
    const own = OWNERSHIP_CLEAR.test(lower) || OWNERSHIP_ACTION.test(lower);
    const follow =
      ACTION_COMMIT.test(lower) || CALLBACK_WITH_TIME.test(lower) || NEXT_STEPS_VAGUE.test(lower);
    const promise = isUnverifiedPromise(lower);
    if (!own && !follow && !promise && !OWNERSHIP_VAGUE.test(lower)) continue;
    owns ||= own;
    follows ||= follow;
    unverified ||= promise;
    due ??= timePhraseIn(lower);
    for (const [pattern, phrase] of ACTION_PHRASES) {
      if (pattern.test(lower) && !verbs.includes(phrase)) verbs.push(phrase);
    }
  }
  if (c.ownership === 'clear') owns = true;
  if (c.nextSteps !== 'none') follows = true;
  if (c.promise === 'unverified') unverified = true;
  const parts = [...(owns ? ['own the case'] : []), ...verbs].slice(0, 2);
  const kind: Commitment['kind'] = owns ? 'ownership' : follows ? 'follow-up' : 'action';
  return {
    kind,
    action: parts.length > 0 ? parts.join(' and ') : 'take this on',
    due,
    clarity: due !== null && !unverified && (owns || follows) ? 'clear' : 'vague',
    supported: !unverified,
  };
}

/** How a commitment sounds when the customer says it back: "own the case and update me by 3pm". */
export function describeCommitment(commitment: Pick<Commitment, 'action' | 'due'>): string {
  return commitment.due ? `${commitment.action} ${commitment.due}` : commitment.action;
}

interface ClockTime {
  hour: number;
  minute: number;
  meridiem: 'am' | 'pm' | null;
}

function clockOf(due: string): ClockTime | null {
  const digits = due.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (digits) {
    return {
      hour: Number(digits[1]) % 12,
      minute: Number(digits[2] ?? 0),
      meridiem: (digits[3] as 'am' | 'pm' | undefined) ?? null,
    };
  }
  const word = numbersIn(due)[0];
  return word === undefined ? null : { hour: word % 12, minute: 0, meridiem: null };
}

/** Do two promised times differ? ("by 3pm" and "by 4" do; "by 3pm" and "at 3" do not.) */
function timesDiffer(a: string, b: string): boolean {
  const bare = (due: string) =>
    due.replace(/^(?:by|at|before|in|within|around|until|after) /, '').trim();
  const duration = /\b(?:minutes?|mins?|hours?|hrs?|days?|half|quarter|couple|few)\b/;
  const x = duration.test(a) || duration.test(b) ? null : clockOf(a);
  const y = duration.test(a) || duration.test(b) ? null : clockOf(b);
  if (!x || !y) return bare(a) !== bare(b);
  if (x.meridiem && y.meridiem && x.meridiem !== y.meridiem) return true;
  return x.hour !== y.hour || x.minute !== y.minute;
}

// A promised time that recurs ("every hour", "daily") says how often the customer will hear, not
// when: it cannot be a different time for the same thing.
const RECURRING = /\b(?:every|each|hourly|daily|twice a day)\b/;

/**
 * An earlier time for the very same promise (what the ledger merges on: the same kind and action)
 * that this one contradicts. Another thing promised for another time ("I'll email you the summary
 * by 5pm" after "I'll call you back by 3pm"), or how often the customer will hear, is not a change
 * of mind.
 */
function findConflict(existing: Commitment[], next: NewCommitment): Commitment | null {
  if (!next.due || RECURRING.test(next.due)) return null;
  const earlier = [...existing]
    .reverse()
    .find(
      (e) =>
        e.by === 'engineer' &&
        e.kind !== 'action' &&
        e.kind === next.kind &&
        e.action === next.action &&
        e.due !== null &&
        !RECURRING.test(e.due),
    );
  return earlier && earlier.due && timesDiffer(earlier.due, next.due) ? earlier : null;
}

/** Adds a commitment to the ledger, or updates the one it repeats. Newest last, at most eight. */
export function recordCommitment(
  ledger: Commitment[],
  next: NewCommitment,
  turnIndex: number,
): { commitments: Commitment[]; added: Commitment } {
  const repeat = ledger.find(
    (e) => e.by === 'engineer' && e.kind === next.kind && e.action === next.action,
  );
  if (repeat) {
    const updated: Commitment = {
      ...repeat,
      due: next.due ?? repeat.due,
      // Said again with no time, a commitment keeps the time and the clarity it already had ("so
      // I'll own this and call you back" does not undo "by 3pm").
      clarity: next.due ? next.clarity : repeat.clarity,
      supported: next.supported,
      reflected: next.due !== null && next.due !== repeat.due ? false : repeat.reflected,
    };
    return {
      commitments: ledger.map((e) => (e.id === repeat.id ? updated : e)),
      added: updated,
    };
  }
  const added: Commitment = {
    id: `c${ledger.length + 1}-${turnIndex}`,
    by: 'engineer',
    turnIndex,
    kind: next.kind,
    action: next.action,
    due: next.due,
    clarity: next.clarity,
    supported: next.supported,
    reflected: false,
  };
  return { commitments: [...ledger, added].slice(-8), added };
}

// ---------------------------------------------------------------------------------------
// Names

const NOT_A_NAME = new Set(
  'microsoft support teams outlook azure windows here speaking calling happy glad sorry just the from with'.split(
    ' ',
  ),
);

/** The first name the engineer gave ("my name is Sam", "this is Sam from Microsoft"), or null. */
export function introducedAs(text: string): string | null {
  // The lead-in may start a sentence ("I'm Sam"); the name itself has to be capitalised.
  const found = text.match(
    /\b(?:[Mm]y name(?:'s| is)|[Tt]his is|[Ii](?:'m| am)) ([A-Z][a-z]{1,14})(?=\s+(?:from|with|at|here|speaking|and|on)\b|[,.!]|$)/,
  )?.[1];
  return found && !NOT_A_NAME.has(found.toLowerCase()) ? found : null;
}

// ---------------------------------------------------------------------------------------
// Beliefs the customer holds that are not true

function testAssumption(
  args: AnalyseArgs,
  raw: string,
): { id: string; established: boolean } | null {
  const wanted = questionWords(raw);
  for (const assumption of args.scenario.incorrectAssumptions) {
    if (args.runtime.assumptionsCorrected.includes(assumption.id)) continue;
    const belief = new Set(questionWords(assumption.statement));
    const shared = questionWords(assumption.truth).filter((w) => wanted.includes(w));
    const established = shared.length >= 3 && shared.filter((w) => !belief.has(w)).length >= 2;
    if (established || args.classification.correctsAssumption) {
      return { id: assumption.id, established };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------

export function analyseTurn(args: AnalyseArgs): TurnAnalysis {
  const { scenario, runtime, classification: c, traineeText } = args;
  const raw = traineeText.replace(/\s+/g, ' ').trim();
  const sentences = splitSentences(raw);
  const lower = prep(raw);
  const wording = wordingOf(c, lower);
  const wordCount = (lower.match(/[a-z0-9']+/g) ?? []).length;

  const greetingOnly =
    runtime.opening === 'awaiting-engineer' &&
    c.discoveryIntents.length === 0 &&
    !c.troubleshooting &&
    !c.blame &&
    !c.dismissive &&
    !c.lowEffort &&
    !c.injectionAttempt;

  const commitment = extractCommitment(sentences, c);
  const mostlyCapitals = raw === raw.toUpperCase();
  const term =
    c.jargon === 'explained' ? null : unfamiliarTerm(mostlyCapitals ? raw.toLowerCase() : raw);

  return {
    wording,
    asks: detailsAsked(sentences),
    greets: c.introduces,
    introducedName: introducedAs(raw),
    greetingOnly,
    confirmsEcho: runtime.awaitingConfirmation && wordCount <= 8 && AFFIRMS.test(lower),
    asksToCheck: ASKS_TO_CHECK.test(lower),
    summary: judgeSummary(args, sentences, wording),
    commitment,
    conflict: commitment ? findConflict(runtime.commitments, commitment) : null,
    stage: stageSignals(raw, c, scenario),
    assumption: testAssumption(args, raw),
    term,
    basics: BASICS.test(lower),
    explains: EXPLAINS_SITUATION.test(lower),
    offersInterim: OFFERS_INTERIM.test(lower),
    words: questionWords(questionSentences(sentences).join(' ')),
  };
}
