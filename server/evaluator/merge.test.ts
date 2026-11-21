import { describe, expect, it } from 'vitest';
import {
  CoachingReportSchema,
  type CoachingReport,
  type EvaluationDraft,
} from '#shared/domain/report.ts';
import { DIMENSION_IDS, type DimensionId } from '#shared/domain/vocab.ts';
import type { EvaluationInput } from '#server/engine/types.ts';
import { EvaluationDraftError, mergeModelDraft } from './merge.ts';
import { evaluateWithRules } from './rules.ts';
import {
  STRONG_OPTIONS,
  STRONG_STEPS,
  buildInput,
  expectQuotesVerified,
  makeScenario,
  strongCall,
  weakCall,
} from './testing.ts';

const META = {
  name: 'Firefly model evaluator',
  version: 'evaluator-prompt-1',
  providerLabel: 'Test model',
};
const OPENING = 'Hello Maya, this is Sam from the Northwind support team.';
const OWNERSHIP = "I'll unlock the account now and stay with this until you're back in.";

type DraftDimension = EvaluationDraft['dimensions'][number];

function draftDimension(id: DimensionId, patch: Partial<DraftDimension> = {}): DraftDimension {
  return {
    id,
    score: 4,
    rationale: `Why ${id} scored this way.`,
    evidence: [{ turnIndex: 2, quote: OPENING }],
    sufficiency: 'sufficient',
    guidance: `Guidance for ${id}.`,
    ...patch,
  };
}

function goodDraft(
  patches: Partial<Record<DimensionId, Partial<DraftDimension>>> = {},
): EvaluationDraft {
  return {
    summary:
      "Maya's temperature eased a lot, and you found every hidden fact. Opening the call well helped.",
    dimensions: DIMENSION_IDS.map((id) => draftDimension(id, patches[id])),
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
  };
}

const merge = (draft: EvaluationDraft, input: EvaluationInput = strongCall()) =>
  mergeModelDraft(draft, input, META);
const dim = (report: CoachingReport, id: DimensionId) => {
  const found = report.dimensions.find((d) => d.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
};

describe('mergeModelDraft: a good draft', () => {
  const input = strongCall();
  const { report, warnings } = merge(goodDraft(), input);

  it('returns a valid report marked as written by a model, with the provider label', () => {
    expect(CoachingReportSchema.safeParse(report).success).toBe(true);
    expect(report.evaluator).toEqual({
      kind: 'model',
      name: 'Firefly model evaluator',
      version: 'evaluator-prompt-1',
      providerLabel: 'Test model',
    });
    expect(warnings).toEqual([]);
    expect(report.trainingNote).toContain('Firefly model evaluator');
  });

  it('keeps the model\u2019s scores, rationales, guidance and summary', () => {
    expect(report.dimensions.map((d) => d.score)).toEqual([4, 4, 4, 4, 4, 4]);
    expect(dim(report, 'clarity').rationale).toBe('Why clarity scored this way.');
    expect(dim(report, 'clarity').guidance).toBe('Guidance for clarity.');
    expect(dim(report, 'clarity').label).toBe('Strong');
    expect(report.summary.overall).toBe(
      "Maya's temperature eased a lot, and you found every hidden fact. Opening the call well helped.",
    );
    expect(report.summary.overallScore).toBe(4);
  });

  it('builds discovery, journey, curveball and completion in code, exactly as the rules path does', () => {
    const rules = evaluateWithRules(input);
    expect(report.discovery).toEqual(rules.discovery);
    expect(report.journey).toEqual(rules.journey);
    expect(report.curveball).toEqual(rules.curveball);
    expect(report.completion).toEqual(rules.completion);
    expect(report.summary.coachingFocus).toEqual(rules.summary.coachingFocus);
  });

  it('adds titles to the model\u2019s strengths and improvements', () => {
    expect(report.strengths).toEqual([
      {
        dimension: 'ownership-next-steps',
        title: 'Took clear ownership',
        turnIndex: 12,
        quote: OWNERSHIP,
        whyItHelped: 'It named who owned the next step.',
      },
    ]);
    expect(report.improvements[0]).toMatchObject({
      dimension: 'closing',
      title: 'Something missing: closing',
      turnIndex: null,
      quote: null,
    });
  });

  it('has only verified quotes', () => {
    expectQuotesVerified(report, input);
  });

  it('stamps the report with the supplied time', () => {
    const at = new Date('2026-03-01T10:00:00Z');
    expect(mergeModelDraft(goodDraft(), input, META, { now: at }).report.generatedAt).toBe(
      at.toISOString(),
    );
  });
});

describe('mergeModelDraft: rejects drafts it cannot repair', () => {
  it('throws on a duplicate dimension id', () => {
    const draft = goodDraft();
    draft.dimensions[5] = draftDimension('clarity');
    expect(() => merge(draft)).toThrow(EvaluationDraftError);
    expect(() => merge(draft)).toThrow(/more than once/);
  });

  it('throws on a missing dimension', () => {
    const draft = goodDraft();
    draft.dimensions = draft.dimensions.slice(0, 5);
    expect(() => merge(draft)).toThrow(EvaluationDraftError);
    expect(() => merge(draft)).toThrow(/all six skill areas/);
  });

  it('counts an unknown dimension id or a non-numeric score as missing', () => {
    const unknown = goodDraft();
    unknown.dimensions[0] = { ...draftDimension('clarity'), id: 'charm' as DimensionId };
    expect(() => merge(unknown)).toThrow(/all six/);
    const broken = goodDraft();
    broken.dimensions[1] = { ...draftDimension('scoping-discovery'), score: Number.NaN };
    expect(() => merge(broken)).toThrow(/all six/);
  });

  it('uses an error with a plain, user-safe message', () => {
    const draft = goodDraft();
    draft.dimensions = [];
    try {
      merge(draft);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(EvaluationDraftError);
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).name).toBe('EvaluationDraftError');
      expect((error as Error).message).not.toMatch(/zod|undefined|stack|json/i);
    }
  });
});

