import { getScenarioLibrary } from '../../server/scenarios/index.ts';

// The real scenario library, read straight from the server's own files, for the checks that must hold
// for every scenario: nothing the customer keeps back may be shown before it is asked for.

export interface LibraryScenario {
  id: string;
  title: string;
  /**
   * Text that only the discovery of a hidden fact may ever put on screen: what the customer says
   * once asked, what the report calls the fact, and what a better question would have been.
   * (A fact's `hint` is not here: the customer drops it in the opening line on purpose.)
   */
  secrets: string[];
  /** The title and the question that would have found each fact, for the report checks. */
  facts: Array<{ id: string; label: string; betterQuestion: string; importance: string }>;
}

function sentences(text: string | undefined): string[] {
  return text ? [text.trim()] : [];
}

export function libraryScenarios(): LibraryScenario[] {
  return getScenarioLibrary().map((scenario) => ({
    id: scenario.id,
    title: scenario.title,
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
    })),
  }));
}

export function libraryScenario(id: string): LibraryScenario {
  const found = libraryScenarios().find((scenario) => scenario.id === id);
  if (!found) throw new Error(`There is no scenario "${id}" in the library.`);
  return found;
}

/** Whether `pageText` contains any of the secrets (ignoring runs of white space and case). */
export function leakedSecrets(pageText: string, secrets: readonly string[]): string[] {
  const squash = (text: string) => text.replace(/\s+/g, ' ').toLowerCase();
  const haystack = squash(pageText);
  return secrets.filter((secret) => haystack.includes(squash(secret)));
}
