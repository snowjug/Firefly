import { beforeEach, describe, expect, it } from 'vitest';
import type { PublicScenarioDTO, RewardsDTO } from './api.ts';
import type { CoachingReport } from './report.ts';
import {
  BADGE_DEFINITIONS,
  computeRewards,
  REWARD_RULES,
  type RewardCall,
  type RewardMentorReview,
  type RewardOptions,
} from './rewards.ts';
import {
  DIMENSION_IDS,
  ISSUE_TYPES,
  type Difficulty,
  type DimensionId,
  type IssueType,
} from './vocab.ts';

// ---- Builders -----------------------------------------------------------------------------------

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
// Monday 2 March 2026, 10:00 UTC. `day` counts days from that Monday.
const MONDAY = Date.UTC(2026, 2, 2, 10, 0, 0);
const iso = (day: number, hour = 10, minute = 0) =>
  new Date(MONDAY + day * DAY + (hour - 10) * HOUR + minute * 60_000).toISOString();

type Sufficiency = 'sufficient' | 'limited' | 'insufficient';
type FactStatus = 'discovered' | 'partial' | 'missed';

interface FactOptions {
  id: string;
  status?: FactStatus;
  label?: string;
  turn?: number | null;
  question?: string | null;
}

interface ReportOptions {
  scores?: Partial<Record<DimensionId, number>>;
  quotes?: Partial<Record<DimensionId, { turnIndex: number; quote: string }[]>>;
  sufficiency?: Partial<Record<DimensionId, Sufficiency>>;
  status?: 'completed' | 'ended-early';
  evidence?: Sufficiency;
  traineeTurns?: number;
  facts?: FactOptions[];
  discovery?: { found: number; total: number };
  journey?: { turnIndex: number; temperature: number; delta: number; quote: string | null }[];
}

function report(o: ReportOptions = {}): CoachingReport {
  const facts = o.facts ?? [];
  const found = facts.filter((f) => (f.status ?? 'discovered') === 'discovered').length;
  return {
    version: 1,
    generatedAt: '2026-03-02T10:00:00.000Z',
    evaluator: { kind: 'rules', name: 'test', version: '1', providerLabel: 'test' },
    completion: {
      status: o.status ?? 'completed',
      traineeTurns: o.traineeTurns ?? 8,
      evidence: o.evidence ?? 'sufficient',
      note: null,
    },
    summary: { overall: 'ok', overallScore: 3, coachingFocus: [] },
    dimensions: DIMENSION_IDS.map((id) => ({
      id,
      score: o.scores?.[id] ?? 3,
      label: 'Developing' as const,
      rationale: 'r',
      evidence: o.quotes?.[id] ?? [{ turnIndex: 2, quote: `quote for ${id}` }],
      sufficiency: o.sufficiency?.[id] ?? 'sufficient',
      guidance: 'g',
    })),
    strengths: [],
    improvements: [],
    discovery: {
      results: facts.map((f) => ({
        factId: f.id,
        label: f.label ?? `Fact ${f.id}`,
        importance: 'important' as const,
        status: f.status ?? 'discovered',
        revealedAtTurn: f.turn === undefined ? 4 : f.turn,
        revealingQuestion: f.question === undefined ? 'When did it start?' : f.question,
        whatWasHidden: 'x',
        betterQuestion: 'y',
        consequence: 'z',
      })),
      found: o.discovery?.found ?? found,
      partial: 0,
      missed: 0,
      total: o.discovery?.total ?? facts.length,
    },
    journey: {
      points: (o.journey ?? []).map((p, i, all) => ({
        turnIndex: p.turnIndex,
        temperature: p.temperature,
        band: 'calm',
        kind:
          i === 0
            ? ('start' as const)
            : i === all.length - 1
              ? ('end' as const)
              : ('turn' as const),
        delta: p.delta,
        reason: null,
        quote: p.quote,
      })),
      start: 0,
      end: 0,
      peak: 0,
      lowest: 0,
    },
    curveball: null,
    nextPractice: {
      dimension: 'clarity',
      recommendation: 'r',
      suggestedDifficulty: 'standard',
      suggestedScenarioId: null,
      suggestedScenarioTitle: null,
    },
    trainingNote: 'n',
  };
}

interface CallOptions extends ReportOptions {
  id?: string;
  scenario?: string;
  family?: IssueType;
  difficulty?: Difficulty;
  /** When the call ended. Calls made without one end a minute apart on the first Monday. */
  at?: string;
  endedAt?: string | null;
  startedAt?: string;
  sample?: boolean;
  reviews?: RewardMentorReview[];
}

let sequence = 0;
beforeEach(() => {
  sequence = 0;
});

function call(o: CallOptions = {}): RewardCall {
  sequence += 1;
  const stamp = o.at ?? iso(0, 10, sequence);
  const scenario = o.scenario ?? 'scenario-a';
  return {
    sessionId: o.id ?? `call-${String(sequence).padStart(3, '0')}`,
    scenarioId: scenario,
    scenarioTitle: `Title of ${scenario}`,
    issueType: o.family ?? 'sign-in-access',
    difficulty: o.difficulty ?? 'standard',
    startedAt: o.startedAt ?? new Date(Date.parse(stamp) - 10 * 60_000).toISOString(),
    endedAt: o.endedAt === undefined ? stamp : o.endedAt,
    isSample: o.sample ?? false,
    report: report(o),
    mentorReviews: o.reviews ?? [],
  };
}

function scenario(
  id: string,
  issueType: IssueType,
  difficulty: Difficulty,
  minutes: number,
  focus: DimensionId[] = ['clarity'],
): PublicScenarioDTO {
  return {
    id,
    version: 1,
    title: `Scenario ${id}`,
    summary: 's',
    tags: [],
    estimatedMinutes: minutes,
    issueType,
    impact: 'low',
    startingTemperature: 'calm',
    proficiency: 'intermediate',
    style: 'talkative',
    callStage: 'first-contact',
    difficulty,
    persona: { name: 'P', role: 'r', organisation: 'o' },
    brief: { situation: 's', goal: 'g', groundRules: [] },
    expectedDiscoveryAreas: [],
    coachingFocus: focus,
    curveballOptions: [],
    spotlight: false,
    synthetic: true,
  };
}

const LIBRARY: PublicScenarioDTO[] = [
  scenario('signin-standard', 'sign-in-access', 'standard', 10),
  scenario('signin-starter', 'sign-in-access', 'starter', 8),
  scenario('outage-challenge', 'service-outage', 'challenge', 12),
  scenario('slow-starter', 'slow-performance', 'starter', 9, ['closing']),
  scenario('missing-standard', 'data-missing', 'standard', 10),
  scenario('billing-starter', 'billing-licence', 'starter', 9),
  scenario('howto-starter', 'how-to', 'starter', 7),
  scenario('howto-challenge', 'how-to', 'challenge', 14),
  scenario('broken-standard', 'feature-not-working', 'standard', 12),
];

const NOW = new Date(iso(0, 12));

function rewards(calls: readonly RewardCall[], options: Partial<RewardOptions> = {}): RewardsDTO {
  return computeRewards(
    { calls },
    { tzOffsetMinutes: 0, now: NOW, scenarios: LIBRARY, ...options },
  );
}

const entry = (r: RewardsDTO, id: string) => r.ledger.find((e) => e.id === id);
const entriesFor = (r: RewardsDTO, ruleId: string) => r.ledger.filter((e) => e.ruleId === ruleId);
const pointsById = (r: RewardsDTO, ruleId: string) =>
  Object.fromEntries(entriesFor(r, ruleId).map((e) => [e.id, e.points]));
const badge = (r: RewardsDTO, id: string) => {
  const found = r.badges.find((b) => b.id === id);
  if (!found) throw new Error(`no badge ${id}`);
  return found;
};
const challenge = (r: RewardsDTO, id: string) => r.challenges.find((c) => c.id === id);

const all = (score: number) =>
  Object.fromEntries(DIMENSION_IDS.map((id) => [id, score])) as Record<DimensionId, number>;