describe('mergeModelDraft: verifies every quote', () => {
  it('drops evidence whose quote is not in the cited turn, and says so', () => {
    const draft = goodDraft({
      clarity: {
        evidence: [
          { turnIndex: 2, quote: 'Good morning and welcome to premium support' },
          { turnIndex: 2, quote: OPENING },
        ],
      },
    });
    const { report, warnings } = merge(draft);
    expect(dim(report, 'clarity').evidence).toEqual([{ turnIndex: 2, quote: OPENING }]);
    expect(warnings).toContain('Clarity: dropped a quote (the quote is not in turn 2).');
  });

  it('drops evidence that cites a customer turn or a turn that does not exist', () => {
    const draft = goodDraft({
      closing: {
        evidence: [
          { turnIndex: 3, quote: 'It won' },
          { turnIndex: 99, quote: OPENING },
          { turnIndex: 2, quote: OPENING },
        ],
      },
    });
    const { report, warnings } = merge(draft);
    expect(dim(report, 'closing').evidence).toEqual([{ turnIndex: 2, quote: OPENING }]);
    expect(warnings).toEqual(
      expect.arrayContaining([
        'Closing: dropped a quote (turn 3 is not a trainee turn).',
        'Closing: dropped a quote (turn 99 is not a trainee turn).',
      ]),
    );
  });

  it('accepts a quote that differs only in case, spacing and punctuation', () => {
    const draft = goodDraft({
      clarity: { evidence: [{ turnIndex: 2, quote: 'hello maya  this is sam' }] },
    });
    expect(dim(merge(draft).report, 'clarity').evidence).toHaveLength(1);
  });

  it('keeps at most four pieces of evidence, in transcript order', () => {
    const draft = goodDraft({
      clarity: {
        evidence: [12, 10, 8, 6, 4].map((turnIndex) => ({
          turnIndex,
          quote: STRONG_QUOTES[turnIndex] as string,
        })),
      },
    });
    const kept = dim(merge(draft).report, 'clarity').evidence;
    expect(kept.map((e) => e.turnIndex)).toEqual([6, 8, 10, 12]);
  });

  it('drops a strength with an invalid quote, a customer turn or an unknown skill area, and keeps the rest', () => {
    const draft = goodDraft();
    draft.strengths = [
      { dimension: 'clarity', turnIndex: 4, quote: 'This was never said', whyItHelped: 'x' },
      { dimension: 'clarity', turnIndex: 3, quote: 'It won', whyItHelped: 'x' },
      { dimension: 'charm' as DimensionId, turnIndex: 2, quote: OPENING, whyItHelped: 'x' },
      { dimension: 'opening-rapport', turnIndex: 2, quote: OPENING, whyItHelped: 'A clear start.' },
    ];
    const { report, warnings } = merge(draft);
    expect(report.strengths.map((s) => s.quote)).toEqual([OPENING]);
    expect(report.strengths[0]?.title).toBe('Opened with a greeting and an introduction');
    expect(warnings.filter((w) => /strength was dropped/.test(w))).toHaveLength(3);
  });

  it('keeps at most three strengths and three improvements', () => {
    const draft = goodDraft();
    draft.strengths = Array.from({ length: 3 }, (_, i) => ({
      dimension: 'opening-rapport' as const,
      turnIndex: 2,
      quote:
        i === 0
          ? OPENING
          : i === 1
            ? 'Can you tell me what happens when you try to sign in?'
            : OWNERSHIP,
      whyItHelped: 'x'.repeat(10),
    }));
    expect(merge(draft).report.strengths.length).toBeLessThanOrEqual(3);
  });

  it('keeps an improvement that names no quote, and clears its turn', () => {
    const draft = goodDraft();
    draft.improvements = [
      {
        dimension: 'closing',
        turnIndex: 14,
        quote: null,
        risk: 'No time was agreed.',
        betterPhrasing: "I'll call you back at nine, Maya.",
        whyItWorks: 'It gives a time.',
      },
    ];
    expect(merge(draft).report.improvements[0]).toMatchObject({ turnIndex: null, quote: null });
  });

  it('drops an improvement with an invalid quote, or with no risk or no suggested phrasing', () => {
    const draft = goodDraft();
    const base = draft.improvements[0] as EvaluationDraft['improvements'][number];
    draft.improvements = [
      { ...base, turnIndex: 4, quote: 'Never said this' },
      { ...base, turnIndex: null, quote: 'Hello Maya' },
      { ...base, risk: '<b></b>' },
      { ...base, betterPhrasing: '   ' },
      { ...base, turnIndex: 2, quote: OPENING },
    ];
    const { report, warnings } = merge(draft);
    expect(report.improvements).toHaveLength(1);
    expect(report.improvements[0]).toMatchObject({ turnIndex: 2, quote: OPENING });
    expect(warnings.filter((w) => /improvement was dropped/.test(w))).toHaveLength(4);
  });

  it('titles an improvement from what the cited turn actually did', () => {
    const input = weakCall();
    const draft = goodDraft();
    draft.improvements = [
      {
        dimension: 'empathy-deescalation',
        turnIndex: 4,
        quote: 'You should have read the reminder email before changing it.',
        risk: 'Blame makes the customer defensive.',
        betterPhrasing: "Let's look at what happened together, Maya.",
        whyItWorks: 'It keeps the customer helping.',
      },
    ];
    expect(merge(draft, input).report.improvements[0]?.title).toBe(
      'Blamed the customer for what happened',
    );
  });
});

