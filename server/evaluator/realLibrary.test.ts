import { describe, expect, it } from 'vitest';
import { applyConfig, type EffectiveScenario } from '#shared/domain/config.ts';
import {
  CoachingReportSchema,
  type CareLevel,
  type CoachingReport,
} from '#shared/domain/report.ts';
import { CALL_STAGES, DIMENSION_IDS, type CallStage } from '#shared/domain/vocab.ts';
import type { EvaluationInput } from '#server/engine/types.ts';
import { getScenarioLibrary } from '../scenarios/index.ts';
import { assessCare } from './care/index.ts';
import { mergeModelDraft } from './merge.ts';
import { buildCallView } from './parts.ts';
import {
  careLevel,
  careStatus,
  classifiedFor,
  evaluate,
  expectQuotesVerified,
  milestone,
  NOW,
  type Line,
} from './testing.ts';
import { BUDGETS, wordCount } from './words.ts';

// The evaluator against the real scenario library: scripted calls, run through the real rules
// classifier, against every Microsoft scenario. This is the only evaluator file that reads the
// library, so the other tests do not move when the library does.

const LIBRARY = getScenarioLibrary();
const SUMMARIES: EvaluationInput['library'] = LIBRARY.map((s) => ({
  id: s.id,
  title: s.title,
  difficulty: s.difficulty,
  coachingFocus: s.coachingFocus,
}));
const scenarios: EffectiveScenario[] = LIBRARY.map((s) => applyConfig(s, {}, { seed: 3 }));
const firstName = (s: EffectiveScenario) => s.persona.name.split(' ')[0] as string;

const turn = (say: string, reply = 'Okay.'): Line => ({ say, reply });

// A good call for each stage, in words that name no product and no fact of any scenario. Each is
// five or six turns, enough for the call to count as sufficient evidence.
const GOOD: Record<CallStage, (name: string, said: string) => string[]> = {
  'first-contact': (name) => [
    `Hello ${name}, this is Sam from the Microsoft support team. What happens when you try?`,
    `I'm sorry this is getting in the way of your work, ${name}. Is it only you, or are other people affected too?`,
    'Which device or app are you using, and was anything changed shortly before it started?',
    "I'll own this and start looking into it now. I'll call you back at three with an update, even if I have no answer yet.",
    "Just to recap: I'll look into it now and call you at three, and you'll tell me if anything changes. Is that right?",
    `Is there anything else I can help with? Thank you, ${name}, goodbye.`,
  ],
  'follow-up': (name) => [
    `Hello ${name}, this is Sam from Microsoft support. I'm sorry you've had to chase this. I've read the case notes from your earlier call.`,
    "Here's where the case stands: I've checked what has been done so far and found the next step. I'll own this from here.",
    "I'll call you back at three with an update, even if I have no answer yet. Does that work for you?",
    "Just to recap: I've checked the case, I'll own it from here and I'll call you at three, and you'll tell me if anything changes. Is that right?",
    `Is there anything else I can help with? Thank you, ${name}, goodbye.`,
  ],
  escalated: (name) => [
    `Hello ${name}, this is Sam from Microsoft support. I'm sorry this has taken more than one call. I've read what happened before.`,
    "I've escalated it to our senior engineers, who will review it, and I'll stay your contact. I'll own this until it is fixed.",
    "I'll update you every day at ten until it is resolved, even when I have no news. Is that right?",
    "Just to recap: the senior engineers will review it, I'll stay your contact and I'll update you every day at ten. Is that right?",
    `Is there anything else I can help with? Thank you, ${name}, goodbye.`,
  ],
  closure: (name, said) => [
    `Hello ${name}, this is Sam from Microsoft support. You're calling to check this is sorted so we can close it, is that right?`,
    'Can you check whether everything is working as it should now?',
    `Just to recap, you told me ${said}, we found the cause and nothing more is needed from you. Are you happy for us to close this case?`,
    "I'll note on the case that it is resolved, and I'll stay your contact if it comes back.",
    `Is there anything else I can help with before we finish? Thank you, ${name}, goodbye.`,
  ],
};

const POOR = [
  'Hello.',
  'You should have checked that first. It will definitely be fixed in ten minutes.',
  'Okay, let me look.',
  'Bye.',
];

