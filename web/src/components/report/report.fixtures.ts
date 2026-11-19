import type {
  BadgeDTO,
  LedgerEntryDTO,
  RewardsDTO,
  SessionDTO,
  SessionSummaryDTO,
  TurnDTO,
} from '#shared/domain/api.ts';
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

// ---------------------------------------------------------------------------------------
// A call that ended early, modelled on a real coaching report: the trainee replied briefly and
// curtly, none of the hidden facts came out and the evidence is thin. All of the wording is
// invented; the trainee's lines are mild on purpose.

const SPEC_TRAINEE: Record<number, string> = {
  2: 'Hi how shall i help u',
  4: "No, I can't help with that.",
  6: 'Obvio',
  8: 'No.',
  10: 'No.',
};
const SPEC_CUSTOMER: Record<number, string> = {
  1: "Hello, I'm Carmen. I can't find the Export button on the invoices page.",
  3: 'I am trying to export my invoices, but I cannot find the button anywhere.',
  5: 'Hello? Are you still there?',
  7: 'Sorry, did I say something wrong?',
  9: 'Right. I will try someone else.',
};

export function makeSpecTurns(): TurnDTO[] {
  return Array.from({ length: 10 }, (_, i) => {
    const index = i + 1;
    const customer = index % 2 === 1;
    return {
      index,
      role: customer ? 'customer' : 'trainee',
      text: (customer ? SPEC_CUSTOMER[index] : SPEC_TRAINEE[index]) as string,
      createdAt: iso(index),
      source: index === 1 ? 'opening' : customer ? 'live' : 'trainee',
      ...(index === 8
        ? { markers: [{ kind: 'state' as const, label: 'Dismissed the concern', delta: 9 }] }
        : {}),
    };
  });
}

const SPEC_FACTS: CoachingReport['discovery']['results'] = [
  {
    factId: 'hf-three-dots',
    label: 'Three-dots icon she has not opened',
    importance: 'critical',
    status: 'missed',
    revealedAtTurn: null,
    revealingQuestion: null,
    whatWasHidden:
      "Across the top of the list I can see a search box, a filter icon and a small icon with three dots. I haven't clicked on the three dots.",
    betterQuestion:
      'Can you tell me what you can see across the top of the invoice list, from left to right?',
    consequence:
      'Without checking her screen, the engineer reads out steps that mention a menu she cannot see, and the call stalls while she searches for it.',
  },
  {
    factId: 'hf-half-screen',
    label: 'Browser window fills half the screen',
    importance: 'important',
    status: 'missed',
    revealedAtTurn: null,
    revealingQuestion: null,
    whatWasHidden:
      'The browser is only on half of my screen. I keep another program open on the other half.',
    betterQuestion:
      'How big is your browser window right now: is it full-screen, or sharing the screen with something else?',
    consequence:
      'The engineer never learns why the menu is hidden, and the same problem returns the next time her window is narrow.',
  },
  {
    factId: 'hf-purpose',
    label: "Last month's invoices for a 2 pm meeting",
    importance: 'important',
    status: 'missed',
    revealedAtTurn: null,
    revealingQuestion: null,
    whatWasHidden:
      'I need last month\u2019s invoices in a spreadsheet for a meeting at 2 pm. I only need last month, not the older ones.',
    betterQuestion:
      'What are you hoping to do with the export, and is there a time you need it by?',
    consequence:
      'Without the purpose, the engineer cannot suggest setting the list to last month first, so she may export every invoice and lose time before her meeting.',
  },
  {
    factId: 'hf-old-guide',
    label: 'Following an old training guide',
    importance: 'helpful',
    status: 'missed',
    revealedAtTurn: null,
    revealingQuestion: null,
    whatWasHidden:
      'I am following an old training guide that shows the Export button on the top left.',
    betterQuestion:
      'Where did you see the Export button before, and are you following a guide or written steps?',
    consequence:
      'The engineer keeps pointing at a button that has moved, so the customer wonders whether something is broken.',
  },
];

