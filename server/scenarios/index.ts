import { ScenarioDefinitionSchema, type ScenarioDefinition } from '#shared/domain/scenario.ts';
import { DIFFICULTY_RANK, DISCOVERY_INTENTS, type Difficulty } from '#shared/domain/vocab.ts';
import lockedOut from './library/locked-out-after-password-reset.ts';

// Registry of the built-in synthetic scenarios. Add a scenario by creating a file in
// ./library and listing it here; `npm run validate:scenarios` checks everything.
const LIBRARY_INPUT: unknown[] = [lockedOut];

export interface LoadedScenarios {
  scenarios: ScenarioDefinition[];
  errors: string[];
}

export function loadScenarios(input: unknown[] = LIBRARY_INPUT): LoadedScenarios {
  const scenarios: ScenarioDefinition[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    const parsed = ScenarioDefinitionSchema.safeParse(raw);
    if (!parsed.success) {
      const id =
        typeof (raw as { id?: unknown })?.id === 'string' ? (raw as { id: string }).id : '?';
      for (const issue of parsed.error.issues) {
        errors.push(`${id}: ${issue.path.join('.') || '(root)'}: ${issue.message}`);
      }
      continue;
    }
    if (seen.has(parsed.data.id)) {
      errors.push(`${parsed.data.id}: duplicate scenario id`);
      continue;
    }
    seen.add(parsed.data.id);
    errors.push(...semanticIssues(parsed.data));
    scenarios.push(parsed.data);
  }
  return { scenarios, errors };
}

// Distinctive tokens (numbers, codes, product error ids) of a hidden fact must not appear in text
// that the customer shares before the fact is discovered.
function distinctiveTokens(text: string): string[] {
  const tokens = new Set<string>();
  for (const m of text.matchAll(
    /\b[A-Z]{2,}[A-Z0-9_-]*\d+[A-Z0-9_-]*\b|\b\d[\d,.:%]*\d\b|\b0x[0-9A-Fa-f]+\b/g,
  )) {
    tokens.add(m[0].toLowerCase());
  }
  return [...tokens];
}

export function semanticIssues(s: ScenarioDefinition): string[] {
  const issues: string[] = [];
  const earlyText: [string, string][] = [
    ['openingCore', s.openingCore],
    ...s.knownFacts.map((f, i): [string, string] => [`knownFacts[${i}]`, f.text]),
    ...(['low', 'medium', 'high'] as const).map((k): [string, string] => [
      `impactVariants.${k}.summary`,
      s.impactVariants[k].summary,
    ]),
    ...Object.entries(s.stageFrames).map(([k, v]): [string, string] => [
      `stageFrames.${k}.opening`,
      v.opening,
    ]),
  ];
  for (const fact of s.hiddenFacts) {
    for (const token of distinctiveTokens(fact.statement)) {
      for (const [where, text] of earlyText) {
        if (text.toLowerCase().includes(token)) {
          issues.push(`${s.id}: hidden fact "${fact.id}" token "${token}" leaks in ${where}`);
        }
      }
    }
    for (const intent of [...fact.intents, ...(fact.partialIntents ?? [])]) {
      if (!DISCOVERY_INTENTS.includes(intent)) issues.push(`${s.id}: unknown intent ${intent}`);
    }
    if (fact.partialIntents?.length && !fact.partialStatement) {
      issues.push(`${s.id}: hidden fact "${fact.id}" has partialIntents but no partialStatement`);
    }
  }

  // Every difficulty must leave a workable scenario.
  for (const difficulty of ['starter', 'standard', 'challenge'] as Difficulty[]) {
    const facts = s.hiddenFacts.filter(
      (f) => DIFFICULTY_RANK[f.minDifficulty] <= DIFFICULTY_RANK[difficulty],
    );
    if (!facts.some((f) => f.importance !== 'helpful')) {
      issues.push(`${s.id}: no critical or important hidden fact at ${difficulty} difficulty`);
    }
  }

  const aliveIntents = new Set(s.knownFacts.flatMap((f) => f.intents));
  if (!aliveIntents.has('problem_description')) {
    issues.push(`${s.id}: no known fact answers problem_description`);
  }
  if (s.coachingFocus.length === 0) issues.push(`${s.id}: coachingFocus is empty`);
  return issues;
}

let cache: LoadedScenarios | null = null;

/** Loads and validates the built-in library once. Throws if any scenario is invalid. */
export function getScenarioLibrary(): ScenarioDefinition[] {
  cache ??= loadScenarios();
  if (cache.errors.length > 0) {
    throw new Error(`Invalid scenario library:\n  ${cache.errors.join('\n  ')}`);
  }
  return cache.scenarios;
}
