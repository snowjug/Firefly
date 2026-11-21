import { describe, expect, it } from 'vitest';
import { CoachingReportSchema, type EvaluationDraft } from '#shared/domain/report.ts';
import { DIMENSION_IDS } from '#shared/domain/vocab.ts';
import type { EvaluationInput } from '#server/engine/types.ts';
import { mergeModelDraft } from './merge.ts';
import { evaluateWithRules } from './rules.ts';
import {
  buildInput,
  expectQuotesVerified,
  makeScenario,
  NOW,
  STRONG_STEPS,
  strongCall,
  weakCall,
} from './testing.ts';
import { BUDGETS, wordCount } from './words.ts';

// The model evaluator path. A model writes scores and coaching text; CARE, the CBCF status and the
// journey milestones are read from the transcript by the rules layer for every report, so a model
// can neither decide them nor change them. Its quotes are checked again, and its text is held to
// the same word budgets.

const META = { name: 'Model', version: 'evaluator-3', providerLabel: 'Test model' };
const OPENING = 'Hello Maya, this is Sam from the Northwind support team.';
const OWNERSHIP = "I'll unlock the account now and stay with this until you're back in.";
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');

function draft(patch: Partial<EvaluationDraft> = {}): EvaluationDraft {
  return {
    summary: 'You opened well and found every hidden fact. Keep asking one question at a time.',
    dimensions: DIMENSION_IDS.map((id) => ({
      id,
      score: 4,
      rationale: `Why ${id} scored this way.`,
      evidence: [{ turnIndex: 2, quote: OPENING }],
      sufficiency: 'sufficient' as const,
      guidance: `Guidance for ${id}.`,
    })),
    strengths: [
      {
        dimension: 'ownership-next-steps',
        turnIndex: 12,
        quote: OWNERSHIP,
        whyItHelped: 'It named who owned the next step.',
      },
    ],
    improvements: [
      {
        dimension: 'closing',
        turnIndex: null,
        quote: null,
        risk: 'No time was agreed for the next contact.',
        betterPhrasing: "I'll call you back at nine to check, Maya.",
        whyItWorks: 'A named time means the customer does not have to chase.',
      },
    ],
    nextPractice: {
      dimension: 'clarity',
      recommendation: 'Explain the lockout in one plain sentence.',
    },
    ...patch,
  };
}

const model = (d: EvaluationDraft, input: EvaluationInput = strongCall()) =>
  mergeModelDraft(d, input, META, { now: NOW });

describe('a model-evaluated report', () => {
  const input = strongCall();
  const { report } = model(draft(), input);

  it('is version 2 and carries CARE, the pending CBCF status and six milestones', () => {
    expect(report.version).toBe(2);
    expect(report.evaluator.kind).toBe('model');
    expect(report.care?.map((p) => p.id)).toEqual([
      'communicate',
      'accountable',
      'resourceful',
      'empathetic',
    ]);
    expect(report.cbcf?.status).toBe('awaiting-authoritative-source');
    expect(report.journey.milestones).toHaveLength(6);
  });

  it('round-trips through the report schema', () => {
    expect(CoachingReportSchema.parse(JSON.parse(JSON.stringify(report)))).toEqual(report);
  });

  it('carries exactly what the rules evaluator reads from the same call', () => {
    for (const call of [
      strongCall(),
      weakCall(),
      buildInput(makeScenario(), STRONG_STEPS.slice(0, 2), { endedEarly: true }),
    ]) {
      const rules = evaluateWithRules(call, { now: NOW });
      const merged = model(draft(), call).report;
      expect(merged.care).toEqual(rules.care);
      expect(merged.cbcf).toEqual(rules.cbcf);
      expect(merged.journey.milestones).toEqual(rules.journey.milestones);
    }
  });
});

describe('what a model cannot decide', () => {
  it('leaves CARE and the milestones as the transcript shows them, whatever the draft claims', () => {
    const call = weakCall();
    const rules = evaluateWithRules(call, { now: NOW });
    const boasting = draft({
      summary: 'Every CARE principle was strong and every milestone was reached. Excellent call.',
      dimensions: DIMENSION_IDS.map((id) => ({
        id,
        score: 5,
        rationale: 'Excellent in every way.',
        evidence: [],
        sufficiency: 'sufficient' as const,
        guidance: 'Nothing to change.',
      })),
    });
    const { report } = model(boasting, call);
    expect(report.care).toEqual(rules.care);
    expect(report.journey.milestones).toEqual(rules.journey.milestones);
    expect(report.care?.every((p) => p.level === 'not-yet')).toBe(true);
    // The scores of a draft with no evidence are lowered, as they always were.
    expect(Math.max(...report.dimensions.map((d) => d.score))).toBeLessThanOrEqual(3);
  });
});

