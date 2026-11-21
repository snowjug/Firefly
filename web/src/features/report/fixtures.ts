import type { PublicProductDTO, SessionDTO, TurnDTO, TurnMarker } from '#shared/domain/api.ts';
import type {
  CareBehaviourResult,
  CareLevel,
  CarePrincipleResult,
  CoachingReport,
  DimensionResult,
  DiscoveryResult,
  JourneyPoint,
  Milestone,
  MilestoneId,
} from '#shared/domain/report.ts';
import {
  CARE_LABELS,
  PRODUCT_FAMILY_LABELS,
  PRODUCT_INFO,
  scoreLabel,
  temperatureBand,
  type CareBehaviour,
  type DimensionId,
  type EvaluationPhase,
  type ProductId,
} from '#shared/domain/vocab.ts';

// Fixtures for the report page, written by hand and typed against the same DTOs the server sends.
// They do not read the scenario library or run the engine, so they stay the same when the library
// changes. Every person and organisation is fictional (Microsoft's sample companies), and every
// quote is a real quote of the turn it cites: `fixtures.test.ts` checks the quotes and validates
// each report against the report schema. Used by the tests and by the development gallery only.

export const FIXTURE_PROVIDER_LABEL = 'Demo mode (built-in rules engine)';
export const FIXTURE_START = '2026-11-19T14:19:08.000Z';
const GENERATED_AT = '2026-11-19T14:31:00.000Z';

const product = (id: ProductId, area: string): PublicProductDTO => {
  const info = PRODUCT_INFO[id];
  return {
    id,
    name: info.name,
    family: info.family,
    familyLabel: PRODUCT_FAMILY_LABELS[info.family],
    area,
  };
};

type Scenario = SessionDTO['scenario'];

// ---- Small builders: they only shape data, they decide nothing ------------------------------

const dimension = (
  id: DimensionId,
  score: number,
  sufficiency: DimensionResult['sufficiency'],
  rationale: string,
  evidence: readonly (readonly [number, string])[],
  guidance: string,
): DimensionResult => ({
  id,
  score,
  label: scoreLabel(score),
  rationale,
  evidence: evidence.map(([turnIndex, quote]) => ({ turnIndex, quote })),
  sufficiency,
  guidance,
});

const behaviour = (
  id: `${CareBehaviour}.${string}`,
  label: string,
  status: CareBehaviourResult['status'],
  evidence: readonly (readonly [number, string])[] = [],
  note: string | null = null,
): CareBehaviourResult => ({
  id,
  principle: id.split('.')[0] as CareBehaviour,
  label,
  status,
  evidence: evidence.map(([turnIndex, quote]) => ({ turnIndex, quote })),
  note,
});

const principle = (
  id: CareBehaviour,
  level: CareLevel,
  summary: string,
  behaviours: CareBehaviourResult[],
): CarePrincipleResult => ({ id, label: CARE_LABELS[id], level, summary, behaviours });

const MILESTONE_LABELS: Record<MilestoneId, string> = {
  greeting: 'Greeting',
  impact: 'Impact established',
  discovery: 'Discovery',
  escalation: 'Escalation',
  ownership: 'Ownership',
  closure: 'Closure',
};

const reached = (id: MilestoneId, turnIndex: number, quote: string): Milestone => ({
  id,
  label: MILESTONE_LABELS[id],
  status: 'reached',
  turnIndex,
  quote,
});
const missing = (id: MilestoneId): Milestone => ({
  id,
  label: MILESTONE_LABELS[id],
  status: 'not-reached',
  turnIndex: null,
  quote: null,
});
const notApplicable = (id: MilestoneId): Milestone => ({
  id,
  label: MILESTONE_LABELS[id],
  status: 'not-applicable',
  turnIndex: null,
  quote: null,
});

const point = (
  turnIndex: number,
  temperature: number,
  kind: JourneyPoint['kind'],
  delta: number,
  reason: string | null = null,
  quote: string | null = null,
): JourneyPoint => ({
  turnIndex,
  temperature,
  band: temperatureBand(temperature).label,
  kind,
  delta,
  reason,
  quote,
});

const fact = (
  factId: string,
  label: string,
  importance: DiscoveryResult['importance'],
  status: DiscoveryResult['status'],
  revealedAtTurn: number | null,
  revealingQuestion: string | null,
  whatWasHidden: string,
  betterQuestion: string,
  consequence: string,
): DiscoveryResult => ({
  factId,
  label,
  importance,
  status,
  revealedAtTurn,
  revealingQuestion,
  whatWasHidden,
  betterQuestion,
  consequence,
});

const discoveryOf = (results: DiscoveryResult[]): CoachingReport['discovery'] => ({
  results,
  found: results.filter((r) => r.status === 'discovered').length,
  partial: results.filter((r) => r.status === 'partial').length,
  missed: results.filter((r) => r.status === 'missed').length,
  total: results.length,
});

const journeyOf = (points: JourneyPoint[], milestones?: Milestone[]): CoachingReport['journey'] => {
  const temperatures = points.map((p) => p.temperature);
  return {
    points,
    ...(milestones ? { milestones } : {}),
    start: temperatures[0] ?? 0,
    end: temperatures[temperatures.length - 1] ?? 0,
    peak: Math.max(...temperatures),
    lowest: Math.min(...temperatures),
  };
};

const CBCF_PENDING: NonNullable<CoachingReport['cbcf']> = {
  status: 'awaiting-authoritative-source',
  mappingVersion: '0.1.0-pending',
  note: 'CBCF mapping is not applied: awaiting authoritative source confirmation.',
};

const RULES_EVALUATOR: CoachingReport['evaluator'] = {
  kind: 'rules',
  name: 'Firefly rules evaluator',
  version: 'rules-2.0.0',
  providerLabel: FIXTURE_PROVIDER_LABEL,
};

const TRAINING_NOTE =
  'This is practice coaching for a simulated call. It is not an assessment of your performance.';

// ---- The sessions ---------------------------------------------------------------------------

const secondsFor = (text: string) => Math.round(7 + text.length / 6);

interface CallSpec {
  id: string;
  scenario: Scenario;
  lines: readonly string[];
  /** Markers the engine records on a trainee turn, by 1-based turn number. */
  markers?: Record<number, TurnMarker[]>;
  /** The numbers (among the trainee's turns) of the turns that were spoken, not typed. */
  spoken?: readonly number[];
  report: CoachingReport;
  endedEarly?: boolean;
}

function turnsFor(spec: CallSpec): { turns: TurnDTO[]; endedAt: string; seconds: number } {
  const started = Date.parse(FIXTURE_START);
  const spoken = new Set(spec.spoken ?? []);
  let clock = 0;
  let trainee = 0;
  const turns = spec.lines.map((text, i): TurnDTO => {
    const index = i + 1;
    const role = index % 2 === 1 ? 'customer' : 'trainee';
    if (index > 1) clock += role === 'trainee' ? secondsFor(text) : 3;
    if (role === 'trainee') trainee += 1;
    const markers = spec.markers?.[index];
    return {
      index,
      role,
      text,
      createdAt: new Date(started + clock * 1000).toISOString(),
      source: index === 1 ? 'opening' : role === 'trainee' ? 'trainee' : 'demo',
      inputMode: role === 'trainee' && spoken.has(trainee) ? 'voice' : 'text',
      ...(markers ? { markers } : {}),
    };
  });
  return {
    turns,
    endedAt: new Date(started + (clock + 6) * 1000).toISOString(),
    seconds: clock + 6,
  };
}

