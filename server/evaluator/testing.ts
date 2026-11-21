import {
  emptyClassification,
  type EvidenceBehaviour,
  type TurnClassification,
} from '#shared/domain/classification.ts';
import { applyConfig, type EffectiveScenario } from '#shared/domain/config.ts';
import type {
  CareBehaviourResult,
  CareLevel,
  CoachingReport,
  Milestone,
  MilestoneId,
} from '#shared/domain/report.ts';
import { ScenarioDefinitionSchema, type ScenarioOverrides } from '#shared/domain/scenario.ts';
import {
  startingState,
  type CustomerState,
  type StateCategory,
  type StateEvent,
  type StateKey,
} from '#shared/domain/state.ts';
import { quoteInText } from '#shared/domain/text.ts';
import { expect } from 'vitest';
import { classifyTurnRules } from '#server/engine/classifier.ts';
import type { DiscoveryMap, EvaluationInput, TranscriptTurn } from '#server/engine/types.ts';
import { FIXTURE_LIBRARY, FIXTURE_SCENARIO } from './fixture.ts';
import { evaluateWithRules } from './rules.ts';

// Hand-built inputs for the evaluator tests. Each step is one trainee turn: what was said, what
// the classifier recorded (with quotes that must be verbatim), and what the customer's state did.
// The scenario is an inline fixture (./fixture.ts), never the scenario library, so these tests do
// not move when the library does.

/** [category, key, previous, next, reason, optional quote] */
export type EventSpec = [StateCategory, StateKey, number, number, string, string?];

export interface Step {
  say: string;
  reply?: string;
  cls?: Partial<TurnClassification>;
  evidence?: [EvidenceBehaviour, string][];
  events?: EventSpec[];
  finds?: Record<string, 'discovered' | 'partial'>;
}

export interface BuildOptions {
  endedEarly?: boolean;
  curveball?: Partial<CustomerState['curveball']>;
  finalTemperature?: number;
  library?: EvaluationInput['library'];
}

export const LIBRARY: EvaluationInput['library'] = FIXTURE_LIBRARY;

/** The fixture scenario, configured for a frustrated customer at Standard difficulty. */
export function makeScenario(overrides: ScenarioOverrides = {}): EffectiveScenario {
  return applyConfig(
    ScenarioDefinitionSchema.parse(FIXTURE_SCENARIO),
    { difficulty: 'standard', startingTemperature: 'frustrated', impact: 'medium', ...overrides },
    { seed: 3 },
  );
}

export function buildInput(
  scenario: EffectiveScenario,
  steps: Step[],
  options: BuildOptions = {},
): EvaluationInput {
  const cfg = scenario.config;
  const start = startingState({
    startingTemperature: cfg.startingTemperature,
    difficulty: cfg.difficulty,
    callStage: cfg.callStage,
    impact: cfg.impact,
  });
  const turns: TranscriptTurn[] = [
    {
      index: 1,
      role: 'customer',
      text: `${scenario.openingCore} ${scenario.impactVariant.summary}`,
    },
  ];
  const classifications: Record<number, TurnClassification> = {};
  const stateEvents: StateEvent[] = [];
  const discovery: DiscoveryMap = {};

  steps.forEach((step, i) => {
    const index = 2 + 2 * i;
    turns.push({ index, role: 'trainee', text: step.say });
    turns.push({ index: index + 1, role: 'customer', text: step.reply ?? 'Okay.' });
    for (const [, quote] of step.evidence ?? []) {
      if (!quoteInText(step.say, quote))
        throw new Error(`Fixture quote not in turn ${index}: ${quote}`);
    }
    classifications[index] = {
      ...emptyClassification(),
      ...step.cls,
      evidence: (step.evidence ?? []).map(([behaviour, quote]) => ({ behaviour, quote })),
    };
    for (const [category, key, previous, next, reason, evidenceQuote] of step.events ?? []) {
      stateEvents.push({
        turnIndex: index,
        key,
        previous,
        next,
        delta: next - previous,
        category,
        reason,
        ...(evidenceQuote ? { evidenceQuote } : {}),
      });
    }
    for (const [factId, status] of Object.entries(step.finds ?? {})) {
      discovery[factId] = { factId, status, turnIndex: index, question: step.say.slice(0, 220) };
    }
  });

  const lastTemperature = [...stateEvents].reverse().find((e) => e.key === 'temperature')?.next;
  const finalState: CustomerState = {
    ...start,
    temperature: options.finalTemperature ?? lastTemperature ?? start.temperature,
    curveball: { ...start.curveball, ...options.curveball },
  };

  return {
    scenario,
    turns,
    classifications,
    stateEvents,
    discovery,
    startState: start,
    finalState,
    endedEarly: options.endedEarly ?? false,
    durationSeconds: 420,
    provider: { kind: 'mock', label: 'Demo mode (no live model)' },
    library: options.library ?? LIBRARY,
  };
}