const OWNER_QUOTE = [{ turnIndex: 6, quote: 'I will call you at nine tomorrow.' }];
const RECOVERY = [
  { turnIndex: 0, temperature: 40, delta: 0, quote: null },
  { turnIndex: 2, temperature: 78, delta: 38, quote: null },
  { turnIndex: 4, temperature: 52, delta: -26, quote: 'I can hear how stressful this is.' },
  { turnIndex: 6, temperature: 30, delta: -22, quote: 'I will call you at nine.' },
];

const review = (
  scores: Partial<Record<DimensionId, number>>,
  at = iso(1),
  source: 'mentor' | 'sample' = 'mentor',
): RewardMentorReview => ({ source, at, scores });

// ---- Tests --------------------------------------------------------------------------------------

describe('with no practice yet', () => {
  it('starts at Foundation with nothing earned and a clear way forward', () => {
    const r = rewards([]);
    expect(r.points).toBe(0);
    expect(r.level).toEqual({
      id: 'foundation',
      index: 1,
      name: 'Foundation',
      minPoints: 0,
      minFamilies: 0,
    });
    expect(r.nextLevel).toMatchObject({ id: 'builder', pointsToGo: 150, familiesToGo: 2 });
    expect(r.levels.map((l) => l.id)).toEqual([
      'foundation',
      'builder',
      'practitioner',
      'confident-handler',
    ]);
    expect(r.families).toEqual({ practised: [], total: 7 });
    expect(r.streak).toEqual({ current: 0, best: 0, activeDays: 0, practisedToday: false });
    expect(r.ledger).toEqual([]);
    expect(r.rules).toHaveLength(7);
    expect(r.note).toMatch(/private/i);
    expect(r.note).toMatch(/never compared/i);
  });

  it('lists all six badges in order, each unearned with its criteria and a target', () => {
    const r = rewards([]);
    expect(r.badges.map((b) => b.id)).toEqual([
      'first-practice',
      'scope-detective',
      'de-escalator',
      'ownership-builder',
      'scenario-explorer',
      'consistency-streak',
    ]);
    for (const b of r.badges) {
      expect(b).toMatchObject({ earned: false, earnedAt: null, earnedInSessionId: null });
      expect(b.progress.current).toBe(0);
      expect(b.criteria.length).toBeGreaterThan(20);
    }
    expect(r.badges.map((b) => [b.progress.target, b.progress.unit])).toEqual([
      [1, 'scenarios'],
      [3, 'scenarios'],
      [1, 'calls'],
      [3, 'calls'],
      [4, 'families'],
      [3, 'days'],
    ]);
  });

  it('always offers the new-family, hidden-fact and another-day challenges', () => {
    const r = rewards([]);
    expect(r.challenges.map((c) => c.id)).toEqual([
      'try-new-family',
      'find-every-fact',
      'practise-again',
    ]);
    expect(challenge(r, 'try-new-family')).toMatchObject({
      status: 'active',
      progress: { current: 0, target: 7 },
      reward: '20 points',
      scenarioId: 'howto-starter',
    });
    expect(challenge(r, 'find-every-fact')).toMatchObject({
      status: 'active',
      progress: { current: 0, target: 3 },
      reward: 'Toward Scope Detective',
      scenarioId: 'howto-starter',
    });
    expect(challenge(r, 'practise-again')).toMatchObject({
      status: 'active',
      progress: { current: 0, target: 3 },
      reward: 'Toward Consistency Streak',
      scenarioId: null,
    });
  });
});

describe('which calls count', () => {
  it('gives a call that ended early nothing at all, however strong it looks', () => {
    const strong = call({
      status: 'ended-early',
      scores: all(5),
      quotes: { 'ownership-next-steps': OWNER_QUOTE },
      facts: [{ id: 'f1' }],
      journey: RECOVERY,
    });
    const r = rewards([strong]);
    expect(r.points).toBe(0);
    expect(r.ledger).toEqual([]);
    expect(r.families.practised).toEqual([]);
    expect(r.streak.activeDays).toBe(0);
    expect(r.badges.every((b) => !b.earned && b.progress.current === 0)).toBe(true);
  });

  it('ignores a call without enough evidence but accepts limited evidence', () => {
    expect(rewards([call({ evidence: 'insufficient' })]).points).toBe(0);
    const limited = rewards([call({ evidence: 'limited' })]);
    expect(entriesFor(limited, 'complete-scenario')).toHaveLength(1);
  });

  it('ignores sample calls, including their sample reviews', () => {
    const sample = call({ sample: true, facts: [{ id: 'f1' }], reviews: [review(all(3))] });
    const r = rewards([sample]);
    expect(r.points).toBe(0);
    expect(r.ledger).toEqual([]);
    expect(r.badges.some((b) => b.earned)).toBe(false);
  });

  it('ignores a call whose end and start times cannot be read', () => {
    const broken = call({ endedAt: 'sometime', startedAt: 'earlier' });
    expect(rewards([broken]).points).toBe(0);
  });

  it('falls back to the start time when a call has no end time', () => {
    const open = call({ endedAt: null, startedAt: iso(2, 9, 15) });
    const r = rewards([open]);
    expect(entry(r, `complete-scenario:${open.sessionId}`)?.at).toBe(iso(2, 9, 15));
  });

  it('pays a call once even if the same call is passed twice', () => {
    const owned = call({ id: 'same', scores: { 'ownership-next-steps': 4 } });
    const r = rewards([owned, { ...owned }]);
    expect(entriesFor(r, 'complete-scenario')).toHaveLength(1);
    expect(r.points).toBe(85);
    // Nothing that counts calls (badges, streaks, progress) sees the repeat either.
    expect(badge(r, 'ownership-builder').progress.current).toBe(1);
    expect(r.streak.activeDays).toBe(1);
  });

  it('takes calls in the order they ended, breaking ties by id', () => {
    const at = iso(0, 11);
    const third = call({ id: 'c', at });
    const first = call({ id: 'a', at });
    const second = call({ id: 'b', at });
    for (const order of [
      [third, first, second],
      [second, third, first],
      [first, second, third],
    ]) {
      expect(pointsById(rewards(order), 'complete-scenario')).toEqual({
        'complete-scenario:a': 50,
        'complete-scenario:b': 50,
        'complete-scenario:c': 10,
      });
    }
  });
});

describe('complete-scenario', () => {
  it('pays 50 for the first two completions of a scenario and 10 for repeats', () => {
    const calls = [1, 2, 3, 4].map((n) =>
      call({ id: `a${n}`, scenario: 'scenario-a', at: iso(n) }),
    );
    expect(pointsById(rewards(calls), 'complete-scenario')).toEqual({
      'complete-scenario:a1': 50,
      'complete-scenario:a2': 50,
      'complete-scenario:a3': 10,
      'complete-scenario:a4': 10,
    });
  });

  it('counts repeats for each scenario separately', () => {
    const calls = [
      call({ id: 'a1', scenario: 'a', at: iso(0) }),
      call({ id: 'a2', scenario: 'a', at: iso(1) }),
      call({ id: 'b1', scenario: 'b', at: iso(2) }),
      call({ id: 'a3', scenario: 'a', at: iso(3) }),
    ];
    expect(pointsById(rewards(calls), 'complete-scenario')).toEqual({
      'complete-scenario:a1': 50,
      'complete-scenario:a2': 50,
      'complete-scenario:b1': 50,
      'complete-scenario:a3': 10,
    });
  });

  it('does not count a call that ended early towards the two full-value completions', () => {
    const calls = [
      call({ id: 'early', status: 'ended-early', at: iso(0) }),
      call({ id: 'a1', at: iso(1) }),
      call({ id: 'a2', at: iso(2) }),
    ];
    expect(pointsById(rewards(calls), 'complete-scenario')).toEqual({
      'complete-scenario:a1': 50,
      'complete-scenario:a2': 50,
    });
  });

  it('says plainly why it was awarded, and why a repeat is worth less', () => {
    const calls = [1, 2, 3].map((n) => call({ id: `a${n}`, at: iso(n) }));
    const r = rewards(calls);
    expect(entry(r, 'complete-scenario:a1')).toMatchObject({
      title: 'Completed a full scenario',
      sessionId: 'a1',
      scenarioTitle: 'Title of scenario-a',
      evidence: null,
    });
    expect(entry(r, 'complete-scenario:a3')?.reason).toMatch(/repeats earn 10 points/);
  });
});