function sessionFor(spec: CallSpec): SessionDTO {
  const { turns, endedAt, seconds } = turnsFor(spec);
  const { scenario, report } = spec;
  const traineeTurns = turns.filter((t) => t.role === 'trainee').length;
  return {
    id: spec.id,
    scenarioId: scenario.scenarioId,
    scenarioTitle: scenario.title,
    issueType: scenario.issueType,
    difficulty: scenario.config.difficulty,
    startingTemperature: scenario.config.startingTemperature,
    impact: scenario.config.impact,
    style: scenario.config.style,
    mode: scenario.config.mode,
    providerKind: 'mock',
    providerLabel: FIXTURE_PROVIDER_LABEL,
    status: 'completed',
    startedAt: FIXTURE_START,
    endedAt,
    durationSeconds: seconds,
    traineeTurns,
    completion: report.completion.status,
    overallScore: report.summary.overallScore,
    dimensionScores: Object.fromEntries(report.dimensions.map((d) => [d.id, d.score])),
    scenario,
    turns,
    state: {
      band: {
        id: temperatureBand(report.journey.end).id,
        label: temperatureBand(report.journey.end).label,
      },
      trend: report.journey.end < report.journey.start ? 'falling' : 'rising',
      discoveredCount: report.discovery.found,
      silent: false,
      shifts: report.curveball ? 1 : 0,
    },
    awaitingReply: null,
    evaluationPhase: 'saved',
    evaluationError: null,
    report,
  };
}

// ---- Call 1: a strong call (Microsoft Teams, recordings missing) -----------------------------

const STRONG_LINES = [
  'Hi. Our sales team has been recording customer meetings in Teams all week and none of the recordings are showing up. We have a client review this afternoon and I need them.',
  "Hello Priya, this is Sam from Microsoft support. I'm sorry the recordings are missing, especially with a client review this afternoon. Can you tell me exactly what you see in the meeting chat after a recording ends?",
  "Nothing. The recording banner shows during the meeting, but afterwards there's no link in the chat and nothing in the recap.",
  'Thank you, that helps. Is it happening in every meeting, or only for some organisers?',
  "Every meeting organised by the sales team. I've checked three of them.",
  'Did anything change recently, such as a licence update or a policy change on meeting recording?',
  "Our admin changed the storage settings last week, but I don't know exactly what.",
  "Understood. I'll take ownership of this case and check where recordings are stored for your tenant. When did the first recording go missing?",
  'Monday morning, I think. Is this going to be fixed before this afternoon?',
  "I can't promise a fix by this afternoon until I've checked the storage location, but I'll call you back by 1 PM today with what I find, even if it isn't solved yet.",
  "OK. That's at least something I can tell my director.",
  "To recap: recordings from sales meetings stopped appearing on Monday after a storage settings change, and you have a client review this afternoon. I'll check the storage location and call you by 1 PM. Does that sound right?",
  "Yes, that's right.",
  'Is there anything else I can help with right now? Thank you for explaining this so clearly, Priya.',
  "No, that's all. Thanks.",
] as const;

const STRONG_SCENARIO: Scenario = {
  scenarioId: 'teams-recordings-missing',
  title: 'Teams meeting recordings are missing',
  summary:
    "A sales team's Teams recordings have stopped appearing in meeting chats. A client review is this afternoon, and the customer needs a clear owner and a time for the next update.",
  issueType: 'data-missing',
  tags: ['Teams', 'Meetings', 'Recordings'],
  estimatedMinutes: 8,
  product: product('teams', 'Meetings'),
  caseReference: 'FF-24-0142',
  publicBrief: {
    issue: 'Recordings of Teams meetings are not appearing after meetings end.',
    impact: {
      low: 'One organiser is missing a single recording.',
      medium: 'The sales team is missing recordings from several meetings.',
      high: 'Recordings are missing before a client review this afternoon.',
    },
    objective: 'Find the cause, take ownership and agree a time for the next update.',
    previousContact: 'No earlier contact.',
  },
  persona: { name: 'Priya Nair', role: 'IT coordinator', organisation: 'Fabrikam Logistics' },
  brief: {
    situation: 'Priya Nair supports the sales team at Fabrikam Logistics.',
    goal: 'Take ownership and agree the next update.',
    groundRules: [],
  },
  config: {
    impact: 'high',
    startingTemperature: 'frustrated',
    proficiency: 'intermediate',
    style: 'demanding',
    callStage: 'first-contact',
    difficulty: 'standard',
    mode: 'immersive',
    curveballsEnabled: false,
  },
  expectedDiscoveryAreas: ['When it started', 'Who is affected', 'Recent changes'],
  coachingFocus: ['scoping-discovery', 'ownership-next-steps'],
};

