import type { EffectiveScenario } from '#shared/domain/config.ts';
import { questionWords } from './textutil.ts';
import type { EngineRuntime } from './types.ts';

// The case notes a scenario carries: what was already tried before the call (`previousTroubleshooting`)
// and what changed recently (`recentChanges`). Authors write them as notes about the customer, in
// the third person ("Marcus closed and reopened Outlook"), and they are the customer's own
// knowledge, so the customer can say them when asked. Two things stand between a note and the
// customer's mouth:
//
//   voice      a note is turned into what the customer would say ("I closed and reopened
//              Outlook"). A note that cannot be turned over safely (it names someone else, or
//              comments on the truth of what the customer believes) is left unsaid.
//   secrecy    a note that restates a hidden fact the engineer has not yet earned is left unsaid
//              until that fact has been discovered. Notes and hidden facts are written
//              separately, so they can overlap.

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Words that would put the author's own commentary into the customer's mouth.
const COMMENTARY =
  /\b(?:which is not so|is not so|not actually|is wrong|incorrect|not true|in fact|actually)\b/i;

const SUBJECT = '\u0001'; // marks a subject that has become "I" until the verbs after it are fixed

// A note often starts with what was done and no subject: "Restarted the laptop twice".
const IRREGULAR_PAST =
  'ran|sent|took|made|put|got|did|left|told|wrote|built|found|went|set|reset|cut|read|shut|kept|lost|paid|saw|spoke|held|gave|brought|bought|began|drove|chose|forgot|heard|felt|knew|met|rang|sat|stood|thought|woke|wore|won';
// What may follow such a verb. A word like "updated" before a noun is an adjective, not an action.
const AFTER_VERB =
  'the|a|an|his|her|their|my|our|some|all|any|every|each|two|three|four|five|several|one|that|it|this|them|him|up|down|out|back|on|off|in|at|from|to|with|for|about|through|over|again|twice|once|both|no|more|many|another|only|everything|nothing|something';
const ACTION_FRAGMENT = new RegExp(
  `^(?!(?:based|related|due|owing)\\s)(?:re-?)?(?:[a-z]{3,}ed|${IRREGULAR_PAST})(?=\\s+(?:${AFTER_VERB})\\b)`,
  'i',
);
// "On Friday moved the laptops back": a time, then what was done.
const TIME_THEN_ACTION = new RegExp(
  `^((?:on|in|at|by|after|before|since|over|during|last|this)\\s+(?:the\\s+)?[a-z]+(?:\\s+(?:morning|afternoon|evening|night))?|yesterday|earlier|later|today|tonight),?\\s+(?=(?:re-?)?(?:[a-z]{3,}ed|${IRREGULAR_PAST})\\s+(?:${AFTER_VERB})\\b)`,
  'i',
);
// "Saves his work every few minutes": a present-tense action with no subject.
const PRESENT_FRAGMENT =
  /^([A-Z][a-z]{2,}?)(?:es|s)(?=\s+(?:his|her|their|the|a|an|my|some|all|any|every|each)\b)/;

// The first-person form of the third-person verbs that follow a subject turned into "I".
const IRREGULAR_PRESENT: Record<string, string> = {
  has: 'have',
  is: 'am',
  does: 'do',
  goes: 'go',
  "doesn't": "don't",
  "isn't": 'am not',
  "hasn't": "haven't",
};
// Words that end in "s" but are not third-person verbs.
const NOT_A_VERB = new Set(
  'was always sometimes usually previously perhaps as this us yes plus thus across afterwards towards besides nowadays whereas unless less its'.split(
    ' ',
  ),
);
// Third-person verbs that follow "and" or "but" in a sentence whose subject became "I".
const COORDINATED = new Set([
  ...Object.keys(IRREGULAR_PRESENT),
  ...'knows thinks wants says needs hears sees feels believes remembers expects understands uses keeps tries works gets makes takes wonders worries prefers likes finds runs seems'.split(
    ' ',
  ),
]);

