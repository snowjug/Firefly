import { describe, expect, it } from 'vitest';
import type { CoachingReport } from '#shared/domain/report.ts';
import { CoachingReportSchema } from '#shared/domain/report.ts';
import {
  buildInput,
  classified,
  evaluate,
  expectQuotesVerified,
  makeScenario,
  STRONG_OPTIONS,
  STRONG_STEPS,
  strongCall,
  WEAK_STEPS,
  weakCall,
  type Line,
} from './testing.ts';
import { BUDGETS, wordCount } from './words.ts';

// The words a trainee reads are held to short budgets, for every kind of call: the rules evaluator
// writes to them, and the final step cuts anything over. Better wording is a short rewrite in the
// trainee's voice, never a script that states a product fact as true.

const turn = (say: string, reply = 'Okay.'): Line => ({ say, reply });

function calls(): [string, ReturnType<typeof strongCall>][] {
  const list: [string, ReturnType<typeof strongCall>][] = [
    ['strong', strongCall()],
    ['weak', weakCall()],
  ];
  for (let n = 1; n <= STRONG_STEPS.length; n += 1) {
    list.push([
      `strong prefix ${n}`,
      buildInput(makeScenario(), STRONG_STEPS.slice(0, n), {
        ...STRONG_OPTIONS,
        endedEarly: n < STRONG_STEPS.length,
      }),
    ]);
  }
  for (let n = 1; n <= WEAK_STEPS.length; n += 1) {
    list.push([
      `weak prefix ${n}`,
      buildInput(makeScenario(), WEAK_STEPS.slice(0, n), { endedEarly: n < WEAK_STEPS.length }),
    ]);
  }
  for (const difficulty of ['starter', 'standard', 'challenge'] as const) {
    for (const proficiency of ['novice', 'intermediate', 'expert'] as const) {
      list.push([
        `strong ${difficulty}/${proficiency}`,
        strongCall(makeScenario({ difficulty, proficiency })),
      ]);
      list.push([
        `weak ${difficulty}/${proficiency}`,
        weakCall(makeScenario({ difficulty, proficiency })),
      ]);
    }
  }
  for (const callStage of ['follow-up', 'escalated', 'closure'] as const) {
    list.push([`strong ${callStage}`, strongCall(makeScenario({ callStage }))]);
    list.push([`weak ${callStage}`, weakCall(makeScenario({ callStage }))]);
    list.push([
      `abrupt ${callStage}`,
      classified(
        [turn('Hello.'), turn('Okay.'), turn("I'll look into it."), turn('Okay.'), turn('Bye.')],
        { callStage },
      ),
    ]);
  }
  return list;
}

const ALL = calls();

// A statement that something is the cause or the fix. A rewrite of what the trainee said may keep
// the trainee's own instruction in plainer words; one the trainee never said may not add any.
const PRODUCT_CLAIM =
  /\b(?:the (?:fix|cause|problem|issue|reason) (?:is|was)|(?:it|this|that)(?:'s| is| was) (?:caused|due to|because)|the account (?:is|was) locked because)/i;
const NEW_INSTRUCTION =
  /\b(?:you (?:need|have|must|should) to (?:reset|restart|reinstall|clear|update|delete|remove|re-?enter)|(?:reset|restart|reinstall|clear) (?:your|the) )/i;
const ADVICE_VOICE =
  /^(?:you should|you could|try to|remember to|make sure|consider|it would be better|next time)/i;

describe('word budgets', () => {
  it.each(ALL)('hold for every part of the report: %s', (_name, input) => {
    const report: CoachingReport = evaluate(input);
    expect(wordCount(report.summary.overall)).toBeLessThanOrEqual(BUDGETS.summaryWords);
    expect(report.strengths.length).toBeLessThanOrEqual(BUDGETS.maxStrengths);
    expect(report.improvements.length).toBeLessThanOrEqual(BUDGETS.maxImprovements);
    for (const s of report.strengths) {
      expect(wordCount(s.title) + wordCount(s.whyItHelped)).toBeLessThanOrEqual(
        BUDGETS.strengthWords,
      );
    }
    for (const i of report.improvements) {
      expect(wordCount(i.risk)).toBeLessThanOrEqual(BUDGETS.riskWords);
      expect(wordCount(i.betterPhrasing)).toBeLessThanOrEqual(BUDGETS.betterPhrasingWords);
    }
    for (const p of report.care ?? []) {
      expect(wordCount(p.summary)).toBeLessThanOrEqual(BUDGETS.careSummaryWords);
    }
  });

  it.each(ALL)('leave a valid report whose every quote is verbatim: %s', (_name, input) => {
    const report = evaluate(input);
    expect(CoachingReportSchema.safeParse(report).success).toBe(true);
    expectQuotesVerified(report, input);
  });

  it('give two or three strengths and improvements to a long call that supports them, and never invent more', () => {
    const report = evaluate(strongCall());
    expect(report.strengths.length).toBeGreaterThanOrEqual(2);
    expect(report.improvements.length).toBeGreaterThanOrEqual(2);
    for (const [name, input] of ALL.filter(([n]) => /prefix [12]$/.test(n))) {
      const short = evaluate(input);
      // Too short to support a list: whatever is there is a real finding, not a filler.
      expect(short.improvements.length, name).toBeLessThanOrEqual(BUDGETS.maxImprovements);
    }
  });
});

describe('better wording', () => {
  it.each(ALL)('is a short rewrite in the trainee\u2019s voice: %s', (_name, input) => {
    for (const i of evaluate(input).improvements) {
      expect(wordCount(i.betterPhrasing)).toBeGreaterThanOrEqual(3);
      expect(i.betterPhrasing).not.toMatch(ADVICE_VOICE);
    }
  });

  it.each(ALL)(
    'states no product fact as true, and adds no instruction of its own: %s',
    (_name, input) => {
      for (const i of evaluate(input).improvements) {
        expect(i.betterPhrasing).not.toMatch(PRODUCT_CLAIM);
        if (i.quote === null) expect(i.betterPhrasing).not.toMatch(NEW_INSTRUCTION);
      }
    },
  );

  it('leaves what only the trainee can know in brackets rather than making it up', () => {
    const report = evaluate(
      classified([turn('Hello.'), turn('Okay.'), turn('Okay.'), turn('Okay.'), turn('Bye.')], {
        callStage: 'follow-up',
      }),
    );
    const phrasing = report.improvements.map((i) => i.betterPhrasing).join(' ');
    const bracketed = phrasing.match(/\[[^\]]+\]/g) ?? [];
    for (const placeholder of bracketed) expect(placeholder).toMatch(/^\[[a-z -]+\]$/i);
  });
});