const STRONG_REPORT: CoachingReport = {
  version: 2,
  generatedAt: GENERATED_AT,
  evaluator: RULES_EVALUATOR,
  completion: { status: 'completed', traineeTurns: 7, evidence: 'sufficient', note: null },
  summary: {
    overall:
      'A clear, calm call. You introduced yourself, acknowledged the client review, found the storage change and agreed a 1 PM update. To go further, ask what has already been tried.',
    overallScore: 4.2,
    coachingFocus: ['scoping-discovery', 'ownership-next-steps'],
  },
  dimensions: [
    dimension(
      'opening-rapport',
      4,
      'sufficient',
      'You greeted Priya by name, introduced yourself and said why you were sorry in the first turn.',
      [
        [2, 'Hello Priya, this is Sam from Microsoft support.'],
        [2, "I'm sorry the recordings are missing"],
      ],
      'Confirm the organisation and one affected meeting early, so every check starts on the right tenant.',
    ),
    dimension(
      'scoping-discovery',
      4,
      'sufficient',
      'Your questions narrowed the problem to sales-organised meetings and a recent storage change.',
      [
        [4, 'Is it happening in every meeting, or only for some organisers?'],
        [
          6,
          'Did anything change recently, such as a licence update or a policy change on meeting recording?',
        ],
      ],
      'Ask what has already been tried before you start your own checks.',
    ),
    dimension(
      'empathy-deescalation',
      4,
      'sufficient',
      'You named the deadline Priya was under, and her tone eased from the first reply.',
      [[2, 'especially with a client review this afternoon']],
      'Keep naming the specific impact; one sentence is enough.',
    ),
    dimension(
      'clarity',
      4,
      'sufficient',
      'Plain language throughout, and a recap that Priya confirmed.',
      [
        [
          12,
          'To recap: recordings from sales meetings stopped appearing on Monday after a storage settings change',
        ],
      ],
      'Say what you will check first, not only that you will check.',
    ),
    dimension(
      'ownership-next-steps',
      5,
      'sufficient',
      'You took ownership, avoided promising a fix and gave a specific time for the next update.',
      [
        [8, "I'll take ownership of this case"],
        [10, "I'll call you back by 1 PM today"],
      ],
      'Keep naming a time, and say what you will do if the update slips.',
    ),
    dimension(
      'closing',
      4,
      'sufficient',
      'You checked for anything else and thanked Priya for her explanation.',
      [[14, 'Is there anything else I can help with right now?']],
      'Repeat the agreed update time in your last sentence.',
    ),
  ],
  care: [
    principle(
      'communicate',
      'strong',
      'Clear greeting, focused questions and a recap that Priya confirmed, in plain language throughout.',
      [
        behaviour('communicate.greeting', 'Greeted the customer by name', 'shown', [
          [2, 'Hello Priya'],
        ]),
        behaviour('communicate.introduction', 'Introduced themselves', 'shown', [
          [2, 'this is Sam from Microsoft support'],
        ]),
        behaviour('communicate.clear-questions', 'Asked clear, single questions', 'shown', [
          [4, 'Is it happening in every meeting, or only for some organisers?'],
        ]),
        behaviour('communicate.summary', 'Summarised the situation', 'shown', [
          [12, 'To recap: recordings from sales meetings stopped appearing on Monday'],
        ]),
        behaviour('communicate.confirm-understanding', 'Checked the summary was right', 'shown', [
          [12, 'Does that sound right?'],
        ]),
      ],
    ),
    principle(
      'accountable',
      'strong',
      'Took ownership early, avoided promising a fix you could not guarantee, and named a time for the next update.',
      [
        behaviour('accountable.ownership', 'Took ownership', 'shown', [
          [8, "I'll take ownership of this case"],
        ]),
        behaviour('accountable.expectations', 'Set honest expectations', 'shown', [
          [10, "I can't promise a fix by this afternoon until I've checked the storage location"],
        ]),
        behaviour('accountable.update-time', 'Named an update time', 'shown', [
          [10, "I'll call you back by 1 PM today"],
        ]),
      ],
    ),
    principle(
      'resourceful',
      'developing',
      'Scoping and recent-change questions found the storage change quickly, but what had already been tried was never asked.',
      [
        behaviour('resourceful.scoping', 'Scoped who was affected', 'shown', [
          [4, 'Is it happening in every meeting, or only for some organisers?'],
        ]),
        behaviour('resourceful.recent-changes', 'Asked about recent changes', 'shown', [
          [6, 'Did anything change recently, such as a licence update'],
        ]),
        behaviour(
          'resourceful.impact',
          'Assessed the business impact',
          'partly',
          [[2, 'especially with a client review this afternoon']],
          'The deadline was acknowledged, but its scale was not asked.',
        ),
        behaviour(
          'resourceful.prior-troubleshooting',
          'Asked what was already tried',
          'not-shown',
          [],
          'Not asked in this call.',
        ),
      ],
    ),
    principle(
      'empathetic',
      'strong',
      'Acknowledged both the missing recordings and the client review, and closed warmly by thanking Priya.',
      [
        behaviour('empathetic.acknowledged-concern', 'Acknowledged the concern', 'shown', [
          [2, "I'm sorry the recordings are missing"],
        ]),
        behaviour('empathetic.acknowledged-impact', 'Acknowledged the business impact', 'shown', [
          [2, 'especially with a client review this afternoon'],
        ]),
        behaviour('empathetic.respectful-close', 'Closed respectfully', 'shown', [
          [14, 'Thank you for explaining this so clearly, Priya.'],
        ]),
      ],
    ),
  ],
  cbcf: CBCF_PENDING,
  strengths: [
    {
      dimension: 'ownership-next-steps',
      title: 'Named an owner and an update time',
      turnIndex: 10,
      quote: "I'll call you back by 1 PM today",
      whyItHelped: 'A specific time gave Priya something firm to tell her director.',
    },
    {
      dimension: 'empathy-deescalation',
      title: 'Acknowledged the real deadline',
      turnIndex: 2,
      quote: 'especially with a client review this afternoon',
      whyItHelped: 'Naming the client review showed you had heard the impact, not only the fault.',
    },
    {
      dimension: 'clarity',
      title: 'Closed with a confirmed recap',
      turnIndex: 12,
      quote:
        'To recap: recordings from sales meetings stopped appearing on Monday after a storage settings change',
      whyItHelped: 'Priya confirmed it, so you both left with the same picture.',
    },
  ],
  improvements: [
    {
      dimension: 'scoping-discovery',
      title: 'Did not ask what had been tried',
      turnIndex: null,
      quote: null,
      risk: 'Without asking what Priya or her admin already tried, you may repeat steps and lose time before the client review.',
      betterPhrasing:
        'Before I check storage, what have you or your admin already tried, such as recording a test meeting?',
      whyItWorks: 'It saves repeated steps and shows you are building on what she already did.',
    },
    {
      dimension: 'opening-rapport',
      title: 'Did not confirm the tenant',
      turnIndex: 2,
      quote: 'Can you tell me exactly what you see in the meeting chat after a recording ends?',
      risk: 'Starting the checks without confirming the organisation can send you to the wrong tenant.',
      betterPhrasing:
        'Before we start, can you confirm your organisation name and one affected meeting, so I look at the right tenant?',
      whyItWorks: 'It anchors the investigation on the right account and a real example.',
    },
  ],
  discovery: discoveryOf([
    fact(
      'storage-changed',
      'Storage settings changed last week',
      'critical',
      'discovered',
      6,
      'Did anything change recently, such as a licence update or a policy change on meeting recording?',
      'The admin changed where recordings are stored the week before.',
      'Did anyone change storage or retention settings recently?',
      'The cause sat in a recent change, so a call that never asks about changes can miss it.',
    ),
    fact(
      'sales-only',
      'Only sales-organised meetings are affected',
      'important',
      'discovered',
      4,
      'Is it happening in every meeting, or only for some organisers?',
      'Meetings organised outside the sales team still record normally.',
      'Is it every organiser, or only some teams?',
      'Scope points at a policy or licence that applies to a group.',
    ),
    fact(
      'first-missing',
      'The first recording went missing on Monday',
      'important',
      'discovered',
      8,
      'When did the first recording go missing?',
      'Monday morning, before the working week began.',
      'When did you last see a recording appear?',
      'A start time lines up with the change that caused it.',
    ),
    fact(
      'organiser-licence',
      'Two organisers lost their OneDrive licence',
      'critical',
      'missed',
      null,
      null,
      'Two sales organisers were moved to a plan without OneDrive storage.',
      'Do the organisers with missing recordings still have their OneDrive licence?',
      'Recordings are saved to the organiser’s OneDrive, so with no licence there is nowhere to save them.',
    ),
    fact(
      'external-guests',
      'Most missing recordings were meetings with external guests',
      'helpful',
      'partial',
      6,
      'Did anything change recently, such as a licence update or a policy change on meeting recording?',
      'External guests were present in the meetings that failed to record.',
      'Were the missing recordings from meetings with people outside your organisation?',
      'Guest policies can block saving a recording.',
    ),
  ]),
  journey: journeyOf(
    [
      point(0, 52, 'start', 0, 'Started frustrated: no recordings and a client review today'),
      point(2, 47, 'turn', -5),
      point(
        4,
        39,
        'turning-point',
        -8,
        'Asked a focused question about scope',
        'Is it happening in every meeting, or only for some organisers?',
      ),
      point(6, 34, 'turn', -5),
      point(8, 28, 'turn', -6),
      point(
        10,
        17,
        'turning-point',
        -11,
        'Gave a specific update time',
        "I'll call you back by 1 PM today",
      ),
      point(12, 13, 'turn', -4),
      point(14, 9, 'end', -4, 'Ended calm: the customer had a time to rely on'),
    ],
    [
      reached('greeting', 2, 'this is Sam from Microsoft support'),
      reached('impact', 2, 'especially with a client review this afternoon'),
      reached('discovery', 4, 'Is it happening in every meeting, or only for some organisers?'),
      notApplicable('escalation'),
      reached('ownership', 8, "I'll take ownership of this case"),
      reached('closure', 14, 'Is there anything else I can help with right now?'),
    ],
  ),
  curveball: null,
  nextPractice: {
    dimension: 'scoping-discovery',
    recommendation:
      'Practise asking what has already been tried, and who administers the service, before you start your own checks.',
    suggestedDifficulty: 'standard',
    suggestedScenarioId: 'entra-mfa-lockout',
    suggestedScenarioTitle: 'Staff locked out after an MFA change',
  },
  trainingNote: TRAINING_NOTE,
};

// ---- Call 2: a weak call (Entra ID, an angry customer, an unanswered request for a manager) --

const WEAK_LINES = [
  "Finally. Twelve of my staff can't sign in since yesterday's MFA change and nobody has called me back.",
  'Have you tried restarting it? Clear the cache and try again.',
  "This isn't a device problem. They're asked for a code that never arrives.",
  "You should have checked the service status page first. That's not a big deal.",
  'Not a big deal? I want to speak to your manager.',
  'It will definitely be fixed in 10 minutes.',
  "You can't promise that. Who owns this case?",
  'We will get back to you soon.',
  'Soon is not an answer.',
  'ok',
  "I'm done. Please escalate this.",
] as const;

