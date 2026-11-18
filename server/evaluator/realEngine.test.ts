import { describe, expect, it } from 'vitest';
import type { TurnClassification } from '#shared/domain/classification.ts';
import { applyConfig } from '#shared/domain/config.ts';
import type { CoachingReport, EvaluationDraft } from '#shared/domain/report.ts';
import { startingState } from '#shared/domain/state.ts';
import { sentences } from '#shared/domain/text.ts';
import type { EvaluationInput } from '#server/engine/types.ts';
import { simulate } from '../engine/simulate.ts';
import { getScenarioLibrary } from '../scenarios/index.ts';
import { mergeModelDraft } from './merge.ts';
import { evaluateWithRules } from './rules.ts';
import { expectQuotesVerified } from './testing.ts';

// Regression tests on reports for conversations that ran through the real simulation engine, so
// the wording is checked against the state events and classifications the product really produces.

const NOW = new Date('2026-03-01T10:00:00Z');

const CALLS = {
  good: [
    "Hello, this is Sam from support. I'm sorry this is happening and I can see how much it matters to you. Can you tell me exactly what you see when it fails?",
    'Thank you. Is everyone affected, or is anything still working?',
    'Was anything changed or updated shortly before it started, even something small?',
    "I'll take ownership of this. I'll look into it now and call you back at 9:30 with an update, even if I have no fix yet.",
    "To recap: I'm looking into it now and I'll call you at 9:30. Is there anything else I can help with? Thank you, goodbye.",
  ],
  poor: [
    'Have you tried restarting? Reset it and clear your cache.',
    'You should have checked the status page. That is not a big deal.',
    'It will definitely be fixed in 10 minutes.',
    'We will get back to you soon.',
    'ok',
  ],
  terse: ['hi', 'what happens', 'when', 'ok will check', 'bye'],
  middling: [
    'Hi, this is Sam from support. Can you tell me what is happening?',
    'I understand this is frustrating. What does the error message say exactly?',
    'Who else is affected, and when did it start?',
    'Let me look into it.',
    "I'll call you back at four.",
  ],
} as const;

const library = getScenarioLibrary();

// The good call from the review: five turns on the "checkout outage" challenge.
const CHECKOUT_GOOD = [
  "Hello Declan, this is Sam from Contoso support. I'm sorry checkout is down; with your CEO presenting at 11:00 I can see how much is riding on this. Can you tell me exactly what customers see when they press pay?",
  'Thank you. Is it failing for every storefront and every region, or is anything still working?',
  'Was anything changed or updated on your side shortly before it started, even something small or routine?',
  "I'll take ownership of this, Declan. I'll escalate it to our engineers now and call you back at 9:30 with an update, even if I have no fix yet.",
  "To recap: payments fail at the pay step on three storefronts since 07:40, I'm escalating now and I'll call you at 9:30. Is there anything else I can help with? Thank you, Declan.",
];

async function evaluate(
  scenarioId: string,
  difficulty: 'starter' | 'standard' | 'challenge',
  lines: readonly string[],
  endedEarly = false,
): Promise<{ input: EvaluationInput; report: CoachingReport }> {
  const base = library.find((s) => s.id === scenarioId);
  if (!base) throw new Error(`No scenario ${scenarioId}`);
  const scenario = applyConfig(base, { difficulty });
  const sim = await simulate(scenario, [...lines]);
  const classifications: Record<number, TurnClassification> = {};
  sim.turns.forEach((t, i) => (classifications[2 + 2 * i] = t.classification));
  const input: EvaluationInput = {
    scenario,
    turns: sim.transcript,
    classifications,
    stateEvents: sim.events,
    discovery: sim.runtime.discovery,
    startState: startingState({
      startingTemperature: scenario.config.startingTemperature,
      difficulty: scenario.config.difficulty,
      callStage: scenario.config.callStage,
      impact: scenario.config.impact,
    }),
    finalState: sim.runtime.customer,
    endedEarly,
    durationSeconds: 300,
    provider: { kind: 'mock', label: 'Demo mode (no live model)' },
    library: library.map((s) => ({
      id: s.id,
      title: s.title,
      difficulty: s.difficulty,
      coachingFocus: s.coachingFocus,
    })),
  };
  return { input, report: evaluateWithRules(input, { now: NOW }) };
}