// ---------------------------------------------------------------------------------------
// A strong call: greets, scopes well, finds every hidden fact, explains in plain words,
// takes ownership and closes properly. Temperature 52 -> 10.

export const STRONG_STEPS: Step[] = [
  {
    say: "Hello Maya, this is Sam from the Northwind support team. I'm sorry you're stuck, especially with the front desk waiting on bookings. Can you tell me what happens when you try to sign in?",
    reply: "It won't let me in, and three of us are stuck.",
    cls: {
      introduces: true,
      empathy: 'specific',
      acknowledgesImpact: true,
      askedQuestion: true,
      discoveryIntents: ['problem_description'],
      clarity: 'clear',
    },
    evidence: [
      ['greeting', 'Hello Maya, this is Sam from the Northwind support team.'],
      ['introduction', 'Hello Maya, this is Sam from the Northwind support team.'],
      [
        'empathy-specific',
        "I'm sorry you're stuck, especially with the front desk waiting on bookings.",
      ],
      [
        'impact-acknowledged',
        "I'm sorry you're stuck, especially with the front desk waiting on bookings.",
      ],
      ['discovery-question', 'Can you tell me what happens when you try to sign in?'],
    ],
    events: [
      ['rapport', 'temperature', 52, 49, 'Opened with a greeting and an offer to help'],
      ['empathy', 'temperature', 49, 42, 'Showed specific empathy for the customer’s situation'],
      ['impact', 'temperature', 42, 34, 'Acknowledged the business impact'],
      ['impact', 'trust', 40, 46, 'Acknowledged the business impact'],
    ],
  },
  {
    say: 'Thanks. Can you read me exactly what the message says on the sign-in screen?',
    reply: 'It says my account has been temporarily locked because of too many sign-in attempts.',
    cls: {
      askedQuestion: true,
      discoveryIntents: ['error_message'],
      factTargets: [{ id: 'hf-lockout-message', strength: 'full' }],
    },
    evidence: [
      [
        'discovery-question',
        'Can you read me exactly what the message says on the sign-in screen?',
      ],
    ],
    events: [
      [
        'discovery',
        'temperature',
        34,
        33,
        'Asked a focused question that uncovered new information',
      ],
    ],
    finds: { 'hf-lockout-message': 'discovered' },
  },
  {
    say: 'Is your work email signed in on any other device, like your phone, that might still have the old password?',
    reply: 'Yes, my work email is on my phone, and it keeps asking me for the password.',
    cls: {
      askedQuestion: true,
      discoveryIntents: ['environment'],
      factTargets: [{ id: 'hf-phone-old-password', strength: 'full' }],
    },
    evidence: [
      [
        'discovery-question',
        'Is your work email signed in on any other device, like your phone, that might still have the old password?',
      ],
    ],
    events: [
      [
        'discovery',
        'temperature',
        33,
        31,
        'Asked a focused question that uncovered new information',
      ],
    ],
    finds: { 'hf-phone-old-password': 'discovered' },
  },
  {
    say: 'When did it start, and what have you tried so far?',
    reply:
      "I'm sorry to rush you, but the first patients arrive at nine and I can't check anyone in without the portal.",
    cls: {
      askedQuestion: true,
      discoveryIntents: ['timing_onset', 'already_tried'],
      factTargets: [
        { id: 'hf-reset-timing', strength: 'full' },
        { id: 'hf-tried-colleague', strength: 'full' },
      ],
    },
    evidence: [['discovery-question', 'When did it start, and what have you tried so far?']],
    events: [
      [
        'discovery',
        'temperature',
        31,
        30,
        'Asked a focused question that uncovered new information',
      ],
      ['curveball', 'temperature', 30, 36, 'Curveball: customer imposes a deadline'],
    ],
    finds: { 'hf-reset-timing': 'discovered', 'hf-tried-colleague': 'discovered' },
  },
  {
    say: "I can see the first patients arrive at nine, so let's move quickly. Your new password was saved correctly. Your phone kept trying the old password, so the account locked itself, which is called a lockout.",
    reply: 'Oh, that makes sense. I thought it had not saved.',
    cls: {
      acknowledgesImpact: true,
      correctsAssumption: true,
      jargon: 'explained',
      clarity: 'clear',
    },
    evidence: [
      [
        'impact-acknowledged',
        "I can see the first patients arrive at nine, so let's move quickly.",
      ],
      ['corrects-assumption', 'Your new password was saved correctly.'],
      [
        'jargon-explained',
        'Your phone kept trying the old password, so the account locked itself, which is called a lockout.',
      ],
    ],
    events: [
      ['impact', 'temperature', 36, 34, 'Acknowledged the impact again'],
      [
        'curveball',
        'temperature',
        34,
        28,
        'Handled the curveball well (customer imposes a deadline)',
      ],
      ['clarity', 'temperature', 28, 27, 'Respectfully tested the customer’s assumption'],
    ],
  },
  {
    say: "I know the front desk is waiting, so I'll unlock the account now and stay with this until you're back in. Please remove the old password from your phone. I'll call you back at nine to check you can sign in.",
    reply: 'Thank you, I will do that now.',
    cls: {
      empathy: 'specific',
      ownership: 'clear',
      nextSteps: 'specific',
      confirmsNextContact: true,
      troubleshooting: true,
    },
    evidence: [
      [
        'empathy-specific',
        "I know the front desk is waiting, so I'll unlock the account now and stay with this until you're back in.",
      ],
      ['ownership-clear', "I'll unlock the account now and stay with this until you're back in."],
      ['next-steps-specific', "I'll call you back at nine to check you can sign in."],
      ['next-contact', "I'll call you back at nine to check you can sign in."],
      ['troubleshooting', 'Please remove the old password from your phone.'],
    ],
    events: [
      ['ownership', 'temperature', 27, 21, 'Took clear ownership'],
      ['ownership', 'ownershipConfidence', 40, 65, 'Took clear ownership'],
      ['next-steps', 'temperature', 21, 16, 'Gave specific next steps with a time'],
    ],
    // Empathy this turn is covered by the ownership sentence; no separate event was recorded.
  },
  {
    say: "Just to recap: I've unlocked the account, you'll update the password on your phone, and I'll call you back at nine to check. Is there anything else I can help with? Thanks, Maya, take care.",
    reply: 'No, that is everything. Thank you, bye.',
    cls: {
      summarises: true,
      wrapsUp: true,
      asksAnythingElse: true,
      confirmsNextContact: true,
      clarity: 'clear',
    },
    evidence: [
      [
        'summary',
        "Just to recap: I've unlocked the account, you'll update the password on your phone, and I'll call you back at nine to check.",
      ],
      [
        'wrap-up',
        "Just to recap: I've unlocked the account, you'll update the password on your phone, and I'll call you back at nine to check.",
      ],
      ['anything-else', 'Is there anything else I can help with?'],
      ['thanks', 'Thanks, Maya, take care.'],
    ],
    events: [
      ['summary', 'temperature', 16, 12, 'Summarised their understanding'],
      [
        'closing',
        'temperature',
        12,
        10,
        'Closed with a summary or a check that everything is clear',
      ],
    ],
  },
];