const WEAK_SCENARIO: Scenario = {
  scenarioId: 'entra-mfa-lockout',
  title: 'Staff locked out after an MFA change',
  summary:
    'Twelve staff cannot sign in after a multi-factor authentication change. The customer is angry, has had no call back and expects an owner.',
  issueType: 'sign-in-access',
  tags: ['Entra ID', 'MFA', 'Sign-in'],
  estimatedMinutes: 10,
  product: product('entra-id', 'Sign-in and MFA'),
  caseReference: 'FF-24-0187',
  publicBrief: {
    issue: 'Staff are asked for a verification code that never arrives.',
    impact: {
      low: 'One person cannot sign in.',
      medium: 'A team cannot sign in.',
      high: 'Twelve staff cannot sign in and work has stopped.',
    },
    objective: 'Calm the customer, find the cause and agree a clear owner.',
    previousContact: 'The customer says nobody called them back.',
  },
  persona: { name: 'Marcus Bell', role: 'Operations manager', organisation: 'Litware Foods' },
  brief: {
    situation: 'Marcus Bell manages operations at Litware Foods.',
    goal: 'Take ownership and agree the next step.',
    groundRules: [],
  },
  config: {
    impact: 'high',
    startingTemperature: 'angry',
    proficiency: 'novice',
    style: 'terse',
    callStage: 'escalated',
    difficulty: 'challenge',
    mode: 'immersive',
    curveballsEnabled: true,
  },
  expectedDiscoveryAreas: ['When it started', 'Who is affected', 'Recent changes'],
  coachingFocus: ['empathy-deescalation', 'ownership-next-steps'],
};

const WEAK_REPORT: CoachingReport = {
  version: 2,
  generatedAt: GENERATED_AT,
  evaluator: RULES_EVALUATOR,
  completion: { status: 'completed', traineeTurns: 5, evidence: 'sufficient', note: null },
  summary: {
    overall:
      'The call moved to fixes before listening. The customer was blamed, a fix was promised that you could not guarantee, and no owner or time was given. Start with a greeting, an apology and one question.',
    overallScore: 1.2,
    coachingFocus: ['empathy-deescalation', 'ownership-next-steps'],
  },
  dimensions: [
    dimension(
      'opening-rapport',
      1,
      'sufficient',
      'There was no greeting or introduction before the first suggestion.',
      [],
      'Open with your name, your team and one sentence that shows you heard the problem.',
    ),
    dimension(
      'scoping-discovery',
      1,
      'sufficient',
      'The first reply jumped to a fix without asking what Marcus was seeing.',
      [[2, 'Have you tried restarting it?']],
      'Ask what the people see, who is affected and when it began before you suggest anything.',
    ),
    dimension(
      'empathy-deescalation',
      1,
      'sufficient',
      'Blaming the customer and calling the problem small raised the tension.',
      [[4, "That's not a big deal."]],
      'Acknowledge the impact first: twelve people cannot work.',
    ),
    dimension(
      'clarity',
      2,
      'sufficient',
      'The follow-up was vague, so the customer had nothing concrete to rely on.',
      [[8, 'We will get back to you soon.']],
      'Replace “soon” with a time and what you will do by then.',
    ),
    dimension(
      'ownership-next-steps',
      1,
      'sufficient',
      'A fix was promised that you could not guarantee, and nobody was named as the owner.',
      [
        [6, 'It will definitely be fixed in 10 minutes.'],
        [8, 'We will get back to you soon.'],
      ],
      'Say who owns the case and when the next update will come, even if the fix is unknown.',
    ),
    dimension(
      'closing',
      1,
      'sufficient',
      'The call ended on a one-word reply with no recap or next step.',
      [[10, 'ok']],
      'Close with the agreed owner, the time of the next update and a thank you.',
    ),
  ],
  care: [
    principle(
      'communicate',
      'not-yet',
      'No greeting or summary, and the follow-up was too vague for Marcus to act on.',
      [
        behaviour(
          'communicate.introduction',
          'Introduced themselves',
          'not-shown',
          [],
          'No name or team was given.',
        ),
        behaviour(
          'communicate.summary',
          'Summarised the situation',
          'not-shown',
          [],
          'No recap before the call ended.',
        ),
      ],
    ),
    principle(
      'accountable',
      'not-yet',
      'A fix was promised that could not be guaranteed, and no owner or update time was named.',
      [
        behaviour(
          'accountable.expectations',
          'Set honest expectations',
          'not-shown',
          [],
          'A 10-minute fix was promised without checking.',
        ),
        behaviour(
          'accountable.update-time',
          'Named an update time',
          'not-shown',
          [],
          '“Soon” is not a time.',
        ),
      ],
    ),
    principle(
      'resourceful',
      'not-yet',
      'The only question was whether a restart had been tried, so the cause was never narrowed.',
      [
        behaviour(
          'resourceful.scoping',
          'Scoped who was affected',
          'not-shown',
          [],
          'Nobody was asked who or how many.',
        ),
      ],
    ),
    principle(
      'empathetic',
      'not-yet',
      'The customer was told it was not a big deal while twelve staff could not work.',
      [
        behaviour(
          'empathetic.acknowledged-impact',
          'Acknowledged the business impact',
          'not-shown',
          [],
          'The impact was dismissed.',
        ),
      ],
    ),
  ],
  cbcf: CBCF_PENDING,
  strengths: [],
  improvements: [
    {
      dimension: 'empathy-deescalation',
      title: 'Blamed the customer',
      turnIndex: 4,
      quote: 'You should have checked the service status page first.',
      risk: 'Blame raises tension and asks the customer to defend themselves instead of helping you find the cause.',
      betterPhrasing:
        "I'm sorry twelve of your staff can't work. Let me understand what they see when they sign in.",
      whyItWorks: 'It names the impact and moves straight to the problem.',
    },
    {
      dimension: 'ownership-next-steps',
      title: 'Promised a fix you could not guarantee',
      turnIndex: 6,
      quote: 'It will definitely be fixed in 10 minutes.',
      risk: 'An unsupported promise that is missed will cost more trust than the original problem.',
      betterPhrasing:
        "I can't promise a time until I've found the cause, but I'll call you by 2 PM with an update either way.",
      whyItWorks: 'An honest limit plus a specific time is more believable than a guess.',
    },
    {
      dimension: 'clarity',
      title: 'Left the next step vague',
      turnIndex: 8,
      quote: 'We will get back to you soon.',
      risk: 'Without a time or an owner the customer cannot plan, and asks for a manager.',
      betterPhrasing:
        "I'll own this case and call you by 2 PM today, even if I don't have the fix yet.",
      whyItWorks: 'A named owner and a time are the two things an angry customer needs.',
    },
  ],
  discovery: discoveryOf([
    fact(
      'when-started',
      'The problem started after yesterday’s MFA change',
      'critical',
      'missed',
      null,
      null,
      'A conditional access policy was edited the evening before.',
      'When did this start, and did anything change just before?',
      'The change is the likeliest cause, so skipping the timing can send the call the wrong way.',
    ),
    fact(
      'who-affected',
      'Twelve staff in one department are affected',
      'important',
      'missed',
      null,
      null,
      'Only the finance department is locked out.',
      'Is it everyone, or one team?',
      'Scope separates a tenant-wide fault from a policy that targets a group.',
    ),
    fact(
      'code-delivery',
      'The verification code never arrives by text',
      'important',
      'missed',
      null,
      null,
      'The code is sent to phone numbers that were removed in the change.',
      'How is the code supposed to reach them, and has that method changed?',
      'The delivery method points directly at the fix.',
    ),
  ]),
  journey: journeyOf(
    [
      point(0, 72, 'start', 0, 'Started angry: locked out and nobody called back'),
      point(2, 76, 'turn', 4),
      point(
        4,
        88,
        'curveball',
        12,
        'The customer asked for a manager after a dismissive reply',
        'You should have checked the service status page first.',
      ),
      point(6, 91, 'turn', 3),
      point(8, 94, 'turn', 3),
      point(10, 97, 'end', 3, 'Ended escalating: no owner and no time'),
    ],
    [
      missing('greeting'),
      missing('impact'),
      missing('discovery'),
      missing('escalation'),
      missing('ownership'),
      missing('closure'),
    ],
  ),
  curveball: {
    type: 'ask-manager',
    firedAtTurn: 4,
    status: 'active',
    assessment: 'The customer asked for a manager and the next replies did not address it.',
  },
  nextPractice: {
    dimension: 'empathy-deescalation',
    recommendation:
      'Practise opening with an apology and one open question, and name the impact before you suggest anything.',
    suggestedDifficulty: 'starter',
    suggestedScenarioId: 'outlook-shared-calendar',
    suggestedScenarioTitle: 'Shared calendar is not updating',
  },
  trainingNote: TRAINING_NOTE,
};

