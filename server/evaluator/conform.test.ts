import { describe, expect, it } from 'vitest';
import type { CoachingReport } from '#shared/domain/report.ts';
import { conformReport } from './conform.ts';
import { evaluate, strongCall } from './testing.ts';
import { BUDGETS, fitWords, firstFittingWords, sentencesOf, wordCount } from './words.ts';

// The last step before a report is saved: word budgets, and every quote checked against the turn
// it cites. It only shortens or drops; it never adds.

const input = strongCall();
const report = evaluate(input);
const turns = input.turns;

const words = (n: number, stem = 'word') =>
  Array.from({ length: n }, (_, i) => `${stem}${i}`).join(' ');

describe('word counting and fitting', () => {
  it('counts words the way a person reads, not characters', () => {
    expect(wordCount('  one   two\nthree ')).toBe(3);
    expect(wordCount('')).toBe(0);
    expect(wordCount('internationalisation')).toBe(1);
  });

  it('keeps whole sentences while they fit, and never cuts in the middle of a quotation', () => {
    const text = `You said \u201cI'll look into it. Then I'll call you.\u201d That helped. ${words(30)}.`;
    const parts = sentencesOf(text);
    expect(parts.some((p) => p.includes('look into it.') && !p.includes('call you.'))).toBe(false);
    const fitted = fitWords(text, 16);
    expect(wordCount(fitted)).toBeLessThanOrEqual(16);
    expect(fitted).toMatch(/That helped\.$/);
  });

  it('cuts a single over-long sentence at a word with an ellipsis, closing an open quotation', () => {
    const fitted = fitWords(`He said \u201cone two three four five six seven eight nine ten`, 6);
    expect(wordCount(fitted)).toBeLessThanOrEqual(6);
    expect(fitted).toMatch(/\u2026\u201d?$/);
    expect((fitted.match(/\u201c/g) ?? []).length).toBe((fitted.match(/\u201d/g) ?? []).length);
  });

  it('leaves text that already fits exactly as it is', () => {
    expect(fitWords('Short and clear.', 10)).toBe('Short and clear.');
  });

  it('takes the first variant that fits, else cuts the last', () => {
    expect(firstFittingWords(5, [words(9), 'three little words', words(2)])).toBe(
      'three little words',
    );
    expect(wordCount(firstFittingWords(5, [words(9), words(12)]))).toBeLessThanOrEqual(5);
    expect(firstFittingWords(5, [null, ''])).toBe('');
  });
});

describe('conforming a report to its word budgets', () => {
  it('cuts the summary to 45 words, at a sentence where it can', () => {
    const long = `${words(10)}. ${words(10)}. ${words(10)}. ${words(30)}.`;
    const conformed = conformReport({ ...report, summary: { ...report.summary, overall: long } });
    expect(wordCount(conformed.summary.overall)).toBeLessThanOrEqual(BUDGETS.summaryWords);
    expect(conformed.summary.overall).not.toContain('\u2026');
    expect(conformed.summary.overall.endsWith('.')).toBe(true);
  });

  it('holds each strength, title and explanation together, to 35 words', () => {
    const strengths = report.strengths.map((s) => ({ ...s, whyItHelped: `${words(60)}.` }));
    const conformed = conformReport({ ...report, strengths });
    for (const s of conformed.strengths) {
      expect(wordCount(s.title) + wordCount(s.whyItHelped)).toBeLessThanOrEqual(
        BUDGETS.strengthWords,
      );
    }
  });

  it('holds an improvement to 45 words for the risk and 45 for the rewrite, keeping its quote', () => {
    const improvements = report.improvements.map((i) => ({
      ...i,
      risk: `${words(70)}.`,
      betterPhrasing: `${words(70)}.`,
    }));
    const conformed = conformReport({ ...report, improvements }, { turns });
    conformed.improvements.forEach((i, n) => {
      expect(wordCount(i.risk)).toBeLessThanOrEqual(BUDGETS.riskWords);
      expect(wordCount(i.betterPhrasing)).toBeLessThanOrEqual(BUDGETS.betterPhrasingWords);
      expect(i.quote).toBe(report.improvements[n]?.quote);
    });
  });

  it('holds a CARE principal\u2019s summary to its budget', () => {
    const care = (report.care ?? []).map((p) => ({ ...p, summary: `${words(60)}.` }));
    const conformed = conformReport({ ...report, care });
    for (const p of conformed.care ?? []) {
      expect(wordCount(p.summary)).toBeLessThanOrEqual(BUDGETS.careSummaryWords);
    }
  });

  it('keeps at most three strengths and three improvements', () => {
    const strengths = [...report.strengths, ...report.strengths];
    const conformed = conformReport({ ...report, strengths });
    expect(conformed.strengths.length).toBeLessThanOrEqual(BUDGETS.maxStrengths);
  });

  it('is idempotent, and leaves a report that already conforms untouched', () => {
    const once = conformReport(report, { turns });
    expect(once).toEqual(report);
    expect(conformReport(once, { turns })).toEqual(once);
  });
});

