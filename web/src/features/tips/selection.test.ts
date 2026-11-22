// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { nextTip, phaseFor, startingTip, type TipCallStage } from './selection.ts';
import { TIP_PHASES, TIPS, type Tip, type TipPhase } from './tips.ts';

const STAGES: readonly TipCallStage[] = ['first-contact', 'follow-up', 'escalated', 'closure'];

const first = (phase: TipPhase) => TIPS.findIndex((tip) => tip.phase === phase);

describe('which phase a call is in', () => {
  it('begins every call by opening it and, given time enough, ends it by closing', () => {
    for (const stage of STAGES) {
      expect(phaseFor(stage, 0), stage).toBe('opening');
      expect(phaseFor(stage, 40), stage).toBe('closing');
    }
  });

  it('only ever takes the number of messages the trainee has sent into account', () => {
    // The function takes a stage and a count: nothing about the customer, the case or the product
    // can reach it. The same two values always give the same phase.
    expect(phaseFor.length).toBe(2);
    for (const stage of STAGES) {
      for (let sent = 0; sent < 20; sent += 1) {
        expect(phaseFor(stage, sent)).toBe(phaseFor(stage, sent));
        expect(TIP_PHASES).toContain(phaseFor(stage, sent));
      }
    }
  });

  it('moves a first call on from opening to scoping and then through the rest of a call', () => {
    const seen: TipPhase[] = [];
    for (let sent = 0; sent < 20; sent += 1) {
      const phase = phaseFor('first-contact', sent);
      if (seen.at(-1) !== phase) seen.push(phase);
    }
    expect(seen).toEqual(['opening', 'scoping', 'empathy', 'clarity', 'ownership', 'closing']);
  });

  it('steadies a customer sooner on a call that has been escalated, and closes a closure call sooner', () => {
    expect(phaseFor('first-contact', 1)).toBe('scoping');
    expect(phaseFor('escalated', 1)).toBe('empathy');
    const turnsToClose = (stage: TipCallStage) =>
      Array.from({ length: 30 }, (_, sent) => sent).find(
        (sent) => phaseFor(stage, sent) === 'closing',
      ) as number;
    expect(turnsToClose('closure')).toBeLessThan(turnsToClose('first-contact'));
  });

  it('is safe for a count that is not a whole number, and for a stage it does not know', () => {
    expect(phaseFor('first-contact', -3)).toBe('opening');
    expect(phaseFor('first-contact', Number.NaN)).toBe('opening');
    expect(phaseFor('first-contact', Number.POSITIVE_INFINITY)).toBe('opening');
    expect(phaseFor('first-contact', 4.9)).toBe(phaseFor('first-contact', 4));
    expect(phaseFor('somewhere-else' as TipCallStage, 6)).toBe(phaseFor('first-contact', 6));
  });
});

describe('where the deck starts', () => {
  it('opens at the first tip of the phase the call is in, so a call picked up again resumes sensibly', () => {
    expect(startingTip(TIPS, { stage: 'first-contact', traineeTurns: 0 })).toBe(first('opening'));
    expect(startingTip(TIPS, { stage: 'first-contact', traineeTurns: 5 })).toBe(first('empathy'));
    expect(startingTip(TIPS, { stage: 'closure', traineeTurns: 9 })).toBe(first('closing'));
  });

  it('starts at the first tip when no tip is for that phase', () => {
    const only: Tip[] = TIPS.filter((tip) => tip.phase === 'closing');
    expect(startingTip(only, { stage: 'first-contact', traineeTurns: 0 })).toBe(0);
    expect(startingTip([], { stage: 'first-contact', traineeTurns: 0 })).toBe(0);
  });
});

describe('which tip comes up when the customer has finished a turn', () => {
  const context = { stage: 'first-contact', traineeTurns: 2 } as const;

  it('is the first tip of the phase that has not been shown, and not the one on show', () => {
    const scoping = TIPS.flatMap((tip, index) => (tip.phase === 'scoping' ? [index] : []));
    expect(scoping.length).toBeGreaterThan(2);
    const [one, two, three] = scoping as [number, number, number];
    expect(nextTip(TIPS, { ...context, current: one, seen: new Set([one]) })).toBe(two);
    expect(nextTip(TIPS, { ...context, current: two, seen: new Set([one, two]) })).toBe(three);
    // The one on show may be a tip that was not unseen: it is still skipped.
    expect(nextTip(TIPS, { ...context, current: two, seen: new Set() })).toBe(one);
  });

  it('goes on to the tip after the current one once the whole phase has been shown', () => {
    const scoping = TIPS.flatMap((tip, index) => (tip.phase === 'scoping' ? [index] : []));
    const seen = new Set(scoping);
    const last = scoping.at(-1) as number;
    expect(nextTip(TIPS, { ...context, current: last, seen })).toBe(last + 1);
  });

  it('wraps round at the end of the list, and never stays on the tip that was showing', () => {
    const everything = new Set(TIPS.map((_, index) => index));
    const last = TIPS.length - 1;
    expect(nextTip(TIPS, { ...context, current: last, seen: everything })).toBe(0);
    for (let current = 0; current < TIPS.length; current += 1) {
      expect(nextTip(TIPS, { ...context, current, seen: everything })).not.toBe(current);
    }
  });

  it('gives the same answer every time for the same call, and copes with a short list', () => {
    const input = { ...context, current: 3, seen: new Set([3]) };
    expect(nextTip(TIPS, input)).toBe(nextTip(TIPS, input));
    expect(nextTip([], { ...context, current: 0, seen: new Set() })).toBe(0);
    expect(nextTip(TIPS.slice(0, 1), { ...context, current: 0, seen: new Set([0]) })).toBe(0);
  });
});