// ---- Call 3: a short call that ended early (Outlook) -----------------------------------------

const SHORT_LINES = [
  "Hi, my shared calendar isn't updating in Outlook and I keep missing meetings.",
  'Hello, this is Sam from Microsoft support. How can I help today?',
  "I just said. The team calendar only shows last week's meetings.",
  'Can you tell me which calendar you are looking at and where you see it?',
  'The sales team one, in the Outlook desktop app. Look, can we do this quickly?',
] as const;

const SHORT_SCENARIO: Scenario = {
  scenarioId: 'outlook-shared-calendar',
  title: 'Shared calendar is not updating',
  summary:
    'A shared team calendar in Outlook shows old meetings. The customer is short of time and wants a quick answer.',
  issueType: 'feature-not-working',
  tags: ['Outlook', 'Calendar'],
  estimatedMinutes: 6,
  product: product('outlook', 'Calendar'),
  caseReference: 'FF-24-0231',
  publicBrief: {
    issue: 'A shared calendar in Outlook shows old meetings.',
    impact: {
      low: 'One person sees old meetings.',
      medium: 'A team misses meetings.',
      high: 'A team keeps missing client meetings.',
    },
    objective: 'Work out which calendar and client are affected.',
  },
  persona: { name: 'Linh Tran', role: 'Office manager', organisation: 'Tailspin Toys' },
  brief: {
    situation: 'Linh Tran runs the office at Tailspin Toys.',
    goal: 'Find which calendar is affected.',
    groundRules: [],
  },
  config: {
    impact: 'medium',
    startingTemperature: 'anxious',
    proficiency: 'intermediate',
    style: 'terse',
    callStage: 'first-contact',
    difficulty: 'starter',
    mode: 'guided',
    curveballsEnabled: false,
  },
  expectedDiscoveryAreas: ['Which calendar', 'Which app'],
  coachingFocus: ['opening-rapport', 'scoping-discovery'],
};

const SHORT_REPORT: CoachingReport = {
  version: 2,
  generatedAt: GENERATED_AT,
  evaluator: RULES_EVALUATOR,
  completion: {
    status: 'ended-early',
    traineeTurns: 2,
    evidence: 'insufficient',
    note: 'The call ended after two of your turns, so the coaching rests on limited evidence.',
  },
  summary: {
    overall:
      'You greeted the customer and asked which calendar was affected, but the call ended before the problem was narrowed or an owner was named. Try a longer call for firmer coaching.',
    overallScore: null,
    coachingFocus: ['opening-rapport', 'scoping-discovery'],
  },
  dimensions: [
    dimension(
      'opening-rapport',
      3,
      'limited',
      'You introduced yourself, but the call ended before rapport could build.',
      [[2, 'this is Sam from Microsoft support']],
      'After the greeting, show you have heard the problem before you ask a question.',
    ),
    dimension(
      'scoping-discovery',
      2,
      'insufficient',
      'One question was asked; there was not enough to judge scoping.',
      [[4, 'Can you tell me which calendar you are looking at and where you see it?']],
      'Follow the first answer with who is affected and when it began.',
    ),
    dimension(
      'empathy-deescalation',
      2,
      'insufficient',
      'There was no moment to judge empathy.',
      [],
      'Acknowledge the cost of missed meetings.',
    ),
    dimension(
      'clarity',
      3,
      'insufficient',
      'Plain wording, but too short to judge.',
      [],
      'Say what you will check and why.',
    ),
    dimension(
      'ownership-next-steps',
      1,
      'insufficient',
      'No owner or next step was reached before the call ended.',
      [],
      'Name yourself as the owner and a time for the next update.',
    ),
    dimension(
      'closing',
      1,
      'insufficient',
      'The call ended without a close.',
      [],
      'Recap and confirm the next contact before you end.',
    ),
  ],
  care: [
    principle(
      'communicate',
      'limited-evidence',
      'You introduced yourself, but the call was too short to see questions or a summary.',
      [
        behaviour('communicate.introduction', 'Introduced themselves', 'shown', [
          [2, 'this is Sam from Microsoft support'],
        ]),
      ],
    ),
    principle(
      'accountable',
      'limited-evidence',
      'The call ended before an owner or a next step could be set.',
      [],
    ),
    principle(
      'resourceful',
      'limited-evidence',
      'One scoping question was asked; more calls are needed to see how you investigate.',
      [
        behaviour('resourceful.scoping', 'Scoped the problem', 'partly', [
          [4, 'which calendar you are looking at'],
        ]),
      ],
    ),
    principle(
      'empathetic',
      'limited-evidence',
      'There was no moment to acknowledge the concern before the call ended.',
      [],
    ),
  ],
  cbcf: CBCF_PENDING,
  strengths: [],
  improvements: [
    {
      dimension: 'empathy-deescalation',
      title: 'Asked how you can help after the problem was stated',
      turnIndex: 2,
      quote: 'How can I help today?',
      risk: 'Linh had already said what was wrong, so asking again can feel like she was not heard.',
      betterPhrasing:
        "Sorry you're missing meetings, Linh. Which calendar is it, and are you using the desktop app?",
      whyItWorks: 'It repeats her problem back and asks one specific question.',
    },
  ],
  discovery: discoveryOf([
    fact(
      'which-app',
      'The calendar is shown in the Outlook desktop app',
      'important',
      'discovered',
      4,
      'Can you tell me which calendar you are looking at and where you see it?',
      'It is the sales team calendar in Outlook on Windows.',
      'Which Outlook app are you using?',
      'The client changes which fixes apply.',
    ),
    fact(
      'when-started',
      'The calendar stopped updating last Monday',
      'critical',
      'missed',
      null,
      null,
      'The last synced meeting was on the previous Monday.',
      'When did it last show a new meeting?',
      'The date points at what changed.',
    ),
  ]),
  journey: journeyOf(
    [
      point(0, 38, 'start', 0, 'Started concerned: missing meetings'),
      point(2, 44, 'turn', 6),
      point(4, 47, 'end', 3, 'Ended frustrated: asked what was already said'),
    ],
    [
      reached('greeting', 2, 'this is Sam from Microsoft support'),
      missing('impact'),
      reached('discovery', 4, 'Can you tell me which calendar you are looking at'),
      notApplicable('escalation'),
      missing('ownership'),
      missing('closure'),
    ],
  ),
  curveball: null,
  nextPractice: {
    dimension: 'scoping-discovery',
    recommendation: 'Run the same scenario again and take it past three questions.',
    suggestedDifficulty: 'starter',
    suggestedScenarioId: 'outlook-shared-calendar',
    suggestedScenarioTitle: 'Shared calendar is not updating',
  },
  trainingNote: TRAINING_NOTE,
};

// ---- Call 4: an unexpected turn that was handled (OneDrive) ----------------------------------

const CURVEBALL_LINES = [
  'Hello. OneDrive has stopped syncing for the whole finance team since this morning and the month-end close is tomorrow.',
  "Hello Tomasz, this is Sam from Microsoft support. I'm sorry about the sync trouble so close to month-end. What do you see on the OneDrive icon on an affected PC?",
  'A red cross on the cloud icon. And before you ask, last time I called nobody phoned me back for a week.',
  "I'm sorry nobody called you back. That isn't good enough, and I'll take this case myself so you only have to explain it once. Which PCs are affected?",
  'All six in finance. They all synced fine until yesterday evening.',
  'Did anything change yesterday evening, such as an update, a new sync policy or a folder rename?',
  'Our admin pushed a Windows update, I think. Not sure.',
  'Thanks, that is useful. Can you read me the exact message when you hover over the red cross?',
  "It says 'sync pending, path too long'. Can you fix it today?",
  "I can't promise a fix today until I've checked the path length, but I'll call you by 3 PM with an update, even if it is not solved yet.",
  "All right. That's more than I got last time.",
  'To recap: six finance PCs stopped syncing last night after a Windows update, with a path too long message. I will call you by 3 PM. Is that right?',
  'Yes. Thank you.',
  'Is there anything else I can help with? Thank you for your patience, Tomasz.',
  'No, thanks.',
] as const;

