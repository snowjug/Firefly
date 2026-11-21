import { describe, expect, it } from 'vitest';
import { CoachingReportSchema, type CoachingReport } from '#shared/domain/report.ts';
import { wordCount } from '#shared/domain/scenario.ts';
import {
  CALLS,
  CALL_NAMES,
  SCENARIO_INDEX,
  asVersion1,
  evaluatingSession,
  failedSession,
  SERVER_EVALUATION_ERRORS,
  unreadableReportSession,
  type CallFixture,
} from './fixtures.ts';
import { locateQuote } from './transcript-model.ts';

const all = CALL_NAMES.map((name) => CALLS[name]);

/** Every quote the report makes about the call, with the turn it says it is from. */
function quotesOf(report: CoachingReport): { where: string; turn: number; quote: string }[] {
  const found: { where: string; turn: number; quote: string }[] = [];
  const add = (where: string, turn: number | null, quote: string | null) => {
    if (turn !== null && quote) found.push({ where, turn, quote });
  };
  for (const d of report.dimensions)
    for (const e of d.evidence) add(`dimension ${d.id}`, e.turnIndex, e.quote);
  for (const s of report.strengths) add(`strength ${s.title}`, s.turnIndex, s.quote);
  for (const i of report.improvements) add(`improvement ${i.title}`, i.turnIndex, i.quote);
  for (const f of report.discovery.results)
    add(`fact ${f.factId}`, f.revealedAtTurn, f.revealingQuestion);
  for (const p of report.journey.points) add(`journey point ${p.turnIndex}`, p.turnIndex, p.quote);
  for (const m of report.journey.milestones ?? []) add(`milestone ${m.id}`, m.turnIndex, m.quote);
  for (const principle of report.care ?? []) {
    for (const b of principle.behaviours)
      for (const e of b.evidence) add(`behaviour ${b.id}`, e.turnIndex, e.quote);
  }
  return found;
}

describe('the fixtures are valid reports', () => {
  it.each(all.map((call) => [call.name, call] as const))(
    '%s passes the shared report schema and is the same report the session carries',
    (_name, call) => {
      expect(CoachingReportSchema.safeParse(call.report).success).toBe(true);
      expect(call.session.report).toEqual(call.report);
      expect(call.session.status).toBe('completed');
    },
  );

  it('a version 1 report is the same call without CARE, CBCF and milestones, and still valid', () => {
    const old = asVersion1(CALLS.strong.report);
    expect(old.version).toBe(1);
    expect(old.care).toBeUndefined();
    expect(old.cbcf).toBeUndefined();
    expect(old.journey.milestones).toBeUndefined();
    expect(CoachingReportSchema.safeParse(old).success).toBe(true);
  });

  it('every version 2 report carries care, cbcf and milestones; the legacy call carries none', () => {
    for (const call of all) {
      if (call.name === 'legacy') {
        expect(call.report.version).toBe(1);
        expect(call.report.care).toBeUndefined();
        expect(call.report.journey.milestones).toBeUndefined();
      } else {
        expect(call.report.version).toBe(2);
        expect(call.report.care).toHaveLength(4);
        expect(call.report.cbcf?.status).toBe('awaiting-authoritative-source');
        expect(call.report.journey.milestones).toHaveLength(6);
      }
    }
  });
});

describe('the fixtures quote the calls they are about', () => {
  it.each(all.map((call) => [call.name, call] as const))(
    '%s: every quote is in the trainee turn it cites',
    (_name, call: CallFixture) => {
      const turns = new Map(call.session.turns.map((t) => [t.index, t] as const));
      for (const { where, turn, quote } of quotesOf(call.report)) {
        const cited = turns.get(turn);
        expect(cited, `${where}: turn ${turn} exists`).toBeDefined();
        expect(cited?.role, `${where}: turn ${turn} is the trainee's`).toBe('trainee');
        // A quote shorter than three characters cannot be found by the page either.
        if (quote.replace(/[^a-z0-9]/gi, '').length < 3) continue;
        expect(locateQuote(cited?.text ?? '', quote), `${where}: "${quote}"`).not.toBeNull();
      }
    },
  );
});

