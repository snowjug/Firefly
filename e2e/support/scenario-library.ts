import { getScenarioLibrary } from '../../server/scenarios/index.ts';
import type { ScenarioDefinition } from '../../shared/domain/scenario.ts';
import {
  DIFFICULTIES,
  DIFFICULTY_RANK,
  PRODUCT_FAMILIES,
  PRODUCT_IDS,
  PRODUCT_INFO,
  type Difficulty,
} from '../../shared/domain/vocab.ts';

// The real scenario library, read straight from the server's own files, for the checks that must hold
// for every scenario: nothing the customer keeps back may be shown before it is asked for. It also
// says what each scenario's customer holds back, and what they say they do not know, so a journey can
// check the customer's answers against the scenario and not against a guess at the wording.
//
// It is also where a spec gets every fact about the library's size and shape (how many scenarios
// there are, how many of a product or a difficulty, which card comes first). A spec never types such
// a number or name: the library grows, and what the page shows has to follow it. A spec may still
// name one scenario by its id when the journey is about that scenario.

export interface LibraryFact {
  id: string;
  label: string;
  betterQuestion: string;
  importance: string;
  /** Every way the customer may say the fact (in full, tersely, simply, or for another impact level). */
  statements: string[];
}

export interface LibraryUnknownFact {
  id: string;
  /** What the customer says when asked: that they do not know. */
  text: string;
  /** Who would know, which the customer may add. */
  whoKnows: string | null;
}

export interface LibraryScenario {
  id: string;
  title: string;
  /** The title on the scenario's card, which is also the name of the card's radio button. */
  shortTitle: string;
  persona: { name: string; role: string; organisation: string };
  /** The product, as the vocabulary names it (`id` is "windows-11", `name` is "Windows 11"). */
  product: { id: string; name: string; family: string };
  /** What the scenario starts as: the card's line says the impact, the mood and the call stage. */
  impact: string;
  startingTemperature: string;
  callStage: string;
  difficulty: Difficulty;
  /**
   * Text that only the discovery of a hidden fact may ever put on screen: what the customer says
   * once asked, what the report calls the fact, and what a better question would have been.
   * (A fact's `hint` is not here: the customer drops it in the opening line on purpose.)
   */
  secrets: string[];
  /** The title and the question that would have found each fact, for the report checks. */
  facts: LibraryFact[];
  /** What the customer says they do not know. */
  unknownFacts: LibraryUnknownFact[];
  /**
   * The topics guided practice lists as "Areas to explore". They are published on purpose, so a fact
   * whose label is one of them is not a secret in a guided call.
   */
  areas: string[];
}

function sentences(text: string | undefined): string[] {
  return text ? [text.trim()] : [];
}

/**
 * What only the discovery of a hidden fact may ever put on screen (`LibraryScenario.secrets`). The
 * call-page checks in the specs and the unit check of what a trainee can read before a call
 * (server/scenarios/library.test.ts) both look for exactly these, so a fact is never secret to one
 * and not to the other. This file must stay free of browser-test imports for that reason.
 */
export function secretsOf(scenario: ScenarioDefinition): string[] {
  return scenario.hiddenFacts.flatMap((fact) => [
    ...sentences(fact.statement),
    ...sentences(fact.partialStatement),
    ...sentences(fact.statementTerse),
    ...sentences(fact.statementSimple),
    ...sentences(fact.label),
    ...sentences(fact.betterQuestion),
    ...sentences(fact.missedConsequence),
    ...sentences(fact.revealWhen),
  ]);
}

/** The scenarios a visitor can see: the server lists the enabled ones, in the order of its registry. */
export function libraryScenarios(): LibraryScenario[] {
  return getScenarioLibrary()
    .filter((scenario) => scenario.enabled)
    .map((scenario) => ({
      id: scenario.id,
      title: scenario.title,
      shortTitle: scenario.shortTitle,
      persona: {
        name: scenario.persona.name,
        role: scenario.persona.role,
        organisation: scenario.persona.organisation,
      },
      product: {
        id: scenario.product.id,
        name: PRODUCT_INFO[scenario.product.id].name,
        family: PRODUCT_INFO[scenario.product.id].family,
      },
      impact: scenario.impact,
      startingTemperature: scenario.startingTemperature,
      callStage: scenario.callStage,
      difficulty: scenario.difficulty,
      secrets: secretsOf(scenario),
      facts: scenario.hiddenFacts.map((fact) => ({
        id: fact.id,
        label: fact.label,
        betterQuestion: fact.betterQuestion,
        importance: fact.importance,
        statements: [
          fact.statement,
          fact.statementTerse,
          fact.statementSimple,
          ...Object.values(fact.byImpact ?? {}).flatMap((variant) => [
            variant?.statement,
            variant?.statementTerse,
            variant?.statementSimple,
          ]),
        ].filter((text): text is string => typeof text === 'string' && text.trim() !== ''),
      })),
      unknownFacts: scenario.unknownFacts.map((fact) => ({
        id: fact.id,
        text: fact.text,
        whoKnows: fact.whoKnows ?? null,
      })),
      areas: [...scenario.expectedDiscoveryAreas],
    }));
}