describe('mergeModelDraft: keeps scores honest', () => {
  it('lowers a 5 with one verified quote to a 4, and a 4 with none to a 3', () => {
    const draft = goodDraft({
      clarity: { score: 5 },
      closing: { score: 4, evidence: [{ turnIndex: 2, quote: 'Never said this' }] },
      'opening-rapport': {
        score: 5,
        evidence: [
          { turnIndex: 2, quote: OPENING },
          { turnIndex: 2, quote: 'Can you tell me what happens when you try to sign in?' },
        ],
      },
    });
    const { report, warnings } = merge(draft);
    expect(dim(report, 'clarity').score).toBe(4);
    expect(dim(report, 'closing').score).toBe(3);
    expect(dim(report, 'opening-rapport').score).toBe(5);
    expect(warnings).toContain(
      'Clarity: score lowered from 5 to 4 because it had too little verified evidence.',
    );
    expect(warnings).toContain(
      'Closing: score lowered from 4 to 3 because it had too little verified evidence.',
    );
  });

  it('marks sufficiency limited when every piece of evidence was dropped', () => {
    const draft = goodDraft({
      closing: { evidence: [{ turnIndex: 2, quote: 'Never said this' }] },
    });
    expect(dim(merge(draft).report, 'closing').sufficiency).toBe('limited');
  });

  it('leaves a dimension with no evidence at all as the model reported it', () => {
    const draft = goodDraft({ closing: { score: 1, evidence: [], sufficiency: 'sufficient' } });
    expect(dim(merge(draft).report, 'closing')).toMatchObject({
      score: 1,
      sufficiency: 'sufficient',
    });
  });

  it('never lets the model claim more evidence than the transcript can give', () => {
    const short = buildInput(makeScenario(), STRONG_STEPS.slice(0, 2), { endedEarly: true });
    const { report } = merge(goodDraft(), short);
    expect(report.dimensions.every((d) => d.sufficiency === 'insufficient')).toBe(true);
    expect(report.summary.overallScore).toBeNull();
    expect(report.completion).toMatchObject({ evidence: 'insufficient', status: 'ended-early' });
    expect(report.summary.overall).toMatch(/Only 2 trainee turns were recorded/);
  });

  it('adds a plain note to the summary for a limited call, unless the model already said so', () => {
    const four = buildInput(makeScenario(), STRONG_STEPS.slice(0, 4), { endedEarly: true });
    expect(merge(goodDraft(), four).report.summary.overall).toMatch(
      /With only 4 trainee turns, this rests on limited evidence\.$/,
    );
    const aware = goodDraft();
    aware.summary = 'This was a short call, so treat it as limited evidence.';
    expect(merge(aware, four).report.summary.overall).toBe(aware.summary);
  });

  it('keeps the model\u2019s sufficiency when it is more cautious than the transcript', () => {
    const draft = goodDraft({ clarity: { sufficiency: 'limited' } });
    expect(dim(merge(draft).report, 'clarity').sufficiency).toBe('limited');
  });

  it('clamps an out-of-range score and rounds a fractional one, with a warning', () => {
    const draft = goodDraft({
      clarity: { score: 7 },
      closing: { score: 0 },
      'opening-rapport': { score: 3.6 },
    });
    const { report, warnings } = merge(draft);
    expect(dim(report, 'closing').score).toBe(1);
    expect(dim(report, 'opening-rapport').score).toBe(4);
    expect(dim(report, 'clarity').score).toBeLessThanOrEqual(5);
    expect(warnings.some((w) => /score 7 was adjusted to 5/.test(w))).toBe(true);
  });

  it('computes the overall score as the mean of the final scores, to one decimal', () => {
    const draft = goodDraft({ closing: { score: 1, evidence: [] }, clarity: { score: 3 } });
    const { report } = merge(draft);
    const mean = report.dimensions.reduce((sum, d) => sum + d.score, 0) / 6;
    expect(report.summary.overallScore).toBe(Math.round(mean * 10) / 10);
  });
});

