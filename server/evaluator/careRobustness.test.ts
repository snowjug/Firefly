import { describe, expect, it } from 'vitest';
import type { TurnClassification } from '#shared/domain/classification.ts';
import { CoachingReportSchema, type EvaluationDraft } from '#shared/domain/report.ts';
import { DIMENSION_IDS } from '#shared/domain/vocab.ts';
import { mergeModelDraft } from './merge.ts';
import {
  careStatus,
  classified,
  evaluate,
  expectQuotesVerified,
  NOW,
  type Line,
} from './testing.ts';

// A turn can hold no sentence the evaluator can read: speech-to-text in another script, or only an
// emoji. A live classifier may still flag it ("this was a summary"), and the evaluation must carry
// on rather than fail the same way every time it is retried.

const turn = (say: string, reply = 'Okay.'): Line => ({ say, reply });
const HELLO =
  'Hello Maya, this is Sam from the Microsoft support team. What happens when you sign in?';

const UNREADABLE = ['了解しました', '好的，我明白了', '👍', 'Привет, всё понятно'];

const META = { name: 'Model', version: 'evaluator-3', providerLabel: 'Test model' };
const DRAFT: EvaluationDraft = {
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
  nextPractice: { dimension: 'clarity', recommendation: 'Explain it in one plain sentence.' },
};

function callWith(say: string, flags: Partial<TurnClassification>, callStage = 'closure' as const) {
  return classified(
    [turn(HELLO), { ...turn(say), cls: flags }, turn("I'll call you at nine with an update.")],
    { callStage },
  );
}

describe('a turn with no sentence the evaluator can read, flagged by a live classifier', () => {
  const FLAGS: [string, Partial<TurnClassification>][] = [
    ['a summary', { summarises: true }],
    ['a wrap-up', { wrapsUp: true }],
    ['a summary and a wrap-up', { summarises: true, wrapsUp: true }],
  ];

  describe.each(UNREADABLE)('said as %s', (said) => {
    it.each(FLAGS)('does not stop the rules evaluator when it is flagged as %s', (_name, flags) => {
      const input = callWith(said, flags);
      expect(() => evaluate(input)).not.toThrow();
      const report = evaluate(input);
      expect(CoachingReportSchema.safeParse(report).success).toBe(true);
      expectQuotesVerified(report, input);
    });

    it.each(FLAGS)('does not stop the model evaluator when it is flagged as %s', (_name, flags) => {
      const input = callWith(said, flags);
      expect(() => mergeModelDraft(DRAFT, input, META, { now: NOW })).not.toThrow();
      const { report } = mergeModelDraft(DRAFT, input, META, { now: NOW });
      expect(report.version).toBe(2);
      expectQuotesVerified(report, input);
    });
  });

  it('is not credited as a recap, because nothing in it can be checked against the call', () => {
    const report = evaluate(callWith('了解しました', { summarises: true }));
    expect(careStatus(report, 'communicate.summary')).not.toBe('shown');
  });

  it('does not stop the evaluation when the classifier also flagged what it saw in the turn', () => {
    const input = callWith('了解しました', {
      summarises: true,
      wrapsUp: true,
      ownership: 'clear',
      empathy: 'specific',
      acknowledgesImpact: true,
      introduces: true,
      askedQuestion: true,
    });
    expect(() => evaluate(input)).not.toThrow();
    const report = evaluate(input);
    expect(CoachingReportSchema.safeParse(report).success).toBe(true);
    expectQuotesVerified(report, input);
    expect(() => mergeModelDraft(DRAFT, input, META, { now: NOW })).not.toThrow();
  });
});