describe('hidden-fact', () => {
  it('pays 10 for a discovered fact and nothing for a partial or missed one', () => {
    const r = rewards([
      call({
        id: 'one',
        facts: [
          {
            id: 'f1',
            label: 'Phone still using the old password',
            turn: 4,
            question: 'Is it on your phone?',
          },
          { id: 'f2', status: 'partial' },
          { id: 'f3', status: 'missed', turn: null, question: null },
        ],
      }),
    ]);
    expect(entriesFor(r, 'hidden-fact').map((e) => e.id)).toEqual(['hidden-fact:scenario-a:f1']);
    expect(entry(r, 'hidden-fact:scenario-a:f1')).toMatchObject({
      points: 10,
      title: 'Found: Phone still using the old password',
      sessionId: 'one',
      evidence: { turnIndex: 4, quote: 'Is it on your phone?' },
    });
  });

  it('pays each fact once, ever, and pays a partial fact when it is later found in full', () => {
    const r = rewards([
      call({ id: 'one', at: iso(0), facts: [{ id: 'f1' }, { id: 'f2', status: 'partial' }] }),
      call({ id: 'two', at: iso(1), facts: [{ id: 'f1' }, { id: 'f2' }] }),
      call({ id: 'three', at: iso(2), facts: [{ id: 'f1' }, { id: 'f2' }] }),
    ]);
    expect(
      entriesFor(r, 'hidden-fact')
        .map((e) => [e.id, e.sessionId])
        .sort(),
    ).toEqual([
      ['hidden-fact:scenario-a:f1', 'one'],
      ['hidden-fact:scenario-a:f2', 'two'],
    ]);
  });

  it('treats the same fact id in another scenario as a different fact', () => {
    const r = rewards([
      call({ scenario: 'a', at: iso(0), facts: [{ id: 'f1' }] }),
      call({ scenario: 'b', at: iso(1), facts: [{ id: 'f1' }] }),
    ]);
    expect(
      entriesFor(r, 'hidden-fact')
        .map((e) => e.id)
        .sort(),
    ).toEqual(['hidden-fact:a:f1', 'hidden-fact:b:f1']);
  });

  it('pays a fact once even if one report lists it twice', () => {
    const r = rewards([call({ facts: [{ id: 'f1' }, { id: 'f1' }] })]);
    expect(entriesFor(r, 'hidden-fact')).toHaveLength(1);
  });

  it('does not pay for a fact found in a call that ended early, so a full call can still earn it', () => {
    const r = rewards([
      call({ id: 'early', status: 'ended-early', at: iso(0), facts: [{ id: 'f1' }] }),
      call({ id: 'full', at: iso(1), facts: [{ id: 'f1' }] }),
    ]);
    expect(entry(r, 'hidden-fact:scenario-a:f1')?.sessionId).toBe('full');
  });
});

describe('owner-and-update', () => {
  const owned = (o: CallOptions = {}) =>
    call({
      scores: { 'ownership-next-steps': 4 },
      quotes: { 'ownership-next-steps': OWNER_QUOTE },
      ...o,
    });

  it('pays 10 for a score of 4 or more backed by sufficient evidence and a quote', () => {
    const one = owned({ id: 'one' });
    const r = rewards([one]);
    expect(entry(r, 'owner-and-update:one')).toMatchObject({
      points: 10,
      title: 'Clear owner and next update',
      evidence: { turnIndex: 6, quote: 'I will call you at nine tomorrow.' },
    });
    expect(
      entriesFor(rewards([owned({ scores: { 'ownership-next-steps': 5 } })]), 'owner-and-update'),
    ).toHaveLength(1);
  });

  it('is not paid without the score, the sufficiency or the quote', () => {
    const none = (o: CallOptions) => entriesFor(rewards([owned(o)]), 'owner-and-update');
    expect(none({ scores: { 'ownership-next-steps': 3 } })).toHaveLength(0);
    expect(none({ sufficiency: { 'ownership-next-steps': 'limited' } })).toHaveLength(0);
    expect(none({ sufficiency: { 'ownership-next-steps': 'insufficient' } })).toHaveLength(0);
    expect(none({ quotes: { 'ownership-next-steps': [] } })).toHaveLength(0);
    expect(
      none({ quotes: { 'ownership-next-steps': [{ turnIndex: 2, quote: '  ' }] } }),
    ).toHaveLength(0);
  });

  it('quotes the first real quote and pays once per call', () => {
    const r = rewards([
      owned({
        id: 'one',
        quotes: {
          'ownership-next-steps': [
            { turnIndex: 3, quote: 'I will own this.' },
            { turnIndex: 9, quote: 'Expect my call at nine.' },
          ],
        },
      }),
    ]);
    const paid = entriesFor(r, 'owner-and-update');
    expect(paid).toHaveLength(1);
    expect(paid[0]?.evidence).toEqual({ turnIndex: 3, quote: 'I will own this.' });
  });

  it('is not paid for a call that ended early', () => {
    expect(entriesFor(rewards([owned({ status: 'ended-early' })]), 'owner-and-update')).toEqual([]);
  });
});

describe('skill-improvement', () => {
  const standard = (id: string, day: number, scores: Partial<Record<DimensionId, number>>) =>
    call({ id, difficulty: 'standard', at: iso(day), scores });

  it('needs two earlier calls at the same difficulty', () => {
    const one = rewards([standard('a', 0, { clarity: 2 }), standard('b', 1, { clarity: 4 })]);
    expect(entriesFor(one, 'skill-improvement')).toEqual([]);
    const two = rewards([
      standard('a', 0, { clarity: 2 }),
      standard('b', 1, { clarity: 3 }),
      standard('c', 2, { clarity: 4 }),
    ]);
    expect(entry(two, 'skill-improvement:c')).toMatchObject({
      points: 15,
      sessionId: 'c',
      title: 'Lifted a skill: Clarity',
      reason: 'Clarity 4 vs your recent Standard average 2.5.',
    });
    expect(entriesFor(two, 'skill-improvement')).toHaveLength(1);
  });

  it('compares with the mean of the previous three calls only', () => {
    const calls = [
      standard('a', 0, { clarity: 5 }),
      standard('b', 1, { clarity: 2 }),
      standard('c', 2, { clarity: 2 }),
      standard('d', 3, { clarity: 2 }),
      standard('e', 4, { clarity: 3 }),
    ];
    const r = rewards(calls);
    // The oldest call (a 5) is outside the window, so the baseline is 2.0 and 3 is a full point up.
    expect(entry(r, 'skill-improvement:e')?.reason).toBe(
      'Clarity 3 vs your recent Standard average 2.0.',
    );

    // All three of the previous calls count, not just the latest two: (1 + 4 + 4) / 3 is 3.0.
    const wider = rewards([
      standard('a', 0, { clarity: 1 }),
      standard('b', 1, { clarity: 4 }),
      standard('c', 2, { clarity: 4 }),
      standard('d', 3, { clarity: 4 }),
    ]);
    expect(entry(wider, 'skill-improvement:d')?.reason).toBe(
      'Clarity 4 vs your recent Standard average 3.0.',
    );
  });

  it('compares only with calls at the same difficulty', () => {
    const calls = [
      standard('a', 0, { clarity: 4 }),
      call({ id: 'x', difficulty: 'starter', at: iso(1), scores: { clarity: 1 } }),
      standard('b', 2, { clarity: 4 }),
      call({ id: 'y', difficulty: 'starter', at: iso(3), scores: { clarity: 1 } }),
      standard('c', 4, { clarity: 4 }),
    ];
    expect(entriesFor(rewards(calls), 'skill-improvement')).toEqual([]);

    const harder = rewards([
      standard('a', 0, { clarity: 1 }),
      standard('b', 1, { clarity: 1 }),
      call({ id: 'c', difficulty: 'challenge', at: iso(2), scores: { clarity: 5 } }),
    ]);
    expect(entriesFor(harder, 'skill-improvement')).toEqual([]);
  });

  it('needs a full point above the baseline and a score of at least 3', () => {
    const earns = (before: number[], now: number, skill: DimensionId = 'clarity') => {
      const calls = [
        ...before.map((score, i) => standard(`p${i}`, i, { [skill]: score })),
        standard('now', before.length, { [skill]: now }),
      ];
      return entriesFor(rewards(calls), 'skill-improvement').length === 1;
    };
    expect(earns([2, 2], 3)).toBe(true); // exactly one point up
    expect(earns([3, 4], 4)).toBe(false); // only half a point up
    expect(earns([3, 4], 5)).toBe(true);
    expect(earns([1, 1], 2)).toBe(false); // a point up, but still below 3
    expect(earns([1, 1], 3)).toBe(true);
    expect(earns([4, 4], 4)).toBe(false);
    expect(earns([5, 5], 3)).toBe(false); // lower than before earns nothing and costs nothing
  });

  it('pays once per call, for the skill that rose furthest, ties going to report order', () => {
    const base = [
      standard('a', 0, { clarity: 2, closing: 2, 'scoping-discovery': 2 }),
      standard('b', 1, { clarity: 2, closing: 2, 'scoping-discovery': 2 }),
    ];
    const tie = rewards([
      ...base,
      standard('c', 2, { clarity: 4, closing: 4, 'scoping-discovery': 4 }),
    ]);
    expect(entriesFor(tie, 'skill-improvement')).toHaveLength(1);
    expect(entry(tie, 'skill-improvement:c')?.title).toBe('Lifted a skill: Scoping & Discovery');

    const biggest = rewards([...base, standard('c', 2, { clarity: 4, closing: 5 })]);
    expect(entry(biggest, 'skill-improvement:c')?.title).toBe('Lifted a skill: Closing');
    expect(entry(biggest, 'skill-improvement:c')?.reason).toBe(
      'Closing 5 vs your recent Standard average 2.0.',
    );
  });

  it('names the full skill and difficulty, and quotes the evaluator when it can', () => {
    const r = rewards([
      call({ id: 'a', difficulty: 'challenge', at: iso(0), scores: { 'ownership-next-steps': 3 } }),
      call({ id: 'b', difficulty: 'challenge', at: iso(1), scores: { 'ownership-next-steps': 3 } }),
      call({
        id: 'c',
        difficulty: 'challenge',
        at: iso(2),
        scores: { 'ownership-next-steps': 4 },
        quotes: { 'ownership-next-steps': OWNER_QUOTE },
      }),
    ]);
    expect(entry(r, 'skill-improvement:c')).toMatchObject({
      reason: 'Ownership & Next Steps 4 vs your recent Challenge average 3.0.',
      evidence: { turnIndex: 6, quote: 'I will call you at nine tomorrow.' },
    });
  });

  it('is not paid for a call that ended early, and such a call is not part of any baseline', () => {
    const r = rewards([
      standard('a', 0, { clarity: 2 }),
      call({
        id: 'early',
        status: 'ended-early',
        difficulty: 'standard',
        at: iso(1),
        scores: { clarity: 2 },
      }),
      standard('b', 2, { clarity: 4 }),
    ]);
    expect(entriesFor(r, 'skill-improvement')).toEqual([]);
  });
});

