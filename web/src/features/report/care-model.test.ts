import { describe, expect, it } from 'vitest';
import type {
  CareBehaviourResult,
  CarePrincipleResult,
  CoachingReport,
} from '#shared/domain/report.ts';
import {
  behaviourEvidence,
  careNextAction,
  careQuote,
  careQuotes,
  skillsFor,
  splitCaseClause,
  splitNextAction,
} from './care-model.ts';
import { evidenceTurns, turnLookup } from './evidence-model.ts';
import { CALLS } from './fixtures.ts';

const lookup = (name: keyof typeof CALLS) => turnLookup(evidenceTurns(CALLS[name].session));
const principle = (report: CoachingReport, id: CarePrincipleResult['id']) => {
  const found = report.care?.find((p) => p.id === id);
  if (!found) throw new Error(`No principle ${id}`);
  return found;
};
const behaviour = (
  id: string,
  status: CareBehaviourResult['status'],
  evidence: [number, string][],
  label = id,
): CareBehaviourResult => ({
  id,
  principle: id.split('.')[0] as CareBehaviourResult['principle'],
  label,
  status,
  evidence: evidence.map(([turnIndex, quote]) => ({ turnIndex, quote })),
  note: null,
});
const withBehaviours = (
  base: CarePrincipleResult,
  behaviours: CareBehaviourResult[],
): CarePrincipleResult => ({ ...base, behaviours });

describe('skillsFor', () => {
  it('lists the skills that feed each CARE principle, from the rubric, in rubric order', () => {
    expect(skillsFor('communicate')).toEqual(['opening-rapport', 'clarity', 'closing']);
    expect(skillsFor('accountable')).toEqual(['ownership-next-steps', 'closing']);
    expect(skillsFor('resourceful')).toEqual(['scoping-discovery']);
    expect(skillsFor('empathetic')).toEqual(['opening-rapport', 'empathy-deescalation']);
  });
});

describe('splitNextAction', () => {
  it('takes the stretch as the action when the guidance starts by saying the skill went well', () => {
    expect(
      splitNextAction(
        'Keep this opening. To stretch it, tie your first sentence of empathy to something Marcus actually said.',
      ),
    ).toEqual({
      action:
        'To stretch it, tie your first sentence of empathy to something Marcus actually said.',
      more: 'Keep this opening.',
    });
  });

  it('takes the first sentence as the action otherwise, and keeps the example as what is left', () => {
    expect(
      splitNextAction(
        'Look for the fact that changes the fix before you offer one. On this call the question was: \u201cWhen did you last see the mailbox?\u201d',
      ),
    ).toEqual({
      action: 'Look for the fact that changes the fix before you offer one.',
      more: 'On this call the question was: \u201cWhen did you last see the mailbox?\u201d',
    });
    expect(splitNextAction('Finish politely: thank Marcus and say goodbye.')).toEqual({
      action: 'Finish politely: thank Marcus and say goodbye.',
      more: '',
    });
  });
});

