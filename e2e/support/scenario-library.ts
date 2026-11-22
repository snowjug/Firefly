import { getScenarioLibrary } from '../../server/scenarios/index.ts';

// The real scenario library, read straight from the server's own files, for the checks that must hold
// for every scenario: nothing the customer keeps back may be shown before it is asked for. It also
// says what each scenario's customer holds back, and what they say they do not know, so a journey can
// check the customer's answers against the scenario and not against a guess at the wording.

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
  callStage: string;
  difficulty: string;
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

export function libraryScenarios(): LibraryScenario[] {
  return getScenarioLibrary().map((scenario) => ({
    id: scenario.id,
    title: scenario.title,
    shortTitle: scenario.shortTitle,
    persona: {
      name: scenario.persona.name,
      role: scenario.persona.role,
      organisation: scenario.persona.organisation,
    },
    callStage: scenario.callStage,
    difficulty: scenario.difficulty,
    secrets: scenario.hiddenFacts.flatMap((fact) => [
      ...sentences(fact.statement),
      ...sentences(fact.partialStatement),
      ...sentences(fact.statementTerse),
      ...sentences(fact.statementSimple),
      ...sentences(fact.label),
      ...sentences(fact.betterQuestion),
      ...sentences(fact.missedConsequence),
      ...sentences(fact.revealWhen),
    ]),
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
export function secretsBesidesAreas(scenario: LibraryScenario): string[] {
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
