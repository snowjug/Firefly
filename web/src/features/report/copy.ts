import type { ProviderKind } from '#shared/domain/api.ts';
import type { CareBehaviourResult, CareLevel, CoachingReport } from '#shared/domain/report.ts';
import {
  DIMENSIONS,
  TEMPERATURE_BANDS,
  temperatureBand,
  type CallStage,
  type DimensionId,
  type FactImportance,
  type TemperatureBandId,
} from '#shared/domain/vocab.ts';

// The words the report page uses for data it is given. Labels that already exist in
// `#shared/domain/vocab.ts` are used from there; what is here is only what the page itself says.

export type Sufficiency = CoachingReport['dimensions'][number]['sufficiency'];
export type MilestoneStatus = NonNullable<
  CoachingReport['journey']['milestones']
>[number]['status'];

/** The one calm label for a score that no quote backs: information, never a warning. */
export const EVIDENCE_LABEL = 'Limited evidence';

/** What stands for the score's word when no quote backs it: "3 of 5 · first look". */
export const FIRST_LOOK = 'first look';

/** How firmly a skill could be judged, in words (never only a colour). */
export const SUFFICIENCY_WORDS: Record<Sufficiency, string> = {
  sufficient: 'Enough evidence',
  limited: EVIDENCE_LABEL,
  insufficient: EVIDENCE_LABEL,
};

/** The sentence that says how firm a score is, in the details of a skill. */
export const SUFFICIENCY_SENTENCES: Record<Sufficiency, string> = {
  sufficient: 'There was enough in the call to judge this skill.',
  limited: 'Limited evidence in this call, so treat the score as a first look.',
  insufficient: 'Not enough in this call to judge this skill, so treat the score as a first look.',
};

export const IMPORTANCE_WORDS: Record<FactImportance, string> = {
  critical: 'Critical',
  important: 'Important',
  helpful: 'Helpful',
};

export const COMPLETION_WORDS: Record<CoachingReport['completion']['status'], string> = {
  completed: 'Completed',
  'ended-early': 'Ended early',
};

export const CURVEBALL_STATUS_WORDS: Record<
  NonNullable<CoachingReport['curveball']>['status'],
  string
> = {
  resolved: 'Resolved',
  unresolved: 'Not resolved',
  active: 'Still open when the call ended',
};

export const CARE_LEVEL_WORDS: Record<CareLevel, string> = {
  strong: 'Strong',
  developing: 'Developing',
  'not-yet': 'Not yet',
  'limited-evidence': 'Limited evidence',
};

export const BEHAVIOUR_STATUS_WORDS: Record<CareBehaviourResult['status'], string> = {
  shown: 'Shown',
  partly: 'Partly shown',
  'not-shown': 'Not shown',
};

export const MILESTONE_STATUS_WORDS: Record<MilestoneStatus, string> = {
  reached: 'Reached',
  'not-reached': 'Not reached',
  'not-applicable': 'Not applicable',
};

/** The call stage in a word or two, for the header ("Follow-up"); the long labels are for the brief. */
export const STAGE_WORDS: Record<CallStage, string> = {
  'first-contact': 'First contact',
  'follow-up': 'Follow-up',
  escalated: 'Escalated',
  closure: 'Closure',
};

/** What stands where a quote would be when the transcript does not back one. Never a made-up quote. */
export const INSUFFICIENT_EVIDENCE = 'Insufficient evidence';

/** Under the customer's temperature chart: what its heights are, and how its points are used. */
export const CHART_FOOTNOTE =
  'The customer is simulated, so heights show direction, not exact measurements. Select a point to see what happened there; the arrow keys move between points.';

/** The first line of a better-wording block: what it is, and that it is a suggestion. */
export const WORDING_ABOUT =
  'Wording to try for this call, written by the coaching. Use your own words.';

/** Said in plain words before the report's own note that CBCF is not applied. */
export const CBCF_PLAIN = 'Firefly does not map this review to CBCF.';

export const dimensionLabel = (id: DimensionId): string => DIMENSIONS[id].label;

/** "Opening & Rapport" for the skill, or the id itself if an evaluator ever sends an unknown one. */
export const skillName = (id: string): string => DIMENSIONS[id as DimensionId]?.label ?? id;

export const turnName = (index: number): string => `Turn ${index}`;
export const seeTurnText = (index: number): string => `See turn ${index} in the transcript`;

export const pluralise = (count: number, one: string, many = `${one}s`): string =>
  `${count} ${count === 1 ? one : many}`;

/** A score for people: "4" for a whole number, "4.2" otherwise. */
export const scoreText = (score: number): string =>
  Number.isInteger(score) ? String(score) : score.toFixed(1);