describe('careNextAction', () => {
  it('is the guidance of the weakest skill that feeds the principle, and names that skill', () => {
    // Strong call, communicate: opening 4, clarity 4, closing 4 (all equal): the first in rubric order.
    expect(careNextAction(CALLS.strong.report, 'communicate')).toEqual({
      dimension: 'opening-rapport',
      text: 'Confirm the organisation and one affected meeting early, so every check starts on the right tenant.',
      action:
        'Confirm the organisation and one affected meeting early, so every check starts on the right tenant.',
      more: '',
    });
    // Accountable: ownership 5, closing 4 -> closing is the weaker.
    expect(careNextAction(CALLS.strong.report, 'accountable')).toMatchObject({
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
    expect(careNextAction(report, 'communicate')).toMatchObject({
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

describe('splitCaseClause', () => {
  it('takes the case clause off the end of the sentence, in each of the three forms the rules write', () => {
    expect(
      splitCaseClause('You opened with a greeting; it met 1 of 2 things this case needed.'),
    ).toEqual({ text: 'You opened with a greeting.', fit: 'Met 1 of 2 things this case needed' });
    expect(splitCaseClause('You took clear ownership; it met what this case needed.')).toEqual({
      text: 'You took clear ownership.',
      fit: 'Met what this case needed',
    });
    expect(
      splitCaseClause(
        'You took ownership, but you only partly set expectations; it did not yet meet what this case needed.',
      ),
    ).toEqual({
      text: 'You took ownership, but you only partly set expectations.',
      fit: 'Did not yet meet what this case needed',
    });
  });

  it('leaves a sentence with no case clause as it was', () => {
    expect(splitCaseClause('Clear greeting and a recap Priya confirmed.')).toEqual({
      text: 'Clear greeting and a recap Priya confirmed.',
      fit: null,
    });
  });
});

describe('careQuote', () => {
  it('is the first behaviour, in the order the report lists them, that was shown and has a quote that holds up', () => {
    const quote = careQuote(principle(CALLS.strong.report, 'communicate'), lookup('strong'));
    expect(quote).toEqual({
      turnIndex: 2,
      quote: 'Hello Priya',
      behaviour: 'Greeted the customer by name',
      status: 'shown',
    });
  });

  it('prefers a behaviour that was shown to a partly shown one, wherever the partly shown one is listed', () => {
    const base = principle(CALLS.strong.report, 'resourceful');
    // "Assessed the business impact" (partly) is third; moved to the front it still comes second.
    const impact = base.behaviours[2] as CareBehaviourResult;
    const reordered = withBehaviours(base, [
      impact,
      ...base.behaviours.filter((b) => b.id !== impact.id),
    ]);
    expect(careQuote(reordered, lookup('strong'))).toMatchObject({
      behaviour: 'Scoped who was affected',
      status: 'shown',
    });
  });

  it('falls back to a partly shown behaviour when nothing was shown', () => {
    const only = principle(CALLS.short.report, 'resourceful');
    expect(careQuote(only, lookup('short'))).toMatchObject({
      turnIndex: 4,
      behaviour: 'Scoped the problem',
      status: 'partly',
    });
  });

  it('is the moment a behaviour went wrong when nothing was shown, and says so', () => {
    const base = principle(CALLS.weak.report, 'empathetic');
    const harmed = withBehaviours(base, [
      behaviour(
        'empathetic.acknowledged-impact',
        'not-shown',
        [[4, 'You should have checked the service status page first.']],
        'Acknowledged the business impact',
      ),
    ]);
    expect(careQuote(harmed, lookup('weak'))).toEqual({
      turnIndex: 4,
      quote: 'You should have checked the service status page first.',
      behaviour: 'Acknowledged the business impact',
      status: 'not-shown',
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

  it('is null for a principle with nothing the transcript backs, shown or not', () => {
    expect(careQuote(principle(CALLS.weak.report, 'accountable'), lookup('weak'))).toBeNull();
    expect(careQuote(principle(CALLS.short.report, 'accountable'), lookup('short'))).toBeNull();
  });

  it('gives no quote of its own to a behaviour judged by what was left out: its moment is borrowed', () => {
    const base = principle(CALLS.strong.report, 'empathetic');
    const absence = withBehaviours(base, [
      behaviour('empathetic.no-dismissive', 'shown', [[2, "I'm sorry the recordings are missing"]]),
    ]);
    expect(careQuote(absence, lookup('strong'))).toBeNull();
    // Had it been dismissive, the moment it went wrong is the quote.
    const dismissive = withBehaviours(base, [
      behaviour('empathetic.no-dismissive', 'not-shown', [
        [2, "I'm sorry the recordings are missing"],
      ]),
    ]);
    expect(careQuote(dismissive, lookup('strong'))?.status).toBe('not-shown');
  });

  it('goes on to the next quote when a moment is already taken, and is null when all are', () => {
    const base = principle(CALLS.strong.report, 'communicate');
    const taken = new Set([`2\u0000Hello Priya`]);
    expect(careQuote(base, lookup('strong'), taken)).toMatchObject({
      behaviour: 'Introduced themselves',
    });
    for (const b of base.behaviours) {
      for (const e of b.evidence) taken.add(`${e.turnIndex}\u0000${e.quote}`);
    }
    expect(careQuote(base, lookup('strong'), taken)).toBeNull();
  });
});

describe('careQuotes', () => {
  it('never puts the same words under two principles: a later principle goes on to its next quote, or has none', () => {
    const turns = lookup('strong');
    const [communicate, accountable, resourceful] = [
      principle(CALLS.strong.report, 'communicate'),
      principle(CALLS.strong.report, 'accountable'),
      principle(CALLS.strong.report, 'resourceful'),
    ];
    const greeting = [2, 'Hello Priya'] as [number, string];
    const care: CarePrincipleResult[] = [
      communicate,
      // Accountable's first behaviour cites the very words Communicate used, and nothing else holds up.
      withBehaviours(accountable, [
        behaviour('accountable.ownership', 'shown', [greeting], 'Took ownership'),
        behaviour(
          'accountable.update-time',
          'shown',
          [[10, 'never said by anyone']],
          'Named an update time',
        ),
      ]),
      resourceful,
    ];
    const quotes = careQuotes(care, turns);
    expect(quotes.get('communicate')?.quote).toBe('Hello Priya');
    expect(quotes.get('accountable')).toBeNull();
    expect(quotes.get('resourceful')?.behaviour).toBe('Scoped who was affected');
    const used = [...quotes.values()]
      .filter((q) => q !== null)
      .map((q) => `${q.turnIndex}:${q.quote}`);
    expect(new Set(used).size).toBe(used.length);
  });

  it('gives each of the strong call’s four principles a quote of its own that fits the behaviour named under it', () => {
    const quotes = careQuotes(CALLS.strong.report.care ?? [], lookup('strong'));
    expect([...quotes.keys()]).toEqual(['communicate', 'accountable', 'resourceful', 'empathetic']);
    const used = [...quotes.values()].map((q) => `${q?.turnIndex}:${q?.quote}`);
    expect(new Set(used).size).toBe(4);
  });
});

describe('behaviourEvidence', () => {
  const turns = lookup('strong');
  const base = principle(CALLS.strong.report, 'accountable');

  it('has at most one quote for a behaviour: the first that holds up', () => {
    const two = withBehaviours(base, [
      behaviour('accountable.ownership', 'shown', [
        [10, 'never said by anyone'],
        [8, "I'll take ownership of this case"],
        [10, "I'll call you back by 1 PM today"],
      ]),
    ]);
    expect(behaviourEvidence(two, turns)).toEqual([
      { kind: 'quote', turnIndex: 8, quote: "I'll take ownership of this case" },
    ]);
  });

  it('points to the words already shown instead of repeating them for a later behaviour', () => {
    const same = [8, "I'll take ownership of this case"] as [number, string];
    const repeated = withBehaviours(base, [
      behaviour('accountable.ownership', 'shown', [same]),
      behaviour('accountable.next-action', 'shown', [same]),
      behaviour('accountable.update-time', 'shown', [[10, "I'll call you back by 1 PM today"]]),
    ]);
    expect(behaviourEvidence(repeated, turns)).toEqual([
      { kind: 'quote', turnIndex: 8, quote: "I'll take ownership of this case" },
      { kind: 'repeat', turnIndex: 8 },
      { kind: 'quote', turnIndex: 10, quote: "I'll call you back by 1 PM today" },
    ]);
  });

  it('has nothing to quote for a behaviour judged by what was left out, however many moments it lists', () => {
    const absence = withBehaviours(base, [
      behaviour('accountable.no-blame', 'shown', [[8, "I'll take ownership of this case"]]),
    ]);
    expect(behaviourEvidence(absence, turns)).toEqual([{ kind: 'absence' }]);
  });

  it('has none for a behaviour with no moment that holds up', () => {
    const none = withBehaviours(base, [
      behaviour('accountable.ownership', 'shown', [[8, 'never said by anyone']]),
      behaviour('accountable.update-time', 'not-shown', []),
    ]);
    expect(behaviourEvidence(none, turns)).toEqual([{ kind: 'none' }, { kind: 'none' }]);
  });
});