describe('checking every quote against the turn it cites', () => {
  const firstTraineeTurn = turns.find((t) => t.role === 'trainee');
  const customerTurn = turns.find((t) => t.role === 'customer');
  if (!firstTraineeTurn || !customerTurn) throw new Error('The fixture call has no turns');

  it('drops a strength whose quote is not in the turn it cites', () => {
    const [first, ...rest] = report.strengths;
    if (!first) throw new Error('The strong call has no strengths');
    const made = { ...first, quote: 'I fixed everything perfectly and promised a refund.' };
    const conformed = conformReport({ ...report, strengths: [made, ...rest] }, { turns });
    expect(conformed.strengths.some((s) => s.quote === made.quote)).toBe(false);
    expect(conformed.strengths).toHaveLength(rest.length);
  });

  it('never accepts a customer turn as evidence of what the trainee did', () => {
    const [first, ...rest] = report.strengths;
    if (!first) throw new Error('The strong call has no strengths');
    const words3 = customerTurn.text.split(' ').slice(0, 4).join(' ');
    const made = { ...first, turnIndex: customerTurn.index, quote: words3 };
    const conformed = conformReport({ ...report, strengths: [made, ...rest] }, { turns });
    expect(conformed.strengths.some((s) => s.turnIndex === customerTurn.index)).toBe(false);
  });

  it('keeps an improvement whose quote was made up, as a gap that never happened', () => {
    const [first] = report.improvements;
    if (!first) throw new Error('The strong call has no improvements');
    const made = {
      ...first,
      turnIndex: firstTraineeTurn.index,
      quote: 'This sentence was never said.',
    };
    const conformed = conformReport({ ...report, improvements: [made] }, { turns });
    expect(conformed.improvements).toHaveLength(1);
    expect(conformed.improvements[0]?.quote).toBeNull();
    expect(conformed.improvements[0]?.turnIndex).toBeNull();
  });

  it('downgrades a CARE behaviour whose only quote cannot be checked, never leaving it "shown"', () => {
    const care = (report.care ?? []).map((p) => ({
      ...p,
      behaviours: p.behaviours.map((b) =>
        b.status === 'shown'
          ? { ...b, evidence: b.evidence.map((e) => ({ ...e, quote: 'Words nobody said.' })) }
          : b,
      ),
    }));
    const conformed = conformReport({ ...report, care }, { turns });
    for (const p of conformed.care ?? []) {
      for (const b of p.behaviours) {
        if (b.status !== 'not-shown') expect(b.evidence.length).toBeGreaterThan(0);
        expect(b.evidence.every((e) => !/nobody said/.test(e.quote))).toBe(true);
      }
    }
    const downgraded = (conformed.care ?? [])
      .flatMap((p) => p.behaviours)
      .filter((b) => b.note?.includes('could not be checked'));
    expect(downgraded.length).toBeGreaterThan(0);
    expect(downgraded.every((b) => b.status === 'not-shown')).toBe(true);
  });

  it('downgrades a reached milestone whose quote cannot be checked', () => {
    const milestones = (report.journey.milestones ?? []).map((m) =>
      m.id === 'greeting' ? { ...m, quote: 'Words nobody said.' } : m,
    );
    const conformed = conformReport(
      { ...report, journey: { ...report.journey, milestones } },
      { turns },
    );
    const greeting = conformed.journey.milestones?.find((m) => m.id === 'greeting');
    expect(greeting).toMatchObject({ status: 'not-reached', turnIndex: null, quote: null });
  });

  it('checks only budgets when it is not given the transcript', () => {
    const made = {
      ...(report.strengths[0] as CoachingReport['strengths'][number]),
      quote: 'Not in any turn.',
    };
    const conformed = conformReport({ ...report, strengths: [made] });
    expect(conformed.strengths).toHaveLength(1);
  });
});