export const STRONG_OPTIONS: BuildOptions = {
  curveball: {
    status: 'resolved',
    type: 'deadline',
    firedAtTurn: 8,
    resolvedAtTurn: 10,
    firedCount: 1,
  },
};

export function strongCall(scenario = makeScenario()): EvaluationInput {
  return buildInput(scenario, STRONG_STEPS, STRONG_OPTIONS);
}

// ---------------------------------------------------------------------------------------
// A weak call: no greeting, fixes before understanding, jargon, blame, a dismissal, a repeated
// question, an unverified promise and no closing. Temperature 52 -> 91.

export const WEAK_STEPS: Step[] = [
  {
    say: 'Reset your password again and clear your cache.',
    reply: "I just changed it this morning, and it still won't let me in.",
    cls: { troubleshooting: true, jargon: 'unexplained' },
    evidence: [
      ['troubleshooting', 'Reset your password again and clear your cache.'],
      ['jargon-unexplained', 'Reset your password again and clear your cache.'],
    ],
    events: [
      ['rapport', 'temperature', 52, 54, 'Started without a greeting or introduction'],
      [
        'premature-troubleshooting',
        'temperature',
        54,
        59,
        'Jumped into fixes before understanding the situation',
      ],
      [
        'premature-troubleshooting',
        'trust',
        40,
        36,
        'Jumped into fixes before understanding the situation',
      ],
      ['jargon', 'temperature', 59, 64, 'Used technical terms the customer did not understand'],
    ],
  },
  {
    say: "You should have read the reminder email before changing it. That's not a big deal.",
    reply: "I don't think that's fair.",
    cls: { blame: true, dismissive: true },
    evidence: [
      ['blame', 'You should have read the reminder email before changing it.'],
      ['dismissive', "That's not a big deal."],
    ],
    events: [
      ['blame', 'temperature', 64, 74, 'Blamed the customer or another team'],
      ['blame', 'trust', 36, 26, 'Blamed the customer or another team'],
      ['dismissal', 'temperature', 74, 84, 'Dismissed the customer’s concern'],
    ],
  },
  {
    say: 'What is the problem again? Can you tell me?',
    reply: "I've told you already: I can't sign in.",
    cls: { askedQuestion: true, discoveryIntents: ['problem_description'] },
    evidence: [['discovery-question', 'What is the problem again?']],
    events: [
      [
        'repetition',
        'temperature',
        84,
        89,
        'Asked about something the customer had already answered',
      ],
    ],
  },
  {
    say: 'It will definitely be fixed in 10 minutes.',
    reply: 'Really? You can promise that?',
    cls: { promise: 'unverified' },
    evidence: [['promise-unverified', 'It will definitely be fixed in 10 minutes.']],
    events: [
      [
        'promise',
        'temperature',
        89,
        91,
        'Promised an outcome or time that could not yet be verified',
      ],
      ['promise', 'trust', 26, 20, 'Promised an outcome or time that could not yet be verified'],
    ],
  },
  {
    say: 'Someone will look at it soon.',
    reply: 'Who? When?',
    cls: { ownership: 'vague', nextSteps: 'vague' },
    evidence: [
      ['ownership-vague', 'Someone will look at it soon.'],
      ['next-steps-vague', 'Someone will look at it soon.'],
    ],
    events: [],
  },
  {
    say: 'Ok, I have to go now.',
    reply: 'Hello?',
    cls: {},
    events: [],
  },
];