const SPEC_DIMENSIONS: CoachingReport['dimensions'] = [
  {
    id: 'opening-rapport',
    score: 1,
    label: 'Not demonstrated',
    rationale:
      'The opening was a brief, loosely worded greeting ("Hi how shall i help u") with no name or team introduction, quickly followed by curt replies.',
    evidence: [{ turnIndex: 2, quote: 'Hi how shall i help u' }],
    sufficiency: 'sufficient',
    guidance:
      'Start every call by clearly stating your name, your team, and offering a warm, professional greeting to put the customer at ease.',
  },
  {
    id: 'scoping-discovery',
    score: 1,
    label: 'Not demonstrated',
    rationale:
      "Zero out of four hidden facts were discovered. The trainee made no attempt to explore Carmen's screen, browser size, or the purpose of her export.",
    evidence: [],
    sufficiency: 'sufficient',
    guidance:
      'Ask targeted questions about what the customer can see on their screen and what they need to achieve before attempting to troubleshoot.',
  },
  {
    id: 'empathy-deescalation',
    score: 1,
    label: 'Not demonstrated',
    rationale:
      'The trainee dismissed the customer with a direct refusal to help ("No, I can\'t help with that.") and a bare "No." later on.',
    evidence: [{ turnIndex: 4, quote: "No, I can't help with that." }],
    sufficiency: 'sufficient',
    guidance:
      'Maintain professional composure even when under pressure, and acknowledge the customer\u2019s needs instead of dismissing them.',
  },
  {
    id: 'clarity',
    score: 1,
    label: 'Not demonstrated',
    rationale:
      'There were no explanations, summaries, or helpful instructions provided to assist the customer with finding the feature.',
    evidence: [],
    sufficiency: 'limited',
    guidance:
      'Use plain, courteous language to explain steps one at a time, checking for understanding along the way.',
  },
  {
    id: 'ownership-next-steps',
    score: 1,
    label: 'Not demonstrated',
    rationale:
      'The trainee took no responsibility for the issue and refused to set any next steps or assist further.',
    evidence: [],
    sufficiency: 'limited',
    guidance:
      'Take ownership of the customer\u2019s request and agree on clear, actionable next steps to resolve their issue.',
  },
  {
    id: 'closing',
    score: 1,
    label: 'Not demonstrated',
    rationale:
      'The call ended prematurely without any summary, confirmation, or professional close.',
    evidence: [],
    sufficiency: 'insufficient',
    guidance:
      'Always conclude calls by summarising the resolution, confirming next steps, and thanking the customer.',
  },
];

export function makeSpecReport(overrides: Partial<CoachingReport> = {}): CoachingReport {
  return makeReport({
    generatedAt: iso(12),
    evaluator: {
      kind: 'model',
      name: 'Firefly model evaluator',
      version: 'model-1.0.0',
      providerLabel: 'Gemini (model "gemini-test-model")',
    },
    completion: {
      status: 'ended-early',
      traineeTurns: 5,
      evidence: 'limited',
      note: 'The call was ended before a natural close. This report reflects only what was said up to that point. More turns would give firmer coaching.',
    },
    summary: {
      overall:
        'The call ended early after dismissive trainee replies, such as "No, I can\'t help with that." in turn 4 and "No." in turn 8. None of the critical discovery items were found, and the interaction deteriorated rapidly. The call was very short and evidence is severely limited.',
      overallScore: 1,
      coachingFocus: ['scoping-discovery', 'clarity'],
    },
    dimensions: SPEC_DIMENSIONS,
    strengths: [],
    improvements: [
      {
        dimension: 'empathy-deescalation',
        title: 'A moment to rework: empathy',
        turnIndex: 4,
        quote: "No, I can't help with that.",
        risk: 'Refusing to help and sounding dismissive damages customer trust and causes immediate distress.',
        betterPhrasing:
          "I completely understand that finding the export button is tricky. Let's look at the screen together to locate it.",
        whyItWorks:
          'A calm, empathetic response reassures the customer and keeps the conversation constructive.',
      },
    ],
    discovery: { results: SPEC_FACTS, found: 0, partial: 0, missed: 4, total: 4 },
    journey: {
      points: [
        point(1, 12, 'start', 0),
        point(2, 8, 'turn', -4, {
          reason: 'Opened with a greeting and an offer to help',
          quote: 'Hi how shall i help u',
        }),
        point(4, 8, 'turn', 0, { reason: null, quote: null }),
        point(6, 11, 'turn', 3, { reason: null, quote: null }),
        point(8, 20, 'turning-point', 9, {
          reason: 'Dismissed the customer\u2019s concern',
          quote: null,
        }),
        point(10, 24, 'end', 4, { reason: null, quote: null }),
      ],
      start: 12,
      end: 24,
      peak: 24,
      lowest: 8,
    },
    nextPractice: {
      dimension: 'empathy-deescalation',
      recommendation:
        'Practise maintaining a calm, professional tone and acknowledging customer concerns, especially when handling simple queries or frustrated users.',
      suggestedDifficulty: 'starter',
      suggestedScenarioId: 'team-cannot-open-shared-workspace',
      suggestedScenarioTitle: 'Team cannot open the shared project workspace',
    },
    trainingNote:
      "This is practice coaching generated automatically (Firefly model evaluator), not an assessment of your performance; a mentor's review of the transcript would add what automatic coaching cannot.",
    ...overrides,
  });
}

