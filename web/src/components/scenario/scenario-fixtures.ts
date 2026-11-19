import type { PublicScenarioDTO } from '#shared/domain/api.ts';

/** A public scenario for tests, close to what the API returns. Change any field with `overrides`. */
export function makeScenario(overrides: Partial<PublicScenarioDTO> = {}): PublicScenarioDTO {
  return {
    id: 'team-workspace',
    version: 1,
    title: 'Team cannot open the shared workspace',
    summary: 'A project lead says nobody on the team can open the shared workspace.',
    tags: ['access', 'team'],
    estimatedMinutes: 10,
    issueType: 'sign-in-access',
    impact: 'medium',
    startingTemperature: 'frustrated',
    proficiency: 'intermediate',
    style: 'terse',
    callStage: 'first-contact',
    difficulty: 'standard',
    persona: { name: 'Maya Okafor', role: 'IT administrator', organisation: 'Northwind Foods' },
    brief: {
      situation:
        'An IT administrator is calling because nobody on her team can open the workspace.',
      goal: 'Find out what is happening and agree what happens next.',
      groundRules: ['The customer, organisation and product are fictional.'],
    },
    expectedDiscoveryAreas: ['When it started', 'Who is affected'],
    coachingFocus: ['scoping-discovery', 'empathy-deescalation'],
    curveballOptions: ['ask-manager', 'threaten-cancel', 'deadline', 'go-silent'],
    spotlight: false,
    synthetic: true,
    ...overrides,
  };
}
