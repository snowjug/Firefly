import { describe, expect, it } from 'vitest';
import type { CoachingReport } from '#shared/domain/report.ts';
import { buildCallEvents, nearestEvent, type CallEvent } from './events-model.ts';
import { evidenceTurns, turnLookup } from './evidence-model.ts';
import { CALLS, asVersion1, type CallFixture } from './fixtures.ts';

const events = (call: CallFixture, report: CoachingReport = call.report) =>
  buildCallEvents(report, turnLookup(evidenceTurns(call.session)));
const ids = (list: readonly CallEvent[]) => list.map((e) => e.id);
const byId = (list: readonly CallEvent[], id: string) => {
  const found = list.find((e) => e.id === id);
  if (!found) throw new Error(`No event ${id}`);
  return found;
};

describe('buildCallEvents', () => {
  it('lists a full call in the order of the call: each moment at its turn', () => {
    expect(ids(events(CALLS.strong))).toEqual([
      'greeting',
      'impact',
      'discovery-sales-only',
      'tension-4',
      'discovery-storage-changed',
      'discovery-external-guests',
      'discovery-first-missing',
      'ownership',
      'tension-10',
      'next-steps',
      'summary',
      'closing',
    ]);
  });

  it('gives every seen moment its turn and the words that show it, taken from what the report carries', () => {
    const list = events(CALLS.strong);
    expect(byId(list, 'greeting')).toMatchObject({
      state: 'seen',
      turnIndex: 2,
      quote: 'this is Sam from Microsoft support',
    });
    expect(byId(list, 'next-steps')).toMatchObject({
      state: 'seen',
      turnIndex: 10,
      quote: "I'll call you back by 1 PM today",
    });
    expect(byId(list, 'summary')).toMatchObject({ turnIndex: 12 });
    expect(byId(list, 'closing')).toMatchObject({
      turnIndex: 14,
      quote: 'Is there anything else I can help with right now?',
    });
  });

  it('marks what the call needed and never reached as not seen, with no turn and no quote', () => {
    expect(byId(events(CALLS.weak), 'greeting')).toMatchObject({
      state: 'not-seen',
      turnIndex: null,
      quote: null,
    });
  });

  it('draws no moment the report never listed as needed, and draws it as not seen once it is listed', () => {
    // The strong call's report never lists "confirmed what the issue was": the call did not need it.
    expect(ids(events(CALLS.strong))).not.toContain('issue');
    const listed: CoachingReport = {
      ...CALLS.strong.report,
      care: CALLS.strong.report.care?.map((p) =>
        p.id === 'communicate'
          ? {
              ...p,
              behaviours: [
                ...p.behaviours,
                {
                  id: 'communicate.context-confirmed',
                  principle: 'communicate',
                  label: 'Confirmed the context',
                  status: 'not-shown',
                  evidence: [],
                  note: null,
                } as const,
              ],
            }
          : p,
      ),
    };
    expect(byId(events(CALLS.strong, listed), 'issue')).toMatchObject({
      state: 'not-seen',
      turnIndex: null,
    });
  });

  it('makes one moment for each fact found, partly found ones included, and none for a missed fact', () => {
    const list = events(CALLS.strong).filter((e) => e.kind === 'discovery');
    expect(list).toHaveLength(4);
    expect(byId(list, 'discovery-external-guests').label).toBe('Fact partly found');
    expect(byId(list, 'discovery-storage-changed')).toMatchObject({
      label: 'Fact found',
      detail: 'Storage settings changed last week',
      turnIndex: 6,
    });
    expect(ids(list)).not.toContain('discovery-organiser-licence');
  });

  it('makes a moment of each turning point in the customer’s mood, with which way it went', () => {
    const list = events(CALLS.strong);
    expect(byId(list, 'tension-4')).toMatchObject({
      label: 'Tension eased',
      trend: 'down',
      turnIndex: 4,
    });
    expect(byId(list, 'tension-4').detail).toContain('Frustrated to Concerned');
    expect(byId(list, 'tension-4').detail).toContain('Asked a focused question about scope');
  });

  it('shows an unexpected turn once, where it fired, and never calls it a curveball', () => {
    const list = events(CALLS.curveball);
    const unexpected = list.filter((e) => e.kind === 'curveball');
    expect(unexpected).toHaveLength(1);
    expect(unexpected[0]).toMatchObject({ label: 'Unexpected turn', turnIndex: 2, state: 'seen' });
    expect(unexpected[0]?.detail).toContain('Mentions a bad experience');
    expect(unexpected[0]?.detail).toContain('Resolved');
    expect(list.every((e) => !/curveball/i.test(e.label + (e.detail ?? '')))).toBe(true);
  });

  it('has no unexpected-turn moment for a call that had none', () => {
    expect(events(CALLS.strong).some((e) => e.kind === 'curveball')).toBe(false);
  });

  it('puts the early moments nobody reached first and the late ones last, around what was seen', () => {
    const list = events(CALLS.weak);
    expect(ids(list)).toEqual([
      'greeting',
      'impact',
      'discovery',
      'curveball',
      'summary',
      'ownership',
      'next-steps',
      'closing',
    ]);
    expect(list.filter((e) => e.state === 'not-seen')).toHaveLength(7);
    expect(list.filter((e) => e.quote !== null)).toHaveLength(0);
  });

  it('for a call that ended early, says where it stopped and leaves what it never got to after that', () => {
    const list = events(CALLS.short);
    expect(ids(list)).toEqual([
      'greeting',
      'impact',
      'discovery-which-app',
      'ended',
      'ownership',
      'closing',
    ]);
    expect(list.filter((e) => e.state === 'seen').map((e) => e.id)).toEqual([
      'greeting',
      'discovery-which-app',
      'ended',
    ]);
    expect(byId(list, 'ended')).toMatchObject({
      kind: 'ended',
      label: 'Call ended',
      state: 'seen',
      turnIndex: 5,
      quote: null,
    });
    expect(byId(list, 'ended').detail).toMatch(/^The call ended early, after \d trainee turns?\.$/);
  });

  it('makes no end of the call for a call that was not ended early', () => {
    for (const name of ['strong', 'weak', 'curveball', 'legacy'] as const) {
      expect(ids(events(CALLS[name])), name).not.toContain('ended');
    }
  });

  it('for a version 1 report, shows only the moments it can support and invents no others', () => {
    expect(CALLS.legacy.report.version).toBe(1);
    const list = events(CALLS.legacy);
    expect(ids(list)).toEqual(['discovery-duration', 'discovery-east-office', 'tension-6']);
    expect(list.every((e) => e.state === 'seen')).toBe(true);
    const old = events(CALLS.strong, asVersion1(CALLS.strong.report));
    expect(old.map((e) => e.kind)).not.toContain('greeting');
    expect(old.map((e) => e.kind)).not.toContain('closing');
    expect(old.filter((e) => e.kind === 'discovery')).toHaveLength(4);
  });

  it('is seen only in call order: the seen moments never go backwards in the transcript', () => {
    for (const name of ['strong', 'weak', 'short', 'curveball', 'legacy', 'long'] as const) {
      const turns = events(CALLS[name])
        .filter((e) => e.state === 'seen')
        .map((e) => e.turnIndex as number);
      expect(turns, name).toEqual([...turns].sort((a, b) => a - b));
    }
  });

  it('shows a moment as unverified, with no turn and no quote, when the report’s words are not in the turn', () => {
    const report: CoachingReport = {
      ...CALLS.strong.report,
      journey: {
        ...CALLS.strong.report.journey,
        milestones: CALLS.strong.report.journey.milestones?.map((m) =>
          m.id === 'ownership' ? { ...m, quote: 'words that were never said' } : m,
        ),
      },
      care: CALLS.strong.report.care?.map((p) => ({
        ...p,
        behaviours: p.behaviours.map((b) =>
          b.id === 'accountable.ownership'
            ? { ...b, evidence: [{ turnIndex: 8, quote: 'nor these' }] }
            : b,
        ),
      })),
    };
    const ownership = byId(events(CALLS.strong, report), 'ownership');
    expect(ownership).toMatchObject({ state: 'unverified', turnIndex: null, quote: null });
  });

  it('treats a moment at a turn the transcript does not have as unverified, never as seen', () => {
    const report: CoachingReport = {
      ...CALLS.strong.report,
      journey: {
        ...CALLS.strong.report.journey,
        milestones: CALLS.strong.report.journey.milestones?.map((m) =>
          m.id === 'greeting' ? { ...m, turnIndex: 99 } : m,
        ),
      },
      care: CALLS.strong.report.care?.map((p) => ({
        ...p,
        behaviours: p.behaviours.filter(
          (b) => b.id !== 'communicate.greeting' && b.id !== 'communicate.introduction',
        ),
      })),
    };
    expect(byId(events(CALLS.strong, report), 'greeting').state).toBe('unverified');
  });

  it('falls back to the CARE behaviour when the milestone was not reached but the behaviour was shown', () => {
    const report: CoachingReport = {
      ...CALLS.strong.report,
      journey: {
        ...CALLS.strong.report.journey,
        milestones: CALLS.strong.report.journey.milestones?.map((m) =>
          m.id === 'greeting' ? { ...m, status: 'not-reached', turnIndex: null, quote: null } : m,
        ),
      },
    };
    expect(byId(events(CALLS.strong, report), 'greeting')).toMatchObject({
      state: 'seen',
      turnIndex: 2,
      quote: 'Hello Priya',
    });
  });

  it('copes with a long call: every seen moment points at a turn that exists', () => {
    const call = CALLS.long;
    const turns = new Set(call.session.turns.map((t) => t.index));
    for (const e of events(call)) {
      if (e.state === 'seen') expect(turns.has(e.turnIndex as number)).toBe(true);
    }
  });
});

describe('nearestEvent', () => {
  const list = events(CALLS.strong);

  it('is the moment on the turn, or the closest one before or after it', () => {
    expect(nearestEvent(list, 12)?.id).toBe('summary');
    expect(nearestEvent(list, 13)?.id).toBe('summary');
    expect(nearestEvent(list, 15)?.id).toBe('closing');
    expect(nearestEvent(list, 1)?.id).toBe('greeting');
  });

  it('takes the earlier moment when two are equally close', () => {
    // Turn 11 is one turn from the update time (10) and one from the summary (12).
    expect(nearestEvent(list, 11)?.id).toBe('tension-10');
  });

  it('never picks a moment that was not seen, and is null when nothing was seen', () => {
    expect(nearestEvent(events(CALLS.weak), 2)?.id).toBe('curveball');
    const none = events(CALLS.weak).filter((e) => e.state !== 'seen');
    expect(nearestEvent(none, 2)).toBeNull();
    expect(nearestEvent([], 2)).toBeNull();
  });
});
