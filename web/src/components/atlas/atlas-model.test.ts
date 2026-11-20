import { describe, expect, it } from 'vitest';
import type { PublicScenarioDTO, SessionSummaryDTO } from '#shared/domain/api.ts';
import { DIFFICULTIES, IMPACTS, ISSUE_TYPES } from '#shared/domain/vocab.ts';
import { seeded } from '../../test-rng.ts';
import { makeScenario } from '../scenario/scenario-fixtures.ts';
import {
  CATALOGUE,
  endedEarlyCall,
  fullCall,
  runningCall,
  sampleCall,
  session,
  syntheticCatalogue,
} from './atlas.fixtures.ts';
import {
  ATLAS_FAMILY_LABELS,
  EMPTY_LENS,
  applyLens,
  buildAtlas,
  describeFamily,
  describeMission,
  isLensEmpty,
  type AtlasLens,
  type AtlasMission,
} from './atlas-model.ts';

const LOCKED_OUT = 'locked-out-after-password-reset';
const ESCALATED = 'escalated-integration-failures';

const build = (sessions: readonly SessionSummaryDTO[] = [], recommendedId: string | null = null) =>
  buildAtlas(CATALOGUE, sessions, recommendedId);

const missionOf = (model: ReturnType<typeof build>, id: string): AtlasMission => {
  const mission = model.missions.find((m) => m.id === id);
  if (!mission) throw new Error(`no mission ${id}`);
  return mission;
};

const shuffled = <T>(items: readonly T[], seed: number): T[] => seeded(seed).shuffle(items);

describe('families', () => {
  it('are the seven issue types, in vocabulary order, with the map labels', () => {
    const model = build();
    expect(model.families.map((f) => f.id)).toEqual([...ISSUE_TYPES]);
    expect(model.families.map((f) => f.label)).toEqual([
      'Access and Identity',
      'Service Availability',
      'Performance',
      'Data and Recovery',
      'Billing and Licensing',
      'Guidance and How-To',
      'Unexpected Behaviour',
    ]);
    expect(Object.keys(ATLAS_FAMILY_LABELS)).toEqual([...ISSUE_TYPES]);
  });

  it('hold every mission once, gentlest first, with their completed count', () => {
    const model = build([fullCall('slow-dashboard-with-workaround'), fullCall(LOCKED_OUT)]);
    const held = model.families.flatMap((f) => f.missionIds);
    expect(held).toHaveLength(13);
    expect(new Set(held).size).toBe(13);
    expect(held).toEqual(model.missions.map((m) => m.id));

    const performance = model.families.find((f) => f.id === 'slow-performance');
    expect(performance?.missionIds).toEqual([
      'slow-dashboard-with-workaround',
      'recurring-midday-slowdowns',
      'confident-but-incorrect-diagnosis',
    ]);
    expect(performance?.completed).toBe(1);
    expect(model.families.find((f) => f.id === 'sign-in-access')?.completed).toBe(1);
    expect(model.families.find((f) => f.id === 'how-to')?.completed).toBe(0);
  });

  it('leave out an issue type that has no scenario, without disturbing the order of the rest', () => {
    const model = buildAtlas(
      CATALOGUE.filter((s) => s.issueType !== 'service-outage' && s.issueType !== 'how-to'),
      [],
      null,
    );
    expect(model.families.map((f) => f.id)).toEqual([
      'sign-in-access',
      'slow-performance',
      'data-missing',
      'billing-licence',
      'feature-not-working',
    ]);
  });

  it('are described in one line for the map and the list', () => {
    expect(
      describeFamily({ label: 'Performance', missionIds: ['a', 'b', 'c'], completed: 0 }),
    ).toBe('Performance: 3 missions, none completed yet.');
    expect(describeFamily({ label: 'Guidance and How-To', missionIds: ['a'], completed: 1 })).toBe(
      'Guidance and How-To: 1 mission, 1 completed.',
    );
  });
});

