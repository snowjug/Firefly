import type { SessionDTO, SessionSummaryDTO, TurnDTO } from '#shared/domain/api.ts';
import type { CoachingReport, JourneyPoint } from '#shared/domain/report.ts';
import { DIMENSION_IDS, scoreLabel, type DimensionId } from '#shared/domain/vocab.ts';

// Realistic fixtures for the report, transcript, history and progress tests. The shapes follow what
// the real evaluator returns; the wording is invented and tests never depend on it.

export const SESSION_ID = 'sess-1';

const NOW = Date.parse('2026-11-12T10:00:00.000Z');
const iso = (offsetMinutes: number) => new Date(NOW + offsetMinutes * 60_000).toISOString();

export function point(
  turnIndex: number,
  temperature: number,
  kind: JourneyPoint['kind'],
  delta: number,
  extra: Partial<JourneyPoint> = {},
): JourneyPoint {
  const band =
    temperature <= 20
      ? 'Calm'
      : temperature <= 40
        ? 'Concerned'
        : temperature <= 60
          ? 'Frustrated'
          : temperature <= 80
            ? 'Angry'
            : 'Escalating';
  return {
    turnIndex,
    temperature,
    band,
    kind,
    delta,
    reason: kind === 'start' ? null : 'Gave a specific next step with a time',
    quote: kind === 'start' || kind === 'curveball' ? null : 'I will call you back by 3pm today.',
    ...extra,
  };
}

/** Frustrated at the start, angry at turn 6, calm at the end. */
export const PEAKED_JOURNEY: JourneyPoint[] = [
  point(1, 52, 'start', 0),
  point(2, 58, 'turn', 6, { reason: 'Started without a greeting', quote: 'Please restart it.' }),
  point(4, 66, 'turning-point', 8, {
    reason: 'Jumped into fixes before understanding the situation',
    quote: 'Please clear your cache.',
  }),
  point(6, 70, 'turning-point', 4, {
    reason: 'Blamed the customer or another team',
    quote: 'You should have updated it.',
  }),
  point(8, 38, 'turning-point', -32, {
    reason: 'Took clear ownership',
    quote: 'I will take this on and call you at 3pm.',
  }),
  point(10, 14, 'end', -24),
];

export function longJourney(count: number): JourneyPoint[] {
  const points: JourneyPoint[] = [point(1, 50, 'start', 0)];
  for (let i = 1; i < count; i++) {
    const temperature = Math.round(50 + 38 * Math.sin(i / 3));
    const previous = points[i - 1] as JourneyPoint;
    const delta = temperature - previous.temperature;
    const kind: JourneyPoint['kind'] =
      i === count - 1 ? 'end' : Math.abs(delta) >= 6 ? 'turning-point' : 'turn';
    points.push(point(1 + i * 2, temperature, kind, delta));
  }
  return points;
}

const DIMENSION_SCORES: Record<DimensionId, number> = {
  'opening-rapport': 4,
  'scoping-discovery': 2,
  'empathy-deescalation': 4,
  clarity: 3,
  'ownership-next-steps': 4,
  closing: 5,
};