describe('new-scenario-family', () => {
  it('pays 20 once for each family, on the first full call in it', () => {
    const r = rewards([
      call({ id: 'a', scenario: 'a', family: 'billing-licence', at: iso(0) }),
      call({ id: 'b', scenario: 'b', family: 'billing-licence', at: iso(1) }),
      call({ id: 'c', scenario: 'c', family: 'how-to', at: iso(2) }),
    ]);
    expect(
      entriesFor(r, 'new-scenario-family')
        .map((e) => [e.id, e.sessionId])
        .sort(),
    ).toEqual([
      ['new-scenario-family:billing-licence', 'a'],
      ['new-scenario-family:how-to', 'c'],
    ]);
    expect(entry(r, 'new-scenario-family:billing-licence')).toMatchObject({
      points: 20,
      title: 'First call in a new family: Billing or licence question',
    });
    expect(r.families).toEqual({ practised: ['billing-licence', 'how-to'], total: 7 });
  });

  it('does not count a family that was only tried in a call that ended early', () => {
    const r = rewards([
      call({ id: 'early', family: 'how-to', status: 'ended-early', at: iso(0) }),
      call({ id: 'full', family: 'how-to', at: iso(1) }),
    ]);
    expect(entry(r, 'new-scenario-family:how-to')?.sessionId).toBe('full');
  });

  it('lists the families in the library order, not the order they were tried', () => {
    const r = rewards([
      call({ scenario: 'a', family: 'feature-not-working', at: iso(0) }),
      call({ scenario: 'b', family: 'sign-in-access', at: iso(1) }),
    ]);
    expect(r.families.practised).toEqual(['sign-in-access', 'feature-not-working']);
  });
});

describe('practice-day', () => {
  it('pays 5 for each calendar day with a full call, however many calls that day', () => {
    const r = rewards([
      call({ id: 'a', scenario: 'a', at: iso(0, 9) }),
      call({ id: 'b', scenario: 'b', at: iso(0, 11) }),
      call({ id: 'c', scenario: 'c', at: iso(0, 15) }),
      call({ id: 'd', scenario: 'd', at: iso(3, 9) }),
    ]);
    expect(
      entriesFor(r, 'practice-day')
        .map((e) => e.id)
        .sort(),
    ).toEqual(['practice-day:2026-03-02', 'practice-day:2026-03-05']);
    expect(entry(r, 'practice-day:2026-03-02')).toMatchObject({
      points: 5,
      sessionId: null,
      scenarioTitle: null,
      title: 'Practised on 2 Mar',
      at: iso(0, 9),
      evidence: null,
    });
    expect(entry(r, 'practice-day:2026-03-05')?.title).toBe('Practised on 5 Mar');
    expect(entry(r, 'practice-day:2026-03-05')?.reason).toContain('5 Mar 2026');
  });

  it('never takes anything away for a missed day', () => {
    const together = rewards([
      call({ id: 'a', scenario: 'a', at: iso(0) }),
      call({ id: 'b', scenario: 'b', at: iso(1) }),
    ]);
    const apart = rewards([
      call({ id: 'a', scenario: 'a', at: iso(0) }),
      call({ id: 'b', scenario: 'b', at: iso(60) }),
    ]);
    expect(apart.points).toBe(together.points);
    expect(apart.ledger.map((e) => e.points).sort()).toEqual(
      together.ledger.map((e) => e.points).sort(),
    );
  });

  it('puts a call on the learner-local day using the time zone offset', () => {
    const late = call({ at: iso(0, 23, 30) }); // 23:30 UTC on Monday
    const days = (tzOffsetMinutes: number) =>
      entriesFor(rewards([late], { tzOffsetMinutes }), 'practice-day').map((e) => e.id);
    expect(days(0)).toEqual(['practice-day:2026-03-02']);
    // Already Tuesday in India (UTC+5:30, which JavaScript reports as -330).
    expect(days(-330)).toEqual(['practice-day:2026-03-03']);
    // Still Monday five hours behind UTC.
    expect(days(300)).toEqual(['practice-day:2026-03-02']);
    expect(days(-330)).not.toEqual(days(300));
  });

  it('can put calls either side of UTC midnight on the same local day, and the reverse', () => {
    const calls = [
      call({ id: 'a', scenario: 'a', at: iso(0, 23, 30) }),
      call({ id: 'b', scenario: 'b', at: iso(1, 0, 30) }),
    ];
    const days = (tzOffsetMinutes: number) =>
      entriesFor(rewards(calls, { tzOffsetMinutes }), 'practice-day').map((e) => e.id);
    expect(days(0)).toHaveLength(2);
    expect(days(-330)).toEqual(['practice-day:2026-03-03']);
    expect(days(60)).toEqual(['practice-day:2026-03-02']);
  });

  it('treats an offset that is not a whole number of minutes within a day as UTC', () => {
    const late = call({ at: iso(0, 23, 30) });
    const id = (tzOffsetMinutes: number) =>
      entriesFor(rewards([late], { tzOffsetMinutes }), 'practice-day')[0]?.id;
    expect(id(Number.NaN)).toBe('practice-day:2026-03-02');
    expect(id(-330.5)).toBe('practice-day:2026-03-02');
    expect(id(-1000)).toBe('practice-day:2026-03-02');
    expect(id(-840)).toBe('practice-day:2026-03-03');
  });
});

