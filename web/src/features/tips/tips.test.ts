// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { getScenarioLibrary } from '#server/scenarios/index.ts';
import { CURVEBALL_LABELS, PRODUCT_INFO } from '#shared/domain/vocab.ts';
import { ICON_NAMES } from '../../design/icons.tsx';
import { CARE_LABELS, MAX_TIP_WORDS, MAX_WHY_WORDS, TIP_PHASES, TIPS, type Tip } from './tips.ts';

// What the tips say, and what they must never say. The strip teaches general call behaviour; it must
// not tell a trainee anything about THIS call. These tests read every tip, and the whole scenario
// library as it stands, and fail on a digit, a product, a complication or a word that belongs to a
// hidden fact.

const countWords = (text: string) => text.trim().split(/\s+/).length;
const everyText = (tip: Tip) => [tip.text, ...(tip.why ? [tip.why] : [])];

/** Words, lower case, with a plural or a possessive folded in: "users" and "user's" are "user". */
const stem = (word: string) => (word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word);
const wordsOf = (text: string): string[] =>
  (
    text
      .toLowerCase()
      .replace(/[\u2019']s\b/g, '')
      .match(/[a-z]+/g) ?? []
  ).map(stem);

// Words that carry no content, so they cannot give anything away.
const FUNCTION_WORDS = new Set(
  (
    'a about after again all an and any are as at be been before but by can do does down each else ' +
    'first for from had has have how if in into is it its just may more most much no not of on once ' +
    'one only or other out own so some such than that the their them then there these they this to ' +
    'up us use was we were what when where which who will with would yet you your'
  )
    .split(' ')
    .map(stem),
);

// General call-handling words that a hidden fact's label may share with a tip. Each is ordinary
// vocabulary of a support call and gives nothing away: several are the words of the brief's own
// examples ("Clarify how many users are affected", "Ask what changed before the issue began",
// "Name the owner of the next action"). The list is capped on purpose. When a new scenario makes a
// tip fail, reword the tip first; add a word here only if it is plain call-handling vocabulary.
const GENERAL_WORDS = new Set(
  [
    // the people and the call
    'customer',
    'user',
    'call',
    'owner',
    // what a call is about, in the brief's own words
    'issue',
    'problem',
    'affected',
    'impact',
    'change',
    'changed',
    'began',
    // what a good call does
    'ask',
    'plan',
    'next',
    'step',
    'action',
    'update',
    'time',
    'agree',
    'agreement',
    'confirm',
    'need',
    'want',
  ].map(stem),
);
const MAX_GENERAL_WORDS = 24;

// Ordinary verbs of speech and movement. A hidden fact's label may use one ("Leaves the shared
// mailbox"), and a tip about talking to a customer cannot do without them. They name no product,
// no setting and no fix. Technical verbs ("reinstall", "reset", "roll back") are not here, so a tip
// that uses one is checked against the library like any other word.
const PLAIN_VERBS = new Set(
  [
    'come',
    'explain',
    'give',
    'hear',
    'help',
    'keep',
    'know',
    'leave',
    'let',
    'look',
    'make',
    'say',
    'see',
    'show',
    'take',
    'tell',
  ].map(stem),
);
const MAX_PLAIN_VERBS = 24;
const OK = (word: string) =>
  FUNCTION_WORDS.has(word) || GENERAL_WORDS.has(word) || PLAIN_VERBS.has(word);

const everyWord = new Set(TIPS.flatMap((tip) => everyText(tip).flatMap(wordsOf)));
const library = getScenarioLibrary();

describe('the tips', () => {
  it('are at least sixteen, grouped by phase, in the order a call tends to go', () => {
    expect(TIPS.length).toBeGreaterThanOrEqual(16);
    expect(new Set(TIPS.map((tip) => tip.id)).size).toBe(TIPS.length);
    const phases = TIPS.map((tip) => TIP_PHASES.indexOf(tip.phase));
    expect(phases.every((place) => place >= 0)).toBe(true);
    expect([...phases].sort((a, b) => a - b)).toEqual(phases);
    for (const phase of TIP_PHASES) {
      expect(TIPS.filter((tip) => tip.phase === phase).length, phase).toBeGreaterThanOrEqual(2);
    }
  });

  it('include the brief’s own examples, word for word', () => {
    const texts = TIPS.map((tip) => tip.text);
    for (const example of [
      'Establish impact before troubleshooting.',
      'Ask what changed before the issue began.',
      'Summarise before proposing next steps.',
      'Name the owner of the next action.',
      'Give a specific next-update time.',
      'Acknowledge concern, then explain the plan.',
      'Use plain language with a novice customer.',
      'Confirm agreement before closing.',
      'Clarify how many users are affected.',
    ]) {
      expect(texts).toContain(example);
    }
  });

  it('keep each tip to ten words and each “Learn why” to thirty', () => {
    // Pinned here to the brief's numbers, so the constants cannot drift.
    expect(MAX_TIP_WORDS).toBe(10);
    expect(MAX_WHY_WORDS).toBe(30);
    for (const tip of TIPS) {
      expect(countWords(tip.text), tip.text).toBeLessThanOrEqual(10);
      if (tip.why) expect(countWords(tip.why), tip.why).toBeLessThanOrEqual(30);
    }
  });

  it('give every tip an icon from the design system, and a CARE label only from the four', () => {
    for (const tip of TIPS) {
      expect(ICON_NAMES, tip.id).toContain(tip.icon);
      if (tip.care) expect(CARE_LABELS, tip.id).toContain(tip.care);
    }
    expect([...CARE_LABELS]).toEqual([
      'Communicate effectively',
      'Be accountable',
      'Be resourceful',
      'Be empathetic',
    ]);
    // Each behaviour is taught somewhere, and a tip does not need a label to be worth showing.
    for (const label of CARE_LABELS)
      expect(
        TIPS.some((tip) => tip.care === label),
        label,
      ).toBe(true);
    expect(TIPS.some((tip) => !tip.care)).toBe(true);
    expect(TIPS.some((tip) => !tip.why)).toBe(true);
    expect(TIPS.filter((tip) => tip.why).length).toBeGreaterThanOrEqual(10);
  });

  it('are plain British English: one sentence, no emoji, no markup, no shouting', () => {
    for (const tip of TIPS) {
      for (const text of everyText(tip)) {
        expect(text, tip.id).toMatch(/^\p{Lu}/u);
        expect(text, tip.id).toMatch(/[.?]$/);
        expect(text, tip.id).not.toMatch(/\p{Extended_Pictographic}/u);
        expect(text, tip.id).not.toMatch(/[<>{}[\]!]/);
        expect(text, tip.id).not.toMatch(/\b[A-Z]{3,}\b/);
        expect(text, tip.id).not.toMatch(
          /\b(?:summariz|organiz|recogniz|prioritiz|apologiz|behavior|color|favor|center)/i,
        );
      }
      expect(tip.text.split(/[.?]\s/)).toHaveLength(1);
    }
  });

  it('never name a score, the evaluator, a threshold or what to expect', () => {
    for (const word of everyWord) {
      expect(word).not.toMatch(
        /^(?:score|scor|rubric|evaluat|evaluator|grade|rating|threshold|trigger|hidden|secret|curveball|temperature|answer|solution|fix)/,
      );
    }
  });
});

describe('what the tips never leak', () => {
  it('hold no digit and no number written out', () => {
    for (const tip of TIPS) {
      for (const text of everyText(tip)) {
        expect(text, tip.id).not.toMatch(/\d/);
        expect(text, tip.id).not.toMatch(
          /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|dozen|hundred|thousand)\b/i,
        );
      }
    }
  });

  it('name no Microsoft product, and no word of one', () => {
    const product = new Set(
      Object.values(PRODUCT_INFO)
        .flatMap(({ name }) => wordsOf(name))
        .filter((word) => !FUNCTION_WORDS.has(word)),
    );
    expect(product.size).toBeGreaterThan(8);
    expect([...everyWord].filter((word) => product.has(word))).toEqual([]);
  });

  it('use no word of a complication: asking for a manager, a threat, a deadline and the rest', () => {
    const curveball = [
      ...new Set(Object.values(CURVEBALL_LABELS).flatMap(({ label }) => wordsOf(label))),
    ].filter((word) => !OK(word));
    expect(curveball).toEqual(
      expect.arrayContaining(['manager', 'cancel', 'deadline', 'guarantee', 'credibility']),
    );
    expect([...everyWord].filter((word) => curveball.includes(word))).toEqual([]);
  });

  it('use no word that belongs to a hidden fact of any scenario in the library', () => {
    const owners = new Map<string, Set<string>>();
    for (const scenario of library) {
      for (const fact of scenario.hiddenFacts) {
        for (const word of wordsOf(fact.label)) {
          owners.set(word, (owners.get(word) ?? new Set()).add(scenario.id));
        }
      }
    }
    expect(library.length).toBeGreaterThan(10);
    expect(owners.size).toBeGreaterThan(80);
    const leaks = [...everyWord]
      .filter((word) => owners.has(word) && !OK(word))
      .map((word) => `${word} (in ${[...(owners.get(word) as Set<string>)].join(', ')})`);
    // A failure names the word and the scenarios whose hidden facts use it: reword the tip.
    expect(leaks).toEqual([]);
  });

  it('copy no run of words from what a customer says when asked, or from how to draw it out', () => {
    const run = (text: string) => {
      const content = wordsOf(text).filter((word) => !FUNCTION_WORDS.has(word));
      return content.slice(2).map((_, at) => content.slice(at, at + 3).join(' '));
    };
    const hidden = new Set(
      library.flatMap((scenario) =>
        scenario.hiddenFacts.flatMap((fact) =>
          [fact.statement, fact.partialStatement ?? '', fact.revealWhen].flatMap(run),
        ),
      ),
    );
    expect(hidden.size).toBeGreaterThan(200);
    const copied = TIPS.flatMap((tip) => everyText(tip).flatMap(run)).filter((phrase) =>
      hidden.has(phrase),
    );
    expect(copied).toEqual([]);
  });

  it('keep the lists of general words and plain verbs short, and free of any product or complication', () => {
    expect(GENERAL_WORDS.size).toBeLessThanOrEqual(MAX_GENERAL_WORDS);
    expect(PLAIN_VERBS.size).toBeLessThanOrEqual(MAX_PLAIN_VERBS);
    const barred = new Set([
      ...Object.values(PRODUCT_INFO).flatMap(({ name }) => wordsOf(name)),
      ...Object.values(CURVEBALL_LABELS).flatMap(({ label }) => wordsOf(label)),
    ]);
    // "ask", "issue" and "change" are in a complication's label as well as in the brief's own example tips.
    const shared = new Set(['ask', 'issue', 'change', 'changed']);
    for (const word of [...GENERAL_WORDS, ...PLAIN_VERBS]) {
      if (shared.has(word)) continue;
      expect(barred.has(word), word).toBe(false);
    }
  });
});