export function makeReport(overrides: Partial<CoachingReport> = {}): CoachingReport {
  return {
    version: 1,
    generatedAt: iso(30),
    evaluator: {
      kind: 'rules',
      name: 'Firefly rules evaluator',
      version: 'rules-1.0.0',
      providerLabel: 'Demo mode (built-in rules engine)',
    },
    completion: { status: 'completed', traineeTurns: 8, evidence: 'sufficient', note: null },
    summary: {
      overall:
        'You opened well and gave a specific next step. The biggest opportunity is discovery.',
      overallScore: 3.7,
      coachingFocus: ['scoping-discovery', 'clarity'],
    },
    dimensions: DIMENSION_IDS.map((id) => ({
      id,
      score: DIMENSION_SCORES[id],
      label: scoreLabel(DIMENSION_SCORES[id]),
      rationale: `Rationale for ${id}.`,
      evidence:
        id === 'scoping-discovery'
          ? []
          : [{ turnIndex: id === 'closing' ? 10 : 4, quote: `Evidence quote for ${id}.` }],
      sufficiency: 'sufficient' as const,
      guidance: `Guidance for ${id}.`,
    })),
    strengths: [
      {
        dimension: 'closing',
        title: 'Recapped what was agreed',
        turnIndex: 10,
        quote: 'To recap: I will check the sync and call you back at 3pm.',
        whyItHelped: 'A recap leaves no doubt about what was agreed.',
      },
      {
        dimension: 'ownership-next-steps',
        title: 'Gave a specific next step with a time',
        turnIndex: 8,
        quote: 'I will take this on and call you at 3pm.',
        whyItHelped: 'A named action with a time gives the customer something to rely on.',
      },
    ],
    improvements: [
      {
        dimension: 'scoping-discovery',
        title: 'Did not find out: Phone still using the old password',
        turnIndex: null,
        quote: null,
        risk: 'The account may be unlocked and then locked again within minutes.',
        betterPhrasing: 'Is your work email signed in on any other device, like a phone or tablet?',
        whyItWorks: 'It asks whether any other device might still have the old password.',
      },
      {
        dimension: 'empathy-deescalation',
        title: 'Blamed the customer for what happened',
        turnIndex: 6,
        quote: 'You should have updated it.',
        risk: 'Telling a customer what they should have done makes them defensive.',
        betterPhrasing: 'Thanks for explaining that. What did you see when it stopped working?',
        whyItWorks: 'It moves the conversation from who caused the problem to what happened.',
      },
    ],
    discovery: {
      results: [
        {
          factId: 'f-phone',
          label: 'Phone still using the old password',
          importance: 'critical',
          status: 'missed',
          revealedAtTurn: null,
          revealingQuestion: null,
          whatWasHidden:
            'My work email is on my personal phone too, and it keeps asking for a password.',
          betterQuestion: 'Is your work email signed in on any other device?',
          consequence: 'The account may lock again within minutes.',
        },
        {
          factId: 'f-timing',
          label: 'Started right after the password change',
          importance: 'helpful',
          status: 'discovered',
          revealedAtTurn: 4,
          revealingQuestion: 'When did it start, and did anything change recently?',
          whatWasHidden: 'It started right after I changed my password at about ten past eight.',
          betterQuestion: 'When did it last work?',
          consequence: 'Found at turn 4. This added useful context.',
        },
        {
          factId: 'f-message',
          label: 'The message says the account is locked',
          importance: 'important',
          status: 'partial',
          revealedAtTurn: 2,
          revealingQuestion: 'What does the screen say?',
          whatWasHidden: 'The message says my account has been temporarily locked.',
          betterQuestion: 'Can you read me exactly what the sign-in screen says?',
          consequence: 'Partly found.',
        },
      ],
      found: 1,
      partial: 1,
      missed: 1,
      total: 3,
    },
    journey: { points: PEAKED_JOURNEY, start: 52, end: 14, peak: 70, lowest: 14 },
    curveball: null,
    nextPractice: {
      dimension: 'scoping-discovery',
      recommendation:
        'In your next call, ask about three different areas before you suggest any fix.',
      suggestedDifficulty: 'standard',
      suggestedScenarioId: 'follow-up-no-recent-update',
      suggestedScenarioTitle: 'Reminders still missing and no update for days',
    },
    trainingNote:
      'This is practice coaching generated automatically, not an assessment of your performance.',
    ...overrides,
  };
}

/** A short call that stopped early: limited evidence, empty evidence lists, one curveball. */
export function makeEarlyReport(): CoachingReport {
  const base = makeReport();
  return makeReport({
    completion: {
      status: 'ended-early',
      traineeTurns: 4,
      evidence: 'limited',
      note: 'The call ended early, after 4 trainee turns. More turns would give firmer coaching.',
    },
    summary: {
      overall: 'There was no clear strength to point to in this call.',
      overallScore: null,
      coachingFocus: ['empathy-deescalation'],
    },
    dimensions: base.dimensions.map((d, i) => ({
      ...d,
      score: 1 + (i % 3),
      label: scoreLabel(1 + (i % 3)),
      evidence: i % 2 === 0 ? [] : d.evidence,
      sufficiency: i === 0 ? ('insufficient' as const) : ('limited' as const),
    })),
    strengths: [],
    curveball: {
      type: 'ask-manager',
      firedAtTurn: 4,
      status: 'active',
      assessment:
        'After turn 4 the customer asked for a manager, and the call ended before you could respond.',
    },
    journey: {
      points: [
        point(1, 72, 'start', 0),
        point(2, 82, 'turning-point', 10),
        point(4, 100, 'end', 18),
      ],
      start: 72,
      end: 100,
      peak: 100,
      lowest: 72,
    },
  });
}

