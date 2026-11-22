import { describe, expect, it } from 'vitest';
import type { CarePrincipleResult, CoachingReport } from '#shared/domain/report.ts';
import { careNextAction, careQuote, skillsFor } from './care-model.ts';
import { evidenceTurns, turnLookup } from './evidence-model.ts';
import { CALLS } from './fixtures.ts';

const lookup = (name: keyof typeof CALLS) => turnLookup(evidenceTurns(CALLS[name].session));
const principle = (report: CoachingReport, id: CarePrincipleResult['id']) => {
  const found = report.care?.find((p) => p.id === id);
  if (!found) throw new Error(`No principle ${id}`);
  return found;
};

describe('skillsFor', () => {
  it('lists the skills that feed each CARE principle, from the rubric, in rubric order', () => {
    expect(skillsFor('communicate')).toEqual(['opening-rapport', 'clarity', 'closing']);
    expect(skillsFor('accountable')).toEqual(['ownership-next-steps', 'closing']);
    expect(skillsFor('resourceful')).toEqual(['scoping-discovery']);
    expect(skillsFor('empathetic')).toEqual(['opening-rapport', 'empathy-deescalation']);
  });
});

describe('careNextAction', () => {
  it('is the guidance of the weakest skill that feeds the principle, and names that skill', () => {
    // Strong call, communicate: opening 4, clarity 4, closing 4 (all equal): the first in rubric order.
    expect(careNextAction(CALLS.strong.report, 'communicate')).toEqual({
      dimension: 'opening-rapport',
      text: 'Confirm the organisation and one affected meeting early, so every check starts on the right tenant.',
    });
    // Accountable: ownership 5, closing 4 -> closing is the weaker.
    expect(careNextAction(CALLS.strong.report, 'accountable')).toEqual({
      dimension: 'closing',
      text: 'Repeat the agreed update time in your last sentence.',
    });
  });

  it('takes the lowest score, not the first skill', () => {
    // Weak call, empathetic: opening 1, empathy 1 -> equal -> the first. Clarity 2 and the rest differ.
    expect(careNextAction(CALLS.weak.report, 'communicate')?.dimension).toBe('opening-rapport');
    const report: CoachingReport = {
      ...CALLS.strong.report,
      dimensions: CALLS.strong.report.dimensions.map((d) =>
        d.id === 'clarity' ? { ...d, score: 2, guidance: 'Say what you will check first.' } : d,
      ),
    };
    expect(careNextAction(report, 'communicate')).toEqual({
      dimension: 'clarity',
      text: 'Say what you will check first.',
    });
  });

  it('has one for every principle of a report that has the six skills', () => {
    for (const id of ['communicate', 'accountable', 'resourceful', 'empathetic'] as const) {
      expect(careNextAction(CALLS.strong.report, id)).not.toBeNull();
    }
  });

  it('is null when the report holds none of the skills that feed the principle', () => {
    const report: CoachingReport = {
      ...CALLS.strong.report,
      dimensions: CALLS.strong.report.dimensions.filter((d) => d.id !== 'scoping-discovery'),
    };
    expect(careNextAction(report, 'resourceful')).toBeNull();
  });

  it('says "unexpected turn" where the evaluator wrote its own word for one', () => {
    const report: CoachingReport = {
      ...CALLS.strong.report,
      dimensions: CALLS.strong.report.dimensions.map((d) =>
        d.id === 'scoping-discovery' ? { ...d, guidance: 'Plan for a curveball.' } : d,
      ),
    };
    expect(careNextAction(report, 'resourceful')?.text).toBe('Plan for a unexpected turn.');
  });
});

describe('careQuote', () => {
  it('is the strongest quote that holds up: a shown behaviour before a partly shown one, then the fuller quote', () => {
    const quote = careQuote(principle(CALLS.strong.report, 'communicate'), lookup('strong'));
    // Of the behaviours that were shown, the question about scope is the fullest quote (11 words).
    expect(quote).toEqual({
      turnIndex: 4,
      quote: 'Is it happening in every meeting, or only for some organisers?',
      behaviour: 'Asked clear, single questions',
    });
  });

  it('prefers a behaviour that was shown to a partly shown one even when the partly shown quote is fuller', () => {
    const base = principle(CALLS.strong.report, 'resourceful');
    const fuller: CarePrincipleResult = {
      ...base,
      behaviours: base.behaviours.map((b) =>
        b.id === 'resourceful.impact'
          ? {
              ...b,
              evidence: [
                {
                  turnIndex: 12,
                  quote:
                    'To recap: recordings from sales meetings stopped appearing on Monday after a storage settings change, and you have a client review this afternoon',
                },
              ],
            }
          : b,
      ),
    };
    expect(careQuote(fuller, lookup('strong'))?.behaviour).toBe('Scoped who was affected');
  });

  it('falls back to a partly shown behaviour when nothing was shown', () => {
    const only = principle(CALLS.short.report, 'resourceful');
    expect(careQuote(only, lookup('short'))).toMatchObject({
      turnIndex: 4,
      behaviour: 'Scoped the problem',
    });
  });

  it('skips a quote the transcript does not back, and is null when none is left', () => {
    const tampered: CarePrincipleResult = {
      ...principle(CALLS.strong.report, 'accountable'),
      behaviours: principle(CALLS.strong.report, 'accountable').behaviours.map((b) => ({
        ...b,
        evidence: b.evidence.map((e) => ({ ...e, quote: 'never said by anyone' })),
      })),
    };
    expect(careQuote(tampered, lookup('strong'))).toBeNull();
  });

  it('is null for a principle with no behaviour that was shown or partly shown', () => {
    expect(careQuote(principle(CALLS.weak.report, 'accountable'), lookup('weak'))).toBeNull();
    expect(careQuote(principle(CALLS.short.report, 'accountable'), lookup('short'))).toBeNull();
  });

  it('breaks a tie by the earlier turn', () => {
    const base = principle(CALLS.strong.report, 'empathetic');
    const tie: CarePrincipleResult = {
      ...base,
      behaviours: [
        {
          ...base.behaviours[0]!,
          status: 'shown',
          evidence: [{ turnIndex: 14, quote: 'Thank you for explaining this' }],
        },
        {
          ...base.behaviours[1]!,
          status: 'shown',
          evidence: [{ turnIndex: 2, quote: 'especially with a client review' }],
        },
      ],
    };
    // Both quotes are five words long.
    expect(careQuote(tie, lookup('strong'))?.turnIndex).toBe(2);
  });
});