export function makeSpecSession(overrides: Partial<SessionDTO> = {}): SessionDTO {
  const report = overrides.report === undefined ? makeSpecReport() : overrides.report;
  const base = makeSession({ report });
  return {
    ...base,
    scenarioId: 'cannot-find-export-feature',
    scenarioTitle: 'A user needs help finding a feature',
    issueType: 'how-to',
    difficulty: 'starter',
    mode: 'guided',
    providerKind: 'gemini',
    providerLabel: 'Gemini (model "gemini-test-model")',
    durationSeconds: 186,
    traineeTurns: 5,
    completion: 'ended-early',
    overallScore: 1,
    turns: makeSpecTurns(),
    state: {
      band: { id: 'concerned', label: 'Concerned' },
      trend: 'rising',
      discoveredCount: 0,
      silent: false,
    },
    scenario: {
      ...base.scenario,
      scenarioId: 'cannot-find-export-feature',
      title: 'A user needs help finding a feature',
      persona: { name: 'Carmen Reyes', role: 'Finance assistant', organisation: 'Harbour Foods' },
      config: { ...base.scenario.config, difficulty: 'starter', mode: 'guided' },
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------------------
// Rewards

export function makeLedgerEntry(overrides: Partial<LedgerEntryDTO> = {}): LedgerEntryDTO {
  return {
    id: 'complete-scenario:sess-1',
    ruleId: 'complete-scenario',
    points: 50,
    at: iso(9),
    sessionId: SESSION_ID,
    scenarioTitle: 'Locked out after a password reset',
    title: 'Completed a full scenario',
    reason: 'Finished a full call in "Locked out after a password reset".',
    evidence: null,
    ...overrides,
  };
}

export function makeBadge(overrides: Partial<BadgeDTO> = {}): BadgeDTO {
  return {
    id: 'first-practice',
    title: 'First Practice',
    criteria: 'Complete your first full scenario. A call that ends early does not count.',
    earned: false,
    earnedAt: null,
    earnedInSessionId: null,
    progress: { current: 0, target: 1, unit: 'scenarios' },
    ...overrides,
  };
}

export function makeRewards(overrides: Partial<RewardsDTO> = {}): RewardsDTO {
  const foundation = {
    id: 'foundation',
    index: 1,
    name: 'Foundation',
    minPoints: 0,
    minFamilies: 0,
  };
  return {
    points: 0,
    level: foundation as RewardsDTO['level'],
    nextLevel: null,
    levels: [foundation as RewardsDTO['level']],
    families: { practised: [], total: 7 },
    streak: { current: 0, best: 0, activeDays: 0, practisedToday: false },
    badges: [],
    challenges: [],
    ledger: [],
    rules: [],
    note: 'Rewards are private to this browser profile. They are encouragement for practising, not an assessment, and they are never compared with anyone else.',
    ...overrides,
  };
}