// Words of the trainee, and facts written into the scenario, are not the evaluator's wording.
const NOT_EVALUATOR_TEXT = new Set([
  'quote',
  'revealingQuestion',
  'whatWasHidden',
  'betterQuestion',
  'label',
]);

/** Every string of the report that the evaluator wrote, with where it was found. */
function evaluatorText(value: unknown, path = 'report'): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => evaluatorText(v, `${path}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, v]) =>
      NOT_EVALUATOR_TEXT.has(key) ? [] : evaluatorText(v, `${path}.${key}`),
    );
  }
  return [];
}

const outsideQuotes = (text: string) =>
  text.replace(/\u201c[^\u201d]*\u201d/g, '\u201cQUOTE\u201d');

const RAW_MOOD_NUMBER = /\b(?:temperature|trust|confidence|patience|urgency)\b[^.]*\b\d{2,3}\b/i;

/** A draft that repeats the rules report word for word, as a model that agreed with it would. */
function agreeingDraft(report: CoachingReport): EvaluationDraft {
  return {
    summary: report.summary.overall.slice(0, 780),
    dimensions: report.dimensions.map((d) => ({
      id: d.id,
      score: d.score,
      rationale: d.rationale.slice(0, 480),
      evidence: d.evidence,
      sufficiency: d.sufficiency,
      guidance: d.guidance.slice(0, 380),
    })),
    strengths: report.strengths.map((s) => ({
      dimension: s.dimension,
      turnIndex: s.turnIndex,
      quote: s.quote,
      whyItHelped: s.whyItHelped.slice(0, 290),
    })),
    improvements: report.improvements.map((i) => ({
      dimension: i.dimension,
      turnIndex: i.turnIndex,
      quote: i.quote,
      risk: i.risk.slice(0, 290),
      betterPhrasing: i.betterPhrasing.slice(0, 390),
      whyItWorks: i.whyItWorks.slice(0, 290),
    })),
    nextPractice: {
      dimension: report.nextPractice.dimension,
      recommendation: report.nextPractice.recommendation.slice(0, 390),
    },
  };
}

describe('the checkout outage call from the review', () => {
  it('describes the customer in words and gives two opportunities and a natural summary', async () => {
    const { report } = await evaluate(
      'checkout-outage-before-investor-event',
      'challenge',
      CHECKOUT_GOOD,
      true,
    );
    for (const [path, text] of evaluatorText(report)) {
      expect(text, path).not.toMatch(RAW_MOOD_NUMBER);
    }
    const strength = report.strengths.find((s) => s.title.startsWith('Acknowledged'));
    expect(strength?.whyItHelped).toMatch(
      /Declan's temperature eased a little \(Angry to Frustrated\)/,
    );
    expect(report.improvements.length).toBeGreaterThanOrEqual(2);
    expect(report.improvements.map((i) => i.title)).toContain(
      'Did not find out: one regional storefront still works',
    );
    const summary = outsideQuotes(report.summary.overall);
    expect(sentences(summary).length).toBeLessThanOrEqual(3);
    expect(summary).toMatch(/The biggest opportunity is to ask whether every customer/);
    expect(summary).toMatch(
      /You uncovered 2 of the 6 hidden facts; the biggest gap was an important fact \(one regional storefront still works\)\./,
    );
    expect(summary).not.toMatch(/\ba important\b|missed:|:\s+[A-Z]/);
  });

  it('describes clarity by what was seen, never by a count of clear turns', async () => {
    const { report } = await evaluate(
      'checkout-outage-before-investor-event',
      'challenge',
      CHECKOUT_GOOD,
    );
    const clarity = report.dimensions.find((d) => d.id === 'clarity');
    expect(clarity?.rationale).toMatch(/played the situation back/);
    expect(clarity?.rationale).not.toMatch(/\d+ of your \d+ turns?|was clear|were clear/);
  });
});

describe('reports for real engine conversations', () => {
  const setups = library.flatMap((s) =>
    (['starter', 'standard', 'challenge'] as const).map((difficulty) => ({
      id: s.id,
      difficulty,
    })),
  );

  it('never print a raw temperature, trust, confidence, patience or urgency value', async () => {
    const found: string[] = [];
    for (const { id, difficulty } of setups) {
      for (const [name, lines] of Object.entries(CALLS)) {
        const { report } = await evaluate(id, difficulty, lines);
        for (const [path, text] of evaluatorText(report)) {
          if (RAW_MOOD_NUMBER.test(text))
            found.push(`${id}/${difficulty}/${name} ${path}: ${text}`);
        }
      }
    }
    expect(found).toEqual([]);
  });

  it('read as prose, give two or three opportunities, and cite only verified quotes', async () => {
    const found: string[] = [];
    for (const { id, difficulty } of setups) {
      for (const [name, lines] of Object.entries(CALLS)) {
        const where = `${id}/${difficulty}/${name}`;
        const { input, report } = await evaluate(id, difficulty, lines);
        const summary = outsideQuotes(report.summary.overall);
        if (sentences(summary).length > 3) found.push(`${where}: more than three sentences`);
        if (sentences(summary).length < 2) found.push(`${where}: fewer than two sentences`);
        if (/[:;]\s+[A-Z]/.test(summary)) found.push(`${where}: capital after a colon: ${summary}`);
        if (/\b[Aa] (?=[aei])|\b[Aa]n (?=[^aeiouAEIOU\s])/.test(summary)) {
          found.push(`${where}: wrong article: ${summary}`);
        }
        const clarity = report.dimensions.find((d) => d.id === 'clarity')?.rationale ?? '';
        if (/\d+ of your \d+ turns?/.test(clarity)) found.push(`${where}: counts clear turns`);
        if (report.improvements.length < 2 || report.improvements.length > 3) {
          found.push(`${where}: ${report.improvements.length} improvements`);
        }
        for (const [path, text] of evaluatorText(report)) {
          if (/undefined|\bnull\b|NaN|\[object/.test(text)) found.push(`${where} ${path}: ${text}`);
        }
        for (const point of report.journey.points) {
          if (/\d/.test(point.reason ?? '')) found.push(`${where}: a number in a journey reason`);
        }
        try {
          expectQuotesVerified(report, input);
        } catch (error) {
          found.push(`${where}: ${(error as Error).message}`);
        }
      }
    }
    expect(found).toEqual([]);
  });

  it('are left untouched when a model repeats them, so the evaluator never trips its own guard', async () => {
    const found: string[] = [];
    for (const { id, difficulty } of setups) {
      for (const [name, lines] of Object.entries(CALLS)) {
        const { input, report } = await evaluate(id, difficulty, lines);
        const { warnings } = mergeModelDraft(
          agreeingDraft(report),
          input,
          { name: 'Model', version: '1', providerLabel: 'Test' },
          { now: NOW },
        );
        if (warnings.length > 0) found.push(`${id}/${difficulty}/${name}: ${warnings.join(' | ')}`);
      }
    }
    expect(found).toEqual([]);
  });

  it('keep short calls honest: no gap in what was found, no stretch, no overall score', async () => {
    for (const { id, difficulty } of setups.filter((s) => s.difficulty === 'standard')) {
      const { report } = await evaluate(id, difficulty, CALLS.good.slice(0, 2), true);
      expect(report.summary.overallScore).toBeNull();
      expect(report.completion.evidence).toBe('insufficient');
      expect(report.summary.overall).not.toMatch(/biggest gap/);
      expect(report.improvements.some((i) => i.title.startsWith('Stretch'))).toBe(false);
      for (const [path, text] of evaluatorText(report)) {
        expect(text, path).not.toMatch(RAW_MOOD_NUMBER);
      }
    }
  });
});