describe('mentor-confirmed', () => {
  it('pays 25 when a mentor is within a point of the rubric result on all six skills', () => {
    const one = call({
      id: 'one',
      reviews: [review({ ...all(3), 'opening-rapport': 4, clarity: 2 }, iso(1, 9))],
    });
    const r = rewards([one]);
    expect(entry(r, 'mentor-confirmed:one')).toMatchObject({
      points: 25,
      sessionId: 'one',
      title: 'A mentor confirmed the result',
      evidence: null,
      at: iso(1, 9),
    });
  });

  it('is not paid when any one skill is two points apart, or a score is missing', () => {
    const none = (scores: Partial<Record<DimensionId, number>>) =>
      entriesFor(rewards([call({ reviews: [review(scores)] })]), 'mentor-confirmed');
    expect(none({ ...all(3), closing: 5 })).toHaveLength(0);
    expect(none({ ...all(3), 'scoping-discovery': 1 })).toHaveLength(0);
    const { closing: _closing, ...missing } = all(3);
    expect(none(missing)).toHaveLength(0);
  });

  it('never counts a sample review', () => {
    const r = rewards([call({ reviews: [review(all(3), iso(1), 'sample')] })]);
    expect(entriesFor(r, 'mentor-confirmed')).toEqual([]);
  });

  it('is paid once per call, by any one review, and a later one that differs takes nothing away', () => {
    const agrees = review(all(4), iso(1, 9));
    const disagrees = review(all(5), iso(2, 9));
    const one = call({ id: 'one', reviews: [disagrees, agrees, review(all(3), iso(3))] });
    const r = rewards([one]);
    expect(entriesFor(r, 'mentor-confirmed')).toHaveLength(1);
    expect(entry(r, 'mentor-confirmed:one')?.at).toBe(iso(1, 9)); // the earliest that agrees
    const dissentOnly = rewards([call({ reviews: [disagrees] })]);
    expect(entriesFor(dissentOnly, 'mentor-confirmed')).toEqual([]);
    expect(dissentOnly.points).toBe(75);
  });

  it('is never dated before the call it confirms', () => {
    const one = call({ id: 'one', at: iso(2), reviews: [review(all(3), iso(0))] });
    expect(entry(rewards([one]), 'mentor-confirmed:one')?.at).toBe(iso(2));
  });

  it('is not paid for a call that ended early', () => {
    const early = call({ status: 'ended-early', reviews: [review(all(3))] });
    expect(rewards([early]).points).toBe(0);
  });
});

describe('levels', () => {
  const tour = (families: number, extraCalls = 0) => [
    ...Array.from({ length: families }, (_, i) =>
      call({
        id: `f${i}`,
        scenario: `fam-${i}`,
        family: ISSUE_TYPES[i] as IssueType,
        at: iso(i * 4),
      }),
    ),
    ...Array.from({ length: extraCalls }, (_, i) =>
      call({ id: `x${i}`, scenario: `extra-${i}`, family: 'sign-in-access', at: iso(100 + i * 4) }),
    ),
  ];

  it('keeps plenty of points at Foundation until a second family is tried', () => {
    const calls = Array.from({ length: 12 }, (_, i) =>
      call({ scenario: `s${i}`, family: 'how-to', at: iso(i) }),
    );
    const r = rewards(calls);
    expect(r.points).toBe(12 * 50 + 20 + 12 * 5);
    expect(r.families.practised).toEqual(['how-to']);
    expect(r.level.id).toBe('foundation');
    expect(r.nextLevel).toMatchObject({ id: 'builder', pointsToGo: 0, familiesToGo: 1 });

    const wider = rewards([
      ...calls,
      call({ scenario: 'other', family: 'data-missing', at: iso(40) }),
    ]);
    expect(wider.level.id).toBe('builder');
  });

  it('needs both 150 points and two families for Builder', () => {
    const a = call({ id: 'a', scenario: 'a', family: 'how-to', at: iso(0) });
    const sameDay = call({ id: 'b', scenario: 'b', family: 'data-missing', at: iso(0, 11) });
    const nextDay = call({ id: 'b', scenario: 'b', family: 'data-missing', at: iso(1) });
    const short = rewards([a, sameDay]);
    expect(short.points).toBe(145);
    expect(short.level.id).toBe('foundation');
    expect(short.nextLevel).toMatchObject({ pointsToGo: 5, familiesToGo: 0 });
    const enough = rewards([a, nextDay]);
    expect(enough.points).toBe(150);
    expect(enough.level).toMatchObject({ id: 'builder', index: 2 });
    expect(enough.nextLevel).toMatchObject({
      id: 'practitioner',
      index: 3,
      pointsToGo: 250,
      familiesToGo: 2,
    });
  });

  it('climbs to Practitioner and then Confident Handler as points and breadth both grow', () => {
    const four = rewards(tour(4));
    expect(four.points).toBe(300);
    expect(four.level.id).toBe('builder');
    expect(four.nextLevel).toMatchObject({ id: 'practitioner', pointsToGo: 100, familiesToGo: 0 });

    const practitioner = rewards(tour(4, 2));
    expect(practitioner.points).toBe(410);
    expect(practitioner.level).toMatchObject({ id: 'practitioner', index: 3 });

    const sixFamilies = rewards(tour(6));
    expect(sixFamilies.points).toBe(450);
    expect(sixFamilies.level.id).toBe('practitioner');
    expect(sixFamilies.nextLevel).toMatchObject({ id: 'confident-handler', pointsToGo: 350 });

    const top = rewards(tour(6, 7));
    expect(top.points).toBe(835);
    expect(top.level).toMatchObject({ id: 'confident-handler', index: 4 });
    expect(top.nextLevel).toBeNull();
  });
});

describe('streak', () => {
  const onDays = (days: number[]) =>
    days.map((d, i) => call({ id: `d${i}`, scenario: `s${i}`, at: iso(d) }));

  it('forgives one missed day: Monday, Wednesday and Thursday make three', () => {
    const r = rewards(onDays([0, 2, 3]), { now: new Date(iso(3, 20)) });
    expect(r.streak).toEqual({ current: 3, best: 3, activeDays: 3, practisedToday: true });
  });

  it('is broken by a gap of three days', () => {
    const r = rewards(onDays([0, 3]), { now: new Date(iso(3, 20)) });
    expect(r.streak).toEqual({ current: 1, best: 1, activeDays: 2, practisedToday: true });
  });

  it('keeps the best streak after a break and starts a new current one', () => {
    const r = rewards(onDays([0, 1, 2, 6, 7]), { now: new Date(iso(7, 20)) });
    expect(r.streak).toMatchObject({ current: 2, best: 3, activeDays: 5 });
  });

  it('counts a day once however many calls were made on it', () => {
    const calls = [
      call({ id: 'a', scenario: 'a', at: iso(0, 9) }),
      call({ id: 'b', scenario: 'b', at: iso(0, 12) }),
      call({ id: 'c', scenario: 'c', at: iso(1, 9) }),
    ];
    expect(rewards(calls, { now: new Date(iso(1, 20)) }).streak).toMatchObject({
      current: 2,
      best: 2,
      activeDays: 2,
    });
  });

  it('stays alive while the last practice day is today or at most two days ago', () => {
    const calls = onDays([0, 1, 2]);
    const at = (day: number) => rewards(calls, { now: new Date(iso(day, 18)) }).streak;
    expect(at(2)).toEqual({ current: 3, best: 3, activeDays: 3, practisedToday: true });
    expect(at(3)).toEqual({ current: 3, best: 3, activeDays: 3, practisedToday: false });
    expect(at(4)).toEqual({ current: 3, best: 3, activeDays: 3, practisedToday: false });
    expect(at(5)).toEqual({ current: 0, best: 3, activeDays: 3, practisedToday: false });
  });

  it('judges today by the learner-local day', () => {
    const calls = [call({ at: iso(0, 10) })]; // Monday 10:00 UTC
    const now = new Date(iso(0, 20)); // Monday 20:00 UTC, already Tuesday 01:30 in India
    expect(rewards(calls, { now, tzOffsetMinutes: 0 }).streak.practisedToday).toBe(true);
    const india = rewards(calls, { now, tzOffsetMinutes: -330 }).streak;
    expect(india.practisedToday).toBe(false);
    expect(india.current).toBe(1);
  });

  it('does not count a call that earned nothing', () => {
    const calls = [
      call({ id: 'a', at: iso(0) }),
      call({ id: 'early', status: 'ended-early', at: iso(1) }),
      call({ id: 'b', scenario: 'b', at: iso(2) }),
    ];
    expect(rewards(calls, { now: new Date(iso(2, 20)) }).streak).toMatchObject({
      best: 2,
      activeDays: 2,
    });
  });
});