describe('missions', () => {
  it('start as new for someone with no history, and the model is empty with nothing to show', () => {
    const model = build();
    expect(model.missions).toHaveLength(13);
    for (const mission of model.missions) {
      expect(mission).toMatchObject({ status: 'new', attempts: 0, best: null, recommended: false });
    }
    expect(buildAtlas([], [], null)).toEqual({ families: [], missions: [] });
    // History without a scenario to attach it to invents nothing.
    expect(buildAtlas([], [fullCall(LOCKED_OUT)], LOCKED_OUT)).toEqual({
      families: [],
      missions: [],
    });
  });

  it.each([
    ['starter', 1],
    ['standard', 2],
    ['challenge', 3],
  ] as const)('draw %s with %i ring(s)', (difficulty, rings) => {
    const missions = build().missions.filter((m) => m.difficulty === difficulty);
    expect(missions.length).toBeGreaterThan(0);
    expect(missions.every((m) => m.rings === rings)).toBe(true);
  });

  it.each([
    ['low', 1],
    ['medium', 2],
    ['high', 3],
  ] as const)('draw %s impact at size %i', (impact, size) => {
    const missions = build().missions.filter((m) => m.impact === impact);
    expect(missions.length).toBeGreaterThan(0);
    expect(missions.every((m) => m.size === size)).toBe(true);
  });

  it('carry the settings and the skills they are built to practise', () => {
    const escalated = missionOf(build(), ESCALATED);
    expect(escalated).toMatchObject({
      family: 'feature-not-working',
      familyLabel: 'Unexpected Behaviour',
      start: 'angry',
      stage: 'escalated',
      minutes: 15,
      rings: 3,
      size: 3,
      focus: ['Clarity', 'Ownership & Next Steps', 'Closing'],
      coachingFocus: ['clarity', 'ownership-next-steps', 'closing'],
      persona: { name: 'Mateus Carvalho', organisation: 'Litware Freight' },
    });
  });

  it('are completed by a full call, with the best score among full calls only', () => {
    const model = build([
      fullCall(LOCKED_OUT, 3.2),
      fullCall(LOCKED_OUT, 4.1),
      fullCall(LOCKED_OUT, 3.9),
      endedEarlyCall(LOCKED_OUT),
      runningCall(LOCKED_OUT),
    ]);
    expect(missionOf(model, LOCKED_OUT)).toMatchObject({
      status: 'completed',
      attempts: 5,
      best: 4.1,
    });
  });

  it('are attempted when a call was started but never taken to a close', () => {
    const cases = [
      [runningCall(LOCKED_OUT)],
      [endedEarlyCall(LOCKED_OUT)],
      [session(LOCKED_OUT, { status: 'evaluation_failed', completion: null, overallScore: null })],
      [session(LOCKED_OUT, { status: 'completing', completion: null, overallScore: null })],
    ];
    for (const sessions of cases) {
      expect(missionOf(build(sessions), LOCKED_OUT)).toMatchObject({
        status: 'attempted',
        attempts: 1,
        best: null,
      });
    }
  });

  it('never take a score from a call that was not taken to a close', () => {
    const model = build([
      session(LOCKED_OUT, { status: 'completed', completion: 'ended-early', overallScore: 4.9 }),
      session(LOCKED_OUT, { status: 'active', completion: null, overallScore: 4.8 }),
    ]);
    expect(missionOf(model, LOCKED_OUT).best).toBeNull();
  });

  it('keep a full call without a score completed, with nothing to show as best', () => {
    const mission = missionOf(build([fullCall(LOCKED_OUT, null)]), LOCKED_OUT);
    expect(mission).toMatchObject({ status: 'completed', best: null, attempts: 1 });
    expect(mission.description.endsWith('Completed.')).toBe(true);
  });

  it('ignore sample sessions completely: not an attempt, not a score', () => {
    const model = build([sampleCall(LOCKED_OUT, 5), sampleCall(ESCALATED, 4.5)]);
    for (const id of [LOCKED_OUT, ESCALATED]) {
      expect(missionOf(model, id)).toMatchObject({ status: 'new', attempts: 0, best: null });
    }
    const mixed = build([sampleCall(LOCKED_OUT, 5), fullCall(LOCKED_OUT, 3.4)]);
    expect(missionOf(mixed, LOCKED_OUT)).toMatchObject({ attempts: 1, best: 3.4 });
  });

  it('ignore history for scenarios that are not in the library', () => {
    const model = build([fullCall('retired-scenario', 5)]);
    expect(model.missions.every((m) => m.status === 'new')).toBe(true);
  });

  it('flag only the recommended one', () => {
    const model = build([], 'licence-seat-not-assigned');
    expect(model.missions.filter((m) => m.recommended).map((m) => m.id)).toEqual([
      'licence-seat-not-assigned',
    ]);
    expect(build([], 'no-such-scenario').missions.some((m) => m.recommended)).toBe(false);
    expect(build([], null).missions.some((m) => m.recommended)).toBe(false);
  });

  it('come out the same whatever order the scenarios were listed in', () => {
    const sessions = [fullCall(LOCKED_OUT, 4), runningCall(ESCALATED)];
    const expected = buildAtlas(CATALOGUE, sessions, ESCALATED);
    for (const seed of [1, 2, 3, 4, 5]) {
      expect(buildAtlas(shuffled(CATALOGUE, seed), sessions, ESCALATED)).toEqual(expected);
    }
  });

  it('settle two with the same title and difficulty by id, not by listing order', () => {
    const a = makeScenario({ id: 'a-first', title: 'Same', issueType: 'how-to' });
    const b = makeScenario({ id: 'b-second', title: 'Same', issueType: 'how-to' });
    expect(buildAtlas([b, a], [], null).missions.map((m) => m.id)).toEqual(['a-first', 'b-second']);
    expect(buildAtlas([a, b], [], null).missions.map((m) => m.id)).toEqual(['a-first', 'b-second']);
  });

  it('appear once even if a scenario is listed twice', () => {
    const model = buildAtlas([...CATALOGUE, CATALOGUE[0] as PublicScenarioDTO], [], null);
    expect(model.missions).toHaveLength(13);
  });

  it('leave out a scenario whose issue type the vocabulary does not know', () => {
    const stray = makeScenario({ id: 'stray', issueType: 'something-new' as never });
    const model = buildAtlas([...CATALOGUE, stray], [], null);
    expect(model.missions.map((m) => m.id)).not.toContain('stray');
    expect(model.missions).toHaveLength(13);
  });

  it('do not change what they are built from, and do not share its arrays', () => {
    const scenarios = structuredClone(CATALOGUE) as PublicScenarioDTO[];
    const sessions = [fullCall(LOCKED_OUT, 4)];
    const before = JSON.stringify([scenarios, sessions]);
    const model = buildAtlas(scenarios, sessions, LOCKED_OUT);
    expect(JSON.stringify([scenarios, sessions])).toBe(before);
    const mission = missionOf(model, LOCKED_OUT);
    mission.tags.push('changed');
    mission.persona.name = 'Changed';
    expect(scenarios.find((s) => s.id === LOCKED_OUT)?.tags).not.toContain('changed');
    expect(scenarios.find((s) => s.id === LOCKED_OUT)?.persona.name).toBe('Maya Okafor');
  });

  it('carry only what is shown about a scenario, never anything a server might add', () => {
    const leaky = {
      ...makeScenario({ id: 'leaky' }),
      hiddenFacts: ['SECRET-FACT-7'],
      evaluatorNotes: 'RUBRIC-NOTE',
      persona: {
        name: 'A',
        role: 'B',
        organisation: 'C',
        background: 'PRIVATE-BACKGROUND',
        voice: 'PRIVATE-VOICE',
      },
    } as unknown as PublicScenarioDTO;
    const model = buildAtlas([leaky], [], null);
    const json = JSON.stringify(model);
    for (const secret of ['SECRET-FACT-7', 'RUBRIC-NOTE', 'PRIVATE-BACKGROUND', 'PRIVATE-VOICE']) {
      expect(json).not.toContain(secret);
    }
    expect(Object.keys(model.missions[0] as AtlasMission).sort()).toEqual(
      [
        'attempts',
        'best',
        'coachingFocus',
        'description',
        'difficulty',
        'family',
        'familyLabel',
        'focus',
        'id',
        'impact',
        'minutes',
        'persona',
        'rings',
        'recommended',
        'size',
        'stage',
        'start',
        'status',
        'summary',
        'tags',
        'title',
      ].sort(),
    );
  });
});