/** "No quotes", "1 quote", "3 quotes": how much of the call backs a score. */
export const quoteCount = (count: number): string =>
  count === 0 ? 'No quotes' : pluralise(count, 'quote');

// ---- Word budgets ---------------------------------------------------------------------------

/** Words as the product counts them: runs of characters between spaces. */
export const countWords = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

export interface Clamped {
  /** What is shown at first: at most the budget, ending at a sentence where one is near. */
  shown: string;
  /** All of it, for "Show more". */
  full: string;
  clamped: boolean;
}

const SENTENCE_END = /[.!?]["'\u2019\u201d)\]]*$/;

/** Whole sentences, in order: a break is a full stop, question mark or exclamation mark and a new capital. */
export function splitSentences(text: string): string[] {
  return text
    .trim()
    .split(/(?<=[.!?]["'\u2019\u201d)\]]*)\s+(?=[A-Z\u201c"'(])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export interface ClampOptions {
  /**
   * Never cut inside a sentence: show the sentences that fit the budget, and always the first one
   * whole, even when it is longer than the budget alone. What is left waits behind "Show more".
   */
  whole?: boolean;
}

/**
 * Text cut to a word budget for the first view. Nothing is thrown away: `full` is every word, and
 * the page offers it behind "Show more". It stops at the end of a sentence when one falls in the
 * last 60 per cent of the budget, and otherwise after the last word that fits, with an ellipsis.
 * With `whole` it only ever stops at the end of a sentence.
 */
export function clampWords(text: string, max: number, options: ClampOptions = {}): Clamped {
  const full = text.trim().replace(/\s+/g, ' ');
  const tokens = full.split(' ').filter(Boolean);
  const budget = Math.max(1, Math.floor(max));
  if (tokens.length <= budget) return { shown: full, full, clamped: false };
  if (options.whole) {
    const [first = full, ...later] = splitSentences(full);
    const kept = [first];
    let used = countWords(first);
    for (const sentence of later) {
      used += countWords(sentence);
      if (used > budget) break;
      kept.push(sentence);
    }
    return { shown: kept.join(' '), full, clamped: kept.length < 1 + later.length };
  }
  const head = tokens.slice(0, budget);
  for (let i = head.length - 1; i >= Math.ceil(budget * 0.4) - 1; i -= 1) {
    if (SENTENCE_END.test(head[i] as string)) {
      return { shown: head.slice(0, i + 1).join(' '), full, clamped: true };
    }
  }
  const last = head.length - 1;
  head[last] = `${(head[last] as string).replace(/[,;:\u2013\u2014-]+$/, '')}\u2026`;
  return { shown: head.join(' '), full, clamped: true };
}

// ---- Customer state -------------------------------------------------------------------------

/** The band a 0 to 100 temperature falls in. The number itself is never shown. */
export function bandOf(temperature: number): { id: TemperatureBandId; label: string } {
  const band = temperatureBand(temperature);
  return { id: band.id, label: band.label };
}

/** The band id for a band label such as "Frustrated" (journey points carry the label). */
export function bandIdFor(label: string): TemperatureBandId | null {
  return TEMPERATURE_BANDS.find((band) => band.label === label)?.id ?? null;
}

// ---- Who wrote what -------------------------------------------------------------------------

/** Who wrote the coaching. Demo mode is always said so. */
export function evaluatorByline(
  evaluator: CoachingReport['evaluator'],
  providerKind: ProviderKind,
): string {
  if (evaluator.kind === 'model') return `the language model ${evaluator.providerLabel}`;
  return providerKind === 'mock'
    ? "Firefly's built-in rules evaluator (demo mode)"
    : "Firefly's built-in rules evaluator";
}

/** Who played the customer, for the About section. */
export function customerPlayedBy(providerKind: ProviderKind, providerLabel: string): string {
  return providerKind === 'mock'
    ? "Firefly's built-in rules engine (demo mode), not a language model"
    : `the language model ${providerLabel}`;
}

const capitalise = (text: string) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

/**
 * The engine's word for the customer's unexpected moment is internal. After the call the report
 * says "unexpected turn", so evaluator-written text and marker labels are shown with that word.
 * The scenarios also write about the trainee as "the engineer", where the report speaks to them as
 * "you": that goes through `inYourVoice`. Only wording written by the evaluator goes through this:
 * what the trainee said is never changed.
 */
export function plainUnexpectedTurn(text: string): string {
  return inYourVoice(
    text
      .replace(/\bcurveballs\b/gi, (m) =>
        m.startsWith('C') ? 'Unexpected turns' : 'unexpected turns',
      )
      .replace(/\bcurveball\b/gi, (m) =>
        m.startsWith('C') ? 'Unexpected turn' : 'unexpected turn',
      ),
  );
}

// ---- One voice: "you" ---------------------------------------------------------------------

const ADVERBS = new Set([
  'never',
  'also',
  'then',
  'still',
  'either',
  'only',
  'just',
  'often',
  'usually',
  'soon',
  'again',
  'always',
  'simply',
  'even',
]);
const MODALS = new Set([
  'cannot',
  'can',
  'may',
  'might',
  'will',
  'would',
  'could',
  'should',
  'must',
  'shall',
]);
const COORDINATORS = new Set(['and', 'or', 'but']);
/** The verbs the scenarios give "the engineer", as they are written and as they read after "you". */
const SECOND_PERSON: Record<string, string> = {
  learns: 'learn',
  treats: 'treat',
  misses: 'miss',
  suggests: 'suggest',
  explores: 'explore',
  risks: 'risk',
  plans: 'plan',
  agrees: 'agree',
  guesses: 'guess',
  skips: 'skip',
  relies: 'rely',
  offers: 'offer',
  keeps: 'keep',
  accepts: 'accept',
  argues: 'argue',
  asks: 'ask',
  tells: 'tell',
  repeats: 'repeat',
  works: 'work',
  does: 'do',
  has: 'have',
  gets: 'get',
  checks: 'check',
  sends: 'send',
  raises: 'raise',
  gives: 'give',
  hears: 'hear',
  finds: 'find',
  takes: 'take',
  uses: 'use',
  stays: 'stay',
  goes: 'go',
  leaves: 'leave',
  looks: 'look',
};

/** A word without the punctuation around it, in lower case, and that punctuation. */
function bare(word: string): { core: string; head: string; tail: string } {
  const match = /^([^\p{L}]*)(\p{L}+)([^\p{L}]*)$/u.exec(word);
  return match
    ? {
        head: match[1] as string,
        core: (match[2] as string).toLowerCase(),
        tail: match[3] as string,
      }
    : { head: '', core: '', tail: '' };
}

/**
 * The verbs that go with a subject at `start`, as the place of each one in `words` and how it reads
 * after "you". A verb counts only straight after the subject (past "never", "also" and the like) or
 * after "and", "or" or "but"; nothing else in the sentence is touched. Null when the first word is
 * a verb this does not know how to turn, so the sentence is left as it was written.
 */
function verbsAfter(words: readonly string[], start: number): Map<number, string> | null {
  const changes = new Map<number, string>();
  let i = start;
  const next = (from: number): number => {
    let at = from;
    while (at < words.length && ADVERBS.has(bare(words[at] as string).core)) at += 1;
    return at;
  };
  const turn = (at: number): boolean => {
    const { head, core, tail } = bare(words[at] as string);
    const turned = SECOND_PERSON[core];
    if (turned === undefined) return false;
    changes.set(at, `${head}${turned}${tail}`);
    return true;
  };
  i = next(i);
  const first = bare(words[i] ?? '').core;
  if (first === '') return null;
  if (!MODALS.has(first) && !turn(i)) {
    // A verb ending in "s" that is not known cannot be left as it is after "you".
    if (/[^s]s$/.test(first)) return null;
  }
  for (let j = i + 1; j < words.length; j += 1) {
    if (!COORDINATORS.has(bare(words[j] as string).core)) continue;
    const at = next(j + 1);
    if (at < words.length) turn(at);
  }
  return changes;
}

/**
 * Evaluator-written text in one voice. A scenario says "the engineer never learns ..." where the
 * report says "you"; this makes it "you never learn ...", turning the verbs that go with that
 * subject. A sentence with a verb it does not know is left alone (grammatical, in the third person)
 * rather than turned wrongly.
 */
export function inYourVoice(text: string): string {
  if (!/\bthe engineer\b/i.test(text)) return text;
  return text
    .split(/(?<=[.!?]["'\u2019\u201d)\]]*)(\s+)/)
    .map((piece) => {
      const words = piece.split(' ');
      for (let i = 0; i < words.length - 1; i += 1) {
        if (!/^the$/i.test(words[i] as string) || words[i + 1] !== 'engineer') continue;
        const changes = verbsAfter(words, i + 2);
        if (!changes) continue;
        for (const [at, word] of changes) words[at] = word;
        words.splice(i, 2, words[i] === 'The' ? 'You' : 'you');
      }
      return words.join(' ');
    })
    .join('');
}

/** `plainUnexpectedTurn`, and a leading "Unexpected turn:" dropped where a tag already says it. */
export function unexpectedTurnDetail(text: string): string {
  return capitalise(plainUnexpectedTurn(text).replace(/^unexpected turn:\s*/i, ''));
}

/** "A, B and C". */
export function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