describe('badges', () => {
  it('First Practice is earned by the first full call, saying which one and when', () => {
    const early = call({ id: 'early', status: 'ended-early', at: iso(0) });
    const first = call({ id: 'first', at: iso(1, 9) });
    const second = call({ id: 'second', scenario: 'b', at: iso(2) });
    expect(badge(rewards([early]), 'first-practice')).toMatchObject({
      earned: false,
      progress: { current: 0, target: 1, unit: 'scenarios' },
    });
    expect(badge(rewards([early, second, first]), 'first-practice')).toMatchObject({
      earned: true,
      earnedAt: iso(1, 9),
      earnedInSessionId: 'first',
      progress: { current: 1, target: 1 },
    });
  });

  it('Scope Detective needs every hidden fact in three different scenarios', () => {
    const everything = (id: string, scenarioId: string, day: number) =>
      call({ id, scenario: scenarioId, at: iso(day), facts: [{ id: 'f1' }, { id: 'f2' }] });
    const partway = rewards([
      everything('a1', 'a', 0),
      everything('a2', 'a', 1), // the same scenario again adds nothing
      call({
        id: 'b1',
        scenario: 'b',
        at: iso(2),
        facts: [{ id: 'f1' }, { id: 'f2', status: 'partial' }],
      }),
      call({ id: 'c1', scenario: 'c', at: iso(3) }), // no hidden facts to find
    ]);
    expect(badge(partway, 'scope-detective')).toMatchObject({
      earned: false,
      earnedAt: null,
      progress: { current: 1, target: 3 },
    });
    const done = rewards([
      everything('a1', 'a', 0),
      everything('b1', 'b', 2),
      call({
        id: 'c0',
        scenario: 'c',
        at: iso(3),
        facts: [{ id: 'f1' }],
        discovery: { found: 1, total: 2 },
      }),
      everything('c1', 'c', 4),
      everything('d1', 'd', 6),
    ]);
    expect(badge(done, 'scope-detective')).toMatchObject({
      earned: true,
      earnedAt: iso(4),
      earnedInSessionId: 'c1',
      progress: { current: 3, target: 3 },
    });
  });

  it('De-escalator uses the steady-the-call rule: tense, then at least 20 points calmer, quoted', () => {
    const calm = call({
      id: 'calm',
      at: iso(0),
      journey: [
        { turnIndex: 0, temperature: 10, delta: 0, quote: null },
        { turnIndex: 2, temperature: 30, delta: 20, quote: null },
        { turnIndex: 4, temperature: 5, delta: -25, quote: 'quote' },
      ],
    });
    const steadied = call({ id: 'steady', at: iso(1), journey: RECOVERY });
    expect(badge(rewards([calm]), 'de-escalator').earned).toBe(false);
    expect(badge(rewards([calm, steadied]), 'de-escalator')).toMatchObject({
      earned: true,
      earnedAt: iso(1),
      earnedInSessionId: 'steady',
      progress: { current: 1, target: 1, unit: 'calls' },
    });
    const early = call({ status: 'ended-early', journey: RECOVERY });
    expect(badge(rewards([early]), 'de-escalator').earned).toBe(false);
  });

  it('Ownership Builder needs three calls with a clear owner and update', () => {
    const owned = (id: string, day: number) =>
      call({
        id,
        scenario: id,
        at: iso(day),
        scores: { 'ownership-next-steps': 4 },
        quotes: { 'ownership-next-steps': OWNER_QUOTE },
      });
    const two = rewards([owned('a', 0), owned('b', 1), call({ id: 'plain', at: iso(2) })]);
    expect(badge(two, 'ownership-builder')).toMatchObject({
      earned: false,
      progress: { current: 2, target: 3, unit: 'calls' },
    });
    const three = rewards([
      owned('a', 0),
      owned('b', 1),
      call({ id: 'plain', at: iso(2) }),
      owned('c', 3),
      owned('d', 4),
    ]);
    expect(badge(three, 'ownership-builder')).toMatchObject({
      earned: true,
      earnedAt: iso(3),
      earnedInSessionId: 'c',
      progress: { current: 3, target: 3 },
    });
  });

  it('Scenario Explorer needs four families and says which call opened the fourth', () => {
    const calls = [
      'how-to',
      'data-missing',
      'billing-licence',
      'service-outage',
      'slow-performance',
    ].map((family, i) =>
      call({ id: `f${i}`, scenario: `s${i}`, family: family as IssueType, at: iso(i) }),
    );
    expect(badge(rewards(calls.slice(0, 3)), 'scenario-explorer')).toMatchObject({
      earned: false,
      progress: { current: 3, target: 4, unit: 'families' },
    });
    const four = rewards(calls.slice(0, 4));
    expect(badge(four, 'scenario-explorer')).toMatchObject({
      earned: true,
      earnedAt: iso(3),
      earnedInSessionId: 'f3',
    });
    expect(badge(rewards(calls), 'scenario-explorer').progress).toEqual({
      current: 4,
      target: 4,
      unit: 'families',
    });
  });

  it('Consistency Streak is earned by a best streak of three active days, in the call that made it', () => {
    const calls = [0, 2, 3].map((d, i) => call({ id: `d${i}`, scenario: `s${i}`, at: iso(d, 9) }));
    expect(badge(rewards(calls.slice(0, 2)), 'consistency-streak')).toMatchObject({
      earned: false,
      progress: { current: 2, target: 3, unit: 'days' },
    });
    expect(badge(rewards(calls), 'consistency-streak')).toMatchObject({
      earned: true,
      earnedAt: iso(3, 9),
      earnedInSessionId: 'd2',
    });
    // The badge stays earned after the streak is broken.
    const later = rewards([...calls, call({ id: 'late', scenario: 'late', at: iso(30) })]);
    expect(badge(later, 'consistency-streak')).toMatchObject({
      earned: true,
      earnedInSessionId: 'd2',
    });
    expect(later.streak).toMatchObject({ best: 3 });
  });

  it('never lets progress run past the target', () => {
    const calls = Array.from({ length: 9 }, (_, i) =>
      call({
        id: `c${i}`,
        scenario: `s${i}`,
        family: ISSUE_TYPES[i % 7] as IssueType,
        at: iso(i),
        facts: [{ id: 'f' }],
        journey: RECOVERY,
        scores: { 'ownership-next-steps': 4 },
      }),
    );
    const r = rewards(calls);
    for (const b of r.badges) {
      expect(b.earned).toBe(true);
      expect(b.progress.current).toBe(b.progress.target);
    }
    expect(r.badges.map((b) => b.progress.target)).toEqual(
      BADGE_DEFINITIONS.map((definition) => definition.target),
    );
  });
});