function firstPerson(word: string): string {
  const lower = word.toLowerCase();
  const irregular = IRREGULAR_PRESENT[lower];
  if (irregular) return irregular;
  if (NOT_A_VERB.has(lower) || lower.endsWith('ss') || !lower.endsWith('s')) return word;
  if (lower.endsWith('ies') && lower.length > 4) return `${lower.slice(0, -3)}y`;
  if (/(?:ch|sh|x|z|o|ss)es$/.test(lower)) return lower.slice(0, -2);
  return lower.slice(0, -1);
}

const lowerInitial = (text: string) => `${text.charAt(0).toLowerCase()}${text.slice(1)}`;

/** The pronoun the scenario's own description of the customer uses, or null when it does not say. */
export type Pronoun = 'he' | 'she' | null;

export function pronounOf(
  persona: Pick<EffectiveScenario['persona'], 'background' | 'voice'>,
): Pronoun {
  const own = `${persona.background} ${persona.voice}`;
  const he = (own.match(/\b(?:he|his|him|himself)\b/gi) ?? []).length;
  const she = (own.match(/\b(?:she|her|hers|herself)\b/gi) ?? []).length;
  return he > she ? 'he' : she > he ? 'she' : null;
}

const HE_FORMS = /\b(?:he|his|him|himself)\b/i;
const SHE_FORMS = /\b(?:she|her|hers|herself)\b/i;

/** One sentence of a note, as the customer would say it. */
function turnSentence(sentence: string, name: string, pronoun: Pronoun): string | null {
  let text = sentence.trim();

  // The persona as the subject of the sentence or of a clause becomes "I", and their possessive "my".
  // The name anywhere else cannot be turned round safely.
  const clause = '(?:and|but|while|when|after|before|because|so|then|if|since|as|that)';
  text = text.replace(
    new RegExp(`(^|[;:]\\s+|,\\s+${clause}\\s+|\\b${clause}\\s+)${name}\\b(?!')`, 'g'),
    `$1${SUBJECT}`,
  );
  text = text.replace(new RegExp(`\\b${name}'s\\b`, 'g'), 'my');
  if (new RegExp(`\\b${name}\\b`).test(text)) return null;

  // A pronoun for anyone but the customer is about someone else; with no way to tell who, it is
  // not safe to say.
  const others =
    pronoun === 'he'
      ? SHE_FORMS
      : pronoun === 'she'
        ? HE_FORMS
        : /\b(?:he|she|him|his|her|hers|himself|herself)\b/i;
  if (others.test(text)) return null;

  // A fragment that begins with what was done is the customer's own action.
  if (!text.startsWith(SUBJECT)) {
    const timed = text.match(TIME_THEN_ACTION);
    if (timed) text = `${timed[1]} ${SUBJECT} ${text.slice(timed[0].length)}`;
    else if (ACTION_FRAGMENT.test(text)) text = `${SUBJECT} ${lowerInitial(text)}`;
    else if (PRESENT_FRAGMENT.test(text)) text = `${SUBJECT} ${lowerInitial(text)}`;
  }
  text = text.replace(/\b(?:he|she)\b/gi, SUBJECT);
  text = text.replace(/\b(?:himself|herself)\b/gi, 'myself');
  text = text.replace(/\bhim\b/gi, 'me').replace(/\bhers\b/gi, 'mine');
  // "her" before a noun is "my"; "her" before a function word or the end is "me".
  text = text.replace(
    /\b(?:his|her)\b(?=\s+(?!(?:to|that|about|and|on|with|for|in|at|from|by|as|because|which|who|when|so|if|or|but)\b)[A-Za-z])/gi,
    'my',
  );
  text = text.replace(/\bher\b/gi, 'me').replace(/\bhis\b/gi, 'my');

  // Verbs agree with "I": the one after the subject, and one after "and" or "but" in the same sentence.
  const adverbs = '(?:(?:also|still|never|always|just|only|then|already|now|first)\\s+)*';
  text = text.replace(
    new RegExp(`${SUBJECT}(\\s+${adverbs})([A-Za-z']+)`, 'g'),
    (_m, gap: string, verb: string) => `I${gap}${firstPerson(verb)}`,
  );
  if (text.includes('I ') || text.startsWith('I')) {
    text = text.replace(
      new RegExp(`\\b(and|but|or)(\\s+${adverbs})([A-Za-z']+)\\b`, 'gi'),
      (match, joiner: string, gap: string, verb: string) =>
        COORDINATED.has(verb.toLowerCase()) ? `${joiner}${gap}${firstPerson(verb)}` : match,
    );
  }
  text = text.replace(new RegExp(SUBJECT, 'g'), 'I');

  // Anything still said about someone in the third person is not the customer's to say.
  if (/\b(?:he|she|him|his|hers|himself|herself)\b/i.test(text)) return null;
  return text;
}