export function weakCall(scenario = makeScenario()): EvaluationInput {
  return buildInput(scenario, WEAK_STEPS, { endedEarly: true });
}

/** Trainee lines with a plain classification each, for rules that look at one behaviour. */
export function simpleCall(
  lines: Step[],
  scenarioOverrides: ScenarioOverrides = {},
  options: BuildOptions = {},
): EvaluationInput {
  return buildInput(makeScenario(scenarioOverrides), lines, options);
}

/** One scripted trainee line for a call that runs through the real rules classifier. */
export interface Line {
  say: string;
  reply?: string;
  /** Applied on top of what the rules classifier recorded for this line. */
  cls?: Partial<TurnClassification>;
  events?: EventSpec[];
  finds?: Step['finds'];
}

/**
 * A call whose trainee lines are classified by the real rules classifier, so the flags and the
 * evidence quotes are the ones the product records for those words. The customer's replies, the
 * state events and the discovery records are scripted by the test.
 */
export function classified(
  lines: (string | Line)[],
  scenarioOverrides: ScenarioOverrides = {},
  options: BuildOptions = {},
): EvaluationInput {
  return classifiedFor(makeScenario(scenarioOverrides), lines, options);
}

/** The same, for a scenario the test built itself (for example one from the scenario library). */
export function classifiedFor(
  scenario: EffectiveScenario,
  lines: (string | Line)[],
  options: BuildOptions = {},
): EvaluationInput {
  const steps = lines.map((line, i): Step => {
    const scripted: Line = typeof line === 'string' ? { say: line } : line;
    const { evidence, ...flags } = classifyTurnRules(scripted.say, {
      scenario,
      traineeTurnNumber: i + 1,
    });
    return {
      say: scripted.say,
      ...(scripted.reply ? { reply: scripted.reply } : {}),
      cls: { ...flags, ...scripted.cls },
      evidence: evidence.map((e): [EvidenceBehaviour, string] => [e.behaviour, e.quote]),
      ...(scripted.events ? { events: scripted.events } : {}),
      ...(scripted.finds ? { finds: scripted.finds } : {}),
    };
  });
  return buildInput(scenario, steps, options);
}