describe('challenges', () => {
  it('suggests the gentlest scenario in a family not yet practised', () => {
    const r = rewards([call({ scenario: 'signin-standard', family: 'sign-in-access' })]);
    expect(challenge(r, 'try-new-family')).toMatchObject({
      status: 'active',
      progress: { current: 1, target: 7 },
      scenarioId: 'howto-starter',
      reward: '20 points',
    });
    expect(challenge(r, 'try-new-family')?.detail).toContain('1 of 7');
    expect(challenge(r, 'try-new-family')?.detail).toContain('Scenario howto-starter');
  });

  it('breaks a tie between equally gentle scenarios the same way every time', () => {
    const calls = (
      ['sign-in-access', 'service-outage', 'data-missing', 'how-to', 'feature-not-working'] as const
    ).map((family, i) => call({ scenario: `s${i}`, family, at: iso(i) }));
    const r = rewards(calls);
    // slow-performance and billing-licence both offer a 9 minute starter: the id decides.
    expect(challenge(r, 'try-new-family')?.scenarioId).toBe('billing-starter');
    expect(rewards([...calls].reverse(), {}).challenges).toEqual(r.challenges);
  });

  it('completes when every family has been practised, and then has nothing to suggest', () => {
    const calls = ISSUE_TYPES.map((family, i) => call({ scenario: `s${i}`, family, at: iso(i) }));
    const done = challenge(rewards(calls), 'try-new-family');
    expect(done).toMatchObject({
      status: 'completed',
      progress: { current: 7, target: 7 },
      scenarioId: null,
    });
  });

  it('suggests the easiest difficulty first, then the shortest call', () => {
    const scenarios = [
      scenario('quick-but-hard', 'how-to', 'challenge', 5),
      scenario('long-but-gentle', 'data-missing', 'starter', 20),
      scenario('also-gentle', 'billing-licence', 'starter', 12),
    ];
    const r = rewards([call({ family: 'sign-in-access' })], { scenarios });
    expect(challenge(r, 'try-new-family')?.scenarioId).toBe('also-gentle');
    expect(challenge(r, 'find-every-fact')?.scenarioId).toBe('also-gentle');
  });

  it('suggests nothing when the library has nothing in an unpractised family', () => {
    const r = rewards([call({ family: 'sign-in-access' })], { scenarios: [] });
    expect(challenge(r, 'try-new-family')).toMatchObject({ status: 'active', scenarioId: null });
  });

  it('counts scenarios where every fact was found, up to three, and suggests another', () => {
    const everything = (id: string, scenarioId: string, day: number) =>
      call({ id, scenario: scenarioId, at: iso(day), facts: [{ id: 'f1' }] });
    const one = challenge(rewards([everything('a', 'howto-starter', 0)]), 'find-every-fact');
    expect(one).toMatchObject({
      status: 'active',
      progress: { current: 1, target: 3 },
      scenarioId: 'signin-starter', // the gentlest of those not fully discovered: starter, 8 minutes
    });
    const three = rewards([
      everything('a', 'a', 0),
      everything('b', 'b', 1),
      everything('c', 'c', 2),
      everything('d', 'd', 3),
    ]);
    expect(challenge(three, 'find-every-fact')).toMatchObject({
      status: 'completed',
      progress: { current: 3, target: 3 },
      scenarioId: null,
    });
  });

  it('keeps asking for a scenario that has not been fully discovered', () => {
    const r = rewards([
      call({ scenario: 'howto-starter', facts: [{ id: 'f1' }, { id: 'f2', status: 'partial' }] }),
    ]);
    expect(challenge(r, 'find-every-fact')).toMatchObject({
      progress: { current: 0, target: 3 },
      scenarioId: 'howto-starter',
    });
  });

  describe('lift-a-skill', () => {
    const standard = (id: string, day: number, scores: Partial<Record<DimensionId, number>>) =>
      call({ id, scenario: id, difficulty: 'standard', at: iso(day), scores });

    it('only appears once two calls share a difficulty', () => {
      const mixed = [
        call({ difficulty: 'starter', at: iso(0) }),
        call({ difficulty: 'standard', at: iso(1) }),
        call({ difficulty: 'challenge', at: iso(2) }),
      ];
      expect(challenge(rewards(mixed), 'lift-a-skill')).toBeUndefined();
      expect(rewards(mixed).challenges).toHaveLength(3);
      const pair = rewards([...mixed, call({ difficulty: 'standard', at: iso(3) })]);
      expect(challenge(pair, 'lift-a-skill')).toBeDefined();
      expect(pair.challenges.map((c) => c.id)).toEqual([
        'try-new-family',
        'find-every-fact',
        'lift-a-skill',
        'practise-again',
      ]);
    });

    it('targets the lowest recent average, at the most recent difficulty with two calls', () => {
      const r = rewards([
        standard('a', 0, { ...all(4), closing: 2 }),
        standard('b', 1, { ...all(4), closing: 2 }),
        call({ id: 'c', difficulty: 'challenge', at: iso(2), scores: all(1) }),
      ]);
      const lift = challenge(r, 'lift-a-skill');
      expect(lift).toMatchObject({
        status: 'active',
        progress: { current: 0, target: 1 },
        reward: '15 points',
        difficulty: 'standard',
        scenarioId: 'slow-starter', // built to practise Closing
      });
      expect(lift?.detail).toContain('recent Standard average for Closing is 2.0 of 5');
      expect(lift?.detail).toContain('Score 3 or more');
    });

    it('breaks a tie between skills in report order', () => {
      const r = rewards([standard('a', 0, all(3)), standard('b', 1, all(3))]);
      expect(challenge(r, 'lift-a-skill')?.detail).toContain('Opening & Rapport');
    });

    it('is completed when the latest call lifted that skill', () => {
      const calls = [
        standard('a', 0, { ...all(4), closing: 2 }),
        standard('b', 1, { ...all(4), closing: 2 }),
        standard('c', 2, { ...all(4), closing: 4 }),
      ];
      const r = rewards(calls);
      expect(entry(r, 'skill-improvement:c')?.title).toBe('Lifted a skill: Closing');
      expect(challenge(r, 'lift-a-skill')).toMatchObject({
        status: 'completed',
        progress: { current: 1, target: 1 },
      });
      // A later call that does not lift it takes nothing away from the points already earned.
      const after = rewards([...calls, standard('d', 3, { ...all(4), closing: 2 })]);
      expect(entry(after, 'skill-improvement:c')).toBeDefined();
      expect(challenge(after, 'lift-a-skill')?.status).toBe('active');
    });

    it('is not completed by a lift in some other skill', () => {
      const r = rewards([
        standard('a', 0, { ...all(4), closing: 2, clarity: 3 }),
        standard('b', 1, { ...all(4), closing: 2, clarity: 3 }),
        standard('c', 2, { ...all(4), closing: 2, clarity: 5 }),
      ]);
      expect(entry(r, 'skill-improvement:c')?.title).toBe('Lifted a skill: Clarity');
      // Closing is still the lowest recent average, and it has not moved.
      expect(challenge(r, 'lift-a-skill')).toMatchObject({
        status: 'active',
        progress: { current: 0, target: 1 },
      });
      expect(challenge(r, 'lift-a-skill')?.detail).toContain('for Closing');
    });

    it('asks for a full point more than the recent average, rounded up', () => {
      const r = rewards([standard('a', 0, all(4)), standard('b', 1, all(4))]);
      expect(challenge(r, 'lift-a-skill')?.detail).toContain('Score 5 or more');
      const mid = rewards([standard('a', 0, all(2)), standard('b', 1, all(3))]);
      expect(challenge(mid, 'lift-a-skill')?.detail).toContain(
        'average for Opening & Rapport is 2.5',
      );
      expect(challenge(mid, 'lift-a-skill')?.detail).toContain('Score 4 or more');
    });

    it('is left out when no skill could rise by a whole point', () => {
      const r = rewards([standard('a', 0, all(5)), standard('b', 1, all(5))]);
      expect(challenge(r, 'lift-a-skill')).toBeUndefined();
    });
  });

  describe('practise-again', () => {
    it('follows the best streak and says a missed day never counts against the learner', () => {
      const r = rewards([
        call({ id: 'a', at: iso(0) }),
        call({ id: 'b', scenario: 'b', at: iso(2) }),
      ]);
      const again = challenge(r, 'practise-again');
      expect(again).toMatchObject({
        status: 'active',
        progress: { current: 2, target: 3 },
        reward: 'Toward Consistency Streak',
        scenarioId: null,
      });
      expect(again?.detail).toMatch(/missed day never counts against you/i);
    });

    it('is completed once the Consistency Streak badge is earned', () => {
      const calls = [0, 1, 2, 3, 4].map((d, i) =>
        call({ id: `d${i}`, scenario: `s${i}`, at: iso(d) }),
      );
      const again = challenge(rewards(calls), 'practise-again');
      expect(again).toMatchObject({ status: 'completed', progress: { current: 3, target: 3 } });
      expect(again?.detail).toMatch(/never counts against you/i);
    });
  });

  it('offers each challenge at most once', () => {
    const calls = Array.from({ length: 6 }, (_, i) => call({ scenario: `s${i}`, at: iso(i) }));
    const ids = rewards(calls).challenges.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('what is deliberately not rewarded', () => {
  it('pays the same for a quick call and a long one', () => {
    const quick = call({ id: 'q', traineeTurns: 6, startedAt: iso(0, 10, 0), at: iso(0, 10, 3) });
    const long = call({ id: 'l', traineeTurns: 60, startedAt: iso(0, 10, 0), at: iso(0, 12, 30) });
    expect(rewards([quick]).points).toBe(rewards([long]).points);
  });

  it('does not use the overall score, only the evidence behind specific behaviours', () => {
    const low = call({ scores: all(1) });
    const high = call({ scores: all(3) });
    expect(rewards([low]).points).toBe(rewards([high]).points);
  });

  it('never takes back what a call earned when a worse call follows or the same scenario is retried', () => {
    const calls = [
      call({
        id: 'good',
        at: iso(0),
        facts: [{ id: 'f1' }],
        scores: { ...all(5), 'ownership-next-steps': 5 },
        journey: RECOVERY,
      }),
      call({ id: 'worse', at: iso(1), scores: all(1) }),
      call({ id: 'retry', at: iso(2), scores: all(1) }),
      call({ id: 'again', at: iso(3), scores: all(1) }),
    ];
    let seen = new Set<string>();
    let points = 0;
    for (let n = 1; n <= calls.length; n += 1) {
      const r = rewards(calls.slice(0, n));
      const ids = new Set(r.ledger.map((e) => e.id));
      for (const id of seen) expect(ids.has(id)).toBe(true);
      expect(r.points).toBeGreaterThanOrEqual(points);
      seen = ids;
      points = r.points;
    }
  });
});

describe('stability', () => {
  const busy = () => [
    call({
      id: 'a',
      scenario: 'a',
      family: 'how-to',
      at: iso(0),
      facts: [{ id: 'f1' }, { id: 'f2' }],
      scores: { ...all(3), clarity: 2 },
      reviews: [review(all(3), iso(1))],
    }),
    call({
      id: 'b',
      scenario: 'a',
      family: 'how-to',
      at: iso(1),
      facts: [{ id: 'f1' }],
      scores: { ...all(3), clarity: 2 },
    }),
    call({
      id: 'c',
      scenario: 'b',
      family: 'data-missing',
      at: iso(2),
      journey: RECOVERY,
      scores: { ...all(3), clarity: 4, 'ownership-next-steps': 4 },
    }),
    call({
      id: 'd',
      scenario: 'c',
      family: 'billing-licence',
      at: iso(3),
      scores: { ...all(4), closing: 2 },
      difficulty: 'challenge',
    }),
    call({ id: 'e', scenario: 'a', family: 'how-to', at: iso(3, 12), status: 'ended-early' }),
    call({ id: 'f', scenario: 'a', family: 'how-to', at: iso(5), difficulty: 'standard' }),
    call({ id: 'g', scenario: 'd', family: 'service-outage', at: iso(6), sample: true }),
  ];

  const shuffled = (calls: RewardCall[], seed: number) => {
    let state = seed;
    const next = () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
    const copy = [...calls];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(next() * (i + 1));
      [copy[i], copy[j]] = [copy[j] as RewardCall, copy[i] as RewardCall];
    }
    return copy;
  };

  it('gives identical output for identical input', () => {
    const calls = busy();
    expect(rewards(calls)).toEqual(rewards(calls));
    expect(JSON.stringify(rewards(calls))).toBe(JSON.stringify(rewards(busy())));
  });

  it('does not depend on the order the calls are passed in', () => {
    const calls = busy();
    const expected = JSON.stringify(rewards(calls));
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      expect(JSON.stringify(rewards(shuffled(calls, seed)))).toBe(expected);
    }
    expect(JSON.stringify(rewards([...calls].reverse()))).toBe(expected);
  });

  it('never changes its input', () => {
    const freeze = <T>(value: T): T => {
      if (value && typeof value === 'object') {
        Object.freeze(value);
        for (const inner of Object.values(value)) freeze(inner);
      }
      return value;
    };
    const calls = freeze(busy());
    const scenarios = freeze(LIBRARY.map((s) => ({ ...s })));
    expect(() => rewards(calls, { scenarios })).not.toThrow();
  });

  it('returns copies of the shared tables, so a caller cannot change them', () => {
    const first = rewards([]);
    first.rules[0] = { ...first.rules[0]!, title: 'changed' };
    first.levels[0]!.name = 'changed';
    first.level.name = 'changed';
    const second = rewards([]);
    expect(second.rules[0]?.title).toBe('Complete a full scenario');
    expect(second.levels[0]?.name).toBe('Foundation');
    expect(second.level.name).toBe('Foundation');
    expect(REWARD_RULES[0]?.title).toBe('Complete a full scenario');
  });
});

describe('the ledger', () => {
  const longHistory = () =>
    Array.from({ length: 150 }, (_, i) =>
      call({
        id: `c${String(i).padStart(3, '0')}`,
        scenario: `s${i}`,
        family: ISSUE_TYPES[i % 7] as IssueType,
        at: iso(i),
      }),
    );

  it('lists the newest first, keeping the order inside one call', () => {
    const r = rewards([
      call({ id: 'a', scenario: 'a', at: iso(0), facts: [{ id: 'f1' }] }),
      call({ id: 'b', scenario: 'b', family: 'how-to', at: iso(1), facts: [{ id: 'f2' }] }),
    ]);
    expect(r.ledger.map((e) => e.id)).toEqual([
      'complete-scenario:b',
      'new-scenario-family:how-to',
      'hidden-fact:b:f2',
      'practice-day:2026-03-03',
      'complete-scenario:a',
      'new-scenario-family:sign-in-access',
      'hidden-fact:a:f1',
      'practice-day:2026-03-02',
    ]);
    const times = r.ledger.map((e) => Date.parse(e.at));
    expect(times).toEqual([...times].sort((x, y) => y - x));
  });

  it('shows at most 200 entries but totals every one of them', () => {
    const r = rewards(longHistory());
    expect(r.ledger).toHaveLength(200);
    expect(r.ledger[0]?.at).toBe(iso(149));
    // 150 full calls (two per scenario is never reached), a day each, and seven families.
    expect(r.points).toBe(150 * 50 + 150 * 5 + 7 * 20);
    const shown = r.ledger.reduce((sum, e) => sum + e.points, 0);
    expect(shown).toBeLessThan(r.points);
    expect(new Set(r.ledger.map((e) => e.id)).size).toBe(200);
  });

  it('gives every entry a unique, stable id', () => {
    const r = rewards(longHistory());
    const ids = r.ledger.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(rewards(longHistory()).ledger.map((e) => e.id)).toEqual(ids);
  });
});

describe('the rules table', () => {
  it('lists the seven rules with the points and safeguards the engine uses', () => {
    expect(REWARD_RULES.map((rule) => [rule.id, rule.points])).toEqual([
      ['complete-scenario', 50],
      ['hidden-fact', 10],
      ['owner-and-update', 10],
      ['skill-improvement', 15],
      ['new-scenario-family', 20],
      ['practice-day', 5],
      ['mentor-confirmed', 25],
    ]);
    expect(REWARD_RULES[0]?.safeguard).toBe(
      'The first two completions of a scenario earn 50; repeats earn 10. A call that ends early earns nothing.',
    );
    for (const rule of REWARD_RULES) {
      expect(rule.detail.length).toBeGreaterThan(20);
      expect(rule.safeguard.length).toBeGreaterThan(20);
    }
  });

  it('matches what is actually awarded, apart from the smaller repeat amount', () => {
    const points = new Map(REWARD_RULES.map((rule) => [rule.id, rule.points]));
    const calls = [
      call({
        id: 'a',
        at: iso(0),
        facts: [{ id: 'f1' }],
        reviews: [review(all(3), iso(1))],
        scores: { ...all(3), 'ownership-next-steps': 4 },
      }),
      call({ id: 'b', at: iso(1), scores: all(3) }),
      call({ id: 'c', at: iso(2), scores: { ...all(3), clarity: 4 } }),
    ];
    const r = rewards(calls);
    const kinds = new Set(r.ledger.map((e) => e.ruleId));
    expect(kinds).toEqual(new Set(REWARD_RULES.map((rule) => rule.id)));
    for (const e of r.ledger) {
      if (e.ruleId === 'complete-scenario' && e.sessionId === 'c') expect(e.points).toBe(10);
      else expect(e.points).toBe(points.get(e.ruleId));
    }
  });
});
