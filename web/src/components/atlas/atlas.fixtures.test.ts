import { describe, expect, it } from 'vitest';
import { loadScenarios } from '#server/scenarios/index.ts';
import { CATALOGUE, syntheticCatalogue } from './atlas.fixtures.ts';

// The atlas tests lean on CATALOGUE standing in for the real library. If a scenario is added,
// removed or re-tuned, this is the one test that says the fixture needs the same change.
describe('the catalogue fixture', () => {
  const { scenarios, errors } = loadScenarios();

  it('matches the real registry: same scenarios, order, customers and settings', () => {
    expect(errors).toEqual([]);
    expect(
      CATALOGUE.map((s) => ({
        id: s.id,
        title: s.title,
        summary: s.summary,
        tags: s.tags,
        estimatedMinutes: s.estimatedMinutes,
        issueType: s.issueType,
        impact: s.impact,
        startingTemperature: s.startingTemperature,
        proficiency: s.proficiency,
        style: s.style,
        callStage: s.callStage,
        difficulty: s.difficulty,
        persona: s.persona,
        coachingFocus: s.coachingFocus,
        spotlight: s.spotlight,
      })),
    ).toEqual(
      scenarios.map((s) => ({
        id: s.id,
        title: s.title,
        summary: s.summary,
        tags: s.tags,
        estimatedMinutes: s.estimatedMinutes,
        issueType: s.issueType,
        impact: s.impact,
        startingTemperature: s.startingTemperature,
        proficiency: s.proficiency,
        style: s.style,
        callStage: s.callStage,
        difficulty: s.difficulty,
        persona: {
          name: s.persona.name,
          role: s.persona.role,
          organisation: s.persona.organisation,
        },
        coachingFocus: s.coachingFocus,
        spotlight: s.spotlight,
      })),
    );
  });
});

describe('syntheticCatalogue', () => {
  it('repeats exactly for the same seed, and has the count and unique ids asked for', () => {
    const a = syntheticCatalogue(40, 9);
    expect(a).toEqual(syntheticCatalogue(40, 9));
    expect(a).not.toEqual(syntheticCatalogue(40, 10));
    expect(a).toHaveLength(40);
    expect(new Set(a.map((s) => s.id)).size).toBe(40);
    expect(syntheticCatalogue(0, 1)).toEqual([]);
  });
});