describe('mergeModelDraft: next practice', () => {
  it('keeps the model\u2019s focus when it is among the weakest areas', () => {
    const draft = goodDraft({ clarity: { score: 3 } });
    const { report } = merge(draft);
    expect(report.nextPractice.dimension).toBe('clarity');
    expect(report.nextPractice.recommendation).toBe('Explain the lockout in one plain sentence.');
  });

  it('replaces a focus that is not a weak area, with a warning', () => {
    const draft = goodDraft({
      closing: { score: 2, evidence: [{ turnIndex: 2, quote: OPENING }] },
    });
    draft.nextPractice = {
      dimension: 'clarity',
      recommendation: 'Keep explaining things clearly.',
    };
    const { report, warnings } = merge(draft);
    expect(report.nextPractice.dimension).toBe('closing');
    expect(report.nextPractice.recommendation).toMatch(/last two turns/);
    expect(warnings).toContain(
      'The suggested practice focus was replaced by one computed from the scores.',
    );
  });

  it('chooses the difficulty and the scenario in code, from the final scores', () => {
    const high = merge(
      goodDraft({
        clarity: {
          score: 5,
          evidence: [
            { turnIndex: 2, quote: OPENING },
            { turnIndex: 4, quote: 'Thanks' },
          ],
        },
      }),
    ).report;
    expect(high.nextPractice.suggestedDifficulty).toBe('challenge');
    const low = goodDraft();
    for (const d of low.dimensions) d.score = 2;
    const lowReport = merge(low).report;
    expect(lowReport.nextPractice.suggestedDifficulty).toBe('starter');
    // a different scenario that practises the same area, at the suggested difficulty
    expect(lowReport.nextPractice.dimension).toBe('clarity');
    expect(lowReport.nextPractice.suggestedScenarioId).toBe('dynamics-report-export-missing');
  });
});