export function makeTurns(count = 10): TurnDTO[] {
  return Array.from({ length: count }, (_, i) => {
    const index = i + 1;
    const customer = index % 2 === 1;
    const markers: TurnDTO['markers'] =
      index === 4
        ? [
            {
              kind: 'state',
              label: 'Showed specific empathy',
              detail: 'Customer temperature down (-6)',
              delta: -6,
            },
            { kind: 'discovery', label: 'Uncovered: Started right after the password change' },
          ]
        : index === 8
          ? [{ kind: 'curveball', label: 'Curveball: customer asked for a manager' }]
          : undefined;
    return {
      index,
      role: customer ? 'customer' : 'trainee',
      text: customer ? `Customer message number ${index}.` : `Trainee message number ${index}.`,
      createdAt: iso(index),
      source: index === 1 ? 'opening' : customer ? 'demo' : 'trainee',
      ...(markers ? { markers } : {}),
    };
  });
}

export function makeSession(overrides: Partial<SessionDTO> = {}): SessionDTO {
  const report = overrides.report === undefined ? makeReport() : overrides.report;
  return {
    id: SESSION_ID,
    scenarioId: 'locked-out-after-password-reset',
    scenarioTitle: 'Locked out after a password reset',
    issueType: 'sign-in-access',
    difficulty: 'starter',
    startingTemperature: 'frustrated',
    impact: 'medium',
    style: 'talkative',
    mode: 'immersive',
    providerKind: 'mock',
    providerLabel: 'Demo mode (built-in rules engine)',
    isSample: false,
    status: 'completed',
    startedAt: iso(0),
    endedAt: iso(9),
    durationSeconds: 540,
    traineeTurns: 5,
    completion: report ? report.completion.status : null,
    overallScore: report ? report.summary.overallScore : null,
    dimensionScores: report
      ? (Object.fromEntries(report.dimensions.map((d) => [d.id, d.score])) as Record<
          DimensionId,
          number
        >)
      : null,
    mentorReviewed: false,
    scenario: {
      scenarioId: 'locked-out-after-password-reset',
      title: 'Locked out after a password reset',
      summary: 'A staff member cannot sign in after changing their password.',
      issueType: 'sign-in-access',
      tags: [],
      estimatedMinutes: 10,
      persona: { name: 'Maya Okafor', role: 'Receptionist', organisation: 'Northwind Clinic' },
      brief: { situation: 'Situation', goal: 'Goal', groundRules: [] },
      config: {
        impact: 'medium',
        startingTemperature: 'frustrated',
        proficiency: 'novice',
        style: 'talkative',
        callStage: 'first-contact',
        difficulty: 'starter',
        mode: 'immersive',
        curveballsEnabled: true,
      },
      expectedDiscoveryAreas: [],
      coachingFocus: ['scoping-discovery'],
    },
    turns: makeTurns(),
    state: {
      band: { id: 'calm', label: 'Calm' },
      trend: 'steady',
      discoveredCount: 1,
      silent: false,
    },
    evaluationPhase: report ? 'saved' : null,
    evaluationError: null,
    awaitingReply: null,
    report,
    ...overrides,
  };
}

export function makeSummary(overrides: Partial<SessionSummaryDTO> = {}): SessionSummaryDTO {
  return {
    id: 'sum-1',
    scenarioId: 'locked-out-after-password-reset',
    scenarioTitle: 'Locked out after a password reset',
    issueType: 'sign-in-access',
    difficulty: 'starter',
    startingTemperature: 'frustrated',
    impact: 'medium',
    style: 'talkative',
    mode: 'immersive',
    providerKind: 'mock',
    providerLabel: 'Demo mode (built-in rules engine)',
    isSample: false,
    status: 'completed',
    startedAt: iso(0),
    endedAt: iso(9),
    durationSeconds: 540,
    traineeTurns: 6,
    completion: 'completed',
    overallScore: 3.5,
    dimensionScores: {
      'opening-rapport': 4,
      'scoping-discovery': 3,
      'empathy-deescalation': 4,
      clarity: 3,
      'ownership-next-steps': 4,
      closing: 3,
    },
    mentorReviewed: false,
    ...overrides,
  };
}