/** A note as the customer would say it, or null when it cannot be said safely. */
export function inCustomerVoice(
  note: string,
  personName: string,
  pronoun: Pronoun = null,
): string | null {
  const full = personName.trim();
  const first = full.split(/\s+/)[0] ?? full;
  if (COMMENTARY.test(note)) return null;
  // "he's" and "she'd" could be "has" or "is", "would" or "had": not worth guessing.
  if (/\b(?:he|she)'(?:s|d|ll)\b/i.test(note)) return null;
  const name = `(?:${escape(full)}|${escape(first)})`;

  const turned: string[] = [];
  for (const sentence of note.trim().split(/(?<=[.!?])\s+/)) {
    const said = turnSentence(sentence, name, pronoun);
    if (said === null) return null;
    turned.push(said);
  }
  const text = turned.join(' ').replace(/^(\p{L})/u, (c) => c.toUpperCase());
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

// ---------------------------------------------------------------------------------------
// Secrecy: a hidden fact stays hidden until it is earned

const cache = new WeakMap<EffectiveScenario, Set<string>>();

/** Stems of what is public: anything the customer may already say or show about the problem. */
function publicWords(scenario: EffectiveScenario): Set<string> {
  let words = cache.get(scenario);
  if (!words) {
    const texts = [
      scenario.title,
      scenario.summary,
      scenario.openingCore,
      scenario.stageFrame.opening,
      scenario.persona.role,
      scenario.persona.organisation,
      scenario.persona.background,
      scenario.impactVariant.summary,
      scenario.impactVariant.detail,
      scenario.impactVariant.deadline ?? '',
      ...scenario.environment.details,
      ...scenario.knownFacts.flatMap((f) => [f.text, f.elaboration ?? '', f.simple ?? '']),
      ...scenario.vagueFacts.flatMap((f) => [f.text, f.confirmedText ?? '']),
      ...scenario.checkableFacts.flatMap((f) => [f.checking, f.text]),
      ...scenario.unknownFacts.map((f) => f.text),
      ...scenario.irrelevantFacts.map((f) => f.text),
    ];
    words = new Set(texts.flatMap(questionWords));
    cache.set(scenario, words);
  }
  return words;
}

/** Does the note say what an undiscovered hidden fact says? Two distinctive words in common is enough. */
export function restatesHiddenFact(
  note: string,
  scenario: EffectiveScenario,
  runtime: Pick<EngineRuntime, 'discovery'>,
): boolean {
  const open = publicWords(scenario);
  const noteWords = new Set(questionWords(note).filter((w) => w.length >= 5));
  return scenario.hiddenFacts.some((fact) => {
    if (runtime.discovery[fact.id]?.status === 'discovered') return false;
    const distinctive = new Set(
      [
        fact.statement,
        fact.partialStatement ?? '',
        fact.statementTerse ?? '',
        fact.statementSimple ?? '',
      ]
        .flatMap(questionWords)
        .filter((w) => w.length >= 5 && !open.has(w)),
    );
    let shared = 0;
    for (const word of noteWords) if (distinctive.has(word)) shared += 1;
    return shared >= 2;
  });
}

/**
 * The notes of one kind that the customer may say now, in their own voice. Notes that restate an
 * undiscovered hidden fact, or that cannot be said safely, are left out.
 */
export function recordNotes(
  kind: 'tried' | 'changes',
  scenario: EffectiveScenario,
  runtime: Pick<EngineRuntime, 'discovery'>,
): string[] {
  const notes = kind === 'tried' ? scenario.previousTroubleshooting : scenario.recentChanges;
  const pronoun = pronounOf(scenario.persona);
  return notes.flatMap((note) => {
    const spoken = inCustomerVoice(note, scenario.persona.name, pronoun);
    return spoken && !restatesHiddenFact(note, scenario, runtime) ? [spoken] : [];
  });
}