describe('mergeModelDraft: cleans model text', () => {
  it('removes markup and speaker labels from every text field', () => {
    const draft = goodDraft();
    draft.summary = 'Trainee: <b>Nice</b> **work** with [a link](http://example.com) on the call.';
    const dimensionRef = draft.dimensions[0] as DraftDimension;
    dimensionRef.rationale = '```code``` Really <i>strong</i> opening.';
    const { report } = merge(draft);
    expect(report.summary.overall).toBe('Nice work with a link on the call.');
    expect(dim(report, 'opening-rapport').rationale).toBe('Really strong opening.');
    expect(JSON.stringify(report)).not.toMatch(/<\/?[a-z]+>|\*\*|http:\/\//);
  });

  it('falls back to safe text when a field is empty after cleaning', () => {
    const draft = goodDraft();
    draft.summary = '<br>';
    const dimensionRef = draft.dimensions[2] as DraftDimension;
    dimensionRef.rationale = '<br>';
    dimensionRef.guidance = '   ';
    const { report } = merge(draft);
    expect(report.summary.overall).toBe('You uncovered all 4 hidden facts.');
    expect(dim(report, 'empathy-deescalation').rationale).toBe(
      'Scored 4 of 5 from the transcript.',
    );
    expect(dim(report, 'empathy-deescalation').guidance.length).toBeGreaterThan(10);
  });

  describe('a sentence that prints a raw customer-state number', () => {
    const numbers = "Maya's temperature fell from 52 to 10.";

    it('is dropped from the summary, rationales, guidance and every coaching text, with a warning', () => {
      const draft = goodDraft();
      draft.summary = `${numbers} You opened the call well.`;
      const first = draft.dimensions[0] as DraftDimension;
      first.rationale = `A clear opening. Trust rose from 40 to 70 after it.`;
      first.guidance = `Keep the greeting. Her confidence reached 85 by turn 4.`;
      (draft.strengths[0] as { whyItHelped: string }).whyItHelped =
        `It named the owner. ${numbers}`;
      const improvement = draft.improvements[0] as { risk: string; whyItWorks: string };
      improvement.risk = `No time was agreed. Patience was 30 by then.`;
      improvement.whyItWorks = `${numbers} A named time stops the chasing.`;
      const { report, warnings } = merge(draft);
      expect(report.summary.overall).toBe('You opened the call well.');
      expect(dim(report, 'opening-rapport').rationale).toBe('A clear opening.');
      expect(dim(report, 'opening-rapport').guidance).toBe('Keep the greeting.');
      expect(report.strengths[0]?.whyItHelped).toBe('It named the owner.');
      expect(report.improvements[0]?.risk).toBe('No time was agreed.');
      expect(report.improvements[0]?.whyItWorks).toBe('A named time stops the chasing.');
      expect(warnings.filter((w) => /raw score for the customer's mood/.test(w))).toHaveLength(6);
    });

    it('does not touch ordinary numbers that are not about the customer\u2019s state', () => {
      const draft = goodDraft();
      draft.summary = 'You promised an update in 20 minutes. Trust the process.';
      const { report, warnings } = merge(draft);
      expect(report.summary.overall).toBe(
        'You promised an update in 20 minutes. Trust the process.',
      );
      expect(warnings).toEqual([]);
    });

    it('falls back when nothing but the number was said', () => {
      const draft = goodDraft();
      draft.summary = numbers;
      const { report } = merge(draft);
      expect(report.summary.overall).toBe('You uncovered all 4 hidden facts.');
    });
  });

  it('keeps every text field within the report limits', () => {
    const draft = goodDraft();
    const long = 'word '.repeat(400);
    draft.summary = long;
    for (const d of draft.dimensions) {
      d.rationale = long;
      d.guidance = long;
    }
    const { report } = merge(draft);
    expect(CoachingReportSchema.safeParse(report).success).toBe(true);
    expect(report.summary.overall.length).toBeLessThanOrEqual(1200);
  });
});

describe('mergeModelDraft: works from the same inputs as the rules path', () => {
  it('handles a call with no curveball and a weak transcript', () => {
    const input = weakCall();
    const { report } = merge(goodDraft(), input);
    expect(CoachingReportSchema.safeParse(report).success).toBe(true);
    expect(report.curveball).toBeNull();
    expect(report.journey.end).toBe(91);
  });

  it('works for a call setup other than the default', () => {
    const input = buildInput(
      makeScenario({ callStage: 'escalated', proficiency: 'expert' }),
      STRONG_STEPS,
      STRONG_OPTIONS,
    );
    expect(CoachingReportSchema.safeParse(merge(goodDraft(), input).report).success).toBe(true);
  });
});

const STRONG_QUOTES: Record<number, string> = {
  4: 'Can you read me exactly what the message says on the sign-in screen?',
  6: 'Is your work email signed in on any other device, like your phone, that might still have the old password?',
  8: 'When did it start, and what have you tried so far?',
  10: 'Your new password was saved correctly.',
  12: OWNERSHIP,
};