/** Every quote in a report, with the trainee turn it cites. */
export function citedQuotes(
  report: CoachingReport,
): { where: string; turnIndex: number | null; quote: string }[] {
  const out: { where: string; turnIndex: number | null; quote: string }[] = [];
  for (const d of report.dimensions)
    for (const e of d.evidence) out.push({ where: `${d.id} evidence`, ...e });
  for (const s of report.strengths)
    out.push({ where: 'strength', turnIndex: s.turnIndex, quote: s.quote });
  for (const i of report.improvements)
    if (i.quote) out.push({ where: 'improvement', turnIndex: i.turnIndex, quote: i.quote });
  for (const r of report.discovery.results)
    if (r.revealingQuestion)
      out.push({ where: 'discovery', turnIndex: r.revealedAtTurn, quote: r.revealingQuestion });
  for (const p of report.journey.points)
    if (p.quote) out.push({ where: 'journey', turnIndex: p.turnIndex, quote: p.quote });
  for (const principal of report.care ?? [])
    for (const b of principal.behaviours)
      for (const e of b.evidence) out.push({ where: `care ${b.id}`, ...e });
  for (const m of report.journey.milestones ?? [])
    if (m.quote) out.push({ where: `milestone ${m.id}`, turnIndex: m.turnIndex, quote: m.quote });
  return out;
}

export type CarePrincipleId = 'communicate' | 'accountable' | 'resourceful' | 'empathetic';

/** What a report says about one CARE behaviour, or 'unlisted' when the report does not list it. */
export function careStatus(
  report: CoachingReport,
  id: string,
): CareBehaviourResult['status'] | 'unlisted' {
  const row = report.care?.flatMap((p) => p.behaviours).find((b) => b.id === id);
  return row?.status ?? 'unlisted';
}

export function careBehaviour(report: CoachingReport, id: string): CareBehaviourResult | undefined {
  return report.care?.flatMap((p) => p.behaviours).find((b) => b.id === id);
}

export function careLevel(report: CoachingReport, principal: CarePrincipleId): CareLevel {
  const found = report.care?.find((p) => p.id === principal);
  if (!found) throw new Error(`The report has no ${principal} principal`);
  return found.level;
}

export function milestone(report: CoachingReport, id: MilestoneId): Milestone {
  const found = report.journey.milestones?.find((m) => m.id === id);
  if (!found) throw new Error(`The report has no ${id} milestone`);
  return found;
}

export const NOW = new Date('2026-03-01T10:00:00Z');

/** The rules evaluator's report for a call, generated at a fixed time. */
export const evaluate = (input: EvaluationInput): CoachingReport =>
  evaluateWithRules(input, { now: NOW });

/** Fails unless every quote is a short, verbatim part of the trainee turn it cites. */
export function expectQuotesVerified(report: CoachingReport, input: EvaluationInput): void {
  for (const { where, turnIndex, quote } of citedQuotes(report)) {
    const turn = input.turns.find((t) => t.index === turnIndex);
    expect(turn?.role, `${where}: turn ${turnIndex} must be a trainee turn`).toBe('trainee');
    expect(
      quoteInText(turn?.text ?? '', quote),
      `${where}: "${quote}" not in turn ${turnIndex}`,
    ).toBe(true);
    expect(quote.length, `${where}: quote too long`).toBeLessThanOrEqual(170);
  }
}