const CURVEBALL_SCENARIO: Scenario = {
  scenarioId: 'onedrive-sync-stalled',
  title: 'OneDrive stopped syncing for finance',
  summary:
    "A finance team's OneDrive folders stopped syncing the day before month-end. The customer also raises a poor earlier support experience.",
  issueType: 'feature-not-working',
  tags: ['OneDrive', 'Sync', 'Windows'],
  estimatedMinutes: 9,
  product: product('onedrive-business', 'Sync'),
  caseReference: 'FF-24-0266',
  publicBrief: {
    issue: 'Files in OneDrive stopped syncing on six PCs.',
    impact: {
      low: 'One PC is not syncing.',
      medium: 'A team cannot sync shared files.',
      high: 'Six finance PCs cannot sync before month-end close.',
    },
    objective: 'Find the cause and rebuild trust after an earlier poor experience.',
    previousContact: 'A previous call was not returned.',
  },
  persona: { name: 'Tomasz Wójcik', role: 'Finance lead', organisation: 'Wide World Importers' },
  brief: {
    situation: 'Tomasz Wójcik leads finance at Wide World Importers.',
    goal: 'Find the cause and agree the next update.',
    groundRules: [],
  },
  config: {
    impact: 'high',
    startingTemperature: 'frustrated',
    proficiency: 'intermediate',
    style: 'talkative',
    callStage: 'follow-up',
    difficulty: 'standard',
    mode: 'immersive',
    curveballsEnabled: true,
  },
  expectedDiscoveryAreas: ['When it started', 'Who is affected', 'Recent changes'],
  coachingFocus: ['empathy-deescalation', 'ownership-next-steps'],
};

const CURVEBALL_REPORT: CoachingReport = {
  version: 2,
  generatedAt: GENERATED_AT,
  evaluator: RULES_EVALUATOR,
  completion: { status: 'completed', traineeTurns: 7, evidence: 'sufficient', note: null },
  summary: {
    overall:
      "You handled the earlier bad experience well, apologised and took the case yourself. The path-length cause came out because you asked about changes. Next, ask the customer's own questions back.",
    overallScore: 3.8,
    coachingFocus: ['empathy-deescalation', 'ownership-next-steps'],
  },
  dimensions: [
    dimension(
      'opening-rapport',
      4,
      'sufficient',
      'A clear introduction and an apology for the month-end timing.',
      [[2, 'this is Sam from Microsoft support']],
      'Confirm the organisation early.',
    ),
    dimension(
      'scoping-discovery',
      4,
      'sufficient',
      'You asked which PCs, what changed and the exact message.',
      [
        [4, 'Which PCs are affected?'],
        [6, 'Did anything change yesterday evening'],
      ],
      'Ask what has already been tried.',
    ),
    dimension(
      'empathy-deescalation',
      4,
      'sufficient',
      'You apologised for the missed call back and the temperature fell.',
      [[4, "I'm sorry nobody called you back."]],
      'Say what will be different this time.',
    ),
    dimension(
      'clarity',
      3,
      'sufficient',
      'Mostly plain, with one recap at the end.',
      [[12, 'To recap: six finance PCs stopped syncing last night after a Windows update']],
      'Summarise earlier in the call, not only at the end.',
    ),
    dimension(
      'ownership-next-steps',
      4,
      'sufficient',
      'You took the case and gave a 3 PM update time.',
      [
        [4, "I'll take this case myself"],
        [10, "I'll call you by 3 PM with an update"],
      ],
      'Say what you will do if the update slips.',
    ),
    dimension(
      'closing',
      4,
      'sufficient',
      'You checked for anything else and thanked Tomasz.',
      [[14, 'Is there anything else I can help with?']],
      'Repeat the update time in your last sentence.',
    ),
  ],
  care: [
    principle(
      'communicate',
      'developing',
      'Clear questions and a recap, though the summary came only at the end.',
      [
        behaviour('communicate.introduction', 'Introduced themselves', 'shown', [
          [2, 'this is Sam from Microsoft support'],
        ]),
        behaviour('communicate.summary', 'Summarised the situation', 'partly', [
          [12, 'To recap: six finance PCs stopped syncing last night'],
        ]),
      ],
    ),
    principle(
      'accountable',
      'strong',
      'Took the case at once after the earlier poor experience and set an honest expectation with a time.',
      [
        behaviour('accountable.ownership', 'Took ownership', 'shown', [
          [4, "I'll take this case myself"],
        ]),
        behaviour('accountable.update-time', 'Named an update time', 'shown', [
          [10, "I'll call you by 3 PM"],
        ]),
      ],
    ),
    principle(
      'resourceful',
      'strong',
      'Found the cause by asking what changed and for the exact message.',
      [
        behaviour('resourceful.recent-changes', 'Asked about recent changes', 'shown', [
          [6, 'Did anything change yesterday evening'],
        ]),
      ],
    ),
    principle(
      'empathetic',
      'strong',
      'Apologised for the missed call back without excuses and acknowledged the month-end pressure.',
      [
        behaviour('empathetic.acknowledged-concern', 'Acknowledged the concern', 'shown', [
          [4, "I'm sorry nobody called you back."],
        ]),
      ],
    ),
  ],
  cbcf: CBCF_PENDING,
  strengths: [
    {
      dimension: 'empathy-deescalation',
      title: 'Owned the earlier failure',
      turnIndex: 4,
      quote: "I'm sorry nobody called you back. That isn't good enough",
      whyItHelped: 'A plain apology without excuses let the customer stop defending the point.',
    },
    {
      dimension: 'ownership-next-steps',
      title: 'Promised only what you could keep',
      turnIndex: 10,
      quote: "I can't promise a fix today until I've checked the path length",
      whyItHelped: 'The honest limit and a 3 PM update were easier to trust than a guess.',
    },
  ],
  improvements: [
    {
      dimension: 'clarity',
      title: 'Summarised only at the end',
      turnIndex: 12,
      quote: 'To recap: six finance PCs stopped syncing last night after a Windows update',
      risk: 'A recap earlier would have let Tomasz correct the picture before you committed to a time.',
      betterPhrasing:
        'So far, six PCs stopped syncing last night after an update. Is anything missing before I check the path length?',
      whyItWorks: 'An early summary catches gaps while there is still time to ask.',
    },
  ],
  discovery: discoveryOf([
    fact(
      'six-pcs',
      'All six finance PCs are affected',
      'important',
      'discovered',
      4,
      'Which PCs are affected?',
      'Every PC in finance, none outside it.',
      'Which PCs are affected?',
      'Scope separates a policy from a single device fault.',
    ),
    fact(
      'windows-update',
      'A Windows update was pushed yesterday evening',
      'critical',
      'discovered',
      6,
      'Did anything change yesterday evening, such as an update, a new sync policy or a folder rename?',
      'The admin pushed a Windows update that changed the sync client.',
      'Did anything change on the PCs yesterday?',
      'The update is the likeliest cause.',
    ),
    fact(
      'path-too-long',
      'The sync message says the path is too long',
      'critical',
      'discovered',
      8,
      'Can you read me the exact message when you hover over the red cross?',
      'The OneDrive message names a path length limit.',
      'What exact message do you see?',
      'The message names the cause.',
    ),
    fact(
      'tried-reset',
      'The admin already reset the sync client once',
      'helpful',
      'missed',
      null,
      null,
      'A reset was tried last night and did not help.',
      'What has already been tried?',
      'It saves repeating a step that already failed.',
    ),
  ]),
  journey: journeyOf(
    [
      point(0, 55, 'start', 0, 'Started frustrated: month-end close tomorrow'),
      point(
        2,
        63,
        'curveball',
        8,
        'The customer raised an earlier call that was never returned',
        "I'm sorry about the sync trouble so close to month-end.",
      ),
      point(
        4,
        50,
        'turning-point',
        -13,
        'Apologised and took the case',
        "I'm sorry nobody called you back. That isn't good enough",
      ),
      point(6, 43, 'turn', -7),
      point(8, 36, 'turn', -7),
      point(
        10,
        24,
        'turning-point',
        -12,
        'Gave an honest limit and a time',
        "I'll call you by 3 PM with an update",
      ),
      point(12, 19, 'turn', -5),
      point(14, 15, 'end', -4, 'Ended calm: a named owner and a time'),
    ],
    [
      reached('greeting', 2, 'this is Sam from Microsoft support'),
      reached('impact', 2, "I'm sorry about the sync trouble so close to month-end"),
      reached('discovery', 4, 'Which PCs are affected?'),
      reached('escalation', 4, "I'm sorry nobody called you back. That isn't good enough"),
      reached('ownership', 4, "I'll take this case myself"),
      reached('closure', 14, 'Is there anything else I can help with?'),
    ],
  ),
  curveball: {
    type: 'previous-bad-experience',
    firedAtTurn: 2,
    status: 'resolved',
    assessment:
      'You apologised without excuses and took the case yourself, and the customer’s tone eased straight away.',
  },
  nextPractice: {
    dimension: 'clarity',
    recommendation: 'Practise summarising after the first few answers, not only at the end.',
    suggestedDifficulty: 'challenge',
    suggestedScenarioId: 'intune-compliance-blocked',
    suggestedScenarioTitle: 'Devices blocked as non-compliant',
  },
  trainingNote: TRAINING_NOTE,
};