export function libraryScenario(id: string): LibraryScenario {
  const found = libraryScenarios().find((scenario) => scenario.id === id);
  if (!found) throw new Error(`There is no scenario "${id}" in the library.`);
  return found;
}

// ---- The size and the shape of the library -------------------------------------------------

/** How many scenarios the library holds. */
export function libraryCount(): number {
  return libraryScenarios().length;
}

/** The scenarios of a product, of a difficulty, or of both, in the order of the registry. */
export function libraryWhere(
  filter: { product?: string; difficulty?: Difficulty } = {},
): LibraryScenario[] {
  return libraryScenarios().filter(
    (scenario) =>
      (filter.product === undefined || scenario.product.id === filter.product) &&
      (filter.difficulty === undefined || scenario.difficulty === filter.difficulty),
  );
}

/** "16 scenarios" or "1 scenario": a number with its noun, as a rail chip or a filter says it. */
export function scenarioNoun(n: number): string {
  return `${n} ${n === 1 ? 'scenario' : 'scenarios'}`;
}

/**
 * What the count under the heading of the scenarios page says: "16 scenarios" when every scenario is
 * shown, "4 of 16 scenarios" when a filter leaves some out. The total is the library's own.
 */
export function countText(shown: number, total: number = libraryCount()): string {
  return shown === total ? scenarioNoun(total) : `${shown} of ${scenarioNoun(total)}`;
}

const rankIn = <T>(list: readonly T[], item: T): number => {
  const index = list.indexOf(item);
  return index === -1 ? list.length : index;
};

/**
 * The scenarios in the order the scenarios page lays its cards out, whatever the order of the
 * registry: by product family, then by product (in the vocabulary's order), then the easiest first,
 * then by title (docs/scenario-authoring.md, "What each screen draws"). The first of them is the card
 * that is chosen when the page opens with no scenario in its address.
 */
export function cardOrder(scenarios: readonly LibraryScenario[] = libraryScenarios()) {
  return [...scenarios].sort(
    (a, b) =>
      rankIn(PRODUCT_FAMILIES, a.product.family) - rankIn(PRODUCT_FAMILIES, b.product.family) ||
      rankIn(PRODUCT_IDS, a.product.id) - rankIn(PRODUCT_IDS, b.product.id) ||
      DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty] ||
      a.title.localeCompare(b.title, 'en'),
  );
}

/** A product and a difficulty that no scenario has both of, so that choosing the two leaves no card. */
export function emptyFilter(): { product: string; difficulty: Difficulty } {
  const scenarios = libraryScenarios();
  for (const product of PRODUCT_IDS) {
    for (const difficulty of DIFFICULTIES) {
      if (!scenarios.some((s) => s.product.id === product && s.difficulty === difficulty)) {
        return { product, difficulty };
      }
    }
  }
  throw new Error(
    'Every product has a scenario at every difficulty: no filter leaves the list empty.',
  );
}

/**
 * A time limit for a test that visits every scenario in turn, which has to grow with the library: a
 * fixed one that was enough for sixteen scenarios is not for thirty-two.
 */
export function timeoutFor(msEach: number, baseMs = 30_000): number {
  return baseMs + msEach * libraryCount();
}

const squash = (text: string) =>
  text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/** Whether `pageText` contains any of the secrets (ignoring runs of white space and case). */
export function leakedSecrets(pageText: string, secrets: readonly string[]): string[] {
  const haystack = squash(pageText);
  return secrets.filter((secret) => haystack.includes(squash(secret)));
}

/** The secrets of a scenario for a page that lists its areas to explore (guided practice). */
export function secretsBesidesAreas(
  scenario: Pick<LibraryScenario, 'secrets' | 'areas'>,
): string[] {
  const published = new Set(scenario.areas.map(squash));
  return scenario.secrets.filter((secret) => !published.has(squash(secret)));
}

/** The first sentence of a text, which is what a short answer keeps of a longer one. */
export function firstSentence(text: string): string {
  return text.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? text;
}

/** Whether `said` contains `sentence`, ignoring case, spacing and the shape of apostrophes and quotes. */
export function saysSentence(said: string, sentence: string): boolean {
  return squash(said).includes(squash(sentence));
}
