import { describe, expect, it } from 'vitest';
import { CARE_BEHAVIOURS } from '#shared/domain/vocab.ts';
import { CoachingReportSchema, type CoachingReport } from '#shared/domain/report.ts';
import {
  buildInput,
  careLevel,
  classified,
  evaluate,
  expectQuotesVerified,
  makeScenario,
  STRONG_STEPS,
  strongCall,
  weakCall,
  type Line,
} from './testing.ts';
import { BEHAVIOUR_IDS } from './care/index.ts';
import { BUDGETS, sentencesOf, wordCount } from './words.ts';

// How CARE reaches the report: four principals, each once and in order, each with behaviours that
// have stable ids and verified quotes, and a level derived from them. Very short calls say
// "limited evidence" rather than guess.

const turn = (say: string, reply = 'Okay.'): Line => ({ say, reply });

const calls: Record<string, ReturnType<typeof strongCall>> = {
  strong: strongCall(),
  weak: weakCall(),
  short: buildInput(makeScenario(), STRONG_STEPS.slice(0, 2), { endedEarly: true }),
  empty: buildInput(makeScenario(), [], { endedEarly: true }),
};

describe('the four principals', () => {
  it.each(Object.entries(calls))('are listed once each, in order: %s call', (_name, input) => {
    const care = evaluate(input).care ?? [];
    expect(care.map((p) => p.id)).toEqual([...CARE_BEHAVIOURS]);
    expect(new Set(care.map((p) => p.id)).size).toBe(4);
  });

  it.each(Object.entries(calls))(
    'hold only their own behaviours, with stable ids: %s call',
    (_name, input) => {
      for (const principal of evaluate(input).care ?? []) {
        expect(principal.behaviours.length).toBeLessThanOrEqual(10);
        const ids = principal.behaviours.map((b) => b.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const b of principal.behaviours) {
          expect(b.principle).toBe(principal.id);
          expect(b.id.startsWith(`${principal.id}.`)).toBe(true);
          expect(BEHAVIOUR_IDS as readonly string[]).toContain(b.id);
        }
      }
    },
  );

  it('give every behaviour that was shown, or shown in part, a verified quote of the trainee', () => {
    for (const input of Object.values(calls)) {
      const report = evaluate(input);
      for (const b of (report.care ?? []).flatMap((p) => p.behaviours)) {
        if (b.status !== 'not-shown') expect(b.evidence.length, b.id).toBeGreaterThan(0);
        expect(b.evidence.length).toBeLessThanOrEqual(2);
      }
      expectQuotesVerified(report, input);
    }
  });

  it('give each principal a one-sentence summary of about 25 words, written about this call', () => {
    for (const input of Object.values(calls)) {
      for (const p of evaluate(input).care ?? []) {
        expect(wordCount(p.summary), p.id).toBeLessThanOrEqual(BUDGETS.careSummaryWords);
        expect(wordCount(p.summary), p.id).toBeGreaterThanOrEqual(6);
        expect(sentencesOf(p.summary), p.id).toHaveLength(1);
      }
    }
  });

  it('are rejected by the report schema when one appears twice', () => {
    const report = evaluate(strongCall());
    const care = [...(report.care ?? [])];
    const first = care[0];
    if (!first) throw new Error('No principals');
    care[1] = { ...first };
    expect(CoachingReportSchema.safeParse({ ...report, care }).success).toBe(false);
  });
});

describe('levels', () => {
  it('rate a strong call strong or developing everywhere, and never not-yet', () => {
    const levels = CARE_BEHAVIOURS.map((p) => careLevel(evaluate(calls.strong as never), p));
    expect(levels.filter((l) => l === 'not-yet')).toEqual([]);
    expect(levels.filter((l) => l === 'strong').length).toBeGreaterThanOrEqual(3);
  });

  it('rate a weak call not-yet where it blamed, dismissed or promised the impossible', () => {
    const report = evaluate(weakCall());
    expect(careLevel(report, 'accountable')).toBe('not-yet');
    expect(careLevel(report, 'empathetic')).toBe('not-yet');
  });

  it('say limited evidence for a call too short to judge, instead of guessing', () => {
    const report = evaluate(calls.short as never);
    for (const principal of report.care ?? []) {
      expect(principal.level, principal.id).toBe('limited-evidence');
      expect(principal.summary).toMatch(/first look|little to judge|too short|not enough/i);
    }
  });

  it('list no behaviours and say limited evidence for a call with no trainee turns', () => {
    for (const principal of evaluate(calls.empty as never).care ?? []) {
      expect(principal.level).toBe('limited-evidence');
      expect(principal.behaviours).toEqual([]);
    }
  });

  it('do not rise because a call was long: filler turns add no credit', () => {
    const filler = Array.from({ length: 6 }, () => turn('Okay.'));
    const report = evaluate(classified([turn('Hello.'), ...filler]));
    for (const p of CARE_BEHAVIOURS) expect(careLevel(report, p), p).not.toBe('strong');
  });

  it('keep a principal below strong while a core behaviour was never shown', () => {
    const noTime = [
      turn(
        'Hello Maya, this is Sam from the Microsoft support team. What happens when you sign in?',
      ),
      turn("I'll own this and stay with it until you're back in."),
      turn('Please remove the old password from the phone.'),
      turn("I'll unlock the account now."),
      turn('Thanks, goodbye.'),
    ];
    const withTime = [...noTime];
    withTime[3] = turn("I'll unlock the account now and call you back at nine with an update.");
    const rank = { 'not-yet': 0, developing: 1, strong: 2, 'limited-evidence': -1 } as const;
    expect(rank[careLevel(evaluate(classified(withTime)), 'accountable')]).toBeGreaterThan(
      rank[careLevel(evaluate(classified(noTime)), 'accountable')],
    );
  });
});

describe('the report schema', () => {
  const report = evaluate(strongCall());

  it('is version 2 and carries CARE, the CBCF status and six milestones', () => {
    expect(report.version).toBe(2);
    expect(report.care).toHaveLength(4);
    expect(report.cbcf).toBeDefined();
    expect(report.journey.milestones).toHaveLength(6);
  });

  it('round-trips through CoachingReportSchema, for every kind of call', () => {
    for (const input of [...Object.values(calls), weakCall()]) {
      const made = evaluate(input);
      expect(CoachingReportSchema.parse(JSON.parse(JSON.stringify(made)))).toEqual(made);
    }
  });

  it('still parses a version 1 report from before CARE was read from the call', () => {
    const { care: _care, cbcf: _cbcf, journey, ...rest } = report;
    const { milestones: _milestones, ...journeyV1 } = journey;
    const v1 = { ...rest, version: 1, journey: journeyV1 };
    const parsed = CoachingReportSchema.safeParse(v1);
    expect(parsed.success).toBe(true);
    expect((parsed.data as CoachingReport).care).toBeUndefined();
  });

  it('rejects a version 2 report that is missing any of the three', () => {
    const { care: _care, ...withoutCare } = report;
    const { cbcf: _cbcf, ...withoutCbcf } = report;
    const { milestones: _m, ...journeyNoMilestones } = report.journey;
    expect(CoachingReportSchema.safeParse(withoutCare).success).toBe(false);
    expect(CoachingReportSchema.safeParse(withoutCbcf).success).toBe(false);
    expect(
      CoachingReportSchema.safeParse({ ...report, journey: journeyNoMilestones }).success,
    ).toBe(false);
  });
});