describe('describeMission', () => {
  it('reads as plain English: what it is, how demanding, where the trainee stands', () => {
    expect(missionOf(build(), LOCKED_OUT).description).toBe(
      'Locked out after a password reset. Access and Identity. Starter, low impact, customer starts calm, first contact, about 8 minutes. Not tried yet.',
    );
    expect(missionOf(build([fullCall(LOCKED_OUT, 4.1)]), LOCKED_OUT).description).toBe(
      'Locked out after a password reset. Access and Identity. Starter, low impact, customer starts calm, first contact, about 8 minutes. Completed, best score 4.1 of 5.',
    );
    expect(missionOf(build([runningCall(ESCALATED)]), ESCALATED).description).toBe(
      'Fourth contact, same failing uploads. Unexpected Behaviour. Challenge, high impact, customer starts angry, escalated case, about 15 minutes. Started, not completed yet.',
    );
  });

  it('writes a whole-number score without a decimal, and says what is suggested next', () => {
    const mission = missionOf(build([fullCall(LOCKED_OUT, 4)], LOCKED_OUT), LOCKED_OUT);
    expect(mission.description).toMatch(/Completed, best score 4 of 5\. Suggested next\.$/);
  });

  it('does not double the punctuation of a title and says "1 minute" in the singular', () => {
    const mission = {
      ...missionOf(build(), LOCKED_OUT),
      title: 'Why is it slow?',
      minutes: 1,
    };
    expect(describeMission(mission)).toBe(
      'Why is it slow? Access and Identity. Starter, low impact, customer starts calm, first contact, about 1 minute. Not tried yet.',
    );
  });

  it('is what every mission carries, and never mentions anything hidden or how calls are judged', () => {
    const histories = [
      [],
      [runningCall(LOCKED_OUT)],
      [fullCall(LOCKED_OUT, 3.3)],
      [fullCall(LOCKED_OUT, null)],
      [endedEarlyCall(LOCKED_OUT)],
    ];
    for (const history of histories) {
      for (const mission of build(history, LOCKED_OUT).missions) {
        expect(mission.description).toBe(describeMission(mission));
        expect(mission.description).not.toMatch(/hidden|criteri|rubric|evaluator|secret/i);
        expect(mission.description.trim()).toBe(mission.description);
      }
    }
  });
});