// ---- Call 5: a call saved before the Microsoft scenarios (report version 1) -------------------

const LEGACY_LINES = [
  'Hi, order entry has been slow around midday every day this week and the team is losing time.',
  "Hello Rhys, this is Sam from support. I'm sorry that's slowing the team down. How slow is it, seconds or minutes?",
  'More like minutes. It clears up after about twenty minutes.',
  'Is it everyone in the office, or only some people?',
  'Mostly the east office.',
  "Thanks. I'll look into this and call you back by 3 PM today.",
  'Fine.',
  'Is there anything else I can help with? Thank you, Rhys.',
  'No, thanks.',
] as const;

const LEGACY_SCENARIO: Scenario = {
  scenarioId: 'recurring-midday-slowdowns',
  title: 'Recurring midday slowdowns',
  summary: 'Order entry slows down at midday every working day.',
  issueType: 'slow-performance',
  tags: ['Performance'],
  estimatedMinutes: 8,
  product: null,
  caseReference: null,
  publicBrief: null,
  persona: { name: 'Rhys Evans', role: 'Head of operations', organisation: 'Northwind Traders' },
  brief: {
    situation: 'Rhys Evans runs operations at Northwind Traders.',
    goal: 'Find the pattern and agree the next update.',
    groundRules: [],
  },
  config: {
    impact: 'medium',
    startingTemperature: 'anxious',
    proficiency: 'intermediate',
    style: 'talkative',
    callStage: 'first-contact',
    difficulty: 'standard',
    mode: 'immersive',
    curveballsEnabled: false,
  },
  expectedDiscoveryAreas: ['When it happens', 'Who is affected'],
  coachingFocus: ['scoping-discovery'],
};

const LEGACY_REPORT: CoachingReport = {
  version: 1,
  generatedAt: GENERATED_AT,
  evaluator: RULES_EVALUATOR,
  completion: { status: 'completed', traineeTurns: 4, evidence: 'sufficient', note: null },
  summary: {
    overall:
      'A polite call that found the pattern and gave a time. More questions about when it starts and who is affected would firm up the cause.',
    overallScore: 3.3,
    coachingFocus: ['scoping-discovery'],
  },
  dimensions: [
    dimension(
      'opening-rapport',
      4,
      'sufficient',
      'You introduced yourself and apologised in the first turn.',
      [[2, 'this is Sam from support']],
      'Add the organisation.',
    ),
    dimension(
      'scoping-discovery',
      3,
      'sufficient',
      'You asked how slow and who was affected, but not when it began.',
      [[4, 'Is it everyone in the office, or only some people?']],
      'Ask when it started and what changed.',
    ),
    dimension(
      'empathy-deescalation',
      3,
      'sufficient',
      'You apologised for the disruption.',
      [[2, "I'm sorry that's slowing the team down."]],
      'Name the cost to the team.',
    ),
    dimension(
      'clarity',
      3,
      'sufficient',
      'Plain wording but no recap.',
      [],
      'Recap the pattern before you commit to a time.',
    ),
    dimension(
      'ownership-next-steps',
      3,
      'sufficient',
      'You gave a time but did not say what you would check.',
      [[6, "I'll look into this and call you back by 3 PM today."]],
      'Say what you will do by then.',
    ),
    dimension(
      'closing',
      4,
      'sufficient',
      'You checked for anything else and thanked Rhys.',
      [[8, 'Is there anything else I can help with?']],
      'Repeat the time.',
    ),
  ],
  strengths: [
    {
      dimension: 'ownership-next-steps',
      title: 'Gave a time for the update',
      turnIndex: 6,
      quote: "I'll look into this and call you back by 3 PM today.",
      whyItHelped: 'A time lets Rhys plan around the next update.',
    },
  ],
  improvements: [
    {
      dimension: 'scoping-discovery',
      title: 'Did not ask when it began',
      turnIndex: null,
      quote: null,
      risk: 'Without a start date, you cannot tell whether a change caused the slowdowns.',
      betterPhrasing: 'When did you first notice it, and did anything change around then?',
      whyItWorks: 'A start date lines up the slowdowns with recent changes.',
    },
    {
      dimension: 'clarity',
      title: 'Did not recap',
      turnIndex: 6,
      quote: "Thanks. I'll look into this and call you back by 3 PM today.",
      risk: 'Without a recap, Rhys cannot correct the picture before you act on it.',
      betterPhrasing:
        'So slowdowns at midday for about twenty minutes, mostly in the east office. Is that right?',
      whyItWorks: 'It lets the customer correct you early.',
    },
  ],
  discovery: discoveryOf([
    fact(
      'duration',
      'The slowdown lasts about twenty minutes',
      'important',
      'discovered',
      2,
      'How slow is it, seconds or minutes?',
      'It clears by itself after about twenty minutes.',
      'How long does it last?',
      'The duration points at a scheduled job.',
    ),
    fact(
      'east-office',
      'The east office is hit hardest',
      'important',
      'discovered',
      4,
      'Is it everyone in the office, or only some people?',
      'Most reports come from the east office.',
      'Who is affected most?',
      'Location points at the network path.',
    ),
    fact(
      'daily-job',
      'A new daily export starts at midday',
      'critical',
      'missed',
      null,
      null,
      'A new export job began running at midday last week.',
      'Did anything start running at midday recently?',
      'The job is the cause.',
    ),
  ]),
  journey: journeyOf([
    point(0, 30, 'start', 0, 'Started concerned'),
    point(2, 27, 'turn', -3),
    point(4, 24, 'turn', -3),
    point(
      6,
      20,
      'turning-point',
      -4,
      'Gave a time',
      "I'll look into this and call you back by 3 PM",
    ),
    point(8, 18, 'end', -2, 'Ended calm'),
  ]),
  curveball: null,
  nextPractice: {
    dimension: 'scoping-discovery',
    recommendation: 'Ask when the problem began and what changed before you set a time.',
    suggestedDifficulty: 'standard',
    suggestedScenarioId: 'recurring-midday-slowdowns',
    suggestedScenarioTitle: 'Recurring midday slowdowns',
  },
  trainingNote: TRAINING_NOTE,
};

// ---- Building the calls ---------------------------------------------------------------------