function goodCall(scenario: EffectiveScenario): EvaluationInput {
  const stage = scenario.config.callStage;
  const found = Object.fromEntries(scenario.hiddenFacts.map((f) => [f.id, 'discovered' as const]));
  // A recap is only worth credit when it plays back what the customer actually said.
  const said = (scenario.openingCore.split(/(?<=[.!?])\s/)[0] ?? scenario.openingCore).replace(
    /[.!?]+$/,
    '',
  );
  const lines = GOOD[stage](firstName(scenario), said).map((say, i) =>
    i === 1 ? { ...turn(say), finds: found } : turn(say),
  );
  return { ...classifiedFor(scenario, lines), library: SUMMARIES };
}

const poorCall = (scenario: EffectiveScenario): EvaluationInput => ({
  ...classifiedFor(
    scenario,
    POOR.map((say) => turn(say)),
  ),
  library: SUMMARIES,
});

const RANK: Record<CareLevel, number> = {
  'limited-evidence': -1,
  'not-yet': 0,
  developing: 1,
  strong: 2,
};
const PRINCIPALS = ['communicate', 'accountable', 'resourceful', 'empathetic'] as const;

describe('the library the tests run against', () => {
  it('has a scenario for every call stage, so every stage is exercised', () => {
    for (const stage of CALL_STAGES) {
      expect(
        scenarios.some((s) => s.config.callStage === stage),
        stage,
      ).toBe(true);
    }
    expect(scenarios.length).toBeGreaterThanOrEqual(12);
  });
});

describe.each(scenarios.map((s) => [s.scenarioId, s] as const))('%s', (_id, scenario) => {
  const stage = scenario.config.callStage;
  const goodInput = goodCall(scenario);
  const poorInput = poorCall(scenario);
  const good: CoachingReport = evaluate(goodInput);
  const poor: CoachingReport = evaluate(poorInput);

  it('gives a valid version 2 report for a good call and a poor one, with every quote verified', () => {
    for (const [report, input] of [
      [good, goodInput],
      [poor, poorInput],
    ] as const) {
      expect(CoachingReportSchema.safeParse(report).success).toBe(true);
      expect(report.version).toBe(2);
      expect(report.care?.map((p) => p.id)).toEqual([...PRINCIPALS]);
      expect(report.journey.milestones).toHaveLength(6);
      expect(report.cbcf?.status).toBe('awaiting-authoritative-source');
      expectQuotesVerified(report, input);
    }
  });

  it('holds both reports to the word budgets', () => {
    for (const report of [good, poor]) {
      expect(wordCount(report.summary.overall)).toBeLessThanOrEqual(BUDGETS.summaryWords);
      for (const s of report.strengths) {
        expect(wordCount(s.title) + wordCount(s.whyItHelped)).toBeLessThanOrEqual(
          BUDGETS.strengthWords,
        );
      }
      for (const i of report.improvements) {
        expect(wordCount(i.risk)).toBeLessThanOrEqual(BUDGETS.riskWords);
        expect(wordCount(i.betterPhrasing)).toBeLessThanOrEqual(BUDGETS.betterPhrasingWords);
      }
    }
  });

  it('rates the good call above the poor one for CARE, without rating the poor one well', () => {
    let better = 0;
    for (const p of PRINCIPALS) {
      expect(RANK[careLevel(good, p)], p).toBeGreaterThanOrEqual(RANK[careLevel(poor, p)]);
      if (RANK[careLevel(good, p)] > RANK[careLevel(poor, p)]) better += 1;
      expect(careLevel(poor, p), p).not.toBe('strong');
    }
    expect(better).toBeGreaterThanOrEqual(2);
    expect(careLevel(poor, 'accountable')).not.toBe('developing');
  });

  it('marks down the poor call for the blame and the promise nobody could keep', () => {
    expect(careStatus(poor, 'accountable.no-blame')).toBe('not-shown');
    expect(careStatus(poor, 'accountable.no-unsupported-promise')).toBe('not-shown');
    expect(careStatus(poor, 'empathetic.respectful-tone')).toBe('not-shown');
  });

  it('credits the good call for what its stage calls for', () => {
    const shown = (id: string) => expect(careStatus(good, id), id).toBe('shown');
    shown('communicate.greeting');
    shown('communicate.introduction');
    if (stage !== 'closure') {
      shown('accountable.ownership');
      shown('accountable.update-time');
    }
    if (stage === 'first-contact') shown('resourceful.environment');
    if (stage === 'follow-up') {
      shown('resourceful.known-evidence');
      shown('accountable.progress-update');
    }
    if (stage === 'escalated') shown('resourceful.escalation');
    if (stage === 'closure') {
      shown('resourceful.logical-investigation');
      shown('communicate.confirms-understanding');
      shown('communicate.summary');
    }
  });

  it('reaches the milestones a good call of this stage reaches, and none of them for the poor call', () => {
    for (const id of ['greeting', 'discovery', 'closure'] as const) {
      expect(milestone(good, id).status, id).toBe('reached');
    }
    // A closure call is not asked to take the problem on again.
    if (stage !== 'closure') expect(milestone(good, 'ownership').status).toBe('reached');
    expect(milestone(poor, 'ownership').status).toBe('not-reached');
    expect(milestone(poor, 'closure').status).toBe('not-reached');
  });

  it('reads the scenario\u2019s own careExpectations, and the good call meets more of them than the poor one', () => {
    const goodLinks = assessCare(buildCallView(goodInput)).expectations;
    const poorLinks = assessCare(buildCallView(poorInput)).expectations;
    expect(goodLinks.length).toBeGreaterThan(0);
    const met = (links: typeof goodLinks) => links.filter((l) => l.status === 'met').length;
    expect(met(goodLinks)).toBeGreaterThan(met(poorLinks));
  });

  it('does not coach a stage for what it does not call for', () => {
    const text = poor.improvements.map((i) => i.title).join(' | ');
    if (stage !== 'closure') expect(text).not.toMatch(/fix really worked|happy to close/i);
    if (stage !== 'escalated')
      expect(text).not.toMatch(/what the escalation means|regular update time/i);
    if (stage !== 'follow-up' && stage !== 'escalated')
      expect(text).not.toMatch(/acknowledge the wait or the history|earlier experience/i);
  });
});