describe('CBCF in model text', () => {
  const claim = 'This call is CBCF compliant.';

  it('loses any sentence that names it, wherever the model put it, and says so in the warnings', () => {
    const d = draft({
      summary: `You opened well. ${claim} Ask one question at a time.`,
      strengths: [
        {
          dimension: 'ownership-next-steps',
          turnIndex: 12,
          quote: OWNERSHIP,
          whyItHelped: `It named the owner. ${claim}`,
        },
      ],
      improvements: [
        {
          dimension: 'closing',
          turnIndex: null,
          quote: null,
          risk: `No time was agreed. ${claim}`,
          betterPhrasing: `I'll call you back at nine, Maya. It aligns with CBCF.`,
          whyItWorks: `A named time helps. ${claim}`,
        },
      ],
      nextPractice: {
        dimension: 'clarity',
        recommendation: `Explain the lockout plainly. ${claim}`,
      },
    });
    const { report, warnings } = model(d);
    const { cbcf, ...rest } = report;
    expect(cbcf?.status).toBe('awaiting-authoritative-source');
    expect(JSON.stringify(rest)).not.toMatch(/cbcf/i);
    expect(report.summary.overall).toBe('You opened well. Ask one question at a time.');
    expect(warnings.some((w) => /named CBCF/.test(w))).toBe(true);
  });

  it('falls back to its own text when a field was nothing but a CBCF claim', () => {
    const { report } = model(draft({ summary: claim }));
    expect(report.summary.overall.length).toBeGreaterThan(0);
    expect(report.summary.overall).not.toMatch(/cbcf/i);
  });
});

describe('quotes and budgets in model text', () => {
  const input = strongCall();

  it('drops a quote that is not in the turn it cites, and the report still verifies', () => {
    const d = draft({
      strengths: [
        {
          dimension: 'ownership-next-steps',
          turnIndex: 12,
          quote: 'I promise I fixed it already.',
          whyItHelped: 'It named the owner.',
        },
        {
          dimension: 'opening-rapport',
          turnIndex: 2,
          quote: OPENING,
          whyItHelped: 'It opened with a name and a team.',
        },
      ],
    });
    const { report, warnings } = model(d, input);
    expect(report.strengths.map((s) => s.quote)).toEqual([OPENING]);
    expect(warnings.some((w) => /strength was dropped/.test(w))).toBe(true);
    expectQuotesVerified(report, input);
  });

  it('never accepts a customer turn as evidence of what the trainee did', () => {
    const customer = input.turns.find((t) => t.role === 'customer');
    if (!customer) throw new Error('no customer turn');
    const d = draft({
      strengths: [
        {
          dimension: 'opening-rapport',
          turnIndex: customer.index,
          quote: customer.text.slice(0, 30),
          whyItHelped: 'It opened well.',
        },
      ],
    });
    expect(model(d, input).report.strengths).toEqual([]);
  });

  it('holds long model text to the word budgets', () => {
    const d = draft({
      summary: `${words(8)}. ${words(8)}. ${words(8)}. ${words(40)}.`.slice(0, 780),
      strengths: [
        {
          dimension: 'ownership-next-steps',
          turnIndex: 12,
          quote: OWNERSHIP,
          whyItHelped: `${words(40)}.`,
        },
      ],
      improvements: [
        {
          dimension: 'closing',
          turnIndex: null,
          quote: null,
          risk: `${words(50)}.`,
          betterPhrasing: `${words(60)}.`,
          whyItWorks: 'A named time means the customer does not have to chase.',
        },
      ],
    });
    const { report } = model(d, input);
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
  });

  it('leaves a draft that keeps to the budgets exactly as the model wrote it', () => {
    const { report } = model(draft(), input);
    expect(report.summary.overall).toBe(
      'You opened well and found every hidden fact. Keep asking one question at a time.',
    );
    expect(report.improvements[0]?.betterPhrasing).toBe(
      "I'll call you back at nine to check, Maya.",
    );
  });
});

describe('the report a model draft becomes', () => {
  it('is a valid version 2 report for every kind of call, including one with no trainee turns', () => {
    for (const call of [
      strongCall(),
      weakCall(),
      buildInput(makeScenario(), [], { endedEarly: true }),
    ]) {
      const { report } = model(draft(), call);
      expect(CoachingReportSchema.safeParse(report).success).toBe(true);
      expect(report.version).toBe(2);
    }
  });
});