const SPECS = {
  strong: {
    id: 'fx-strong',
    scenario: STRONG_SCENARIO,
    lines: STRONG_LINES,
    report: STRONG_REPORT,
    markers: {
      4: [
        {
          kind: 'state',
          label: 'Asked a focused question about scope',
          detail: 'Customer temperature down (-8)',
          delta: -8,
        },
        { kind: 'discovery', label: 'Uncovered: Only sales-organised meetings are affected' },
      ],
      6: [
        { kind: 'discovery', label: 'Uncovered: Storage settings changed last week' },
        {
          kind: 'discovery',
          label: 'Partly uncovered: Most missing recordings were meetings with external guests',
        },
      ],
      8: [{ kind: 'discovery', label: 'Uncovered: The first recording went missing on Monday' }],
      10: [
        {
          kind: 'state',
          label: 'Gave a specific update time',
          detail: 'Customer temperature down (-11)',
          delta: -11,
        },
      ],
    },
  },
  weak: {
    id: 'fx-weak',
    scenario: WEAK_SCENARIO,
    lines: WEAK_LINES,
    report: WEAK_REPORT,
    markers: {
      4: [
        {
          kind: 'curveball',
          label: 'Curveball: customer asks for a manager',
          detail: 'Customer temperature up (+12)',
          delta: 12,
        },
      ],
    },
  },
  short: {
    id: 'fx-short',
    scenario: SHORT_SCENARIO,
    lines: SHORT_LINES,
    report: SHORT_REPORT,
    endedEarly: true,
    markers: { 2: [{ kind: 'state', label: 'Asked again what was already said', delta: 6 }] },
  },
  curveball: {
    id: 'fx-curveball',
    scenario: CURVEBALL_SCENARIO,
    lines: CURVEBALL_LINES,
    report: CURVEBALL_REPORT,
    markers: {
      2: [
        {
          kind: 'curveball',
          label: 'Curveball: customer mentions a bad earlier experience',
          detail: 'Customer temperature up (+8)',
          delta: 8,
        },
      ],
      4: [
        {
          kind: 'state',
          label: 'Apologised and took the case',
          detail: 'Customer temperature down (-13)',
          delta: -13,
        },
        { kind: 'discovery', label: 'Uncovered: All six finance PCs are affected' },
      ],
      6: [{ kind: 'discovery', label: 'Uncovered: A Windows update was pushed yesterday evening' }],
      8: [{ kind: 'discovery', label: 'Uncovered: The sync message says the path is too long' }],
      10: [
        {
          kind: 'state',
          label: 'Gave an honest limit and a time',
          detail: 'Customer temperature down (-12)',
          delta: -12,
        },
      ],
    },
  },
  legacy: {
    id: 'fx-legacy',
    scenario: LEGACY_SCENARIO,
    lines: LEGACY_LINES,
    report: LEGACY_REPORT,
    markers: {
      2: [{ kind: 'discovery', label: 'Uncovered: The slowdown lasts about twenty minutes' }],
      4: [{ kind: 'discovery', label: 'Uncovered: The east office is hit hardest' }],
    },
  },
} satisfies Record<string, CallSpec>;

/** A long call: the strong call, then thirty more exchanges, so a long transcript can be checked. */
function longSpec(): CallSpec {
  const lines: string[] = [...STRONG_LINES];
  let n = 1;
  while (lines.length < 63) {
    lines.push(
      `Thanks. Can you tell me a little more about example number ${n}, and what you saw when it happened?`,
      `It was the same each time: the recording did not appear in the chat (case ${n}).`,
    );
    n += 1;
  }
  const traineeTurns = lines.filter((_, i) => i % 2 === 1).length;
  const points: JourneyPoint[] = [point(0, 52, 'start', 0, 'Started frustrated')];
  for (let turn = 2; turn <= lines.length; turn += 2) {
    const temperature = Math.max(8, Math.round(52 - turn * 0.7));
    points.push(
      point(turn, temperature, turn === lines.length - 1 ? 'end' : 'turn', turn === 2 ? -5 : -1),
    );
  }
  const last = points[points.length - 1] as JourneyPoint;
  points[points.length - 1] = { ...last, kind: 'end' };
  return {
    id: 'fx-long',
    scenario: STRONG_SCENARIO,
    lines,
    report: {
      ...STRONG_REPORT,
      completion: { ...STRONG_REPORT.completion, traineeTurns },
      journey: journeyOf(points, STRONG_REPORT.journey.milestones),
    },
  };
}

export const CALL_NAMES = [
  'strong',
  'weak',
  'short',
  'curveball',
  'legacy',
  'voice',
  'long',
] as const;
export type CallName = (typeof CALL_NAMES)[number];

export interface CallFixture {
  name: CallName;
  /** The completed call exactly as `GET /api/sessions/:id` returns it. */
  session: SessionDTO;
  /** The same report as `session.report`. */
  report: CoachingReport;
}

const fixture = (name: CallName, spec: CallSpec): CallFixture => {
  const session = sessionFor(spec);
  return { name, session, report: spec.report };
};

/** The strong call, with the first five of the trainee's turns spoken aloud. */
const voiceSpec = (): CallSpec => ({
  ...SPECS.strong,
  id: 'fx-voice',
  spoken: [1, 2, 3, 4, 5],
});

export const CALLS: Record<CallName, CallFixture> = {
  strong: fixture('strong', SPECS.strong),
  weak: fixture('weak', SPECS.weak),
  short: fixture('short', SPECS.short),
  curveball: fixture('curveball', SPECS.curveball),
  legacy: fixture('legacy', SPECS.legacy),
  voice: fixture('voice', voiceSpec()),
  long: fixture('long', longSpec()),
};

/** The scenarios that exist now. Retired ones (like the legacy call's) are not in it. */
export const SCENARIO_INDEX = [
  {
    id: 'teams-recordings-missing',
    title: 'Teams meeting recordings are missing',
    difficulty: 'standard',
    product: { name: 'Microsoft Teams' },
  },
  {
    id: 'entra-mfa-lockout',
    title: 'Staff locked out after an MFA change',
    difficulty: 'challenge',
    product: { name: 'Microsoft Entra ID' },
  },
  {
    id: 'outlook-shared-calendar',
    title: 'Shared calendar is not updating',
    difficulty: 'starter',
    product: { name: 'Outlook' },
  },
  {
    id: 'onedrive-sync-stalled',
    title: 'OneDrive stopped syncing for finance',
    difficulty: 'standard',
    product: { name: 'OneDrive for Business' },
  },
  {
    id: 'intune-compliance-blocked',
    title: 'Devices blocked as non-compliant',
    difficulty: 'challenge',
    product: { name: 'Microsoft Intune' },
  },
] as const;

// ---- The same calls in the other states of the page -----------------------------------------

/** The call while the server is still building the report: no markers and no report yet. */
export function evaluatingSession(call: CallFixture, phase: EvaluationPhase): SessionDTO {
  return {
    ...call.session,
    status: 'completing',
    evaluationPhase: phase,
    completion: null,
    overallScore: null,
    dimensionScores: null,
    turns: call.session.turns.map(({ markers: _markers, ...turn }) => turn),
    report: null,
  };
}

/** The call after the evaluation failed. The messages are the ones the server really writes. */
export function failedSession(
  call: CallFixture,
  error: { message: string; retryable: boolean },
): SessionDTO {
  return {
    ...evaluatingSession(call, 'scoring'),
    status: 'evaluation_failed',
    evaluationPhase: null,
    evaluationError: error,
  };
}

/** A completed call whose stored report cannot be read (the server then sends `report: null`). */
export function unreadableReportSession(call: CallFixture): SessionDTO {
  return { ...call.session, report: null };
}

export const SERVER_EVALUATION_ERRORS = {
  internal: {
    message: 'The coaching report could not be generated. Your transcript is safe; try again.',
    retryable: true,
  },
  providerBusy: {
    message: 'The AI provider is busy right now. Please try again in a moment.',
    retryable: true,
  },
  notConfigured: {
    message: 'The AI provider rejected the credentials. Check the Firefly provider configuration.',
    retryable: false,
  },
} as const;

/** The same report with a different version of its optional parts, for the tests. */
export function asVersion1(report: CoachingReport): CoachingReport {
  const { care: _care, cbcf: _cbcf, ...rest } = report;
  const { milestones: _milestones, ...journey } = report.journey;
  return { ...rest, version: 1, journey };
}

export function withReport(call: CallFixture, report: CoachingReport): SessionDTO {
  return { ...call.session, report };
}