describe('the fixtures keep to the budgets the evaluator is held to', () => {
  it('summary: at most 45 words; strength title and reason: at most 35; improvement risk: at most 45', () => {
    for (const call of all.filter((c) => c.name !== 'long')) {
      const { report } = call;
      expect(wordCount(report.summary.overall), `${call.name} summary`).toBeLessThanOrEqual(45);
      for (const s of report.strengths) {
        expect(
          wordCount(`${s.title} ${s.whyItHelped}`),
          `${call.name} ${s.title}`,
        ).toBeLessThanOrEqual(35);
      }
      for (const i of report.improvements) {
        expect(wordCount(i.risk), `${call.name} ${i.title}`).toBeLessThanOrEqual(45);
      }
    }
  });
});

describe('the fixtures cover what the page has to show', () => {
  it('a strong call: no unexpected turn, so the escalation milestone does not apply', () => {
    const { report } = CALLS.strong;
    expect(report.curveball).toBeNull();
    expect(report.journey.milestones?.find((m) => m.id === 'escalation')?.status).toBe(
      'not-applicable',
    );
    expect(report.summary.overallScore).toBeGreaterThanOrEqual(4);
  });

  it('a weak call: no strengths, nothing reached, an unexpected turn left open', () => {
    const { report } = CALLS.weak;
    expect(report.strengths).toHaveLength(0);
    expect(report.journey.milestones?.every((m) => m.status === 'not-reached')).toBe(true);
    expect(report.curveball?.status).toBe('active');
    expect(report.improvements.some((i) => i.turnIndex !== null)).toBe(true);
  });

  it('a short call: ended early, no overall score, thin evidence', () => {
    const { report } = CALLS.short;
    expect(report.completion.status).toBe('ended-early');
    expect(report.summary.overallScore).toBeNull();
    expect(report.dimensions.some((d) => d.sufficiency === 'insufficient')).toBe(true);
    expect(report.improvements.some((i) => i.turnIndex === null)).toBe(false);
  });

  it('an unexpected turn that was handled: the escalation milestone is reached', () => {
    const { report } = CALLS.curveball;
    expect(report.curveball?.status).toBe('resolved');
    expect(report.journey.milestones?.find((m) => m.id === 'escalation')?.status).toBe('reached');
  });

  it('a call saved before the Microsoft scenarios: no product, no public brief, a retired scenario', () => {
    const { session, report } = CALLS.legacy;
    expect(session.scenario.product).toBeNull();
    expect(session.scenario.publicBrief).toBeNull();
    expect(SCENARIO_INDEX.some((s) => s.id === session.scenario.scenarioId)).toBe(false);
    expect(SCENARIO_INDEX.some((s) => s.id === report.nextPractice.suggestedScenarioId)).toBe(
      false,
    );
  });

  it('Microsoft scenarios name their product and every suggested scenario exists', () => {
    for (const name of ['strong', 'weak', 'short', 'curveball'] as const) {
      const { session, report } = CALLS[name];
      expect(session.scenario.product?.name, name).toMatch(/Teams|Entra|Outlook|OneDrive/);
      expect(
        SCENARIO_INDEX.some((s) => s.id === session.scenario.scenarioId),
        name,
      ).toBe(true);
      expect(
        SCENARIO_INDEX.some((s) => s.id === report.nextPractice.suggestedScenarioId),
        name,
      ).toBe(true);
    }
  });

  it('a spoken call has turns that came from speech, and a long call has more than sixty turns', () => {
    expect(CALLS.voice.session.turns.some((t) => t.inputMode === 'voice')).toBe(true);
    expect(CALLS.strong.session.turns.some((t) => t.inputMode === 'voice')).toBe(false);
    expect(CALLS.long.session.turns.length).toBeGreaterThanOrEqual(60);
  });

  it('markers sit on the trainee turns of a finished call and are gone while it is being evaluated', () => {
    for (const turn of CALLS.strong.session.turns) {
      if (turn.markers) expect(turn.role).toBe('trainee');
    }
    expect(CALLS.strong.session.turns.some((t) => (t.markers ?? []).length > 0)).toBe(true);
    const evaluating = evaluatingSession(CALLS.strong, 'scoring');
    expect(evaluating.report).toBeNull();
    expect(evaluating.status).toBe('completing');
    expect(evaluating.turns.some((t) => t.markers !== undefined)).toBe(false);
  });

  it('the failed and unreadable states keep the transcript and carry no report', () => {
    const failed = failedSession(CALLS.weak, SERVER_EVALUATION_ERRORS.internal);
    expect(failed.status).toBe('evaluation_failed');
    expect(failed.evaluationError?.retryable).toBe(true);
    expect(failed.turns).toHaveLength(CALLS.weak.session.turns.length);
    expect(unreadableReportSession(CALLS.strong).report).toBeNull();
  });
});