describe('across the library', () => {
  it('lists the four principals once each for the good call of every scenario', () => {
    for (const scenario of scenarios) {
      const care = evaluate(goodCall(scenario)).care ?? [];
      expect(new Set(care.map((p) => p.id)).size, scenario.scenarioId).toBe(4);
    }
  });

  it('suggests only scenarios that are in the library, and never the call\u2019s own while others fit', () => {
    for (const scenario of scenarios) {
      const report = evaluate(poorCall(scenario));
      const id = report.nextPractice.suggestedScenarioId;
      expect(id === null || SUMMARIES.some((s) => s.id === id), scenario.scenarioId).toBe(true);
    }
  });

  it('copes with a call whose scenario has been retired from the library', () => {
    const [first] = scenarios;
    if (!first) throw new Error('The library is empty');
    const rest = SUMMARIES.filter((s) => s.id !== first.scenarioId);
    const input = { ...goodCall(first), library: rest };
    const report = evaluate(input);
    expect(CoachingReportSchema.safeParse(report).success).toBe(true);
    expect(report.nextPractice.suggestedScenarioId).not.toBe(first.scenarioId);
  });

  it('keeps the model path version 2 for a real scenario', () => {
    const [first] = scenarios;
    if (!first) throw new Error('The library is empty');
    const draft = {
      summary: 'You opened well. Keep asking one question at a time.',
      dimensions: DIMENSION_IDS.map((id) => ({
        id,
        score: 3,
        rationale: 'Scored from the transcript.',
        evidence: [],
        sufficiency: 'limited' as const,
        guidance: 'Try one thing.',
      })),
      strengths: [],
      improvements: [],
      nextPractice: {
        dimension: 'clarity' as const,
        recommendation: 'Explain it in one plain sentence.',
      },
    };
    const { report } = mergeModelDraft(
      draft,
      goodCall(first),
      { name: 'Model', version: 'evaluator-3', providerLabel: 'Test' },
      { now: NOW },
    );
    expect(report.version).toBe(2);
    expect(report.care).toHaveLength(4);
  });
});