describe('the lens', () => {
  const model = build([fullCall(LOCKED_OUT, 4), runningCall(ESCALATED)]);
  const lens = (patch: Partial<AtlasLens>): AtlasLens => ({ ...EMPTY_LENS, ...patch });
  const ids = (patch: Partial<AtlasLens>) => [...applyLens(model, lens(patch)).matches].sort();

  it('lights every mission when it is empty, and says so', () => {
    expect(isLensEmpty(EMPTY_LENS)).toBe(true);
    expect(isLensEmpty(lens({ query: '   ' }))).toBe(true);
    expect(isLensEmpty(lens({ query: '\u0308' }))).toBe(true);
    const all = applyLens(model, EMPTY_LENS);
    expect(all.count).toBe(13);
    expect(all.matches.size).toBe(13);
    expect(isLensEmpty(lens({ query: 'a' }))).toBe(false);
    expect(isLensEmpty(lens({ difficulty: 'starter' }))).toBe(false);
    expect(isLensEmpty(lens({ impact: 'low' }))).toBe(false);
    expect(isLensEmpty(lens({ family: 'how-to' }))).toBe(false);
    expect(isLensEmpty(lens({ status: 'new' }))).toBe(false);
  });

  it('searches the title, summary, customer, tags and family label', () => {
    expect(ids({ query: 'password' })).toEqual([LOCKED_OUT]); // title and tag
    expect(ids({ query: 'staff portal' })).toEqual([LOCKED_OUT]); // summary
    expect(ids({ query: 'okafor' })).toEqual([LOCKED_OUT]); // customer name
    expect(ids({ query: 'front-desk' })).toEqual([LOCKED_OUT]); // customer role
    expect(ids({ query: 'litware' })).toEqual([ESCALATED]); // organisation
    expect(ids({ query: 'repeat contact' })).toEqual([ESCALATED]); // tag
    expect(ids({ query: 'identity' })).toEqual(
      [LOCKED_OUT, 'team-cannot-open-shared-workspace'].sort(),
    ); // family label, which no scenario text contains
  });

  it('ignores case and accents, and needs every word, wherever each one is found', () => {
    expect(ids({ query: 'MAYA' })).toEqual([LOCKED_OUT]);
    expect(ids({ query: '  fráser  ' })).toEqual(['cannot-find-export-feature']);
    expect(ids({ query: 'CARMEN FRASER' })).toEqual(['cannot-find-export-feature']);
    expect(ids({ query: 'invoice proseware' })).toEqual(['invoice-shock-and-cancellation-threat']);
    expect(ids({ query: 'password invoice' })).toEqual([]);
    expect(ids({ query: 'zzzz' })).toEqual([]);
  });

  it('filters by difficulty, impact, family and status, and combines them with the search', () => {
    expect(ids({ difficulty: 'starter' })).toHaveLength(4);
    expect(ids({ impact: 'high' })).toHaveLength(4);
    expect(ids({ family: 'slow-performance' })).toHaveLength(3);
    expect(ids({ status: 'completed' })).toEqual([LOCKED_OUT]);
    expect(ids({ status: 'attempted' })).toEqual([ESCALATED]);
    expect(ids({ status: 'new' })).toHaveLength(11);
    expect(ids({ family: 'slow-performance', difficulty: 'challenge' })).toEqual([
      'confident-but-incorrect-diagnosis',
    ]);
    expect(ids({ family: 'slow-performance', query: 'dashboard' })).toEqual([
      'slow-dashboard-with-workaround',
    ]);
    expect(ids({ family: 'how-to', impact: 'high' })).toEqual([]);
    expect(ids({ family: 'not-a-family' })).toEqual([]);
  });

  it('counts what it lights', () => {
    const result = applyLens(model, lens({ difficulty: 'standard' }));
    expect(result.count).toBe(result.matches.size);
    expect(result.count).toBe(5);
  });

  it('only ever narrows: adding a word or a filter never lights anything new', () => {
    const random = seeded(77);
    const words = ['order', 'slow', 'invoice', 'team', 'report', 'the', 'a', 'customer', 'lucerne'];
    for (let trial = 0; trial < 120; trial += 1) {
      const base = lens({
        query: random.pick(words),
        difficulty: random.chance(0.3) ? random.pick(DIFFICULTIES) : null,
      });
      const narrower = {
        ...base,
        query: `${base.query} ${random.pick(words)}`,
        impact: random.chance(0.5) ? random.pick(IMPACTS) : base.impact,
      };
      const wide = applyLens(model, base).matches;
      for (const id of applyLens(model, narrower).matches) expect(wide.has(id)).toBe(true);
    }
  });

  it('treats several words as the overlap of each one on its own', () => {
    const intersect = (a: Set<string>, b: Set<string>) => new Set([...a].filter((x) => b.has(x)));
    const pairs = [
      ['slow', 'order'],
      ['report', 'manager'],
      ['customer', 'lucerne'],
      ['sign-in', 'single'],
    ] as const;
    for (const [one, two] of pairs) {
      const both = applyLens(model, lens({ query: `${one} ${two}` })).matches;
      const expected = intersect(
        applyLens(model, lens({ query: one })).matches,
        applyLens(model, lens({ query: two })).matches,
      );
      expect(both).toEqual(expected);
    }
  });

  it('does not depend on the order of the missions', () => {
    const reversed = { ...model, missions: [...model.missions].reverse() };
    for (const query of ['slow', 'order report', 'identity']) {
      expect(applyLens(reversed, lens({ query })).matches).toEqual(
        applyLens(model, lens({ query })).matches,
      );
    }
  });
});

describe('a catalogue of any size', () => {
  it('builds for 1, 2 and 40 scenarios, and every mission has a description', () => {
    for (const size of [1, 2, 40]) {
      const scenarios = syntheticCatalogue(size, size);
      const model = buildAtlas(scenarios, [], null);
      expect(model.missions).toHaveLength(size);
      expect(new Set(model.missions.map((m) => m.id)).size).toBe(size);
      expect(model.families.reduce((n, f) => n + f.missionIds.length, 0)).toBe(size);
      expect(model.missions.every((m) => m.description.length > 20)).toBe(true);
    }
  });
});
