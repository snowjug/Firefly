import { describe, expect, it } from 'vitest';
import { getScenarioLibrary } from '#server/scenarios/index.ts';
import { ISSUE_TYPES } from '#shared/domain/vocab.ts';
import { CALL_MINUTES, SCENARIO_EXAMPLES } from './scenario-examples.ts';

// The landing page copies a few facts about the real scenario library. These tests read the library
// itself, so a renamed scenario, a changed difficulty or a longer call fails here and not in front of
// a visitor.

const library = getScenarioLibrary().filter((scenario) => scenario.enabled);

describe('scenario examples on the landing page', () => {
  it('shows exactly one example for each kind of issue, in the order of the vocabulary', () => {
    expect(SCENARIO_EXAMPLES.map((example) => example.issueType)).toEqual([...ISSUE_TYPES]);
  });

  it.each(SCENARIO_EXAMPLES.map((example) => [example.title, example] as const))(
    'matches the library for "%s"',
    (_title, example) => {
      const scenario = library.find((candidate) => candidate.id === example.scenarioId);
      expect(scenario, `no enabled scenario has the id ${example.scenarioId}`).toBeDefined();
      expect(scenario?.title).toBe(example.title);
      expect(scenario?.difficulty).toBe(example.difficulty);
      expect(scenario?.issueType).toBe(example.issueType);
      expect(scenario?.startingTemperature).toBe(example.startingTemperature);
    },
  );

  it('uses a different scenario for every kind of issue', () => {
    const ids = SCENARIO_EXAMPLES.map((example) => example.scenarioId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('call length on the landing page', () => {
  it('matches the shortest and longest estimated call in the library', () => {
    const minutes = library.map((scenario) => scenario.estimatedMinutes);
    expect(CALL_MINUTES).toEqual({ min: Math.min(...minutes), max: Math.max(...minutes) });
  });
});
