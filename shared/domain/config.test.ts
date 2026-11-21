import { describe, expect, it } from 'vitest';
import { normaliseStoredScenario, type EffectiveScenario } from './config.ts';

// A snapshot saved before Firefly was a Microsoft-only simulator holds none of the newer fields.
const legacy = {
  scenarioId: 'locked-out-after-password-reset',
  scenarioVersion: 1,
  title: 'Locked out after a password reset',
  summary: 'A front-desk coordinator cannot sign in.',
  issueType: 'sign-in-access',
  tags: [],
  estimatedMinutes: 8,
  config: {
    impact: 'low',
    startingTemperature: 'calm',
    proficiency: 'novice',
    style: 'talkative',
    callStage: 'first-contact',
    difficulty: 'starter',
    curveballTypes: [],
    mode: 'guided',
    seed: 1,
  },
  persona: { name: 'Maya Okafor', role: 'Front-desk coordinator', organisation: 'Fabrikam' },
  environment: { product: 'the staff portal', details: ['A work laptop'] },
  customerObjective: 'Get back in.',
  brief: { situation: 'She cannot sign in.', goal: 'Find out why.', groundRules: [] },
  openingCore: "I can't sign in.",
  stageFrame: { opening: '', brief: '' },
  impactVariant: { summary: "It's only me.", detail: 'Just my account.' },
  priorHistory: [],
  knownFacts: [],
  hiddenFacts: [],
  incorrectAssumptions: [],
  curveballs: [],
  expectedDiscoveryAreas: [],
  successCriteria: [],
  coachingFocus: ['scoping-discovery'],
  poorApproaches: [],
  goodBehaviours: [],
  expectedOutcome: '',
  evaluatorNotes: '',
} as unknown as EffectiveScenario;

describe('normaliseStoredScenario', () => {
  it('reads a call saved before the Microsoft scenarios without inventing anything', () => {
    const read = normaliseStoredScenario(legacy);
    expect(read.product).toBeNull();
    expect(read.caseReference).toBeNull();
    expect(read.affectedUsers).toEqual({ count: null, summary: '' });
    expect(read.vagueFacts).toEqual([]);
    expect(read.checkableFacts).toEqual([]);
    expect(read.unknownFacts).toEqual([]);
    expect(read.irrelevantFacts).toEqual([]);
    expect(read.cbcfBehaviours).toEqual([]);
    expect(read.careExpectations).toEqual({
      communicate: [],
      accountable: [],
      resourceful: [],
      empathetic: [],
    });
    // The public brief falls back to what the old snapshot already said.
    expect(read.publicBrief.issue).toBe(legacy.brief.situation);
    expect(read.publicBrief.objective).toBe(legacy.brief.goal);
    // Nothing that was already there changes.
    expect(read.title).toBe(legacy.title);
    expect(read.persona).toEqual(legacy.persona);
    expect(read.config).toMatchObject({ impact: 'low', difficulty: 'starter', seed: 1 });
    expect(read.config.timeOfDay).toBe('morning');
  });

  it('leaves a current snapshot as it is, and gives the same answer when applied twice', () => {
    const once = normaliseStoredScenario(legacy);
    expect(normaliseStoredScenario(once)).toEqual(once);
    const current = {
      ...once,
      product: { id: 'teams', area: 'Meetings' },
      caseReference: 'SIM-410001',
      config: { ...once.config, timeOfDay: 'evening' },
    } as EffectiveScenario;
    expect(normaliseStoredScenario(current)).toEqual(current);
  });
});
